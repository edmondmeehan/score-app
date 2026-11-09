-- 0048: Policies (Terms, Privacy, Choices, Cookies, Community, Biometric) and the Partners page are editable in /admin/policies.
-- Saved text lives in app_config under 'doc:<slug>'. Every save keeps a version so it can be restored.

create table if not exists public.policy_versions (
  id bigserial primary key,
  slug text not null,
  value jsonb,                       -- null = reset to the built-in text
  staff_email text,
  created_at timestamptz not null default now()
);
create index if not exists policy_versions_slug_idx on public.policy_versions (slug, created_at desc);
alter table public.policy_versions enable row level security;
drop policy if exists policy_versions_staff on public.policy_versions;
create policy policy_versions_staff on public.policy_versions for select using (staff_role() is not null);

create or replace function public.staff_set_policy(p_slug text, p_doc jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(staff_role(), '') <> 'owner' then raise exception 'Only owners can edit policies'; end if;
  if p_slug not in ('terms','privacy','choices','cookies','community','biometric','partners') then raise exception 'Unknown page'; end if;
  if p_doc is not null and jsonb_typeof(p_doc) <> 'object' then raise exception 'Page must be an object'; end if;
  if p_doc is not null and length(p_doc::text) > 200000 then raise exception 'Page is too long'; end if;
  if p_doc is null then
    delete from app_config where key = 'doc:' || p_slug;
  else
    insert into app_config(key, value) values ('doc:' || p_slug, p_doc)
    on conflict (key) do update set value = excluded.value;
  end if;
  insert into policy_versions(slug, value, staff_email) values (p_slug, p_doc, staff_email());
  insert into audit_log(staff_email, action, reason)
  values (staff_email(), case when p_doc is null then 'policy_reset' else 'policy_update' end, p_slug);
end $$;

revoke all on function public.staff_set_policy(text, jsonb) from public, anon;
grant execute on function public.staff_set_policy(text, jsonb) to authenticated;
