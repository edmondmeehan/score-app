-- 0012: Notifications. Push (web push now, native later), email, and an in-app Activity list.
-- Interactions (Notes, new chats, messages, dates, friends joining), reminders (unread, events,
-- dates, check-ins, Preview/Spotlight ending), milestones and weekly win-back nudges.
-- Rows are created by triggers and scheduled jobs; the app claims and delivers them.

-- ---------- Tables ----------
alter table public.profiles add column if not exists last_active_at timestamptz;

create table if not exists public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  platform text check (platform in ('web','ios','android')) default 'web',
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index if not exists push_subs_user on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for select using (user_id = auth.uid());

create table if not exists public.notify_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_interactions boolean not null default true,
  push_reminders boolean not null default true,
  push_milestones boolean not null default true,
  push_nudges boolean not null default true,
  email_milestones boolean not null default false,
  email_nudges boolean not null default true,
  quiet_hours boolean not null default true,       -- 10pm–8am New York: hold reminders, milestones and nudges
  updated_at timestamptz not null default now()
);
alter table public.notify_prefs enable row level security;
drop policy if exists nprefs_own on public.notify_prefs;
create policy nprefs_own on public.notify_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.notify_prefs to authenticated;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  category text not null check (category in ('interaction','reminder','milestone','nudge')),
  title text not null,
  body text,
  url text not null default '/app',
  dedupe text not null,
  push_state text not null default 'pending' check (push_state in ('pending','sent','skipped')),
  email_state text not null default 'skipped' check (email_state in ('pending','sent','skipped')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, dedupe)
);
create index if not exists notif_user on public.notifications(user_id, created_at desc);
create index if not exists notif_pending on public.notifications(created_at) where push_state = 'pending' or email_state = 'pending';
alter table public.notifications enable row level security;
drop policy if exists notif_own on public.notifications;
create policy notif_own on public.notifications for select using (user_id = auth.uid());

-- ---------- Core helper: queue one notification (never raises) ----------
create or replace function public.notify(p_user uuid, p_actor uuid, p_kind text, p_category text, p_title text,
  p_body text, p_url text, p_dedupe text, p_email boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = p_actor then return; end if;
  if p_actor is not null and blocked_between(p_user, p_actor) then return; end if;
  if exists (select 1 from profiles where id = p_user and status in ('suspended','removed')) then return; end if;
  insert into notifications(user_id, actor_id, kind, category, title, body, url, dedupe, email_state)
  values (p_user, p_actor, p_kind, p_category, left(p_title, 120), left(p_body, 200), coalesce(p_url, '/app'), p_dedupe,
          case when p_email then 'pending' else 'skipped' end)
  on conflict (user_id, dedupe) do nothing;
exception when others then
  raise warning 'notify failed: %', sqlerrm;
end $$;
revoke execute on function public.notify(uuid, uuid, text, text, text, text, text, text, boolean) from public, anon, authenticated;

create or replace function public.first_name_of(p uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(first_name, ''), 'A member') from profiles where id = p;
$$;

-- ---------- Triggers: interactions + milestones ----------
-- New conversation: a Note ("like") or a hello. Plus first-chat / 10-chat milestones for both people.
create or replace function public.trg_conversation_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor uuid := coalesce(new.note_from, auth.uid()); other uuid; n int; u uuid;
begin
  begin
    other := case when actor = new.user_a then new.user_b when actor = new.user_b then new.user_a end;
    if new.note_from is not null then
      perform notify(other, actor, 'note', 'interaction', first_name_of(actor) || ' sent you a Note',
        'Open Score to read it and reply.', '/app/messages/' || new.id, 'note:' || new.id, true);
    elsif other is not null then
      perform notify(other, actor, 'new_chat', 'interaction', first_name_of(actor) || ' wants to chat',
        'Say hello back on Score.', '/app/messages/' || new.id, 'chat:' || new.id, false);
    end if;
    foreach u in array array[new.user_a, new.user_b] loop
      select count(*) into n from conversations where u in (user_a, user_b);
      if n = 1 then
        perform notify(u, null, 'ms_first_chat', 'milestone', 'Your first conversation on Score',
          'Nice start. A good opener is a question about their money values.', '/app/messages/' || new.id, 'ms:first_chat');
      elsif n = 10 then
        perform notify(u, null, 'ms_ten_chats', 'milestone', '10 conversations',
          'You''re in demand. Suggest a date with the ones you like most.', '/app/messages', 'ms:ten_chats');
      end if;
    end loop;
  exception when others then raise warning 'conversation notify: %', sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists conversation_notify on public.conversations;
create trigger conversation_notify after insert on public.conversations for each row execute function public.trg_conversation_notify();

-- New message: at most one push per conversation every 10 minutes. No message text (privacy).
-- Email stays with the existing "unread messages" digest.
create or replace function public.trg_message_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare c conversations; other uuid;
begin
  begin
    select * into c from conversations where id = new.conversation_id;
    other := case when new.sender_id = c.user_a then c.user_b else c.user_a end;
    -- The first message of a Note is already covered by the Note notification.
    if c.note_from = new.sender_id and exists (select 1 from notifications where user_id = other and dedupe = 'note:' || c.id) then
      return new;
    end if;
    perform notify(other, new.sender_id, 'message', 'interaction', 'New message from ' || first_name_of(new.sender_id),
      'Open Score to read and reply.', '/app/messages/' || c.id,
      'msg:' || c.id || ':' || floor(extract(epoch from new.created_at) / 600)::bigint);
  exception when others then raise warning 'message notify: %', sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists message_notify on public.messages;
create trigger message_notify after insert on public.messages for each row execute function public.trg_message_notify();

-- Dates: suggested, accepted, declined, cancelled. First accepted date is a milestone.
create or replace function public.trg_date_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare c conversations; other uuid; actor uuid; target uuid; whenx text; n int; u uuid;
begin
  begin
    select * into c from conversations where id = new.conversation_id;
    other := case when new.proposer_id = c.user_a then c.user_b else c.user_a end;
    whenx := to_char(new.starts_at at time zone 'America/New_York', 'Dy Mon FMDD "at" FMHH12:MI am');
    if tg_op = 'INSERT' then
      perform notify(other, new.proposer_id, 'date_proposed', 'interaction', first_name_of(new.proposer_id) || ' suggested a date',
        new.place || ' · ' || whenx, '/app/messages/' || c.id, 'date:' || new.id || ':proposed', true);
    elsif new.status is distinct from old.status then
      actor := coalesce(auth.uid(), other);
      target := case when actor = new.proposer_id then other else new.proposer_id end;
      if new.status = 'accepted' then
        perform notify(new.proposer_id, other, 'date_accepted', 'interaction', first_name_of(other) || ' said yes',
          new.place || ' · ' || whenx || '. Share it with a friend for safety.', '/app/messages/' || c.id, 'date:' || new.id || ':accepted', true);
        foreach u in array array[c.user_a, c.user_b] loop
          select count(*) into n from date_plans d join conversations x on x.id = d.conversation_id
            where d.status = 'accepted' and u in (x.user_a, x.user_b);
          if n = 1 then
            perform notify(u, null, 'ms_first_date', 'milestone', 'Your first Score date is set',
              'Have fun. Remember you can share the details with a friend.', '/app/messages/' || c.id, 'ms:first_date');
          end if;
        end loop;
      elsif new.status = 'declined' then
        perform notify(new.proposer_id, other, 'date_declined', 'interaction', first_name_of(other) || ' can''t make that one',
          'Try another time or place.', '/app/messages/' || c.id, 'date:' || new.id || ':declined');
      elsif new.status = 'cancelled' and old.status = 'accepted' then
        perform notify(target, actor, 'date_cancelled', 'interaction', first_name_of(actor) || ' cancelled your date',
          new.place || ' · ' || whenx, '/app/messages/' || c.id, 'date:' || new.id || ':cancelled', true);
      end if;
    end if;
  exception when others then raise warning 'date notify: %', sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists date_notify on public.date_plans;
create trigger date_notify after insert or update of status on public.date_plans for each row execute function public.trg_date_notify();

-- A friend you invited joined.
create or replace function public.trg_invite_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.redeemed_by is not null and old.redeemed_by is null and new.inviter_id is not null then
      perform notify(new.inviter_id, new.redeemed_by, 'friend_joined', 'interaction',
        case when new.kind = 'friend' then 'Your friend joined Score' else 'Someone you invited joined Score' end,
        'They''re verifying now. You''ll see them once they''re approved.', '/app/invites', 'invite:' || new.code, true);
    end if;
  exception when others then raise warning 'invite notify: %', sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists invite_notify on public.invites;
create trigger invite_notify after update of redeemed_by on public.invites for each row execute function public.trg_invite_notify();

-- Off the waitlist for an event.
create or replace function public.trg_rsvp_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare e events;
begin
  begin
    if new.status = 'going' and old.status = 'waitlist' then
      select * into e from events where id = new.event_id;
      perform notify(new.user_id, null, 'waitlist_in', 'interaction', 'You''re in: ' || e.title,
        'A spot opened up. See you there.', '/app/events/' || e.id, 'rsvp:' || e.id || ':in', true);
    end if;
  exception when others then raise warning 'rsvp notify: %', sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists rsvp_notify on public.event_rsvps;
create trigger rsvp_notify after update of status on public.event_rsvps for each row execute function public.trg_rsvp_notify();

-- Credit band trending up.
create or replace function public.trg_trend_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.trend = 'up' and old.trend is distinct from 'up' then
      perform notify(new.id, null, 'ms_trend_up', 'milestone', 'Your credit is trending up',
        'Your profile now shows an upward trend. Nice work.', '/app/settings',
        'ms:trend_up:' || to_char(now(), 'YYYY-MM'));
    end if;
  exception when others then raise warning 'trend notify: %', sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists trend_notify on public.profiles;
create trigger trend_notify after update of trend on public.profiles for each row execute function public.trg_trend_notify();

-- ---------- Member functions ----------
create or replace function public.touch_active() returns void
language sql security definer set search_path = public as $$
  update profiles set last_active_at = now() where id = auth.uid();
$$;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_platform text, p_ua text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into push_subscriptions(endpoint, user_id, p256dh, auth, platform, user_agent)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, coalesce(nullif(p_platform, ''), 'web'), left(p_ua, 300))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    platform = excluded.platform, user_agent = excluded.user_agent;
end $$;

create or replace function public.delete_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

create or replace function public.mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

create or replace function public.unread_notifications() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from notifications where user_id = auth.uid() and read_at is null;
$$;

-- ---------- Server functions (need the server secret) ----------
-- Claim pending notifications and decide channels. p_actor limits it to what one member just caused
-- (instant delivery after an action); null = everything due (scheduled run).
create or replace function public.claim_notifications(p_secret text, p_actor uuid default null, p_limit int default 300) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare out jsonb; quiet boolean := extract(hour from now() at time zone 'America/New_York') >= 22
                                   or extract(hour from now() at time zone 'America/New_York') < 8;
begin
  perform check_server_secret(p_secret);
  with due as (
    select n.id from notifications n
    left join notify_prefs np on np.user_id = n.user_id
    where (n.push_state = 'pending' or n.email_state = 'pending')
      and n.created_at > now() - interval '2 days'
      and (p_actor is null or n.actor_id = p_actor)
      -- Quiet hours hold reminders, milestones and nudges until 8am New York.
      and not (quiet and coalesce(np.quiet_hours, true) and n.category <> 'interaction')
    order by n.created_at
    limit p_limit
    for update of n skip locked
  ),
  decided as (
    select n.id, n.user_id, n.kind, n.category, n.title, n.body, n.url,
      (n.push_state = 'pending' and exists (select 1 from push_subscriptions s where s.user_id = n.user_id)
        and case n.category when 'interaction' then coalesce(np.push_interactions, true)
                            when 'reminder' then coalesce(np.push_reminders, true)
                            when 'milestone' then coalesce(np.push_milestones, true)
                            else coalesce(np.push_nudges, true) end) as do_push,
      (n.email_state = 'pending'
        and case when n.category = 'interaction' then coalesce(ep.messages, true)
                 when n.kind in ('event_tomorrow','waitlist_in') then coalesce(ep.events, true)
                 when n.category = 'reminder' then coalesce(ep.reminders, true)
                 when n.category = 'milestone' then coalesce(np.email_milestones, false) and coalesce(ep.reminders, true)
                 else coalesce(np.email_nudges, true) and coalesce(ep.reminders, true) end) as do_email,
      coalesce(p.email, au.email) as email, p.first_name
    from due d join notifications n on n.id = d.id
    join profiles p on p.id = n.user_id join auth.users au on au.id = n.user_id
    left join notify_prefs np on np.user_id = n.user_id
    left join email_prefs ep on ep.user_id = n.user_id
  ),
  upd as (
    update notifications n set
      push_state = case when n.push_state = 'pending' then case when d.do_push then 'sent' else 'skipped' end else n.push_state end,
      email_state = case when n.email_state = 'pending' then case when d.do_email and d.email is not null then 'sent' else 'skipped' end else n.email_state end
    from decided d where d.id = n.id
    returning n.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id, 'user_id', d.user_id, 'kind', d.kind, 'category', d.category, 'title', d.title, 'body', d.body, 'url', d.url,
      'first_name', d.first_name, 'email', case when d.do_email then d.email end,
      'subs', case when d.do_push then (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
                                        from push_subscriptions s where s.user_id = d.user_id) end)), '[]')
  into out from decided d where d.id in (select id from upd);
  return out;
end $$;

create or replace function public.push_result(p_secret text, p_endpoint text, p_ok boolean) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  perform check_server_secret(p_secret);
  if p_ok then update push_subscriptions set last_ok_at = now() where endpoint = p_endpoint;
  else delete from push_subscriptions where endpoint = p_endpoint; end if;   -- expired / unsubscribed
end $$;

-- Reminders and milestones on a schedule. p_job: 'frequent' (every 30 min) or 'daily'.
create or replace function public.queue_scheduled_notifications(p_secret text, p_job text) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare r record; cnt int := 0;
begin
  perform check_server_secret(p_secret);

  if p_job = 'frequent' then
    -- Unread messages for 3+ hours: one push a day.
    for r in
      select x.uid, count(*) n from (
        select c.id cid, v.uid, case when v.uid = c.user_a then c.user_b else c.user_a end other
        from conversations c cross join lateral (values (c.user_a), (c.user_b)) v(uid)) x
      join messages m on m.conversation_id = x.cid and m.sender_id = x.other
      left join conversation_reads cr on cr.user_id = x.uid and cr.conversation_id = x.cid
      where m.created_at < now() - interval '3 hours' and m.created_at > now() - interval '7 days'
        and m.created_at > coalesce(cr.last_read_at, '-infinity') and not blocked_between(x.uid, x.other)
      group by x.uid
    loop
      perform notify(r.uid, null, 'unread', 'reminder',
        case when r.n = 1 then 'You have an unread message' else 'You have ' || r.n || ' unread messages' end,
        'Don''t leave them waiting.', '/app/messages', 'unread:' || current_date);
      cnt := cnt + 1;
    end loop;

    -- Event tomorrow.
    for r in select v.user_id, e.id, e.title, e.venue, e.starts_at from event_rsvps v join events e on e.id = v.event_id
             where v.status = 'going' and e.status = 'published' and e.starts_at between now() + interval '20 hours' and now() + interval '28 hours'
    loop
      perform notify(r.user_id, null, 'event_tomorrow', 'reminder', 'Tomorrow: ' || r.title,
        r.venue || ' · ' || to_char(r.starts_at at time zone 'America/New_York', 'FMHH12:MI am'), '/app/events/' || r.id, 'event:' || r.id || ':24h', true);
      cnt := cnt + 1;
    end loop;

    -- Date tomorrow, date in 2 hours, and a check-in afterwards (both people).
    for r in select d.id, d.place, d.starts_at, d.conversation_id cid, v.uid,
               case when v.uid = c.user_a then c.user_b else c.user_a end other
             from date_plans d join conversations c on c.id = d.conversation_id
             cross join lateral (values (c.user_a), (c.user_b)) v(uid)
             where d.status = 'accepted' and d.starts_at between now() - interval '12 hours' and now() + interval '28 hours'
    loop
      if r.starts_at between now() + interval '20 hours' and now() + interval '28 hours' then
        perform notify(r.uid, null, 'date_tomorrow', 'reminder', 'Date tomorrow with ' || first_name_of(r.other),
          r.place || ' · ' || to_char(r.starts_at at time zone 'America/New_York', 'FMHH12:MI am'), '/app/messages/' || r.cid, 'date:' || r.id || ':24h', true);
      elsif r.starts_at between now() + interval '30 minutes' and now() + interval '2 hours 30 minutes' then
        perform notify(r.uid, null, 'date_soon', 'reminder', 'Your date is coming up',
          r.place || ' at ' || to_char(r.starts_at at time zone 'America/New_York', 'FMHH12:MI am') || '. Share the details with a friend.',
          '/app/messages/' || r.cid, 'date:' || r.id || ':2h');
      elsif r.starts_at between now() - interval '12 hours' and now() - interval '3 hours'
            and not exists (select 1 from date_checkins ci where ci.plan_id = r.id and ci.user_id = r.uid) then
        perform notify(r.uid, null, 'date_checkin', 'reminder', 'How did it go with ' || first_name_of(r.other) || '?',
          'Tap to check in. It only takes a second.', '/app', 'date:' || r.id || ':checkin');
      end if;
      cnt := cnt + 1;
    end loop;

    -- Preview ending within a day, Spotlight ending within ~30 minutes.
    for r in select id, preview_ends_at from profiles where plan = 'preview' and preview_ends_at between now() and now() + interval '24 hours' loop
      perform notify(r.id, null, 'preview_ending', 'reminder', 'Your Preview ends tomorrow',
        'Pick a plan to keep your matches and messages.', '/plans', 'preview:' || r.preview_ends_at::date);
    end loop;
    for r in select id, spotlight_until from profiles where spotlight_until between now() and now() + interval '35 minutes' loop
      perform notify(r.id, null, 'spotlight_ending', 'reminder', 'Your Spotlight ends soon',
        'Extend it to stay at the top of today''s Drops.', '/app/shop', 'spot:' || extract(epoch from r.spotlight_until)::bigint);
    end loop;

  elsif p_job = 'daily' then
    -- One month as a member.
    for r in select id from profiles where status = 'active' and plan in ('membership','premium','black')
             and created_at between now() - interval '31 days' and now() - interval '30 days' loop
      perform notify(r.id, null, 'ms_one_month', 'milestone', 'One month on Score',
        'Thanks for being here. Refresh your photos or prompt to stand out in new Drops.', '/app/profile', 'ms:one_month');
    end loop;
    -- Win-back: away 3+ days, at most once a week, only if there's something waiting.
    for r in
      select p.id,
        (select count(*) from messages m join conversations c on c.id = m.conversation_id
          left join conversation_reads cr on cr.user_id = p.id and cr.conversation_id = c.id
          where p.id in (c.user_a, c.user_b) and m.sender_id <> p.id and m.created_at > coalesce(cr.last_read_at, '-infinity')) unread,
        (select count(*) from conversations c where p.id in (c.user_a, c.user_b) and c.created_at > coalesce(p.last_active_at, p.created_at)) new_chats
      from profiles p
      where p.status in ('active','preview') and coalesce(p.last_active_at, p.created_at) < now() - interval '3 days'
        -- Stop after ~4 weeks away: no endless nagging.
        and coalesce(p.last_active_at, p.created_at) > now() - interval '30 days'
    loop
      if r.unread > 0 or r.new_chats > 0 then
        perform notify(r.id, null, 'nudge', 'nudge',
          case when r.unread > 0 then 'You have ' || r.unread || ' unread message' || case when r.unread > 1 then 's' else '' end
               else r.new_chats || ' new conversation' || case when r.new_chats > 1 then 's' else '' end end,
          'Catch up whenever you have a minute.', '/app/messages', 'nudge:' || to_char(now(), 'IYYY-IW'), true);
      else
        perform notify(r.id, null, 'nudge', 'nudge', 'Your Drop is waiting',
          'Today''s Drop is ready whenever you are.', '/app', 'nudge:' || to_char(now(), 'IYYY-IW'), true);
      end if;
      cnt := cnt + 1;
    end loop;
    -- Keep the table small.
    delete from notifications where created_at < now() - interval '90 days';
  end if;
  return jsonb_build_object('queued', cnt);
end $$;

grant execute on function public.touch_active(), public.save_push_subscription(text, text, text, text, text),
  public.delete_push_subscription(text), public.mark_notifications_read(), public.unread_notifications() to authenticated;
grant execute on function public.claim_notifications(text, uuid, int), public.push_result(text, text, boolean),
  public.queue_scheduled_notifications(text, text) to anon, authenticated;
