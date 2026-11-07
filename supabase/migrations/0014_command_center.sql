-- Admin command center: revenue amounts from RevenueCat, member support tickets, and one staff RPC that
-- returns everything the Overview needs. Safe to run more than once. Run after 0013.

-- ---------- Revenue amounts on billing events ----------
alter table public.billing_events add column if not exists price_usd numeric(10,2);     -- negative on refunds
alter table public.billing_events add column if not exists takehome numeric(5,4);       -- share after store fees
alter table public.billing_events add column if not exists currency text;
alter table public.billing_events add column if not exists country text;

create or replace function public.billing_event_amount(p_secret text, p_event_id text, p_price numeric, p_takehome numeric,
  p_currency text, p_country text) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  perform check_server_secret(p_secret);
  update billing_events set price_usd = p_price, takehome = p_takehome, currency = p_currency, country = p_country where id = p_event_id;
end $$;
grant execute on function public.billing_event_amount(text, text, numeric, numeric, text, text) to anon, authenticated;

-- ---------- Support tickets ----------
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text,
  category text not null check (category in ('billing','account','verification','safety','bug','feedback','other')),
  subject text not null check (length(subject) between 3 and 120),
  body text not null check (length(body) between 5 and 4000),
  status text not null default 'open' check (status in ('open','pending','resolved')),
  priority text not null default 'normal' check (priority in ('normal','high')),
  staff_note text,
  assigned_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists support_open on public.support_tickets(status, created_at);
alter table public.support_tickets enable row level security;
drop policy if exists support_own on public.support_tickets;
create policy support_own on public.support_tickets for select using (user_id = auth.uid());
drop policy if exists support_staff on public.support_tickets;
create policy support_staff on public.support_tickets for select using (public.is_staff());

create or replace function public.submit_support_ticket(p_category text, p_subject text, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare tid uuid; recent int;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  select count(*) into recent from support_tickets where user_id = auth.uid() and created_at > now() - interval '1 hour';
  if recent >= 5 then raise exception 'You have sent a few requests already. We''ll get back to you soon.'; end if;
  insert into support_tickets(user_id, email, category, subject, body, priority)
  values (auth.uid(), (select coalesce(p.email, u.email) from profiles p join auth.users u on u.id = p.id where p.id = auth.uid()),
          p_category, trim(p_subject), trim(p_body), case when p_category in ('safety','billing') then 'high' else 'normal' end)
  returning id into tid;
  return tid;
end $$;
grant execute on function public.submit_support_ticket(text, text, text) to authenticated;

create or replace function public.staff_update_ticket(p_id uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare who text := (select email from auth.users where id = auth.uid());
begin
  if not is_staff() then raise exception 'staff only'; end if;
  update support_tickets set status = p_status, staff_note = nullif(trim(p_note), ''), assigned_to = coalesce(assigned_to, who),
    updated_at = now(), resolved_at = case when p_status = 'resolved' then now() else null end
  where id = p_id;
  insert into audit_log(staff_email, action, target_user, reason)
  values (coalesce(who, 'staff'), 'support_' || p_status, (select user_id from support_tickets where id = p_id), left(p_note, 300));
end $$;
grant execute on function public.staff_update_ticket(uuid, text, text) to authenticated;

-- ---------- Command center ----------
drop function if exists public.staff_command_center(int);
create or replace function public.staff_command_center(p_days int default 30, p_include_test boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d int := least(greatest(coalesce(p_days, 30), 1), 365); since timestamptz; out jsonb;
  prod_only boolean := not coalesce(test_mode(), false);
begin
  if not is_staff() then raise exception 'staff only'; end if;
  since := now() - make_interval(days => d);

  with
  real_users as (select p.* from profiles p join auth.users u on u.id = p.id where p_include_test or u.email not ilike '%@seed.scoredate.test'),
  money as (
    select * from billing_events
    where received_at >= since and price_usd is not null and (not prod_only or coalesce(environment, 'PRODUCTION') = 'PRODUCTION')),
  convs as (select * from conversations where created_at >= since),
  msgs as (select * from messages where created_at >= since)
  select jsonb_build_object(
    'days', d,
    -- Revenue
    'revenue', jsonb_build_object(
      'gross', coalesce((select sum(price_usd) filter (where price_usd > 0) from money), 0),
      'refunds', coalesce((select -sum(price_usd) filter (where price_usd < 0) from money), 0),
      'net_after_fees', coalesce((select sum(price_usd * coalesce(takehome, 0.85)) from money), 0),
      'transactions', (select count(*) from money where price_usd > 0),
      'by_store', coalesce((select jsonb_agg(jsonb_build_object('k', coalesce(store, 'unknown'), 'v', v) order by v desc)
                            from (select store, sum(price_usd) v from money group by store) s), '[]'),
      'by_product', coalesce((select jsonb_agg(jsonb_build_object('k', coalesce(product_id, 'unknown'), 'v', v, 'n', n) order by v desc)
                              from (select product_id, sum(price_usd) v, count(*) n from money group by product_id) s), '[]'),
      'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'v', v) order by day)
                         from (select received_at::date as day, sum(price_usd) v from money group by 1) s), '[]'),
      'recent', coalesce((select jsonb_agg(x order by x->>'at' desc) from (
                  select jsonb_build_object('at', b.received_at, 'type', b.type, 'product', b.product_id, 'store', b.store,
                    'price', b.price_usd, 'name', p.first_name, 'user_id', b.user_id) x
                  from money b left join profiles p on p.id = b.user_id order by b.received_at desc limit 8) r), '[]'),
      'mrr_estimate', (select coalesce(sum(case plan when 'membership' then 24.99 when 'premium' then 49.99 when 'black' then 149
                                                 when 'paused' then 4.99 else 0 end), 0) from real_users where plan in ('membership','premium','black','paused'))
    ),
    -- Subscribers
    'subs', jsonb_build_object(
      'by_plan', (select coalesce(jsonb_object_agg(plan, n), '{}') from (select plan, count(*) n from real_users group by plan) s),
      'new', (select count(*) from billing_events where received_at >= since and type = 'INITIAL_PURCHASE'),
      'renewals', (select count(*) from billing_events where received_at >= since and type = 'RENEWAL'),
      'cancellations', (select count(*) from billing_events where received_at >= since and type = 'CANCELLATION'),
      'expirations', (select count(*) from billing_events where received_at >= since and type = 'EXPIRATION'),
      'billing_issues', (select count(*) from billing_events where received_at >= since and type = 'BILLING_ISSUE'),
      'preview_to_paid', (select count(*) from real_users where plan in ('membership','premium','black') and preview_ends_at is not null)
    ),
    -- Growth funnel
    'growth', jsonb_build_object(
      'waitlist_joins', (select count(*) from waitlist where created_at >= since and (p_include_test or email not ilike '%@seed.scoredate.test')),
      'waitlist_waiting', (select count(*) from waitlist where status = 'waiting' and (p_include_test or email not ilike '%@seed.scoredate.test')),
      'signups', (select count(*) from real_users where created_at >= since),
      'id_verified', (select count(*) from real_users where created_at >= since and id_status = 'approved'),
      'band_verified', (select count(*) from real_users where created_at >= since and credit_verified_at is not null),
      'paying', (select count(*) from real_users where created_at >= since and plan in ('membership','premium','black')),
      'daily_signups', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'v', n) order by day)
                                 from (select created_at::date as day, count(*) n from real_users where created_at >= since group by 1) s), '[]')
    ),
    -- Engagement
    'engagement', jsonb_build_object(
      'dau', (select count(*) from real_users where last_active_at > now() - interval '1 day'),
      'wau', (select count(*) from real_users where last_active_at > now() - interval '7 days'),
      'mau', (select count(*) from real_users where last_active_at > now() - interval '30 days'),
      'conversations', (select count(*) from convs),
      'messages', (select count(*) from msgs),
      'reply_rate', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where both_sides) / count(*)) end
                     from (select c.id, count(distinct m.sender_id) >= 2 both_sides from convs c left join messages m on m.conversation_id = c.id group by c.id) s),
      'dates_proposed', (select count(*) from date_plans where created_at >= since),
      'dates_accepted', (select count(*) from date_plans where created_at >= since and status = 'accepted'),
      'rsvps', (select count(*) from event_rsvps where created_at >= since),
      'push_devices', (select count(*) from push_subscriptions),
      'gender', (select coalesce(jsonb_object_agg(coalesce(gender, 'unset'), n), '{}') from (
                  select gender, count(*) n from real_users where status in ('active','preview') group by gender) s)
    ),
    -- Most popular profiles (staff only; never shown to members)
    'popular', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('id', p.id, 'name', p.first_name, 'band', p.band, 'plan', p.plan, 'neighborhood', p.neighborhood,
          'hellos', t.n, 'replies', t.replied) x
        from (select case when m1.sender_id = c.user_a then c.user_b else c.user_a end uid, count(*) n,
                     count(*) filter (where exists (select 1 from messages m2 where m2.conversation_id = c.id and m2.sender_id <> m1.sender_id)) replied
              from convs c
              join lateral (select sender_id from messages m where m.conversation_id = c.id order by created_at limit 1) m1 on true
              group by 1) t
        join real_users p on p.id = t.uid
        order by t.n desc limit 8) s), '[]'),
    -- Trust & safety
    'safety', jsonb_build_object(
      'open_reports', (select count(*) from reports where status = 'open'),
      'reports_period', (select count(*) from reports where created_at >= since),
      'blocks_period', (select count(*) from blocks where created_at >= since),
      'repeat_reported', coalesce((select jsonb_agg(jsonb_build_object('id', r.reported_id, 'name', p.first_name, 'n', r.n)) from (
          select reported_id, count(*) n from reports where status = 'open' group by 1 having count(*) >= 2 order by 2 desc limit 5) r
          left join profiles p on p.id = r.reported_id), '[]'),
      'verification_queue', (select count(*) from profiles where id_status = 'review' or photo_status = 'review'),
      'suspended', (select count(*) from profiles where status = 'suspended'),
      'deletions_pending', (select count(*) from deletion_requests where status = 'open')
    ),
    -- Support
    'support', jsonb_build_object(
      'open', (select count(*) from support_tickets where status = 'open'),
      'pending', (select count(*) from support_tickets where status = 'pending'),
      'high', (select count(*) from support_tickets where status <> 'resolved' and priority = 'high'),
      'oldest_hours', (select round(extract(epoch from now() - min(created_at)) / 3600) from support_tickets where status = 'open'),
      'resolved_period', (select count(*) from support_tickets where resolved_at >= since),
      'by_category', (select coalesce(jsonb_object_agg(category, n), '{}') from (
                       select category, count(*) n from support_tickets where status <> 'resolved' group by 1) s),
      'latest', coalesce((select jsonb_agg(x) from (
          select jsonb_build_object('id', id, 'subject', subject, 'category', category, 'priority', priority, 'at', created_at) x
          from support_tickets where status <> 'resolved' order by (priority = 'high') desc, created_at limit 5) s), '[]')
    ),
    -- Email health
    'email', jsonb_build_object(
      'sent', (select count(*) from email_log where created_at >= since and ok),
      'failed', (select count(*) from email_log where created_at >= since and not ok)
    )
  ) into out
  from (select 1) one;
  return out;
end $$;
grant execute on function public.staff_command_center(int, boolean) to authenticated;
