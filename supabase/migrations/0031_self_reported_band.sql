-- 0031: Credit mode switch. "self" = members pick their own band (labeled Self-reported);
-- "verified" = soft-check through the credit partner (the original flow). Staff flip it in Admin → Verification.
-- A band is verified exactly when profiles.credit_verified_at is set; self-reported bands leave it null.
-- Safe to run more than once.

alter table public.profiles add column if not exists band_reported_at timestamptz;

insert into public.app_config(key, value) values ('credit_mode', '{"mode":"self"}')
on conflict (key) do nothing;

create or replace function public.credit_mode() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select value->>'mode' from app_config where key = 'credit_mode'), 'verified')
$$;
grant execute on function public.credit_mode() to anon, authenticated;

-- Member picks their own band (self mode only). Never overwrites a verified band; changes at most once every 30 days.
create or replace function public.self_report_band(p_band text, p_trend text) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if credit_mode() <> 'self' then raise exception 'Self-reported bands are turned off. Verify your band instead.'; end if;
  if p_band not in ('elite','strong','solid','building') then raise exception 'Choose a band'; end if;
  select * into me from profiles where id = auth.uid();
  if me.credit_verified_at is not null then raise exception 'Your band is already verified.'; end if;
  if me.band is not null and me.band_reported_at > now() - interval '30 days' and me.band is distinct from p_band then
    raise exception 'You can change a self-reported band once every 30 days.';
  end if;
  update profiles set band = p_band,
    trend = case when p_trend in ('up','steady','down') then p_trend else 'steady' end,
    credit_verified_at = null, band_reported_at = now()
  where id = auth.uid();
  insert into verifications(user_id, kind, provider, status, detail) values (auth.uid(), 'credit', 'self-reported', 'approved', p_band);
end $$;
grant execute on function public.self_report_band(text, text) to authenticated;

create or replace function public.staff_set_credit_mode(p_mode text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_mode not in ('self','verified') then raise exception 'mode must be self or verified'; end if;
  insert into app_config(key, value) values ('credit_mode', jsonb_build_object('mode', p_mode))
  on conflict (key) do update set value = excluded.value;
end $$;
grant execute on function public.staff_set_credit_mode(text) to authenticated;

notify pgrst, 'reload schema';
