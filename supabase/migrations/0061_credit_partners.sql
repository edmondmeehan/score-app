-- 0061 Credit score partners (Admin → Credit partners).
-- Free credit-score services shown on the "Share your credit band" step, each with an affiliate link.
-- Every tap goes through /go/<slug>, which records the click and sends the member on. Run after 0060.

create table if not exists public.credit_partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  tagline text,
  score_type text,
  url text not null check (url ~ '^https://'),
  badge text,
  sort int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.credit_partners enable row level security;
drop policy if exists cp_read on public.credit_partners;
create policy cp_read on public.credit_partners for select using (active or public.is_staff());
grant select on public.credit_partners to anon, authenticated;

create table if not exists public.partner_clicks (
  id bigserial primary key,
  partner_id uuid not null references public.credit_partners(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  placement text,
  created_at timestamptz not null default now()
);
create index if not exists partner_clicks_partner_at on public.partner_clicks(partner_id, created_at desc);
alter table public.partner_clicks enable row level security;
drop policy if exists pc_staff on public.partner_clicks;
create policy pc_staff on public.partner_clicks for select using (public.is_staff());

-- Record a click and return where to send the member (only for active partners).
create or replace function public.partner_click(p_slug text, p_placement text) returns text
language plpgsql security definer set search_path = public as $$
declare p credit_partners;
begin
  select * into p from credit_partners where slug = p_slug and active;
  if p.id is null then return null; end if;
  insert into partner_clicks(partner_id, user_id, placement) values (p.id, auth.uid(), left(nullif(p_placement, ''), 40));
  return p.url;
end $$;
grant execute on function public.partner_click(text, text) to anon, authenticated;

create or replace function public.staff_save_partner(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := nullif(p->>'id', '')::uuid;
begin
  if not is_staff() then raise exception 'staff only'; end if;
  if coalesce(p->>'url', '') !~ '^https://' then raise exception 'The link must start with https://' using errcode = 'P0001'; end if;
  if v is null then
    insert into credit_partners(slug, name, tagline, score_type, url, badge, sort, active)
    values (lower(p->>'slug'), p->>'name', nullif(p->>'tagline', ''), nullif(p->>'score_type', ''), p->>'url', nullif(p->>'badge', ''),
            coalesce(nullif(p->>'sort', '')::int, 100), coalesce((p->>'active')::boolean, true))
    returning id into v;
  else
    update credit_partners set slug = lower(p->>'slug'), name = p->>'name', tagline = nullif(p->>'tagline', ''), score_type = nullif(p->>'score_type', ''),
      url = p->>'url', badge = nullif(p->>'badge', ''), sort = coalesce(nullif(p->>'sort', '')::int, 100),
      active = coalesce((p->>'active')::boolean, true), updated_at = now()
    where id = v;
  end if;
  insert into audit_log(staff_email, action, target_user, reason) values ((select email from auth.users where id = auth.uid()), 'credit_partner_saved', null, p->>'name');
  return v;
end $$;
grant execute on function public.staff_save_partner(jsonb) to authenticated;

create or replace function public.staff_delete_partner(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  delete from credit_partners where id = p_id;
end $$;
grant execute on function public.staff_delete_partner(uuid) to authenticated;

-- Clicks per partner: all time, last 7 and 30 days, unique members, and by day for the last 30 days.
create or replace function public.staff_partner_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'staff only'; end if;
  return jsonb_build_object(
    'partners', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'total', (select count(*) from partner_clicks c where c.partner_id = p.id),
        'd7', (select count(*) from partner_clicks c where c.partner_id = p.id and c.created_at > now() - interval '7 days'),
        'd30', (select count(*) from partner_clicks c where c.partner_id = p.id and c.created_at > now() - interval '30 days'),
        'members', (select count(distinct c.user_id) from partner_clicks c where c.partner_id = p.id),
        'last', (select max(c.created_at) from partner_clicks c where c.partner_id = p.id))) from credit_partners p), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d::date, 'n', (select count(*) from partner_clicks c where c.created_at::date = d::date)) order by d)
        from generate_series(current_date - 29, current_date, interval '1 day') d), '[]'::jsonb));
end $$;
grant execute on function public.staff_partner_stats() to authenticated;

-- Starting list. Swap each link for your affiliate link in Admin → Credit partners.
insert into public.credit_partners(slug, name, tagline, score_type, url, badge, sort, active) values
 ('credit-karma', 'Credit Karma', 'Free scores from TransUnion and Equifax, updated weekly.', 'VantageScore 3.0', 'https://www.creditkarma.com/', 'Most popular', 10, true),
 ('credit-sesame', 'Credit Sesame', 'Free score and credit monitoring.', 'VantageScore 3.0', 'https://www.creditsesame.com/', null, 20, true),
 ('experian', 'Experian', 'Free FICO Score straight from Experian.', 'FICO Score 8', 'https://www.experian.com/consumer-products/free-credit-report.html', 'FICO score', 30, false),
 ('creditwise', 'Capital One CreditWise', 'Free for everyone, no Capital One card needed.', 'VantageScore 3.0', 'https://www.capitalone.com/creditwise/', null, 40, false),
 ('discover-scorecard', 'Discover Credit Scorecard', 'Free FICO Score for everyone, no Discover card needed.', 'FICO Score 8', 'https://www.discover.com/free-credit-score/', 'FICO score', 50, false)
on conflict (slug) do nothing;
