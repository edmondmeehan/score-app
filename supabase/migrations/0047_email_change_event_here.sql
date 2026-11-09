-- 0047:
--  * Changing your email in Me: once Supabase confirms the new address, copy it to the profile (used for ScoreDate emails).
--  * "Here now" at events: during an event, people who've checked in see which of their matches are there;
--    everyone else (members) sees only how many members are there.

create or replace function public.trg_auth_email_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists auth_email_sync on auth.users;
create trigger auth_email_sync after update of email on auth.users for each row execute function public.trg_auth_email_sync();

create or replace function public.event_here(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e events; me uuid := auth.uid(); live boolean; mine event_rsvps;
begin
  if not (public.my_status() in ('active','preview','paused','taken') or public.is_staff()) then return null; end if;
  select * into e from events where id = p_event and status = 'published';
  if e.id is null then return null; end if;
  -- "Live" from 1 hour before the start until the end (or 5 hours after the start if no end time).
  live := now() between e.starts_at - interval '1 hour' and coalesce(e.ends_at, e.starts_at + interval '5 hours');
  if not live then return jsonb_build_object('live', false); end if;
  select * into mine from event_rsvps where event_id = p_event and user_id = me;
  return jsonb_build_object(
    'live', true,
    'here', (select count(*) from event_rsvps where event_id = p_event and checked_in_at is not null),
    'me_here', mine.checked_in_at is not null,
    -- Names only for people you've matched with, only once you're checked in yourself, never across a block.
    'matches', case when mine.checked_in_at is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'first_name', p.first_name, 'conversation_id', c.id, 'since', r.checked_in_at) order by r.checked_in_at desc)
      from event_rsvps r
      join profiles p on p.id = r.user_id
      join conversations c on c.ended_at is null and ((c.user_a = me and c.user_b = r.user_id) or (c.user_b = me and c.user_a = r.user_id))
      where r.event_id = p_event and r.checked_in_at is not null and r.user_id <> me and not blocked_between(me, r.user_id)), '[]') end);
end $$;
grant execute on function public.event_here(uuid) to authenticated;

notify pgrst, 'reload schema';
