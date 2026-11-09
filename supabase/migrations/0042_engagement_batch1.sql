-- 0042: Engagement batch 1.
--  * queue_drop_ready: right after the Daily Drop flips (00:00 UTC = 7pm ET winter / 8pm summer), build tonight's Drop for
--    recently active members and send one "ready" alert — only if there's actually someone new, and not if they're already in the app.
--  * kind_close: send one of three preset kind goodbyes, then end the chat. Presets live here so the text can't be swapped.

create or replace function public.queue_drop_ready(p_secret text) returns int
language plpgsql security definer set search_path = public, private as $$
declare r profiles; added int; total int; cnt int := 0;
begin
  perform check_server_secret(p_secret);
  -- Only in the first hour after the flip; the dedupe key keeps it to one alert a day.
  if extract(hour from now() at time zone 'utc') <> 0 then return 0; end if;
  for r in
    select p.* from profiles p
    where p.status = 'active' and p.plan in ('membership','premium','black')
      and p.band is not null and p.id_status = 'approved'
      -- Recently active only: no nightly pings to people who've drifted away.
      and coalesce(p.last_active_at, p.created_at) > now() - interval '14 days'
      -- Already opened the app since the flip: they've seen it.
      and coalesce(p.last_active_at, '-infinity') < date_trunc('day', now() at time zone 'utc') at time zone 'utc'
      and not exists (select 1 from notifications n where n.user_id = p.id and n.dedupe = 'drop:' || current_date)
  loop
    if not exists (select 1 from drops where user_id = r.id and drop_date = current_date) then
      added := fill_drop(r, case when r.plan in ('premium','black') then 10 else 5 end);
    end if;
    select count(*) into total from drops where user_id = r.id and drop_date = current_date;
    if total > 0 then
      perform notify(r.id, null, 'drop_ready', 'reminder', 'Your Daily Drop is ready',
        total || ' new ' || case when total = 1 then 'person' else 'people' end || ' tonight. Tap to see why they made your list.',
        '/app', 'drop:' || current_date);
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end $$;
revoke all on function public.queue_drop_ready(text) from public;
grant execute on function public.queue_drop_ready(text) to anon, authenticated;

create or replace function public.kind_close(p_conversation uuid, p_choice int) returns void
language plpgsql security definer set search_path = public as $$
declare c conversations; other uuid; msg text;
begin
  select * into c from conversations where id = p_conversation and auth.uid() in (user_a, user_b);
  if c.id is null then raise exception 'not found'; end if;
  if c.ended_at is not null then return; end if;
  msg := case p_choice
    when 1 then 'Hey, I don’t think we’re quite a match, but I really enjoyed chatting. Wishing you the best out there.'
    when 2 then 'I’m going to step back here. Thanks for the conversation, and good luck finding your person.'
    when 3 then 'Doesn’t feel like the timing is right for me. Thanks for being kind, and take care.'
  end;
  if msg is null then raise exception 'pick a message'; end if;
  other := case when auth.uid() = c.user_a then c.user_b else c.user_a end;
  if not blocked_between(auth.uid(), other) then
    insert into messages(conversation_id, sender_id, body) values (c.id, auth.uid(), msg);
  end if;
  update conversations set ended_at = now(), ended_by = auth.uid() where id = c.id and ended_at is null;
  delete from likes where (liker = c.user_a and liked = c.user_b) or (liker = c.user_b and liked = c.user_a);
end $$;
revoke all on function public.kind_close(uuid, int) from public, anon;
grant execute on function public.kind_close(uuid, int) to authenticated;
