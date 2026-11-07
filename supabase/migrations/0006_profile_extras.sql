-- Profile extras: a song (Spotify), an Instagram handle with privacy, photo management hardening,
-- and Spotify as an integration. Run after 0005.

-- ---------- Song ----------
alter table public.profiles add column if not exists song_id text check (song_id ~ '^[A-Za-z0-9]{22}$');
alter table public.profiles add column if not exists song_title text check (length(song_title) <= 200);
alter table public.profiles add column if not exists song_artist text check (length(song_artist) <= 200);
alter table public.profiles add column if not exists song_image text check (song_image ~ '^https://(i\.scdn\.co|image-cdn-[a-z0-9-]+\.spotifycdn\.com)/');
grant update (song_id, song_title, song_artist, song_image) on public.profiles to authenticated;

-- ---------- Instagram (separate table so the handle can be private) ----------
create table if not exists public.profile_socials (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  instagram text check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  instagram_public boolean not null default false,  -- false: only people you're in a conversation with
  updated_at timestamptz not null default now()
);
alter table public.profile_socials enable row level security;
drop policy if exists socials_own on public.profile_socials;
create policy socials_own on public.profile_socials for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Runs as owner so it can see blocks made by either person (the blocks table is private to the blocker).
create or replace function public.blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;
grant execute on function public.blocked_between(uuid, uuid) to authenticated;

drop policy if exists socials_read on public.profile_socials;
create policy socials_read on public.profile_socials for select to authenticated using (
  (instagram_public
   or exists (select 1 from public.conversations c
              where (c.user_a = auth.uid() and c.user_b = profile_socials.user_id)
                 or (c.user_b = auth.uid() and c.user_a = profile_socials.user_id)))
  and not public.blocked_between(profile_socials.user_id, auth.uid())
);
drop policy if exists socials_staff on public.profile_socials;
create policy socials_staff on public.profile_socials for select using (public.is_staff());
grant select, insert, update, delete on public.profile_socials to authenticated;

-- ---------- Photos ----------
-- New photos always start as pending: only the face-match server call or staff can approve them.
create or replace function public.photos_force_pending() returns trigger
language plpgsql as $$
begin
  new.match_status := 'pending';
  new.match_similarity := null;
  return new;
end $$;
drop trigger if exists photos_pending on public.photos;
create trigger photos_pending before insert on public.photos for each row execute function public.photos_force_pending();

-- Keep profiles.photo_status in step when a member removes a photo.
create or replace function public.photos_after_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles set photo_status = case
      when exists (select 1 from photos where user_id = old.user_id and match_status = 'approved') then 'approved'
      when exists (select 1 from photos where user_id = old.user_id and match_status = 'review') then 'review'
      when exists (select 1 from photos where user_id = old.user_id) then 'pending'
      else 'none' end
    where id = old.user_id;
  return old;
end $$;
drop trigger if exists photos_deleted on public.photos;
create trigger photos_deleted after delete on public.photos for each row execute function public.photos_after_delete();

-- ---------- Spotify integration ----------
alter table public.integrations drop constraint if exists integrations_provider_check;
alter table public.integrations add constraint integrations_provider_check
  check (provider in ('persona','aws','revenuecat','apple','google','credit','email','spotify'));
insert into public.integrations(provider, config) values ('spotify', '{}') on conflict (provider) do nothing;
