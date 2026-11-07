-- CARTO maps integration (admin → Integrations).
alter table public.integrations drop constraint if exists integrations_provider_check;
alter table public.integrations add constraint integrations_provider_check
  check (provider in ('persona','aws','revenuecat','apple','google','credit','email','spotify','carto'));
insert into public.integrations(provider, config) values ('carto', '{"style":"dark_all"}') on conflict (provider) do nothing;
