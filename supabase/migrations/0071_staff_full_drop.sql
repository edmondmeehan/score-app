-- 0071: staff always see a full Daily Drop: every verified member in the app (not just 5–10, no "seen in the last 30 days"
-- rule, no gender/area filters), topped up each time they open it. Members' Drops are unchanged.

create or replace function public.fill_drop_staff(me profiles) returns int
language plpgsql security definer set search_path = public as $$
declare added int;
begin
  insert into drops(user_id, match_id, compat)
  select me.id, p.id,
    least(99, 40
      + coalesce(10 * cardinality(array(select unnest(p.money_values) intersect select unnest(me.money_values))), 0)
      + case when p.band = me.band then 20 when p.band is null or me.band is null then 0 else 10 end
      + case when p.trend = 'up' then 5 else 0 end)
  from profiles p
  where p.id <> me.id and p.status in ('active', 'preview') and p.band is not null and p.id_status = 'approved'
    and not exists (select 1 from blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
  limit 300
  on conflict do nothing;
  get diagnostics added = row_count;
  return added;
end $$;
revoke all on function public.fill_drop_staff(profiles) from public, anon, authenticated;

create or replace function public.get_drop() returns setof drops
language plpgsql security definer set search_path = public as $$
declare me profiles; n int;
begin
  select * into me from profiles where id = auth.uid();
  if am_staff() then
    perform fill_drop_staff(me);
  else
    if me.status not in ('active','preview') then return; end if;
    if not exists (select 1 from drops where user_id = me.id and drop_date = current_date) then
      n := case when me.plan in ('premium','black') then 10 else 5 end;
      perform fill_drop(me, n);
    end if;
  end if;
  return query select * from drops where user_id = me.id and drop_date = current_date order by compat desc;
end $$;
