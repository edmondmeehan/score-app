-- 0024: Daily admin report emails. Each staff member opts in and picks sections in Admin → Daily report.

create table if not exists public.staff_report_prefs (
  email text primary key,
  daily boolean not null default false,
  sections text[] not null default array['finance','members','waitlist','engagement','safety'],
  last_sent_on date,
  updated_at timestamptz not null default now()
);
alter table public.staff_report_prefs enable row level security;
-- No policies: read and write through the functions below.

create or replace function public.my_report_prefs() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r staff_report_prefs;
begin
  if not is_staff() then raise exception 'staff only'; end if;
  select * into r from staff_report_prefs where email = lower(staff_email());
  return jsonb_build_object('daily', coalesce(r.daily, false),
    'sections', to_jsonb(coalesce(r.sections, array['finance','members','waitlist','engagement','safety'])),
    'last_sent_on', r.last_sent_on, 'email', lower(staff_email()));
end $$;
grant execute on function public.my_report_prefs() to authenticated;

create or replace function public.set_my_report_prefs(p_daily boolean, p_sections text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  insert into staff_report_prefs(email, daily, sections, updated_at)
  values (lower(staff_email()), p_daily, coalesce((select array_agg(s) from unnest(p_sections) s where s in ('finance','members','waitlist','engagement','safety')), array[]::text[]), now())
  on conflict (email) do update set daily = excluded.daily, sections = excluded.sections, updated_at = now();
end $$;
grant execute on function public.set_my_report_prefs(boolean, text[]) to authenticated;

-- The numbers: last 24 hours, with the 7 days before for comparison. Test (@seed.scoredate.test) accounts excluded.
create or replace function public.daily_report_data() returns jsonb
language sql stable security definer set search_path = public as $$
  with
  real_users as (select p.* from profiles p join auth.users u on u.id = p.id where u.email not ilike '%@seed.scoredate.test'),
  wl as (select * from waitlist where email not ilike '%@seed.scoredate.test'),
  money as (select * from billing_events where price_usd is not null and coalesce(environment, 'PRODUCTION') = 'PRODUCTION'),
  t as (select now() - interval '1 day' as d1, now() - interval '8 days' as d8, date_trunc('month', now()) as mtd)
  select jsonb_build_object(
    'generated_at', now(),
    'finance', jsonb_build_object(
      'gross_24h', (select coalesce(sum(price_usd) filter (where price_usd > 0), 0) from money, t where received_at >= t.d1),
      'refunds_24h', (select coalesce(-sum(price_usd) filter (where price_usd < 0), 0) from money, t where received_at >= t.d1),
      'gross_mtd', (select coalesce(sum(price_usd) filter (where price_usd > 0), 0) from money, t where received_at >= t.mtd),
      'avg_day_prev7', (select round(coalesce(sum(price_usd) filter (where price_usd > 0), 0) / 7, 2) from money, t where received_at >= t.d8 and received_at < t.d1),
      'new_subs_24h', (select count(*) from billing_events, t where received_at >= t.d1 and type = 'INITIAL_PURCHASE'),
      'renewals_24h', (select count(*) from billing_events, t where received_at >= t.d1 and type = 'RENEWAL'),
      'cancellations_24h', (select count(*) from billing_events, t where received_at >= t.d1 and type = 'CANCELLATION'),
      'billing_issues_24h', (select count(*) from billing_events, t where received_at >= t.d1 and type = 'BILLING_ISSUE'),
      'mrr_estimate', (select coalesce(sum(case plan when 'membership' then 24.99 when 'premium' then 49.99 when 'black' then 149 when 'paused' then 4.99 else 0 end), 0)
                       from real_users where plan in ('membership','premium','black','paused'))),
    'members', jsonb_build_object(
      'signups_24h', (select count(*) from real_users, t where created_at >= t.d1),
      'signups_prev7_avg', (select round(count(*) / 7.0, 1) from real_users, t where created_at >= t.d8 and created_at < t.d1),
      'id_verified_24h', (select count(*) from real_users, t where created_at >= t.d1 and id_status = 'approved'),
      'active', (select count(*) from real_users where status = 'active'),
      'preview', (select count(*) from real_users where status = 'preview'),
      'paused', (select count(*) from real_users where status in ('paused','taken')),
      'by_plan', (select coalesce(jsonb_object_agg(plan, n), '{}') from (select plan, count(*) n from real_users where plan <> 'none' group by plan) s)),
    'waitlist', jsonb_build_object(
      'total', (select count(*) from wl),
      'waiting', (select count(*) from wl where status = 'waiting'),
      'joins_24h', (select count(*) from wl, t where created_at >= t.d1),
      'joins_prev7_avg', (select round(count(*) / 7.0, 1) from wl, t where created_at >= t.d8 and created_at < t.d1),
      'referred_24h', (select count(*) from wl, t where created_at >= t.d1 and referral_code is not null),
      'founders', (select count(*) from wl where founder),
      'top_areas_24h', coalesce((select jsonb_agg(jsonb_build_object('area', a, 'n', n) order by n desc) from (
          select coalesce(nullif(area, ''), 'Other') a, count(*) n from wl, t where created_at >= t.d1 group by 1 order by 2 desc limit 3) s), '[]')),
    'engagement', jsonb_build_object(
      'dau', (select count(*) from real_users where last_active_at > now() - interval '1 day'),
      'wau', (select count(*) from real_users where last_active_at > now() - interval '7 days'),
      'conversations_24h', (select count(*) from conversations, t where created_at >= t.d1),
      'messages_24h', (select count(*) from messages, t where created_at >= t.d1),
      'dates_proposed_24h', (select count(*) from date_plans, t where created_at >= t.d1)),
    'safety', jsonb_build_object(
      'open_reports', (select count(*) from reports where status = 'open'),
      'reports_24h', (select count(*) from reports, t where created_at >= t.d1),
      'verification_queue', (select count(*) from profiles where id_status = 'review' or photo_status = 'review'),
      'support_open', (select count(*) from support_tickets where status = 'open'),
      'deletions_pending', (select count(*) from deletion_requests where status = 'open'),
      'suspended', (select count(*) from profiles where status = 'suspended'))
  );
$$;
revoke all on function public.daily_report_data() from public, anon, authenticated;

-- Staff can preview the report (and send themselves a test).
create or replace function public.staff_daily_report() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  return daily_report_data();
end $$;
grant execute on function public.staff_daily_report() to authenticated;

-- Cron: returns today's recipients (once per day each) plus the data, and marks them sent.
create or replace function public.cron_daily_report(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare who jsonb;
begin
  if p_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  with claimed as (
    update staff_report_prefs r set last_sent_on = (now() at time zone 'America/New_York')::date
    where r.daily and cardinality(r.sections) > 0
      and (r.last_sent_on is null or r.last_sent_on < (now() at time zone 'America/New_York')::date)
      and exists (select 1 from staff s where lower(s.email) = r.email)
    returning r.email, r.sections)
  select coalesce(jsonb_agg(jsonb_build_object('email', email, 'sections', to_jsonb(sections))), '[]') into who from claimed;
  if jsonb_array_length(who) = 0 then return jsonb_build_object('recipients', '[]'::jsonb); end if;
  return jsonb_build_object('recipients', who, 'data', daily_report_data());
end $$;
revoke all on function public.cron_daily_report(text) from public;
grant execute on function public.cron_daily_report(text) to anon, authenticated;
