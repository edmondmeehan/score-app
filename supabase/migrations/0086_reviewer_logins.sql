-- 0086: Know when App Review is looking. Every sign-in to a reviewer account (review@scoredate.app) is logged with its
-- approximate location and device, flagged when it looks like Apple (Apple's network, or Cupertino / San Jose and nearby),
-- and every owner gets a notification (push + email). Admin → App Review lists them. Safe to re-run.

create table if not exists public.reviewer_logins (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  at timestamptz not null default now(),
  ip text, city text, region text, country text, ua text,
  apple boolean not null default false
);
create index if not exists reviewer_logins_at on public.reviewer_logins(at desc);
alter table public.reviewer_logins enable row level security;
drop policy if exists reviewer_logins_staff on public.reviewer_logins;
create policy reviewer_logins_staff on public.reviewer_logins for select using (public.is_staff());

-- Server only (called right after a successful sign-in). Does nothing for normal members.
create or replace function public.reviewer_log_login(p_secret text, p_user uuid, p_ip text, p_city text, p_region text, p_country text, p_ua text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare looks_apple boolean; place text; o record; ids uuid[] := '{}';
begin
  perform check_server_secret(p_secret);
  if p_user is null or not public.is_reviewer(p_user) then return jsonb_build_object('reviewer', false); end if;
  looks_apple := coalesce(p_ip like '17.%', false)
    or lower(coalesce(p_city, '')) in ('cupertino', 'san jose', 'sunnyvale', 'santa clara', 'mountain view', 'palo alto', 'milpitas', 'campbell', 'los gatos');
  insert into reviewer_logins(user_id, ip, city, region, country, ua, apple)
  values (p_user, left(p_ip, 64), left(p_city, 80), left(p_region, 16), left(p_country, 8), left(p_ua, 300), looks_apple);
  place := coalesce(nullif(concat_ws(', ', p_city, p_region), ''), p_country, 'an unknown location');
  for o in select p.id from staff s join auth.users u on lower(u.email) = lower(s.email) join profiles p on p.id = u.id where s.role = 'owner' loop
    perform notify(o.id, null, 'app_review_login', 'milestone',
      case when looks_apple then 'Apple is reviewing ScoreDate' else 'Someone signed in as the App Review account' end,
      'review@scoredate.app signed in from ' || place || case when looks_apple then ' (looks like Apple).' else '.' end,
      '/admin/review', 'reviewlogin:' || to_char(now(), 'YYYYMMDDHH24MI'), true);
    ids := ids || o.id;
  end loop;
  return jsonb_build_object('reviewer', true, 'apple', looks_apple, 'owners', to_jsonb(ids));
end $$;
revoke all on function public.reviewer_log_login(text, uuid, text, text, text, text, text) from public, authenticated;
grant execute on function public.reviewer_log_login(text, uuid, text, text, text, text, text) to anon;

-- Admin → App Review: the account's state at a glance.
create or replace function public.staff_reviewer_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r profiles;
begin
  if not is_staff() then raise exception 'staff only'; end if;
  select p.* into r from profiles p where public.is_reviewer(p.id) limit 1;
  if r.id is null then return jsonb_build_object('exists', false); end if;
  return jsonb_build_object(
    'exists', true, 'first_name', r.first_name, 'status', r.status, 'plan', r.plan, 'id_status', r.id_status, 'is_demo', r.is_demo,
    'drop_today', (select count(*) from drops where user_id = r.id and drop_date = current_date),
    'liked_by', (select count(*) from likes l where l.liked = r.id and not exists (select 1 from likes x where x.liker = r.id and x.liked = l.liker)),
    'chats', (select count(*) from conversations c where r.id in (c.user_a, c.user_b) and c.ended_at is null),
    'last_active', r.last_active_at,
    'logins_30d', (select count(*) from reviewer_logins where at > now() - interval '30 days'),
    'apple_30d', (select count(*) from reviewer_logins where apple and at > now() - interval '30 days'));
end $$;
grant execute on function public.staff_reviewer_status() to authenticated;
