-- Remove ALL Score demo data (test members, their messages, RSVPs, waitlist rows, demo traffic).
-- Real accounts are untouched. Run in Supabase → SQL Editor.
delete from public.events where id in (select distinct event_id from public.event_rsvps r join auth.users u on u.id = r.user_id where u.email like '%@seed.scoredate.test')
  and title in ('Rooftop supper club', 'Wine & vinyl night');
delete from auth.users where email like '%@seed.scoredate.test';   -- cascades to profiles, chats, RSVPs, credits…
delete from public.waitlist where email like '%@seed.scoredate.test';
delete from public.analytics_events where visitor_id like 'demo-v%';
