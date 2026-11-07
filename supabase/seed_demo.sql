-- Score DEMO DATA: 50 test members, Notes and messages to you, event RSVPs, a waitlist, and traffic.
-- Every test account uses an @seed.scoredate.test email so it can be removed in one step
-- (see seed_demo_remove.sql). Remove it all before real members join.
--
-- Run in Supabase → SQL Editor AFTER you've created your own account (eddie@please.co),
-- so the Notes and messages land in your inbox. Safe to run once; running again adds nothing.
-- Test members can sign in with their email and the password: ScoreDemo!2026

set search_path = public, extensions;

do $$
declare
  me uuid := (select u.id from auth.users u where lower(u.email) = 'eddie@please.co');
  first_w text[] := array['Nadia','Ava','Sofia','Maya','Leah','Chloe','Priya','Elena','Grace','Zoe','Isabel','Hannah','Mia','Olivia','Julia','Camila','Nina','Rachel','Talia','Sarah','Lauren','Amara','Jade','Claire','Noor'];
  first_m text[] := array['Owen','James','Daniel','Marcus','Ethan','Lucas','Theo','Adrian','Noah','Ben','Julian','Sam','Andre','Max','Ryan','Kai','Nate','Leo','David','Omar'];
  first_n text[] := array['Riley','Jordan','Avery','Quinn','Rowan'];
  jobs text[] := array['Product designer','Attorney','Equity analyst','Architect','ER physician','Founder','Brand strategist','Software engineer','Chef','Real estate developer','Teacher','Investment banker','Journalist','Nurse practitioner','Creative director','Data scientist','Consultant','Music producer','Pilot','Interior designer'];
  -- zips weighted toward Manhattan so the member map shows activity
  zips text[] := array['10014','10011','10003','10012','10013','10023','10024','10021','10028','10016','10010','10001','10002','10019','10009','10025','10075','10014','10011','10003','10012','10023','10024','10065','10013','10007','10010','10036','10016','10128','10022','10028',
                       '11211','11211','11222','11215','11217','11201','11238','11205','11216','11231','11237','11206',
                       '11101','11102','11106','07030','07302','10463'];
  hood text[] := array['West Village','Chelsea','East Village','SoHo','Tribeca','UWS','UWS','UES','UES','Gramercy','Flatiron','Chelsea','LES','Hell''s Kitchen','East Village','UWS','UES','West Village','Chelsea','East Village','Nolita','UWS','UWS','UES','Tribeca','Tribeca','Flatiron','Midtown','Murray Hill','UES','Midtown East','UES',
                       'Williamsburg','Williamsburg','Greenpoint','Park Slope','Boerum Hill','Brooklyn Heights','Prospect Heights','Fort Greene','Bed-Stuy','Carroll Gardens','Bushwick','Bushwick',
                       'LIC','Astoria','Astoria','Hoboken','Jersey City','Riverdale'];
  vals text[] := array['Saver','Spender','Balanced','Debt: avoid','Debt: strategic','Paying it down','Splits the check','Happy to treat','Whoever asked pays','Joint finances','Separate finances','A bit of both','Owning in 3 yrs','Starting a business','Retire early','Travel more','Index funds','Real estate','High risk, high reward'];
  prompts text[] := array['Best purchase I ever made…','My most underrated money habit…','A splurge I''ll never regret…','I''m saving up for…','The best free thing in New York…'];
  answers text[] := array['A one-way ticket to Lisbon that turned into a year.','Good knives. I cook every night.','Paying off my loans two years early.','Season tickets. Worth every penny.','My grandmother''s apartment, finally renovated.','Therapy, honestly.','A road bike and every Saturday since.','A tiny studio in the Catskills.','Learning to fly. Private license next spring.','The Met membership. I go every Sunday.','A house upstate, slowly.','Starting my own firm.'];
  bands text[] := array['elite','strong','strong','solid','solid','building'];
  plans text[] := array['membership','membership','membership','premium','premium','black','preview'];
  first text; g text; seek text[]; uid uuid; i int; em text; n_total int := 50;
  ids uuid[] := '{}'; conv uuid; a uuid; b uuid; ev1 uuid; ev2 uuid;
begin
  if exists (select 1 from auth.users u where u.email like '%@seed.scoredate.test') then
    raise notice 'Demo data already exists. Run seed_demo_remove.sql first to reload it.';
    return;
  end if;

  for i in 1..n_total loop
    if i <= 25 then first := first_w[i]; g := 'woman'; seek := '{man}';
    elsif i <= 45 then first := first_m[i - 25]; g := 'man'; seek := '{woman}';
    else first := first_n[i - 45]; g := 'nonbinary'; seek := '{woman,man,nonbinary}'; end if;
    if i in (7, 19, 33) then seek := '{woman,man}'; end if;
    uid := gen_random_uuid();
    em := lower(first) || '.' || i || '@seed.scoredate.test';

    insert into auth.users(instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                           raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
            crypt('ScoreDemo!2026', gen_salt('bf')), now(), now() - make_interval(days => (random() * 40)::int), now(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('demo', true), false, false);
    insert into auth.identities(id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());

    update profiles set
      first_name = first,
      birth_year = extract(year from now())::int - (26 + (random() * 14)::int),
      gender = g, seeking = seek,
      job = jobs[1 + ((i * 7) % array_length(jobs, 1))],
      neighborhood = hood[i], zip = zips[i],
      prompt_q = prompts[1 + (i % array_length(prompts, 1))],
      prompt_a = answers[1 + ((i * 5) % array_length(answers, 1))],
      money_values = array[vals[1 + (i % 3)], vals[4 + (i % 3)], vals[7 + ((i * 2) % 3)], vals[10 + (i % 3)], vals[13 + (i % 4)]],
      band = bands[1 + ((i * 3) % array_length(bands, 1))],
      trend = case when i % 4 = 0 then 'up' when i % 9 = 0 then 'down' else 'steady' end,
      credit_verified_at = now() - make_interval(days => (random() * 120)::int),
      id_status = 'approved', photo_status = 'approved',
      plan = plans[1 + ((i * 3) % array_length(plans, 1))],
      status = case when plans[1 + ((i * 3) % array_length(plans, 1))] = 'preview' then 'preview' else 'active' end,
      preview_ends_at = case when plans[1 + ((i * 3) % array_length(plans, 1))] = 'preview' then now() + make_interval(days => 1 + (i % 6)) end,
      is_founder = i <= 6,
      created_at = now() - make_interval(days => (random() * 40)::int)
    where id = uid;

    if i % 3 = 0 then
      insert into profile_socials(user_id, instagram, instagram_public) values (uid, lower(first) || '.nyc' || i, i % 2 = 0);
    end if;
    ids := ids || uid;
  end loop;

  -- A few members on Paused / Taken, and one waiting on ID review (shows up in admin).
  update profiles set status = 'paused', plan = 'paused' where id = ids[48];
  update profiles set status = 'taken', plan = 'paused' where id = ids[49];
  update profiles set status = 'onboarding', plan = 'none', id_status = 'review' where id = ids[50];
  insert into verifications(user_id, kind, provider, status, detail) values (ids[50], 'id', 'test', 'review', 'Demo: name mismatch on ID');

  -- Some members in Spotlight right now.
  update profiles set spotlight_until = now() + interval '45 minutes' where id in (ids[3], ids[28], ids[12]);

  -- Conversations among test members, with messages.
  for i in 1..12 loop
    a := ids[i]; b := ids[25 + i];
    insert into conversations(user_a, user_b, created_at) values (least(a, b), greatest(a, b), now() - make_interval(days => i))
      returning id into conv;
    insert into messages(conversation_id, sender_id, body, created_at) values
      (conv, b, 'Your prompt answer made me laugh. Coffee this week?', now() - make_interval(days => i, hours => 3)),
      (conv, a, 'Ha, thank you. Thursday works. Somewhere near Union Square?', now() - make_interval(days => i, hours => 2)),
      (conv, b, 'Perfect. 6:30 at Daily Provisions?', now() - make_interval(days => i, hours => 1));
  end loop;

  -- You: Notes ("likes") and conversations with messages.
  if me is not null then
    -- 6 Notes sent to you (highlighted in your inbox)
    for i in 1..6 loop
      a := ids[i * 4];  -- mix of women, men, nonbinary
      insert into conversations(user_a, user_b, note_from, created_at) values (least(a, me), greatest(a, me), a, now() - make_interval(hours => i * 5))
        returning id into conv;
      insert into messages(conversation_id, sender_id, body, created_at) values (conv, a,
        (array['Anyone who''s been to every borough''s best pizza place gets a Note from me. Have you?',
               'Your money values are basically mine. Splits the check and index funds? Marry me (kidding, mostly).',
               'I had to use a Note on you. Drinks at a place you''ve been meaning to try?',
               'Okay, the Spotify pick sold me. What else is on that playlist?',
               'You seem like you''d have strong opinions about the best bagel in the city. Prove me right.',
               'Hi! New to Score and you were the first profile that made me stop scrolling.'])[i],
        now() - make_interval(hours => i * 5));
    end loop;
    -- 4 active conversations with back-and-forth
    for i in 1..4 loop
      a := ids[1 + i * 2];
      insert into conversations(user_a, user_b, created_at) values (least(a, me), greatest(a, me), now() - make_interval(days => i + 1))
        on conflict (user_a, user_b) do nothing returning id into conv;
      if conv is not null then
        insert into messages(conversation_id, sender_id, body, created_at) values
          (conv, me, 'Hey! Your answer about the Catskills place is great. Did you build it out yourself?', now() - make_interval(days => i + 1, hours => 6)),
          (conv, a, 'Mostly! My dad and a lot of YouTube. Do you get out of the city much?', now() - make_interval(days => i + 1, hours => 5)),
          (conv, me, 'Not enough. Tell me more over a drink?', now() - make_interval(days => i, hours => 20)),
          (conv, a, 'Yes. Thursday after 7?', now() - make_interval(hours => i * 3));
      end if;
    end loop;
    -- a confirmed date in one of them
    select c.id into conv from conversations c where me in (c.user_a, c.user_b) and c.note_from is null order by c.created_at desc limit 1;
    if conv is not null then
      insert into date_plans(conversation_id, proposer_id, place, address, starts_at, note, status, responded_at)
      values (conv, me, 'Bar Pisellino', '52 Grove St', date_trunc('day', now()) + interval '2 days 23 hours', 'Drinks after work?', 'accepted', now());
    end if;
  end if;

  -- Events: one open to all, one in the Black-first window.
  insert into events(title, description, venue, address, area, starts_at, ends_at, capacity, price_note, black_priority_hours, status, published_at)
  values ('Rooftop supper club', 'Twenty-four members, one long table, a five-course menu from the chef. Smart casual.', 'Westlight', '111 N 12th St, Brooklyn', 'New York City',
          date_trunc('day', now()) + interval '9 days 19 hours 30 minutes', date_trunc('day', now()) + interval '9 days 23 hours', 24, '$65, dinner and two drinks', 48, 'published', now() - interval '4 days')
  returning id into ev1;
  insert into events(title, description, venue, address, area, starts_at, capacity, price_note, black_priority_hours, status, published_at)
  values ('Wine & vinyl night', 'Natural wine, a listening room, and records from members'' collections.', 'Public Records', '233 Butler St, Brooklyn', 'New York City',
          date_trunc('day', now()) + interval '16 days 20 hours', 40, 'Free for members', 72, 'published', now() - interval '6 hours')
  returning id into ev2;
  insert into event_rsvps(event_id, user_id, status)
  select ev1, p.id, case when row_number() over () <= 24 then 'going' else 'waitlist' end
  from profiles p where p.id = any(ids) and p.plan in ('membership','premium','black') limit 27;
  insert into event_rsvps(event_id, user_id, status)
  select ev2, p.id, 'going' from profiles p where p.id = any(ids) and p.plan = 'black';

  -- Add-on purchases (test) so admin numbers aren't empty.
  insert into addon_credits(user_id, kind, balance)
  select p.id, k, 1 + (random() * 3)::int from profiles p cross join (values ('note'), ('spotlight')) v(k)
  where p.id = any(ids) and p.plan in ('membership','premium') and random() < 0.4 on conflict do nothing;

  -- One open report for the moderation queue.
  insert into reports(reporter_id, reported_id, reason, note) values (ids[2], ids[30], 'Rude or inappropriate', 'Demo report: said something rude after I declined a second date.');
end $$;

-- Waitlist: 80 people across areas (not real people).
insert into public.waitlist(first_name, email, zip, status, referral_code, created_at)
select (array['Alex','Sam','Jamie','Taylor','Morgan','Casey','Drew','Blake','Cameron','Devon'])[1 + (g % 10)],
       'waitlist' || g || '@seed.scoredate.test',
       (array['10014','10011','11211','11215','10023','10003','11101','07030','07302','11530','11743','10583','10601','06830','06902','12534','07901','08540','11201','10024'])[1 + (g % 20)],
       case when g % 9 = 0 then 'invited' else 'waiting' end,
       case when g % 5 = 0 then 'FRIEND' end,
       now() - make_interval(days => (g % 30), hours => g)
from generate_series(1, 80) g
on conflict (email) do nothing;

-- Two weeks of site traffic for Admin → Analytics.
insert into public.analytics_events(at, name, visitor_id, session_id, new_session, path, source, medium, referrer_host, device, os, browser, country, region, city)
select now() - make_interval(days => (g % 14), hours => (g * 7) % 24, mins => g % 60),
       'pageview', 'demo-v' || (g % 140), 'demo-s' || (g / 3), g % 3 = 0,
       (array['/','/join','/join','/signin','/app','/app','/app/messages','/app/events','/app/map','/plans'])[1 + (g % 10)],
       (array['instagram','direct','google','tiktok','invite','direct','instagram','newsletter'])[1 + (g % 8)],
       (array['social','none','organic','social','referral','none','social','email'])[1 + (g % 8)],
       (array['instagram.com',null,'google.com','tiktok.com',null,null,'l.instagram.com',null])[1 + (g % 8)],
       (array['mobile','mobile','mobile','desktop','tablet'])[1 + (g % 5)],
       (array['iOS','iOS','Android','macOS','Windows'])[1 + (g % 5)],
       (array['Safari','Safari','Chrome','Chrome','Instagram'])[1 + (g % 5)],
       'US', 'NY', (array['New York','Brooklyn','Hoboken','New York','Jersey City'])[1 + (g % 5)]
from generate_series(1, 900) g
where not exists (select 1 from public.analytics_events where visitor_id like 'demo-v%');
