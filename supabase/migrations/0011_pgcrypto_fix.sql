-- 0011: Fix "function gen_random_bytes(integer) does not exist".
-- On Supabase, pgcrypto lives in the "extensions" schema, but Score's functions run with
-- search_path = public. This adds a public wrapper so invite codes and date-share links work.
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'gen_random_bytes'
  ) then
    execute $f$
      create function public.gen_random_bytes(n integer) returns bytea
      language sql volatile set search_path = extensions, public
      as 'select extensions.gen_random_bytes(n)'
    $f$;
    grant execute on function public.gen_random_bytes(integer) to anon, authenticated, service_role;
  end if;
end $$;
