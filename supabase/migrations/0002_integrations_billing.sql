-- Integrations (third-party keys) and in-app billing via RevenueCat.
-- Secrets are stored encrypted in Supabase Vault. The admin UI can set or clear them
-- but can never read them back; only the server (holding the server secret) can.

create extension if not exists supabase_vault with schema vault;

create or replace function public.staff_role() returns text
language sql stable security definer set search_path = public as $$
  select s.role from staff s join auth.users u on lower(u.email) = lower(s.email) where u.id = auth.uid();
$$;

create table public.integrations (
  provider text primary key check (provider in ('persona','aws','revenuecat','apple','google','credit','email')),
  enabled boolean not null default false,
  config jsonb not null default '{}',          -- non-secret settings (IDs, regions, product mappings)
  secret_hints jsonb not null default '{}',    -- e.g. {"api_key": "…a1b2", set_at}
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  updated_by text,
  updated_at timestamptz not null default now()
);
insert into public.integrations(provider, config) values
  ('persona',    '{"environment":"sandbox"}'),
  ('aws',        '{"region":"us-east-1","approve_threshold":92}'),
  ('revenuecat', '{"entitlements":{"black":"black","premium":"premium","membership":"membership","paused":"paused"}}'),
  ('apple',      '{"bundle_id":"","team_id":"","products":{"membership_monthly":"","membership_annual":"","premium_monthly":"","premium_annual":"","black_monthly":"","paused_monthly":"","preview_once":""}}'),
  ('google',     '{"package_name":"","products":{"membership_monthly":"","membership_annual":"","premium_monthly":"","premium_annual":"","black_monthly":"","paused_monthly":"","preview_once":""}}'),
  ('credit',     '{"vendor":""}'),
  ('email',      '{"from":"hello@score.app"}');

alter table public.integrations enable row level security;
create policy integ_staff_read on public.integrations for select using (public.is_staff());

-- Owner sets non-secret config.
create or replace function public.set_integration_config(p_provider text, p_config jsonb, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
declare who text := staff_email();
begin
  if staff_role() is distinct from 'owner' then raise exception 'owner only'; end if;
  update integrations set config = p_config, enabled = p_enabled, updated_by = who, updated_at = now() where provider = p_provider;
  insert into audit_log(staff_email, action, reason) values (who, 'integration_config', p_provider);
end $$;

-- Owner sets (or clears, with empty value) a secret. Value goes to Vault; only a hint is kept.
create or replace function public.set_integration_secret(p_provider text, p_name text, p_value text) returns void
language plpgsql security definer set search_path = public, vault as $$
declare who text := staff_email(); sname text := p_provider || '.' || p_name; sid uuid;
begin
  if staff_role() is distinct from 'owner' then raise exception 'owner only'; end if;
  if p_name !~ '^[a-z0-9_]{1,40}$' then raise exception 'bad name'; end if;
  select id into sid from vault.secrets where name = sname;
  if coalesce(p_value, '') = '' then
    if sid is not null then delete from vault.secrets where id = sid; end if;
    update integrations set secret_hints = secret_hints - p_name, updated_by = who, updated_at = now() where provider = p_provider;
    insert into audit_log(staff_email, action, reason) values (who, 'integration_secret_cleared', sname);
    return;
  end if;
  if sid is null then perform vault.create_secret(p_value, sname, 'Score integration secret');
  else perform vault.update_secret(sid, p_value, sname, 'Score integration secret'); end if;
  update integrations set
    secret_hints = secret_hints || jsonb_build_object(p_name, jsonb_build_object('hint', '…' || right(p_value, 4), 'set_at', now())),
    updated_by = who, updated_at = now()
    where provider = p_provider;
  insert into audit_log(staff_email, action, reason) values (who, 'integration_secret_set', sname);
end $$;

-- Server-only: read config + decrypted secrets for a provider. Requires the server secret.
create or replace function public.get_integration(p_server_secret text, p_provider text) returns jsonb
language plpgsql security definer set search_path = public, vault, private as $$
declare out jsonb;
begin
  if p_server_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'enabled', i.enabled,
    'config', i.config,
    'secrets', coalesce((select jsonb_object_agg(substr(d.name, length(p_provider) + 2), d.decrypted_secret)
                         from vault.decrypted_secrets d where d.name like p_provider || '.%'), '{}'::jsonb))
  into out from integrations i where i.provider = p_provider;
  return out;
end $$;

-- Server-only: record a connection test result.
create or replace function public.record_integration_test(p_server_secret text, p_provider text, p_ok boolean, p_message text) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if p_server_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  update integrations set last_test_at = now(), last_test_ok = p_ok, last_test_message = left(p_message, 300) where provider = p_provider;
end $$;

-- ---------- Billing (RevenueCat is the source of truth for App Store / Google Play purchases) ----------
create table public.billing_events (
  id text primary key,                    -- RevenueCat event id (idempotency)
  user_id uuid references public.profiles(id) on delete set null,
  type text not null,
  store text,
  product_id text,
  entitlement text,
  plan text,
  expires_at timestamptz,
  environment text,
  received_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;
create policy bill_staff on public.billing_events for select using (public.is_staff());
create policy bill_own on public.billing_events for select using (user_id = auth.uid());

alter table public.profiles add column if not exists plan_store text;
alter table public.profiles add column if not exists plan_expires_at timestamptz;

-- Server-only: apply a RevenueCat event. p_plan is the highest active entitlement, or 'none'.
create or replace function public.record_billing_event(
  p_server_secret text, p_event_id text, p_user uuid, p_type text, p_store text, p_product text,
  p_entitlement text, p_plan text, p_expires timestamptz, p_environment text) returns text
language plpgsql security definer set search_path = public, private as $$
declare me profiles;
begin
  if p_server_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  if exists (select 1 from billing_events where id = p_event_id) then return 'duplicate'; end if;
  insert into billing_events(id, user_id, type, store, product_id, entitlement, plan, expires_at, environment)
    values (p_event_id, p_user, p_type, p_store, p_product, p_entitlement, p_plan, p_expires, p_environment);
  select * into me from profiles where id = p_user;
  if me.id is null then return 'unknown user'; end if;
  if p_environment = 'SANDBOX' and not test_mode() then return 'sandbox ignored'; end if;
  if p_plan in ('membership','premium','black') then
    update profiles set plan = p_plan, status = case when status in ('paused','taken','preview','onboarding') then 'active' else status end,
      plan_store = p_store, plan_expires_at = p_expires where id = p_user;
  elsif p_plan = 'paused' then
    update profiles set plan = 'paused', status = case when status = 'taken' then 'taken' else 'paused' end,
      plan_store = p_store, plan_expires_at = p_expires where id = p_user;
  elsif p_plan = 'preview' then
    update profiles set plan = 'preview', status = 'preview',
      preview_ends_at = now() + make_interval(days => (select (value::text)::int from app_config where key='preview_days'))
      where id = p_user and plan in ('none','preview');
  elsif p_plan = 'none' then
    -- Entitlement ended (expired or refunded): back to no plan; profile hidden until they rejoin.
    update profiles set plan = 'none', status = case when status in ('suspended','removed') then status else 'onboarding' end,
      plan_store = p_store, plan_expires_at = p_expires where id = p_user;
  end if;
  return 'ok';
end $$;

revoke execute on function public.get_integration(text, text) from public, anon, authenticated;
revoke execute on function public.record_integration_test(text, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.record_billing_event(text, text, uuid, text, text, text, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.get_integration(text, text) to anon, authenticated;
grant execute on function public.record_integration_test(text, text, boolean, text) to anon, authenticated;
grant execute on function public.record_billing_event(text, text, uuid, text, text, text, text, text, timestamptz, text) to anon;
grant execute on function public.staff_role() to authenticated;
grant execute on function public.set_integration_config(text, jsonb, boolean) to authenticated;
grant execute on function public.set_integration_secret(text, text, text) to authenticated;
