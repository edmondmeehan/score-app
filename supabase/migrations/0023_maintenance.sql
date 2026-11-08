-- 0023: Maintenance mode + a public contact form for the maintenance page.

insert into public.app_config(key, value)
values ('maintenance', '{"on": false, "message": "Score is down for scheduled maintenance. We’ll be back shortly."}')
on conflict (key) do nothing;

create or replace function public.staff_set_maintenance(p_on boolean, p_message text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(staff_role(), '') <> 'owner' then raise exception 'Only owners can change maintenance mode'; end if;
  insert into app_config(key, value)
  values ('maintenance', jsonb_build_object('on', p_on, 'message', left(coalesce(nullif(trim(p_message), ''), 'Score is down for scheduled maintenance. We’ll be back shortly.'), 400), 'since', case when p_on then now() else null end))
  on conflict (key) do update set value = excluded.value;
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'maintenance_' || case when p_on then 'on' else 'off' end, left(p_message, 200));
end $$;
grant execute on function public.staff_set_maintenance(boolean, text) to authenticated;

-- Anyone can leave a message from the maintenance page. It lands in Admin → Support.
create or replace function public.submit_contact(p_name text, p_email text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  if p_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Please enter a valid email.'; end if;
  if length(trim(coalesce(p_body, ''))) < 5 then raise exception 'Please write a short message.'; end if;
  select count(*) into recent from support_tickets where lower(email) = lower(trim(p_email)) and created_at > now() - interval '1 hour';
  if recent >= 3 then raise exception 'Thanks, we already have your message. We’ll reply soon.'; end if;
  if (select count(*) from support_tickets where user_id is null and created_at > now() - interval '10 minutes') >= 50 then
    raise exception 'We’re getting a lot of messages. Please email support@scoredate.app.';
  end if;
  insert into support_tickets(user_id, email, category, subject, body)
  values (null, lower(trim(p_email)), 'other', left('Contact: ' || coalesce(nullif(trim(p_name), ''), 'Visitor'), 120), left(trim(p_body), 4000));
end $$;
revoke all on function public.submit_contact(text, text, text) from public;
grant execute on function public.submit_contact(text, text, text) to anon, authenticated;
