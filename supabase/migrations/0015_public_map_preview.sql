-- Public map "preview" switch: when staff turn it on, the home page map also counts test accounts
-- (@seed.scoredate.test) and the page shows a visible "Preview · sample data" tag. Off by default.
-- Safe to run more than once. Run after 0013.

insert into public.app_config(key, value) values ('public_map_demo', 'false') on conflict (key) do nothing;

create or replace function public.staff_set_public_map_demo(p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  insert into app_config(key, value) values ('public_map_demo', to_jsonb(p_on))
  on conflict (key) do update set value = excluded.value;
  insert into audit_log(staff_email, action, reason)
  values (coalesce((select email from auth.users where id = auth.uid()), 'staff'), 'public_map_demo_' || case when p_on then 'on' else 'off' end, null);
end $$;
grant execute on function public.staff_set_public_map_demo(boolean) to authenticated;

create or replace function public.public_demand_map() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare dmin int := public_demand_min(); mmin int := map_min(); out jsonb; total int;
  demo boolean := coalesce((select value = 'true'::jsonb from app_config where key = 'public_map_demo'), false);
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
