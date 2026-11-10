-- 0055: Push status for admins: which devices a member has registered and Apple/Google's reply to the last push.
alter table public.native_push_tokens add column if not exists last_push_at timestamptz;
alter table public.native_push_tokens add column if not exists last_push_result text;

create or replace function public.native_push_result(p_secret text, p_token text, p_result text) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if p_secret is distinct from (select value from private.private_secrets where key = 'webhook_secret') then return; end if;
  update native_push_tokens set last_push_at = now(), last_push_result = left(p_result, 120) where token = p_token;
end $$;
grant execute on function public.native_push_result(text, text, text) to anon, authenticated;

create or replace function public.staff_push_status(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if staff_role() is null then raise exception 'Staff only'; end if;
  return jsonb_build_object(
    'devices', coalesce((select jsonb_agg(jsonb_build_object('platform', platform, 'tail', right(token, 6), 'registered', created_at, 'seen', last_seen_at,
                 'last_push', last_push_at, 'result', last_push_result) order by last_seen_at desc) from native_push_tokens where user_id = p_user), '[]'::jsonb),
    'web', (select count(*) from push_subscriptions where user_id = p_user),
    'recent', coalesce((select jsonb_agg(x) from (select jsonb_build_object('at', created_at, 'title', title, 'push', push_state, 'email', email_state) x
                 from notifications where user_id = p_user order by created_at desc limit 5) r), '[]'::jsonb));
end $$;
revoke all on function public.staff_push_status(uuid) from public, anon;
grant execute on function public.staff_push_status(uuid) to authenticated;
