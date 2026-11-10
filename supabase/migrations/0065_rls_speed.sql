-- 0065: database speed at scale. No change to who can see what.
-- 1) Row security rules: wrap auth.uid(), is_staff(), my_status() and staff_role() in (select ...) so Postgres works
--    them out once per query instead of once per row (Supabase advisor "auth_rls_initplan").
-- 2) Add an index for every foreign key that doesn't have one (advisor "unindexed_foreign_keys").
-- Safe to re-run.

do $$
declare
  r record;
  q text; c text; nq text; nc text;
  fn text;
  fns text[] := array['auth.uid', 'auth.role', 'auth.jwt', 'is_staff', 'my_status', 'staff_role'];
begin
  perform set_config('search_path', 'public, extensions', true);
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and (coalesce(qual, '') || coalesce(with_check, '')) ~ '(auth\.(uid|role|jwt)|is_staff|my_status|staff_role)\(\)'
  loop
    nq := r.qual; nc := r.with_check;
    foreach fn in array fns loop
      -- undo an earlier wrap (Postgres prints it as "( SELECT fn() AS name)"), then wrap every call once
      nq := regexp_replace(nq, '\( SELECT ' || replace(fn, '.', '\.') || '\(\) AS [a-z_]+\)', fn || '()', 'g');
      nc := regexp_replace(nc, '\( SELECT ' || replace(fn, '.', '\.') || '\(\) AS [a-z_]+\)', fn || '()', 'g');
      nq := regexp_replace(nq, '(^|[^a-z_.])' || replace(fn, '.', '\.') || '\(\)', '\1(select ' || fn || '())', 'g');
      nc := regexp_replace(nc, '(^|[^a-z_.])' || replace(fn, '.', '\.') || '\(\)', '\1(select ' || fn || '())', 'g');
    end loop;
    if nq is distinct from r.qual or nc is distinct from r.with_check then
      begin
        execute format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename)
          || case when nq is not null then format(' using (%s)', nq) else '' end
          || case when nc is not null then format(' with check (%s)', nc) else '' end;
      exception when insufficient_privilege then
        raise notice 'skipped %.% (not owner)', r.tablename, r.policyname;
      end;
    end if;
  end loop;
end $$;

do $$
declare r record; cols text; name text;
begin
  for r in
    select con.conrelid::regclass as tbl, cl.relname, con.conname, con.conkey
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where con.contype = 'f' and n.nspname = 'public'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = con.conrelid
          and (i.indkey::int2[])[0:array_length(con.conkey, 1) - 1] = con.conkey
      )
  loop
    select string_agg(quote_ident(a.attname), ', ' order by k.ord), string_agg(a.attname, '_' order by k.ord)
      into cols, name
    from unnest(r.conkey) with ordinality k(attnum, ord)
    join pg_attribute a on a.attrelid = r.tbl and a.attnum = k.attnum;
    execute format('create index if not exists %I on %s (%s)', left('fk_' || r.relname || '_' || name, 63), r.tbl, cols);
  end loop;
end $$;
