-- Add-ons (extra connections, Spotlight, Notes), automatic emails + preferences, date plans + safety,
-- and member events. Run after 0006.

-- ======================================================================
-- Add-ons
-- ======================================================================
-- Credits a member holds. Black members don't use credits: everything is included.
create table if not exists public.addon_credits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('extra_drop','spotlight','note')),
  balance int not null default 0 check (balance >= 0),
  primary key (user_id, kind)
);
alter table public.addon_credits enable row level security;
drop policy if exists credits_own on public.addon_credits;
create policy credits_own on public.addon_credits for select using (user_id = auth.uid() or public.is_staff());

-- Every purchase (test mode now; App Store / Google Play / Stripe later) and every use.
create table if not exists public.addon_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  change int not null,                 -- +n bought, -1 used
  source text not null,                -- 'test' | 'apple' | 'google' | 'stripe' | 'use' | 'included'
  amount_cents int,
  ref text,
  created_at timestamptz not null default now()
);
alter table public.addon_ledger enable row level security;
drop policy if exists ledger_own on public.addon_ledger;
create policy ledger_own on public.addon_ledger for select using (user_id = auth.uid() or public.is_staff());

-- Spotlight: you're shown first in Drops in your area until this time.
alter table public.profiles add column if not exists spotlight_until timestamptz;

-- Notes: a conversation opened with a Note is highlighted for the receiver.
alter table public.conversations add column if not exists note_from uuid references public.profiles(id) on delete set null;

-- Catalog (prices in cents, shown in the app; stores set the real price for in-app purchases).
create or replace function public.addon_catalog() returns jsonb language sql immutable as $$
  select '[
    {"sku":"extra_drop_1","kind":"extra_drop","qty":1,"cents":299,"label":"Extra connections","detail":"5 more profiles in today''s Drop"},
    {"sku":"spotlight_1","kind":"spotlight","qty":1,"cents":499,"label":"Spotlight","detail":"Shown first in Drops near you for 1 hour"},
    {"sku":"note_1","kind":"note","qty":1,"cents":199,"label":"Note","detail":"Send a message with your like so it stands out"},
    {"sku":"note_5","kind":"note","qty":5,"cents":699,"label":"5 Notes","detail":"Five Notes, save 30%"}
  ]'::jsonb;
$$;
grant execute on function public.addon_catalog() to anon, authenticated;

create or replace function public.has_all_addons(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select plan = 'black' from profiles where id = p_user), false);
$$;

-- Buy an add-on. Test mode only for now (no money moves).
create or replace function public.buy_addon(p_sku text) returns int
language plpgsql security definer set search_path = public as $$
declare item jsonb; uid uuid := auth.uid(); bal int;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if not test_mode() then raise exception 'payments not connected yet'; end if;
  select x into item from jsonb_array_elements(addon_catalog()) x where x->>'sku' = p_sku;
  if item is null then raise exception 'unknown item'; end if;
  if (select status from profiles where id = uid) not in ('active','preview') then raise exception 'finish joining first'; end if;
  insert into addon_credits(user_id, kind, balance) values (uid, item->>'kind', (item->>'qty')::int)
    on conflict (user_id, kind) do update set balance = addon_credits.balance + excluded.balance
    returning balance into bal;
  insert into addon_ledger(user_id, kind, change, source, amount_cents, ref) values (uid, item->>'kind', (item->>'qty')::int, 'test', (item->>'cents')::int, p_sku);
  return bal;
end $$;

-- Server-side grant after a verified store/Stripe purchase.
create or replace function public.grant_addon(p_secret text, p_user uuid, p_sku text, p_source text, p_ref text) returns void
language plpgsql security definer set search_path = public, private as $$
declare item jsonb;
begin
  if p_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  if exists (select 1 from addon_ledger where ref = p_ref and source = p_source) then return; end if;  -- idempotent
  select x into item from jsonb_array_elements(addon_catalog()) x where x->>'sku' = p_sku;
  if item is null then raise exception 'unknown item'; end if;
  insert into addon_credits(user_id, kind, balance) values (p_user, item->>'kind', (item->>'qty')::int)
    on conflict (user_id, kind) do update set balance = addon_credits.balance + excluded.balance;
  insert into addon_ledger(user_id, kind, change, source, amount_cents, ref) values (p_user, item->>'kind', (item->>'qty')::int, p_source, (item->>'cents')::int, p_ref);
end $$;

-- Internal: use one credit (or record an included use for Black). Raises if none left.
create or replace function public.spend_addon(p_user uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if has_all_addons(p_user) then
    insert into addon_ledger(user_id, kind, change, source) values (p_user, p_kind, 0, 'included');
    return;
  end if;
  update addon_credits set balance = balance - 1 where user_id = p_user and kind = p_kind and balance > 0;
  if not found then raise exception 'no % left', replace(p_kind, '_', ' '); end if;
  insert into addon_ledger(user_id, kind, change, source) values (p_user, p_kind, -1, 'use');
end $$;
revoke execute on function public.spend_addon(uuid, text) from public, anon, authenticated;

-- Daily Drop (replaces 0001): members in Spotlight are placed first.
create or replace function public.get_drop() returns setof public.drops
language plpgsql security definer set search_path = public as $$
declare me profiles; n int;
begin
  select * into me from profiles where id = auth.uid();
  if me.status not in ('active','preview') then return; end if;
  if not exists (select 1 from drops where user_id = me.id and drop_date = current_date) then
    n := case when me.plan in ('premium','black') then 10 else 5 end;
    perform fill_drop(me, n);
  end if;
  return query select * from drops where user_id = me.id and drop_date = current_date order by compat desc;
end $$;

create or replace function public.fill_drop(me profiles, n int) returns int
language plpgsql security definer set search_path = public as $$
declare added int;
begin
  insert into drops(user_id, match_id, compat)
  select me.id, c.id, c.compat from (
    select p.id, p.spotlight_until,
      least(99, 40
        + coalesce(10 * cardinality(array(select unnest(p.money_values) intersect select unnest(me.money_values))), 0)
        + case when p.band = me.band then 20 when p.band is null or me.band is null then 0 else 10 end
        + case when p.trend = 'up' then 5 else 0 end) compat
    from profiles p
    where p.id <> me.id and p.status in ('active','preview') and p.band is not null and p.id_status = 'approved'
      and (cardinality(me.seeking) = 0 or p.gender = any(me.seeking))
      and (cardinality(p.seeking) = 0 or me.gender = any(p.seeking))
      and not exists (select 1 from blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
      and not exists (select 1 from drops d where d.user_id = me.id and d.match_id = p.id and d.drop_date > current_date - 30)
  ) c
  order by (c.spotlight_until > now()) is true desc, c.compat desc, random()
  limit n
  on conflict do nothing;
  get diagnostics added = row_count;
  return added;
end $$;
revoke execute on function public.fill_drop(profiles, int) from public, anon, authenticated;

-- Extra connections: 5 more profiles in today's Drop.
create or replace function public.use_extra_drop() returns int
language plpgsql security definer set search_path = public as $$
declare me profiles; added int;
begin
  select * into me from profiles where id = auth.uid();
  if me.status not in ('active','preview') then raise exception 'not available'; end if;
  perform get_drop();  -- make sure today's Drop exists first
  perform spend_addon(me.id, 'extra_drop');
  added := fill_drop(me, 5);
  if added = 0 then raise exception 'nobody new to show right now, so we didn''t use your credit'; end if;
  return added;
end $$;

-- Spotlight for 1 hour. One at a time.
create or replace function public.use_spotlight() returns timestamptz
language plpgsql security definer set search_path = public as $$
declare me profiles; until timestamptz;
begin
  select * into me from profiles where id = auth.uid();
  if me.status <> 'active' and me.status <> 'preview' then raise exception 'not available'; end if;
  if me.spotlight_until > now() then raise exception 'your Spotlight is already on'; end if;
  perform spend_addon(me.id, 'spotlight');
  until := now() + interval '1 hour';
  update profiles set spotlight_until = until where id = me.id;
  return until;
end $$;

-- Note: open a conversation with a message, even on Preview. Uses one Note.
create or replace function public.send_note(p_other uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me profiles; a uuid; b uuid; cid uuid; them profiles;
begin
  select * into me from profiles where id = auth.uid();
  select * into them from profiles where id = p_other;
  if me.status not in ('active','preview') then raise exception 'not available'; end if;
  if them.id is null or them.status not in ('active','preview') then raise exception 'unavailable'; end if;
  if length(trim(coalesce(p_body, ''))) not between 1 and 500 then raise exception 'write a short note (up to 500 characters)'; end if;
  if blocked_between(me.id, p_other) then raise exception 'unavailable'; end if;
  a := least(me.id, p_other); b := greatest(me.id, p_other);
  select id into cid from conversations where user_a = a and user_b = b;
  if cid is not null then raise exception 'you already have a conversation with them'; end if;
  perform spend_addon(me.id, 'note');
  insert into conversations(user_a, user_b, note_from) values (a, b, me.id) returning id into cid;
  insert into messages(conversation_id, sender_id, body) values (cid, me.id, trim(p_body));
  return cid;
end $$;

-- A Note lets the receiver reply even if they're on Preview; the sender (on Preview) can't keep chatting.
drop policy if exists msg_send on public.messages;
create policy msg_send on public.messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b))
  and (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.plan in ('membership','premium','black','paused'))
    or exists (select 1 from public.conversations c where c.id = conversation_id and c.note_from is not null and c.note_from <> auth.uid())
  )
  and not exists (select 1 from public.blocks b join public.conversations c on c.id = conversation_id
                  where (b.blocker_id = c.user_a and b.blocked_id = c.user_b) or (b.blocker_id = c.user_b and b.blocked_id = c.user_a)));

create or replace function public.my_addons() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'included', has_all_addons(auth.uid()),
    'extra_drop', coalesce((select balance from addon_credits where user_id = auth.uid() and kind = 'extra_drop'), 0),
    'spotlight', coalesce((select balance from addon_credits where user_id = auth.uid() and kind = 'spotlight'), 0),
    'note', coalesce((select balance from addon_credits where user_id = auth.uid() and kind = 'note'), 0),
    'spotlight_until', (select spotlight_until from profiles where id = auth.uid() and spotlight_until > now()));
$$;

revoke execute on function public.grant_addon(text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.grant_addon(text, uuid, text, text, text) to anon, authenticated;  -- guarded by server secret
grant execute on function public.buy_addon(text), public.use_extra_drop(), public.use_spotlight(), public.send_note(uuid, text), public.my_addons() to authenticated;

-- ======================================================================
-- Automatic emails
-- ======================================================================
create table if not exists public.email_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  daily_drop boolean not null default true,
  messages boolean not null default true,
  events boolean not null default true,
  reminders boolean not null default true,      -- Preview ending, re-verify
  updated_at timestamptz not null default now()
);
alter table public.email_prefs enable row level security;
drop policy if exists prefs_own on public.email_prefs;
create policy prefs_own on public.email_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.email_prefs to authenticated;

-- When each automatic email last went out to someone (so nobody gets duplicates).
create table if not exists public.email_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  daily_drop_on date,
  messages_at timestamptz,
  preview_warned_for timestamptz,
  reverify_warned_for timestamptz
);
alter table public.email_state enable row level security;   -- server only

-- Read receipts per conversation (also powers unread badges).
create table if not exists public.conversation_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);
alter table public.conversation_reads enable row level security;
drop policy if exists reads_own on public.conversation_reads;
create policy reads_own on public.conversation_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.conversation_reads to authenticated;

create or replace function public.mark_read(p_conversation uuid) returns void
language sql security definer set search_path = public as $$
  insert into conversation_reads(user_id, conversation_id, last_read_at)
  select auth.uid(), c.id, now() from conversations c where c.id = p_conversation and auth.uid() in (c.user_a, c.user_b)
  on conflict (user_id, conversation_id) do update set last_read_at = now();
$$;
grant execute on function public.mark_read(uuid) to authenticated;

create or replace function public.check_server_secret(p_secret text) returns void
language plpgsql stable security definer set search_path = public, private as $$
begin
  if p_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then raise exception 'forbidden'; end if;
end $$;

-- One-click unsubscribe from a signed link (the server checks the signature, then calls this).
create or replace function public.email_unsubscribe(p_secret text, p_user uuid, p_kind text) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  perform check_server_secret(p_secret);
  insert into email_prefs(user_id) values (p_user) on conflict do nothing;
  update email_prefs set
    daily_drop = case when p_kind in ('all','daily_drop') then false else daily_drop end,
    messages   = case when p_kind in ('all','messages') then false else messages end,
    events     = case when p_kind in ('all','events') then false else events end,
    reminders  = case when p_kind in ('all','reminders') then false else reminders end,
    updated_at = now()
  where user_id = p_user;
end $$;

-- Who should get each automatic email right now. Each call marks people as sent (claims them),
-- so overlapping cron runs can't double-send.
create or replace function public.cron_claim_emails(p_secret text, p_kind text, p_limit int default 500) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare out jsonb := '[]';
begin
  perform check_server_secret(p_secret);

  if p_kind = 'daily_drop' then
    with c as (
      select p.id, coalesce(p.email, u.email) email, p.first_name, case when p.plan in ('premium','black') then 10 else 5 end n
      from profiles p join auth.users u on u.id = p.id
      left join email_prefs ep on ep.user_id = p.id
      left join email_state es on es.user_id = p.id
      where p.status in ('active','preview') and coalesce(ep.daily_drop, true)
        and (es.daily_drop_on is null or es.daily_drop_on < current_date)
      limit p_limit),
    m as (insert into email_state(user_id, daily_drop_on) select id, current_date from c
          on conflict (user_id) do update set daily_drop_on = current_date returning user_id)
    select coalesce(jsonb_agg(jsonb_build_object('user_id', c.id, 'email', c.email, 'first_name', c.first_name, 'count', c.n)), '[]') into out from c;

  elsif p_kind = 'messages' then
    -- Unread messages older than 10 minutes (so active chatters aren't emailed), at most one email every 3 hours.
    with unread as (
      select r.uid, count(*) n, max(m.created_at) latest,
        (array_agg(sp.first_name order by m.created_at desc))[1] from_name,
        (array_agg(m.conversation_id order by m.created_at desc))[1] conversation_id
      from (select c.id cid, x.uid, case when x.uid = c.user_a then c.user_b else c.user_a end other
            from conversations c cross join lateral (values (c.user_a), (c.user_b)) x(uid)) r
      join messages m on m.conversation_id = r.cid and m.sender_id = r.other
      join profiles sp on sp.id = m.sender_id
      left join conversation_reads cr on cr.user_id = r.uid and cr.conversation_id = r.cid
      left join email_state es on es.user_id = r.uid
      where m.created_at < now() - interval '10 minutes'
        and m.created_at > coalesce(cr.last_read_at, '-infinity')
        and m.created_at > coalesce(es.messages_at, '-infinity')
        and not blocked_between(r.uid, r.other)
      group by r.uid),
    c as (
      select u.uid id, coalesce(p.email, au.email) email, p.first_name, u.n, u.from_name, u.conversation_id
      from unread u join profiles p on p.id = u.uid join auth.users au on au.id = u.uid
      left join email_prefs ep on ep.user_id = u.uid
      left join email_state es on es.user_id = u.uid
      where coalesce(ep.messages, true) and p.status not in ('suspended','removed')
        and (es.messages_at is null or es.messages_at < now() - interval '3 hours')
      limit p_limit),
    m as (insert into email_state(user_id, messages_at) select id, now() from c
          on conflict (user_id) do update set messages_at = now() returning user_id)
    select coalesce(jsonb_agg(jsonb_build_object('user_id', c.id, 'email', c.email, 'first_name', c.first_name, 'count', c.n,
      'from_name', c.from_name, 'conversation_id', c.conversation_id)), '[]') into out from c;

  elsif p_kind = 'preview_ending' then
    with c as (
      select p.id, coalesce(p.email, u.email) email, p.first_name, p.preview_ends_at,
        greatest(1, ceil(extract(epoch from p.preview_ends_at - now()) / 86400))::int days_left
      from profiles p join auth.users u on u.id = p.id
      left join email_prefs ep on ep.user_id = p.id
      left join email_state es on es.user_id = p.id
      where p.plan = 'preview' and p.preview_ends_at between now() and now() + interval '3 days'
        and coalesce(ep.reminders, true)
        and es.preview_warned_for is distinct from p.preview_ends_at
      limit p_limit),
    m as (insert into email_state(user_id, preview_warned_for) select id, preview_ends_at from c
          on conflict (user_id) do update set preview_warned_for = excluded.preview_warned_for returning user_id)
    select coalesce(jsonb_agg(jsonb_build_object('user_id', c.id, 'email', c.email, 'first_name', c.first_name, 'days_left', c.days_left)), '[]') into out from c;

  elsif p_kind = 'reverify' then
    with c as (
      select p.id, coalesce(p.email, u.email) email, p.first_name, p.credit_verified_at,
        to_char(p.credit_verified_at + interval '6 months', 'FMMonth FMDD') due
      from profiles p join auth.users u on u.id = p.id
      left join email_prefs ep on ep.user_id = p.id
      left join email_state es on es.user_id = p.id
      where p.status in ('active','preview','paused') and p.credit_verified_at is not null
        and p.credit_verified_at < now() - interval '6 months' + interval '14 days'
        and coalesce(ep.reminders, true)
        and es.reverify_warned_for is distinct from p.credit_verified_at
      limit p_limit),
    m as (insert into email_state(user_id, reverify_warned_for) select id, credit_verified_at from c
          on conflict (user_id) do update set reverify_warned_for = excluded.reverify_warned_for returning user_id)
    select coalesce(jsonb_agg(jsonb_build_object('user_id', c.id, 'email', c.email, 'first_name', c.first_name, 'due', c.due)), '[]') into out from c;

  else
    raise exception 'unknown kind';
  end if;
  return out;
end $$;

-- Expire Previews and Spotlights (run by the same cron).
create or replace function public.cron_housekeeping(p_secret text) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare expired int;
begin
  perform check_server_secret(p_secret);
  update profiles set plan = 'none', status = 'onboarding' where plan = 'preview' and preview_ends_at < now();
  get diagnostics expired = row_count;
  update profiles set spotlight_until = null where spotlight_until < now() - interval '1 day';
  return jsonb_build_object('previews_ended', expired);
end $$;

grant execute on function public.email_unsubscribe(text, uuid, text), public.cron_claim_emails(text, text, int), public.cron_housekeeping(text) to anon, authenticated;
revoke execute on function public.check_server_secret(text) from public, anon, authenticated;

-- ======================================================================
-- Date plans + safety
-- ======================================================================
create table if not exists public.date_plans (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  proposer_id uuid not null references public.profiles(id) on delete cascade,
  place text not null check (length(place) between 2 and 120),
  address text check (length(address) <= 200),
  starts_at timestamptz not null,
  note text check (length(note) <= 300),
  status text not null default 'proposed' check (status in ('proposed','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index if not exists date_plans_conv on public.date_plans(conversation_id, created_at desc);
alter table public.date_plans enable row level security;
drop policy if exists dates_member on public.date_plans;
create policy dates_member on public.date_plans for select using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)) or public.is_staff());

-- A safety share: a private link a member can send a friend. Shows place, time, and their match's first name.
create table if not exists public.date_shares (
  token text primary key default encode(gen_random_bytes(18), 'hex'),
  plan_id uuid not null references public.date_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_name text check (length(friend_name) <= 60),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked boolean not null default false,
  unique (plan_id, user_id)
);
alter table public.date_shares enable row level security;
drop policy if exists shares_own on public.date_shares;
create policy shares_own on public.date_shares for select using (user_id = auth.uid());

create table if not exists public.date_checkins (
  plan_id uuid not null references public.date_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('safe','not_great','report')),
  created_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);
alter table public.date_checkins enable row level security;
drop policy if exists checkins_own on public.date_checkins;
create policy checkins_own on public.date_checkins for select using (user_id = auth.uid() or public.is_staff());

create or replace function public.propose_date(p_conversation uuid, p_place text, p_address text, p_starts_at timestamptz, p_note text) returns uuid
language plpgsql security definer set search_path = public as $$
declare c conversations; pid uuid; uid uuid := auth.uid();
begin
  select * into c from conversations where id = p_conversation;
  if c.id is null or uid not in (c.user_a, c.user_b) then raise exception 'not found'; end if;
  if blocked_between(c.user_a, c.user_b) then raise exception 'unavailable'; end if;
  if p_starts_at < now() + interval '30 minutes' then raise exception 'pick a time at least 30 minutes from now'; end if;
  if p_starts_at > now() + interval '60 days' then raise exception 'pick a date in the next two months'; end if;
  update date_plans set status = 'cancelled', responded_at = now() where conversation_id = c.id and status = 'proposed';
  insert into date_plans(conversation_id, proposer_id, place, address, starts_at, note)
    values (c.id, uid, trim(p_place), nullif(trim(coalesce(p_address, '')), ''), p_starts_at, nullif(trim(coalesce(p_note, '')), ''))
    returning id into pid;
  return pid;
end $$;

create or replace function public.respond_date(p_plan uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare d date_plans; c conversations; uid uuid := auth.uid();
begin
  select * into d from date_plans where id = p_plan;
  select * into c from conversations where id = d.conversation_id;
  if d.id is null or uid not in (c.user_a, c.user_b) then raise exception 'not found'; end if;
  if p_status = 'cancelled' then
    if d.status not in ('proposed','accepted') then raise exception 'already closed'; end if;
  elsif p_status in ('accepted','declined') then
    if d.proposer_id = uid then raise exception 'waiting on them to answer'; end if;
    if d.status <> 'proposed' then raise exception 'already answered'; end if;
  else raise exception 'unknown'; end if;
  update date_plans set status = p_status, responded_at = now() where id = p_plan;
end $$;

create or replace function public.share_date(p_plan uuid, p_friend text) returns text
language plpgsql security definer set search_path = public as $$
declare d date_plans; c conversations; uid uuid := auth.uid(); t text;
begin
  select * into d from date_plans where id = p_plan;
  select * into c from conversations where id = d.conversation_id;
  if d.id is null or uid not in (c.user_a, c.user_b) then raise exception 'not found'; end if;
  if d.status <> 'accepted' then raise exception 'share once the date is confirmed'; end if;
  insert into date_shares(plan_id, user_id, friend_name, expires_at)
    values (d.id, uid, nullif(trim(coalesce(p_friend, '')), ''), d.starts_at + interval '1 day')
    on conflict (plan_id, user_id) do update set revoked = false, friend_name = excluded.friend_name, expires_at = excluded.expires_at
    returning token into t;
  return t;
end $$;

create or replace function public.revoke_date_share(p_plan uuid) returns void
language sql security definer set search_path = public as $$
  update date_shares set revoked = true where plan_id = p_plan and user_id = auth.uid();
$$;

-- What a friend sees from the link. Public on purpose, but only for a valid, unexpired, unrevoked token.
create or replace function public.view_date_share(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'member', me.first_name,
    'match', them.first_name,
    'match_age', case when them.birth_year is null then null else extract(year from now())::int - them.birth_year end,
    'place', d.place, 'address', d.address, 'starts_at', d.starts_at, 'status', d.status,
    'checkin', (select status from date_checkins ci where ci.plan_id = d.id and ci.user_id = s.user_id),
    'checkin_at', (select created_at from date_checkins ci where ci.plan_id = d.id and ci.user_id = s.user_id))
  from date_shares s
  join date_plans d on d.id = s.plan_id
  join conversations c on c.id = d.conversation_id
  join profiles me on me.id = s.user_id
  join profiles them on them.id = case when c.user_a = s.user_id then c.user_b else c.user_a end
  where s.token = p_token and not s.revoked and s.expires_at > now();
$$;

create or replace function public.date_checkin(p_plan uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare d date_plans; c conversations; uid uuid := auth.uid();
begin
  select * into d from date_plans where id = p_plan;
  select * into c from conversations where id = d.conversation_id;
  if d.id is null or uid not in (c.user_a, c.user_b) then raise exception 'not found'; end if;
  if p_status not in ('safe','not_great','report') then raise exception 'unknown'; end if;
  insert into date_checkins(plan_id, user_id, status) values (p_plan, uid, p_status)
    on conflict (plan_id, user_id) do update set status = excluded.status, created_at = now();
end $$;

-- Accepted dates that started 2+ hours ago and still need my check-in (shown as a banner in the app).
create or replace function public.pending_checkins() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('plan_id', d.id, 'place', d.place, 'starts_at', d.starts_at,
    'conversation_id', c.id, 'match', them.first_name, 'other_id', them.id) order by d.starts_at desc), '[]')
  from date_plans d
  join conversations c on c.id = d.conversation_id
  join profiles them on them.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
  where auth.uid() in (c.user_a, c.user_b) and d.status = 'accepted'
    and d.starts_at between now() - interval '3 days' and now() - interval '2 hours'
    and not exists (select 1 from date_checkins ci where ci.plan_id = d.id and ci.user_id = auth.uid());
$$;

grant execute on function public.propose_date(uuid, text, text, timestamptz, text), public.respond_date(uuid, text),
  public.share_date(uuid, text), public.revoke_date_share(uuid), public.date_checkin(uuid, text), public.pending_checkins() to authenticated;
grant execute on function public.view_date_share(text) to anon, authenticated;

-- ======================================================================
-- Member events
-- ======================================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 3 and 100),
  description text check (length(description) <= 2000),
  venue text not null check (length(venue) <= 120),
  address text check (length(address) <= 200),
  area text not null default 'New York City',
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity int not null default 40 check (capacity between 1 and 2000),
  price_note text check (length(price_note) <= 80),        -- e.g. "Free for members" or "$40, pay at the door"
  black_priority_hours int not null default 48 check (black_priority_hours between 0 and 336),
  status text not null default 'draft' check (status in ('draft','published','cancelled')),
  published_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
drop policy if exists events_read on public.events;
create policy events_read on public.events for select to authenticated using (
  (status in ('published','cancelled') and public.my_status() in ('active','preview','paused','taken')) or public.is_staff());

create table if not exists public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('going','waitlist','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_rsvps enable row level security;
drop policy if exists rsvps_own on public.event_rsvps;
create policy rsvps_own on public.event_rsvps for select using (user_id = auth.uid() or public.is_staff());

create or replace function public.event_counts(p_event uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'going', count(*) filter (where status = 'going'),
    'waitlist', count(*) filter (where status = 'waitlist'))
  from event_rsvps where event_id = p_event;
$$;

-- RSVP. Paying members only. Black members get the first black_priority_hours after publishing.
create or replace function public.rsvp_event(p_event uuid, p_going boolean) returns text
language plpgsql security definer set search_path = public as $$
declare e events; me profiles; going int; st text; promoted uuid;
begin
  select * into me from profiles where id = auth.uid();
  select * into e from events where id = p_event for update;
  if e.id is null or e.status <> 'published' then raise exception 'event not available'; end if;
  if e.starts_at < now() then raise exception 'this event already started'; end if;

  if not p_going then
    update event_rsvps set status = 'cancelled', updated_at = now() where event_id = e.id and user_id = me.id and status <> 'cancelled';
    -- Move the first person on the waitlist into the open spot.
    select user_id into promoted from event_rsvps where event_id = e.id and status = 'waitlist' order by created_at limit 1;
    if promoted is not null and (select count(*) from event_rsvps where event_id = e.id and status = 'going') < e.capacity then
      update event_rsvps set status = 'going', updated_at = now() where event_id = e.id and user_id = promoted;
    end if;
    return 'cancelled';
  end if;

  if me.plan not in ('membership','premium','black') then raise exception 'events are for members. Pick a plan to RSVP.'; end if;
  if me.plan <> 'black' and e.published_at + make_interval(hours => e.black_priority_hours) > now() then
    raise exception 'Black members get first access. RSVPs open to everyone %', to_char((e.published_at + make_interval(hours => e.black_priority_hours)) at time zone 'America/New_York', 'FMDay at FMHH12:MI am');
  end if;
  select count(*) into going from event_rsvps where event_id = e.id and status = 'going' and user_id <> me.id;
  st := case when going < e.capacity then 'going' else 'waitlist' end;
  insert into event_rsvps(event_id, user_id, status) values (e.id, me.id, st)
    on conflict (event_id, user_id) do update set status = case when event_rsvps.status = 'going' then 'going' else excluded.status end, updated_at = now()
    returning status into st;
  return st;
end $$;

create or replace function public.staff_save_event(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare who text := staff_email(); eid uuid := nullif(p->>'id', '')::uuid; st text := coalesce(p->>'status', 'draft');
begin
  if not is_staff() then raise exception 'staff only'; end if;
  if eid is null then
    insert into events(title, description, venue, address, area, starts_at, ends_at, capacity, price_note, black_priority_hours, status, published_at)
    values (p->>'title', nullif(p->>'description',''), p->>'venue', nullif(p->>'address',''), coalesce(nullif(p->>'area',''), 'New York City'),
      (p->>'starts_at')::timestamptz, nullif(p->>'ends_at','')::timestamptz, coalesce(nullif(p->>'capacity','')::int, 40),
      nullif(p->>'price_note',''), coalesce(nullif(p->>'black_priority_hours','')::int, 48), st,
      case when st = 'published' then now() end)
    returning id into eid;
  else
    update events set title = p->>'title', description = nullif(p->>'description',''), venue = p->>'venue', address = nullif(p->>'address',''),
      area = coalesce(nullif(p->>'area',''), area), starts_at = (p->>'starts_at')::timestamptz, ends_at = nullif(p->>'ends_at','')::timestamptz,
      capacity = coalesce(nullif(p->>'capacity','')::int, capacity), price_note = nullif(p->>'price_note',''),
      black_priority_hours = coalesce(nullif(p->>'black_priority_hours','')::int, black_priority_hours),
      status = st, published_at = case when st = 'published' then coalesce(published_at, now()) else published_at end
    where id = eid;
  end if;
  insert into audit_log(staff_email, action, reason) values (who, 'event_' || st, p->>'title');
  return eid;
end $$;

create or replace function public.staff_event_rsvps(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'name', p.first_name, 'plan', p.plan, 'band', p.band,
      'status', r.status, 'at', r.created_at) order by r.status, r.created_at)
    from event_rsvps r join profiles p on p.id = r.user_id where r.event_id = p_event), '[]');
end $$;

-- People to email when an event is published (members who opted in to event emails).
create or replace function public.event_audience(p_secret text, p_event uuid, p_black_only boolean) returns jsonb
language plpgsql security definer set search_path = public, private as $$
begin
  perform check_server_secret(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', p.id, 'email', coalesce(p.email, u.email), 'first_name', p.first_name))
    from profiles p join auth.users u on u.id = p.id left join email_prefs ep on ep.user_id = p.id
    where p.plan in ('membership','premium','black') and p.status = 'active' and coalesce(ep.events, true)
      and (not p_black_only or p.plan = 'black')), '[]');
end $$;

grant execute on function public.event_counts(uuid), public.rsvp_event(uuid, boolean), public.staff_save_event(jsonb), public.staff_event_rsvps(uuid) to authenticated;
grant execute on function public.event_audience(text, uuid, boolean) to anon, authenticated;
