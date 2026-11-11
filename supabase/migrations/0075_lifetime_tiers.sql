-- 0075: Founding Lifetime in two price tiers: the first 25 at the early price, the rest (up to the cap) at the regular price.
-- Each tier is its own App Store product (Apple sets one price per product). Turned off for now; owners switch it on in Admin → Billing.
-- Safe to re-run.

update public.app_config
   set value = coalesce(value, '{}'::jsonb) || '{"enabled": false, "cap": 100, "early_cap": 25, "price": "$499", "price2": "$749"}'::jsonb
 where key = 'lifetime_offer';
insert into public.app_config(key, value) values ('lifetime_offer', '{"enabled": false, "cap": 100, "early_cap": 25, "price": "$499", "price2": "$749"}'::jsonb)
on conflict (key) do nothing;

create or replace function public.lifetime_status() returns jsonb
language sql stable security definer set search_path = public as $$
  with cfg as (select coalesce((select value from app_config where key = 'lifetime_offer'), '{}'::jsonb) v),
       sold as (select count(*)::int n from profiles where lifetime_at is not null),
       c as (select coalesce((cfg.v->>'cap')::int, 100) cap, least(coalesce((cfg.v->>'early_cap')::int, 25), coalesce((cfg.v->>'cap')::int, 100)) early, cfg.v from cfg)
  select jsonb_build_object(
    'enabled', coalesce((c.v->>'enabled')::boolean, false),
    'cap', c.cap,
    'early_cap', c.early,
    'price', coalesce(c.v->>'price', '$499'),
    'price2', coalesce(c.v->>'price2', '$749'),
    'sold', sold.n,
    'left', greatest(0, c.cap - sold.n),
    'early_left', greatest(0, c.early - sold.n),
    'tier', case when sold.n < c.early then 1 else 2 end,
    'mine', (select lifetime_at from profiles where id = auth.uid()))
  from c, sold;
$$;
grant execute on function public.lifetime_status() to anon, authenticated;

drop function if exists public.staff_set_lifetime_offer(boolean, int, text);
create or replace function public.staff_set_lifetime_offer(p_enabled boolean, p_cap int, p_early_cap int, p_price text, p_price2 text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if staff_role() is distinct from 'owner' then raise exception 'owner only'; end if;
  if p_cap < 0 or p_cap > 10000 then raise exception 'bad cap'; end if;
  if p_early_cap < 0 or p_early_cap > p_cap then raise exception 'Early-price spots must be between 0 and the cap'; end if;
  insert into app_config(key, value) values ('lifetime_offer', jsonb_build_object(
    'enabled', p_enabled, 'cap', p_cap, 'early_cap', p_early_cap,
    'price', coalesce(nullif(trim(p_price), ''), '$499'), 'price2', coalesce(nullif(trim(p_price2), ''), '$749')))
  on conflict (key) do update set value = excluded.value;
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'lifetime_offer', format('enabled=%s cap=%s early=%s', p_enabled, p_cap, p_early_cap));
end $$;
revoke all on function public.staff_set_lifetime_offer(boolean, int, int, text, text) from public, anon;
grant execute on function public.staff_set_lifetime_offer(boolean, int, int, text, text) to authenticated;
