-- 0082: Private "interested" at events, and "Who's going" before the event starts.
--  • From 24 hours before an event, members who RSVP'd "going" can see the other verified members going (compatible both
--    ways, no blocks, not hidden) and quietly tap "interested". Nobody sees who tapped them.
--  • If two people tap each other, both get "You both want to meet" and a chat opens. Works before and during the event.
--  • During the event (from 1 hour before), the list switches to people who are checked in, as in 0081, and "Say hi" works too.
-- Safe to re-run.

create table if not exists public.event_interest (
  event_id uuid not null references public.events(id) on delete cascade,
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, from_id, to_id)
);
alter table public.event_interest enable row level security;
drop policy if exists event_interest_own on public.event_interest;
create policy event_interest_own on public.event_interest for select using (from_id = auth.uid() or public.is_staff());

-- "Before" window: 24 hours before the start until the live window opens (1 hour before).
create or replace function public.event_before(e events) returns boolean
language sql stable as $$
  select e.status = 'published' and now() >= e.starts_at - interval '24 hours' and now() < e.starts_at - interval '1 hour';
$$;

-- Before the event: both RSVP'd going, verified, visible, compatible, no block.
create or replace function public.going_pair_ok(p_event uuid, a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select a <> b and exists (
    select 1
    from event_rsvps ra join event_rsvps rb on rb.event_id = ra.event_id and rb.user_id = b
    join profiles pa on pa.id = a join profiles pb on pb.id = b
    where ra.event_id = p_event and ra.user_id = a
      and ra.status = 'going' and rb.status = 'going'
      and not ra.hide_here and not rb.hide_here
      and pa.id_status = 'approved' and pb.id_status = 'approved'
      and (cardinality(pa.seeking) = 0 or pb.gender = any(pa.seeking))
      and (cardinality(pb.seeking) = 0 or pa.gender = any(pb.seeking))
  ) and not blocked_between(a, b);
$$;
revoke all on function public.going_pair_ok(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.event_here(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e events; me uuid := auth.uid(); mine event_rsvps; yr int := extract(year from now())::int; mode text;
begin
  if not (public.my_status() in ('active','preview','paused','taken') or public.is_staff()) then return null; end if;
  select * into e from events where id = p_event and status = 'published';
  if e.id is null then return null; end if;
  mode := case when event_live(e) then 'live' when event_before(e) then 'before' else null end;
  if mode is null then return jsonb_build_object('live', false, 'mode', null); end if;
  select * into mine from event_rsvps where event_id = p_event and user_id = me;
  return jsonb_build_object(
    'live', mode = 'live',
    'mode', mode,
    'going', coalesce(mine.status = 'going', false),
    'here', (select count(*) from event_rsvps where event_id = p_event and checked_in_at is not null),
    'going_count', (select count(*) from event_rsvps where event_id = p_event and status = 'going'),
    'me_here', mine.checked_in_at is not null,
    'hidden', coalesce(mine.hide_here, false),
    'waves_left', greatest(0, 5 - (select count(*) from event_waves w where w.event_id = p_event and w.from_id = me)),
    'matches', case when mode <> 'live' or mine.checked_in_at is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'first_name', p.first_name, 'conversation_id', c.id, 'since', r.checked_in_at) order by r.checked_in_at desc)
      from event_rsvps r
      join profiles p on p.id = r.user_id
      join conversations c on c.ended_at is null and ((c.user_a = me and c.user_b = r.user_id) or (c.user_b = me and c.user_a = r.user_id))
      where r.event_id = p_event and r.checked_in_at is not null and r.user_id <> me and not blocked_between(me, r.user_id)), '[]') end,
    'people', case
      when coalesce(mine.hide_here, false) then '[]'::jsonb
      when mode = 'live' and mine.checked_in_at is null then '[]'::jsonb
      when mode = 'before' and coalesce(mine.status, '') <> 'going' then '[]'::jsonb
      else coalesce((
      select jsonb_agg(x order by (x->>'mutual')::boolean desc, x->>'since' desc) from (
        select jsonb_build_object(
          'id', p.id, 'first_name', p.first_name,
          'age', case when p.birth_year is null then null else yr - p.birth_year end,
          'job', p.job, 'band', p.band, 'since', coalesce(r.checked_in_at, r.created_at),
          'conversation_id', (select c.id from conversations c where c.ended_at is null and c.user_a = least(me, p.id) and c.user_b = greatest(me, p.id)),
          'waved', exists (select 1 from event_waves w where w.event_id = p_event and w.from_id = me and w.to_id = p.id),
          'waved_me', exists (select 1 from event_waves w where w.event_id = p_event and w.from_id = p.id and w.to_id = me),
          'interested', exists (select 1 from event_interest i where i.event_id = p_event and i.from_id = me and i.to_id = p.id),
          -- Their interest is only ever revealed when it's mutual.
          'mutual', exists (select 1 from event_interest i where i.event_id = p_event and i.from_id = me and i.to_id = p.id)
                and exists (select 1 from event_interest i where i.event_id = p_event and i.from_id = p.id and i.to_id = me)) x
        from event_rsvps r join profiles p on p.id = r.user_id
        where r.event_id = p_event and r.user_id <> me
          and case when mode = 'live' then r.checked_in_at is not null and here_pair_ok(p_event, me, r.user_id)
                   else going_pair_ok(p_event, me, r.user_id) end
        limit 80) s), '[]') end);
end $$;
grant execute on function public.event_here(uuid) to authenticated;

-- Tap (or untap) "interested". When it becomes mutual: open a chat and tell both people.
create or replace function public.event_interest_set(p_event uuid, p_to uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); e events; ok boolean; conv uuid; mutual boolean := false; ev_title text;
begin
  select * into e from events where id = p_event;
  if e.id is null or not (event_live(e) or event_before(e)) then raise exception 'This opens 24 hours before the event'; end if;
  ok := case when event_live(e) then here_pair_ok(p_event, me, p_to) else going_pair_ok(p_event, me, p_to) end;
  if not ok then raise exception 'They’re not available here'; end if;
  if not p_on then
    delete from event_interest where event_id = p_event and from_id = me and to_id = p_to;
    return jsonb_build_object('interested', false, 'mutual', false);
  end if;
  if (select count(*) from event_interest where event_id = p_event and from_id = me) >= 15 then raise exception 'That’s plenty for one event. Go say hi!'; end if;
  insert into event_interest(event_id, from_id, to_id) values (p_event, me, p_to) on conflict do nothing;
  mutual := exists (select 1 from event_interest where event_id = p_event and from_id = p_to and to_id = me);
  if mutual then
    select id into conv from conversations where user_a = least(me, p_to) and user_b = greatest(me, p_to);
    if conv is null then
      insert into conversations(user_a, user_b, event_id) values (least(me, p_to), greatest(me, p_to), p_event) returning id into conv;
    end if;
    ev_title := e.title;
    perform notify(p_to, me, 'event_mutual', 'interaction', 'You both want to meet',
      first_name_of(me) || ' is interested too. Say hi' || case when event_live(e) then ' — they’re here at ' else ' before ' end || ev_title || '.',
      '/app/messages/' || conv, 'eventmutual:' || p_event || ':' || least(me, p_to) || greatest(me, p_to), false);
    perform notify(me, p_to, 'event_mutual', 'interaction', 'You both want to meet',
      first_name_of(p_to) || ' is interested too. Say hi' || case when event_live(e) then ' — they’re here at ' else ' before ' end || ev_title || '.',
      '/app/messages/' || conv, 'eventmutual:' || p_event || ':' || greatest(me, p_to) || least(me, p_to), false);
  end if;
  return jsonb_build_object('interested', true, 'mutual', mutual, 'conversation_id', conv);
end $$;
revoke all on function public.event_interest_set(uuid, uuid, boolean) from public, anon;
grant execute on function public.event_interest_set(uuid, uuid, boolean) to authenticated;
