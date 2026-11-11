-- 0067: two-step sign-in.
-- Staff powers (is_staff, staff_role, staff_email) only count when the session passed two-step sign-in (aal2).
-- A staff member signed in with just a password is treated like a regular member until they enter their code.
-- am_staff() tells the app someone is on the staff list (so it can send them to set up two-step), and grants nothing.

create or replace function public.is_staff(min_role text default null) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from staff s join auth.users u on lower(u.email) = lower(s.email) where u.id = auth.uid());
$$;

create or replace function public.staff_role() returns text
language sql stable security definer set search_path = public as $$
  select s.role from staff s join auth.users u on lower(u.email) = lower(s.email)
  where u.id = auth.uid() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function public.staff_email() returns text
language sql stable security definer set search_path = public as $$
  select s.email from staff s join auth.users u on lower(u.email) = lower(s.email)
  where u.id = auth.uid() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function public.am_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff s join auth.users u on lower(u.email) = lower(s.email) where u.id = auth.uid());
$$;
revoke all on function public.am_staff() from public, anon;
grant execute on function public.am_staff() to authenticated;
