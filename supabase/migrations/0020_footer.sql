-- 0020: Admin-editable site and app footers.
-- The footer is stored as JSON in app_config('footer'). With no row, the site uses the built-in default.
-- Only owners can change it, because it carries the legal links and disclaimers.

create or replace function public.staff_set_footer(p_footer jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(staff_role(), '') <> 'owner' then raise exception 'Only owners can edit the footer'; end if;
  if p_footer is null then
    delete from app_config where key = 'footer';
    insert into audit_log(staff_email, action, reason) values (staff_email(), 'footer_reset', 'Back to default');
    return;
  end if;
  if jsonb_typeof(p_footer) <> 'object' then raise exception 'Footer must be an object'; end if;
  if length(p_footer::text) > 20000 then raise exception 'Footer is too long'; end if;
  insert into app_config(key, value) values ('footer', p_footer)
  on conflict (key) do update set value = excluded.value;
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'footer_update', left(p_footer->>'copyright', 120));
end $$;

revoke all on function public.staff_set_footer(jsonb) from public, anon;
grant execute on function public.staff_set_footer(jsonb) to authenticated;
