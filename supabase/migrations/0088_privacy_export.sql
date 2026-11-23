-- 0088: "Download my data" covers everything the Privacy Policy lists, including newer features:
-- voice notes, message reactions, event check-ins, event hearts and hellos, invites, profiles viewed, verification
-- security signals (IP / city / device) and the waitlist entry. Safe to re-run.

create or replace function public.my_data_export() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); my_email text;
begin
  if uid is null then raise exception 'Please sign in.'; end if;
  select email into my_email from auth.users where id = uid;
  return jsonb_build_object(
    'exported_at', now(),
    'note', 'Your ScoreDate data. ScoreDate never stores your exact credit score or credit report, only your band and trend. ID images and your ID selfie stay with our verification partner and are not included.',
    'account', (select jsonb_build_object('email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at) from auth.users u where u.id = uid),
    'profile', (select to_jsonb(p) from profiles p where p.id = uid),
    'waitlist', (select jsonb_build_object('joined', w.created_at, 'zip', w.zip, 'status', w.status, 'founder', w.founder) from waitlist w where lower(w.email) = lower(my_email) limit 1),
    'photos', coalesce((select jsonb_agg(jsonb_build_object('position', position, 'status', match_status, 'created_at', created_at)) from photos where user_id = uid), '[]'),
    'money_quiz', (select answers from compat_answers where user_id = uid),
    'conversations', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'with', first_name_of(case when c.user_a = uid then c.user_b else c.user_a end), 'started', c.created_at, 'ended', c.ended_at)) from conversations c where uid in (c.user_a, c.user_b)), '[]'),
    'messages_sent', coalesce((select jsonb_agg(jsonb_build_object('conversation', conversation_id, 'body', body, 'photo', image_path is not null, 'voice_note', audio_path is not null, 'sent', created_at) order by created_at) from messages where sender_id = uid), '[]'),
    'reactions_given', coalesce((select jsonb_agg(jsonb_build_object('conversation', conversation_id, 'reaction', kind, 'at', updated_at)) from message_reactions where user_id = uid and kind is not null), '[]'),
    'likes_given', coalesce((select jsonb_agg(jsonb_build_object('who', first_name_of(liked), 'at', created_at)) from likes where liker = uid), '[]'),
    'profiles_viewed', coalesce((select jsonb_agg(jsonb_build_object('who', first_name_of(viewed), 'day', day)) from profile_views where viewer = uid), '[]'),
    'blind_rounds', coalesce((select jsonb_agg(jsonb_build_object('score', score, 'at', created_at)) from blind_rounds where uid in (user_a, user_b)), '[]'),
    'date_plans', coalesce((select jsonb_agg(jsonb_build_object('place', d.place, 'when', d.starts_at, 'status', d.status)) from date_plans d where d.proposer_id = uid), '[]'),
    'event_rsvps', coalesce((select jsonb_agg(jsonb_build_object('event', e.title, 'status', r.status, 'rsvp_at', r.created_at, 'checked_in_at', r.checked_in_at, 'hidden_from_whos_here', r.hide_here)) from event_rsvps r join events e on e.id = r.event_id where r.user_id = uid), '[]'),
    'event_hearts_given', coalesce((select jsonb_agg(jsonb_build_object('event', e.title, 'who', first_name_of(i.to_id), 'at', i.created_at)) from event_interest i join events e on e.id = i.event_id where i.from_id = uid), '[]'),
    'event_hellos_sent', coalesce((select jsonb_agg(jsonb_build_object('event', e.title, 'who', first_name_of(w.to_id), 'at', w.created_at)) from event_waves w join events e on e.id = w.event_id where w.from_id = uid), '[]'),
    'invites_created', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'kind', kind, 'created', created_at, 'redeemed', redeemed_at is not null)) from invites where inviter_id = uid), '[]'),
    'verification_security_signals', coalesce((select jsonb_agg(jsonb_build_object('step', step, 'ip', ip, 'city', city, 'region', region, 'country', country, 'device', user_agent, 'at', created_at)) from verification_signals where user_id = uid), '[]'),
    'reports_filed', coalesce((select jsonb_agg(jsonb_build_object('reason', reason, 'status', status, 'at', created_at)) from reports where reporter_id = uid), '[]'),
    'support_tickets', coalesce((select jsonb_agg(jsonb_build_object('subject', subject, 'body', body, 'status', status, 'at', created_at)) from support_tickets where user_id = uid), '[]'),
    'billing', coalesce((select jsonb_agg(jsonb_build_object('type', type, 'product', product_id, 'store', store, 'at', received_at)) from billing_events where user_id = uid), '[]'),
    'screenshots_detected', (select count(*) from screenshot_events where user_id = uid),
    'blocked', coalesce((select jsonb_agg(first_name_of(blocked_id)) from blocks where blocker_id = uid), '[]'));
end $$;
grant execute on function public.my_data_export() to authenticated;
