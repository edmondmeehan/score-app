-- 0054: Count app opens for staff accounts too, so admins can see their own usage on their member page.
-- Staff are still left out of the live "Right now" count in Analytics.
create or replace function public.live_ping(p_session text, p_app boolean, p_path text, p_city text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_session is null or p_session !~ '^[A-Za-z0-9_-]{8,64}$' then return; end if;
  if auth.uid() is not null then
    insert into member_sessions(session_id, user_id, is_app) values (p_session, auth.uid(), coalesce(p_app, false))
    on conflict (session_id) do update set last_seen = now();
  end if;
  if auth.uid() is not null and public.is_staff() then return; end if;
  insert into live_sessions(session_id, user_id, is_app, path, city)
  values (p_session, auth.uid(), coalesce(p_app, false), left(p_path, 200), left(p_city, 80))
  on conflict (session_id) do update set last_seen = now(), user_id = coalesce(excluded.user_id, live_sessions.user_id),
    is_app = excluded.is_app, path = excluded.path, city = coalesce(excluded.city, live_sessions.city);
  if random() < 0.01 then
    delete from live_sessions where last_seen < now() - interval '1 day';
    delete from member_sessions where started_at < now() - interval '180 days';
  end if;
end $$;
grant execute on function public.live_ping(text, boolean, text, text) to anon, authenticated;
