-- 0041: rotating member pass (QR) check-ins.

alter table public.event_rsvps add column if not exists checked_in_at timestamptz;
alter table public.event_rsvps add column if not exists checked_in_by text;

create table if not exists public.member_scans (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  staff_email text not null,
  result text not null,
  created_at timestamptz not null default now()
);
create index if not exists member_scans_user on public.member_scans(user_id, created_at desc);
create index if not exists member_scans_event on public.member_scans(event_id, created_at desc);
alter table public.member_scans enable row level security;
drop policy if exists member_scans_staff on public.member_scans;
create policy member_scans_staff on public.member_scans for select using (public.is_staff());

-- Record a scan (and check the member in to the event, if one is chosen). The pass itself is verified by the
-- server before this is called; staff only.
create or replace function public.staff_scan_member(p_user uuid, p_event uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare who text := staff_email(); r event_rsvps; already boolean := false; res text := 'ok';
begin
  if who is null then raise exception 'staff only'; end if;
  if p_event is not null then
    select * into r from event_rsvps where event_id = p_event and user_id = p_user;
    if r.event_id is null then res := 'no_rsvp';
    elsif r.status <> 'going' then res := 'rsvp_' || r.status;
    else
      already := r.checked_in_at is not null;
      update event_rsvps set checked_in_at = coalesce(checked_in_at, now()), checked_in_by = coalesce(checked_in_by, who)
        where event_id = p_event and user_id = p_user returning * into r;
      res := case when already then 'already_in' else 'checked_in' end;
    end if;
  end if;
  insert into member_scans(user_id, event_id, staff_email, result) values (p_user, p_event, who, res);
  return jsonb_build_object('result', res, 'checked_in_at', r.checked_in_at,
    'going', (select count(*) from event_rsvps where event_id = p_event and status = 'going'),
    'checked_in', (select count(*) from event_rsvps where event_id = p_event and checked_in_at is not null));
end $$;
grant execute on function public.staff_scan_member(uuid, uuid) to authenticated;
