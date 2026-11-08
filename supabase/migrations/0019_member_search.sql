-- Member search: filter members by the things people actually narrow dating down to.
-- Safe to run more than once. Run after 0018.
--
--   • New optional profile details: height, kids (have / want), education, drinking, smoking, exercise.
--   • member_search(): only active, ID-verified members with a band, who are looking for each other,
--     never anyone blocked either way, never yourself. Paused/hidden members never appear.
--   • Membership/Preview: a few searches a day (app_config search_free_daily, default 10). Premium and Reserve: unlimited.

alter table public.profiles add column if not exists last_active_at timestamptz;
alter table public.profiles add column if not exists height_cm int;
alter table public.profiles add column if not exists has_kids text;
alter table public.profiles add column if not exists wants_kids text;
alter table public.profiles add column if not exists education text;
alter table public.profiles add column if not exists drinking text;
alter table public.profiles add column if not exists smoking text;
alter table public.profiles add column if not exists exercise text;

do $$ begin
  alter table public.profiles add constraint profiles_height_ck check (height_cm is null or height_cm between 120 and 230);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_has_kids_ck check (has_kids is null or has_kids in ('yes','no'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_wants_kids_ck check (wants_kids is null or wants_kids in ('yes','no','open'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_education_ck check (education is null or education in ('high_school','trade','some_college','bachelors','masters','doctorate'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_drinking_ck check (drinking is null or drinking in ('never','socially','often'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_smoking_ck check (smoking is null or smoking in ('never','sometimes','often'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_exercise_ck check (exercise is null or exercise in ('rarely','sometimes','often'));
exception when duplicate_object then null; end $$;

grant update (height_cm, has_kids, wants_kids, education, drinking, smoking, exercise) on public.profiles to authenticated;

insert into public.app_config(key, value) values ('search_free_daily', '10') on conflict (key) do nothing;

create table if not exists public.search_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null default current_date,
  searches int not null default 0,
  primary key (user_id, day)
);
alter table public.search_usage enable row level security;   -- no policies: only member_search() touches it

-- Is place key k inside area a (itself, its parent, or its grandparent)?
create or replace function public.place_in(k text, a text) returns boolean language sql stable set search_path = public as $$
  select k is not null and a is not null and (k = a or exists (
    select 1 from map_places m left join map_places m2 on m2.key = m.parent
    where m.key = k and (m.parent = a or m2.parent = a)));
$$;

-- Searches left today (null = unlimited).
create or replace function public.search_remaining() returns int
language plpgsql stable security definer set search_path = public as $$
declare me profiles; used int;
begin
  select * into me from profiles where id = auth.uid();
  if me.plan in ('premium','black') then return null; end if;
  select coalesce(searches, 0) into used from search_usage where user_id = me.id and day = current_date;
  return greatest(0, coalesce((select (value #>> '{}')::int from app_config where key = 'search_free_daily'), 10) - coalesce(used, 0));
end $$;
grant execute on function public.search_remaining() to authenticated;

-- f keys (all optional): q, age_min, age_max, bands[], trend_up, area, money[], height_min, height_max,
-- has_kids, wants_kids[], education[], drinking[], smoking[], exercise[], founders, active_days, sort ('match'|'active'|'new')
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
      and (coalesce((f->>'trend_up')::boolean, false) = false or p.trend = 'up')
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
      'band', band, 'trend', trend, 'job', job, 'neighborhood', neighborhood, 'is_founder', is_founder,
      'compat', compat, 'height_cm', height_cm,
      'active', last_active_at > now() - interval '3 days')), '[]'::jsonb),
    coalesce(max(n), 0)
  into res, total from page;

  return jsonb_build_object('results', res, 'total', total, 'page', coalesce(p_page, 0), 'per_page', v_per,
    'remaining', case when limited then search_remaining() else null end, 'limited', false);
end $$;
revoke execute on function public.member_search(jsonb, int) from public, anon;
grant execute on function public.member_search(jsonb, int) to authenticated;

-- Areas for the search picker: boroughs and wider areas, then neighborhoods.
create or replace function public.search_areas() returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', key, 'name', name, 'kind', kind)
    order by case kind when 'area' then 0 when 'borough' then 1 else 2 end, name), '[]') from map_places;
$$;
grant execute on function public.search_areas() to authenticated;
