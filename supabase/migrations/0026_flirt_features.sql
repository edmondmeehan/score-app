-- 0026: Financial Green Flags prompts, Verified badge setting, "Hot or Financially Compatible?" blind rounds,
-- the $50 Date Challenge, and screenshot tracking.

-- ---------- Financial Green Flags (profile prompts) ----------
alter table public.profiles add column if not exists flag_habit text;
alter table public.profiles add column if not exists flag_splurge text;
alter table public.profiles add column if not exists flag_save text;
alter table public.profiles add column if not exists show_verified boolean not null default true;
do $$ begin
  alter table public.profiles add constraint profiles_flag_len check (length(coalesce(flag_habit,'')) <= 120 and length(coalesce(flag_splurge,'')) <= 60 and length(coalesce(flag_save,'')) <= 60);
exception when duplicate_object then null; end $$;
grant update (flag_habit, flag_splurge, flag_save, show_verified) on public.profiles to authenticated;

-- ---------- Hot or Financially Compatible? ----------
create table if not exists public.compat_answers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  answers jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.compat_answers enable row level security;
drop policy if exists compat_own on public.compat_answers;
create policy compat_own on public.compat_answers for select using (user_id = auth.uid());

create table if not exists public.blind_rounds (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  started_by uuid not null references public.profiles(id) on delete cascade,
  score int not null,
  a_choice text check (a_choice in ('connect','pass')),
  b_choice text check (b_choice in ('connect','pass')),
  a_revealed_at timestamptz,
  b_revealed_at timestamptz,
  conversation_id uuid references public.conversations(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);
alter table public.blind_rounds enable row level security;
drop policy if exists blind_mine on public.blind_rounds;
create policy blind_mine on public.blind_rounds for select using (auth.uid() in (user_a, user_b) or public.is_staff());

-- Five questions. Ordinal questions get partial credit when answers are close.
create or replace function public.compat_score(x jsonb, y jsonb) returns int
language sql immutable as $$
  with q as (
    select
      -- 1 vacation / down payment / both
      case when x->>'q1' = y->>'q1' then 20 when 'both' in (x->>'q1', y->>'q1') then 14 else 6 end
      -- 2 split / alternate / inviter pays
      + case when x->>'q2' = y->>'q2' then 20 when 'alternate' in (x->>'q2', y->>'q2') then 13 else 7 end
      -- 3 purchase you'd never give up (different tastes are fine)
      + case when x->>'q3' = y->>'q3' then 20 else 12 end
      -- 4 spending that needs a conversation (ordinal 1-4)
      + greatest(0, 20 - 6 * abs(coalesce((x->>'q4')::int, 2) - coalesce((y->>'q4')::int, 2)))
      -- 5 earns less but saves more: yes / depends / no
      + case when x->>'q5' = y->>'q5' then 20 when 'depends' in (x->>'q5', y->>'q5') then 13 else 4 end
      as raw)
  -- Keep it playful: 55-99%.
  select least(99, greatest(55, round(55 + (raw - 33) * 44.0 / 67)))::int from q;
$$;

create or replace function public.save_compat_answers(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if not (p->>'q1' in ('vacation','down_payment','both') and p->>'q2' in ('split','alternate','inviter')
      and p->>'q3' in ('travel','food','car','wellness','style','tech','home') and p->>'q4' in ('1','2','3','4')
      and p->>'q5' in ('yes','depends','no')) then raise exception 'Answer all five questions.'; end if;
  insert into compat_answers(user_id, answers, updated_at)
  values (auth.uid(), jsonb_build_object('q1', p->>'q1', 'q2', p->>'q2', 'q3', p->>'q3', 'q4', p->>'q4', 'q5', p->>'q5'), now())
  on conflict (user_id) do update set answers = excluded.answers, updated_at = now();
end $$;
grant execute on function public.save_compat_answers(jsonb) to authenticated;

-- Start a new blind round with a compatible member you haven't played with.
create or replace function public.blind_next() returns uuid
language plpgsql security definer set search_path = public as $$
declare me profiles; mine jsonb; pick record; rid uuid; today int;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.id_status <> 'approved' or me.band is null then raise exception 'Finish verification to play.'; end if;
  select answers into mine from compat_answers where user_id = me.id;
  if mine is null then raise exception 'Answer the five questions first.'; end if;
  select count(*) into today from blind_rounds where started_by = me.id and created_at > now() - interval '1 day';
  if today >= 10 then raise exception 'That''s 10 rounds today. New ones tomorrow.'; end if;
  select p.id, compat_score(mine, c.answers) s into pick
  from profiles p join compat_answers c on c.user_id = p.id
  where p.id <> me.id and p.status = 'active' and p.id_status = 'approved' and p.band is not null
    and (cardinality(me.seeking) = 0 or p.gender = any(me.seeking))
    and (cardinality(p.seeking) = 0 or me.gender = any(p.seeking))
    and not exists (select 1 from blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
    and not exists (select 1 from blind_rounds r where r.user_a = least(me.id, p.id) and r.user_b = greatest(me.id, p.id))
    and not exists (select 1 from conversations cv where cv.user_a = least(me.id, p.id) and cv.user_b = greatest(me.id, p.id))
  order by compat_score(mine, c.answers) + random() * 12 desc
  limit 1;
  if pick.id is null then return null; end if;
  insert into blind_rounds(user_a, user_b, started_by, score)
  values (least(me.id, pick.id), greatest(me.id, pick.id), me.id, pick.s) returning id into rid;
  return rid;
end $$;
grant execute on function public.blind_next() to authenticated;

-- One round from the viewer's side. Name, photo and profile appear only after the viewer reveals.
create or replace function public.blind_round(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r blind_rounds; me uuid := auth.uid(); other uuid; mine_c text; theirs_c text; revealed boolean; o profiles;
begin
  select * into r from blind_rounds where id = p_id;
  if r.id is null or me not in (r.user_a, r.user_b) then return null; end if;
  other := case when me = r.user_a then r.user_b else r.user_a end;
  mine_c := case when me = r.user_a then r.a_choice else r.b_choice end;
  theirs_c := case when me = r.user_a then r.b_choice else r.a_choice end;
  revealed := (case when me = r.user_a then r.a_revealed_at else r.b_revealed_at end) is not null;
  select * into o from profiles where id = other;
  return jsonb_build_object(
    'id', r.id, 'score', r.score, 'created_at', r.created_at, 'revealed', revealed,
    'my_choice', mine_c, 'matched', coalesce(mine_c = 'connect' and theirs_c = 'connect', false), 'conversation_id', r.conversation_id,
    'they_passed', coalesce(mine_c is not null and theirs_c = 'pass', false),
    'mine', (select answers from compat_answers where user_id = me),
    'theirs', (select answers from compat_answers where user_id = other),
    'hint', jsonb_build_object('age', extract(year from now())::int - o.birth_year, 'band', o.band),
    'other', case when revealed then jsonb_build_object('id', o.id, 'first_name', o.first_name, 'neighborhood', o.neighborhood, 'job', o.job) else null end);
end $$;
grant execute on function public.blind_round(uuid) to authenticated;

create or replace function public.blind_inbox() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'score', r.score, 'created_at', r.created_at,
    'started_by_me', r.started_by = auth.uid(),
    'my_choice', case when auth.uid() = r.user_a then r.a_choice else r.b_choice end,
    'matched', coalesce(r.a_choice = 'connect' and r.b_choice = 'connect', false), 'conversation_id', r.conversation_id) order by r.created_at desc), '[]')
  from (select * from blind_rounds where auth.uid() in (user_a, user_b) order by created_at desc limit 30) r;
$$;
grant execute on function public.blind_inbox() to authenticated;

create or replace function public.blind_reveal(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update blind_rounds set
    a_revealed_at = case when auth.uid() = user_a then coalesce(a_revealed_at, now()) else a_revealed_at end,
    b_revealed_at = case when auth.uid() = user_b then coalesce(b_revealed_at, now()) else b_revealed_at end
  where id = p_id and auth.uid() in (user_a, user_b);
$$;
grant execute on function public.blind_reveal(uuid) to authenticated;

create or replace function public.blind_choose(p_id uuid, p_choice text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r blind_rounds; me profiles; cid uuid;
begin
  if p_choice not in ('connect','pass') then raise exception 'bad choice'; end if;
  select * into me from profiles where id = auth.uid();
  select * into r from blind_rounds where id = p_id and me.id in (user_a, user_b) for update;
  if r.id is null then raise exception 'not found'; end if;
  if (case when me.id = r.user_a then r.a_revealed_at else r.b_revealed_at end) is null then raise exception 'Reveal photos first.'; end if;
  if p_choice = 'connect' and me.plan not in ('membership','premium','black') then raise exception 'upgrade to connect'; end if;
  if me.id = r.user_a then update blind_rounds set a_choice = p_choice where id = r.id;
  else update blind_rounds set b_choice = p_choice where id = r.id; end if;
  select * into r from blind_rounds where id = p_id;
  if r.a_choice = 'connect' and r.b_choice = 'connect' and r.conversation_id is null then
    insert into conversations(user_a, user_b) values (r.user_a, r.user_b) on conflict (user_a, user_b) do nothing;
    select id into cid from conversations where user_a = r.user_a and user_b = r.user_b;
    update blind_rounds set conversation_id = cid where id = r.id;
    return jsonb_build_object('matched', true, 'conversation_id', cid);
  end if;
  return jsonb_build_object('matched', coalesce(r.a_choice = 'connect' and r.b_choice = 'connect', false), 'conversation_id', r.conversation_id);
end $$;
grant execute on function public.blind_choose(uuid, text) to authenticated;

-- ---------- The $50 Date Challenge ----------
alter table public.date_plans add column if not exists budget_challenge boolean not null default false;

create or replace function public.set_date_challenge(p_date uuid) returns void
language sql security definer set search_path = public as $$
  update date_plans set budget_challenge = true where id = p_date and proposer_id = auth.uid() and status = 'proposed';
$$;
grant execute on function public.set_date_challenge(uuid) to authenticated;

create table if not exists public.date_challenge_entries (
  id uuid primary key default gen_random_uuid(),
  date_id uuid not null references public.date_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 3 and 80),
  spent numeric(7,2) not null check (spent >= 0 and spent <= 50),
  story text not null check (length(story) between 10 and 1000),
  share_ok boolean not null default false,
  status text not null default 'pending' check (status in ('pending','featured','hidden')),
  created_at timestamptz not null default now(),
  unique (date_id, user_id)
);
alter table public.date_challenge_entries enable row level security;
drop policy if exists dce_own on public.date_challenge_entries;
create policy dce_own on public.date_challenge_entries for select using (user_id = auth.uid() or public.is_staff());

create or replace function public.submit_date_challenge(p_date uuid, p_title text, p_spent numeric, p_story text, p_share boolean) returns void
language plpgsql security definer set search_path = public as $$
declare d date_plans; c conversations;
begin
  select * into d from date_plans where id = p_date;
  select * into c from conversations where id = d.conversation_id;
  if d.id is null or auth.uid() not in (c.user_a, c.user_b) then raise exception 'not found'; end if;
  if not d.budget_challenge or d.status <> 'accepted' then raise exception 'This date isn’t a $50 Date Challenge.'; end if;
  if d.starts_at > now() then raise exception 'Share after the date.'; end if;
  insert into date_challenge_entries(date_id, user_id, title, spent, story, share_ok)
  values (p_date, auth.uid(), trim(p_title), p_spent, trim(p_story), coalesce(p_share, false))
  on conflict (date_id, user_id) do update set title = excluded.title, spent = excluded.spent, story = excluded.story, share_ok = excluded.share_ok;
end $$;
grant execute on function public.submit_date_challenge(uuid, text, numeric, text, boolean) to authenticated;

create or replace function public.staff_set_challenge_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  update date_challenge_entries set status = p_status where id = p_id and (p_status <> 'featured' or share_ok);
end $$;
grant execute on function public.staff_set_challenge_status(uuid, text) to authenticated;

-- ---------- Screenshot tracking ----------
insert into public.app_config(key, value) values ('screenshot_review_threshold', '10') on conflict (key) do nothing;

create table if not exists public.screenshot_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  context text not null check (length(context) <= 40),
  target_id uuid,
  source text not null check (source in ('web','ios','android')),
  created_at timestamptz not null default now()
);
create index if not exists screenshot_user on public.screenshot_events(user_id, created_at);
alter table public.screenshot_events enable row level security;
drop policy if exists ss_staff on public.screenshot_events;
create policy ss_staff on public.screenshot_events for select using (public.is_staff());

create or replace function public.log_screenshot(p_context text, p_target uuid, p_source text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  -- One event per 5 seconds per person (a burst of key presses counts once).
  if exists (select 1 from screenshot_events where user_id = auth.uid() and created_at > now() - interval '5 seconds') then return; end if;
  insert into screenshot_events(user_id, context, target_id, source)
  values (auth.uid(), left(coalesce(p_context, 'app'), 40), p_target, case when p_source in ('ios','android') then p_source else 'web' end);
end $$;
grant execute on function public.log_screenshot(text, uuid, text) to authenticated;

-- Members over the review threshold in the last 7 days (staff decides; nothing is automatic).
create or replace function public.staff_screenshot_review() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare th int := coalesce((select (value::text)::int from app_config where key = 'screenshot_review_threshold'), 10);
begin
  if not is_staff() then raise exception 'staff only'; end if;
  return jsonb_build_object('threshold', th, 'members', coalesce((select jsonb_agg(x order by (x->>'n')::int desc) from (
    select jsonb_build_object('id', p.id, 'first_name', p.first_name, 'status', p.status, 'n', s.n, 'profiles', s.profiles, 'last_at', s.last_at) x
    from (select user_id, count(*) n, count(distinct target_id) filter (where context = 'profile') profiles, max(created_at) last_at
          from screenshot_events where created_at > now() - interval '7 days' group by user_id) s
    join profiles p on p.id = s.user_id
    where s.n >= greatest(1, th / 2)
    order by s.n desc limit 50) q), '[]'));
end $$;
grant execute on function public.staff_screenshot_review() to authenticated;
