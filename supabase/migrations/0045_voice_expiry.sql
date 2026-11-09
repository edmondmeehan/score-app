-- 0045: Voice notes disappear 24 hours after they're first played (7 days if never played).
-- If either person reports the other, voice notes between them are held 30 days for the safety team.
-- Expired audio stops being readable right away; the cron job then deletes the files with the Storage API.

alter table public.messages add column if not exists audio_listened_at timestamptz;
alter table public.messages add column if not exists audio_expired boolean not null default false;
alter table public.messages add column if not exists audio_hold_until timestamptz;
create index if not exists messages_audio_live on public.messages(created_at) where audio_path is not null and not audio_expired;

-- Recipient finished playing it: start the 24-hour clock. The sender playing their own note doesn't count.
create or replace function public.mark_voice_listened(p_message uuid) returns void
language sql security definer set search_path = public as $$
  update messages m set audio_listened_at = now()
  from conversations c
  where m.id = p_message and c.id = m.conversation_id and auth.uid() in (c.user_a, c.user_b)
    and m.sender_id <> auth.uid() and m.audio_path is not null and m.audio_listened_at is null;
$$;
grant execute on function public.mark_voice_listened(uuid) to authenticated;

-- Reports hold voice notes between the two people for 30 days.
create or replace function public.trg_report_hold_voice() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update messages m set audio_hold_until = greatest(coalesce(m.audio_hold_until, now()), now() + interval '30 days')
  from conversations c
  where c.id = m.conversation_id and m.audio_path is not null and not m.audio_expired
    and ((c.user_a = new.reporter_id and c.user_b = new.reported_id) or (c.user_b = new.reporter_id and c.user_a = new.reported_id));
  return new;
exception when others then
  raise warning 'report hold: %', sqlerrm;
  return new;
end $$;
drop trigger if exists report_hold_voice on public.reports;
create trigger report_hold_voice after insert on public.reports for each row execute function public.trg_report_hold_voice();

-- Chat storage: an expired voice note can't be opened by members (staff still can until the file is deleted).
drop policy if exists chat_read on storage.objects;
create policy chat_read on storage.objects for select to authenticated using (
  bucket_id = 'chat' and (
    public.is_staff()
    or (exists (select 1 from public.conversations c where c.id::text = (storage.foldername(name))[1] and auth.uid() in (c.user_a, c.user_b))
        and not exists (select 1 from public.messages m where m.audio_path = name and m.audio_expired))));

-- Cron: mark what's due and hand back the file paths to delete.
create or replace function public.cron_expire_voice(p_secret text) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare paths jsonb;
begin
  perform check_server_secret(p_secret);
  with due as (
    update messages set audio_expired = true
    where audio_path is not null and not audio_expired
      and (audio_hold_until is null or audio_hold_until < now())
      and ((audio_listened_at is not null and audio_listened_at < now() - interval '24 hours')
           or created_at < now() - interval '7 days')
    returning audio_path)
  select coalesce(jsonb_agg(audio_path), '[]') into paths from due;
  return paths;
end $$;
revoke all on function public.cron_expire_voice(text) from public;
grant execute on function public.cron_expire_voice(text) to anon, authenticated;

notify pgrst, 'reload schema';
