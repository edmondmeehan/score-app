-- 0085: App Review demo world. The App Store reviewer account (review@scoredate.app, "Alex") always has a full app to test,
-- and real members never see a demo person.
--  • profiles.is_demo marks the sample profiles (@seed.scoredate.test) AND the reviewer account. Demo and real members are
--    two separate worlds: Drops, search, likes, events (Who's here / going) and profile pages never cross between them.
--  • Every night when the Drop flips, reviewer_refresh() gives the reviewer a fresh Drop of demo profiles (recycling the same
--    faces), tops up "who liked you", keeps the conversation with Nadia open with an unread message, and keeps Premium active.
--  • If the reviewer likes a demo profile, it likes them back, so matching and chat can be tested.
--  • Reviewer emails live in app_config 'reviewer_emails' (add more there if Apple ever needs a second account).
-- Safe to re-run.

alter table public.profiles add column if not exists is_demo boolean not null default false;
create index if not exists profiles_is_demo on public.profiles(is_demo) where is_demo;

insert into public.app_config(key, value) values ('reviewer_emails', '["review@scoredate.app"]'::jsonb)
on conflict (key) do nothing;

-- Is this account an App Review account?
create or replace function public.is_reviewer(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_user
      and lower(u.email) in (select lower(jsonb_array_elements_text(coalesce((select value from app_config where key = 'reviewer_emails'), '[]'::jsonb))))
  );
$$;
revoke all on function public.is_reviewer(uuid) from public, anon, authenticated;

-- Which world am I in? (false for real members and for anyone signed out)
create or replace function public.my_is_demo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_demo from profiles where id = auth.uid()), false);
$$;
grant execute on function public.my_is_demo() to authenticated;

-- Mark the sample profiles and the reviewer.
update public.profiles p set is_demo = true
where not p.is_demo and (
  coalesce(p.email, '') ilike '%@seed.scoredate.test'
  or exists (select 1 from auth.users u where u.id = p.id and u.email ilike '%@seed.scoredate.test')
  or public.is_reviewer(p.id));

-- New reviewer/demo accounts get marked automatically when their profile is created.
create or replace function public.trg_mark_demo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.email, '') ilike '%@seed.scoredate.test' or public.is_reviewer(new.id) then new.is_demo := true; end if;
  return new;
end $$;
drop trigger if exists mark_demo on public.profiles;
create trigger mark_demo before insert on public.profiles for each row execute function public.trg_mark_demo();

-- Members can't flip this themselves.
revoke update (is_demo) on public.profiles from authenticated;

-- Profile pages: you only see profiles in your own world (staff keep their separate policy and see everyone).
drop policy if exists prof_visible on public.profiles;
create policy prof_visible on public.profiles for select to authenticated
  using (status in ('active','preview') and public.my_status() in ('active','preview','paused','taken') and is_demo = public.my_is_demo());

-- ---------- Drops and search stay inside your world ----------
create or replace function public.fill_drop(me profiles, n int) returns int
language plpgsql security definer set search_path = public as $$
declare added int; aff jsonb := band_affinity(me.id);
begin
  if (me.nomad and not coalesce(me.visit_until >= current_date, false)) or coalesce(me.away_until >= current_date and me.away_pause, false) then return 0; end if;
  insert into drops(user_id, match_id, compat)
  select me.id, c.id, c.compat from (
    select p.id, p.spotlight_until,
      least(99, 40
        + coalesce(10 * cardinality(array(select unnest(p.money_values) intersect select unnest(me.money_values))), 0)
        + case when p.band = me.band then 20 when p.band is null or me.band is null then 0 else 10 end
        + case when p.trend = 'up' then 5 else 0 end
        + coalesce((aff->>p.band)::int, 0)) compat          -- up to +10 for bands you actually engage with
    from profiles p
    where p.id <> me.id and p.status in ('active','preview') and not (p.nomad and not coalesce(p.visit_until >= current_date, false))
      and not coalesce(p.away_until >= current_date and p.away_pause, false)
      and (case when p.visit_until >= current_date then p.visit_area else p.area end) is not distinct from (case when me.visit_until >= current_date then me.visit_area else me.area end) and p.band is not null and p.id_status = 'approved'
      and (cardinality(me.seeking) = 0 or p.gender = any(me.seeking))
      and (cardinality(p.seeking) = 0 or me.gender = any(p.seeking))
      and not exists (select 1 from blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
      and values_ok(me, p) and values_ok(p, me)
      and p.is_demo = me.is_demo          -- demo world (App Review) and real members never see each other
      and not exists (select 1 from drops d where d.user_id = me.id and d.match_id = p.id and d.drop_date > current_date - 30)
  ) c
  order by (c.spotlight_until > now()) is true desc, c.compat desc, random()
  limit n
  on conflict do nothing;
  get diagnostics added = row_count;
  return added;
end $$;
revoke execute on function public.fill_drop(profiles, int) from public, anon, authenticated;

create or replace function public.member_search(f jsonb, p_page int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me profiles; limited boolean; free int; used int; res jsonb; total int; v_per int := 24;
  v_q text := nullif(trim(f->>'q'), '');
  v_a_min int := nullif(f->>'age_min', '')::int; v_a_max int := nullif(f->>'age_max', '')::int;
  v_h_min int := nullif(f->>'height_min', '')::int; v_h_max int := nullif(f->>'height_max', '')::int;
  v_area text := nullif(f->>'area', '');
  v_act int := nullif(f->>'active_days', '')::int;
  v_srt text := coalesce(nullif(f->>'sort', ''), 'match');
  v_bands text[] := array(select jsonb_array_elements_text(coalesce(f->'bands', '[]')));
  v_money text[] := array(select jsonb_array_elements_text(coalesce(f->'money', '[]')));
  v_wk text[] := array(select jsonb_array_elements_text(coalesce(f->'wants_kids', '[]')));
  v_edu text[] := array(select jsonb_array_elements_text(coalesce(f->'education', '[]')));
  v_dr text[] := array(select jsonb_array_elements_text(coalesce(f->'drinking', '[]')));
  v_sm text[] := array(select jsonb_array_elements_text(coalesce(f->'smoking', '[]')));
  v_ex text[] := array(select jsonb_array_elements_text(coalesce(f->'exercise', '[]')));
  v_yr int := extract(year from now())::int;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.status not in ('active','preview') then raise exception 'search is for active members'; end if;
  if me.nomad and not coalesce(me.visit_until >= current_date, false) then return jsonb_build_object('results', '[]'::jsonb, 'total', 0, 'remaining', 0, 'limited', false, 'nomad', true); end if;
  if v_q is not null then v_q := left(v_q, 60); end if;

  limited := me.plan not in ('premium','black');
  if limited and coalesce(p_page, 0) = 0 then
    free := coalesce((select (value #>> '{}')::int from app_config where key = 'search_free_daily'), 10);
    insert into search_usage(user_id) values (me.id) on conflict do nothing;
    select searches into used from search_usage where user_id = me.id and day = current_date for update;
    if used >= free then
      return jsonb_build_object('results', '[]'::jsonb, 'total', 0, 'remaining', 0, 'limited', true);
    end if;
    update search_usage set searches = searches + 1 where user_id = me.id and day = current_date;
  end if;

  with c as (
    select p.*, least(99, 40
        + coalesce(10 * cardinality(array(select unnest(p.money_values) intersect select unnest(me.money_values))), 0)
        + case when p.band = me.band then 20 when p.band is null or me.band is null then 0 else 10 end
        + case when p.trend = 'up' then 5 else 0 end) compat
    from profiles p
    where p.id <> me.id and p.status in ('active','preview') and not (p.nomad and not coalesce(p.visit_until >= current_date, false))
      and not coalesce(p.away_until >= current_date and p.away_pause, false)
      and (case when p.visit_until >= current_date then p.visit_area else p.area end) is not distinct from (case when me.visit_until >= current_date then me.visit_area else me.area end) and p.band is not null and p.id_status = 'approved'
      and (cardinality(me.seeking) = 0 or p.gender = any(me.seeking))
      and (cardinality(p.seeking) = 0 or me.gender = any(p.seeking))
      and not exists (select 1 from blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
      and values_ok(me, p) and values_ok(p, me)
      and p.is_demo = me.is_demo
      and (v_q is null or p.first_name ilike '%' || v_q || '%' or p.job ilike '%' || v_q || '%' or p.neighborhood ilike '%' || v_q || '%' or p.prompt_a ilike '%' || v_q || '%')
      and (v_a_min is null or v_yr - p.birth_year >= v_a_min)
      and (v_a_max is null or v_yr - p.birth_year <= v_a_max)
      and (cardinality(v_bands) = 0 or p.band = any(v_bands))
      and (coalesce((f->>'trend_up')::boolean, false) = false or (p.trend = 'up' and p.show_improving))
      and (v_area is null or place_in(place_key_for(p.zip), v_area))
      and (cardinality(v_money) = 0 or p.money_values && v_money)
      and (v_h_min is null or p.height_cm >= v_h_min)
      and (v_h_max is null or p.height_cm <= v_h_max)
      and (nullif(f->>'has_kids', '') is null or p.has_kids = f->>'has_kids')
      and (cardinality(v_wk) = 0 or p.wants_kids = any(v_wk))
      and (cardinality(v_edu) = 0 or p.education = any(v_edu))
      and (cardinality(v_dr) = 0 or p.drinking = any(v_dr))
      and (cardinality(v_sm) = 0 or p.smoking = any(v_sm))
      and (cardinality(v_ex) = 0 or p.exercise = any(v_ex))
      and (coalesce((f->>'founders')::boolean, false) = false or p.is_founder)
      and (v_act is null or p.last_active_at > now() - make_interval(days => v_act))
  ),
  page as (
    select *, count(*) over () as n from c
    order by
      case when v_srt = 'active' then extract(epoch from coalesce(last_active_at, created_at)) end desc nulls last,
      case when v_srt = 'new' then extract(epoch from created_at) end desc nulls last,
      compat desc, coalesce(last_active_at, created_at) desc, id
    offset greatest(coalesce(p_page, 0), 0) * v_per limit v_per
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'first_name', first_name, 'age', case when birth_year is null then null else v_yr - birth_year end,
      'band', band, 'trend', case when show_improving then trend end, 'job', job, 'neighborhood', neighborhood, 'is_founder', is_founder,
      'compat', compat, 'height_cm', height_cm,
      'active', last_active_at > now() - interval '3 days')), '[]'::jsonb),
    coalesce(max(n), 0)
  into res, total from page;

  return jsonb_build_object('results', res, 'total', total, 'page', coalesce(p_page, 0), 'per_page', v_per,
    'remaining', case when limited then search_remaining() else null end, 'limited', false);
end $$;

create or replace function public.cron_build_drops(p_secret text, p_max int default 200) returns int
language plpgsql security definer set search_path = public as $$
declare me profiles; n int := 0; added int; t0 timestamptz := clock_timestamp();
begin
  perform check_server_secret(p_secret);
  for me in
    select p.* from profiles p
    where p.status in ('active','preview') and p.band is not null and p.id_status = 'approved'
      and (not p.is_demo or public.is_reviewer(p.id))   -- demo profiles don't need Drops, the reviewer does
      and not exists (select 1 from staff s join auth.users u on lower(u.email) = lower(s.email) where u.id = p.id)
      and not exists (select 1 from drop_builds b where b.user_id = p.id and b.day = current_date)
      and not exists (select 1 from drops d where d.user_id = p.id and d.drop_date = current_date)
    order by p.last_active_at desc nulls last
    limit p_max
  loop
    added := fill_drop(me, case when me.plan in ('premium','black') then 10 else 5 end);
    insert into drop_builds(user_id, day, added) values (me.id, current_date, added) on conflict do nothing;
    n := n + 1;
    exit when clock_timestamp() - t0 > interval '2 seconds';
  end loop;
  delete from drop_builds where day < current_date - 7;
  return n;
end $$;
revoke all on function public.cron_build_drops(text, int) from public, authenticated;
grant execute on function public.cron_build_drops(text, int) to anon;

-- ---------- Events: Who's here / Who's going stay inside your world ----------
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
      and pa.is_demo = pb.is_demo
      and (cardinality(pa.seeking) = 0 or pb.gender = any(pa.seeking))
      and (cardinality(pb.seeking) = 0 or pa.gender = any(pb.seeking))
  ) and not blocked_between(a, b);
$$;
revoke all on function public.here_pair_ok(uuid, uuid, uuid) from public, anon, authenticated;

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
      and pa.is_demo = pb.is_demo
      and (cardinality(pa.seeking) = 0 or pb.gender = any(pa.seeking))
      and (cardinality(pb.seeking) = 0 or pa.gender = any(pb.seeking))
  ) and not blocked_between(a, b);
$$;
revoke all on function public.going_pair_ok(uuid, uuid, uuid) from public, anon, authenticated;

-- Going counts on event cards only count real members (demo RSVPs never inflate them).
create or replace function public.event_going_counts() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(e.id, (select count(*) from event_rsvps r join profiles p on p.id = r.user_id
      where r.event_id = e.id and r.status = 'going' and p.is_demo = public.my_is_demo())), '{}')
  from events e
  where e.status in ('published','cancelled') and e.starts_at > now() - interval '6 hours'
    and (public.my_status() in ('active','preview','paused','taken') or public.is_staff());
$$;
grant execute on function public.event_going_counts() to authenticated;

-- ---------- Likes ----------
create or replace function public.likes_me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me profiles; n int;
begin
  select * into me from profiles where id = auth.uid();
  select count(*) into n from likes l join profiles p on p.id = l.liker
    where l.liked = me.id and p.is_demo = me.is_demo and not blocked_between(l.liker, me.id)
      and not exists (select 1 from likes x where x.liker = me.id and x.liked = l.liker);
  if me.plan not in ('premium','black') then return jsonb_build_object('locked', true, 'count', n); end if;
  return jsonb_build_object('locked', false, 'count', n, 'people', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'first_name', p.first_name, 'birth_year', p.birth_year, 'band', p.band, 'neighborhood', p.neighborhood, 'liked_at', l.created_at) order by l.created_at desc)
    from likes l join profiles p on p.id = l.liker
    where l.liked = me.id and p.status = 'active' and p.is_demo = me.is_demo and not blocked_between(l.liker, me.id)
      and not exists (select 1 from likes x where x.liker = me.id and x.liked = l.liker)
    limit 200), '[]'));
end $$;
grant execute on function public.likes_me() to authenticated;

create or replace function public.like_member(p_other uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me profiles; o profiles; today int; a uuid; b uuid; cid uuid; mutual boolean;
begin
  select * into me from profiles where id = auth.uid();
  select * into o from profiles where id = p_other;
  if me.id is null or o.id is null or me.id = o.id then raise exception 'not found'; end if;
  if me.id_status <> 'approved' or me.band is null then raise exception 'Finish verification to like profiles.'; end if;
  if o.status <> 'active' or blocked_between(me.id, o.id) or o.is_demo <> me.is_demo then raise exception 'unavailable'; end if;
  if me.plan not in ('premium','black') then
    select count(*) into today from likes where liker = me.id and created_at > now() - interval '1 day';
    if today >= 25 then raise exception 'You’ve used today’s likes. More tomorrow, or go Premium for unlimited.'; end if;
  end if;
  insert into likes(liker, liked) values (me.id, o.id) on conflict do nothing;
  -- App Review: demo profiles like the reviewer back, so matching and chat can be tested.
  if o.is_demo and public.is_reviewer(me.id) then
    insert into likes(liker, liked) values (o.id, me.id) on conflict do nothing;
  end if;
  mutual := exists (select 1 from likes where liker = o.id and liked = me.id);
  if mutual then
    a := least(me.id, o.id); b := greatest(me.id, o.id);
    insert into conversations(user_a, user_b) values (a, b) on conflict (user_a, user_b) do nothing;
    update conversations set ended_at = null, ended_by = null where user_a = a and user_b = b and ended_at is not null and o.is_demo and public.is_reviewer(me.id);
    select id into cid from conversations where user_a = a and user_b = b and ended_at is null;
    perform notify(o.id, me.id, 'like_match', 'interaction', 'It’s a match with ' || first_name_of(me.id), 'You both liked each other. Say hello.', '/app/messages/' || cid, 'likematch:' || cid, true);
    if o.is_demo and public.is_reviewer(me.id) then
      perform notify(me.id, o.id, 'like_match', 'interaction', 'It’s a match with ' || first_name_of(o.id), 'You both liked each other. Say hello.', '/app/messages/' || cid, 'likematch:' || cid || ':r', true);
    end if;
  else
    perform notify(o.id, me.id, 'like', 'interaction', 'Someone likes you', 'See who in your Likes.', '/app/likes', 'like:' || me.id || ':' || o.id, false);
  end if;
  return jsonb_build_object('mutual', mutual, 'conversation_id', cid);
end $$;
grant execute on function public.like_member(uuid) to authenticated;

-- ---------- Nightly refresh for the reviewer ----------
create or replace function public.reviewer_refresh(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r profiles; added int; total int := 0; n int; nadia uuid; conv uuid; last_sender uuid; last_at timestamptz; cnt int := 0;
  lines text[] := array[
    'Morning! Any plans for the weekend?',
    'Okay, important question: best slice in the city?',
    'I just found a great little wine bar in the West Village. Want to try it this week?',
    'How was your day? Mine involved too many meetings.',
    'Coffee Thursday? I know a spot near Union Square.',
    'Saw a sunset from the High Line today. Thought you''d like it.',
    'If you could take a trip anywhere next month, where would it be?'];
begin
  perform check_server_secret(p_secret);
  for r in select p.* from profiles p where public.is_reviewer(p.id) loop
    cnt := cnt + 1;
    -- Always a complete, verified Premium member in the demo world.
    update profiles set is_demo = true, status = case when status in ('suspended','removed') then status else 'active' end,
      id_status = 'approved', photo_status = 'approved', plan = 'premium',
      plan_expires_at = greatest(coalesce(plan_expires_at, now()), now() + interval '1 year'), last_active_at = now(),
      nomad = false, visit_until = null, away_until = null
    where id = r.id;
    select * into r from profiles where id = r.id;
    -- Undo anything that would empty the app: old Drop history (so faces recycle), and blocks of demo profiles.
    delete from drops where user_id = r.id and drop_date < current_date;
    delete from blocks b using profiles p where b.blocker_id = r.id and p.id = b.blocked_id and p.is_demo;
    -- Fresh Drop of 10 for today.
    select count(*) into n from drops where user_id = r.id and drop_date = current_date;
    if n < 10 then added := fill_drop(r, 10 - n); total := total + coalesce(added, 0); end if;
    -- Keep 3+ people in "who liked you".
    insert into likes(liker, liked)
    select p.id, r.id from profiles p
    where p.is_demo and p.id <> r.id and p.status = 'active' and not public.is_reviewer(p.id)
      and (cardinality(r.seeking) = 0 or p.gender = any(r.seeking))
      and not exists (select 1 from likes l where l.liker = p.id and l.liked = r.id)
      and not exists (select 1 from likes l where l.liker = r.id and l.liked = p.id)
    order by random()
    limit greatest(0, 3 - (select count(*) from likes l where l.liked = r.id
                              and not exists (select 1 from likes x where x.liker = r.id and x.liked = l.liker)))
    on conflict do nothing;
    -- Keep the chat with Nadia open, with something new to reply to each day.
    select p.id into nadia from profiles p join auth.users u on u.id = p.id where u.email = 'nadia.t1@seed.scoredate.test';
    if nadia is not null then
      insert into likes(liker, liked) values (r.id, nadia), (nadia, r.id) on conflict do nothing;
      insert into conversations(user_a, user_b) values (least(r.id, nadia), greatest(r.id, nadia)) on conflict (user_a, user_b) do nothing;
      update conversations set ended_at = null, ended_by = null where user_a = least(r.id, nadia) and user_b = greatest(r.id, nadia);
      select id into conv from conversations where user_a = least(r.id, nadia) and user_b = greatest(r.id, nadia);
      select sender_id, created_at into last_sender, last_at from messages where conversation_id = conv order by created_at desc limit 1;
      if last_sender is null or last_sender = r.id or last_at < now() - interval '20 hours' then
        insert into messages(conversation_id, sender_id, body) values (conv, nadia, lines[1 + (extract(doy from now())::int % array_length(lines, 1))]);
      end if;
    end if;
  end loop;
  return jsonb_build_object('reviewers', cnt, 'drop_added', total);
end $$;
revoke all on function public.reviewer_refresh(text) from public, authenticated;
grant execute on function public.reviewer_refresh(text) to anon;
