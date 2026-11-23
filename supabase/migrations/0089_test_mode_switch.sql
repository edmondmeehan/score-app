-- 0089: Owners can switch test mode on and off from Admin → Billing (no SQL). Every change is logged. Safe to re-run.
-- Test mode ON: the website offers free test purchases and TestFlight (sandbox) add-on purchases unlock things.
-- Test mode OFF (live): memberships and add-ons are bought only through the App Store; nothing is free.

create or replace function public.staff_set_test_mode(p_on boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if staff_role() is distinct from 'owner' then raise exception 'owner only'; end if;
  insert into app_config(key, value) values ('test_mode', to_jsonb(p_on))
  on conflict (key) do update set value = excluded.value;
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'test_mode', case when p_on then 'on' else 'off' end);
  return p_on;
end $$;
revoke all on function public.staff_set_test_mode(boolean) from public, anon;
grant execute on function public.staff_set_test_mode(boolean) to authenticated;
