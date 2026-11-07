-- Score: initial schema
-- Principles: exact credit scores are never stored; ID images live only with the ID vendor;
-- sensitive fields (band, status, plan) are written only through security-definer functions.

create extension if not exists pgcrypto;

-- ---------- Config ----------
create table public.app_config (
  key text primary key,
  value jsonb not null
);
insert into public.app_config(key, value) values
  ('test_mode', 'true'),
  ('invites_per_member', '3'),
  ('invites_per_founder', '5'),
  ('invite_days_valid', '7'),
  ('preview_days', '30'),
  ('min_age', '25'),
  ('reverify_months', '6');

-- Secret used by the verification webhook; never readable by clients.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.private_secrets (key text primary key, value text not null);
insert into private.private_secrets(key, value) values ('webhook_secret', encode(gen_random_bytes(24), 'hex'));

-- ---------- Staff ----------
create table public.staff (
  email text primary key,
  role text not null check (role in ('owner','moderator','verification','community')),
  created_at timestamptz not null default now()
);
insert into public.staff(email, role) values ('eddie@please.co', 'owner');

-- ---------- Profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  birth_year int,
  gender text check (gender in ('woman','man','nonbinary')),
  seeking text[] default '{}',
  job text,
  neighborhood text,
  city text default 'New York',
  prompt_q text default 'Best purchase I ever made…',
  prompt_a text,
  money_values text[] default '{}',
  -- written only by functions:
  band text check (band in ('elite','strong','solid','building')),
  trend text check (trend in ('up','steady','down')),
  credit_verified_at timestamptz,
  id_status text not null default 'none' check (id_status in ('none','pending','approved','declined','review')),
  photo_status text not null default 'none' check (photo_status in ('none','pending','approved','review','rejected')),
  status text not null default 'onboarding' check (status in ('onboarding','preview','active','paused','taken','suspended','removed')),
  plan text not null default 'none' check (plan in ('none','preview','membership','premium','black','paused')),
  preview_ends_at timestamptz,
  is_founder boolean not null default false,
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email) values (new.id, new.email) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_staff(min_role text default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from staff s join auth.users u on lower(u.email) = lower(s.email)
                where u.id = auth.uid());
$$;

create or replace function public.staff_email() returns text
language sql stable security definer set search_path = public as $$
  select s.email from staff s join auth.users u on lower(u.email)=lower(s.email) where u.id = auth.uid();
$$;

create or replace function public.my_status() returns text
language sql stable security definer set search_path = public as $$
  select status from profiles where id = auth.uid();
$$;

-- ---------- Photos ----------
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  path text not null,
  position int not null default 0,
  match_status text not null default 'pending' check (match_status in ('pending','approved','review','rejected')),
  match_similarity numeric,
  created_at timestamptz not null default now()
);

-- ---------- Waitlist & invites ----------
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  email text not null unique,
  city text,
  job text,
  referral_code text,
  status text not null default 'waiting' check (status in ('waiting','invited','joined')),
  created_at timestamptz not null default now()
);

create table public.invites (
  code text primary key,
  inviter_id uuid references public.profiles(id) on delete set null,
  kind text not null default 'date' check (kind in ('date','friend','drop','founder')),
  expires_at timestamptz not null,
  redeemed_by uuid references public.profiles(id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Matching & messaging ----------
create table public.drops (
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.profiles(id) on delete cascade,
  drop_date date not null default current_date,
  compat int not null,
  primary key (user_id, match_id, drop_date)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ---------- Safety & compliance ----------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  reported_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  note text,
  status text not null default 'open' check (status in ('open','dismissed','warned','suspended','removed')),
  resolved_by text,
  created_at timestamptz not null default now()
);

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('id','credit','photo')),
  provider text not null,
  provider_ref text,
  status text not null,
  detail text,
  created_at timestamptz not null default now()
);

create table public.biometric_consents (
  user_id uuid not null references public.profiles(id) on delete cascade,
  consented_at timestamptz not null default now(),
  policy_version text not null,
  primary key (user_id, policy_version)
);

create table public.deletion_requests (
  user_id uuid primary key,
  email text,
  requested_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','done')),
  hold_reason text
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  staff_email text not null,
  action text not null,
  target_user uuid,
  reason text,
  created_at timestamptz not null default now()
);

-- ---------- Row level security ----------
alter table public.app_config enable row level security;
alter table public.staff enable row level security;
alter table public.profiles enable row level security;
alter table public.photos enable row level security;
alter table public.waitlist enable row level security;
alter table public.invites enable row level security;
alter table public.drops enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.verifications enable row level security;
alter table public.biometric_consents enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.audit_log enable row level security;

create policy cfg_read on public.app_config for select using (true);
create policy staff_read on public.staff for select using (public.is_staff());

-- Profiles: members see themselves, visible members, and staff see all.
create policy prof_self on public.profiles for select using (id = auth.uid());
create policy prof_visible on public.profiles for select to authenticated
  using (status in ('active','preview') and public.my_status() in ('active','preview','paused','taken'));
create policy prof_staff on public.profiles for select using (public.is_staff());
create policy prof_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (first_name, birth_year, gender, seeking, job, neighborhood, prompt_q, prompt_a, money_values) on public.profiles to authenticated;

create policy photos_own on public.photos for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy photos_read on public.photos for select to authenticated using (match_status = 'approved');
create policy photos_staff on public.photos for select using (public.is_staff());
revoke update on public.photos from authenticated;
grant update (position) on public.photos to authenticated;

create policy wait_insert on public.waitlist for insert to anon, authenticated with check (true);
create policy wait_staff on public.waitlist for select using (public.is_staff());

create policy inv_own on public.invites for select using (inviter_id = auth.uid() or redeemed_by = auth.uid() or public.is_staff());

create policy drops_own on public.drops for select using (user_id = auth.uid());

create policy conv_member on public.conversations for select using (auth.uid() in (user_a, user_b) or public.is_staff());
create policy msg_read on public.messages for select using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)));
create policy msg_send on public.messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b))
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.plan in ('membership','premium','black','paused'))
  and not exists (select 1 from public.blocks b join public.conversations c on c.id = conversation_id
                  where (b.blocker_id = c.user_a and b.blocked_id = c.user_b) or (b.blocker_id = c.user_b and b.blocked_id = c.user_a)));

create policy blocks_own on public.blocks for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create policy rep_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy rep_staff on public.reports for select using (public.is_staff());

create policy ver_own on public.verifications for select using (user_id = auth.uid() or public.is_staff());
create policy consent_own on public.biometric_consents for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy del_staff on public.deletion_requests for select using (public.is_staff());
create policy audit_staff on public.audit_log for select using (public.is_staff());

-- ---------- Functions (the only way to change sensitive state) ----------
create or replace function public.test_mode() returns boolean language sql stable as $$
  select coalesce((select value::text::boolean from public.app_config where key = 'test_mode'), false);
$$;

-- Redeem an invite code for the signed-in user.
create or replace function public.redeem_invite(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare inv invites; me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null then raise exception 'not signed in'; end if;
  select * into inv from invites where code = upper(trim(p_code)) for update;
  if inv.code is null then return 'invalid'; end if;
  if inv.redeemed_by is not null and inv.redeemed_by <> me.id then return 'used'; end if;
  if inv.expires_at < now() then return 'expired'; end if;
  update invites set redeemed_by = me.id, redeemed_at = now() where code = inv.code;
  update profiles set invited_by = coalesce(invited_by, inv.inviter_id), is_founder = is_founder or inv.kind = 'founder' where id = me.id;
  return 'ok';
end $$;

-- Create an invite for the signed-in member, within their allowance.
create or replace function public.create_invite(p_kind text default 'date') returns text
language plpgsql security definer set search_path = public as $$
declare me profiles; used int; allowance int; new_code text;
begin
  select * into me from profiles where id = auth.uid();
  if me.plan not in ('membership','premium','black') then raise exception 'members only'; end if;
  allowance := (select (value::text)::int from app_config where key = case when me.is_founder then 'invites_per_founder' else 'invites_per_member' end);
  select count(*) into used from invites where inviter_id = me.id;
  if used >= allowance then raise exception 'no invites left'; end if;
  new_code := 'SCR-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,4)) || '-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,3));
  insert into invites(code, inviter_id, kind, expires_at)
    values (new_code, me.id, case when p_kind = 'friend' then 'friend' else 'date' end,
            now() + make_interval(days => (select (value::text)::int from app_config where key='invite_days_valid')));
  return new_code;
end $$;

-- Record biometric consent before any face check.
create or replace function public.give_biometric_consent(p_version text) returns void
language sql security definer set search_path = public as $$
  insert into biometric_consents(user_id, policy_version) values (auth.uid(), p_version) on conflict do nothing;
$$;

-- Start ID verification (marks pending).
create or replace function public.start_id_verification(p_provider text, p_ref text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from biometric_consents where user_id = auth.uid()) then raise exception 'consent required'; end if;
  update profiles set id_status = 'pending' where id = auth.uid();
  insert into verifications(user_id, kind, provider, provider_ref, status) values (auth.uid(), 'id', p_provider, p_ref, 'pending');
end $$;

-- Called by the server after confirming a result with the ID vendor (secret-protected).
create or replace function public.record_id_result(p_secret text, p_user uuid, p_provider text, p_ref text, p_status text, p_detail text default null) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if p_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  if p_status not in ('approved','declined','review','pending') then raise exception 'bad status'; end if;
  update profiles set id_status = p_status where id = p_user;
  insert into verifications(user_id, kind, provider, provider_ref, status, detail) values (p_user, 'id', p_provider, p_ref, p_status, p_detail);
end $$;

-- Test-mode ID approval (only works while test_mode is on).
create or replace function public.test_approve_id() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not test_mode() then raise exception 'test mode is off'; end if;
  if not exists (select 1 from biometric_consents where user_id = auth.uid()) then raise exception 'consent required'; end if;
  update profiles set id_status = 'approved' where id = auth.uid();
  insert into verifications(user_id, kind, provider, status, detail) values (auth.uid(), 'id', 'test', 'approved', 'test mode');
end $$;

-- Credit band: in production this is written by the credit partner integration (secret-protected).
create or replace function public.record_credit_result(p_secret text, p_user uuid, p_band text, p_trend text) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if p_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  update profiles set band = p_band, trend = p_trend, credit_verified_at = now() where id = p_user;
  insert into verifications(user_id, kind, provider, status, detail) values (p_user, 'credit', 'partner', 'approved', p_band);
end $$;

create or replace function public.test_set_band(p_band text, p_trend text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not test_mode() then raise exception 'test mode is off'; end if;
  update profiles set band = p_band, trend = p_trend, credit_verified_at = now() where id = auth.uid();
  insert into verifications(user_id, kind, provider, status, detail) values (auth.uid(), 'credit', 'test', 'approved', p_band);
end $$;

-- Profile photo face-match result (server, secret-protected).
create or replace function public.record_photo_match(p_secret text, p_photo uuid, p_status text, p_similarity numeric) returns void
language plpgsql security definer set search_path = public, private as $$
declare uid uuid;
begin
  if p_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  update photos set match_status = p_status, match_similarity = p_similarity where id = p_photo returning user_id into uid;
  update profiles set photo_status = case
      when exists (select 1 from photos where user_id = uid and match_status = 'approved') then 'approved'
      when exists (select 1 from photos where user_id = uid and match_status = 'review') then 'review'
      else 'pending' end
    where id = uid;
  insert into verifications(user_id, kind, provider, provider_ref, status, detail) values (uid, 'photo', 'face-match', p_photo::text, p_status, coalesce(p_similarity::text, ''));
end $$;

-- Choose a plan. Web MVP: payments are in test mode; native app will use App Store / Google Play billing.
create or replace function public.choose_plan(p_plan text) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if me.id_status <> 'approved' or me.band is null then raise exception 'finish verification first'; end if;
  if p_plan = 'preview' then
    update profiles set plan = 'preview', status = 'preview',
      preview_ends_at = now() + make_interval(days => (select (value::text)::int from app_config where key='preview_days'))
      where id = me.id;
  elsif p_plan in ('membership','premium','black') then
    if not test_mode() then raise exception 'payments not connected yet'; end if;
    update profiles set plan = p_plan, status = 'active' where id = me.id;
  elsif p_plan = 'paused' then
    update profiles set plan = 'paused', status = 'paused' where id = me.id;
  elsif p_plan = 'taken' then
    update profiles set plan = 'paused', status = 'taken' where id = me.id;
  else raise exception 'unknown plan'; end if;
end $$;

-- Daily Drop: up to 5 (10 for premium/black) compatible members, cached per day.
create or replace function public.get_drop() returns setof public.drops
language plpgsql security definer set search_path = public as $$
declare me profiles; n int;
begin
  select * into me from profiles where id = auth.uid();
  if me.status not in ('active','preview') then return; end if;
  if not exists (select 1 from drops where user_id = me.id and drop_date = current_date) then
    n := case when me.plan in ('premium','black') then 10 else 5 end;
    insert into drops(user_id, match_id, compat)
    select me.id, p.id,
      least(99, 40
        + coalesce(10 * cardinality(array(select unnest(p.money_values) intersect select unnest(me.money_values))), 0)
        + case when p.band = me.band then 20 when p.band is null or me.band is null then 0 else 10 end
        + case when p.trend = 'up' then 5 else 0 end)
    from profiles p
    where p.id <> me.id and p.status in ('active','preview') and p.band is not null and p.id_status = 'approved'
      and (cardinality(me.seeking) = 0 or p.gender = any(me.seeking))
      and (cardinality(p.seeking) = 0 or me.gender = any(p.seeking))
      and not exists (select 1 from blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
      and not exists (select 1 from drops d where d.user_id = me.id and d.match_id = p.id and d.drop_date > current_date - 30)
    order by 3 desc, random()
    limit n
    on conflict do nothing;
  end if;
  return query select * from drops where user_id = me.id and drop_date = current_date order by compat desc;
end $$;

-- Start (or reuse) a conversation. Paying members only; Preview can view but not connect.
create or replace function public.start_conversation(p_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me profiles; a uuid; b uuid; cid uuid;
begin
  select * into me from profiles where id = auth.uid();
  if me.plan not in ('membership','premium','black') then raise exception 'upgrade to connect'; end if;
  if exists (select 1 from blocks bl where (bl.blocker_id = me.id and bl.blocked_id = p_other) or (bl.blocker_id = p_other and bl.blocked_id = me.id)) then raise exception 'unavailable'; end if;
  a := least(me.id, p_other); b := greatest(me.id, p_other);
  insert into conversations(user_a, user_b) values (a, b) on conflict (user_a, user_b) do nothing;
  select id into cid from conversations where user_a = a and user_b = b;
  return cid;
end $$;

create or replace function public.request_deletion() returns void
language plpgsql security definer set search_path = public as $$
declare holds text := null;
begin
  if exists (select 1 from reports where reported_id = auth.uid() and status = 'open') then holds := 'open report'; end if;
  insert into deletion_requests(user_id, email, hold_reason)
    select id, email, holds from profiles where id = auth.uid()
    on conflict (user_id) do update set requested_at = now(), status = 'open', hold_reason = excluded.hold_reason;
  if holds is null then
    delete from auth.users where id = auth.uid();
    update deletion_requests set status = 'done' where user_id = auth.uid();
  end if;
end $$;

-- Staff actions (logged).
create or replace function public.staff_act(p_action text, p_user uuid, p_reason text, p_report uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare who text := staff_email();
begin
  if who is null then raise exception 'staff only'; end if;
  if p_action = 'suspend' then update profiles set status = 'suspended' where id = p_user;
  elsif p_action = 'remove' then
    update profiles set status = 'removed' where id = p_user;
    -- inviter accountability is enforced in app logic (90-day invite pause)
  elsif p_action = 'reinstate' then update profiles set status = case when plan = 'preview' then 'preview' else 'active' end where id = p_user;
  elsif p_action = 'approve_id' then update profiles set id_status = 'approved' where id = p_user;
  elsif p_action = 'decline_id' then update profiles set id_status = 'declined' where id = p_user;
  elsif p_action = 'approve_photos' then
    update photos set match_status = 'approved' where user_id = p_user and match_status = 'review';
    update profiles set photo_status = 'approved' where id = p_user;
  elsif p_action = 'reject_photos' then
    update photos set match_status = 'rejected' where user_id = p_user and match_status = 'review';
  elsif p_action in ('warn','dismiss','view') then null;
  else raise exception 'unknown action'; end if;
  if p_report is not null then
    update reports set status = case p_action when 'dismiss' then 'dismissed' when 'warn' then 'warned' when 'suspend' then 'suspended' when 'remove' then 'removed' else status end,
      resolved_by = who where id = p_report;
  end if;
  insert into audit_log(staff_email, action, target_user, reason) values (who, p_action, p_user, p_reason);
end $$;

create or replace function public.staff_create_invites(p_count int, p_kind text default 'drop') returns setof text
language plpgsql security definer set search_path = public as $$
declare i int; c text; who text := staff_email();
begin
  if who is null then raise exception 'staff only'; end if;
  for i in 1..least(p_count, 500) loop
    c := 'SCR-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,4)) || '-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,3));
    insert into invites(code, inviter_id, kind, expires_at) values (c, null, case when p_kind='founder' then 'founder' else 'drop' end, now() + interval '14 days');
    return next c;
  end loop;
  insert into audit_log(staff_email, action, reason) values (who, 'create_invites', p_count || ' ' || p_kind);
end $$;

-- ---------- Storage: private profile photos ----------
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict do nothing;
create policy "photos upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos read members" on storage.objects for select to authenticated
  using (bucket_id = 'photos');

-- Realtime for chat
alter publication supabase_realtime add table public.messages;

-- Function grants: signed-in users only (each function checks auth.uid()),
-- except the secret-protected server callbacks, which the vendor webhooks reach without a user session.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.test_mode() to anon;
grant execute on function public.record_id_result(text, uuid, text, text, text, text) to anon;
grant execute on function public.record_credit_result(text, uuid, text, text) to anon;
grant execute on function public.record_photo_match(text, uuid, text, numeric) to anon;
