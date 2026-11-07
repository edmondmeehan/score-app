-- Everyone can join the waitlist. Each zip is tagged with an area (NYC borough, Long Island, New Jersey,
-- Westchester, …) so invites can be released area by area, or zip by zip, over time.
-- Run after 0003 and 0004.

create table if not exists public.areas (
  name text primary key,
  status text not null default 'waitlist' check (status in ('open','waitlist')),
  sort int not null default 100
);
insert into public.areas(name, status, sort) values
  ('New York City','open',1), ('Long Island','waitlist',2), ('Westchester','waitlist',3), ('New Jersey','waitlist',4),
  ('Hudson Valley','waitlist',5), ('Connecticut','waitlist',6), ('Elsewhere','waitlist',99)
on conflict (name) do nothing;
alter table public.areas enable row level security;
drop policy if exists areas_read on public.areas;
create policy areas_read on public.areas for select using (true);
grant select on public.areas to anon, authenticated;

-- First three digits of a zip → area. NYC zips are matched exactly from nyc_zip_codes first.
create table if not exists public.zip_prefix_areas (
  prefix text primary key check (prefix ~ '^[0-9]{3}$'),
  area text not null references public.areas(name) on update cascade
);
insert into public.zip_prefix_areas(prefix, area)
select lpad(p::text, 3, '0'), 'New Jersey' from generate_series(70, 89) p
union all select lpad(p::text, 3, '0'), 'Connecticut' from generate_series(60, 69) p
union all select p, 'Westchester' from unnest(array['105','106','107','108']) p
union all select '109', 'Hudson Valley' union all select '125', 'Hudson Valley' union all select '126', 'Hudson Valley'
union all select p, 'Long Island' from unnest(array['110','115','117','118','119']) p
on conflict (prefix) do nothing;
alter table public.zip_prefix_areas enable row level security;
drop policy if exists zpa_read on public.zip_prefix_areas;
create policy zpa_read on public.zip_prefix_areas for select using (true);
grant select on public.zip_prefix_areas to anon, authenticated;

-- {area, sub (borough for NYC), open}
create or replace function public.zip_area(p_zip text) returns jsonb
language sql stable security definer set search_path = public as $$
  with z as (select trim(p_zip) zip),
  m as (
    select coalesce(
      (select jsonb_build_object('area', 'New York City', 'sub', n.borough) from nyc_zip_codes n, z where n.zip = z.zip and n.active),
      (select jsonb_build_object('area', a.area, 'sub', null) from zip_prefix_areas a, z where a.prefix = left(z.zip, 3)),
      jsonb_build_object('area', 'Elsewhere', 'sub', null)) j)
  select m.j || jsonb_build_object('open', coalesce((select status = 'open' from areas where name = m.j->>'area'), false)) from m;
$$;
grant execute on function public.zip_area(text) to anon, authenticated;

-- ---------- Waitlist: never reject, just tag ----------
alter table public.waitlist add column if not exists area text;
alter table public.waitlist add column if not exists invite_code text;
create index if not exists waitlist_area_zip on public.waitlist(area, zip, status);

create or replace function public.waitlist_check_zip() returns trigger
language plpgsql security definer set search_path = public as $$
declare a jsonb;
begin
  new.zip := nullif(trim(coalesce(new.zip, '')), '');
  if new.zip is null or new.zip !~ '^[0-9]{5}$' then raise exception 'Enter a 5-digit zip code' using errcode = 'P0001'; end if;
  a := zip_area(new.zip);
  new.area := a->>'area';
  new.borough := a->>'sub';
  new.city := coalesce(a->>'sub', a->>'area');
  return new;
end $$;

-- ---------- Profiles: never reject, just tag ----------
alter table public.profiles add column if not exists area text;
create or replace function public.profile_check_zip() returns trigger
language plpgsql security definer set search_path = public as $$
declare a jsonb;
begin
  if new.zip is null then new.borough := null; new.area := null; return new; end if;
  new.zip := trim(new.zip);
  if new.zip !~ '^[0-9]{5}$' then raise exception 'Enter a 5-digit zip code' using errcode = 'P0001'; end if;
  a := zip_area(new.zip);
  new.area := a->>'area';
  new.borough := a->>'sub';
  new.city := coalesce(a->>'sub', a->>'area');
  return new;
end $$;

-- Backfill anything already on the list.
update public.waitlist w set area = (zip_area(w.zip))->>'area', borough = (zip_area(w.zip))->>'sub' where w.zip is not null and w.area is null;
update public.profiles p set area = (zip_area(p.zip))->>'area' where p.zip is not null and p.area is null;

-- ---------- Staff ----------
create or replace function public.staff_waitlist_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  return jsonb_build_object(
    'areas', coalesce((select jsonb_agg(row_to_json(x) order by x.sort) from (
        select a.name, a.status, a.sort,
          (select count(*) from waitlist w where w.area = a.name and w.status = 'waiting') waiting,
          (select count(*) from waitlist w where w.area = a.name and w.status = 'invited') invited,
          (select count(*) from waitlist w where w.area = a.name and w.status = 'joined') joined
        from areas a) x), '[]'),
    'zips', coalesce((select jsonb_agg(row_to_json(x) order by x.waiting desc) from (
        select area, zip, coalesce(max(borough), '') sub, count(*) filter (where status = 'waiting') waiting, count(*) total
        from waitlist where zip is not null group by area, zip order by 4 desc limit 300) x), '[]'));
end $$;

create or replace function public.staff_set_area(p_name text, p_status text, p_sort int default null) returns void
language plpgsql security definer set search_path = public as $$
declare who text := staff_email();
begin
  if not is_staff() then raise exception 'staff only'; end if;
  insert into areas(name, status, sort) values (trim(p_name), p_status, coalesce(p_sort, 50))
    on conflict (name) do update set status = excluded.status, sort = coalesce(p_sort, areas.sort);
  insert into audit_log(staff_email, action, reason) values (who, 'area_' || p_status, trim(p_name));
end $$;

-- Map a 3-digit zip prefix to an area (creates the area if needed) and re-tag waiting people.
create or replace function public.staff_set_prefix(p_prefix text, p_area text) returns void
language plpgsql security definer set search_path = public as $$
declare who text := staff_email();
begin
  if not is_staff() then raise exception 'staff only'; end if;
  insert into areas(name) values (trim(p_area)) on conflict do nothing;
  insert into zip_prefix_areas(prefix, area) values (p_prefix, trim(p_area)) on conflict (prefix) do update set area = excluded.area;
  update waitlist set area = trim(p_area) where left(zip, 3) = p_prefix and borough is null;
  insert into audit_log(staff_email, action, reason) values (who, 'zip_prefix', p_prefix || ' → ' || trim(p_area));
end $$;

-- Invite the next p_limit waiting people in an area and/or a list of zips (oldest first, referrals first).
-- Returns [{code, email, first_name, days}] for the server to email.
create or replace function public.staff_invite_batch(p_area text, p_zips text[], p_limit int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare who text := staff_email(); w waitlist; c text; out jsonb := '[]'; n int := 0;
begin
  if not is_staff() then raise exception 'staff only'; end if;
  for w in
    select * from waitlist
    where status = 'waiting'
      and (nullif(p_area, '') is null or area = p_area)
      and (p_zips is null or cardinality(p_zips) = 0 or zip = any(p_zips))
    order by (referral_code is not null) desc, created_at
    limit least(greatest(p_limit, 0), 500)
    for update skip locked
  loop
    c := 'SCR-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,4)) || '-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,3));
    insert into invites(code, inviter_id, kind, expires_at) values (c, null, 'drop', now() + interval '14 days');
    update waitlist set status = 'invited', invite_code = c where id = w.id;
    out := out || jsonb_build_array(jsonb_build_object('code', c, 'email', w.email, 'first_name', nullif(w.first_name, ''), 'days', 14));
    n := n + 1;
  end loop;
  insert into audit_log(staff_email, action, reason)
    values (who, 'invite_batch', n || ' invites · ' || coalesce(nullif(p_area, ''), 'any area') || coalesce(' · ' || array_to_string(p_zips, ','), ''));
  return out;
end $$;


-- Single invite from a waitlist row (replaces the 0004 version so the code is saved on the row).
create or replace function public.staff_invite_waitlist(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare who text := staff_email(); w waitlist; c text;
begin
  if who is null then raise exception 'staff only'; end if;
  select * into w from waitlist where id = p_id;
  if w.id is null then raise exception 'not found'; end if;
  c := 'SCR-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,4)) || '-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,3));
  insert into invites(code, inviter_id, kind, expires_at) values (c, null, 'drop', now() + interval '14 days');
  update waitlist set status = 'invited', invite_code = c where id = p_id;
  insert into audit_log(staff_email, action, reason) values (who, 'invite_waitlist', w.email);
  return jsonb_build_object('code', c, 'email', w.email, 'first_name', nullif(w.first_name, ''), 'days', 14);
end $$;

revoke execute on function public.staff_waitlist_summary() from public, anon;
revoke execute on function public.staff_set_area(text, text, int) from public, anon;
revoke execute on function public.staff_set_prefix(text, text) from public, anon;
revoke execute on function public.staff_invite_batch(text, text[], int) from public, anon;
grant execute on function public.staff_waitlist_summary() to authenticated;
grant execute on function public.staff_set_area(text, text, int) to authenticated;
grant execute on function public.staff_set_prefix(text, text) to authenticated;
grant execute on function public.staff_invite_batch(text, text[], int) to authenticated;
