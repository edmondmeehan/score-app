-- 0070: tell a waitlist member when a friend joins with their link (server only, needs the server secret).
-- Returns the referrer's details so the server can email them; never callable from a browser.
create or replace function public.waitlist_referral_notice(p_secret text, p_email text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare n waitlist; r waitlist; l record; need int := cfg_int('founder_referrals', 3);
begin
  perform check_server_secret(p_secret);
  select * into n from waitlist where lower(email) = lower(trim(p_email));
  if n.id is null or n.referred_by is null or is_test_email(n.email) then return null; end if;
  select * into r from waitlist where id = n.referred_by;
  if r.id is null or r.status <> 'waiting' then return null; end if;
  select * into l from waitlist_line where id = r.id;
  return jsonb_build_object(
    'email', r.email, 'first_name', nullif(r.first_name, ''), 'status_token', r.status_token,
    'friend', nullif(split_part(trim(n.first_name), ' ', 1), ''),
    'position', l.position, 'total', l.total, 'referrals', r.referrals,
    'founder', r.founder, 'unlocked_founder', r.founder_reason = 'referrals' and r.referrals = need,
    'referrals_needed', greatest(0, need - r.referrals), 'spots_per_referral', cfg_int('referral_spots', 5));
end $$;
revoke all on function public.waitlist_referral_notice(text, text) from public, anon, authenticated;
grant execute on function public.waitlist_referral_notice(text, text) to anon;
