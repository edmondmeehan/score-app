-- 0076: "This matters to me" for religion and politics.
-- A member who has picked a religion (or politics) can turn on "Only show me people who share this".
-- Their Drop and search then only include people with the same answer, and they're also hidden from anyone who
-- doesn't share it (so it works both ways). Members who don't turn it on are matched exactly as before.
-- Safe to re-run.

alter table public.profiles add column if not exists religion_match boolean not null default false;
alter table public.profiles add column if not exists politics_match boolean not null default false;
grant update (religion_match, politics_match) on public.profiles to authenticated;

-- True when b passes a's "This matters to me" settings. 'other' and blank answers can't be required.
create or replace function public.values_ok(a profiles, b profiles) returns boolean
language sql immutable set search_path = public as $$
  select (not a.religion_match or a.religion is null or a.religion = 'other' or b.religion is not distinct from a.religion)
     and (not a.politics_match or a.politics is null or a.politics = 'other' or b.politics is not distinct from a.politics);
$$;
revoke all on function public.values_ok(profiles, profiles) from public, anon, authenticated;

create or replace function public.fill_drop(me profiles, n int) returns int
language plpgsql security definer set search_path = public as $$
declare added int; aff jsonb := band_affinity(me.id);
begin
  if (me.nomad and not coalesce(me.visit_until >= current_date, false)) or coalesce(me.away_until >= current_date and me.away_pause, false) then return 0; end if;
  insert into drops(user_id, match_id, compat)
  select me.id, c.id, c.compat from (
    select p.id, p.spotlight_until,
      least(99, 40
        + coalesce(10 * cardinality(array(select unnest(p.money_values) intersect select unnest(me.money_values))), 0)
        + case when p.band = me.band then 20 when p.band is null or me.band is null then 0 else 10 end
        + case when p.trend = 'up' then 5 else 0 end
        + coalesce((aff->>p.band)::int, 0)) compat          -- up to +10 for bands you actually engage with
    from profiles p
    where p.id <> me.id and p.status in ('active','preview') and not (p.nomad and not coalesce(p.visit_until >= current_date, false))
      and not coalesce(p.away_until >= current_date and p.away_pause, false)
      and (case when p.visit_until >= current_date then p.visit_area else p.area end) is not distinct from (case when me.visit_until >= current_date then me.visit_area else me.area end) and p.band is not null and p.id_status = 'approved'
      and (cardinality(me.seeking) = 0 or p.gender = any(me.seeking))
      and (cardinality(p.seeking) = 0 or me.gender = any(p.seeking))
      and not exists (select 1 from blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
      and values_ok(me, p) and values_ok(p, me)
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
  if me.nomad and not coalesce(me.visit_until >= current_date, false) then return jsonb_build_object('results', '[]'::jsonb, 'total', 0, 'remaining', 0, 'limited', false, 'nomad', true); end if;
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
    where p.id <> me.id and p.status in ('active','preview') and not (p.nomad and not coalesce(p.visit_until >= current_date, false))
      and not coalesce(p.away_until >= current_date and p.away_pause, false)
      and (case when p.visit_until >= current_date then p.visit_area else p.area end) is not distinct from (case when me.visit_until >= current_date then me.visit_area else me.area end) and p.band is not null and p.id_status = 'approved'
      and (cardinality(me.seeking) = 0 or p.gender = any(me.seeking))
      and (cardinality(p.seeking) = 0 or me.gender = any(p.seeking))
      and not exists (select 1 from blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
      and values_ok(me, p) and values_ok(p, me)
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
