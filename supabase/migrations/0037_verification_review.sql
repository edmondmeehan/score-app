-- 0037: richer verification review.
--  * verification_signals: IP, approximate location and device at signup / ID / photo steps (staff-only, kept 180 days).
--  * photos.match_reason: why the face match landed where it did (incl. AWS errors).
--  * verification_reviews: staff decisions with a reason, internal note and the message sent to the member.
--  * staff_verification_decide / staff_set_photo: record decisions per case or per photo.

create table if not exists public.verification_signals (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  step text not null,
  ip text,
  city text,
  region text,
  country text,
  lat numeric(8,4),
  lng numeric(8,4),
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists verification_signals_user on public.verification_signals(user_id, created_at desc);
create index if not exists verification_signals_ip on public.verification_signals(ip);
alter table public.verification_signals enable row level security;
drop policy if exists vsig_staff on public.verification_signals;
create policy vsig_staff on public.verification_signals for select using (public.is_staff());

create or replace function public.record_verification_signal(p_secret text, p_user uuid, p_step text, p_ip text, p_city text, p_region text, p_country text, p_lat numeric, p_lng numeric, p_ua text)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if p_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  insert into verification_signals(user_id, step, ip, city, region, country, lat, lng, user_agent)
  values (p_user, left(p_step, 30), left(p_ip, 64), left(p_city, 80), left(p_region, 40), left(p_country, 4), p_lat, p_lng, left(p_ua, 300));
  delete from verification_signals where user_id = p_user and created_at < now() - interval '180 days';
end $$;
revoke all on function public.record_verification_signal(text, uuid, text, text, text, text, text, numeric, numeric, text) from public;
grant execute on function public.record_verification_signal(text, uuid, text, text, text, text, text, numeric, numeric, text) to anon, authenticated;

-- Other accounts seen on the same IP (staff only).
create or replace function public.staff_same_ip_accounts(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.is_staff() then '[]'::jsonb else coalesce((
    select jsonb_agg(distinct jsonb_build_object('id', p.id, 'name', coalesce(p.first_name, p.email), 'status', p.status))
    from verification_signals mine
    join verification_signals other on other.ip = mine.ip and other.user_id <> mine.user_id
    join profiles p on p.id = other.user_id
    where mine.user_id = p_user and mine.ip is not null
  ), '[]'::jsonb) end;
$$;
grant execute on function public.staff_same_ip_accounts(uuid) to authenticated;

-- Face-match reason on each photo.
alter table public.photos add column if not exists match_reason text;

drop function if exists public.record_photo_match(text, uuid, text, numeric);
create or replace function public.record_photo_match(p_secret text, p_photo uuid, p_status text, p_similarity numeric, p_reason text default null) returns void
language plpgsql security definer set search_path = public, private as $$
declare uid uuid;
begin
  if p_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  update photos set match_status = p_status, match_similarity = p_similarity, match_reason = left(p_reason, 200) where id = p_photo returning user_id into uid;
  update profiles set photo_status = case
      when exists (select 1 from photos where user_id = uid and match_status = 'approved') then 'approved'
      when exists (select 1 from photos where user_id = uid and match_status = 'review') then 'review'
      else 'pending' end
    where id = uid;
  insert into verifications(user_id, kind, provider, provider_ref, status, detail) values (uid, 'photo', 'face-match', p_photo::text, p_status, coalesce(p_similarity::text, '') || coalesce(' · ' || p_reason, ''));
end $$;
grant execute on function public.record_photo_match(text, uuid, text, numeric, text) to anon;

-- Staff decisions with feedback.
create table if not exists public.verification_reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('id','photos')),
  decision text not null check (decision in ('approved','retry','note')),
  reason_code text,
  note text,
  member_message text,
  staff_email text not null,
  created_at timestamptz not null default now()
);
create index if not exists verification_reviews_user on public.verification_reviews(user_id, created_at desc);
alter table public.verification_reviews enable row level security;
drop policy if exists vrev_staff on public.verification_reviews;
create policy vrev_staff on public.verification_reviews for select using (public.is_staff());

create or replace function public.refresh_photo_status(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update profiles set photo_status = case
      when exists (select 1 from photos where user_id = p_user and match_status = 'approved') then 'approved'
      when exists (select 1 from photos where user_id = p_user and match_status = 'review') then 'review'
      when exists (select 1 from photos where user_id = p_user and match_status = 'rejected') then 'rejected'
      when exists (select 1 from photos where user_id = p_user) then 'pending'
      else 'none' end
  where id = p_user;
$$;
revoke all on function public.refresh_photo_status(uuid) from public, anon, authenticated;

create or replace function public.staff_verification_decide(p_user uuid, p_kind text, p_decision text, p_reason_code text, p_note text, p_member_message text)
returns void language plpgsql security definer set search_path = public as $$
declare who text := staff_email();
begin
  if who is null then raise exception 'staff only'; end if;
  if p_kind not in ('id','photos') or p_decision not in ('approved','retry','note') then raise exception 'bad decision'; end if;
  if p_kind = 'id' and p_decision = 'approved' then update profiles set id_status = 'approved' where id = p_user;
  elsif p_kind = 'id' and p_decision = 'retry' then update profiles set id_status = 'declined' where id = p_user;
  elsif p_kind = 'photos' and p_decision = 'approved' then
    update photos set match_status = 'approved' where user_id = p_user and match_status = 'review';
    perform refresh_photo_status(p_user);
  elsif p_kind = 'photos' and p_decision = 'retry' then
    update photos set match_status = 'rejected' where user_id = p_user and match_status = 'review';
    perform refresh_photo_status(p_user);
  end if;
  insert into verification_reviews(user_id, kind, decision, reason_code, note, member_message, staff_email)
  values (p_user, p_kind, p_decision, left(nullif(p_reason_code, ''), 40), left(nullif(trim(coalesce(p_note, '')), ''), 2000), left(nullif(trim(coalesce(p_member_message, '')), ''), 1000), who);
  insert into audit_log(staff_email, action, target_user, reason) values (who, 'verify_' || p_kind || '_' || p_decision, p_user, coalesce(p_reason_code, ''));
end $$;
grant execute on function public.staff_verification_decide(uuid, text, text, text, text, text) to authenticated;

create or replace function public.staff_set_photo(p_photo uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare who text := staff_email(); uid uuid;
begin
  if who is null then raise exception 'staff only'; end if;
  if p_status not in ('approved','rejected') then raise exception 'bad status'; end if;
  update photos set match_status = p_status where id = p_photo returning user_id into uid;
  if uid is null then raise exception 'photo not found'; end if;
  perform refresh_photo_status(uid);
  insert into audit_log(staff_email, action, target_user, reason) values (who, 'photo_' || p_status, uid, p_photo::text);
end $$;
grant execute on function public.staff_set_photo(uuid, text) to authenticated;

-- Members can't pre-fill match_reason on insert.
create or replace function public.photos_force_pending() returns trigger
language plpgsql as $$
begin
  new.match_status := 'pending';
  new.match_similarity := null;
  new.match_reason := null;
  return new;
end $$;
