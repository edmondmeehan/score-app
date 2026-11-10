-- 0064 Tighten who can call database functions (Supabase security advisor).
-- 1) Pin the search path on the 13 helper functions that didn't have one.
-- 2) Signed-out visitors (the "anon" role) can no longer call member-only or staff-only functions.
--    They keep only what public pages and the server need: the waitlist, zip lookups, the public map, the
--    investor room, shared date plans, giveaway entry from the web, partner links, error/usage logging, and
--    server jobs that require the server secret. Signed-in members keep the access they had.
-- 3) Fix: the monthly band reminder job must be callable by the server (it checks the server secret).
-- Run after 0063. Safe to run again.

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.proconfig is null
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;

do $$
declare
  f record;
  keep text[] := array[
    -- public pages
    'zip_area','zip_lookup','zip_preview','public_demand_map','public_area_heat','join_waitlist','waitlist_status',
    'investor_login','investor_logout','investor_room','investor_salt','view_date_share','enter_giveaway_web',
    'partner_click','live_ping','submit_contact','approved_stories','featured_spots_live','credit_mode','demo_on',
    'reserve_visible','nyc_borough',
    -- used inside row-level security rules
    'blocked_between','staff_role','my_status','is_staff'
  ];
begin
  for f in
    select p.oid, p.oid::regprocedure as sig, p.proname,
           has_function_privilege('authenticated', p.oid, 'execute') as auth_ok,
           exists (select 1 from unnest(coalesce(p.proargnames, '{}')) a where a in ('p_secret', 'p_server_secret')) as has_secret
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    continue when f.has_secret or f.proname = any(keep);
    if f.auth_ok then execute format('grant execute on function %s to authenticated', f.sig); end if;
    execute format('grant execute on function %s to service_role', f.sig);
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $$;

grant execute on function public.queue_band_refresh(text) to anon, authenticated;
