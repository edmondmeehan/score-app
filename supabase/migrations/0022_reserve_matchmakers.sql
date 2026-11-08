-- 0022: Reserve matchmakers + a switch to hide the Reserve tier.
-- Reserve starts hidden. Turn it on in Admin → Reserve once at least one matchmaker can take calls.

-- Matchmaker staff role
alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check check (role in ('owner','moderator','verification','community','matchmaker'));

insert into public.app_config(key, value) values ('reserve_visible', 'false') on conflict (key) do nothing;

create table if not exists public.matchmakers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 60),
  staff_email text,
  photo_url text,
  bio text check (bio is null or length(bio) <= 400),
  booking_url text check (booking_url is null or booking_url ~ '^https://'),
  contact_email text not null default 'reserve@scoredate.app',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.matchmakers enable row level security;
drop policy if exists mm_staff on public.matchmakers;
create policy mm_staff on public.matchmakers for select using (public.is_staff());

alter table public.profiles add column if not exists matchmaker_id uuid references public.matchmakers(id) on delete set null;
alter table public.profiles add column if not exists matchmaker_assigned_at timestamptz;

-- Member <-> matchmaker messages (kept in Score so there's a record and nothing breaks if a matchmaker changes)
create table if not exists public.matchmaker_messages (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.profiles(id) on delete cascade,
  matchmaker_id uuid references public.matchmakers(id) on delete set null,
  from_member boolean not null,
  body text not null check (length(body) between 1 and 2000),
  staff_email text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mm_msgs_member on public.matchmaker_messages(member_id, created_at);
alter table public.matchmaker_messages enable row level security;
drop policy if exists mm_msgs_own on public.matchmaker_messages;
create policy mm_msgs_own on public.matchmaker_messages for select using (member_id = auth.uid());
drop policy if exists mm_msgs_staff on public.matchmaker_messages;
create policy mm_msgs_staff on public.matchmaker_messages for select using (public.is_staff());

-- Private notes (staff only, never shown to the member)
create table if not exists public.matchmaker_notes (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.profiles(id) on delete cascade,
  staff_email text not null,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.matchmaker_notes enable row level security;
drop policy if exists mm_notes_staff on public.matchmaker_notes;
create policy mm_notes_staff on public.matchmaker_notes for select using (public.is_staff());

create or replace function public.reserve_visible() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select value = 'true'::jsonb from app_config where key = 'reserve_visible'), false);
$$;
grant execute on function public.reserve_visible() to anon, authenticated;

-- New Reserve sign-ups are blocked while the tier is hidden (existing Reserve members keep it).
create or replace function public.choose_plan(p_plan text) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if me.id_status <> 'approved' or me.band is null then raise exception 'finish verification first'; end if;
  if p_plan = 'preview' then
    update profiles set plan = 'preview', status = 'preview',
      preview_ends_at = now() + make_interval(days => (select (value::text)::int from app_config where key='preview_days'))
      where id = me.id;
  elsif p_plan in ('membership','premium','black') then
    if not test_mode() then raise exception 'payments not connected yet'; end if;
    if p_plan = 'black' and me.plan <> 'black' and not reserve_visible() then raise exception 'Reserve isn''t available yet'; end if;
    update profiles set plan = p_plan, status = 'active' where id = me.id;
  elsif p_plan = 'paused' then
    update profiles set plan = 'paused', status = 'paused' where id = me.id;
  elsif p_plan = 'taken' then
    update profiles set plan = 'paused', status = 'taken' where id = me.id;
  else raise exception 'unknown plan'; end if;
end $$;

-- ---------- Member side ----------
create or replace function public.my_matchmaker() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me profiles; mm matchmakers;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.plan <> 'black' then return null; end if;
  select * into mm from matchmakers where id = me.matchmaker_id and active;
  return jsonb_build_object(
    'assigned', mm.id is not null,
    'name', mm.name, 'photo_url', mm.photo_url, 'bio', mm.bio, 'booking_url', mm.booking_url,
    'contact_email', coalesce(mm.contact_email, 'reserve@scoredate.app'),
    'unread', (select count(*) from matchmaker_messages where member_id = me.id and not from_member and read_at is null));
end $$;
grant execute on function public.my_matchmaker() to authenticated;

create or replace function public.send_matchmaker_message(p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles; recent int;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.plan <> 'black' then raise exception 'Matchmaking is part of Reserve.'; end if;
  if length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Write a message first.'; end if;
  select count(*) into recent from matchmaker_messages where member_id = me.id and from_member and created_at > now() - interval '1 hour';
  if recent >= 20 then raise exception 'You''ve sent a lot of messages. Your matchmaker will reply soon.'; end if;
  insert into matchmaker_messages(member_id, matchmaker_id, from_member, body) values (me.id, me.matchmaker_id, true, left(trim(p_body), 2000));
end $$;
grant execute on function public.send_matchmaker_message(text) to authenticated;

create or replace function public.mark_matchmaker_read() returns void
language sql security definer set search_path = public as $$
  update matchmaker_messages set read_at = now() where member_id = auth.uid() and not from_member and read_at is null;
$$;
grant execute on function public.mark_matchmaker_read() to authenticated;

-- ---------- Staff side ----------
create or replace function public.staff_set_reserve_visible(p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(staff_role(), '') <> 'owner' then raise exception 'Only owners can change this'; end if;
  insert into app_config(key, value) values ('reserve_visible', to_jsonb(p_on)) on conflict (key) do update set value = excluded.value;
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'reserve_' || case when p_on then 'shown' else 'hidden' end, null);
end $$;
grant execute on function public.staff_set_reserve_visible(boolean) to authenticated;

create or replace function public.staff_save_matchmaker(p_id uuid, p_name text, p_staff_email text, p_photo_url text, p_bio text, p_booking_url text, p_contact_email text, p_active boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  if coalesce(staff_role(), '') <> 'owner' then raise exception 'Only owners can manage matchmakers'; end if;
  if p_id is null then
    insert into matchmakers(name, staff_email, photo_url, bio, booking_url, contact_email, active)
    values (trim(p_name), nullif(lower(trim(p_staff_email)), ''), nullif(trim(p_photo_url), ''), nullif(trim(p_bio), ''), nullif(trim(p_booking_url), ''), coalesce(nullif(trim(p_contact_email), ''), 'reserve@scoredate.app'), coalesce(p_active, true))
    returning id into mid;
  else
    update matchmakers set name = trim(p_name), staff_email = nullif(lower(trim(p_staff_email)), ''), photo_url = nullif(trim(p_photo_url), ''),
      bio = nullif(trim(p_bio), ''), booking_url = nullif(trim(p_booking_url), ''), contact_email = coalesce(nullif(trim(p_contact_email), ''), 'reserve@scoredate.app'),
      active = coalesce(p_active, true) where id = p_id returning id into mid;
  end if;
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'matchmaker_saved', p_name);
  return mid;
end $$;
grant execute on function public.staff_save_matchmaker(uuid, text, text, text, text, text, text, boolean) to authenticated;

create or replace function public.staff_assign_matchmaker(p_member uuid, p_matchmaker uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  update profiles set matchmaker_id = p_matchmaker, matchmaker_assigned_at = case when p_matchmaker is null then null else now() end where id = p_member;
  insert into audit_log(staff_email, action, target_user, reason) values (staff_email(), 'matchmaker_assigned', p_member, (select name from matchmakers where id = p_matchmaker));
end $$;
grant execute on function public.staff_assign_matchmaker(uuid, uuid) to authenticated;

create or replace function public.staff_matchmaker_reply(p_member uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  if length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Write a message first.'; end if;
  insert into matchmaker_messages(member_id, matchmaker_id, from_member, body, staff_email)
  values (p_member, (select matchmaker_id from profiles where id = p_member), false, left(trim(p_body), 2000), staff_email());
end $$;
grant execute on function public.staff_matchmaker_reply(uuid, text) to authenticated;

create or replace function public.staff_matchmaker_note(p_member uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  insert into matchmaker_notes(member_id, staff_email, body) values (p_member, staff_email(), left(trim(p_body), 2000));
end $$;
grant execute on function public.staff_matchmaker_note(uuid, text) to authenticated;

-- Reserve members with their matchmaker, unread count and last message.
create or replace function public.staff_reserve_members() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  return coalesce((select jsonb_agg(x order by (x->>'waiting')::int desc, x->>'last_at' desc nulls last) from (
    select jsonb_build_object(
      'id', p.id, 'first_name', p.first_name, 'band', p.band, 'neighborhood', p.neighborhood,
      'matchmaker_id', p.matchmaker_id, 'matchmaker', m.name, 'assigned_at', p.matchmaker_assigned_at,
      'waiting', (select count(*) from matchmaker_messages mm where mm.member_id = p.id and mm.from_member
                   and mm.created_at > coalesce((select max(created_at) from matchmaker_messages r where r.member_id = p.id and not r.from_member), 'epoch')),
      'last_at', (select max(created_at) from matchmaker_messages mm where mm.member_id = p.id)) x
    from profiles p left join matchmakers m on m.id = p.matchmaker_id
    where p.plan = 'black') s), '[]');
end $$;
grant execute on function public.staff_reserve_members() to authenticated;
