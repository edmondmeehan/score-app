-- 0032: Admin team. Owners add or remove admins (name + email) from Admin → Admins.
-- New admins get the 'owner' role = full admin access. Safe to run more than once.

alter table public.staff add column if not exists name text;
alter table public.staff add column if not exists added_by text;
alter table public.staff add column if not exists welcomed_at timestamptz;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from staff s join auth.users u on lower(u.email) = lower(s.email)
                where u.id = auth.uid() and s.role = 'owner');
$$;
grant execute on function public.is_owner() to authenticated;

create or replace function public.staff_list() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'email', s.email, 'name', s.name, 'role', s.role, 'added_by', s.added_by, 'created_at', s.created_at,
      'welcomed_at', s.welcomed_at,
      'has_account', exists(select 1 from auth.users u where lower(u.email) = lower(s.email)),
      'last_sign_in', (select u.last_sign_in_at from auth.users u where lower(u.email) = lower(s.email) limit 1)
    ) order by s.created_at) from staff s), '[]');
end $$;
grant execute on function public.staff_list() to authenticated;

-- Returns true if the person was newly added (so the app sends the welcome email once).
create or replace function public.staff_add(p_name text, p_email text) returns boolean
language plpgsql security definer set search_path = public as $$
declare who text := public.staff_email(); em text := lower(trim(p_email)); added boolean;
begin
  if not public.is_owner() then raise exception 'Only owners can add admins.'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Add their name.'; end if;
  insert into staff(email, role, name, added_by) values (em, 'owner', left(trim(p_name), 80), who)
  on conflict (email) do nothing;
  get diagnostics added = row_count;
  if added then
    insert into audit_log(staff_email, action, reason) values (who, 'admin_added', em);
  end if;
  return added;
end $$;
grant execute on function public.staff_add(text, text) to authenticated;

create or replace function public.staff_mark_welcomed(p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  update staff set welcomed_at = now() where lower(email) = lower(p_email);
end $$;
grant execute on function public.staff_mark_welcomed(text) to authenticated;

create or replace function public.staff_remove(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare who text := public.staff_email(); em text := lower(trim(p_email));
begin
  if not public.is_owner() then raise exception 'Only owners can remove admins.'; end if;
  if em = lower(who) then raise exception 'You can’t remove yourself.'; end if;
  if (select role from staff where lower(email) = em) = 'owner'
     and (select count(*) from staff where role = 'owner') <= 1 then
    raise exception 'Keep at least one owner.';
  end if;
  delete from staff where lower(email) = em;
  insert into audit_log(staff_email, action, reason) values (who, 'admin_removed', em);
end $$;
grant execute on function public.staff_remove(text) to authenticated;

notify pgrst, 'reload schema';
