-- 0078: Ready for traffic spikes.
--  1. Daily Drops are built ahead of time by the midnight job (in small batches), so opening the app is a quick read
--     instead of everyone triggering the matching work at once.
--  2. Email outbox: if Resend is busy during a surge, the email is saved here and the 30-minute job sends it later.
-- Safe to re-run.

-- ---------- 1. Pre-built Daily Drops ----------
create table if not exists public.drop_builds (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null default current_date,
  added int not null default 0,
  built_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.drop_builds enable row level security;
create policy drop_builds_staff on public.drop_builds for select using (public.is_staff());

-- Builds today's Drop for members who don't have one yet, for up to ~2 seconds per call (stays under the API time limit).
-- The cron calls it repeatedly. Returns how many members it processed this call (0 = done for today).
create or replace function public.cron_build_drops(p_secret text, p_max int default 200) returns int
language plpgsql security definer set search_path = public as $$
declare me profiles; n int := 0; added int; t0 timestamptz := clock_timestamp();
begin
  perform check_server_secret(p_secret);
  for me in
    select p.* from profiles p
    where p.status in ('active','preview') and p.band is not null and p.id_status = 'approved'
      and not exists (select 1 from staff s join auth.users u on lower(u.email) = lower(s.email) where u.id = p.id)
      and not exists (select 1 from drop_builds b where b.user_id = p.id and b.day = current_date)
      and not exists (select 1 from drops d where d.user_id = p.id and d.drop_date = current_date)
    order by p.last_active_at desc nulls last
    limit p_max
  loop
    added := fill_drop(me, case when me.plan in ('premium','black') then 10 else 5 end);
    insert into drop_builds(user_id, day, added) values (me.id, current_date, added) on conflict do nothing;
    n := n + 1;
    exit when clock_timestamp() - t0 > interval '2 seconds';
  end loop;
  delete from drop_builds where day < current_date - 7;
  return n;
end $$;
revoke all on function public.cron_build_drops(text, int) from public, authenticated;
grant execute on function public.cron_build_drops(text, int) to anon;

-- ---------- 2. Email outbox ----------
create table if not exists public.email_outbox (
  id bigint generated always as identity primary key,
  to_email text not null,
  template text not null,
  data jsonb not null default '{}'::jsonb,
  attempts int not null default 0,
  last_error text,
  next_try_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists email_outbox_due on public.email_outbox(next_try_at);
alter table public.email_outbox enable row level security;
create policy email_outbox_staff on public.email_outbox for select using (public.is_staff());

create or replace function public.queue_email(p_secret text, p_to text, p_template text, p_data jsonb, p_error text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform check_server_secret(p_secret);
  insert into email_outbox(to_email, template, data, last_error, next_try_at) values (lower(p_to), p_template, coalesce(p_data, '{}'::jsonb), left(p_error, 300), now() + interval '2 minutes');
end $$;
revoke all on function public.queue_email(text, text, text, jsonb, text) from public, authenticated;
grant execute on function public.queue_email(text, text, text, jsonb, text) to anon;

-- Hands the cron a batch of due emails and pushes their next try out, so overlapping runs never double-send.
create or replace function public.claim_email_outbox(p_secret text, p_limit int default 50)
returns table(id bigint, to_email text, template text, data jsonb, attempts int)
language plpgsql security definer set search_path = public as $$
begin
  perform check_server_secret(p_secret);
  return query
  update email_outbox o set attempts = o.attempts + 1, next_try_at = now() + make_interval(mins => least(240, 5 * power(2, o.attempts)::int))
  where o.id in (select x.id from email_outbox x where x.next_try_at <= now() and x.attempts < 8 order by x.id limit p_limit for update skip locked)
  returning o.id, o.to_email, o.template, o.data, o.attempts;
end $$;
revoke all on function public.claim_email_outbox(text, int) from public, authenticated;
grant execute on function public.claim_email_outbox(text, int) to anon;

create or replace function public.finish_email_outbox(p_secret text, p_id bigint, p_ok boolean, p_error text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform check_server_secret(p_secret);
  if p_ok then delete from email_outbox where id = p_id;
  else update email_outbox set last_error = left(p_error, 300) where id = p_id; end if;
  delete from email_outbox where attempts >= 8 and created_at < now() - interval '3 days';
end $$;
revoke all on function public.finish_email_outbox(text, bigint, boolean, text) from public, authenticated;
grant execute on function public.finish_email_outbox(text, bigint, boolean, text) to anon;
