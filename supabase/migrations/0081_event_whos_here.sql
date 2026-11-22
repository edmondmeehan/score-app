-- 0081: "Who's here" at events. Once you're scanned in, you see the other verified members who are checked in
-- (people you could match with, both ways) and can say hi with a short message to meet up. Safe to re-run.
--  • Only checked-in, ID-verified members appear, never across a block, and only to other checked-in members.
--  • Anyone can hide themselves from Who's here for an event (they then don't see the list either).
--  • Up to 5 hellos per event per person, one per person. The hello starts (or continues) a normal chat.

alter table public.event_rsvps add column if not exists hide_here boolean not null default false;
alter table public.conversations add column if not exists event_id uuid references public.events(id) on delete set null;

create table if not exists public.event_waves (
  event_id uuid not null references public.events(id) on delete cascade,
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, from_id, to_id)
);
alter table public.event_waves enable row level security;
drop policy if exists event_waves_own on public.event_waves;
create policy event_waves_own on public.event_waves for select using (auth.uid() in (from_id, to_id) or public.is_staff());

-- Is the event in its live window (1 hour before start until the end, or 5 hours after start)?
create or replace function public.event_live(e events) returns boolean
language sql stable as $$
  select e.status = 'published' and now() between e.starts_at - interval '1 hour' and coalesce(e.ends_at, e.starts_at + interval '5 hours');
$$;

-- Could a and b be shown to each other (both checked in, verified, visible, compatible preferences, no block)?
create or replace function public.here_pair_ok(p_event uuid, a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select a <> b and exists (
    select 1
    from event_rsvps ra join event_rsvps rb on rb.event_id = ra.event_id and rb.user_id = b
    join profiles pa on pa.id = a join profiles pb on pb.id = b
    where ra.event_id = p_event and ra.user_id = a
      and ra.checked_in_at is not null and rb.checked_in_at is not null
      and not ra.hide_here and not rb.hide_here
      and pa.id_status = 'approved' and pb.id_status = 'approved'
      and (cardinality(pa.seeking) = 0 or pb.gender = any(pa.seeking))
      and (cardinality(pb.seeking) = 0 or pa.gender = any(pb.seeking))
  ) and not blocked_between(a, b);
$$;
revoke all on function public.here_pair_ok(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.event_here(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e events; me uuid := auth.uid(); mine event_rsvps; yr int := extract(year from now())::int;
begin
  if not (public.my_status() in ('active','preview','paused','taken') or public.is_staff()) then return null; end if;
  select * into e from events where id = p_event and status = 'published';
  if e.id is null then return null; end if;
  if not event_live(e) then return jsonb_build_object('live', false); end if;
  select * into mine from event_rsvps where event_id = p_event and user_id = me;
  return jsonb_build_object(
    'live', true,
    'here', (select count(*) from event_rsvps where event_id = p_event and checked_in_at is not null),
    'me_here', mine.checked_in_at is not null,
    'hidden', coalesce(mine.hide_here, false),
    'waves_left', greatest(0, 5 - (select count(*) from event_waves w where w.event_id = p_event and w.from_id = me)),
    -- People you've already matched with who are here (as before).
    'matches', case when mine.checked_in_at is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'first_name', p.first_name, 'conversation_id', c.id, 'since', r.checked_in_at) order by r.checked_in_at desc)
      from event_rsvps r
      join profiles p on p.id = r.user_id
      join conversations c on c.ended_at is null and ((c.user_a = me and c.user_b = r.user_id) or (c.user_b = me and c.user_a = r.user_id))
      where r.event_id = p_event and r.checked_in_at is not null and r.user_id <> me and not blocked_between(me, r.user_id)), '[]') end,
    -- Everyone else here you could meet (checked in, verified, compatible both ways). Newest arrivals first.
    'people', case when mine.checked_in_at is null or mine.hide_here then '[]'::jsonb else coalesce((
      select jsonb_agg(x order by x->>'since' desc) from (
        select jsonb_build_object(
          'id', p.id, 'first_name', p.first_name,
          'age', case when p.birth_year is null then null else yr - p.birth_year end,
          'job', p.job, 'band', p.band, 'since', r.checked_in_at,
          'conversation_id', (select c.id from conversations c where c.ended_at is null and c.user_a = least(me, p.id) and c.user_b = greatest(me, p.id)),
          'waved', exists (select 1 from event_waves w where w.event_id = p_event and w.from_id = me and w.to_id = p.id),
          'waved_me', exists (select 1 from event_waves w where w.event_id = p_event and w.from_id = p.id and w.to_id = me)) x
        from event_rsvps r join profiles p on p.id = r.user_id
        where r.event_id = p_event and r.checked_in_at is not null and here_pair_ok(p_event, me, r.user_id)
        limit 80) s), '[]') end);
end $$;
grant execute on function public.event_here(uuid) to authenticated;

-- Hide or show yourself in Who's here for this event.
create or replace function public.event_hide_here(p_event uuid, p_hide boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update event_rsvps set hide_here = p_hide where event_id = p_event and user_id = auth.uid();
end $$;
grant execute on function public.event_hide_here(uuid, boolean) to authenticated;

-- Say hi to someone who's here. Starts (or continues) a chat and sends the message; they get a push.
create or replace function public.event_wave(p_event uuid, p_to uuid, p_message text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); e events; conv uuid; body text := left(trim(coalesce(p_message, '')), 200);
begin
  select * into e from events where id = p_event;
  if e.id is null or not event_live(e) then raise exception 'This event isn’t live right now'; end if;
  if not here_pair_ok(p_event, me, p_to) then raise exception 'They’re not available to meet here'; end if;
  if body = '' then raise exception 'Write a short message'; end if;
  if exists (select 1 from event_waves where event_id = p_event and from_id = me and to_id = p_to) then raise exception 'You already said hi'; end if;
  if (select count(*) from event_waves where event_id = p_event and from_id = me) >= 5 then raise exception 'You’ve said hi to 5 people at this event. Go find them!'; end if;

  select id into conv from conversations where user_a = least(me, p_to) and user_b = greatest(me, p_to);
  if conv is null then
    insert into conversations(user_a, user_b, event_id) values (least(me, p_to), greatest(me, p_to), p_event) returning id into conv;
  elsif exists (select 1 from conversations where id = conv and ended_at is not null) then
    raise exception 'This conversation has ended';
  end if;
  insert into messages(conversation_id, sender_id, body) values (conv, me, body);
  insert into event_waves(event_id, from_id, to_id, conversation_id) values (p_event, me, p_to, conv);
  return conv;
end $$;
revoke all on function public.event_wave(uuid, uuid, text) from public, anon;
grant execute on function public.event_wave(uuid, uuid, text) to authenticated;
