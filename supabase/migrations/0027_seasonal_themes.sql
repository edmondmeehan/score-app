-- 0027: Seasonal themes (Halloween, Thanksgiving, Holidays, New Year's, Valentine's, 4th of July...).
-- Schedules and banners live in app_config('seasonal_themes'); with no row the built-in schedule is used.
create or replace function public.staff_set_seasons(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(staff_role(), '') <> 'owner' then raise exception 'Only owners can change seasonal themes'; end if;
  if jsonb_typeof(p) <> 'object' or length(p::text) > 20000 then raise exception 'Invalid settings'; end if;
  insert into app_config(key, value) values ('seasonal_themes', p) on conflict (key) do update set value = excluded.value;
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'seasonal_themes_update', left(coalesce(p->>'force', 'schedule'), 60));
end $$;
grant execute on function public.staff_set_seasons(jsonb) to authenticated;
