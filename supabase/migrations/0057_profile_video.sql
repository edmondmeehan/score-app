-- 0057: A short video clip on your profile (up to 15 seconds, 50 MB).
-- Every clip is reviewed by staff before anyone else can see it (App Store guideline 1.2: user content is moderated).
alter table public.profiles add column if not exists video_path text;
alter table public.profiles add column if not exists video_seconds int;
alter table public.profiles add column if not exists video_status text not null default 'none' check (video_status in ('none','pending','approved','rejected'));
alter table public.profiles add column if not exists video_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 52428800, array['video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists videos_upload on storage.objects;
create policy videos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists videos_delete on storage.objects;
create policy videos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
-- Read: your own clip any time; other members' clips only once approved; staff always.
drop policy if exists videos_read on storage.objects;
create policy videos_read on storage.objects for select to authenticated
  using (bucket_id = 'videos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_staff()
    or (public.my_status() in ('active','preview','paused','taken')
        and exists (select 1 from public.profiles p where p.video_path = name and p.video_status = 'approved'))));

create or replace function public.set_video(p_path text, p_seconds int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_path is null or p_path = '' then
    update profiles set video_path = null, video_seconds = null, video_status = 'none', video_at = null where id = auth.uid();
    return;
  end if;
  if split_part(p_path, '/', 1) <> auth.uid()::text then raise exception 'bad path'; end if;
  update profiles set video_path = left(p_path, 200), video_seconds = greatest(1, least(15, coalesce(p_seconds, 15))),
    video_status = 'pending', video_at = now() where id = auth.uid();
end $$;
grant execute on function public.set_video(text, int) to authenticated;

create or replace function public.staff_review_video(p_user uuid, p_ok boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if staff_role() is null then raise exception 'Staff only'; end if;
  update profiles set video_status = case when p_ok then 'approved' else 'rejected' end where id = p_user and video_path is not null;
  perform notify(p_user, null, 'video_review', 'milestone',
    case when p_ok then 'Your video is live' else 'Your video wasn’t approved' end,
    case when p_ok then 'Members can now see your clip on your profile.' else coalesce(nullif(p_note, ''), 'Try a clip of just you, with your face visible and nothing explicit.') end,
    '/app/profile#video', 'video:' || p_user || ':' || extract(epoch from now())::bigint, false);
  insert into audit_log(staff_email, action, target_user, reason) values (staff_email(), case when p_ok then 'video_approve' else 'video_reject' end, p_user, p_note);
end $$;
revoke all on function public.staff_review_video(uuid, boolean, text) from public, anon;
grant execute on function public.staff_review_video(uuid, boolean, text) to authenticated;
