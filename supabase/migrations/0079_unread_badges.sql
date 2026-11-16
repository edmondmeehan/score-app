-- 0079: Unread message counts, for the red dot on the Messages tab and the red number on the app icon.
-- Counts messages from other people that arrived after you last opened that conversation
-- (skips blocked and ended conversations). Safe to re-run.

create index if not exists messages_conv_created on public.messages(conversation_id, created_at desc);

create or replace function public.unread_messages_for(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
  from conversations c
  join messages m on m.conversation_id = c.id and m.sender_id <> p_user
  left join conversation_reads r on r.user_id = p_user and r.conversation_id = c.id
  where p_user in (c.user_a, c.user_b)
    and c.ended_at is null
    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
    and not blocked_between(c.user_a, c.user_b);
$$;
revoke all on function public.unread_messages_for(uuid) from public, anon, authenticated;

-- The signed-in member's own count (the app polls this).
create or replace function public.my_unread_messages() returns int
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then 0 else unread_messages_for(auth.uid()) end;
$$;
grant execute on function public.my_unread_messages() to authenticated;

-- Server only: counts for the people about to get a push, so the iPhone icon shows the right number.
create or replace function public.unread_counts_for(p_secret text, p_users uuid[])
returns table(user_id uuid, n int)
language plpgsql stable security definer set search_path = public as $$
begin
  perform check_server_secret(p_secret);
  return query select u, unread_messages_for(u) from unnest(p_users) u;
end $$;
revoke all on function public.unread_counts_for(text, uuid[]) from public, authenticated;
grant execute on function public.unread_counts_for(text, uuid[]) to anon;
