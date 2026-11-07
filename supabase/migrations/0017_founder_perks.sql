-- Founding Member perks: founders-only events, a founding price offer (off until it exists in the App Store),
-- and the sign-up page map follows the same "real people only unless the sample-data switch is on" rule
-- as the home page. Safe to run more than once. Run after 0016.

-- ---------- Founders-only events ----------
alter table public.events add column if not exists founders_only boolean not null default false;

create or replace function public.rsvp_event(p_event uuid, p_going boolean) returns text
language plpgsql security definer set search_path = public as $$
declare e events; me profiles; going int; st text; promoted uuid;
begin
  select * into me from profiles where id = auth.uid();
  select * into e from events where id = p_event for update;
  if e.id is null or e.status <> 'published' then raise exception 'event not available'; end if;
  if e.starts_at < now() then raise exception 'this event already started'; end if;

  if not p_going then
    update event_rsvps set status = 'cancelled', updated_at = now() where event_id = e.id and user_id = me.id and status <> 'cancelled';
    -- Move the first person on the waitlist into the open spot.
    select user_id into promoted from event_rsvps where event_id = e.id and status = 'waitlist' order by created_at limit 1;
    if promoted is not null and (select count(*) from event_rsvps where event_id = e.id and status = 'going') < e.capacity then
      update event_rsvps set status = 'going', updated_at = now() where event_id = e.id and user_id = promoted;
    end if;
    return 'cancelled';
  end if;

  if me.plan not in ('membership','premium','black') then raise exception 'events are for members. Pick a plan to RSVP.'; end if;
  if e.founders_only and not coalesce(me.is_founder, false) then raise exception 'This event is for Founding Members.'; end if;
  if me.plan <> 'black' and not e.founders_only and e.published_at + make_interval(hours => e.black_priority_hours) > now() then
    raise exception 'Reserve members get first access. RSVPs open to everyone %', to_char((e.published_at + make_interval(hours => e.black_priority_hours)) at time zone 'America/New_York', 'FMDay at FMHH12:MI am');
  end if;
  select count(*) into going from event_rsvps where event_id = e.id and status = 'going' and user_id <> me.id;
  st := case when going < e.capacity then 'going' else 'waitlist' end;
  insert into event_rsvps(event_id, user_id, status) values (e.id, me.id, st)
    on conflict (event_id, user_id) do update set status = case when event_rsvps.status = 'going' then 'going' else excluded.status end, updated_at = now()
    returning status into st;
  return st;
end $$;

create or replace function public.staff_save_event(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare who text := staff_email(); eid uuid := nullif(p->>'id', '')::uuid; st text := coalesce(p->>'status', 'draft');
begin
  if not is_staff() then raise exception 'staff only'; end if;
  if eid is null then
    insert into events(title, description, venue, address, area, starts_at, ends_at, capacity, price_note, black_priority_hours, status, published_at, founders_only)
    values (p->>'title', nullif(p->>'description',''), p->>'venue', nullif(p->>'address',''), coalesce(nullif(p->>'area',''), 'New York City'),
      (p->>'starts_at')::timestamptz, nullif(p->>'ends_at','')::timestamptz, coalesce(nullif(p->>'capacity','')::int, 40),
      nullif(p->>'price_note',''), coalesce(nullif(p->>'black_priority_hours','')::int, 48), st,
      case when st = 'published' then now() end, coalesce((p->>'founders_only')::boolean, false))
    returning id into eid;
  else
    update events set title = p->>'title', description = nullif(p->>'description',''), venue = p->>'venue', address = nullif(p->>'address',''),
      area = coalesce(nullif(p->>'area',''), area), starts_at = (p->>'starts_at')::timestamptz, ends_at = nullif(p->>'ends_at','')::timestamptz,
      capacity = coalesce(nullif(p->>'capacity','')::int, capacity), price_note = nullif(p->>'price_note',''),
      black_priority_hours = coalesce(nullif(p->>'black_priority_hours','')::int, black_priority_hours),
      founders_only = coalesce((p->>'founders_only')::boolean, founders_only),
      status = st, published_at = case when st = 'published' then coalesce(published_at, now()) else published_at end
    where id = eid;
  end if;
  insert into audit_log(staff_email, action, reason) values (who, 'event_' || st, p->>'title');
  return eid;
end $$;

-- ---------- Founding price offer ----------
-- Shown to founders only when enabled = true. Turn it on (Admin → Waitlist) only after the matching
-- product/offer exists in App Store Connect and RevenueCat (offering "founders").
insert into public.app_config(key, value) values
  ('founder_offer', '{"enabled": false, "intro": "First month free", "monthly": "$19.99/mo", "regular": "$24.99/mo", "offering": "founders"}')
on conflict (key) do nothing;

create or replace function public.staff_set_founder_offer(p_enabled boolean, p_intro text, p_monthly text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  update app_config set value = value || jsonb_build_object('enabled', p_enabled, 'intro', left(coalesce(nullif(trim(p_intro), ''), value->>'intro'), 60),
    'monthly', left(coalesce(nullif(trim(p_monthly), ''), value->>'monthly'), 30)) where key = 'founder_offer';
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'founder_offer_' || case when p_enabled then 'on' else 'off' end, p_monthly);
end $$;
grant execute on function public.staff_set_founder_offer(boolean, text, text) to authenticated;

-- ---------- Sign-up page map: real people unless the sample-data switch is on ----------
create or replace function public.demo_on() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value = 'true'::jsonb from app_config where key = 'public_map_demo'), false);
$$;

create or replace function public.public_area_heat() returns jsonb
language sql stable security definer set search_path = public as $$
  with people as (
    select coalesce('borough:' || replace(lower(w.borough), ' ', '-'), case w.area
      when 'New York City' then 'area:nyc' when 'Long Island' then 'area:long-island' when 'Westchester' then 'area:westchester'
      when 'New Jersey' then 'area:new-jersey' when 'Hudson Valley' then 'area:hudson-valley' when 'Connecticut' then 'area:connecticut' end) k
    from waitlist w where w.status in ('waiting','invited') and (demo_on() or w.email not ilike '%@seed.scoredate.test')
    union all
    select coalesce('borough:' || replace(lower(p.borough), ' ', '-'), case p.area
      when 'New York City' then 'area:nyc' when 'Long Island' then 'area:long-island' when 'Westchester' then 'area:westchester'
      when 'New Jersey' then 'area:new-jersey' when 'Hudson Valley' then 'area:hudson-valley' when 'Connecticut' then 'area:connecticut' end)
    from profiles p where p.status in ('active','preview','onboarding') and not p.map_opt_out
      and (demo_on() or coalesce(p.email, '') not ilike '%@seed.scoredate.test')),
  c as (select k, count(*) n from people where k is not null group by k)
  select coalesce(jsonb_agg(jsonb_build_object('name', mp.name, 'kind', mp.kind, 'lat', mp.lat, 'lng', mp.lng,
    'open', coalesce(a.status = 'open', mp.parent = 'area:nyc'),
    'level', case when coalesce(c.n, 0) < map_min() then null when c.n >= 8 * map_min() then 'hot' when c.n >= 3 * map_min() then 'busy' else 'growing' end)
    order by mp.kind, mp.name), '[]')
  from map_places mp
  left join c on c.k = mp.key
  left join areas a on a.name = mp.name
  where mp.kind = 'borough' or (mp.kind = 'area' and mp.key <> 'area:nyc');
$$;
grant execute on function public.public_area_heat() to anon, authenticated;
