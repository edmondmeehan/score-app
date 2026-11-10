-- 0066: staff get full member access (top plan) without paying.
-- A staff member's profile always shows plan 'black'. Whatever their real billing plan is gets kept in paid_plan,
-- so billing webhooks and expiry jobs keep working, and if someone stops being staff their real plan comes back.
-- Safe to re-run.

alter table public.profiles add column if not exists paid_plan text;

create or replace function public.staff_profile_ids(p_email text)
returns setof uuid language sql stable security definer set search_path = public as $$
  select u.id from auth.users u where lower(u.email) = lower(p_email);
$$;
revoke all on function public.staff_profile_ids(text) from public, anon, authenticated;

-- On any plan change (or a new profile) for a staff account: remember the real plan, keep 'black'.
create or replace function public.trg_staff_plan_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('sd.staff_sync', true) = '1' then return new; end if;
  if tg_op = 'UPDATE' and new.plan is not distinct from old.plan then return new; end if;
  if exists (select 1 from staff s join auth.users u on lower(u.email) = lower(s.email) where u.id = new.id) then
    new.paid_plan := new.plan;
    new.plan := 'black';
  end if;
  return new;
end $$;

drop trigger if exists staff_plan_guard on public.profiles;
create trigger staff_plan_guard before insert or update of plan on public.profiles
  for each row execute function public.trg_staff_plan_guard();

-- Added to staff: unlock. Removed from staff: give back their real plan.
create or replace function public.trg_staff_access_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('sd.staff_sync', '1', true);
  if tg_op in ('DELETE', 'UPDATE') then
    update profiles set plan = coalesce(paid_plan, 'none'), paid_plan = null
      where id in (select staff_profile_ids(old.email));
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update profiles set paid_plan = coalesce(paid_plan, plan), plan = 'black'
      where id in (select staff_profile_ids(new.email));
  end if;
  perform set_config('sd.staff_sync', '', true);
  return null;
end $$;

drop trigger if exists staff_access_sync on public.staff;
create trigger staff_access_sync after insert or update of email or delete on public.staff
  for each row execute function public.trg_staff_access_sync();

revoke all on function public.trg_staff_plan_guard() from public, anon, authenticated;
revoke all on function public.trg_staff_access_sync() from public, anon, authenticated;

-- Current staff.
do $$
begin
  perform set_config('sd.staff_sync', '1', true);
  update profiles p set paid_plan = coalesce(p.paid_plan, p.plan), plan = 'black'
  where exists (select 1 from staff s join auth.users u on lower(u.email) = lower(s.email) where u.id = p.id);
  perform set_config('sd.staff_sync', '', true);
end $$;
