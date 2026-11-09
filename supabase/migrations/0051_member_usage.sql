-- 0051: How often each member opens and uses ScoreDate (app and web), kept for 180 days.
-- Built on the existing once-a-minute heartbeat (live_ping): each app launch or browser visit is one session.
-- No IP address or location is stored here; staff are skipped.

create table if not exists public.member_sessions (
  session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_app boolean not null default false,
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists member_sessions_user on public.member_sessions (user_id, started_at desc);
alter table public.member_sessions enable row level security;
drop policy if exists member_sessions_staff on public.member_sessions;
create policy member_sessions_staff on public.member_sessions for select using (public.is_staff());

create or replace function public.live_ping(p_session text, p_app boolean, p_path text, p_city text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_session is null or p_session !~ '^[A-Za-z0-9_-]{8,64}$' then return; end if;
  if auth.uid() is not null and public.is_staff() then return; end if;
  insert into live_sessions(session_id, user_id, is_app, path, city)
  values (p_session, auth.uid(), coalesce(p_app, false), left(p_path, 200), left(p_city, 80))
  on conflict (session_id) do update set last_seen = now(), user_id = coalesce(excluded.user_id, live_sessions.user_id),
    is_app = excluded.is_app, path = excluded.path, city = coalesce(excluded.city, live_sessions.city);
  if auth.uid() is not null then
    insert into member_sessions(session_id, user_id, is_app) values (p_session, auth.uid(), coalesce(p_app, false))
    on conflict (session_id) do update set last_seen = now();
  end if;
  if random() < 0.01 then
    delete from live_sessions where last_seen < now() - interval '1 day';
    delete from member_sessions where started_at < now() - interval '180 days';
  end if;
end $$;
grant execute on function public.live_ping(text, boolean, text, text) to anon, authenticated;

create or replace function public.staff_member_usage(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare out jsonb;
begin
  if staff_role() is null then raise exception 'Staff only'; end if;
  with s as (
    select *, greatest(60, extract(epoch from last_seen - started_at)) secs,
           (started_at at time zone 'America/New_York')::date d
    from member_sessions where user_id = p_user and started_at > now() - interval '180 days'
  )
  select jsonb_build_object(
    'opens_7d', (select count(*) from s where started_at > now() - interval '7 days'),
    'opens_30d', (select count(*) from s where started_at > now() - interval '30 days'),
    'app_opens_30d', (select count(*) from s where is_app and started_at > now() - interval '30 days'),
    'days_active_30d', (select count(distinct d) from s where started_at > now() - interval '30 days'),
    'minutes_30d', (select round(coalesce(sum(secs), 0) / 60) from s where started_at > now() - interval '30 days'),
    'avg_minutes', (select round(coalesce(avg(secs), 0) / 60, 1) from s where started_at > now() - interval '30 days'),
    'last_open', (select max(started_at) from s),
    'first_tracked', (select min(started_at) from s),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('d', x.d::date, 'n', coalesce(c.n, 0)) order by x.d)
       from generate_series((now() at time zone 'America/New_York')::date - 29, (now() at time zone 'America/New_York')::date, interval '1 day') as x(d)
       left join (select d, count(*) n from s group by d) c on c.d = x.d::date), '[]'::jsonb)
  ) into out;
  return out;
end $$;
revoke all on function public.staff_member_usage(uuid) from public, anon;
grant execute on function public.staff_member_usage(uuid) to authenticated;
