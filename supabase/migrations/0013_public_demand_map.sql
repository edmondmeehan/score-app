-- Home page map: real waitlist demand by neighborhood, switching to "Live" once members pass the map minimum.
-- Counts only (never people), rounded down, and hidden below a minimum. Test accounts (@seed.scoredate.test)
-- are never counted, so the public page only ever shows real demand. Safe to run more than once. Run after 0012.

insert into public.app_config(key, value) values ('public_demand_min', '10') on conflict (key) do nothing;

create or replace function public.public_demand_min() returns int language sql stable as $$
  select greatest(5, coalesce((select (value::text)::int from public.app_config where key = 'public_demand_min'), 10));
$$;

create or replace function public.public_demand_map() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare dmin int := public_demand_min(); mmin int := map_min(); out jsonb; total int;
begin
  with
  w as (   -- waiting or invited, real people only
    select place_key_for(zip) k from waitlist
    where status in ('waiting','invited') and zip is not null and email not ilike '%@seed.scoredate.test'),
  m as (   -- live members, real people only, respecting the map opt-out
    select place_key_for(p.zip) k from profiles p join auth.users u on u.id = p.id
    where p.status in ('active','preview') and p.zip is not null and not p.map_opt_out
      and u.email not ilike '%@seed.scoredate.test'),
  lvl1 as (
    select k, sum(wn)::int wn, sum(mn)::int mn from (
      select k, 1 wn, 0 mn from w union all select k, 0, 1 from m) x
    where k is not null group by k),
  lvl2 as (  -- small neighborhoods roll into their borough / area
    select case when p.kind = 'neighborhood' and l.wn + l.mn < dmin then p.parent else l.k end k, sum(l.wn)::int wn, sum(l.mn)::int mn
    from lvl1 l join map_places p on p.key = l.k group by 1),
  lvl3 as (  -- small boroughs roll into their area
    select case when p.kind = 'borough' and l.wn + l.mn < dmin then p.parent else l.k end k, sum(l.wn)::int wn, sum(l.mn)::int mn
    from lvl2 l join map_places p on p.key = l.k group by 1)
  select coalesce(jsonb_agg(jsonb_build_object(
      'name', p.name, 'kind', p.kind, 'lat', p.lat, 'lng', p.lng,
      'live', l.mn >= mmin,
      -- rounded down to the nearest 10 (or 5 under 50) so no exact figure is ever exposed
      'waiting', case when l.wn >= 50 then (l.wn / 10) * 10 when l.wn >= dmin then (l.wn / 5) * 5 else null end,
      'level', case when l.wn + l.mn >= 8 * dmin then 'hot' when l.wn + l.mn >= 3 * dmin then 'busy' else 'growing' end)
      order by l.wn + l.mn desc), '[]'::jsonb),
    coalesce(sum(l.wn), 0)::int
  into out, total
  from lvl3 l join map_places p on p.key = l.k
  where l.wn + l.mn >= dmin;

  return jsonb_build_object('spots', out,
    'total_waiting', case when total >= 100 then (total / 50) * 50 else null end);
end $$;

grant execute on function public.public_demand_map() to anon, authenticated;
