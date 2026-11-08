-- 0029: Ad attribution for the waitlist campaign.
-- First-touch source on each waitlist signup, staff-entered ad spend, and a cost-per-signup report.

alter table public.waitlist add column if not exists utm_source text;
alter table public.waitlist add column if not exists utm_medium text;
alter table public.waitlist add column if not exists utm_campaign text;
alter table public.waitlist add column if not exists utm_content text;
alter table public.waitlist add column if not exists utm_term text;
alter table public.waitlist add column if not exists click_type text;   -- gclid | fbclid | ttclid
alter table public.waitlist add column if not exists landing_path text;
create index if not exists waitlist_utm_idx on public.waitlist (utm_source, utm_campaign);

-- Called by the server right after join_waitlist. First touch wins: never overwrites existing attribution.
-- Click IDs themselves are not stored, only which network the click came from.
create or replace function public.set_waitlist_attribution(p_secret text, p_email text, p_attr jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then return; end if;
  update waitlist set
    utm_source   = left(nullif(p_attr->>'s', ''), 80),
    utm_medium   = left(nullif(p_attr->>'m', ''), 80),
    utm_campaign = left(nullif(p_attr->>'c', ''), 120),
    utm_content  = left(nullif(p_attr->>'ct', ''), 120),
    utm_term     = left(nullif(p_attr->>'t', ''), 120),
    click_type   = case when p_attr->>'k' in ('gclid','fbclid','ttclid') then p_attr->>'k' end,
    landing_path = left(nullif(p_attr->>'p', ''), 200)
  where lower(email) = lower(p_email) and utm_source is null and click_type is null
    and created_at > now() - interval '10 minutes';
end $$;
grant execute on function public.set_waitlist_attribution(text, text, jsonb) to anon, authenticated;

-- Ad spend, entered by staff in Admin → Campaigns (daily or weekly totals per channel/campaign).
create table if not exists public.ad_spend (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  channel text not null check (channel in ('meta','google','chatgpt','youtube','creators','other')),
  campaign text,
  amount numeric(10,2) not null check (amount >= 0),
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.ad_spend enable row level security;
grant select, insert, update, delete on public.ad_spend to authenticated;
drop policy if exists ad_spend_staff on public.ad_spend;
create policy ad_spend_staff on public.ad_spend for all using (public.is_staff()) with check (public.is_staff());

-- Map a utm_source to a channel bucket.
create or replace function public.ad_channel(p_source text, p_click text) returns text
language sql immutable as $$
  select case
    when p_click = 'fbclid' or lower(p_source) ~ '^(meta|facebook|fb|instagram|ig)' then 'meta'
    when lower(p_source) ~ '^(youtube|yt|admob)' then 'youtube'
    when p_click = 'gclid' or lower(p_source) ~ '^(google|adwords)' then 'google'
    when lower(p_source) ~ '^(chatgpt|openai)' then 'chatgpt'
    when lower(p_source) ~ '^(creator|influencer|ig-creator)' then 'creators'
    when p_source is null then null
    else 'other' end
$$;

-- Signups vs spend per channel and campaign for a date range. Staff only.
create or replace function public.staff_campaign_report(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare out jsonb;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  with w as (
    select w.*, coalesce(ad_channel(w.utm_source, w.click_type), case when w.referred_by is not null then 'referral' else 'organic' end) channel,
      coalesce((zip_area(w.zip)->>'open')::boolean, false) open_area
    from waitlist w where w.created_at >= p_from and w.created_at < p_to + 1
  ),
  sig as (
    select channel, coalesce(utm_campaign, '') campaign, count(*) signups, count(*) filter (where open_area) qualified,
      coalesce(sum(referrals), 0) referrals_brought
    from w group by 1, 2
  ),
  sp as (
    select channel, coalesce(campaign, '') campaign, sum(amount) spend from ad_spend where day between p_from and p_to group by 1, 2
  ),
  j as (
    select coalesce(sig.channel, sp.channel) channel, coalesce(sig.campaign, sp.campaign) campaign,
      coalesce(sig.signups, 0) signups, coalesce(sig.qualified, 0) qualified, coalesce(sig.referrals_brought, 0) referrals_brought,
      coalesce(sp.spend, 0) spend
    from sig full join sp on sp.channel = sig.channel and sp.campaign = sig.campaign
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(j) order by j.spend desc, j.signups desc) from j), '[]'),
    'total_signups', (select count(*) from w),
    'total_qualified', (select count(*) from w where open_area),
    'total_spend', (select coalesce(sum(amount), 0) from ad_spend where day between p_from and p_to),
    'by_day', coalesce((select jsonb_agg(x order by x->>'day') from (
      select jsonb_build_object('day', d::date, 'signups', count(w.id), 'paid', count(w.id) filter (where w.channel in ('meta','google','chatgpt','youtube','creators','other'))) x
      from generate_series(p_from, p_to, interval '1 day') d left join w on w.created_at::date = d::date group by d) s), '[]')
  ) into out;
  return out;
end $$;
grant execute on function public.staff_campaign_report(date, date) to authenticated;

notify pgrst, 'reload schema';
