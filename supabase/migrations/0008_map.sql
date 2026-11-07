-- Member heat map. Groups members by neighborhood (never exact location), hides any group under the
-- minimum size, and rolls small neighborhoods up into their borough or area. Run after 0007.

-- ---------- Places ----------
create table if not exists public.map_places (
  key text primary key,
  name text not null,
  kind text not null check (kind in ('neighborhood','borough','area')),
  parent text references public.map_places(key),
  lat numeric(8,5) not null,
  lng numeric(8,5) not null
);
create table if not exists public.zip_places (
  zip text primary key check (zip ~ '^[0-9]{5}$'),
  place_key text not null references public.map_places(key) on update cascade
);
alter table public.map_places enable row level security;
alter table public.zip_places enable row level security;
drop policy if exists map_places_read on public.map_places;
create policy map_places_read on public.map_places for select using (true);
drop policy if exists zip_places_staff on public.zip_places;
create policy zip_places_staff on public.zip_places for select using (public.is_staff());
grant select on public.map_places to anon, authenticated;

-- Areas and boroughs (approximate centers).
insert into public.map_places(key, name, kind, parent, lat, lng) values
  ('area:nyc', 'New York City', 'area', null, 40.7128, -74.0060),
  ('area:long-island', 'Long Island', 'area', null, 40.7891, -73.1350),
  ('area:westchester', 'Westchester', 'area', null, 41.1220, -73.7949),
  ('area:new-jersey', 'New Jersey', 'area', null, 40.7357, -74.1724),
  ('area:hudson-valley', 'Hudson Valley', 'area', null, 41.7004, -73.9210),
  ('area:connecticut', 'Connecticut', 'area', null, 41.2000, -73.3500),
  ('borough:manhattan', 'Manhattan', 'borough', 'area:nyc', 40.7831, -73.9712),
  ('borough:brooklyn', 'Brooklyn', 'borough', 'area:nyc', 40.6782, -73.9442),
  ('borough:queens', 'Queens', 'borough', 'area:nyc', 40.7282, -73.7949),
  ('borough:bronx', 'Bronx', 'borough', 'area:nyc', 40.8448, -73.8648),
  ('borough:staten-island', 'Staten Island', 'borough', 'area:nyc', 40.5795, -74.1502)
on conflict (key) do nothing;

-- Neighborhoods (approximate centers). Zips not listed below fall back to their borough or area.
insert into public.map_places(key, name, kind, parent, lat, lng) values
  ('n:fidi', 'FiDi & Battery Park City', 'neighborhood', 'borough:manhattan', 40.7075, -74.0110),
  ('n:tribeca', 'Tribeca', 'neighborhood', 'borough:manhattan', 40.7163, -74.0086),
  ('n:soho', 'SoHo & Nolita', 'neighborhood', 'borough:manhattan', 40.7246, -73.9986),
  ('n:les', 'Lower East Side & Chinatown', 'neighborhood', 'borough:manhattan', 40.7150, -73.9860),
  ('n:east-village', 'East Village', 'neighborhood', 'borough:manhattan', 40.7265, -73.9815),
  ('n:west-village', 'West Village', 'neighborhood', 'borough:manhattan', 40.7358, -74.0036),
  ('n:chelsea', 'Chelsea', 'neighborhood', 'borough:manhattan', 40.7465, -74.0014),
  ('n:flatiron', 'Flatiron, Gramercy & Murray Hill', 'neighborhood', 'borough:manhattan', 40.7420, -73.9840),
  ('n:midtown-west', 'Midtown West & Hell''s Kitchen', 'neighborhood', 'borough:manhattan', 40.7620, -73.9930),
  ('n:midtown-east', 'Midtown East', 'neighborhood', 'borough:manhattan', 40.7550, -73.9700),
  ('n:ues', 'Upper East Side', 'neighborhood', 'borough:manhattan', 40.7736, -73.9566),
  ('n:uws', 'Upper West Side', 'neighborhood', 'borough:manhattan', 40.7870, -73.9754),
  ('n:harlem', 'Harlem', 'neighborhood', 'borough:manhattan', 40.8116, -73.9465),
  ('n:upper-manhattan', 'Washington Heights & Inwood', 'neighborhood', 'borough:manhattan', 40.8500, -73.9350),
  ('n:williamsburg', 'Williamsburg & Greenpoint', 'neighborhood', 'borough:brooklyn', 40.7150, -73.9550),
  ('n:bushwick', 'Bushwick', 'neighborhood', 'borough:brooklyn', 40.6950, -73.9200),
  ('n:brooklyn-heights', 'Brooklyn Heights & DUMBO', 'neighborhood', 'borough:brooklyn', 40.6960, -73.9920),
  ('n:fort-greene', 'Fort Greene & Prospect Heights', 'neighborhood', 'borough:brooklyn', 40.6880, -73.9690),
  ('n:park-slope', 'Park Slope & Boerum Hill', 'neighborhood', 'borough:brooklyn', 40.6720, -73.9810),
  ('n:carroll-gardens', 'Carroll Gardens & Red Hook', 'neighborhood', 'borough:brooklyn', 40.6800, -74.0000),
  ('n:bed-stuy', 'Bed-Stuy', 'neighborhood', 'borough:brooklyn', 40.6870, -73.9420),
  ('n:crown-heights', 'Crown Heights', 'neighborhood', 'borough:brooklyn', 40.6690, -73.9450),
  ('n:flatbush', 'Flatbush & Ditmas Park', 'neighborhood', 'borough:brooklyn', 40.6440, -73.9650),
  ('n:bay-ridge', 'Bay Ridge', 'neighborhood', 'borough:brooklyn', 40.6260, -74.0300),
  ('n:lic', 'Long Island City', 'neighborhood', 'borough:queens', 40.7447, -73.9485),
  ('n:astoria', 'Astoria', 'neighborhood', 'borough:queens', 40.7644, -73.9235),
  ('n:sunnyside', 'Sunnyside & Woodside', 'neighborhood', 'borough:queens', 40.7430, -73.9150),
  ('n:jackson-heights', 'Jackson Heights', 'neighborhood', 'borough:queens', 40.7557, -73.8831),
  ('n:forest-hills', 'Forest Hills', 'neighborhood', 'borough:queens', 40.7181, -73.8448),
  ('n:riverdale', 'Riverdale', 'neighborhood', 'borough:bronx', 40.8900, -73.9100),
  ('n:hoboken', 'Hoboken', 'neighborhood', 'area:new-jersey', 40.7440, -74.0324),
  ('n:jersey-city', 'Downtown Jersey City', 'neighborhood', 'area:new-jersey', 40.7178, -74.0431)
on conflict (key) do nothing;

insert into public.zip_places(zip, place_key)
select z, k from (values
  ('10004','n:fidi'),('10005','n:fidi'),('10006','n:fidi'),('10038','n:fidi'),('10280','n:fidi'),('10282','n:fidi'),
  ('10007','n:tribeca'),('10013','n:tribeca'),
  ('10012','n:soho'),
  ('10002','n:les'),
  ('10003','n:east-village'),('10009','n:east-village'),
  ('10014','n:west-village'),
  ('10001','n:chelsea'),('10011','n:chelsea'),
  ('10010','n:flatiron'),('10016','n:flatiron'),
  ('10018','n:midtown-west'),('10019','n:midtown-west'),('10020','n:midtown-west'),('10036','n:midtown-west'),
  ('10017','n:midtown-east'),('10022','n:midtown-east'),
  ('10021','n:ues'),('10028','n:ues'),('10065','n:ues'),('10075','n:ues'),('10128','n:ues'),
  ('10023','n:uws'),('10024','n:uws'),('10025','n:uws'),('10069','n:uws'),
  ('10026','n:harlem'),('10027','n:harlem'),('10029','n:harlem'),('10030','n:harlem'),('10035','n:harlem'),('10037','n:harlem'),('10039','n:harlem'),
  ('10031','n:upper-manhattan'),('10032','n:upper-manhattan'),('10033','n:upper-manhattan'),('10034','n:upper-manhattan'),('10040','n:upper-manhattan'),
  ('11211','n:williamsburg'),('11249','n:williamsburg'),('11222','n:williamsburg'),
  ('11206','n:bushwick'),('11221','n:bushwick'),('11237','n:bushwick'),
  ('11201','n:brooklyn-heights'),
  ('11205','n:fort-greene'),('11238','n:fort-greene'),
  ('11215','n:park-slope'),('11217','n:park-slope'),
  ('11231','n:carroll-gardens'),
  ('11216','n:bed-stuy'),('11233','n:bed-stuy'),
  ('11213','n:crown-heights'),('11225','n:crown-heights'),
  ('11218','n:flatbush'),('11226','n:flatbush'),
  ('11209','n:bay-ridge'),('11228','n:bay-ridge'),
  ('11101','n:lic'),('11109','n:lic'),
  ('11102','n:astoria'),('11103','n:astoria'),('11105','n:astoria'),('11106','n:astoria'),
  ('11104','n:sunnyside'),('11377','n:sunnyside'),
  ('11372','n:jackson-heights'),
  ('11375','n:forest-hills'),
  ('10463','n:riverdale'),('10471','n:riverdale'),
  ('07030','n:hoboken'),
  ('07302','n:jersey-city'),('07310','n:jersey-city'),('07311','n:jersey-city')
) v(z, k)
on conflict (zip) do nothing;

-- Minimum group size before anything shows on a member or public map.
insert into public.app_config(key, value) values ('map_min_members', '25') on conflict (key) do nothing;

-- ---------- Opt-out ----------
alter table public.profiles add column if not exists map_opt_out boolean not null default false;
grant update (map_opt_out) on public.profiles to authenticated;

-- ---------- Helpers ----------
-- Zip → most specific place: listed neighborhood, else NYC borough, else area.
create or replace function public.place_key_for(p_zip text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select place_key from zip_places where zip = p_zip),
    (select 'borough:' || replace(lower(borough), ' ', '-') from nyc_zip_codes where zip = p_zip and active),
    (select case a.area when 'New York City' then 'area:nyc' when 'Long Island' then 'area:long-island'
       when 'Westchester' then 'area:westchester' when 'New Jersey' then 'area:new-jersey'
       when 'Hudson Valley' then 'area:hudson-valley' when 'Connecticut' then 'area:connecticut' end
     from zip_prefix_areas a where a.prefix = left(p_zip, 3)));
$$;
revoke execute on function public.place_key_for(text) from public, anon;

create or replace function public.map_min() returns int language sql stable as $$
  select greatest(5, coalesce((select (value::text)::int from public.app_config where key = 'map_min_members'), 25));
$$;

-- ---------- Member map ----------
-- Heat level only, never counts. Small neighborhoods roll up into their borough/area; anything still
-- under the minimum is left off entirely.
create or replace function public.member_heatmap() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m int := map_min();
begin
  if my_status() not in ('active','preview','paused','taken') then raise exception 'members only'; end if;
  return coalesce((
    with base as (
      select place_key_for(zip) k from profiles
      where status in ('active','preview') and zip is not null and not map_opt_out),
    lvl1 as (select k, count(*) n from base where k is not null group by k),
    lvl2 as (  -- roll small neighborhoods into their parent
      select case when p.kind = 'neighborhood' and l.n < m then p.parent else l.k end k, sum(l.n) n
      from lvl1 l join map_places p on p.key = l.k group by 1),
    lvl3 as (  -- roll small boroughs into their area
      select case when p.kind = 'borough' and l.n < m then p.parent else l.k end k, sum(l.n) n
      from lvl2 l join map_places p on p.key = l.k group by 1)
    select jsonb_agg(jsonb_build_object('name', p.name, 'kind', p.kind, 'lat', p.lat, 'lng', p.lng,
      'level', case when l.n >= 8 * m then 'hot' when l.n >= 3 * m then 'busy' else 'growing' end)
      order by l.n desc)
    from lvl3 l join map_places p on p.key = l.k
    where l.n >= m), '[]');
end $$;

-- ---------- Public (waitlist) map ----------
-- Areas and NYC boroughs only. Every area is listed with its status; heat shows once it passes the minimum.
create or replace function public.public_area_heat() returns jsonb
language sql stable security definer set search_path = public as $$
  with people as (
    select coalesce('borough:' || replace(lower(w.borough), ' ', '-'), case w.area
      when 'New York City' then 'area:nyc' when 'Long Island' then 'area:long-island' when 'Westchester' then 'area:westchester'
      when 'New Jersey' then 'area:new-jersey' when 'Hudson Valley' then 'area:hudson-valley' when 'Connecticut' then 'area:connecticut' end) k
    from waitlist w where w.status in ('waiting','invited')
    union all
    select coalesce('borough:' || replace(lower(p.borough), ' ', '-'), case p.area
      when 'New York City' then 'area:nyc' when 'Long Island' then 'area:long-island' when 'Westchester' then 'area:westchester'
      when 'New Jersey' then 'area:new-jersey' when 'Hudson Valley' then 'area:hudson-valley' when 'Connecticut' then 'area:connecticut' end)
    from profiles p where p.status in ('active','preview','onboarding') and not p.map_opt_out),
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

-- ---------- Staff map ----------
create or replace function public.staff_map() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  return coalesce((
    with m as (
      select place_key_for(zip) k, gender, plan, status from profiles where zip is not null and status not in ('removed')),
    w as (
      select place_key_for(zip) k from waitlist where status = 'waiting' and zip is not null),
    agg as (
      select k,
        count(*) filter (where status in ('active','preview')) live,
        count(*) filter (where status in ('active','preview') and gender = 'woman') women,
        count(*) filter (where status in ('active','preview') and gender = 'man') men,
        count(*) filter (where status in ('active','preview') and gender = 'nonbinary') nonbinary,
        count(*) filter (where plan in ('membership','premium','black')) paying,
        count(*) filter (where plan = 'preview') preview,
        count(*) filter (where status = 'onboarding') onboarding
      from m where k is not null group by k),
    wl as (select k, count(*) waiting from w where k is not null group by k)
    select jsonb_agg(jsonb_build_object('key', p.key, 'name', p.name, 'kind', p.kind, 'lat', p.lat, 'lng', p.lng,
      'live', coalesce(a.live, 0), 'women', coalesce(a.women, 0), 'men', coalesce(a.men, 0), 'nonbinary', coalesce(a.nonbinary, 0),
      'paying', coalesce(a.paying, 0), 'preview', coalesce(a.preview, 0), 'onboarding', coalesce(a.onboarding, 0),
      'waiting', coalesce(wl.waiting, 0)) order by coalesce(a.live, 0) + coalesce(wl.waiting, 0) desc)
    from map_places p left join agg a on a.k = p.key left join wl on wl.k = p.key
    where coalesce(a.live, 0) + coalesce(a.onboarding, 0) + coalesce(wl.waiting, 0) > 0), '[]');
end $$;

grant execute on function public.member_heatmap(), public.staff_map() to authenticated;
grant execute on function public.public_area_heat() to anon, authenticated;
