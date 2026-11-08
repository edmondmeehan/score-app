-- 0033: Richer events. Header image, host, dress code; who's-going stats; a public bucket for event images.
-- Safe to run more than once.

alter table public.events add column if not exists image_path text;
alter table public.events add column if not exists host text check (host is null or length(host) <= 80);
alter table public.events add column if not exists dress_code text check (dress_code is null or length(dress_code) <= 80);

-- Event header images: anyone can view (they're promotional), only staff can upload or change them.
insert into storage.buckets (id, name, public) values ('events', 'events', true) on conflict (id) do update set public = true;
drop policy if exists events_img_write on storage.objects;
create policy events_img_write on storage.objects for insert to authenticated with check (bucket_id = 'events' and public.is_staff());
drop policy if exists events_img_update on storage.objects;
create policy events_img_update on storage.objects for update to authenticated using (bucket_id = 'events' and public.is_staff());
drop policy if exists events_img_delete on storage.objects;
create policy events_img_delete on storage.objects for delete to authenticated using (bucket_id = 'events' and public.is_staff());

create or replace function public.staff_set_event_extras(p_id uuid, p_image_path text, p_host text, p_dress_code text, p_clear_image boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  update events set
    image_path = case when p_clear_image then null else coalesce(nullif(p_image_path, ''), image_path) end,
    host = nullif(left(trim(coalesce(p_host, '')), 80), ''),
    dress_code = nullif(left(trim(coalesce(p_dress_code, '')), 80), '')
  where id = p_id;
end $$;
grant execute on function public.staff_set_event_extras(uuid, text, text, text, boolean) to authenticated;

-- Going counts for the events list (members only).
create or replace function public.event_going_counts() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(e.id, (select count(*) from event_rsvps r where r.event_id = e.id and r.status = 'going')), '{}')
  from events e
  where e.status in ('published','cancelled') and e.starts_at > now() - interval '6 hours'
    and (public.my_status() in ('active','preview','paused','taken') or public.is_staff());
$$;
grant execute on function public.event_going_counts() to authenticated;

-- Who's going, without naming anyone: totals, how many of your matches are going, new RSVPs this week,
-- and the band mix only once 8+ people are going (so no one can be singled out).
create or replace function public.event_social(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); going int; out jsonb;
begin
  if not (public.my_status() in ('active','preview','paused','taken') or public.is_staff()) then return '{}'; end if;
  select count(*) into going from event_rsvps where event_id = p_event and status = 'going';
  out := jsonb_build_object(
    'going', going,
    'waitlist', (select count(*) from event_rsvps where event_id = p_event and status = 'waitlist'),
    'this_week', (select count(*) from event_rsvps where event_id = p_event and status = 'going' and created_at > now() - interval '7 days'),
    'matches_going', (select count(*) from event_rsvps r join conversations c
        on (c.user_a = uid and c.user_b = r.user_id) or (c.user_b = uid and c.user_a = r.user_id)
        where r.event_id = p_event and r.status = 'going' and r.user_id <> uid and c.ended_at is null),
    'bands', case when going >= 8 then (
        select jsonb_object_agg(band, n) from (
          select p.band, count(*) n from event_rsvps r join profiles p on p.id = r.user_id
          where r.event_id = p_event and r.status = 'going' and p.band is not null group by p.band) b)
      else null end);
  return out;
end $$;
grant execute on function public.event_social(uuid) to authenticated;

notify pgrst, 'reload schema';
