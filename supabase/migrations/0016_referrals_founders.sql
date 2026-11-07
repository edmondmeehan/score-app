-- Waitlist referrals ("move up the list") and Founding Members. Safe to run more than once. Run after 0015.
--
-- How it works
--   • Everyone who joins the waitlist gets a personal share code (scoredate.app/?ref=CODE).
--   • Each person who joins with your code moves you up 5 spots (counted up to 50 referrals).
--   • Founding Member: the first 100 people per neighborhood, or anyone who refers 3 people.
--     Founders get a badge on their profile, go first when invites go out, and get extra invites.
--   • Positions and counts only ever include real people (test accounts are ignored).

insert into public.app_config(key, value) values
  ('founder_spots_per_place', '100'),
  ('founder_referrals', '3'),
  ('referral_spots', '5')
on conflict (key) do nothing;

alter table public.waitlist add column if not exists share_code text;
alter table public.waitlist add column if not exists referred_by uuid references public.waitlist(id) on delete set null;
alter table public.waitlist add column if not exists referrals int not null default 0;
alter table public.waitlist add column if not exists founder boolean not null default false;
alter table public.waitlist add column if not exists founder_reason text check (founder_reason in ('early','referrals','staff'));
alter table public.waitlist add column if not exists link_sent_at timestamptz;
-- Private token for the "your spot" page (the share code is public, so it can't double as the key).
alter table public.waitlist add column if not exists status_token text;
update public.waitlist set status_token = substr(md5(random()::text || clock_timestamp()::text || id::text), 1, 20) where status_token is null;
alter table public.waitlist alter column status_token set default substr(md5(random()::text || clock_timestamp()::text), 1, 20);
create unique index if not exists waitlist_status_token on public.waitlist(status_token);
create unique index if not exists waitlist_share_code on public.waitlist(share_code);
create index if not exists waitlist_referred_by on public.waitlist(referred_by);

create or replace function public.cfg_int(p_key text, p_default int) returns int language sql stable as $$
  select coalesce((select (value #>> '{}')::int from public.app_config where key = p_key), p_default);
$$;

create or replace function public.new_share_code() returns text language plpgsql volatile set search_path = public as $$
declare c text;
begin
  loop
    -- no 0/O/1/I so codes are easy to read aloud
    c := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from waitlist where share_code = c);
  end loop;
  return c;
end $$;

-- Backfill codes for everyone already on the list.
update public.waitlist set share_code = public.new_share_code() where share_code is null;

create or replace function public.is_test_email(p text) returns boolean language sql immutable as $$
  select coalesce(p ilike '%@seed.scoredate.test', false);
$$;

-- Before insert: give a share code, link the referrer, and hand out early founding spots per neighborhood.
create or replace function public.trg_waitlist_referral() returns trigger
language plpgsql security definer set search_path = public as $$
declare ref_id uuid; pk text;
begin
  if new.share_code is null then new.share_code := new_share_code(); end if;
  if new.referred_by is null and nullif(trim(new.referral_code), '') is not null then
    select id into ref_id from waitlist where share_code = upper(trim(new.referral_code)) and lower(email) <> lower(new.email);
    new.referred_by := ref_id;
  end if;
  if not new.founder and not is_test_email(new.email) and new.zip is not null then
    pk := place_key_for(new.zip);
    if pk is not null and (select count(*) from waitlist w where w.founder_reason = 'early' and not is_test_email(w.email)
                           and place_key_for(w.zip) = pk) < cfg_int('founder_spots_per_place', 100) then
      new.founder := true; new.founder_reason := 'early';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists waitlist_referral on public.waitlist;
create trigger waitlist_referral before insert on public.waitlist for each row execute function public.trg_waitlist_referral();

-- After insert: credit the referrer (real sign-ups only) and promote them to founder at the threshold.
create or replace function public.trg_waitlist_credit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.referred_by is not null and not is_test_email(new.email) then
    update waitlist set referrals = referrals + 1,
      founder = founder or referrals + 1 >= cfg_int('founder_referrals', 3),
      founder_reason = case when founder then founder_reason when referrals + 1 >= cfg_int('founder_referrals', 3) then 'referrals' else founder_reason end
    where id = new.referred_by;
  end if;
  return new;
end $$;
drop trigger if exists waitlist_credit on public.waitlist;
create trigger waitlist_credit after insert on public.waitlist for each row execute function public.trg_waitlist_credit();

-- Effective line: start from join order, move up N spots per referral. Real people only.
create or replace view public.waitlist_line as
  with base as (
    select id, created_at, referrals, founder,
           row_number() over (order by created_at, id) as joined_rank
    from waitlist where status = 'waiting' and not is_test_email(email)),
  eff as (
    select id, founder, referrals, joined_rank,
           greatest(1, joined_rank - cfg_int('referral_spots', 5) * least(referrals, 50)) as score
    from base)
  select id, founder, referrals, joined_rank,
         row_number() over (order by score, joined_rank) as position,
         count(*) over () as total
  from eff;
revoke all on public.waitlist_line from anon, authenticated;

-- Public join: inserts, then returns the person's share code and place in line.
-- For an email that's already on the list we never reveal anything to the caller; the server emails the
-- person their own link instead (at most once an hour).
create or replace function public.join_waitlist(p_first text, p_last text, p_email text, p_zip text, p_job text, p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare w waitlist; existing waitlist; pos int; tot int;
begin
  select * into existing from waitlist where lower(email) = lower(trim(p_email));
  if existing.id is not null then
    if existing.link_sent_at is null or existing.link_sent_at < now() - interval '1 hour' then
      update waitlist set link_sent_at = now() where id = existing.id;
      return jsonb_build_object('status', 'exists', 'resend', true, 'share_code', existing.share_code, 'status_token', existing.status_token, 'first_name', nullif(existing.first_name, ''));
    end if;
    return jsonb_build_object('status', 'exists', 'resend', false);
  end if;

  insert into waitlist(first_name, last_name, email, zip, job, referral_code)
  values (coalesce(trim(p_first), ''), nullif(trim(p_last), ''), lower(trim(p_email)), trim(p_zip), nullif(trim(p_job), ''), nullif(upper(trim(p_ref)), ''))
  returning * into w;

  select position, total into pos, tot from waitlist_line where id = w.id;
  return jsonb_build_object('status', 'joined', 'share_code', w.share_code, 'status_token', w.status_token, 'position', pos, 'total', tot,
    'founder', w.founder, 'founder_reason', w.founder_reason, 'referred', w.referred_by is not null);
end $$;
grant execute on function public.join_waitlist(text, text, text, text, text, text) to anon, authenticated;

-- Public status page, looked up by the person's private status token.
drop function if exists public.waitlist_status(text);
create or replace function public.waitlist_status(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w waitlist; l record; pk text; place text; early_taken int; spots int := cfg_int('founder_spots_per_place', 100);
begin
  select * into w from waitlist where status_token = lower(trim(p_token));
  if w.id is null then return null; end if;
  select * into l from waitlist_line where id = w.id;
  pk := place_key_for(w.zip);
  select name into place from map_places where key = pk;
  select count(*) into early_taken from waitlist x where x.founder_reason = 'early' and not is_test_email(x.email) and place_key_for(x.zip) = pk;
  return jsonb_build_object(
    'first_name', nullif(w.first_name, ''), 'status', w.status, 'share_code', w.share_code,
    'position', l.position, 'total', l.total, 'referrals', w.referrals,
    'founder', w.founder, 'founder_reason', w.founder_reason,
    'referrals_needed', greatest(0, cfg_int('founder_referrals', 3) - w.referrals),
    'spots_per_referral', cfg_int('referral_spots', 5),
    'place', coalesce(place, 'New York'), 'founder_spots_left', greatest(0, spots - early_taken), 'founder_spots', spots);
end $$;
grant execute on function public.waitlist_status(text) to anon, authenticated;

-- Invites go to founders first, then down the effective line.
create or replace function public.staff_invite_batch(p_area text, p_zips text[], p_limit int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare who text := staff_email(); w waitlist; c text; out jsonb := '[]'; n int := 0;
begin
  if not is_staff() then raise exception 'staff only'; end if;
  for w in
    select wl.* from waitlist wl
    left join waitlist_line ln on ln.id = wl.id
    where wl.status = 'waiting'
      and (nullif(p_area, '') is null or wl.area = p_area)
      and (p_zips is null or cardinality(p_zips) = 0 or wl.zip = any(p_zips))
    order by wl.founder desc, ln.position nulls last, wl.created_at
    limit least(greatest(p_limit, 0), 500)
    for update of wl skip locked
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

-- Staff can grant or remove founder status by hand.
create or replace function public.staff_set_founder(p_waitlist uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  update waitlist set founder = p_on, founder_reason = case when p_on then coalesce(founder_reason, 'staff') else null end where id = p_waitlist;
  update profiles set is_founder = p_on where lower(email) = (select lower(email) from waitlist where id = p_waitlist);
  insert into audit_log(staff_email, action, reason) values (staff_email(), case when p_on then 'founder_on' else 'founder_off' end, p_waitlist::text);
end $$;
grant execute on function public.staff_set_founder(uuid, boolean) to authenticated;

-- Founders carry their badge into the app when they sign up with the same email.
create or replace function public.trg_profile_founder() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_founder and new.email is not null
     and exists (select 1 from waitlist where lower(email) = lower(new.email) and founder) then
    new.is_founder := true;
  end if;
  return new;
end $$;
drop trigger if exists profile_founder on public.profiles;
create trigger profile_founder before insert or update of email on public.profiles for each row execute function public.trg_profile_founder();

update public.profiles p set is_founder = true
where not p.is_founder and exists (select 1 from public.waitlist w where lower(w.email) = lower(p.email) and w.founder);

-- Backfill early founding spots for people already on the list (first N real sign-ups per neighborhood).
with ranked as (
  select id, row_number() over (partition by public.place_key_for(zip) order by created_at, id) rn
  from public.waitlist where not public.is_test_email(email) and zip is not null and not founder)
update public.waitlist w set founder = true, founder_reason = 'early'
from ranked r where r.id = w.id and r.rn <= public.cfg_int('founder_spots_per_place', 100)
  and (select count(*) from public.waitlist x where x.founder_reason = 'early' and not public.is_test_email(x.email)
       and public.place_key_for(x.zip) = public.place_key_for(w.zip)) < public.cfg_int('founder_spots_per_place', 100);
