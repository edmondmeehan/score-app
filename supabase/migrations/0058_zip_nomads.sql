-- 0058 Home zip decides the neighborhood, and members outside an open area are Nomads.
-- * The neighborhood is always filled in from the zip code. Members change their zip, never the neighborhood.
-- * If a member's zip is in an area we haven't opened (anywhere outside NYC today), they're tagged a Nomad:
--   they keep their account, chats and matches, but get no new Drops and don't show up in Drops or Search.
-- * When staff open their area (Admin → Waitlist), they stop being Nomads automatically.
-- Run after 0057.

alter table public.profiles add column if not exists nomad boolean not null default false;
alter table public.profiles add column if not exists nomad_since timestamptz;

-- Members can no longer type their own neighborhood; it comes from the zip.
revoke update (neighborhood) on public.profiles from authenticated;

create or replace function public.profile_check_zip() returns trigger
language plpgsql security definer set search_path = public as $$
declare a jsonb; z jsonb;
begin
  if new.zip is null then new.borough := null; new.area := null; new.neighborhood := null; new.nomad := false; new.nomad_since := null; return new; end if;
  new.zip := trim(new.zip);
  if new.zip !~ '^[0-9]{5}$' then raise exception 'Enter a 5-digit zip code' using errcode = 'P0001'; end if;
  a := zip_area(new.zip);
  z := zip_lookup(new.zip);
  new.area := a->>'area';
  new.borough := a->>'sub';
  new.city := coalesce(a->>'sub', a->>'area');
  new.neighborhood := coalesce(z->>'neighborhood', z->>'borough', nullif(a->>'area', 'Elsewhere'));
  new.nomad := not coalesce((a->>'open')::boolean, false);
  new.nomad_since := case when new.nomad then coalesce(case when tg_op = 'UPDATE' and old.nomad then old.nomad_since end, now()) end;
  return new;
end $$;
drop trigger if exists profile_zip on public.profiles;
create trigger profile_zip before insert or update of zip on public.profiles
  for each row execute function public.profile_check_zip();

-- Opening (or closing) an area updates everyone who lives there.
create or replace function public.trg_area_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    update profiles set nomad = (new.status <> 'open'),
      nomad_since = case when new.status <> 'open' then coalesce(nomad_since, now()) end
    where area = new.name;
  end if;
  return new;
end $$;
drop trigger if exists area_status on public.areas;
create trigger area_status after update of status on public.areas
  for each row execute function public.trg_area_status();

-- Backfill: everyone gets the neighborhood for their zip and the right Nomad tag.
update public.profiles set zip = zip where zip is not null;

-- What a member's zip would mean, for the profile form (before they save).
create or replace function public.zip_preview(p_zip text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when trim(p_zip) !~ '^[0-9]{5}$' then null else
    jsonb_build_object('area', a->>'area', 'open', coalesce((a->>'open')::boolean, false),
      'neighborhood', coalesce(z->>'neighborhood', z->>'borough', nullif(a->>'area', 'Elsewhere'))) end
  from (select zip_area(p_zip) a, zip_lookup(p_zip) z) x;
$$;
grant execute on function public.zip_preview(text) to anon, authenticated;

create index if not exists profiles_nomad on public.profiles(nomad) where nomad;

-- Drops and Search: only members in an open area, matched within the same area. Nomads get nothing new.

create or replace function public.fill_drop(me profiles, n int) returns int
language plpgsql security definer set search_path = public as $$
declare added int; aff jsonb := band_affinity(me.id);
begin
  if me.nomad then return 0; end if;
  insert into drops(user_id, match_id, compat)
  select me.id, c.id, c.compat from (
    select p.id, p.spotlight_until,
      least(99, 40
        + coalesce(10 * cardinality(array(select unnest(p.money_values) intersect select unnest(me.money_values))), 0)
        + case when p.band = me.band then 20 when p.band is null or me.band is null then 0 else 10 end
        + case when p.trend = 'up' then 5 else 0 end
        + coalesce((aff->>p.band)::int, 0)) compat          -- up to +10 for bands you actually engage with
    from profiles p
    where p.id <> me.id and p.status in ('active','preview') and not p.nomad and p.area is not distinct from me.area and p.band is not null and p.id_status = 'approved'
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
  if me.nomad then return jsonb_build_object('results', '[]'::jsonb, 'total', 0, 'remaining', 0, 'limited', false, 'nomad', true); end if;
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
    where p.id <> me.id and p.status in ('active','preview') and not p.nomad and p.area is not distinct from me.area and p.band is not null and p.id_status = 'approved'
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
grant execute on function public.member_search(jsonb, int) to authenticated;
