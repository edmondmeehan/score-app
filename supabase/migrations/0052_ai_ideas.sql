-- 0052: AI conversation ideas (opt-in).
-- Apple 5.1.2(i): personal data goes to a third-party AI only with the member's explicit permission.
-- Ideas are written only when BOTH people in the chat turned this on, so nobody's profile is sent without consent.
alter table public.profiles add column if not exists ai_ideas boolean not null default false;
alter table public.profiles add column if not exists ai_ideas_at timestamptz;

create table if not exists public.ai_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null default current_date,
  n int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;

create or replace function public.set_ai_ideas(p_on boolean) returns void
language sql security definer set search_path = public as $$
  update profiles set ai_ideas = coalesce(p_on, false), ai_ideas_at = case when p_on then now() else null end where id = auth.uid();
$$;

-- One AI request, if under today's limit. Returns false when the member has used them up.
create or replace function public.ai_take(p_limit int default 40) returns boolean
language plpgsql security definer set search_path = public as $$
declare used int;
begin
  if auth.uid() is null then return false; end if;
  insert into ai_usage(user_id) values (auth.uid()) on conflict (user_id, day) do nothing;
  update ai_usage set n = n + 1 where user_id = auth.uid() and day = current_date and n < p_limit returning n into used;
  return used is not null;
end $$;

revoke all on function public.set_ai_ideas(boolean), public.ai_take(int) from public, anon;
grant execute on function public.set_ai_ideas(boolean), public.ai_take(int) to authenticated;
