-- 0011: Fix "function gen_random_bytes(integer) does not exist" (invites, date-share links).
-- Self-contained: builds random bytes from Postgres's built-in gen_random_uuid(), so it works
-- no matter which schema pgcrypto is installed in (or if it isn't installed at all).
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'gen_random_bytes'
  ) then
    execute $f$
      create function public.gen_random_bytes(n integer) returns bytea
      language sql volatile set search_path = pg_catalog
      as $b$
        select decode(substr(string_agg(replace(gen_random_uuid()::text, '-', ''), ''), 1, n * 2), 'hex')
        from generate_series(1, greatest(1, ceil(n / 16.0)::int))
      $b$
    $f$;
  end if;
end $$;
grant execute on function public.gen_random_bytes(integer) to anon, authenticated, service_role;

-- Quick check: should return a code like SCR-1A2B-3C4
select 'SCR-' || upper(substr(encode(public.gen_random_bytes(4),'hex'),1,4)) || '-' || upper(substr(encode(public.gen_random_bytes(4),'hex'),1,3)) as test_code;
