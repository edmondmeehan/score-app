-- 0087: Only show waitlist numbers ("#214 in line", "of 1,300 waiting") once the list is big enough to impress.
-- Below the threshold, members see their neighborhood, the referral and Founding Member perks, and "you moved up", with no numbers.
-- Admin → Waitlist & invites sets the threshold (0 = always show). Safe to re-run.

insert into public.app_config(key, value) values ('waitlist_position', '{"min": 2000}'::jsonb)
on conflict (key) do nothing;

-- Real people waiting or invited (test/demo addresses don't count).
create or replace function public.waitlist_show_position() returns boolean
language sql stable security definer set search_path = public as $$
  select (select count(*) from waitlist where status in ('waiting', 'invited') and not public.is_test_email(email))
         >= coalesce((select (value->>'min')::int from app_config where key = 'waitlist_position'), 2000);
$$;
grant execute on function public.waitlist_show_position() to anon, authenticated;

create or replace function public.staff_set_waitlist_position(p_min int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if staff_role() is distinct from 'owner' then raise exception 'owner only'; end if;
  if p_min < 0 or p_min > 1000000 then raise exception 'Pick a number from 0 to 1,000,000'; end if;
  insert into app_config(key, value) values ('waitlist_position', jsonb_build_object('min', p_min))
  on conflict (key) do update set value = excluded.value;
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'waitlist_position', 'min=' || p_min);
end $$;
revoke all on function public.staff_set_waitlist_position(int) from public, anon;
grant execute on function public.staff_set_waitlist_position(int) to authenticated;
