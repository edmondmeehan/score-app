-- 0050: Giveaways (sweepstakes) run by ScoreDate, LLC.
-- Apple 5.3: we sponsor it, official rules are in the app and say Apple isn't involved, and no purchase is ever
-- needed to enter or win. Anyone eligible can enter free on the website; members can enter in the app.
-- Bonus entries come only from free actions (complete profile, friends who join), never from paying.

create table if not exists public.giveaways (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 3 and 120),
  prize text not null check (length(prize) between 2 and 300),
  prize_value_usd numeric(10,2) not null default 0 check (prize_value_usd >= 0),
  winners_count int not null default 1 check (winners_count between 1 and 20),
  description text check (length(description) <= 2000),
  image_url text check (image_url is null or image_url ~ '^https://'),
  partner text check (length(partner) <= 120),
  area text not null default 'New York City',
  eligibility text not null default 'Open to legal residents of New York, New Jersey and Connecticut who are 25 or older.',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','live','closed','drawn','cancelled')),
  extra_rules text check (length(extra_rules) <= 4000),
  created_by text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.giveaway_entries (
  id bigint generated always as identity primary key,
  giveaway_id uuid not null references public.giveaways(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  first_name text check (length(first_name) <= 60),
  zip text check (zip ~ '^\d{5}$'),
  source text not null check (source in ('app','web')),
  created_at timestamptz not null default now(),
  unique (giveaway_id, email)
);
create index if not exists giveaway_entries_g on public.giveaway_entries (giveaway_id);

create table if not exists public.giveaway_winners (
  id bigint generated always as identity primary key,
  giveaway_id uuid not null references public.giveaways(id) on delete cascade,
  entry_id bigint not null references public.giveaway_entries(id) on delete cascade,
  drawn_at timestamptz not null default now(),
  drawn_by text,
  status text not null default 'notified' check (status in ('notified','claimed','forfeited')),
  unique (giveaway_id, entry_id)
);

alter table public.giveaways enable row level security;
alter table public.giveaway_entries enable row level security;
alter table public.giveaway_winners enable row level security;
drop policy if exists giveaways_read on public.giveaways;
create policy giveaways_read on public.giveaways for select using (status in ('live','closed','drawn') or staff_role() is not null);
drop policy if exists giveaway_entries_own on public.giveaway_entries;
create policy giveaway_entries_own on public.giveaway_entries for select using (user_id = auth.uid() or staff_role() is not null);
drop policy if exists giveaway_winners_staff on public.giveaway_winners;
create policy giveaway_winners_staff on public.giveaway_winners for select using (staff_role() is not null);

-- Entries for one entrant: 1, +1 for a complete member profile, +1 per friend who joined during the giveaway (max 3).
create or replace function public.giveaway_weight(p_g uuid, p_entry bigint) returns int
language sql stable security definer set search_path = public as $$
  select 1
    + case when p.id is not null and p.photo_status = 'approved' and p.id_status = 'approved'
             and jsonb_array_length(coalesce(p.prompts, '[]'::jsonb)) >= 3 then 1 else 0 end
    + least(3, (select count(*) from invites i where i.inviter_id = e.user_id and i.redeemed_at between g.starts_at and g.ends_at))::int
  from giveaway_entries e join giveaways g on g.id = e.giveaway_id left join profiles p on p.id = e.user_id
  where e.id = p_entry and e.giveaway_id = p_g;
$$;

create or replace function public.giveaway_open(p_g uuid) returns boolean language sql stable as $$
  select exists (select 1 from giveaways where id = p_g and status = 'live' and now() between starts_at and ends_at);
$$;

-- Member entry from the app (free, one per person).
create or replace function public.enter_giveaway(p_g uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me profiles; eid bigint;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null then raise exception 'Sign in first'; end if;
  if not giveaway_open(p_g) then raise exception 'This giveaway isn’t open'; end if;
  if me.birth_year is not null and extract(year from now())::int - me.birth_year < 25 then raise exception 'You must be 25 or older'; end if;
  insert into giveaway_entries(giveaway_id, user_id, email, first_name, zip, source)
  values (p_g, me.id, coalesce(me.email, (select email from auth.users where id = me.id)), me.first_name, me.zip, 'app')
  on conflict (giveaway_id, email) do update set user_id = excluded.user_id
  returning id into eid;
  return jsonb_build_object('entries', giveaway_weight(p_g, eid));
end $$;

-- Free entry on the website, no account and no purchase needed.
create or replace function public.enter_giveaway_web(p_g uuid, p_email text, p_first text, p_zip text, p_age_ok boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not giveaway_open(p_g) then raise exception 'This giveaway isn’t open'; end if;
  if not coalesce(p_age_ok, false) then raise exception 'You must confirm you are 25 or older'; end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email'; end if;
  if coalesce(p_zip, '') !~ '^\d{5}$' then raise exception 'Enter a 5-digit ZIP code'; end if;
  insert into giveaway_entries(giveaway_id, email, first_name, zip, source, user_id)
  values (p_g, lower(trim(p_email)), left(trim(p_first), 60), p_zip, 'web',
          (select p.id from profiles p join auth.users u on u.id = p.id where lower(u.email) = lower(trim(p_email)) limit 1))
  on conflict (giveaway_id, email) do nothing;
  return true;
end $$;

-- What the app shows for one giveaway: am I in, and with how many entries.
create or replace function public.my_giveaway(p_g uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('entered', e.id is not null, 'entries', case when e.id is null then 0 else giveaway_weight(p_g, e.id) end,
                            'total', (select count(*) from giveaway_entries where giveaway_id = p_g))
  from (select 1) x left join giveaway_entries e on e.giveaway_id = p_g and e.user_id = auth.uid();
$$;

create or replace function public.staff_save_giveaway(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid := nullif(p->>'id', '')::uuid;
begin
  if coalesce(staff_role(), '') not in ('owner','community') then raise exception 'Only owners and community staff can edit giveaways'; end if;
  if gid is null then
    insert into giveaways(title, prize, prize_value_usd, winners_count, description, image_url, partner, area, eligibility, starts_at, ends_at, status, extra_rules, created_by)
    values (p->>'title', p->>'prize', coalesce((p->>'prize_value_usd')::numeric, 0), coalesce((p->>'winners_count')::int, 1), nullif(p->>'description', ''),
            nullif(p->>'image_url', ''), nullif(p->>'partner', ''), coalesce(nullif(p->>'area', ''), 'New York City'),
            coalesce(nullif(p->>'eligibility', ''), 'Open to legal residents of New York, New Jersey and Connecticut who are 25 or older.'),
            (p->>'starts_at')::timestamptz, (p->>'ends_at')::timestamptz, coalesce(nullif(p->>'status', ''), 'draft'), nullif(p->>'extra_rules', ''), staff_email())
    returning id into gid;
  else
    update giveaways set title = p->>'title', prize = p->>'prize', prize_value_usd = coalesce((p->>'prize_value_usd')::numeric, 0),
      winners_count = coalesce((p->>'winners_count')::int, 1), description = nullif(p->>'description', ''), image_url = nullif(p->>'image_url', ''),
      partner = nullif(p->>'partner', ''), area = coalesce(nullif(p->>'area', ''), area), eligibility = coalesce(nullif(p->>'eligibility', ''), eligibility),
      starts_at = (p->>'starts_at')::timestamptz, ends_at = (p->>'ends_at')::timestamptz,
      status = case when status = 'drawn' then status else coalesce(nullif(p->>'status', ''), status) end, extra_rules = nullif(p->>'extra_rules', '')
    where id = gid;
  end if;
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'giveaway_save', p->>'title');
  return gid;
end $$;

-- Weighted random draw. Members who win get an in-app notification; everyone else is shown to staff to email.
create or replace function public.staff_draw_giveaway(p_g uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g giveaways; r record; picked int := 0;
begin
  if coalesce(staff_role(), '') not in ('owner','community') then raise exception 'Only owners and community staff can draw winners'; end if;
  select * into g from giveaways where id = p_g for update;
  if g.id is null then raise exception 'Not found'; end if;
  if now() < g.ends_at then raise exception 'Wait until the giveaway ends to draw'; end if;
  for r in
    select e.id, e.user_id, -ln(random()) / giveaway_weight(p_g, e.id) as k
    from giveaway_entries e
    where e.giveaway_id = p_g and not exists (select 1 from giveaway_winners w where w.entry_id = e.id)
      and (e.user_id is null or not exists (select 1 from profiles p where p.id = e.user_id and p.status in ('suspended','removed')))
    order by k limit g.winners_count - (select count(*) from giveaway_winners where giveaway_id = p_g and status <> 'forfeited')
  loop
    insert into giveaway_winners(giveaway_id, entry_id, drawn_by) values (p_g, r.id, staff_email());
    if r.user_id is not null then
      perform notify(r.user_id, null, 'giveaway_won', 'milestone', 'You won: ' || g.title,
        'Congratulations! Check your email in the next day to claim ' || g.prize || '.', '/app/discover', 'giveaway:' || p_g, false);
    end if;
    picked := picked + 1;
  end loop;
  update giveaways set status = 'drawn' where id = p_g;
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'giveaway_draw', g.title || ' · ' || picked || ' winner(s)');
  return jsonb_build_object('picked', picked);
end $$;

create or replace function public.staff_giveaway_winner(p_winner bigint, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(staff_role(), '') not in ('owner','community') then raise exception 'Not allowed'; end if;
  if p_status not in ('notified','claimed','forfeited') then raise exception 'Bad status'; end if;
  update giveaway_winners set status = p_status where id = p_winner;
end $$;

revoke all on function public.enter_giveaway(uuid), public.my_giveaway(uuid), public.staff_save_giveaway(jsonb),
  public.staff_draw_giveaway(uuid), public.staff_giveaway_winner(bigint, text), public.giveaway_weight(uuid, bigint) from public, anon;
grant execute on function public.enter_giveaway(uuid), public.my_giveaway(uuid), public.staff_save_giveaway(jsonb),
  public.staff_draw_giveaway(uuid), public.staff_giveaway_winner(bigint, text), public.giveaway_weight(uuid, bigint) to authenticated;
grant execute on function public.enter_giveaway_web(uuid, text, text, text, boolean), public.giveaway_open(uuid) to anon, authenticated;
