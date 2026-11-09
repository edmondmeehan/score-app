-- 0049: Everything the admin member page shows about one member, in one staff-only call.
create or replace function public.staff_member_overview(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare out jsonb;
begin
  if staff_role() is null then raise exception 'Staff only'; end if;
  with money as (
    select * from billing_events where user_id = p_user and price_usd is not null and coalesce(environment, 'PRODUCTION') = 'PRODUCTION'
  ), convs as (
    select id, created_at, ended_at from conversations where p_user in (user_a, user_b)
  )
  select jsonb_build_object(
    'spend', jsonb_build_object(
      'gross', coalesce((select sum(price_usd) from money where price_usd > 0), 0),
      'refunds', coalesce((select -sum(price_usd) from money where price_usd < 0), 0),
      'net', coalesce((select sum(price_usd) from money), 0),
      'takehome', coalesce((select round(sum(price_usd * coalesce(takehome, 0.7)), 2) from money), 0),
      'payments', (select count(*) from money where price_usd > 0),
      'first_paid', (select min(received_at) from money where price_usd > 0),
      'last_paid', (select max(received_at) from money where price_usd > 0),
      'renews', (select max(expires_at) from billing_events where user_id = p_user and expires_at > now()),
      'addons', coalesce((select jsonb_object_agg(kind, n) from (select kind, sum(change) n from addon_ledger
                 where user_id = p_user and change > 0 and source in ('apple','google','stripe') group by kind) a), '{}'::jsonb),
      'addon_left', coalesce((select jsonb_object_agg(kind, n) from (select kind, sum(change) n from addon_ledger
                 where user_id = p_user group by kind) a where n > 0), '{}'::jsonb)
    ),
    'history', coalesce((select jsonb_agg(h order by h.at desc) from (
        select received_at at, type, product_id, plan, store, price_usd, environment from billing_events
        where user_id = p_user order by received_at desc limit 25) h), '[]'::jsonb),
    'activity', jsonb_build_object(
      'conversations', (select count(*) from convs),
      'active_chats', (select count(*) from convs where ended_at is null),
      'messages_sent', (select count(*) from messages where sender_id = p_user),
      'likes_sent', (select count(*) from likes where liker = p_user),
      'likes_received', (select count(*) from likes where liked = p_user),
      'views_received', (select count(*) from profile_views where viewed = p_user),
      'views_30d', (select count(*) from profile_views where viewed = p_user and day > current_date - 30),
      'drops_received', (select count(*) from drops where user_id = p_user),
      'dates_planned', (select count(*) from date_plans d join convs c on c.id = d.conversation_id),
      'dates_accepted', (select count(*) from date_plans d join convs c on c.id = d.conversation_id where d.status = 'accepted'),
      'events_rsvp', (select count(*) from event_rsvps where user_id = p_user and status = 'going'),
      'events_attended', (select count(distinct event_id) from member_scans where user_id = p_user and event_id is not null)
    ),
    'growth', jsonb_build_object(
      'invited_by', (select jsonb_build_object('id', i.id, 'name', i.first_name) from profiles me join profiles i on i.id = me.invited_by where me.id = p_user),
      'invites_sent', (select count(*) from invites where inviter_id = p_user),
      'invites_redeemed', (select count(*) from invites where inviter_id = p_user and redeemed_by is not null),
      'referred', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', first_name)) from (select id, first_name from profiles where invited_by = p_user order by created_at desc limit 10) r), '[]'::jsonb)
    ),
    'safety', jsonb_build_object(
      'reports_against', (select count(*) from reports where reported_id = p_user),
      'reports_open', (select count(*) from reports where reported_id = p_user and status = 'open'),
      'reports_made', (select count(*) from reports where reporter_id = p_user),
      'blocked_by', (select count(*) from blocks where blocked_id = p_user),
      'tickets', (select count(*) from support_tickets where user_id = p_user),
      'tickets_open', (select count(*) from support_tickets where user_id = p_user and status <> 'resolved')
    ),
    'last_sign_in', (select last_sign_in_at from auth.users where id = p_user)
  ) into out;
  return out;
end $$;
revoke all on function public.staff_member_overview(uuid) from public, anon;
grant execute on function public.staff_member_overview(uuid) to authenticated;
