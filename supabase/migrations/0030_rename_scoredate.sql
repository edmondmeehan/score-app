-- 0030: Rename the product from "Score" to "ScoreDate" in database text members see
-- (notification titles and bodies, error messages, maintenance message, saved footer text).
-- Safe to run more than once: "ScoreDate" never matches the pattern again.

do $$
declare f record; def text; fixed text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.prosrc ~ '\mScore\M'
  loop
    def := pg_get_functiondef(f.oid);
    fixed := regexp_replace(def, '\mScore\M', 'ScoreDate', 'g');
    if fixed <> def then execute fixed; end if;
  end loop;
end $$;

-- Saved settings (footer text, maintenance message, etc.).
update public.app_config
   set value = regexp_replace(value::text, '\mScore\M', 'ScoreDate', 'g')::jsonb
 where value::text ~ '\mScore\M';

notify pgrst, 'reload schema';
