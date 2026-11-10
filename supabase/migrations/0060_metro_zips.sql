-- 0060 Commuter towns join the NYC market.
-- Zips within about an hour of Midtown by train count as New York City: members there get Drops, match with
-- city members, and are never Nomads. Their profile shows their town (e.g. "Hoboken").
-- Staff can turn any of these on or off in Admin → Zip codes. Run after 0059.

create table if not exists public.metro_zip_codes (
  zip text primary key check (zip ~ '^[0-9]{5}$'),
  town text not null,
  region text not null check (region in ('New Jersey','Long Island','Westchester','Connecticut')),
  active boolean not null default true
);
alter table public.metro_zip_codes enable row level security;
drop policy if exists metro_read on public.metro_zip_codes;
create policy metro_read on public.metro_zip_codes for select using (true);
grant select on public.metro_zip_codes to anon, authenticated;

insert into public.metro_zip_codes(zip, town, region) values
-- New Jersey: Hudson County
('07002','Bayonne','New Jersey'),('07029','Harrison','New Jersey'),('07030','Hoboken','New Jersey'),('07032','Kearny','New Jersey'),
('07047','North Bergen','New Jersey'),('07086','Weehawken','New Jersey'),('07087','Union City','New Jersey'),('07093','West New York','New Jersey'),
('07094','Secaucus','New Jersey'),('07302','Downtown Jersey City','New Jersey'),('07304','Jersey City','New Jersey'),('07305','Jersey City','New Jersey'),
('07306','Journal Square','New Jersey'),('07307','Jersey City Heights','New Jersey'),('07310','Newport','New Jersey'),('07311','Jersey City','New Jersey'),
-- New Jersey: nearby Bergen County
('07010','Cliffside Park','New Jersey'),('07020','Edgewater','New Jersey'),('07022','Fairview','New Jersey'),('07024','Fort Lee','New Jersey'),
('07070','Rutherford','New Jersey'),('07071','Lyndhurst','New Jersey'),('07450','Ridgewood','New Jersey'),('07601','Hackensack','New Jersey'),
('07605','Leonia','New Jersey'),('07631','Englewood','New Jersey'),('07632','Englewood Cliffs','New Jersey'),('07650','Palisades Park','New Jersey'),
('07657','Ridgefield','New Jersey'),('07660','Ridgefield Park','New Jersey'),('07666','Teaneck','New Jersey'),('07670','Tenafly','New Jersey'),
-- New Jersey: Essex and Union on the train lines
('07003','Bloomfield','New Jersey'),('07028','Glen Ridge','New Jersey'),('07040','Maplewood','New Jersey'),('07041','Millburn','New Jersey'),
('07042','Montclair','New Jersey'),('07043','Upper Montclair','New Jersey'),('07079','South Orange','New Jersey'),('07102','Downtown Newark','New Jersey'),
('07105','Ironbound','New Jersey'),('07901','Summit','New Jersey'),
-- Long Island: western and central Nassau
('11001','Floral Park','Long Island'),('11003','Elmont','Long Island'),('11010','Franklin Square','Long Island'),('11020','Great Neck','Long Island'),
('11021','Great Neck','Long Island'),('11023','Great Neck','Long Island'),('11030','Manhasset','Long Island'),('11040','New Hyde Park','Long Island'),
('11050','Port Washington','Long Island'),('11501','Mineola','Long Island'),('11507','Albertson','Long Island'),('11516','Cedarhurst','Long Island'),
('11520','Freeport','Long Island'),('11530','Garden City','Long Island'),('11542','Glen Cove','Long Island'),('11545','Glen Head','Long Island'),
('11550','Hempstead','Long Island'),('11552','West Hempstead','Long Island'),('11554','East Meadow','Long Island'),('11557','Hewlett','Long Island'),
('11559','Lawrence','Long Island'),('11561','Long Beach','Long Island'),('11563','Lynbrook','Long Island'),('11565','Malverne','Long Island'),
('11566','Merrick','Long Island'),('11570','Rockville Centre','Long Island'),('11572','Oceanside','Long Island'),('11576','Roslyn','Long Island'),
('11577','Roslyn Heights','Long Island'),('11580','Valley Stream','Long Island'),('11581','Valley Stream','Long Island'),('11590','Westbury','Long Island'),
('11598','Woodmere','Long Island'),('11710','Bellmore','Long Island'),('11753','Jericho','Long Island'),('11756','Levittown','Long Island'),
('11758','Massapequa','Long Island'),('11793','Wantagh','Long Island'),('11801','Hicksville','Long Island'),
-- Westchester: lower county on Metro-North
('10502','Ardsley','Westchester'),('10514','Chappaqua','Westchester'),('10522','Dobbs Ferry','Westchester'),('10528','Harrison','Westchester'),
('10530','Hartsdale','Westchester'),('10533','Irvington','Westchester'),('10538','Larchmont','Westchester'),('10543','Mamaroneck','Westchester'),
('10550','Mount Vernon','Westchester'),('10552','Mount Vernon','Westchester'),('10553','Mount Vernon','Westchester'),('10570','Pleasantville','Westchester'),
('10573','Port Chester','Westchester'),('10577','Purchase','Westchester'),('10580','Rye','Westchester'),('10583','Scarsdale','Westchester'),
('10591','Tarrytown','Westchester'),('10601','White Plains','Westchester'),('10603','White Plains','Westchester'),('10604','White Plains','Westchester'),
('10605','White Plains','Westchester'),('10606','White Plains','Westchester'),('10607','White Plains','Westchester'),('10701','Yonkers','Westchester'),
('10703','Yonkers','Westchester'),('10704','Yonkers','Westchester'),('10705','Yonkers','Westchester'),('10706','Hastings-on-Hudson','Westchester'),
('10707','Tuckahoe','Westchester'),('10708','Bronxville','Westchester'),('10709','Eastchester','Westchester'),('10710','Yonkers','Westchester'),
('10801','New Rochelle','Westchester'),('10804','New Rochelle','Westchester'),('10805','New Rochelle','Westchester'),
-- Connecticut: lower Fairfield County
('06807','Cos Cob','Connecticut'),('06820','Darien','Connecticut'),('06830','Greenwich','Connecticut'),('06831','Greenwich','Connecticut'),
('06840','New Canaan','Connecticut'),('06850','Norwalk','Connecticut'),('06851','Norwalk','Connecticut'),('06853','Rowayton','Connecticut'),
('06854','South Norwalk','Connecticut'),('06855','East Norwalk','Connecticut'),('06870','Old Greenwich','Connecticut'),('06878','Riverside','Connecticut'),
('06880','Westport','Connecticut'),('06901','Stamford','Connecticut'),('06902','Stamford','Connecticut'),('06903','Stamford','Connecticut'),
('06905','Stamford','Connecticut'),('06906','Stamford','Connecticut'),('06907','Stamford','Connecticut')
on conflict (zip) do nothing;
-- Never shadow a real NYC zip.
delete from public.metro_zip_codes m using public.nyc_zip_codes n where n.zip = m.zip;

-- zip → {area, sub (borough), town, open}. Active commuter zips count as New York City.
create or replace function public.zip_area(p_zip text) returns jsonb
language sql stable security definer set search_path = public as $$
  with z as (select trim(p_zip) zip),
  m as (
    select coalesce(
      (select jsonb_build_object('area', 'New York City', 'sub', n.borough) from nyc_zip_codes n, z where n.zip = z.zip and n.active),
      (select jsonb_build_object('area', 'New York City', 'sub', null, 'town', mz.town) from metro_zip_codes mz, z where mz.zip = z.zip and mz.active),
      (select jsonb_build_object('area', a.area, 'sub', null) from zip_prefix_areas a, z where a.prefix = left(z.zip, 3)),
      jsonb_build_object('area', 'Elsewhere', 'sub', null)) j)
  select m.j || jsonb_build_object('open', coalesce((select status = 'open' from areas where name = m.j->>'area'), false)) from m;
$$;
grant execute on function public.zip_area(text) to anon, authenticated;

create or replace function public.profile_check_zip() returns trigger
language plpgsql security definer set search_path = public as $$
declare a jsonb; z jsonb;
begin
  if new.zip is null then new.borough := null; new.area := null; new.neighborhood := null; new.nomad := false; new.nomad_since := null; return new; end if;
  new.zip := trim(new.zip);
  if new.zip !~ '^[0-9]{5}$' then raise exception 'Enter a 5-digit zip code' using errcode = 'P0001'; end if;
  a := zip_area(new.zip);
  z := zip_lookup(new.zip);
  new.area := a->>'area';
  new.borough := a->>'sub';
  new.city := coalesce(a->>'sub', a->>'town', a->>'area');
  new.neighborhood := coalesce(z->>'neighborhood', a->>'town', z->>'borough', nullif(a->>'area', 'Elsewhere'));
  new.nomad := not coalesce((a->>'open')::boolean, false);
  new.nomad_since := case when new.nomad then coalesce(case when tg_op = 'UPDATE' and old.nomad then old.nomad_since end, now()) end;
  return new;
end $$;

create or replace function public.zip_preview(p_zip text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when trim(p_zip) !~ '^[0-9]{5}$' then null else
    jsonb_build_object('area', a->>'area', 'open', coalesce((a->>'open')::boolean, false),
      'neighborhood', coalesce(z->>'neighborhood', a->>'town', z->>'borough', nullif(a->>'area', 'Elsewhere'))) end
  from (select zip_area(p_zip) a, zip_lookup(p_zip) z) x;
$$;

-- The waitlist uses zip_area too: re-tag anyone already waiting in these towns.
update public.waitlist w set area = 'New York City', city = mz.town
from public.metro_zip_codes mz where mz.zip = w.zip and mz.active and w.area is distinct from 'New York City';

-- Staff: turn a commuter zip on or off; members there are re-tagged right away.
create or replace function public.staff_set_metro_zip(p_zip text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  update metro_zip_codes set active = p_active where zip = p_zip;
  update profiles set zip = zip where zip = p_zip;
  update waitlist w set area = (zip_area(w.zip))->>'area' where w.zip = p_zip;
end $$;
grant execute on function public.staff_set_metro_zip(text, boolean) to authenticated;

-- Re-tag members already in these towns (sets their town as the neighborhood and clears Nomad).
update public.profiles p set zip = p.zip from public.metro_zip_codes mz where mz.zip = p.zip;
