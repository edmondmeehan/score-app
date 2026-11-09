-- 0043: Engagement batches 2–3 (roadmap items 5–12).
--  5  How did it go: after a safe check-in, "see them again?" Private; a mutual yes tells both and suggests a second date.
--  6  Daily question: one light question a day; matches see the answers they share.
--  7  Weekly summary: Sunday recap (views, likes, chats, dates, best prompt) — sent only when there's something good to say.
--  8  Profile strength: computed in the app (no SQL).
--  9  Events social proof: matches going on the events list, photo recaps after an event.
-- 10  Friend vouches: the person who invited you writes a line; you approve it before anyone sees it.
-- 11  Daily Wildcard: one extra profile a day from outside your band (gender preferences still respected).
-- 12  Band level-ups: private celebration when your band moves up; the public ↑ "Improving" badge is opt-in.

-- ---------- 5. How did it go ----------
create table if not exists public.date_feedback (
  plan_id uuid not null references public.date_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  again text not null check (again in ('yes','maybe','no')),
  created_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);
alter table public.date_feedback enable row level security;
drop policy if exists date_feedback_own on public.date_feedback;
create policy date_feedback_own on public.date_feedback for select using (user_id = auth.uid() or public.is_staff());

create or replace function public.pending_again() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('plan_id', d.id, 'place', d.place, 'conversation_id', c.id,
           'match', first_name_of(case when c.user_a = auth.uid() then c.user_b else c.user_a end)) order by d.starts_at desc), '[]')
  from date_plans d
  join conversations c on c.id = d.conversation_id
  join date_checkins ci on ci.plan_id = d.id and ci.user_id = auth.uid() and ci.status = 'safe'
  where auth.uid() in (c.user_a, c.user_b) and d.status = 'accepted'
    and d.starts_at > now() - interval '7 days'
    and not exists (select 1 from date_feedback f where f.plan_id = d.id and f.user_id = auth.uid());
$$;
grant execute on function public.pending_again() to authenticated;

create or replace function public.date_again(p_plan uuid, p_answer text) returns text
language plpgsql security definer set search_path = public as $$
declare d date_plans; c conversations; other uuid; theirs text;
begin
  if p_answer not in ('yes','maybe','no') then raise exception 'bad answer'; end if;
  select * into d from date_plans where id = p_plan;
  select * into c from conversations where id = d.conversation_id and auth.uid() in (user_a, user_b);
  if c.id is null then raise exception 'not found'; end if;
  insert into date_feedback(plan_id, user_id, again) values (p_plan, auth.uid(), p_answer)
    on conflict (plan_id, user_id) do update set again = excluded.again, created_at = now();
  other := case when auth.uid() = c.user_a then c.user_b else c.user_a end;
  select again into theirs from date_feedback where plan_id = p_plan and user_id = other;
  if p_answer = 'yes' and theirs = 'yes' and c.ended_at is null and not blocked_between(auth.uid(), other) then
    perform notify(auth.uid(), null, 'second_date', 'interaction', 'You both want a second date',
      first_name_of(other) || ' said yes too. Pick a spot while it''s fresh.', '/app/messages/' || c.id || '?second=1', 'second:' || p_plan, true);
    perform notify(other, null, 'second_date', 'interaction', 'You both want a second date',
      first_name_of(auth.uid()) || ' said yes too. Pick a spot while it''s fresh.', '/app/messages/' || c.id || '?second=1', 'second:' || p_plan, true);
    return 'mutual';
  end if;
  return 'saved';
end $$;
grant execute on function public.date_again(uuid, text) to authenticated;

-- ---------- 6. Daily question ----------
create table if not exists public.daily_questions (
  id int primary key,
  q text not null check (length(q) <= 120),
  options text[] not null check (cardinality(options) between 2 and 4),
  active boolean not null default true
);
alter table public.daily_questions enable row level security;
drop policy if exists dq_read on public.daily_questions;
create policy dq_read on public.daily_questions for select to authenticated using (true);
drop policy if exists dq_staff on public.daily_questions;
create policy dq_staff on public.daily_questions for all using (public.is_staff()) with check (public.is_staff());

insert into public.daily_questions(id, q, options) values
  (1, 'Perfect Sunday?', array['Brunch and a long walk','Couch, takeout, movies','Gym then errands','Out of the city']),
  (2, 'First date drink?', array['Cocktail','Wine','Coffee','Something non-alcoholic']),
  (3, 'Ideal vacation?', array['Beach and a book','A city I’ve never seen','Mountains','Staycation']),
  (4, 'Morning person?', array['Up with the sun','Snooze twice','Depends on the night before']),
  (5, 'Best borough for a date?', array['Manhattan','Brooklyn','Queens','The Bronx or Staten Island']),
  (6, 'Splurge on…', array['Travel','Food','Clothes','Experiences']),
  (7, 'Texting style?', array['Quick replies','Long paragraphs','Voice notes','Let’s just call']),
  (8, 'Pizza order?', array['Plain slice','Pepperoni','Vodka slice','Grandma slice']),
  (9, 'Concert or comedy show?', array['Concert','Comedy show','Both, same night']),
  (10, 'Dogs or cats?', array['Dogs','Cats','Both','Neither']),
  (11, 'Your go-to workout?', array['Running','Lifting','Pilates or yoga','Walking the city']),
  (12, 'Planner or spontaneous?', array['Every detail planned','Totally spontaneous','A bit of both']),
  (13, 'Best season in NYC?', array['Spring','Summer','Fall','Winter']),
  (14, 'Dinner party role?', array['Host','Chef','Bring the wine','DJ']),
  (15, 'Cook or order in?', array['Cook','Order in','Go out']),
  (16, 'Museum pick?', array['The Met','MoMA','Natural History','The Whitney']),
  (17, 'How do you unwind?', array['A good show','A long run','Friends and drinks','A book']),
  (18, 'Subway or walk?', array['Subway','Walk','Citi Bike','Car service']),
  (19, 'Love language?', array['Words','Time','Gifts','Acts of service']),
  (20, 'Weekend away?', array['Hudson Valley','The Hamptons','Upstate camping','A flight somewhere']),
  (21, 'Ideal first date?', array['Drinks','Dinner','A walk or activity','Coffee']),
  (22, 'Bookstore or record store?', array['Bookstore','Record store','Neither, flea market']),
  (23, 'Brunch order?', array['Sweet','Savory','Just coffee','Bottomless anything']),
  (24, 'Hosting style?', array['Big party','Small dinner','I’d rather be the guest']),
  (25, 'Phone on the table at dinner?', array['Face down','In my pocket','Doesn’t bother me']),
  (26, 'Favorite way to see the city?', array['Rooftops','Parks','Neighborhood bars','New restaurants']),
  (27, 'Holiday plans?', array['Home with family','Travel','Friendsgiving','Whatever comes up']),
  (28, 'Saturday night?', array['Out late','Early dinner, early night','Big night in']),
  (29, 'Coffee order?', array['Black','Latte','Iced, any season','Tea']),
  (30, 'Who should plan the second date?', array['Whoever planned the first','The other person','Plan it together'])
on conflict (id) do nothing;

create table if not exists public.daily_answers (
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id int not null references public.daily_questions(id) on delete cascade,
  answer text not null check (length(answer) <= 80),
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
alter table public.daily_answers enable row level security;
drop policy if exists da_own on public.daily_answers;
create policy da_own on public.daily_answers for select using (user_id = auth.uid());

create or replace function public.todays_question() returns jsonb
language sql stable security definer set search_path = public as $$
  with qs as (select *, row_number() over (order by id) - 1 rn, count(*) over () n from daily_questions where active)
  select jsonb_build_object('id', q.id, 'q', q.q, 'options', to_jsonb(q.options),
           'mine', (select answer from daily_answers a where a.user_id = auth.uid() and a.question_id = q.id))
  from qs q where auth.uid() is not null and q.rn = (current_date - date '2026-01-01') % q.n;
$$;
grant execute on function public.todays_question() to authenticated;

create or replace function public.answer_daily(p_question int, p_answer text) returns void
language plpgsql security definer set search_path = public as $$
declare today jsonb := todays_question();
begin
  if today is null or (today->>'id')::int <> p_question then raise exception 'that question has closed'; end if;
  if not (today->'options') ? p_answer then raise exception 'pick one of the answers'; end if;
  insert into daily_answers(user_id, question_id, answer) values (auth.uid(), p_question, p_answer)
    on conflict (user_id, question_id) do update set answer = excluded.answer, created_at = now();
end $$;
grant execute on function public.answer_daily(int, text) to authenticated;

-- Answers you share with someone you're chatting with (only matching answers, only inside an open chat).
create or replace function public.shared_answers(p_other uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('q', q.q, 'a', a.answer) order by a.created_at desc), '[]')
  from (select a.* from daily_answers a join daily_answers b on b.question_id = a.question_id and b.user_id = p_other and b.answer = a.answer
        where a.user_id = auth.uid() order by a.created_at desc limit 4) a
  join daily_questions q on q.id = a.question_id
  where exists (select 1 from conversations c where c.ended_at is null and
          ((c.user_a = auth.uid() and c.user_b = p_other) or (c.user_b = auth.uid() and c.user_a = p_other)));
$$;
grant execute on function public.shared_answers(uuid) to authenticated;

-- ---------- 7. Weekly summary ----------
create or replace function public.week_for(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'views', (select count(distinct viewer) from profile_views where viewed = p_user and created_at > now() - interval '7 days'),
    'likes', (select count(*) from likes where liked = p_user and created_at > now() - interval '7 days'),
    'chats', (select count(*) from conversations where p_user in (user_a, user_b) and created_at > now() - interval '7 days'),
    'dates', (select count(*) from date_plans d join conversations c on c.id = d.conversation_id
              where p_user in (c.user_a, c.user_b) and d.status = 'accepted' and d.created_at > now() - interval '7 days'),
    'best_prompt', (select jsonb_build_object('q', pr->>'q', 'replies', n) from (
        select pr, (select count(*) from messages m join conversations c on c.id = m.conversation_id
                    where p_user in (c.user_a, c.user_b) and m.sender_id <> p_user and m.created_at > now() - interval '30 days'
                      and m.body like '↩ “' || (pr->>'q') || '”%') n
        from profiles p, jsonb_array_elements(coalesce(p.prompts, '[]')) pr where p.id = p_user) x
      where n > 0 order by n desc limit 1));
$$;
revoke all on function public.week_for(uuid) from public, anon, authenticated;

create or replace function public.my_week() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then null else week_for(auth.uid()) end;
$$;
grant execute on function public.my_week() to authenticated;

create or replace function public.queue_weekly(p_secret text) returns int
language plpgsql security definer set search_path = public, private as $$
declare r record; w jsonb; v int; l int; cnt int := 0;
begin
  perform check_server_secret(p_secret);
  if extract(dow from now() at time zone 'America/New_York') <> 0 then return 0; end if;
  for r in select id from profiles where status in ('active','preview')
           and coalesce(last_active_at, created_at) > now() - interval '30 days' loop
    w := week_for(r.id); v := (w->>'views')::int; l := (w->>'likes')::int;
    -- Only send when there's good news. No "nobody looked at you this week".
    if v > 0 or l > 0 then
      perform notify(r.id, null, 'weekly', 'milestone', 'Your week on ScoreDate',
        case when v > 0 then v || ' ' || case when v = 1 then 'person' else 'people' end || ' viewed your profile'
             else l || ' new like' || case when l = 1 then '' else 's' end end || '. See your recap.',
        '/app/week', 'week:' || to_char(now(), 'IYYY-IW'));
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end $$;
revoke all on function public.queue_weekly(text) from public;
grant execute on function public.queue_weekly(text) to anon, authenticated;

-- ---------- 9. Events social proof ----------
create or replace function public.events_matches_going() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(event_id, n), '{}') from (
    select r.event_id, count(*) n from event_rsvps r
    join events e on e.id = r.event_id and e.status = 'published' and e.starts_at > now() - interval '6 hours'
    join conversations c on c.ended_at is null and ((c.user_a = auth.uid() and c.user_b = r.user_id) or (c.user_b = auth.uid() and c.user_a = r.user_id))
    where r.status = 'going' and r.user_id <> auth.uid()
    group by r.event_id) x
  where public.my_status() in ('active','preview','paused','taken');
$$;
grant execute on function public.events_matches_going() to authenticated;

alter table public.events add column if not exists recap_photos text[] not null default '{}';
alter table public.events add column if not exists recap_note text check (length(recap_note) <= 400);

create or replace function public.staff_set_event_recap(p_id uuid, p_photos text[], p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  update events set recap_photos = coalesce(p_photos[1:12], '{}'), recap_note = left(nullif(trim(coalesce(p_note, '')), ''), 400) where id = p_id;
end $$;
grant execute on function public.staff_set_event_recap(uuid, text[], text) to authenticated;

-- ---------- 10. Friend vouches ----------
create table if not exists public.vouches (
  member_id uuid primary key references public.profiles(id) on delete cascade,
  voucher_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 10 and 200),
  status text not null default 'pending' check (status in ('pending','approved','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.vouches enable row level security;
drop policy if exists vouches_read on public.vouches;
create policy vouches_read on public.vouches for select to authenticated
  using (status = 'approved' or member_id = auth.uid() or voucher_id = auth.uid() or public.is_staff());

create or replace function public.write_vouch(p_member uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare b text := trim(coalesce(p_body, ''));
begin
  if not exists (select 1 from profiles where id = p_member and invited_by = auth.uid()) then raise exception 'you can only vouch for people you invited'; end if;
  if length(b) < 10 or length(b) > 200 then raise exception 'keep it between 10 and 200 characters'; end if;
  insert into vouches(member_id, voucher_id, body, status) values (p_member, auth.uid(), b, 'pending')
    on conflict (member_id) do update set body = excluded.body, voucher_id = excluded.voucher_id, status = 'pending', updated_at = now();
  perform notify(p_member, auth.uid(), 'vouch', 'interaction', first_name_of(auth.uid()) || ' vouched for you',
    'Read it and choose whether it shows on your profile.', '/app/profile#vouch', 'vouch:' || p_member || ':' || extract(epoch from now())::bigint);
end $$;
grant execute on function public.write_vouch(uuid, text) to authenticated;

create or replace function public.answer_vouch(p_show boolean) returns void
language sql security definer set search_path = public as $$
  update vouches set status = case when p_show then 'approved' else 'hidden' end, updated_at = now() where member_id = auth.uid();
$$;
grant execute on function public.answer_vouch(boolean) to authenticated;

-- ---------- 11. Daily Wildcard ----------
create table if not exists public.daily_wildcards (
  user_id uuid not null references public.profiles(id) on delete cascade,
  drop_date date not null default current_date,
  match_id uuid references public.profiles(id) on delete cascade,
  primary key (user_id, drop_date)
);
alter table public.daily_wildcards enable row level security;
drop policy if exists wildcard_own on public.daily_wildcards;
create policy wildcard_own on public.daily_wildcards for select using (user_id = auth.uid());

create or replace function public.get_wildcard() returns uuid
language plpgsql security definer set search_path = public as $$
declare me profiles; pick uuid;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.status <> 'active' or me.plan not in ('membership','premium','black') then return null; end if;
  select match_id into pick from daily_wildcards where user_id = me.id and drop_date = current_date;
  if found then return pick; end if;
  select p.id into pick from profiles p
  where p.id <> me.id and p.status = 'active' and p.band is not null and p.id_status = 'approved'
    and p.band is distinct from me.band                       -- outside your usual band
    and (cardinality(me.seeking) = 0 or p.gender = any(me.seeking))   -- gender preferences always respected
    and (cardinality(p.seeking) = 0 or me.gender = any(p.seeking))
    and not blocked_between(me.id, p.id)
    and not exists (select 1 from drops d where d.user_id = me.id and d.match_id = p.id and d.drop_date > current_date - 30)
    and not exists (select 1 from daily_wildcards w where w.user_id = me.id and w.match_id = p.id)
    and not exists (select 1 from conversations c where (c.user_a = me.id and c.user_b = p.id) or (c.user_b = me.id and c.user_a = p.id))
  order by random() limit 1;
  insert into daily_wildcards(user_id, match_id) values (me.id, pick) on conflict do nothing;
  return pick;
end $$;
grant execute on function public.get_wildcard() to authenticated;

-- ---------- 12. Band level-ups ----------
alter table public.profiles add column if not exists show_improving boolean not null default false;
grant update (show_improving) on public.profiles to authenticated;

create or replace function public.band_rank(b text) returns int language sql immutable as $$
  select case b when 'building' then 1 when 'solid' then 2 when 'strong' then 3 when 'elite' then 4 else 0 end;
$$;

create or replace function public.trg_band_up() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.band is not null and band_rank(new.band) > band_rank(old.band) then
    perform notify(new.id, null, 'band_up', 'milestone', 'Your band moved up to ' || initcap(new.band),
      'Nice work. This is private to you. Want matches to see an Improving badge? Turn it on in your profile.',
      '/app/profile#improving', 'band_up:' || new.band || ':' || current_date);
  end if;
  return new;
end $$;
drop trigger if exists band_up on public.profiles;
create trigger band_up after update of band on public.profiles for each row execute function public.trg_band_up();

-- Search: "Trending up" filter and the returned trend only cover members who opted in.
create or replace function public.member_search(f jsonb, p_page int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me profiles; limited boolean; free int; used int; res jsonb; total int; v_per int := 24;
  v_q text := nullif(trim(f->>'q'), '');
  v_a_min int := nullif(f->>'age_min', '')::int; v_a_max int := nullif(f->>'age_max', '')::int;
  v_h_min int := nullif(f->>'height_min', '')::int; v_h_max int := nullif(f->>'height_max', '')::int;
  v_area text := nullif(f->>'area', '');
  v_act int := nullif(f->>'active_days', '')::int;
  v_srt text := coalesce(nullif(f->>'sort', ''), 'match');
  v_bands text[] := array(select jsonb_array_elements_text(coalesce(f->'bands', '[]')));
  v_money text[] := array(select jsonb_array_elements_text(coalesce(f->'money', '[]')));
  v_wk text[] := array(select jsonb_array_elements_text(coalesce(f->'wants_kids', '[]')));
  v_edu text[] := array(select jsonb_array_elements_text(coalesce(f->'education', '[]')));
  v_dr text[] := array(select jsonb_array_elements_text(coalesce(f->'drinking', '[]')));
  v_sm text[] := array(select jsonb_array_elements_text(coalesce(f->'smoking', '[]')));
  v_ex text[] := array(select jsonb_array_elements_text(coalesce(f->'exercise', '[]')));
  v_yr int := extract(year from now())::int;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.status not in ('active','preview') then raise exception 'search is for active members'; end if;
  if v_q is not null then v_q := left(v_q, 60); end if;

  limited := me.plan not in ('premium','black');
  if limited and coalesce(p_page, 0) = 0 then
    free := coalesce((select (value #>> '{}')::int from app_config where key = 'search_free_daily'), 10);
    insert into search_usage(user_id) values (me.id) on conflict do nothing;
    select searches into used from search_usage where user_id = me.id and day = current_date for update;
    if used >= free then
      return jsonb_build_object('results', '[]'::jsonb, 'total', 0, 'remaining', 0, 'limited', true);
    end if;
    update search_usage set searches = searches + 1 where user_id = me.id and day = current_date;
  end if;

  with c as (
    select p.*, least(99, 40
        + coalesce(10 * cardinality(array(select unnest(p.money_values) intersect select unnest(me.money_values))), 0)
        + case when p.band = me.band then 20 when p.band is null or me.band is null then 0 else 10 end
        + case when p.trend = 'up' then 5 else 0 end) compat
    from profiles p
    where p.id <> me.id and p.status in ('active','preview') and p.band is not null and p.id_status = 'approved'
      and (cardinality(me.seeking) = 0 or p.gender = any(me.seeking))
      and (cardinality(p.seeking) = 0 or me.gender = any(p.seeking))
      and not exists (select 1 from blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
      and (v_q is null or p.first_name ilike '%' || v_q || '%' or p.job ilike '%' || v_q || '%' or p.neighborhood ilike '%' || v_q || '%' or p.prompt_a ilike '%' || v_q || '%')
      and (v_a_min is null or v_yr - p.birth_year >= v_a_min)
      and (v_a_max is null or v_yr - p.birth_year <= v_a_max)
      and (cardinality(v_bands) = 0 or p.band = any(v_bands))
      and (coalesce((f->>'trend_up')::boolean, false) = false or (p.trend = 'up' and p.show_improving))
      and (v_area is null or place_in(place_key_for(p.zip), v_area))
      and (cardinality(v_money) = 0 or p.money_values && v_money)
      and (v_h_min is null or p.height_cm >= v_h_min)
      and (v_h_max is null or p.height_cm <= v_h_max)
      and (nullif(f->>'has_kids', '') is null or p.has_kids = f->>'has_kids')
      and (cardinality(v_wk) = 0 or p.wants_kids = any(v_wk))
      and (cardinality(v_edu) = 0 or p.education = any(v_edu))
      and (cardinality(v_dr) = 0 or p.drinking = any(v_dr))
      and (cardinality(v_sm) = 0 or p.smoking = any(v_sm))
      and (cardinality(v_ex) = 0 or p.exercise = any(v_ex))
      and (coalesce((f->>'founders')::boolean, false) = false or p.is_founder)
      and (v_act is null or p.last_active_at > now() - make_interval(days => v_act))
  ),
  page as (
    select *, count(*) over () as n from c
    order by
      case when v_srt = 'active' then extract(epoch from coalesce(last_active_at, created_at)) end desc nulls last,
      case when v_srt = 'new' then extract(epoch from created_at) end desc nulls last,
      compat desc, coalesce(last_active_at, created_at) desc, id
    offset greatest(coalesce(p_page, 0), 0) * v_per limit v_per
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'first_name', first_name, 'age', case when birth_year is null then null else v_yr - birth_year end,
      'band', band, 'trend', case when show_improving then trend end, 'job', job, 'neighborhood', neighborhood, 'is_founder', is_founder,
      'compat', compat, 'height_cm', height_cm,
      'active', last_active_at > now() - interval '3 days')), '[]'::jsonb),
    coalesce(max(n), 0)
  into res, total from page;

  return jsonb_build_object('results', res, 'total', total, 'page', coalesce(p_page, 0), 'per_page', v_per,
    'remaining', case when limited then search_remaining() else null end, 'limited', false);
end $$;


notify pgrst, 'reload schema';
