-- 0074: Founding Lifetime: a one-time App Store purchase that unlocks Premium for as long as ScoreDate runs. Capped (default 100).
alter table public.profiles add column if not exists lifetime_at timestamptz;
alter table public.profiles add column if not exists lifetime_ref text;

insert into public.app_config(key, value) values ('lifetime_offer', '{"enabled": true, "cap": 100, "price": "$499"}'::jsonb)
on conflict (key) do nothing;

-- Public counter for the paywall: how many are left, and whether this member already has it.
create or replace function public.lifetime_status() returns jsonb
language sql stable security definer set search_path = public as $$
  with cfg as (select coalesce((select value from app_config where key = 'lifetime_offer'), '{}'::jsonb) v),
       sold as (select count(*)::int n from profiles where lifetime_at is not null)
  select jsonb_build_object(
    'enabled', coalesce((cfg.v->>'enabled')::boolean, false),
    'cap', coalesce((cfg.v->>'cap')::int, 100),
    'price', coalesce(cfg.v->>'price', '$499'),
    'sold', sold.n,
    'left', greatest(0, coalesce((cfg.v->>'cap')::int, 100) - sold.n),
    'mine', (select lifetime_at from profiles where id = auth.uid()))
  from cfg, sold;
$$;
grant execute on function public.lifetime_status() to anon, authenticated;

-- Server only (after Apple confirms the purchase): mark the member as Founding Lifetime, Premium from now on.
create or replace function public.grant_lifetime(p_secret text, p_user uuid, p_ref text, p_environment text) returns text
language plpgsql security definer set search_path = public as $$
begin
  perform check_server_secret(p_secret);
  if p_environment = 'SANDBOX' and not test_mode() then return 'sandbox ignored'; end if;
  update profiles set
    lifetime_at = coalesce(lifetime_at, now()),
    lifetime_ref = coalesce(lifetime_ref, p_ref),
    plan = case when plan = 'black' then plan else 'premium' end,
    status = case when status in ('onboarding', 'preview', 'paused') then 'active' else status end
  where id = p_user;
  return 'ok';
end $$;
revoke all on function public.grant_lifetime(text, uuid, text, text) from public, authenticated;
grant execute on function public.grant_lifetime(text, uuid, text, text) to anon;

-- A Founding Lifetime member never drops below Premium (e.g. when an old subscription expires).
create or replace function public.trg_lifetime_floor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.lifetime_at is not null and new.plan in ('none', 'preview', 'paused', 'membership') then
    new.plan := 'premium';
    if new.status in ('onboarding', 'preview') then new.status := 'active'; end if;
  end if;
  return new;
end $$;
create or replace trigger lifetime_floor before update of plan on public.profiles
  for each row execute function public.trg_lifetime_floor();
revoke all on function public.trg_lifetime_floor() from public, anon, authenticated;

-- Owners: turn the offer on/off and set the cap.
create or replace function public.staff_set_lifetime_offer(p_enabled boolean, p_cap int, p_price text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if staff_role() is distinct from 'owner' then raise exception 'owner only'; end if;
  if p_cap < 0 or p_cap > 10000 then raise exception 'bad cap'; end if;
  insert into app_config(key, value) values ('lifetime_offer', jsonb_build_object('enabled', p_enabled, 'cap', p_cap, 'price', coalesce(nullif(trim(p_price), ''), '$499')))
  on conflict (key) do update set value = excluded.value;
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'lifetime_offer', format('enabled=%s cap=%s', p_enabled, p_cap));
end $$;
revoke all on function public.staff_set_lifetime_offer(boolean, int, text) from public, anon;
grant execute on function public.staff_set_lifetime_offer(boolean, int, text) to authenticated;
