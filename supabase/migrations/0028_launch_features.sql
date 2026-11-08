-- 0028: Launch features: likes, unmatch, chat safety filter, chat photos, read receipts (existing reads),
-- profile views, data export, error alerts, native push tokens, report follow-ups.

-- ---------- Likes ("see who liked you" for Premium and Reserve) ----------
create table if not exists public.likes (
  liker uuid not null references public.profiles(id) on delete cascade,
  liked uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (liker, liked),
  check (liker <> liked)
);
create index if not exists likes_liked on public.likes(liked, created_at desc);
alter table public.likes enable row level security;
drop policy if exists likes_own on public.likes;
create policy likes_own on public.likes for select using (liker = auth.uid());

create or replace function public.like_member(p_other uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me profiles; o profiles; today int; a uuid; b uuid; cid uuid; mutual boolean;
begin
  select * into me from profiles where id = auth.uid();
  select * into o from profiles where id = p_other;
  if me.id is null or o.id is null or me.id = o.id then raise exception 'not found'; end if;
  if me.id_status <> 'approved' or me.band is null then raise exception 'Finish verification to like profiles.'; end if;
  if o.status <> 'active' or blocked_between(me.id, o.id) then raise exception 'unavailable'; end if;
  if me.plan not in ('premium','black') then
    select count(*) into today from likes where liker = me.id and created_at > now() - interval '1 day';
    if today >= 25 then raise exception 'You’ve used today’s likes. More tomorrow, or go Premium for unlimited.'; end if;
  end if;
  insert into likes(liker, liked) values (me.id, o.id) on conflict do nothing;
  mutual := exists (select 1 from likes where liker = o.id and liked = me.id);
  if mutual then
    a := least(me.id, o.id); b := greatest(me.id, o.id);
    insert into conversations(user_a, user_b) values (a, b) on conflict (user_a, user_b) do nothing;
    select id into cid from conversations where user_a = a and user_b = b and ended_at is null;
    perform notify(o.id, me.id, 'like_match', 'interaction', 'It’s a match with ' || first_name_of(me.id), 'You both liked each other. Say hello.', '/app/messages/' || cid, 'likematch:' || cid, true);
  else
    perform notify(o.id, me.id, 'like', 'interaction', 'Someone likes you', 'See who in your Likes.', '/app/likes', 'like:' || me.id || ':' || o.id, false);
  end if;
  return jsonb_build_object('mutual', mutual, 'conversation_id', cid);
end $$;
grant execute on function public.like_member(uuid) to authenticated;

create or replace function public.unlike_member(p_other uuid) returns void
language sql security definer set search_path = public as $$
  delete from likes where liker = auth.uid() and liked = p_other;
$$;
grant execute on function public.unlike_member(uuid) to authenticated;

create or replace function public.likes_me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me profiles; n int;
begin
  select * into me from profiles where id = auth.uid();
  select count(*) into n from likes l where l.liked = me.id and not blocked_between(l.liker, me.id)
    and not exists (select 1 from likes x where x.liker = me.id and x.liked = l.liker);
  if me.plan not in ('premium','black') then return jsonb_build_object('locked', true, 'count', n); end if;
  return jsonb_build_object('locked', false, 'count', n, 'people', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'first_name', p.first_name, 'birth_year', p.birth_year, 'band', p.band, 'neighborhood', p.neighborhood, 'liked_at', l.created_at) order by l.created_at desc)
    from likes l join profiles p on p.id = l.liker
    where l.liked = me.id and p.status = 'active' and not blocked_between(l.liker, me.id)
      and not exists (select 1 from likes x where x.liker = me.id and x.liked = l.liker)
    limit 200), '[]'));
end $$;
grant execute on function public.likes_me() to authenticated;

-- ---------- Unmatch ----------
alter table public.conversations add column if not exists ended_at timestamptz;
alter table public.conversations add column if not exists ended_by uuid references public.profiles(id) on delete set null;

create or replace function public.unmatch(p_conversation uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c conversations;
begin
  select * into c from conversations where id = p_conversation and auth.uid() in (user_a, user_b);
  if c.id is null then raise exception 'not found'; end if;
  update conversations set ended_at = now(), ended_by = auth.uid() where id = c.id and ended_at is null;
  delete from likes where (liker = c.user_a and liked = c.user_b) or (liker = c.user_b and liked = c.user_a);
end $$;
grant execute on function public.unmatch(uuid) to authenticated;

drop policy if exists msg_send on public.messages;
create policy msg_send on public.messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b) and c.ended_at is null)
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.plan in ('membership','premium','black','paused'))
  and not exists (select 1 from public.blocks b join public.conversations c on c.id = conversation_id
                  where (b.blocker_id = c.user_a and b.blocked_id = c.user_b) or (b.blocker_id = c.user_b and b.blocked_id = c.user_a)));

-- ---------- Chat safety filter + chat photos ----------
alter table public.messages add column if not exists flag text;
alter table public.messages add column if not exists image_path text;

create or replace function public.trg_message_flag() returns trigger
language plpgsql as $$
declare t text := lower(coalesce(new.body, ''));
begin
  if t ~ '(gift ?card|western union|money ?gram|wire (me|transfer)|zelle|venmo|cash ?app|paypal|bitcoin|crypto|usdt|ethereum|binance|forex|investment (opportunity|platform)|send (me )?money|lend me|loan me|routing number|bank (account|login)|social security)' then
    new.flag := 'money';
  elsif t ~ '(whats ?app|telegram|signal app|wechat|kik|google chat|hangouts|text me at|my number is|\+?1?[ .-]?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4})' and
        (select count(*) from messages m where m.conversation_id = new.conversation_id) < 6 then
    new.flag := 'offplatform';
  elsif t ~ '(kill yourself|\mkys\M|send nudes|\mnudes\M)' then
    new.flag := 'harassment';
  end if;
  return new;
end $$;
drop trigger if exists message_flag on public.messages;
create trigger message_flag before insert on public.messages for each row execute function public.trg_message_flag();

create or replace function public.staff_flagged_messages() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  return coalesce((select jsonb_agg(x order by (x->>'n')::int desc) from (
    select jsonb_build_object('sender', m.sender_id, 'first_name', p.first_name, 'status', p.status, 'n', count(*),
      'kinds', jsonb_agg(distinct m.flag), 'last_at', max(m.created_at), 'sample', (array_agg(left(m.body, 140) order by m.created_at desc))[1]) x
    from messages m join profiles p on p.id = m.sender_id
    where m.flag is not null and m.created_at > now() - interval '14 days'
    group by m.sender_id, p.first_name, p.status
    order by count(*) desc limit 50) s), '[]');
end $$;
grant execute on function public.staff_flagged_messages() to authenticated;

insert into storage.buckets (id, name, public) values ('chat', 'chat', false) on conflict do nothing;
drop policy if exists chat_upload on storage.objects;
create policy chat_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'chat' and (storage.foldername(name))[2] = auth.uid()::text
  and exists (select 1 from public.conversations c where c.id::text = (storage.foldername(name))[1] and auth.uid() in (c.user_a, c.user_b) and c.ended_at is null));
drop policy if exists chat_read on storage.objects;
create policy chat_read on storage.objects for select to authenticated using (
  bucket_id = 'chat' and (
    exists (select 1 from public.conversations c where c.id::text = (storage.foldername(name))[1] and auth.uid() in (c.user_a, c.user_b))
    or public.is_staff()));

-- Read receipts: when did the other person last read this conversation?
create or replace function public.other_read_at(p_conversation uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select r.last_read_at from conversation_reads r join conversations c on c.id = r.conversation_id
  where c.id = p_conversation and auth.uid() in (c.user_a, c.user_b) and r.user_id <> auth.uid() and r.user_id in (c.user_a, c.user_b);
$$;
grant execute on function public.other_read_at(uuid) to authenticated;

-- ---------- Profile views ("who viewed me") ----------
create table if not exists public.profile_views (
  viewer uuid not null references public.profiles(id) on delete cascade,
  viewed uuid not null references public.profiles(id) on delete cascade,
  day date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (viewer, viewed, day)
);
create index if not exists views_viewed on public.profile_views(viewed, created_at desc);
alter table public.profile_views enable row level security;

create or replace function public.log_profile_view(p_viewed uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() = p_viewed or is_staff() then return; end if;
  insert into profile_views(viewer, viewed) values (auth.uid(), p_viewed) on conflict (viewer, viewed, day) do update set created_at = now();
end $$;
grant execute on function public.log_profile_view(uuid) to authenticated;

create or replace function public.views_me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me profiles; n int;
begin
  select * into me from profiles where id = auth.uid();
  select count(distinct viewer) into n from profile_views v where v.viewed = me.id and v.created_at > now() - interval '30 days' and not blocked_between(v.viewer, me.id);
  if me.plan not in ('premium','black') then return jsonb_build_object('locked', true, 'count', n); end if;
  return jsonb_build_object('locked', false, 'count', n, 'people', coalesce((select jsonb_agg(x order by x->>'at' desc) from (
    select jsonb_build_object('id', p.id, 'first_name', p.first_name, 'birth_year', p.birth_year, 'band', p.band, 'at', max(v.created_at)) x
    from profile_views v join profiles p on p.id = v.viewer
    where v.viewed = me.id and v.created_at > now() - interval '30 days' and p.status = 'active' and not blocked_between(v.viewer, me.id)
    group by p.id, p.first_name, p.birth_year, p.band order by max(v.created_at) desc limit 100) s), '[]'));
end $$;
grant execute on function public.views_me() to authenticated;

-- ---------- Download my data ----------
create or replace function public.my_data_export() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please sign in.'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'note', 'Your Score data. Score never stores your exact credit score or credit report, only your band and trend.',
    'account', (select jsonb_build_object('email', u.email, 'created_at', u.created_at) from auth.users u where u.id = uid),
    'profile', (select to_jsonb(p) from profiles p where p.id = uid),
    'photos', coalesce((select jsonb_agg(jsonb_build_object('position', position, 'status', match_status, 'created_at', created_at)) from photos where user_id = uid), '[]'),
    'money_quiz', (select answers from compat_answers where user_id = uid),
    'conversations', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'with', first_name_of(case when c.user_a = uid then c.user_b else c.user_a end), 'started', c.created_at, 'ended', c.ended_at)) from conversations c where uid in (c.user_a, c.user_b)), '[]'),
    'messages_sent', coalesce((select jsonb_agg(jsonb_build_object('conversation', conversation_id, 'body', body, 'photo', image_path is not null, 'sent', created_at) order by created_at) from messages where sender_id = uid), '[]'),
    'likes_given', coalesce((select jsonb_agg(jsonb_build_object('who', first_name_of(liked), 'at', created_at)) from likes where liker = uid), '[]'),
    'blind_rounds', coalesce((select jsonb_agg(jsonb_build_object('score', score, 'at', created_at)) from blind_rounds where uid in (user_a, user_b)), '[]'),
    'date_plans', coalesce((select jsonb_agg(jsonb_build_object('place', d.place, 'when', d.starts_at, 'status', d.status)) from date_plans d where d.proposer_id = uid), '[]'),
    'event_rsvps', coalesce((select jsonb_agg(jsonb_build_object('event', e.title, 'status', r.status, 'at', r.created_at)) from event_rsvps r join events e on e.id = r.event_id where r.user_id = uid), '[]'),
    'reports_filed', coalesce((select jsonb_agg(jsonb_build_object('reason', reason, 'status', status, 'at', created_at)) from reports where reporter_id = uid), '[]'),
    'support_tickets', coalesce((select jsonb_agg(jsonb_build_object('subject', subject, 'body', body, 'status', status, 'at', created_at)) from support_tickets where user_id = uid), '[]'),
    'billing', coalesce((select jsonb_agg(jsonb_build_object('type', type, 'product', product_id, 'store', store, 'at', received_at)) from billing_events where user_id = uid), '[]'),
    'screenshots_detected', (select count(*) from screenshot_events where user_id = uid),
    'blocked', coalesce((select jsonb_agg(first_name_of(blocked_id)) from blocks where blocker_id = uid), '[]'));
end $$;
grant execute on function public.my_data_export() to authenticated;

-- ---------- Error alerts ----------
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  path text, message text, digest text, kind text,
  created_at timestamptz not null default now()
);
alter table public.app_errors enable row level security;
drop policy if exists errors_staff on public.app_errors;
create policy errors_staff on public.app_errors for select using (public.is_staff());

create or replace function public.log_app_error(p_secret text, p_path text, p_message text, p_digest text, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then return; end if;
  if (select count(*) from app_errors where created_at > now() - interval '1 minute') > 60 then return; end if;
  insert into app_errors(path, message, digest, kind) values (left(p_path, 300), left(p_message, 1000), left(p_digest, 100), left(p_kind, 40));
  delete from app_errors where created_at < now() - interval '30 days';
end $$;
grant execute on function public.log_app_error(text, text, text, text, text) to anon, authenticated;

-- Returns errors to alert about (at most one alert per hour) plus the owners to email.
create or replace function public.cron_error_alert(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare last timestamptz; rows jsonb;
begin
  if p_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  select (value #>> '{}')::timestamptz into last from app_config where key = 'error_alert_last';
  if last is not null and last > now() - interval '1 hour' then return jsonb_build_object('errors', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(x), '[]') into rows from (
    select jsonb_build_object('path', path, 'message', max(message), 'n', count(*), 'last_at', max(created_at)) x
    from app_errors where created_at > coalesce(last, now() - interval '1 hour') group by path order by count(*) desc limit 10) s;
  if jsonb_array_length(rows) = 0 then return jsonb_build_object('errors', '[]'::jsonb); end if;
  insert into app_config(key, value) values ('error_alert_last', to_jsonb(now()::text)) on conflict (key) do update set value = excluded.value;
  return jsonb_build_object('errors', rows, 'to', coalesce((select jsonb_agg(lower(email)) from staff where role = 'owner'), '[]'));
end $$;
grant execute on function public.cron_error_alert(text) to anon, authenticated;

-- ---------- Native app push tokens (iPhone / Android via Firebase Cloud Messaging) ----------
create table if not exists public.native_push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('ios','android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table public.native_push_tokens enable row level security;

create or replace function public.register_native_push(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or length(coalesce(p_token, '')) < 20 then return; end if;
  insert into native_push_tokens(token, user_id, platform) values (p_token, auth.uid(), case when p_platform = 'android' then 'android' else 'ios' end)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now();
end $$;
grant execute on function public.register_native_push(text, text) to authenticated;

create or replace function public.native_tokens_for(p_secret text, p_users uuid[]) returns table(user_id uuid, token text, platform text)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  return query select t.user_id, t.token, t.platform from native_push_tokens t where t.user_id = any(p_users);
end $$;
grant execute on function public.native_tokens_for(text, uuid[]) to anon, authenticated;

create or replace function public.native_token_dead(p_secret text, p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then return; end if;
  delete from native_push_tokens where token = p_token;
end $$;
grant execute on function public.native_token_dead(text, text) to anon, authenticated;

-- ---------- Report follow-up: tell the reporter we acted (without details) ----------
create or replace function public.report_followup(p_report uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r reports;
begin
  if not is_staff() then raise exception 'staff only'; end if;
  select * into r from reports where id = p_report;
  if r.id is null or r.reporter_id is null then return; end if;
  perform notify(r.reporter_id, null, 'report_update', 'interaction', 'We reviewed your report',
    case when r.status = 'dismissed' then 'Thanks for telling us. We looked into it and didn’t find a rules violation this time, but we’ll keep an eye out.'
         else 'Thanks for telling us. We reviewed it and took action under our community guidelines. For privacy, we can’t share details.' end,
    '/app/support', 'report_update:' || r.id, true);
end $$;
grant execute on function public.report_followup(uuid) to authenticated;
