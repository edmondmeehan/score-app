-- Privacy and plan hardening. Run after 0006.
--  1. Profile photos in storage: readable only by the owner, staff, or members allowed to see that person.
--  2. Other members' profiles: read through member_cards, which leaves out email, zip, plan and verification fields.
--  3. Preview: test mode only until store billing is live, and once per account.
--  4. Pause / Taken: only for people who are (or were paying as) members.

-- ---------- Who can see whom ----------
-- Same rule as the old prof_visible policy, plus yourself.
create or replace function public.can_see_member(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user = auth.uid()
      or (exists (select 1 from profiles where id = p_user and status in ('active','preview'))
          and public.my_status() in ('active','preview','paused','taken'));
$$;
revoke execute on function public.can_see_member(uuid) from public, anon;
grant execute on function public.can_see_member(uuid) to authenticated;

-- ---------- 1. Storage: photos ----------
create or replace function public.can_see_photo(p_path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from photos ph
                 where ph.path = p_path and ph.match_status = 'approved' and public.can_see_member(ph.user_id));
$$;
revoke execute on function public.can_see_photo(text) from public, anon;
grant execute on function public.can_see_photo(text) to authenticated;

drop policy if exists "photos read members" on storage.objects;
drop policy if exists "photos read allowed" on storage.objects;
create policy "photos read allowed" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_staff()
    or public.can_see_photo(name)));

-- ---------- 2. Member cards ----------
-- Members no longer read other people's rows in profiles directly (that exposed email, zip, plan and more).
drop policy if exists prof_visible on public.profiles;

create or replace view public.member_cards as
  select id, first_name, birth_year, gender, job, neighborhood, city, prompt_q, prompt_a, money_values,
         band, trend, credit_verified_at, invited_by, song_id, song_title, song_artist, song_image
  from public.profiles
  where public.can_see_member(id);
revoke all on public.member_cards from public, anon;
grant select on public.member_cards to authenticated;

-- ---------- 3 & 4. Plans ----------
create or replace function public.choose_plan(p_plan text) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if me.id_status <> 'approved' or me.band is null then raise exception 'finish verification first'; end if;
  if p_plan = 'preview' then
    if not test_mode() then raise exception 'payments not connected yet'; end if;
    if me.preview_ends_at is not null then raise exception 'You already used your Preview.'; end if;
    update profiles set plan = 'preview', status = 'preview',
      preview_ends_at = now() + make_interval(days => (select (value::text)::int from app_config where key='preview_days'))
      where id = me.id;
  elsif p_plan in ('membership','premium','black') then
    if not test_mode() then raise exception 'payments not connected yet'; end if;
    update profiles set plan = p_plan, status = 'active' where id = me.id;
  elsif p_plan in ('paused','taken') then
    if me.plan not in ('membership','premium','black','paused') then raise exception 'Only members can pause.'; end if;
    update profiles set plan = 'paused', status = case when p_plan = 'taken' then 'taken' else 'paused' end where id = me.id;
  else raise exception 'unknown plan'; end if;
end $$;
revoke execute on function public.choose_plan(text) from public, anon;
grant execute on function public.choose_plan(text) to authenticated;
