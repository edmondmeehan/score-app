-- 0073: staff skip member sign-up, so they count as active members (not "onboarding"); add-ons like Spotlight work for them.
-- They still don't appear in members' Drops unless they add a band and pass the ID check.
create or replace function public.trg_staff_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'onboarding' and exists (select 1 from staff s join auth.users u on lower(u.email) = lower(s.email) where u.id = new.id) then
    new.status := 'active';
  end if;
  return new;
end $$;
create or replace trigger staff_status before insert or update of status on public.profiles
  for each row execute function public.trg_staff_status();

create or replace function public.trg_staff_status_on_add() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update profiles set status = 'active' where status = 'onboarding' and id in (select staff_profile_ids(new.email));
  return null;
end $$;
create or replace trigger staff_status_on_add after insert or update of email on public.staff
  for each row execute function public.trg_staff_status_on_add();

revoke all on function public.trg_staff_status() from public, anon, authenticated;
revoke all on function public.trg_staff_status_on_add() from public, anon, authenticated;

update profiles set status = 'active'
where status = 'onboarding' and id in (select u.id from staff s join auth.users u on lower(u.email) = lower(s.email));
