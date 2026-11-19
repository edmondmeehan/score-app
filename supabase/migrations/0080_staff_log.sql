-- 0080: Lets the admin record actions that happen outside the database (like moving a release live) in the audit log.
create or replace function public.staff_log(p_action text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  insert into audit_log(staff_email, action, reason) values (staff_email(), left(p_action, 60), left(p_reason, 500));
end $$;
revoke all on function public.staff_log(text, text) from public, anon;
grant execute on function public.staff_log(text, text) to authenticated;
