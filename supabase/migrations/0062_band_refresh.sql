-- 0062 Keep self-reported bands current.
-- * confirm_band(): "Still the same" in Settings → Your credit band (re-dates the band without changing it).
-- * queue_band_refresh(): once a month, a gentle push to members whose self-reported band is 30+ days old.
--   Respects their reminder preferences and quiet hours (it goes through notify()). Run after 0061.

create or replace function public.confirm_band() returns void
language plpgsql security definer set search_path = public as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.band is null then raise exception 'Add your band first.'; end if;
  if me.credit_verified_at is not null then return; end if;
  update profiles set band_reported_at = now() where id = me.id;
  insert into verifications(user_id, kind, provider, status, detail) values (me.id, 'credit', 'self-reported', 'approved', me.band || ' (confirmed)');
end $$;
grant execute on function public.confirm_band() to authenticated;

create or replace function public.queue_band_refresh(p_secret text) returns int
language plpgsql security definer set search_path = public, private as $$
declare r record; cnt int := 0;
begin
  perform check_server_secret(p_secret);
  if credit_mode() <> 'self' then return 0; end if;
  for r in
    select p.id from profiles p
    where p.status = 'active' and p.band is not null and p.credit_verified_at is null
      and coalesce(p.band_reported_at, p.created_at) < now() - interval '30 days'
      and coalesce(p.last_active_at, p.created_at) > now() - interval '45 days'
      and not exists (select 1 from notifications n where n.user_id = p.id and n.kind = 'band_refresh' and n.created_at > now() - interval '30 days')
    limit 2000
  loop
    perform notify(r.id, null, 'band_refresh', 'reminder', 'Has your credit score changed?',
      'Take 30 seconds to check it and keep your band current. Still the same? One tap confirms it.',
      '/app/settings#band', 'band_refresh:' || to_char(now(), 'YYYY-MM'));
    cnt := cnt + 1;
  end loop;
  return cnt;
end $$;
revoke execute on function public.queue_band_refresh(text) from public, anon, authenticated;
