-- 0010: Discover tab (tips, news, perks), member success stories, partner inquiries; "Black" tier renamed to "Reserve" in copy.
-- The internal plan key stays 'black' so billing and App Store product IDs don't change.

-- ---------- Content: tips, news, partner perks ----------
create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('credit_tip','dating_tip','news','perk')),
  title text not null check (length(title) between 3 and 140),
  body text check (length(body) <= 4000),
  source_name text check (length(source_name) <= 80),
  url text check (url is null or url ~ '^https://'),
  partner_name text check (length(partner_name) <= 80),
  perk_code text check (length(perk_code) <= 40),
  status text not null default 'draft' check (status in ('draft','published')),
  pinned boolean not null default false,
  published_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_posts_feed on public.content_posts(kind, status, published_at desc);
alter table public.content_posts enable row level security;
drop policy if exists content_read on public.content_posts;
create policy content_read on public.content_posts for select to authenticated using (
  (status = 'published' and public.my_status() in ('active','preview','paused','taken')) or public.is_staff());

create or replace function public.staff_save_post(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare who text := staff_email(); pid uuid := nullif(p->>'id','')::uuid; st text := coalesce(nullif(p->>'status',''), 'draft');
begin
  if not is_staff() then raise exception 'staff only'; end if;
  if pid is null then
    insert into content_posts(kind, title, body, source_name, url, partner_name, perk_code, status, pinned, published_at, created_by)
    values (p->>'kind', p->>'title', nullif(p->>'body',''), nullif(p->>'source_name',''), nullif(p->>'url',''), nullif(p->>'partner_name',''),
            nullif(p->>'perk_code',''), st, coalesce((p->>'pinned')::boolean, false), case when st = 'published' then now() end, who)
    returning id into pid;
  else
    update content_posts set kind = p->>'kind', title = p->>'title', body = nullif(p->>'body',''), source_name = nullif(p->>'source_name',''),
      url = nullif(p->>'url',''), partner_name = nullif(p->>'partner_name',''), perk_code = nullif(p->>'perk_code',''), status = st,
      pinned = coalesce((p->>'pinned')::boolean, false), published_at = case when st = 'published' then coalesce(published_at, now()) end, updated_at = now()
    where id = pid;
  end if;
  insert into audit_log(staff_email, action, reason) values (who, 'save_post', st || ': ' || left(p->>'title', 80));
  return pid;
end $$;

create or replace function public.staff_delete_post(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  delete from content_posts where id = p_id;
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'delete_post', p_id::text);
end $$;

-- ---------- Success stories (submitted by members, approved by staff) ----------
create table if not exists public.success_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  partner_first_name text check (length(partner_first_name) <= 40),
  headline text not null check (length(headline) between 3 and 120),
  story text not null check (length(story) between 40 and 2000),
  show_names boolean not null default false,
  consent boolean not null check (consent),
  partner_consent boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);
alter table public.success_stories enable row level security;
drop policy if exists stories_read on public.success_stories;
create policy stories_read on public.success_stories for select to authenticated using (
  user_id = auth.uid() or public.is_staff() or (status = 'approved' and public.my_status() in ('active','preview','paused','taken')));
drop policy if exists stories_insert on public.success_stories;
create policy stories_insert on public.success_stories for insert to authenticated with check (user_id = auth.uid() and status = 'pending');

-- Public view of approved stories: names only when both people agreed.
create or replace function public.approved_stories(p_limit int default 20)
returns table(id uuid, headline text, story text, names text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.headline, s.story,
         case when s.show_names and s.partner_consent then p.first_name || coalesce(' & ' || s.partner_first_name, '') end,
         s.created_at
  from success_stories s join profiles p on p.id = s.user_id
  where s.status = 'approved' and (my_status() in ('active','preview','paused','taken') or is_staff())
  order by s.reviewed_at desc nulls last limit least(coalesce(p_limit, 20), 50);
$$;

create or replace function public.staff_review_story(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  if p_status not in ('approved','rejected','pending') then raise exception 'bad status'; end if;
  update success_stories set status = p_status, reviewed_at = now(), reviewed_by = staff_email() where id = p_id;
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'review_story', p_status || ' ' || p_id);
end $$;

-- ---------- Partner inquiries (public form on /partners) ----------
create table if not exists public.partner_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 80),
  company text not null check (length(company) between 2 and 120),
  email text not null check (email ~ '^\S+@\S+\.\S+$' and length(email) <= 160),
  kind text not null check (kind in ('venue','brand','financial','events','press','other')),
  website text check (website is null or length(website) <= 200),
  message text not null check (length(message) between 10 and 2000),
  status text not null default 'new' check (status in ('new','contacted','closed')),
  created_at timestamptz not null default now()
);
alter table public.partner_inquiries enable row level security;
drop policy if exists inquiries_insert on public.partner_inquiries;
create policy inquiries_insert on public.partner_inquiries for insert to anon, authenticated with check (status = 'new');
drop policy if exists inquiries_staff on public.partner_inquiries;
create policy inquiries_staff on public.partner_inquiries for select to authenticated using (public.is_staff());

create or replace function public.staff_set_inquiry(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  update partner_inquiries set status = p_status where id = p_id;
end $$;

grant execute on function public.staff_save_post(jsonb), public.staff_delete_post(uuid), public.approved_stories(int),
  public.staff_review_story(uuid, text), public.staff_set_inquiry(uuid, text) to authenticated;

-- ---------- Tier rename in the RSVP message ----------
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
    raise exception 'Reserve members get first access. RSVPs open to everyone %', to_char((e.published_at + make_interval(hours => e.black_priority_hours)) at time zone 'America/New_York', 'FMDay at FMHH12:MI am');
  end if;
  select count(*) into going from event_rsvps where event_id = e.id and status = 'going' and user_id <> me.id;
  st := case when going < e.capacity then 'going' else 'waitlist' end;
  insert into event_rsvps(event_id, user_id, status) values (e.id, me.id, st)
    on conflict (event_id, user_id) do update set status = case when event_rsvps.status = 'going' then 'going' else excluded.status end, updated_at = now()
    returning status into st;
  return st;
end $$;

-- ---------- Starter tips (general education, edit or unpublish in Admin → Content) ----------
do $seed$ begin
if not exists (select 1 from public.content_posts where kind in ('credit_tip','dating_tip')) then
insert into public.content_posts(kind, title, body, status, published_at) values ('credit_tip', 'Pay before the statement closes', 'Your card reports the balance on the statement date, not the due date. Paying most of it a few days before the statement closes lowers the utilization lenders see, even if you pay in full every month.', 'published', now() - interval '0 days');
insert into public.content_posts(kind, title, body, status, published_at) values ('credit_tip', 'Keep utilization under 30%, under 10% if you can', 'Utilization is how much of your available credit you''re using. It''s one of the biggest factors in most scores, and it updates every month, so a high balance only hurts while it''s reported.', 'published', now() - interval '1 days');
insert into public.content_posts(kind, title, body, status, published_at) values ('credit_tip', 'Don''t close your oldest card', 'Closing an old account can shorten your average account age and cut your available credit. If it has no annual fee, keep it open and put a small recurring charge on it.', 'published', now() - interval '2 days');
insert into public.content_posts(kind, title, body, status, published_at) values ('credit_tip', 'Check your reports for free', 'You can pull your reports from all three bureaus at AnnualCreditReport.com. Look for accounts you don''t recognize and late payments that aren''t yours, and dispute errors directly with the bureau.', 'published', now() - interval '3 days');
insert into public.content_posts(kind, title, body, status, published_at) values ('credit_tip', 'Set every bill to autopay the minimum', 'Payment history is the largest factor in most scores. Autopaying at least the minimum means a busy week never turns into a 30-day late mark. Pay the rest manually.', 'published', now() - interval '4 days');
insert into public.content_posts(kind, title, body, status, published_at) values ('credit_tip', 'Space out new applications', 'Each hard inquiry can dip your score a few points for a while. Shopping for one mortgage or car loan within a short window usually counts as a single inquiry.', 'published', now() - interval '5 days');
insert into public.content_posts(kind, title, body, status, published_at) values ('credit_tip', 'Ask for a higher limit', 'A higher limit with the same spending lowers your utilization. Many issuers will raise it without a hard pull. Ask whether it''s a soft or hard inquiry first.', 'published', now() - interval '6 days');
insert into public.content_posts(kind, title, body, status, published_at) values ('credit_tip', 'Goodwill letters work sometimes', 'If you have one late payment on an otherwise clean history, a short, polite letter to the lender asking them to remove it as a courtesy can work. There''s no guarantee, but it costs nothing.', 'published', now() - interval '7 days');
insert into public.content_posts(kind, title, body, status, published_at) values ('dating_tip', 'Lead with a question, not a compliment', 'Pick something specific from their prompt or money values and ask about it. "What made you pick index funds over real estate?" starts a conversation. "You''re cute" ends one.', 'published', now() - interval '0 days');
insert into public.content_posts(kind, title, body, status, published_at) values ('dating_tip', 'Suggest a plan within a few messages', 'Long text threads lose momentum. Once there''s a spark, suggest a specific place and two times. Use "Suggest a date" in the chat so it lands on both calendars.', 'published', now() - interval '1 days');
insert into public.content_posts(kind, title, body, status, published_at) values ('dating_tip', 'First dates: short, public, easy to extend', 'Coffee or one drink at a place you know. Ninety minutes is plenty. If it''s going well you can always walk to dinner.', 'published', now() - interval '2 days');
insert into public.content_posts(kind, title, body, status, published_at) values ('dating_tip', 'Talk about money like a grown-up', 'You already share a credit band, so the awkward part is done. Ask about goals, not numbers: what they''re saving for, how they think about splitting things.', 'published', now() - interval '3 days');
insert into public.content_posts(kind, title, body, status, published_at) values ('dating_tip', 'Share your date with a friend', 'Use "Share with a friend" on any confirmed date. They see where and when, nothing else, and the link stops working when the date''s over.', 'published', now() - interval '4 days');
insert into public.content_posts(kind, title, body, status, published_at) values ('dating_tip', 'Be clear when it''s not a match', 'A kind, short message beats silence. "I enjoyed meeting you, but I didn''t feel a romantic spark. Wishing you the best." Everyone appreciates it.', 'published', now() - interval '5 days');
insert into public.content_posts(kind, title, body, status, published_at) values ('dating_tip', 'Keep your profile current', 'Update your photos every few months and refresh your prompt answer. Members who changed something in the last 30 days get noticed more.', 'published', now() - interval '6 days');
insert into public.content_posts(kind, title, body, status, published_at) values ('dating_tip', 'Pick one thing to learn about them', 'Go into the date wanting to find out one real thing, like why they moved to the city or what they''d do with a free year. It keeps you curious instead of performing.', 'published', now() - interval '7 days');
end if;
end $seed$;
