-- Waitlist map for staff (NYC detail + every other US zip by state) and a real-data-only home page map.
-- Safe to run more than once. Run after 0016.
--
--   • Admin → Waitlist & invites gets a map: NYC-area zips land on their neighborhood/borough/area,
--     every other US zip lands on its state. Staff only. Test accounts are left out unless asked for.
--   • The home page map never includes test accounts. The "Show sample data" switch now only
--     affects the sign-up page map.

create table if not exists public.us_states (
  code text primary key, name text not null, lat double precision not null, lng double precision not null);
insert into public.us_states(code, name, lat, lng) values
  ('AL', 'Alabama', 32.81, -86.79),
  ('AK', 'Alaska', 61.37, -152.40),
  ('AZ', 'Arizona', 33.73, -111.43),
  ('AR', 'Arkansas', 34.97, -92.37),
  ('CA', 'California', 36.12, -119.68),
  ('CO', 'Colorado', 39.06, -105.31),
  ('CT', 'Connecticut', 41.60, -72.76),
  ('DE', 'Delaware', 39.32, -75.51),
  ('DC', 'Washington, DC', 38.90, -77.03),
  ('FL', 'Florida', 27.77, -81.69),
  ('GA', 'Georgia', 33.04, -83.64),
  ('HI', 'Hawaii', 21.09, -157.50),
  ('ID', 'Idaho', 44.24, -114.48),
  ('IL', 'Illinois', 40.35, -88.99),
  ('IN', 'Indiana', 39.85, -86.26),
  ('IA', 'Iowa', 42.01, -93.21),
  ('KS', 'Kansas', 38.53, -96.73),
  ('KY', 'Kentucky', 37.67, -84.67),
  ('LA', 'Louisiana', 31.17, -91.87),
  ('ME', 'Maine', 44.69, -69.38),
  ('MD', 'Maryland', 39.06, -76.80),
  ('MA', 'Massachusetts', 42.23, -71.53),
  ('MI', 'Michigan', 43.33, -84.54),
  ('MN', 'Minnesota', 45.69, -93.90),
  ('MS', 'Mississippi', 32.74, -89.68),
  ('MO', 'Missouri', 38.46, -92.29),
  ('MT', 'Montana', 46.92, -110.45),
  ('NE', 'Nebraska', 41.13, -98.27),
  ('NV', 'Nevada', 38.31, -117.06),
  ('NH', 'New Hampshire', 43.45, -71.56),
  ('NJ', 'New Jersey', 40.30, -74.52),
  ('NM', 'New Mexico', 34.84, -106.25),
  ('NY', 'New York State', 42.17, -74.95),
  ('NC', 'North Carolina', 35.63, -79.81),
  ('ND', 'North Dakota', 47.53, -99.78),
  ('OH', 'Ohio', 40.39, -82.76),
  ('OK', 'Oklahoma', 35.57, -96.93),
  ('OR', 'Oregon', 44.57, -122.07),
  ('PA', 'Pennsylvania', 40.59, -77.21),
  ('RI', 'Rhode Island', 41.68, -71.51),
  ('SC', 'South Carolina', 33.86, -80.95),
  ('SD', 'South Dakota', 44.30, -99.44),
  ('TN', 'Tennessee', 35.75, -86.69),
  ('TX', 'Texas', 31.05, -97.56),
  ('UT', 'Utah', 40.15, -111.86),
  ('VT', 'Vermont', 44.05, -72.71),
  ('VA', 'Virginia', 37.77, -78.17),
  ('WA', 'Washington', 47.40, -121.49),
  ('WV', 'West Virginia', 38.49, -80.95),
  ('WI', 'Wisconsin', 44.27, -89.62),
  ('WY', 'Wyoming', 42.76, -107.30),
  ('PR', 'Puerto Rico', 18.22, -66.59),
  ('VI', 'U.S. Virgin Islands', 18.34, -64.90),
  ('GU', 'Guam', 13.44, 144.79)
on conflict (code) do update set name = excluded.name, lat = excluded.lat, lng = excluded.lng;
alter table public.us_states enable row level security;
drop policy if exists us_states_read on public.us_states;
create policy us_states_read on public.us_states for select using (true);

-- First three digits of a US zip -> state (USPS prefix ranges). Military and unknown prefixes return null.
create or replace function public.zip_state(p_zip text) returns text language sql immutable as $$
  select case when p_zip !~ '^[0-9]{5}$' then null else (
    with x(p) as (select left(p_zip, 3)::int)
    select case
      when p = 5 then 'NY' when p in (6, 7, 9) then 'PR' when p = 8 then 'VI'
      when p = 55 then 'MA'
      when p between 10 and 27 then 'MA' when p between 28 and 29 then 'RI' when p between 30 and 38 then 'NH'
      when p between 39 and 49 then 'ME' when p between 50 and 59 then 'VT' when p between 60 and 69 then 'CT'
      when p between 70 and 89 then 'NJ' when p between 100 and 149 then 'NY' when p between 150 and 196 then 'PA'
      when p between 197 and 199 then 'DE' when p between 200 and 205 then 'DC' when p = 569 then 'DC'
      when p between 206 and 219 then 'MD' when p between 220 and 246 then 'VA' when p between 247 and 268 then 'WV'
      when p between 270 and 289 then 'NC' when p between 290 and 299 then 'SC' when p between 300 and 319 then 'GA'
      when p between 398 and 399 then 'GA' when p between 320 and 349 then 'FL' when p between 350 and 369 then 'AL'
      when p between 370 and 385 then 'TN' when p between 386 and 397 then 'MS' when p between 400 and 427 then 'KY'
      when p between 430 and 458 then 'OH' when p between 460 and 479 then 'IN' when p between 480 and 499 then 'MI'
      when p between 500 and 528 then 'IA' when p between 530 and 549 then 'WI' when p between 550 and 567 then 'MN'
      when p between 570 and 577 then 'SD' when p between 580 and 588 then 'ND' when p between 590 and 599 then 'MT'
      when p between 600 and 629 then 'IL' when p between 630 and 658 then 'MO' when p between 660 and 679 then 'KS'
      when p between 680 and 693 then 'NE' when p between 700 and 714 then 'LA' when p between 716 and 729 then 'AR'
      when p between 730 and 749 then 'OK' when p between 750 and 799 then 'TX' when p = 885 then 'TX'
      when p between 800 and 816 then 'CO' when p between 820 and 831 then 'WY' when p between 832 and 838 then 'ID'
      when p between 840 and 847 then 'UT' when p between 850 and 865 then 'AZ' when p between 870 and 884 then 'NM'
      when p between 889 and 898 then 'NV' when p between 900 and 961 then 'CA' when p between 967 and 968 then 'HI'
      when p = 969 then 'GU' when p between 970 and 979 then 'OR' when p between 980 and 994 then 'WA'
      when p between 995 and 999 then 'AK'
    end from x) end;
$$;

-- Staff waitlist map: {spots: [{key, name, kind, lat, lng, waiting, invited}], unplaced, total}
create or replace function public.staff_waitlist_map(p_include_test boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare out jsonb; unplaced int; total int;
begin
  if not is_staff() then raise exception 'staff only'; end if;
  with w as (
    select zip, status, place_key_for(zip) k from waitlist
    where status in ('waiting', 'invited') and zip is not null
      and (p_include_test or email not ilike '%@seed.scoredate.test')),
  placed as (
    select p.key, p.name, p.kind, p.lat, p.lng,
      count(*) filter (where w.status = 'waiting') waiting, count(*) filter (where w.status = 'invited') invited
    from w join map_places p on p.key = w.k group by p.key, p.name, p.kind, p.lat, p.lng),
  states as (
    select 'state:' || s.code key, s.name, 'state' kind, s.lat, s.lng,
      count(*) filter (where w.status = 'waiting') waiting, count(*) filter (where w.status = 'invited') invited
    from w join us_states s on s.code = zip_state(w.zip)
    where w.k is null or not exists (select 1 from map_places p where p.key = w.k)
    group by s.code, s.name, s.lat, s.lng),
  allp as (select * from placed union all select * from states)
  select coalesce(jsonb_agg(jsonb_build_object('key', key, 'name', name, 'kind', kind, 'lat', lat, 'lng', lng,
           'waiting', waiting, 'invited', invited) order by waiting + invited desc), '[]'::jsonb)
  into out from allp;
  select count(*) into total from waitlist
    where status in ('waiting', 'invited') and (p_include_test or email not ilike '%@seed.scoredate.test');
  select total - coalesce(sum((e->>'waiting')::int + (e->>'invited')::int), 0) into unplaced from jsonb_array_elements(out) e;
  return jsonb_build_object('spots', out, 'unplaced', greatest(unplaced, 0), 'total', total);
end $$;
revoke execute on function public.staff_waitlist_map(boolean) from public, anon;
grant execute on function public.staff_waitlist_map(boolean) to authenticated;

-- Home page map: real people only, whatever the sample-data switch says.
create or replace function public.public_demand_map() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare dmin int := public_demand_min(); mmin int := map_min(); out jsonb; total int;
  demo boolean := false;  -- home page is always real data only (0018)
begin
  with
  w as (
    select place_key_for(zip) k from waitlist
    where status in ('waiting','invited') and zip is not null and (demo or email not ilike '%@seed.scoredate.test')),
  m as (
    select place_key_for(p.zip) k from profiles p join auth.users u on u.id = p.id
    where p.status in ('active','preview') and p.zip is not null and not p.map_opt_out
      and (demo or u.email not ilike '%@seed.scoredate.test')),
  lvl1 as (
    select k, sum(wn)::int wn, sum(mn)::int mn from (
      select k, 1 wn, 0 mn from w union all select k, 0, 1 from m) x
    where k is not null group by k),
  lvl2 as (
    select case when p.kind = 'neighborhood' and l.wn + l.mn < dmin then p.parent else l.k end k, sum(l.wn)::int wn, sum(l.mn)::int mn
    from lvl1 l join map_places p on p.key = l.k group by 1),
  lvl3 as (
    select case when p.kind = 'borough' and l.wn + l.mn < dmin then p.parent else l.k end k, sum(l.wn)::int wn, sum(l.mn)::int mn
    from lvl2 l join map_places p on p.key = l.k group by 1)
  select coalesce(jsonb_agg(jsonb_build_object(
      'name', p.name, 'kind', p.kind, 'lat', p.lat, 'lng', p.lng,
      'live', l.mn >= mmin,
      'members', case when l.mn >= mmin then (l.mn / 5) * 5 else null end,
      'waiting', case when l.wn >= 50 then (l.wn / 10) * 10 when l.wn >= dmin then (l.wn / 5) * 5 else null end,
      'level', case when l.wn + l.mn >= 8 * dmin then 'hot' when l.wn + l.mn >= 3 * dmin then 'busy' else 'growing' end)
      order by l.wn + l.mn desc), '[]'::jsonb),
    coalesce(sum(l.wn), 0)::int
  into out, total
  from lvl3 l join map_places p on p.key = l.k
  where l.wn + l.mn >= dmin;

  return jsonb_build_object('spots', out, 'demo', demo,
    'total_waiting', case when total >= 100 then (total / 50) * 50 else null end);
end $$;
grant execute on function public.public_demand_map() to anon, authenticated;
