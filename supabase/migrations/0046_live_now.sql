-- 0046: "Right now" on Admin → Analytics. Every open page sends a tiny heartbeat about once a minute while visible.
-- One row per browser session (no IP stored); staff are skipped; rows older than a day are cleaned up.

create table if not exists public.live_sessions (
  session_id text primary key check (length(session_id) between 8 and 64),
  user_id uuid references auth.users(id) on delete cascade,
  is_app boolean not null default false,
  path text check (length(path) <= 200),
  city text check (length(city) <= 80),
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists live_sessions_seen on public.live_sessions(last_seen desc);
alter table public.live_sessions enable row level security;
drop policy if exists live_staff on public.live_sessions;
create policy live_staff on public.live_sessions for select using (public.is_staff());

create or replace function public.live_ping(p_session text, p_app boolean, p_path text, p_city text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_session is null or p_session !~ '^[A-Za-z0-9_-]{8,64}$' then return; end if;
  if auth.uid() is not null and public.is_staff() then return; end if;
  insert into live_sessions(session_id, user_id, is_app, path, city)
  values (p_session, auth.uid(), coalesce(p_app, false), left(p_path, 200), left(p_city, 80))
  on conflict (session_id) do update set last_seen = now(), user_id = coalesce(excluded.user_id, live_sessions.user_id),
    is_app = excluded.is_app, path = excluded.path, city = coalesce(excluded.city, live_sessions.city);
  if random() < 0.01 then delete from live_sessions where last_seen < now() - interval '1 day'; end if;
end $$;
grant execute on function public.live_ping(text, boolean, text, text) to anon, authenticated;

create or replace function public.staff_live_now() returns jsonb
language sql stable security definer set search_path = public as $$
  with live as (select * from live_sessions where last_seen > now() - interval '2 minutes')
  select case when not public.is_staff() then null else jsonb_build_object(
    'total', (select count(*) from live),
    'members', (select count(distinct user_id) from live where user_id is not null),
    'visitors', (select count(*) from live where user_id is null),
    'app', (select count(*) from live where is_app),
    'web', (select count(*) from live where not is_app),
    'today', (select count(distinct coalesce(user_id::text, session_id)) from live_sessions where last_seen > date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York'),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc) from (
        select case when path ~ '^/app/messages/' then '/app/messages/…' when path ~ '^/app/u/' then '/app/u/…' when path ~ '^/app/events/' then '/app/events/…' else path end k, count(*) n
        from live group by 1 order by 2 desc limit 6) p), '[]'),
    'cities', coalesce((select jsonb_agg(jsonb_build_object('k', city, 'n', n) order by n desc) from (
        select city, count(*) n from live where city is not null group by city order by 2 desc limit 5) c), '[]'),
    'at', now()) end;
$$;
grant execute on function public.staff_live_now() to authenticated;

notify pgrst, 'reload schema';
