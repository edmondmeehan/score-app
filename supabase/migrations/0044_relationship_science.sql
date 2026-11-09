-- 0044: Batch 4 — what relationship science says was missing.
--  1 Hear each other: a 30-second voice intro on profiles, voice messages in chat.
--  2 Go deeper: question sets that unlock as a chat matures; answers reveal only when both have answered.
--  3 Revealed preferences: the Drop learns a little from who you actually engage with; private post-date notes.
--  4 Money talk: guide lives in the app (no SQL).
--  5 Burnout: optional focus mode (max 5 open chats you start), rough-stretch check, monthly "how does dating feel?".
--  + Graduation: both people tap "We're together".

-- ---------- 1. Voice ----------
alter table public.profiles add column if not exists voice_path text;
alter table public.profiles add column if not exists voice_seconds int check (voice_seconds between 1 and 60);
alter table public.messages add column if not exists audio_path text;
alter table public.messages add column if not exists audio_seconds int check (audio_seconds between 1 and 120);

insert into storage.buckets (id, name, public) values ('voices', 'voices', false) on conflict do nothing;
drop policy if exists voices_upload on storage.objects;
create policy voices_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'voices' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists voices_delete on storage.objects;
create policy voices_delete on storage.objects for delete to authenticated
  using (bucket_id = 'voices' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists voices_read on storage.objects;
create policy voices_read on storage.objects for select to authenticated
  using (bucket_id = 'voices' and (public.my_status() in ('active','preview','paused','taken') or public.is_staff()));

create or replace function public.set_voice(p_path text, p_seconds int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_path is null or p_path = '' then
    update profiles set voice_path = null, voice_seconds = null where id = auth.uid();
    return;
  end if;
  if split_part(p_path, '/', 1) <> auth.uid()::text then raise exception 'bad path'; end if;
  update profiles set voice_path = left(p_path, 200), voice_seconds = greatest(1, least(60, coalesce(p_seconds, 30))) where id = auth.uid();
end $$;
grant execute on function public.set_voice(text, int) to authenticated;

-- ---------- 2. Go deeper ----------
create table if not exists public.deeper_questions (
  id int primary key,
  level int not null check (level between 1 and 3),
  q text not null check (length(q) <= 160)
);
alter table public.deeper_questions enable row level security;
drop policy if exists deeperq_read on public.deeper_questions;
create policy deeperq_read on public.deeper_questions for select to authenticated using (true);

insert into public.deeper_questions(id, level, q) values
  (1, 1, 'What’s something you’re looking forward to this month?'),
  (2, 1, 'What would a perfect ordinary Tuesday look like for you?'),
  (3, 1, 'What’s a small thing that always makes your day better?'),
  (4, 1, 'Who in your life makes you laugh the most, and why?'),
  (5, 1, 'What’s a place in the city that feels like yours?'),
  (6, 1, 'What did you want to be when you were a kid?'),
  (7, 2, 'What’s something you’ve changed your mind about in the last few years?'),
  (8, 2, 'What does a good weekend with a partner look like to you?'),
  (9, 2, 'What’s a goal you’re quietly working toward?'),
  (10, 2, 'What’s something people often get wrong about you at first?'),
  (11, 2, 'How do you like to be cared for when you’ve had a bad day?'),
  (12, 2, 'What’s a money habit you’re proud of?'),
  (13, 3, 'What’s a lesson a past relationship taught you?'),
  (14, 3, 'What does feeling at home with someone mean to you?'),
  (15, 3, 'What are you most grateful for right now?'),
  (16, 3, 'What would you want a partner to know about how you handle stress?'),
  (17, 3, 'Where do you see yourself in five years, and who’s there with you?'),
  (18, 3, 'What’s something you’d like to share that you haven’t yet?')
on conflict (id) do nothing;

create table if not exists public.deeper_answers (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id int not null references public.deeper_questions(id) on delete cascade,
  answer text not null check (length(answer) between 1 and 600),
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id, question_id)
);
alter table public.deeper_answers enable row level security;
-- No direct reads: answers come through deeper_state so the other person's stays hidden until both have answered.

create or replace function public.deeper_state(p_conversation uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c conversations; other uuid; total int; mine_n int; theirs_n int; cur record; out jsonb;
begin
  select * into c from conversations where id = p_conversation and auth.uid() in (user_a, user_b);
  if c.id is null or c.ended_at is not null then return null; end if;
  other := case when auth.uid() = c.user_a then c.user_b else c.user_a end;
  select count(*), count(*) filter (where sender_id = auth.uid()), count(*) filter (where sender_id = other)
    into total, mine_n, theirs_n from messages where conversation_id = c.id;
  -- Unlocks once a chat has real back-and-forth (16+ messages, 5+ from each) and is at least a day old.
  if total < 16 or mine_n < 5 or theirs_n < 5 or c.created_at > now() - interval '1 day' then
    return jsonb_build_object('unlocked', false);
  end if;
  select q.* into cur from deeper_questions q
  where not exists (select 1 from deeper_answers a where a.conversation_id = c.id and a.question_id = q.id and a.user_id = auth.uid())
     or not exists (select 1 from deeper_answers a where a.conversation_id = c.id and a.question_id = q.id and a.user_id = other)
  order by q.level, q.id limit 1;
  out := jsonb_build_object('unlocked', true,
    'current', case when cur.id is null then null else jsonb_build_object('id', cur.id, 'level', cur.level, 'q', cur.q,
       'mine', (select answer from deeper_answers where conversation_id = c.id and question_id = cur.id and user_id = auth.uid()),
       'they_answered', exists (select 1 from deeper_answers where conversation_id = c.id and question_id = cur.id and user_id = other)) end,
    'revealed', coalesce((select jsonb_agg(jsonb_build_object('q', q.q, 'level', q.level, 'mine', m.answer, 'theirs', t.answer) order by q.level, q.id)
       from deeper_questions q
       join deeper_answers m on m.conversation_id = c.id and m.question_id = q.id and m.user_id = auth.uid()
       join deeper_answers t on t.conversation_id = c.id and t.question_id = q.id and t.user_id = other), '[]'));
  return out;
end $$;
grant execute on function public.deeper_state(uuid) to authenticated;

create or replace function public.answer_deeper(p_conversation uuid, p_question int, p_answer text) returns boolean
language plpgsql security definer set search_path = public as $$
declare st jsonb := deeper_state(p_conversation); c conversations; other uuid; revealed boolean;
begin
  if st is null or not (st->>'unlocked')::boolean then raise exception 'not unlocked yet'; end if;
  if (st->'current'->>'id')::int is distinct from p_question then raise exception 'that question isn''t open'; end if;
  if length(trim(coalesce(p_answer, ''))) = 0 then raise exception 'write an answer first'; end if;
  insert into deeper_answers(conversation_id, user_id, question_id, answer)
    values (p_conversation, auth.uid(), p_question, left(trim(p_answer), 600)) on conflict do nothing;
  select * into c from conversations where id = p_conversation;
  other := case when auth.uid() = c.user_a then c.user_b else c.user_a end;
  revealed := exists (select 1 from deeper_answers where conversation_id = p_conversation and question_id = p_question and user_id = other);
  perform notify(other, auth.uid(), 'deeper', 'interaction',
    case when revealed then 'Your answers are revealed' else first_name_of(auth.uid()) || ' answered a Go deeper question' end,
    case when revealed then 'See what you both said.' else 'Answer too to see theirs.' end,
    '/app/messages/' || p_conversation || '#deeper', 'deeper:' || p_conversation || ':' || p_question);
  return revealed;
end $$;
grant execute on function public.answer_deeper(uuid, int, text) to authenticated;

-- ---------- 3. Revealed preferences + private notes ----------
alter table public.date_feedback add column if not exists note text check (length(note) <= 500);

drop function if exists public.date_again(uuid, text);
create or replace function public.date_again(p_plan uuid, p_answer text, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare d date_plans; c conversations; other uuid; theirs text;
begin
  if p_answer not in ('yes','maybe','no') then raise exception 'bad answer'; end if;
  select * into d from date_plans where id = p_plan;
  select * into c from conversations where id = d.conversation_id and auth.uid() in (user_a, user_b);
  if c.id is null then raise exception 'not found'; end if;
  insert into date_feedback(plan_id, user_id, again, note) values (p_plan, auth.uid(), p_answer, left(nullif(trim(coalesce(p_note, '')), ''), 500))
    on conflict (plan_id, user_id) do update set again = excluded.again, note = coalesce(excluded.note, date_feedback.note), created_at = now();
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
grant execute on function public.date_again(uuid, text, text) to authenticated;

create or replace function public.my_date_notes() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('note', f.note, 'place', d.place, 'at', d.starts_at) order by d.starts_at desc), '[]')
  from (select * from date_feedback where user_id = auth.uid() and note is not null order by created_at desc limit 5) f
  join date_plans d on d.id = f.plan_id;
$$;
grant execute on function public.my_date_notes() to authenticated;

-- Which bands you actually engage with (likes, chats you write in, yes to a second date). Needs 5+ signals before it counts.
create or replace function public.band_affinity(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with sig as (
    select p.band from likes l join profiles p on p.id = l.liked where l.liker = p_user and p.band is not null
    union all
    select p.band from conversations c join profiles p on p.id = case when c.user_a = p_user then c.user_b else c.user_a end
      where p_user in (c.user_a, c.user_b) and p.band is not null
        and exists (select 1 from messages m where m.conversation_id = c.id and m.sender_id = p_user)
    union all
    select p.band from date_feedback f join date_plans d on d.id = f.plan_id join conversations c on c.id = d.conversation_id
      join profiles p on p.id = case when c.user_a = p_user then c.user_b else c.user_a end
      where f.user_id = p_user and f.again = 'yes' and p.band is not null),
  n as (select count(*) total from sig)
  select case when (select total from n) < 5 then '{}'::jsonb
    else coalesce((select jsonb_object_agg(band, round(10.0 * cnt / (select total from n))) from (select band, count(*) cnt from sig group by band) x), '{}') end;
$$;
revoke all on function public.band_affinity(uuid) from public, anon, authenticated;

create or replace function public.fill_drop(me profiles, n int) returns int
language plpgsql security definer set search_path = public as $$
declare added int; aff jsonb := band_affinity(me.id);
begin
  insert into drops(user_id, match_id, compat)
  select me.id, c.id, c.compat from (
    select p.id, p.spotlight_until,
      least(99, 40
        + coalesce(10 * cardinality(array(select unnest(p.money_values) intersect select unnest(me.money_values))), 0)
        + case when p.band = me.band then 20 when p.band is null or me.band is null then 0 else 10 end
        + case when p.trend = 'up' then 5 else 0 end
        + coalesce((aff->>p.band)::int, 0)) compat          -- up to +10 for bands you actually engage with
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

-- ---------- 5. Burnout protection ----------
alter table public.profiles add column if not exists focus_mode boolean not null default false;
grant update (focus_mode) on public.profiles to authenticated;

create or replace function public.trg_focus_mode() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); open_n int;
begin
  if me is null or me not in (new.user_a, new.user_b) then return new; end if;
  if exists (select 1 from conversations where user_a = new.user_a and user_b = new.user_b) then return new; end if;  -- reopening, not new
  if not exists (select 1 from profiles where id = me and focus_mode) then return new; end if;
  select count(*) into open_n from conversations where me in (user_a, user_b) and ended_at is null;
  if open_n >= 5 then raise exception 'Focus mode is on: you have 5 open chats. Close one kindly or turn focus mode off in Me.'; end if;
  return new;
end $$;
drop trigger if exists focus_mode on public.conversations;
create trigger focus_mode before insert on public.conversations for each row execute function public.trg_focus_mode();

create table if not exists public.wellbeing_checkins (
  user_id uuid not null references public.profiles(id) on delete cascade,
  month date not null,
  score int not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (user_id, month)
);
alter table public.wellbeing_checkins enable row level security;
drop policy if exists wellbeing_own on public.wellbeing_checkins;
create policy wellbeing_own on public.wellbeing_checkins for select using (user_id = auth.uid());

-- What the Drop page needs: open chats (for focus mode), a rough stretch, and whether this month's check-in is due.
create or replace function public.wellbeing_state() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'open_chats', (select count(*) from conversations where auth.uid() in (user_a, user_b) and ended_at is null),
    'closed_on_me', (select count(*) from conversations where auth.uid() in (user_a, user_b) and ended_at > now() - interval '7 days'
                     and ended_by is not null and ended_by <> auth.uid()),
    'checkin_due', exists (select 1 from profiles p where p.id = auth.uid() and p.status = 'active' and p.created_at < now() - interval '14 days')
                   and not exists (select 1 from wellbeing_checkins w where w.user_id = auth.uid() and w.month = date_trunc('month', current_date)::date));
$$;
grant execute on function public.wellbeing_state() to authenticated;

create or replace function public.save_wellbeing(p_score int) returns void
language sql security definer set search_path = public as $$
  insert into wellbeing_checkins(user_id, month, score) values (auth.uid(), date_trunc('month', current_date)::date, greatest(1, least(5, p_score)))
  on conflict (user_id, month) do update set score = excluded.score, created_at = now();
$$;
grant execute on function public.save_wellbeing(int) to authenticated;

create or replace function public.staff_wellbeing() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.is_staff() then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('month', to_char(month, 'Mon YYYY'), 'n', n, 'avg', avg,
             'low', low) order by month desc)
    from (select month, count(*) n, round(avg(score), 2) avg, count(*) filter (where score <= 2) low
          from wellbeing_checkins group by month order by month desc limit 12) x), '[]') end;
$$;
grant execute on function public.staff_wellbeing() to authenticated;

-- ---------- Graduation: "We're together" ----------
create table if not exists public.together_marks (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.together_marks enable row level security;
drop policy if exists together_own on public.together_marks;
create policy together_own on public.together_marks for select using (
  exists (select 1 from conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)));

create or replace function public.mark_together(p_conversation uuid, p_on boolean default true) returns text
language plpgsql security definer set search_path = public as $$
declare c conversations; other uuid;
begin
  select * into c from conversations where id = p_conversation and auth.uid() in (user_a, user_b);
  if c.id is null or c.ended_at is not null then raise exception 'not found'; end if;
  other := case when auth.uid() = c.user_a then c.user_b else c.user_a end;
  if not p_on then delete from together_marks where conversation_id = c.id and user_id = auth.uid(); return 'off'; end if;
  insert into together_marks(conversation_id, user_id) values (c.id, auth.uid()) on conflict do nothing;
  if exists (select 1 from together_marks where conversation_id = c.id and user_id = other) then
    perform notify(auth.uid(), null, 'together', 'milestone', 'It’s official', 'You and ' || first_name_of(other) || ' are together. Congratulations.', '/app/messages/' || c.id, 'together:' || c.id, true);
    perform notify(other, null, 'together', 'milestone', 'It’s official', 'You and ' || first_name_of(auth.uid()) || ' are together. Congratulations.', '/app/messages/' || c.id, 'together:' || c.id, true);
    return 'mutual';
  end if;
  -- One-sided taps stay private: the other person only finds out if they tap it too.
  return 'waiting';
end $$;
grant execute on function public.mark_together(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
