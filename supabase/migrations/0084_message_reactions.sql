-- 0084: Reactions on messages (love, like, laugh, wow, sad). Long-press a message to react, double-tap to love it.
--  • One reaction per person per message; picking another replaces it, tapping the same one again removes it.
--  • Only the two people in the chat can react or see reactions. Not in ended or blocked chats.
--  • Removing a reaction clears it (kind = null) instead of deleting the row, so live updates stay private.
-- Safe to re-run.

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  kind text check (kind in ('love', 'like', 'laugh', 'wow', 'sad')),
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists message_reactions_conv on public.message_reactions(conversation_id);
alter table public.message_reactions enable row level security;
revoke insert, update, delete on public.message_reactions from anon, authenticated;
grant select on public.message_reactions to authenticated;
drop policy if exists message_reactions_read on public.message_reactions;
create policy message_reactions_read on public.message_reactions for select using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)) or public.is_staff());

do $$ begin
  alter publication supabase_realtime add table public.message_reactions;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- React (or pass null to remove). Returns the reaction now saved.
create or replace function public.react_message(p_message uuid, p_kind text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c conversations;
begin
  if p_kind is not null and p_kind not in ('love', 'like', 'laugh', 'wow', 'sad') then raise exception 'Unknown reaction'; end if;
  select cv.* into c from messages m join conversations cv on cv.id = m.conversation_id where m.id = p_message;
  if c.id is null or me is null or me not in (c.user_a, c.user_b) then raise exception 'Message not found'; end if;
  if c.ended_at is not null then raise exception 'This conversation has ended'; end if;
  if blocked_between(c.user_a, c.user_b) then raise exception 'Message not found'; end if;
  insert into message_reactions(message_id, user_id, conversation_id, kind, updated_at)
  values (p_message, me, c.id, p_kind, now())
  on conflict (message_id, user_id) do update set kind = excluded.kind, updated_at = now();
  return p_kind;
end $$;
revoke all on function public.react_message(uuid, text) from public, anon;
grant execute on function public.react_message(uuid, text) to authenticated;
