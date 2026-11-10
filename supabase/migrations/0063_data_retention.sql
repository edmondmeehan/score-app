-- 0063 Data retention: keep less, for less time.
-- Runs from the daily job (cron_retention). Nothing here touches active members' profiles, chats or photos.
--  * Deletion requests that were held for an open report finish once no report is open.
--  * The email kept on a finished deletion request is erased after 30 days.
--  * Old notifications (180 days), error logs (90 days) and app-usage sessions (13 months) are removed.
--  * Files left in storage by deleted accounts or deleted chats are listed so the server can remove them.
-- Run after 0062.

create or replace function public.cron_retention(p_secret text) returns jsonb
language plpgsql security definer set search_path = public, private, storage as $$
declare r record; finished int := 0; scrubbed int := 0; notif int := 0; errs int := 0; sess int := 0; files jsonb;
begin
  perform check_server_secret(p_secret);

  -- Held deletions: the member asked to leave; once no report about them is open, complete it.
  for r in
    select d.user_id from deletion_requests d
    where d.status = 'open' and d.hold_reason is not null
      and not exists (select 1 from reports x where x.reported_id = d.user_id and x.status = 'open')
  loop
    delete from auth.users where id = r.user_id;
    update deletion_requests set status = 'done', hold_reason = null where user_id = r.user_id;
    finished := finished + 1;
  end loop;

  update deletion_requests set email = null where status = 'done' and email is not null and requested_at < now() - interval '30 days';
  get diagnostics scrubbed = row_count;

  delete from notifications where created_at < now() - interval '180 days';
  get diagnostics notif = row_count;
  if to_regclass('public.app_errors') is not null then
    execute 'delete from public.app_errors where created_at < now() - interval ''90 days''';
    get diagnostics errs = row_count;
  end if;
  if to_regclass('public.member_sessions') is not null then
    execute 'delete from public.member_sessions where started_at < now() - interval ''13 months''';
    get diagnostics sess = row_count;
  end if;

  -- Orphaned files (owner gone), a day old or more so nothing mid-upload is caught. The server deletes them.
  select coalesce(jsonb_agg(jsonb_build_object('bucket', o.bucket_id, 'name', o.name)), '[]'::jsonb) into files
  from (
    select o.bucket_id, o.name from storage.objects o
    where o.bucket_id in ('photos', 'videos', 'voices')
      and o.created_at < now() - interval '1 day'
      and (storage.foldername(o.name))[1] ~ '^[0-9a-f-]{36}$'
      and not exists (select 1 from profiles p where p.id::text = (storage.foldername(o.name))[1])
    union all
    select o.bucket_id, o.name from storage.objects o
    where o.bucket_id = 'chat'
      and o.created_at < now() - interval '1 day'
      and (storage.foldername(o.name))[1] ~ '^[0-9a-f-]{36}$'
      and (not exists (select 1 from conversations c where c.id::text = (storage.foldername(o.name))[1])
           or ((storage.foldername(o.name))[2] ~ '^[0-9a-f-]{36}$' and not exists (select 1 from profiles p where p.id::text = (storage.foldername(o.name))[2])))
    limit 1000
  ) o;

  return jsonb_build_object('held_deletions_finished', finished, 'emails_erased', scrubbed, 'old_notifications', notif,
    'old_errors', errs, 'old_sessions', sess, 'orphan_files', files);
end $$;
revoke execute on function public.cron_retention(text) from public;
grant execute on function public.cron_retention(text) to anon, authenticated;
