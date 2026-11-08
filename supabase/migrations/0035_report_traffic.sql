-- 0035: Daily admin report gains Traffic (visitors, sources, top pages, campaigns) and Ads (spend, paid sign-ups,
-- cost per sign-up). Needs 0029 (ad attribution). Safe to run more than once.

create or replace function public.daily_report_data() returns jsonb
language sql stable security definer set search_path = public as $$
  with
  real_users as (select p.* from profiles p join auth.users u on u.id = p.id where u.email not ilike '%@seed.scoredate.test'),
  wl as (select * from waitlist where email not ilike '%@seed.scoredate.test'),
  money as (select * from billing_events where price_usd is not null and coalesce(environment, 'PRODUCTION') = 'PRODUCTION'),
  t as (select now() - interval '1 day' as d1, now() - interval '8 days' as d8, date_trunc('month', now()) as mtd),
  ev as (select * from analytics_events where at >= now() - interval '8 days' and name = 'pageview'),
  spend as (select * from ad_spend)
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
      'suspended', (select count(*) from profiles where status = 'suspended')),
    'traffic', jsonb_build_object(
      'visitors_24h', (select count(distinct visitor_id) from ev, t where at >= t.d1),
      'visitors_prev7_avg', (select round(count(distinct (visitor_id, at::date)) / 7.0, 1) from ev, t where at >= t.d8 and at < t.d1),
      'sessions_24h', (select count(*) from ev, t where at >= t.d1 and new_session),
      'pageviews_24h', (select count(*) from ev, t where at >= t.d1),
      'mobile_share', (select round(100.0 * count(*) filter (where device = 'Mobile') / nullif(count(*), 0)) from ev, t where at >= t.d1 and new_session),
      'top_sources', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc) from (
          select coalesce(source, 'Direct') k, count(*) n from ev, t where at >= t.d1 and new_session group by 1 order by 2 desc limit 5) s), '[]'),
      'top_pages', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc) from (
          select path k, count(*) n from ev, t where at >= t.d1 and path not like '/admin%' group by 1 order by 2 desc limit 5) s), '[]'),
      'top_campaigns', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc) from (
          select campaign k, count(*) n from ev, t where at >= t.d1 and new_session and campaign is not null group by 1 order by 2 desc limit 5) s), '[]')),
    'campaigns', jsonb_build_object(
      'spend_24h', (select coalesce(sum(amount), 0) from spend where day >= (now() - interval '1 day')::date),
      'spend_mtd', (select coalesce(sum(amount), 0) from spend, t where day >= t.mtd::date),
      'paid_joins_24h', (select count(*) from wl, t where created_at >= t.d1 and (utm_source is not null or click_type is not null)),
      'paid_joins_mtd', (select count(*) from wl, t where created_at >= t.mtd and (utm_source is not null or click_type is not null)),
      'by_channel_24h', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc) from (
          select ad_channel(utm_source, click_type) k, count(*) n from wl, t where created_at >= t.d1 and (utm_source is not null or click_type is not null) group by 1 order by 2 desc) s), '[]'))
  );
$$;
revoke all on function public.daily_report_data() from public, anon, authenticated;

alter table public.staff_report_prefs alter column sections set default array['finance','traffic','campaigns','members','waitlist','engagement','safety'];

notify pgrst, 'reload schema';
