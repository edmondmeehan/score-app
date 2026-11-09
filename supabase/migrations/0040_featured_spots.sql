-- 0040: Featured date spots — venues that pay to appear as "ScoreDate picks" in Suggest a date,
-- with an optional member perk, and tracking (views, taps, dates suggested, dates accepted) to show them results.

create table if not exists public.featured_spots (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  place_id text,
  address text check (length(address) <= 200),
  lat numeric(9,6),
  lng numeric(9,6),
  neighborhood text check (length(neighborhood) <= 80),
  blurb text check (length(blurb) <= 160),
  perk text check (length(perk) <= 140),
  badge text not null default 'ScoreDate Partner' check (length(badge) <= 30),
  priority int not null default 0,
  active boolean not null default true,
  starts_on date,
  ends_on date,
  monthly_fee numeric(10,2),
  contact_name text check (length(contact_name) <= 80),
  contact_email text check (length(contact_email) <= 160),
  notes text check (length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists featured_spots_place on public.featured_spots(place_id);
alter table public.featured_spots enable row level security;
drop policy if exists featured_staff on public.featured_spots;
create policy featured_staff on public.featured_spots for all using (public.is_staff()) with check (public.is_staff());
grant select, insert, update, delete on public.featured_spots to authenticated;

create table if not exists public.featured_spot_events (
  id bigint generated always as identity primary key,
  spot_id uuid not null references public.featured_spots(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('view','click','plan','reserve')),
  created_at timestamptz not null default now()
);
create index if not exists featured_events_spot on public.featured_spot_events(spot_id, kind, created_at);
alter table public.featured_spot_events enable row level security;
drop policy if exists featured_events_staff on public.featured_spot_events;
create policy featured_events_staff on public.featured_spot_events for select using (public.is_staff());

-- Live picks for members: only the public fields, only active spots inside their date range.
create or replace function public.featured_spots_live() returns table(id uuid, name text, place_id text, address text, lat numeric, lng numeric, neighborhood text, blurb text, perk text, badge text)
language sql stable security definer set search_path = public as $$
  select f.id, f.name, f.place_id, f.address, f.lat, f.lng, f.neighborhood, f.blurb, f.perk, f.badge
  from featured_spots f
  where f.active and (f.starts_on is null or f.starts_on <= current_date) and (f.ends_on is null or f.ends_on >= current_date)
    and auth.uid() is not null
  order by f.priority desc, f.created_at
  limit 6;
$$;
grant execute on function public.featured_spots_live() to authenticated;

-- Members' devices log views and taps. Views count once per member per spot per day.
create or replace function public.log_featured(p_spot uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_kind not in ('view','click','reserve') then return; end if;
  if not exists (select 1 from featured_spots where id = p_spot and active) then return; end if;
  if p_kind = 'view' and exists (select 1 from featured_spot_events where spot_id = p_spot and user_id = auth.uid() and kind = 'view' and created_at > now() - interval '1 day') then return; end if;
  insert into featured_spot_events(spot_id, user_id, kind) values (p_spot, auth.uid(), p_kind);
end $$;
grant execute on function public.log_featured(uuid, text) to authenticated;

-- Staff report: per spot, in a date range.
create or replace function public.staff_featured_report(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.is_staff() then '[]'::jsonb else coalesce(jsonb_agg(r order by r->>'name'), '[]'::jsonb) end
  from (
    select jsonb_build_object(
      'id', f.id, 'name', f.name,
      'views', (select count(*) from featured_spot_events e where e.spot_id = f.id and e.kind = 'view' and e.created_at::date between p_from and p_to),
      'members', (select count(distinct e.user_id) from featured_spot_events e where e.spot_id = f.id and e.kind = 'view' and e.created_at::date between p_from and p_to),
      'clicks', (select count(*) from featured_spot_events e where e.spot_id = f.id and e.kind = 'click' and e.created_at::date between p_from and p_to),
      'reserve', (select count(*) from featured_spot_events e where e.spot_id = f.id and e.kind = 'reserve' and e.created_at::date between p_from and p_to),
      'plans', (select count(*) from date_plans d where f.place_id is not null and d.place_id = f.place_id and d.created_at::date between p_from and p_to),
      'accepted', (select count(*) from date_plans d where f.place_id is not null and d.place_id = f.place_id and d.status = 'accepted' and d.created_at::date between p_from and p_to)
    ) r
    from featured_spots f
  ) x;
$$;
grant execute on function public.staff_featured_report(date, date) to authenticated;
