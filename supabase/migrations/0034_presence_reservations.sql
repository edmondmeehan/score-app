-- 0034: Opt-in "active" status in chat, and shared reservations on date plans. Safe to run more than once.

-- ---------- Presence (off by default) ----------
alter table public.profiles add column if not exists show_online boolean not null default false;
alter table public.profiles add column if not exists last_seen_at timestamptz;

create or replace function public.set_show_online(p_on boolean) returns void
language sql security definer set search_path = public as $$
  update profiles set show_online = coalesce(p_on, false), last_seen_at = case when p_on then now() else null end where id = auth.uid();
$$;
grant execute on function public.set_show_online(boolean) to authenticated;

-- Called every couple of minutes while the app is open. Records nothing unless the member turned it on.
create or replace function public.touch_presence() returns void
language sql security definer set search_path = public as $$
  update profiles set last_seen_at = now()
  where id = auth.uid() and show_online and (last_seen_at is null or last_seen_at < now() - interval '60 seconds');
$$;
grant execute on function public.touch_presence() to authenticated;

-- 'now' (last 5 min), 'hour' (last 60 min) or null. Only between two people who share an open chat,
-- and only when BOTH have the setting on (you only see others' status if you share yours).
create or replace function public.presence_of(p_user uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare seen timestamptz;
begin
  if not exists (select 1 from profiles where id = auth.uid() and show_online) then return null; end if;
  if not exists (select 1 from conversations c where c.ended_at is null
                 and ((c.user_a = auth.uid() and c.user_b = p_user) or (c.user_b = auth.uid() and c.user_a = p_user))) then return null; end if;
  select last_seen_at into seen from profiles where id = p_user and show_online;
  if seen is null then return null; end if;
  if seen > now() - interval '5 minutes' then return 'now'; end if;
  if seen > now() - interval '60 minutes' then return 'hour'; end if;
  return null;
end $$;
grant execute on function public.presence_of(uuid) to authenticated;

-- ---------- Shared reservations ----------
alter table public.date_plans add column if not exists reservation_by uuid references public.profiles(id) on delete set null;
alter table public.date_plans add column if not exists reservation_at timestamptz;
alter table public.date_plans add column if not exists reservation_name text check (reservation_name is null or length(reservation_name) <= 60);
alter table public.date_plans add column if not exists reservation_party int check (reservation_party is null or reservation_party between 1 and 20);
alter table public.date_plans add column if not exists reservation_conf text check (reservation_conf is null or length(reservation_conf) <= 60);
alter table public.date_plans add column if not exists reservation_note text check (reservation_note is null or length(reservation_note) <= 200);

-- Either person on an accepted plan can add (or clear) the booking. Posts a short note in the chat.
create or replace function public.set_date_reservation(p_plan uuid, p_at timestamptz, p_name text, p_party int, p_conf text, p_note text, p_clear boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare pl date_plans; c conversations;
begin
  select * into pl from date_plans where id = p_plan;
  if pl.id is null then raise exception 'Date not found'; end if;
  select * into c from conversations where id = pl.conversation_id;
  if auth.uid() not in (c.user_a, c.user_b) then raise exception 'forbidden'; end if;
  if pl.status <> 'accepted' then raise exception 'Confirm the date first.'; end if;
  if p_clear then
    update date_plans set reservation_by = null, reservation_at = null, reservation_name = null, reservation_party = null, reservation_conf = null, reservation_note = null where id = p_plan;
    return;
  end if;
  update date_plans set reservation_by = auth.uid(), reservation_at = coalesce(p_at, pl.starts_at),
    reservation_name = nullif(left(trim(coalesce(p_name, '')), 60), ''), reservation_party = coalesce(p_party, 2),
    reservation_conf = nullif(left(trim(coalesce(p_conf, '')), 60), ''), reservation_note = nullif(left(trim(coalesce(p_note, '')), 200), '')
  where id = p_plan;
  if c.ended_at is null then
    insert into messages(conversation_id, sender_id, body)
    values (c.id, auth.uid(), 'Booked a table at ' || pl.place || ' for ' || to_char(coalesce(p_at, pl.starts_at) at time zone 'America/New_York', 'Dy Mon FMDD, FMHH12:MI AM') || '. Details are on our date card.');
  end if;
end $$;
grant execute on function public.set_date_reservation(uuid, timestamptz, text, int, text, text, boolean) to authenticated;

notify pgrst, 'reload schema';
