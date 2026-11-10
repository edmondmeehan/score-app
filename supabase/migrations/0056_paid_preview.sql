-- 0056: Preview is a paid ($9.99) App Store purchase. Choosing it for free only works in test mode;
-- otherwise it's applied by the App Store purchase (webhook / in-app sync).
create or replace function public.choose_plan(p_plan text) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if me.id_status <> 'approved' or me.band is null then raise exception 'finish verification first'; end if;
  if p_plan = 'preview' then
    if not test_mode() then raise exception 'Preview is bought in the ScoreDate app'; end if;
    update profiles set plan = 'preview', status = 'preview',
      preview_ends_at = now() + make_interval(days => (select (value::text)::int from app_config where key='preview_days'))
      where id = me.id;
  elsif p_plan in ('membership','premium','black') then
    if not test_mode() then raise exception 'Memberships are bought in the ScoreDate app'; end if;
    if p_plan = 'black' and me.plan <> 'black' and not reserve_visible() then raise exception 'Reserve isn''t available yet'; end if;
    update profiles set plan = p_plan, status = 'active' where id = me.id;
  elsif p_plan = 'paused' then
    update profiles set plan = 'paused', status = 'paused' where id = me.id;
  elsif p_plan = 'taken' then
    update profiles set plan = 'paused', status = 'taken' where id = me.id;
  else raise exception 'unknown plan'; end if;
end $$;
