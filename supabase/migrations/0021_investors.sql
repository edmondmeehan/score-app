-- 0021: Password-protected investor room (/investors).
-- The password is hashed in the app (scrypt) and only the hash and salt are stored here.
-- Investor content and the P&L assumptions live in a private table (not app_config, which is public).

create table if not exists public.investor_settings (
  id boolean primary key default true check (id),
  pw_hash text,
  pw_salt text,
  pw_set_at timestamptz,
  content jsonb not null default '{}',
  model jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
insert into public.investor_settings(id) values (true) on conflict do nothing;

create table if not exists public.investor_sessions (
  token_hash text primary key,
  label text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  last_seen_at timestamptz not null default now()
);

create table if not exists public.investor_access_log (
  id bigint generated always as identity primary key,
  label text,
  ip_hash text,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists investor_access_log_ip on public.investor_access_log(ip_hash, created_at);

alter table public.investor_settings enable row level security;
alter table public.investor_sessions enable row level security;
alter table public.investor_access_log enable row level security;
-- No policies: only the functions below can read or write these tables.

-- Salt is not secret; the app needs it to hash the password someone typed.
create or replace function public.investor_salt() returns text
language sql stable security definer set search_path = public as $$
  select pw_salt from investor_settings where id;
$$;

-- Check a hashed password. Max 8 failed tries per network per 15 minutes.
create or replace function public.investor_login(p_hash text, p_token_hash text, p_label text, p_ip_hash text) returns text
language plpgsql security definer set search_path = public as $$
declare s investor_settings; fails int;
begin
  select * into s from investor_settings where id;
  if s.pw_hash is null then return 'not_set'; end if;
  select count(*) into fails from investor_access_log
    where ip_hash = p_ip_hash and not ok and created_at > now() - interval '15 minutes';
  if fails >= 8 then return 'locked'; end if;
  if p_hash is distinct from s.pw_hash then
    insert into investor_access_log(label, ip_hash, ok) values (left(p_label, 80), p_ip_hash, false);
    return 'wrong';
  end if;
  insert into investor_access_log(label, ip_hash, ok) values (left(p_label, 80), p_ip_hash, true);
  insert into investor_sessions(token_hash, label) values (p_token_hash, left(p_label, 80));
  delete from investor_sessions where expires_at < now();
  return 'ok';
end $$;

-- Returns the investor room data for a valid session, or null.
create or replace function public.investor_room(p_token_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s investor_settings; sess investor_sessions; live jsonb;
begin
  select * into sess from investor_sessions where token_hash = p_token_hash and expires_at > now();
  if not found then return null; end if;
  update investor_sessions set last_seen_at = now() where token_hash = p_token_hash and last_seen_at < now() - interval '5 minutes';
  select * into s from investor_settings where id;
  select jsonb_build_object(
    'waitlist', (select count(*) from waitlist where email not ilike '%@seed.scoredate.test'),
    'waitlist_30d', (select count(*) from waitlist where email not ilike '%@seed.scoredate.test' and created_at > now() - interval '30 days'),
    'referred', (select count(*) from waitlist where email not ilike '%@seed.scoredate.test' and referral_code is not null),
    'founders', (select count(*) from waitlist where email not ilike '%@seed.scoredate.test' and founder),
    'by_area', coalesce((select jsonb_agg(jsonb_build_object('area', a, 'n', c) order by c desc) from (
        select coalesce(nullif(area, ''), 'Other') a, count(*) c from waitlist
        where email not ilike '%@seed.scoredate.test' group by 1) x), '[]'),
    'members', (select count(*) from profiles p join auth.users u on u.id = p.id
                where p.status = 'active' and u.email not ilike '%@seed.scoredate.test'),
    'as_of', now()
  ) into live;
  return jsonb_build_object('content', s.content, 'model', s.model, 'live', live, 'viewer', sess.label);
end $$;

create or replace function public.investor_logout(p_token_hash text) returns void
language sql security definer set search_path = public as $$
  delete from investor_sessions where token_hash = p_token_hash;
$$;

-- ---------- Staff (owners only) ----------
create or replace function public.staff_investor_settings() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s investor_settings;
begin
  if coalesce(staff_role(), '') <> 'owner' then raise exception 'Only owners can manage the investor room'; end if;
  select * into s from investor_settings where id;
  return jsonb_build_object(
    'password_set', s.pw_hash is not null, 'pw_set_at', s.pw_set_at, 'content', s.content, 'model', s.model,
    'sessions', (select count(*) from investor_sessions where expires_at > now()),
    'log', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select label, ok, created_at from investor_access_log order by created_at desc limit 50) x), '[]'));
end $$;

-- Setting a new password signs everyone out.
create or replace function public.staff_set_investor_password(p_hash text, p_salt text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(staff_role(), '') <> 'owner' then raise exception 'Only owners can manage the investor room'; end if;
  if p_hash is null or p_salt is null or length(p_hash) < 32 then raise exception 'Invalid password hash'; end if;
  update investor_settings set pw_hash = p_hash, pw_salt = p_salt, pw_set_at = now(), updated_at = now() where id;
  delete from investor_sessions;
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'investor_password_set', 'All investor sessions signed out');
end $$;

create or replace function public.staff_signout_investors() returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(staff_role(), '') <> 'owner' then raise exception 'Only owners can manage the investor room'; end if;
  delete from investor_sessions;
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'investor_signout_all', null);
end $$;

create or replace function public.staff_set_investor_data(p_content jsonb, p_model jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(staff_role(), '') <> 'owner' then raise exception 'Only owners can manage the investor room'; end if;
  if length(coalesce(p_content, '{}')::text) + length(coalesce(p_model, '{}')::text) > 60000 then raise exception 'Too long'; end if;
  update investor_settings set
    content = coalesce(p_content, content), model = coalesce(p_model, model), updated_at = now() where id;
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'investor_content_update',
    case when p_content is not null and p_model is not null then 'content + model' when p_model is not null then 'model' else 'content' end);
end $$;

revoke all on function public.investor_salt() from public;
revoke all on function public.investor_login(text, text, text, text) from public;
revoke all on function public.investor_room(text) from public;
revoke all on function public.investor_logout(text) from public;
revoke all on function public.staff_investor_settings() from public, anon;
revoke all on function public.staff_set_investor_password(text, text) from public, anon;
revoke all on function public.staff_signout_investors() from public, anon;
revoke all on function public.staff_set_investor_data(jsonb, jsonb) from public, anon;
grant execute on function public.investor_salt() to anon, authenticated;
grant execute on function public.investor_login(text, text, text, text) to anon, authenticated;
grant execute on function public.investor_room(text) to anon, authenticated;
grant execute on function public.investor_logout(text) to anon, authenticated;
grant execute on function public.staff_investor_settings() to authenticated;
grant execute on function public.staff_set_investor_password(text, text) to authenticated;
grant execute on function public.staff_signout_investors() to authenticated;
grant execute on function public.staff_set_investor_data(jsonb, jsonb) to authenticated;
