-- 0053: Message members. Staff pick an audience by location and interests, preview the count, and send an
-- in-app message (Activity), push and/or email. Members' notification settings, quiet hours and unsubscribes still
-- apply (claim_notifications), test accounts never get email, and nobody gets more than one of these every 3 days.
-- Religion and politics are deliberately not targetable.

create table if not exists public.member_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 2 and 80),
  body text not null check (length(body) between 2 and 200),
  url text not null default '/app' check (url ~ '^/'),
  channels text[] not null default '{inapp,push}',
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','scheduled','sending','sent','cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  audience_count int,
  sent_count int,
  skipped_cap int,
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.member_campaigns enable row level security;
drop policy if exists member_campaigns_staff on public.member_campaigns;
create policy member_campaigns_staff on public.member_campaigns for select using (staff_role() is not null);

-- Members matching a filter. Only active members (and Preview), never suspended/removed/onboarding.
create or replace function public.campaign_audience(f jsonb) returns table(id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  center jsonb; clat numeric; clng numeric; miles numeric := nullif(f->>'radius_miles', '')::numeric;
  yr int := extract(year from now())::int;
begin
  if nullif(f->>'center_zip', '') is not null and miles is not null then
    center := zip_lookup(f->>'center_zip');
    clat := (center->>'lat')::numeric; clng := (center->>'lng')::numeric;
  end if;
  return query
  select p.id from profiles p
  where p.status in ('active', 'preview')
    and (jsonb_array_length(coalesce(f->'boroughs', '[]')) = 0 or p.borough in (select jsonb_array_elements_text(f->'boroughs')))
    and (nullif(f->>'neighborhood', '') is null or p.neighborhood ilike '%' || (f->>'neighborhood') || '%')
    and (clat is null or exists (
          select 1 from (select zip_lookup(p.zip) z) g
          where (g.z->>'lat') is not null
            and 3959 * 2 * asin(sqrt(power(sin(radians(((g.z->>'lat')::numeric - clat) / 2)), 2)
                + cos(radians(clat)) * cos(radians((g.z->>'lat')::numeric)) * power(sin(radians(((g.z->>'lng')::numeric - clng) / 2)), 2))) <= miles))
    and (nullif(f->>'age_min', '') is null or p.birth_year <= yr - (f->>'age_min')::int)
    and (nullif(f->>'age_max', '') is null or p.birth_year >= yr - (f->>'age_max')::int)
    and (jsonb_array_length(coalesce(f->'genders', '[]')) = 0 or p.gender in (select jsonb_array_elements_text(f->'genders')))
    and (jsonb_array_length(coalesce(f->'plans', '[]')) = 0 or p.plan in (select jsonb_array_elements_text(f->'plans')))
    and (jsonb_array_length(coalesce(f->'bands', '[]')) = 0 or p.band in (select jsonb_array_elements_text(f->'bands')))
    and (jsonb_array_length(coalesce(f->'looking_for', '[]')) = 0 or p.looking_for in (select jsonb_array_elements_text(f->'looking_for')))
    and (jsonb_array_length(coalesce(f->'pets', '[]')) = 0 or p.pets in (select jsonb_array_elements_text(f->'pets')))
    and (jsonb_array_length(coalesce(f->'wants_kids', '[]')) = 0 or p.wants_kids in (select jsonb_array_elements_text(f->'wants_kids')))
    and (jsonb_array_length(coalesce(f->'money_values', '[]')) = 0 or p.money_values && array(select jsonb_array_elements_text(f->'money_values')))
    and (nullif(f->>'artist', '') is null or p.song_artist ilike '%' || (f->>'artist') || '%')
    and (nullif(f->>'spot', '') is null or exists (select 1 from jsonb_array_elements(coalesce(p.my_nyc, '[]')) s where s->>'name' ilike '%' || (f->>'spot') || '%'))
    and (nullif(f->>'interest', '') is null or p.prompts::text ilike '%' || (f->>'interest') || '%' or p.job ilike '%' || (f->>'interest') || '%'
         or coalesce(p.flag_splurge, '') ilike '%' || (f->>'interest') || '%')
    and (nullif(f->>'active_days', '') is null or p.last_active_at > now() - make_interval(days => (f->>'active_days')::int))
    and (nullif(f->>'inactive_days', '') is null or p.last_active_at is null or p.last_active_at < now() - make_interval(days => (f->>'inactive_days')::int))
    and (coalesce((f->>'founders')::boolean, false) = false or p.is_founder)
    and (coalesce((f->>'attended_event')::boolean, false) = false or exists (select 1 from member_scans m where m.user_id = p.id and m.event_id is not null))
    and (coalesce((f->>'include_test')::boolean, true) or not exists (select 1 from auth.users u where u.id = p.id and u.email ilike '%@seed.scoredate.test'));
end $$;
revoke all on function public.campaign_audience(jsonb) from public, anon, authenticated;

create or replace function public.staff_campaign_preview(f jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if staff_role() is null then raise exception 'Staff only'; end if;
  return jsonb_build_object(
    'count', (select count(*) from campaign_audience(f)),
    'capped', (select count(*) from campaign_audience(f) a where exists (select 1 from notifications n where n.user_id = a.id and n.kind = 'campaign' and n.created_at > now() - interval '3 days')),
    'sample', coalesce((select jsonb_agg(x) from (select p.first_name || coalesce(' · ' || p.neighborhood, '') x from campaign_audience(f) a join profiles p on p.id = a.id order by random() limit 8) s), '[]'::jsonb));
end $$;

create or replace function public.staff_save_member_campaign(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid := nullif(p->>'id', '')::uuid;
begin
  if coalesce(staff_role(), '') not in ('owner','community') then raise exception 'Only owners and community staff can message members'; end if;
  if cid is null then
    insert into member_campaigns(title, body, url, channels, filters, status, scheduled_at, created_by)
    values (p->>'title', p->>'body', coalesce(nullif(p->>'url', ''), '/app'), array(select jsonb_array_elements_text(p->'channels')), coalesce(p->'filters', '{}'),
            case when nullif(p->>'scheduled_at', '') is not null then 'scheduled' else 'draft' end, nullif(p->>'scheduled_at', '')::timestamptz, staff_email())
    returning id into cid;
  else
    update member_campaigns set title = p->>'title', body = p->>'body', url = coalesce(nullif(p->>'url', ''), '/app'),
      channels = array(select jsonb_array_elements_text(p->'channels')), filters = coalesce(p->'filters', '{}'),
      status = case when nullif(p->>'scheduled_at', '') is not null then 'scheduled' else 'draft' end, scheduled_at = nullif(p->>'scheduled_at', '')::timestamptz
    where id = cid and status in ('draft', 'scheduled');
  end if;
  return cid;
end $$;

-- Deliver one campaign. Writes notification rows directly so each channel can be on or off.
create or replace function public.deliver_member_campaign(p_id uuid, p_only uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare c member_campaigns; n int := 0; capped int := 0; total int := 0; r record;
begin
  select * into c from member_campaigns where id = p_id;
  if c.id is null then raise exception 'Not found'; end if;
  for r in select a.id from campaign_audience(c.filters) a where p_only is null union select p_only where p_only is not null loop
    total := total + 1;
    if p_only is null and exists (select 1 from notifications x where x.user_id = r.id and x.kind = 'campaign' and x.created_at > now() - interval '3 days') then
      capped := capped + 1; continue;
    end if;
    insert into notifications(user_id, kind, category, title, body, url, dedupe, push_state, email_state, read_at)
    values (r.id, 'campaign', 'nudge', left(c.title, 120), left(c.body, 200), c.url,
            'campaign:' || c.id || case when p_only is not null then ':test:' || extract(epoch from now())::bigint else '' end,
            case when 'push' = any(c.channels) then 'pending' else 'skipped' end,
            case when 'email' = any(c.channels) then 'pending' else 'skipped' end,
            case when 'inapp' = any(c.channels) then null else now() end)
    on conflict (user_id, dedupe) do nothing;
    if found then n := n + 1; end if;
  end loop;
  if p_only is null then
    update member_campaigns set status = 'sent', sent_at = now(), audience_count = total, sent_count = n, skipped_cap = capped where id = p_id;
  end if;
  return n;
end $$;
revoke all on function public.deliver_member_campaign(uuid, uuid) from public, anon, authenticated;

create or replace function public.staff_send_member_campaign(p_id uuid, p_test boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int; me uuid := auth.uid();
begin
  if coalesce(staff_role(), '') not in ('owner','community') then raise exception 'Only owners and community staff can message members'; end if;
  if p_test then
    n := deliver_member_campaign(p_id, me);
    return jsonb_build_object('sent', n, 'test', true);
  end if;
  if not exists (select 1 from member_campaigns where id = p_id and status in ('draft','scheduled')) then raise exception 'Already sent'; end if;
  update member_campaigns set status = 'sending' where id = p_id;
  n := deliver_member_campaign(p_id);
  insert into audit_log(staff_email, action, reason) values (staff_email(), 'member_campaign_send', (select title from member_campaigns where id = p_id) || ' · ' || n);
  return jsonb_build_object('sent', n);
end $$;

-- Cron: send scheduled campaigns whose time has come.
create or replace function public.cron_send_member_campaigns(p_secret text) returns int
language plpgsql security definer set search_path = public, private as $$
declare r record; n int := 0;
begin
  perform check_server_secret(p_secret);
  for r in select id from member_campaigns where status = 'scheduled' and scheduled_at <= now() order by scheduled_at limit 5 loop
    update member_campaigns set status = 'sending' where id = r.id;
    n := n + deliver_member_campaign(r.id);
  end loop;
  return n;
end $$;

revoke all on function public.staff_campaign_preview(jsonb), public.staff_save_member_campaign(jsonb), public.staff_send_member_campaign(uuid, boolean) from public, anon;
grant execute on function public.staff_campaign_preview(jsonb), public.staff_save_member_campaign(jsonb), public.staff_send_member_campaign(uuid, boolean) to authenticated;
grant execute on function public.cron_send_member_campaigns(text) to anon, authenticated;
