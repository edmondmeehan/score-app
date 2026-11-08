-- 0025: Google Places details for event venues and date plans (place id + coordinates for maps).
alter table public.events add column if not exists place_id text;
alter table public.events add column if not exists lat double precision;
alter table public.events add column if not exists lng double precision;
alter table public.date_plans add column if not exists place_id text;
alter table public.date_plans add column if not exists lat double precision;
alter table public.date_plans add column if not exists lng double precision;

create or replace function public.staff_set_event_place(p_id uuid, p_place_id text, p_lat double precision, p_lng double precision) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  update events set place_id = nullif(left(p_place_id, 300), ''), lat = p_lat, lng = p_lng where id = p_id;
end $$;
grant execute on function public.staff_set_event_place(uuid, text, double precision, double precision) to authenticated;

-- Only the person who proposed a date can attach its map location, and only right after proposing.
create or replace function public.set_date_place(p_date uuid, p_place_id text, p_lat double precision, p_lng double precision) returns void
language plpgsql security definer set search_path = public as $$
begin
  update date_plans set place_id = nullif(left(p_place_id, 300), ''), lat = p_lat, lng = p_lng
  where id = p_date and proposer_id = auth.uid() and status = 'proposed';
end $$;
grant execute on function public.set_date_place(uuid, text, double precision, double precision) to authenticated;
