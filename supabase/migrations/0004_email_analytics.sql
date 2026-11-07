-- Email log (Resend), server-only contact lookup, staff invite-by-email, and first-party analytics.

-- ---------- Email ----------
create table public.email_log (
  id bigint generated always as identity primary key,
  to_email text not null,
  template text not null,
  ok boolean not null,
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);
alter table public.email_log enable row level security;
create policy email_log_staff on public.email_log for select using (public.is_staff());

create or replace function public.log_email(p_secret text, p_to text, p_template text, p_ok boolean, p_provider_id text, p_error text) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if p_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  insert into email_log(to_email, template, ok, provider_id, error) values (lower(p_to), p_template, p_ok, p_provider_id, left(p_error, 300));
end $$;

create or replace function public.get_user_contact(p_secret text, p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, private as $$
begin
  if p_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  return (select jsonb_build_object('email', coalesce(p.email, u.email), 'first_name', p.first_name)
          from auth.users u left join profiles p on p.id = u.id where u.id = p_user);
end $$;

-- Staff: create one invite for a waitlist person, mark them invited, return the code + their details.
create or replace function public.staff_invite_waitlist(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare who text := staff_email(); w waitlist; c text;
begin
  if who is null then raise exception 'staff only'; end if;
  select * into w from waitlist where id = p_id;
  if w.id is null then raise exception 'not found'; end if;
  c := 'SCR-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,4)) || '-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,3));
  insert into invites(code, inviter_id, kind, expires_at) values (c, null, 'drop', now() + interval '14 days');
  update waitlist set status = 'invited' where id = p_id;
  insert into audit_log(staff_email, action, reason) values (who, 'invite_waitlist', w.email);
  return jsonb_build_object('code', c, 'email', w.email, 'first_name', w.first_name, 'days', 14);
end $$;

-- ---------- Analytics ----------
create table public.analytics_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  name text not null default 'pageview',
  visitor_id text,
  session_id text,
  new_session boolean not null default false,
  user_id uuid references auth.users(id) on delete set null,
  path text,
  source text,
  medium text,
  campaign text,
  referrer_host text,
  device text,
  os text,
  browser text,
  country text,
  region text,
  city text
);
create index analytics_events_at on public.analytics_events (at desc);
create index analytics_events_user on public.analytics_events (user_id, at desc) where user_id is not null;
alter table public.analytics_events enable row level security;
create policy analytics_staff on public.analytics_events for select using (public.is_staff());

create or replace function public.track_event(p_secret text, p jsonb) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if p_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  insert into analytics_events(name, visitor_id, session_id, new_session, user_id, path, source, medium, campaign, referrer_host, device, os, browser, country, region, city)
  values (coalesce(p->>'name', 'pageview'), left(p->>'visitor_id', 64), left(p->>'session_id', 64), coalesce((p->>'new_session')::boolean, false),
          nullif(p->>'user_id', '')::uuid, left(p->>'path', 300), left(p->>'source', 80), left(p->>'medium', 80), left(p->>'campaign', 120),
          left(p->>'referrer_host', 200), left(p->>'device', 20), left(p->>'os', 40), left(p->>'browser', 40),
          left(p->>'country', 4), left(p->>'region', 40), left(p->>'city', 80));
end $$;

-- Staff dashboard numbers for the last p_days days.
create or replace function public.staff_analytics(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365))); out jsonb;
begin
  if not is_staff() then raise exception 'staff only'; end if;
  with e as (select * from analytics_events where at >= since and (path is null or path not like '/admin%')),
       pv as (select * from e where name = 'pageview')
  select jsonb_build_object(
    'visitors', (select count(distinct visitor_id) from pv),
    'sessions', (select count(distinct session_id) from pv),
    'pageviews', (select count(*) from pv),
    'members_active', (select count(distinct user_id) from e where user_id is not null),
    'members_today', (select count(distinct user_id) from e where user_id is not null and at >= now() - interval '1 day'),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'visitors', v, 'pageviews', n) order by d)
       from (select date_trunc('day', at)::date d, count(distinct visitor_id) v, count(*) n from pv group by 1) x), '[]'),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
       from (select coalesce(source, 'Direct') k, count(*) n from pv where new_session group by 1 order by 2 desc limit 12) x), '[]'),
    'campaigns', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
       from (select campaign k, count(*) n from pv where new_session and campaign is not null group by 1 order by 2 desc limit 10) x), '[]'),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
       from (select path k, count(*) n from pv group by 1 order by 2 desc limit 12) x), '[]'),
    'os', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
       from (select coalesce(os, 'Other') k, count(distinct visitor_id) n from pv group by 1 order by 2 desc limit 8) x), '[]'),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
       from (select coalesce(device, 'Other') k, count(distinct visitor_id) n from pv group by 1 order by 2 desc) x), '[]'),
    'browsers', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
       from (select coalesce(browser, 'Other') k, count(distinct visitor_id) n from pv group by 1 order by 2 desc limit 8) x), '[]'),
    'cities', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
       from (select coalesce(city || ', ' || region, country, 'Unknown') k, count(distinct visitor_id) n from pv group by 1 order by 2 desc limit 10) x), '[]'),
    'events', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
       from (select name k, count(*) n from e where name <> 'pageview' group by 1) x), '[]'),
    'most_active', coalesce((select jsonb_agg(row_to_json(x) order by x.views desc)
       from (select p.id, p.first_name, p.band, p.borough, p.status, count(e.id) views, max(e.at) last_seen,
                    (select count(*) from messages m where m.sender_id = p.id and m.created_at >= since) messages
             from e join profiles p on p.id = e.user_id group by p.id order by count(e.id) desc limit 10) x), '[]'),
    'funnel', jsonb_build_object(
       'waitlist', (select count(*) from waitlist where created_at >= since),
       'notify', (select count(*) from area_notify where created_at >= since),
       'invites_redeemed', (select count(*) from invites where redeemed_at >= since),
       'basics_done', (select count(*) from profiles where created_at >= since and zip is not null),
       'id_verified', (select count(*) from profiles where created_at >= since and id_status = 'approved'),
       'band_verified', (select count(*) from profiles where created_at >= since and band is not null),
       'paying', (select count(*) from profiles where created_at >= since and plan in ('membership','premium','black')))
  ) into out;
  return out;
end $$;

-- ---------- Grants ----------
revoke execute on function public.log_email(text, text, text, boolean, text, text) from public;
revoke execute on function public.get_user_contact(text, uuid) from public;
revoke execute on function public.track_event(text, jsonb) from public;
revoke execute on function public.staff_invite_waitlist(uuid) from public, anon;
revoke execute on function public.staff_analytics(int) from public, anon;
grant execute on function public.log_email(text, text, text, boolean, text, text) to anon, authenticated;
grant execute on function public.get_user_contact(text, uuid) to anon, authenticated;
grant execute on function public.track_event(text, jsonb) to anon, authenticated;
grant execute on function public.staff_invite_waitlist(uuid) to authenticated;
grant execute on function public.staff_analytics(int) to authenticated;
