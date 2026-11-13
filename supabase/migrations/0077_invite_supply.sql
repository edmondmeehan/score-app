-- 0077: Invite supply. Keeps ScoreDate hard to get into while letting the team hand out invites on purpose.
--  • profiles.invite_bonus: extra invites the team granted on top of the plan allowance (3 for members, 5 for founders).
--  • staff_invite_stats(): totals for Admin → Waitlist & invites (codes out, redeemed, invites left across members, average).
--  • staff_grant_invites(): owners give N invites to one member, all members, founders only, or one plan.
--  • Invite drip: optionally give every paying member +N invites every X days, never above a cap. Off by default.
-- Safe to re-run.

alter table public.profiles add column if not exists invite_bonus int not null default 0;

insert into public.app_config(key, value) values ('invite_drip', '{"enabled": false, "amount": 1, "every_days": 30, "cap": 3, "last_run": null}'::jsonb)
on conflict (key) do nothing;

-- Invites a member can still send (plan allowance + team grants − codes already created).
create or replace function public.invites_left(p profiles) returns int
language sql stable security definer set search_path = public as $$
  select greatest(0,
    coalesce((select (value #>> '{}')::int from app_config where key = case when p.is_founder then 'invites_per_founder' else 'invites_per_member' end), 3)
    + coalesce(p.invite_bonus, 0)
    - (select count(*)::int from invites where inviter_id = p.id));
$$;
revoke all on function public.invites_left(profiles) from public, anon, authenticated;

create or replace function public.create_invite(p_kind text default 'date') returns text
language plpgsql security definer set search_path = public as $$
declare me profiles; new_code text;
begin
  select * into me from profiles where id = auth.uid();
  if me.plan not in ('membership','premium','black') then raise exception 'members only'; end if;
  if invites_left(me) < 1 then raise exception 'no invites left'; end if;
  new_code := 'SCR-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,4)) || '-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,3));
  insert into invites(code, inviter_id, kind, expires_at)
    values (new_code, me.id, case when p_kind = 'friend' then 'friend' else 'date' end,
            now() + make_interval(days => (select (value::text)::int from app_config where key='invite_days_valid')));
  return new_code;
end $$;

-- Members' own count (used by the Invites page so the number matches what create_invite allows).
create or replace function public.my_invites_left() returns int
language sql stable security definer set search_path = public as $$
  select invites_left(p) from profiles p where p.id = auth.uid();
$$;
grant execute on function public.my_invites_left() to authenticated;

create or replace function public.staff_invite_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  if not is_staff() then raise exception 'staff only'; end if;
  with m as (
    select p.id, p.first_name, p.is_founder, p.plan, invites_left(p) lft
    from profiles p
    where p.plan in ('membership','premium','black') and p.status in ('active','preview')
      and coalesce(p.email, '') not ilike '%@seed.scoredate.test'
  ), inv as (
    select i.*, (i.redeemed_by is null and i.expires_at > now()) is_out, (i.redeemed_by is null and i.expires_at <= now()) is_expired
    from invites i where i.inviter_id is not null
  )
  select jsonb_build_object(
    'members', (select count(*) from m),
    'left_total', (select coalesce(sum(lft), 0) from m),
    'left_avg', (select coalesce(round(avg(lft)::numeric, 1), 0) from m),
    'members_none_left', (select count(*) from m where lft = 0),
    'sent', (select count(*) from inv),
    'out', (select count(*) from inv where is_out),
    'redeemed', (select count(*) from inv where redeemed_by is not null),
    'expired', (select count(*) from inv where is_expired),
    'granted_total', (select coalesce(sum(invite_bonus), 0) from profiles),
    'per_member', (select (value #>> '{}')::int from app_config where key = 'invites_per_member'),
    'per_founder', (select (value #>> '{}')::int from app_config where key = 'invites_per_founder'),
    'drip', (select value from app_config where key = 'invite_drip'),
    'top', (select coalesce(jsonb_agg(t order by t.redeemed desc, t.sent desc), '[]'::jsonb) from (
        select p.id, p.first_name, count(i.*) sent, count(i.redeemed_by) redeemed, invites_left(p) lft
        from invites i join profiles p on p.id = i.inviter_id group by p.id order by count(i.redeemed_by) desc, count(i.*) desc limit 8) t)
  ) into res;
  return res;
end $$;
grant execute on function public.staff_invite_stats() to authenticated;

-- Owners: give invites. p_who = 'one' (p_user), 'all', 'founders', or a plan name ('membership','premium','black').
-- p_cap (optional) stops anyone going above that many invites left.
create or replace function public.staff_grant_invites(p_who text, p_amount int, p_user uuid default null, p_cap int default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if staff_role() is distinct from 'owner' then raise exception 'owner only'; end if;
  if p_amount < 1 or p_amount > 20 then raise exception 'Give between 1 and 20 invites at a time'; end if;
  update profiles p set invite_bonus = coalesce(invite_bonus, 0)
      + case when p_cap is null then p_amount else least(p_amount, greatest(0, p_cap - invites_left(p))) end
  where case
      when p_who = 'one' then p.id = p_user
      when p_who = 'founders' then p.is_founder and p.plan in ('membership','premium','black') and p.status in ('active','preview')
      when p_who = 'all' then p.plan in ('membership','premium','black') and p.status in ('active','preview')
      else p.plan = p_who and p.status in ('active','preview') end
    and (p_cap is null or invites_left(p) < p_cap);
  get diagnostics n = row_count;
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'grant_invites', format('who=%s amount=%s cap=%s user=%s members=%s', p_who, p_amount, p_cap, p_user, n));
  return n;
end $$;
revoke all on function public.staff_grant_invites(text, int, uuid, int) from public, anon;
grant execute on function public.staff_grant_invites(text, int, uuid, int) to authenticated;

create or replace function public.staff_set_invite_drip(p_enabled boolean, p_amount int, p_every_days int, p_cap int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if staff_role() is distinct from 'owner' then raise exception 'owner only'; end if;
  if p_amount < 1 or p_amount > 10 then raise exception 'Amount must be 1 to 10'; end if;
  if p_every_days < 7 or p_every_days > 365 then raise exception 'Every 7 to 365 days'; end if;
  if p_cap < 1 or p_cap > 20 then raise exception 'Cap must be 1 to 20'; end if;
  insert into app_config(key, value) values ('invite_drip', jsonb_build_object('enabled', p_enabled, 'amount', p_amount, 'every_days', p_every_days, 'cap', p_cap, 'last_run', null))
  on conflict (key) do update set value = excluded.value || jsonb_build_object('last_run', app_config.value->'last_run');
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'invite_drip', format('enabled=%s amount=%s every=%s cap=%s', p_enabled, p_amount, p_every_days, p_cap));
end $$;
revoke all on function public.staff_set_invite_drip(boolean, int, int, int) from public, anon;
grant execute on function public.staff_set_invite_drip(boolean, int, int, int) to authenticated;

-- Daily cron: hand out the drip when it's due. Returns how many members got invites.
create or replace function public.run_invite_drip(p_secret text) returns int
language plpgsql security definer set search_path = public as $$
declare cfg jsonb; n int := 0;
begin
  perform check_server_secret(p_secret);
  select value into cfg from app_config where key = 'invite_drip';
  if cfg is null or not coalesce((cfg->>'enabled')::boolean, false) then return 0; end if;
  if cfg->>'last_run' is not null and (cfg->>'last_run')::timestamptz > now() - make_interval(days => (cfg->>'every_days')::int) then return 0; end if;
  update profiles p set invite_bonus = coalesce(invite_bonus, 0) + least((cfg->>'amount')::int, greatest(0, (cfg->>'cap')::int - invites_left(p)))
  where p.plan in ('membership','premium','black') and p.status in ('active','preview') and invites_left(p) < (cfg->>'cap')::int;
  get diagnostics n = row_count;
  update app_config set value = value || jsonb_build_object('last_run', now()) where key = 'invite_drip';
  return n;
end $$;
revoke all on function public.run_invite_drip(text) from public, authenticated;
grant execute on function public.run_invite_drip(text) to anon;
