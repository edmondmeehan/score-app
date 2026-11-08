-- 0036: Cost to acquire a customer. Campaign report links each waitlist sign-up to the member account it became,
-- then counts members, paying members and revenue per channel/campaign. Daily report adds paying members from ads MTD.
-- Needs 0029 and 0035. Safe to run more than once.

create or replace function public.staff_campaign_report(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare out jsonb;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  with w as (
    select w.*, coalesce(ad_channel(w.utm_source, w.click_type), case when w.referred_by is not null then 'referral' else 'organic' end) channel,
      coalesce((zip_area(w.zip)->>'open')::boolean, false) open_area,
      m.id member_id,
      (m.id is not null and (m.plan in ('membership','premium','black') or exists (select 1 from billing_events b where b.user_id = m.id and b.type = 'INITIAL_PURCHASE'))) paying,
      coalesce((select sum(b.price_usd) from billing_events b where b.user_id = m.id and b.price_usd is not null and coalesce(b.environment, 'PRODUCTION') = 'PRODUCTION'), 0) revenue
    from waitlist w
    left join lateral (select p.id, p.plan from auth.users u join profiles p on p.id = u.id where lower(u.email) = lower(w.email) limit 1) m on true
    where w.created_at >= p_from and w.created_at < p_to + 1
  ),
  sig as (
    select channel, coalesce(utm_campaign, '') campaign, count(*) signups, count(*) filter (where open_area) qualified,
      coalesce(sum(referrals), 0) referrals_brought,
      count(member_id) members, count(*) filter (where paying) paying, coalesce(sum(revenue), 0) revenue
    from w group by 1, 2
  ),
  sp as (
    select channel, coalesce(campaign, '') campaign, sum(amount) spend from ad_spend where day between p_from and p_to group by 1, 2
  ),
  j as (
    select coalesce(sig.channel, sp.channel) channel, coalesce(sig.campaign, sp.campaign) campaign,
      coalesce(sig.signups, 0) signups, coalesce(sig.qualified, 0) qualified, coalesce(sig.referrals_brought, 0) referrals_brought,
      coalesce(sig.members, 0) members, coalesce(sig.paying, 0) paying, coalesce(sig.revenue, 0) revenue,
      coalesce(sp.spend, 0) spend
    from sig full join sp on sp.channel = sig.channel and sp.campaign = sig.campaign
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(j) order by j.spend desc, j.signups desc) from j), '[]'),
    'total_signups', (select count(*) from w),
    'total_qualified', (select count(*) from w where open_area),
    'total_members', (select count(member_id) from w),
    'total_paying', (select count(*) from w where paying),
    'total_revenue', (select coalesce(sum(revenue), 0) from w),
    'paid_paying', (select count(*) from w where paying and channel in ('meta','google','chatgpt','youtube','creators','other')),
    'paid_revenue', (select coalesce(sum(revenue), 0) from w where channel in ('meta','google','chatgpt','youtube','creators','other')),
    'total_spend', (select coalesce(sum(amount), 0) from ad_spend where day between p_from and p_to),
    'by_day', coalesce((select jsonb_agg(x order by x->>'day') from (
      select jsonb_build_object('day', d::date, 'signups', count(w.id), 'paid', count(w.id) filter (where w.channel in ('meta','google','chatgpt','youtube','creators','other'))) x
      from generate_series(p_from, p_to, interval '1 day') d left join w on w.created_at::date = d::date group by d) s), '[]')
  ) into out;
  return out;
end $$;
grant execute on function public.staff_campaign_report(date, date) to authenticated;

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
      'paying_mtd', (select count(*) from wl w2, t join auth.users u on true join profiles p on p.id = u.id
          where w2.created_at >= t.mtd and (w2.utm_source is not null or w2.click_type is not null) and lower(u.email) = lower(w2.email)
            and (p.plan in ('membership','premium','black') or exists (select 1 from billing_events b where b.user_id = p.id and b.type = 'INITIAL_PURCHASE'))),
      'by_channel_24h', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc) from (
          select ad_channel(utm_source, click_type) k, count(*) n from wl, t where created_at >= t.d1 and (utm_source is not null or click_type is not null) group by 1 order by 2 desc) s), '[]'))
  );
$$;
revoke all on function public.daily_report_data() from public, anon, authenticated;

notify pgrst, 'reload schema';
