-- 0083: Founding Member deal. Every Founding Member gets 6 months of Membership free, then can keep Membership at
-- $9.99/month (App Store product co.please.scoredate.membership.founder) for as long as that subscription never lapses.
--  • The free 6 months start when a founder's account becomes active (or now, for founders who are already active).
--  • During the free months their plan never drops below Membership, even if a billing event says otherwise.
--  • In the last 14 days (and up to 30 days after) they can lock in $9.99/month in the iPhone app.
--  • If the $9.99 subscription ever expires, or they don't take it within 30 days of the free months ending, the
--    founder price is gone for good (they can still join at regular prices).
-- Safe to re-run.

alter table public.profiles add column if not exists founder_comp_until timestamptz;
alter table public.profiles add column if not exists founder_rate text check (founder_rate in ('eligible', 'active', 'forfeited'));

insert into public.app_config(key, value) values ('founder_deal', '{"enabled": true, "free_months": 6, "price": "$9.99"}'::jsonb)
on conflict (key) do nothing;

-- Start a founder's free months (once). Only for Founding Members whose account is active and who aren't already paying more.
create or replace function public.start_founder_comp(p profiles) returns void
language plpgsql security definer set search_path = public as $$
declare months int := coalesce((select (value->>'free_months')::int from app_config where key = 'founder_deal'), 6);
begin
  if not coalesce((select (value->>'enabled')::boolean from app_config where key = 'founder_deal'), false) then return; end if;
  if not p.is_founder or p.founder_comp_until is not null then return; end if;
  update profiles set founder_comp_until = now() + make_interval(months => months), founder_rate = coalesce(founder_rate, 'eligible'),
    plan = case when plan in ('none', 'preview') then 'membership' else plan end
  where id = p.id;
end $$;
revoke all on function public.start_founder_comp(profiles) from public, anon, authenticated;

-- Founders becoming active (or being marked as founders while active) get their free months automatically.
create or replace function public.trg_founder_comp_start() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce((select (value->>'enabled')::boolean from app_config where key = 'founder_deal'), false) then return new; end if;
  if new.is_founder and new.founder_comp_until is null and new.status in ('active', 'preview') and new.id_status = 'approved' then
    new.founder_comp_until := now() + make_interval(months => coalesce((select (value->>'free_months')::int from app_config where key = 'founder_deal'), 6));
    new.founder_rate := coalesce(new.founder_rate, 'eligible');
    if new.plan in ('none', 'preview') then new.plan := 'membership'; end if;
  end if;
  return new;
end $$;
drop trigger if exists founder_comp_start on public.profiles;
create trigger founder_comp_start before update of status, is_founder, id_status on public.profiles
  for each row execute function public.trg_founder_comp_start();

-- During the free months, never drop below Membership (e.g. a billing event with no subscription).
create or replace function public.trg_founder_comp_floor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.founder_comp_until > now() and new.plan in ('none', 'preview', 'paused') then
    new.plan := 'membership';
    if new.status in ('onboarding', 'preview') and old.status in ('active', 'preview') then new.status := 'active'; end if;
  end if;
  return new;
end $$;
drop trigger if exists founder_comp_floor on public.profiles;
create trigger founder_comp_floor before update of plan on public.profiles
  for each row execute function public.trg_founder_comp_floor();

-- Founders who are already active get their free months now.
do $$
declare p profiles;
begin
  for p in select * from profiles where is_founder and founder_comp_until is null and status in ('active', 'preview') and id_status = 'approved' loop
    perform start_founder_comp(p);
  end loop;
end $$;

-- Daily: free months ended and not paying → back to no plan (and a reminder); 30 days later with no $9.99 sub → price gone.
create or replace function public.cron_founder_comp(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ended int := 0; forfeited int := 0; reminded int := 0; r profiles;
begin
  perform check_server_secret(p_secret);
  -- Reminders 14 days and 3 days before the free months end.
  for r in select * from profiles where founder_comp_until is not null and founder_rate = 'eligible'
      and (founder_comp_until::date - current_date) in (14, 3) loop
    perform notify(r.id, null, 'founder_comp_ending', 'reminder', 'Your free Founding months end soon',
      'Lock in Membership at your Founding price of $9.99/month in the ScoreDate app. It stays $9.99 as long as you stay subscribed.',
      '/plans', 'foundercomp:' || r.id || ':' || (r.founder_comp_until::date - current_date), true);
    reminded := reminded + 1;
  end loop;
  update profiles set plan = 'none', status = case when status in ('suspended', 'removed', 'taken') then status else 'onboarding' end
  where founder_comp_until < now() and plan = 'membership' and founder_rate <> 'active' and lifetime_at is null
    and (plan_expires_at is null or plan_expires_at < now());
  get diagnostics ended = row_count;
  update profiles set founder_rate = 'forfeited'
  where founder_rate = 'eligible' and founder_comp_until < now() - interval '30 days';
  get diagnostics forfeited = row_count;
  return jsonb_build_object('reminded', reminded, 'ended', ended, 'forfeited', forfeited);
end $$;
revoke all on function public.cron_founder_comp(text) from public, authenticated;
grant execute on function public.cron_founder_comp(text) to anon;

-- Server only (RevenueCat webhook): the $9.99 founder subscription started, renewed, or expired.
create or replace function public.founder_rate_event(p_secret text, p_user uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform check_server_secret(p_secret);
  if p_active then
    update profiles set founder_rate = 'active' where id = p_user and is_founder and coalesce(founder_rate, 'eligible') <> 'forfeited';
  else
    update profiles set founder_rate = 'forfeited' where id = p_user and founder_rate = 'active';
  end if;
end $$;
revoke all on function public.founder_rate_event(text, uuid, boolean) from public, authenticated;
grant execute on function public.founder_rate_event(text, uuid, boolean) to anon;

-- For the paywall: is the $9.99 founder price available to me right now, and when do my free months end?
create or replace function public.my_founder_deal() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when p.is_founder then jsonb_build_object(
    'comp_until', p.founder_comp_until,
    'rate', p.founder_rate,
    'price', coalesce((select value->>'price' from app_config where key = 'founder_deal'), '$9.99'),
    -- Can subscribe at $9.99: still eligible (or already on it), from 14 days before the free months end.
    'can_lock', coalesce(p.founder_rate, 'eligible') in ('eligible', 'active') and p.founder_comp_until is not null
      and now() >= p.founder_comp_until - interval '14 days')
  end
  from profiles p where p.id = auth.uid();
$$;
grant execute on function public.my_founder_deal() to authenticated;
