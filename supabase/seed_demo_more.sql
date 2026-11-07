-- Score DEMO DATA, part 2: 50 more test members (100 total) and 150 more test waitlist entries,
-- spread across New York neighborhoods so the maps fill in. Run AFTER seed_demo.sql.
-- Same rules as part 1: every account uses an @seed.scoredate.test email, signs in with ScoreDemo!2026,
-- and is removed by seed_demo_remove.sql. Safe to run more than once (it only tops up to 100).
-- Photos reuse the part-1 AI portraits (people who don't exist), matched by gender.

set search_path = public, extensions;

do $$
declare
  first_w text[] := array['Ana','Bianca','Carmen','Dana','Eva','Fiona','Gia','Helena','Iris','Josie','Kara','Lena','Mara','Nora','Paige','Rosa','Sasha','Tess','Vera','Willa','Yara','Zara','Alana','Brooke','Celine'];
  first_m text[] := array['Aaron','Brian','Caleb','Derek','Eli','Felix','Gabe','Henry','Ian','Jake','Kevin','Liam','Miles','Nico','Oscar','Paul','Reid','Simon','Tyler','Victor'];
  first_n text[] := array['Alex','Blair','Casey','Drew','Emery'];
  jobs text[] := array['Product manager','Surgeon','Portfolio manager','Urban planner','Pediatrician','Startup COO','Copywriter','Backend engineer','Sommelier','Property manager','Professor','Private equity associate','Editor','Physical therapist','Art director','Machine learning engineer','Strategy consultant','Sound engineer','Flight attendant','Landscape architect'];
  -- one zip per neighborhood in rotation, so every listed neighborhood gets people
  zips text[] := array['10004','10007','10012','10002','10009','10014','10011','10010','10019','10017','10021','10024','10027','10032',
                       '11211','11206','11201','11238','11215','11231','11216','11225','11226','11209',
                       '11101','11102','11104','11372','11375','10463','07030','07302'];
  vals text[] := array['Saver','Spender','Balanced','Debt: avoid','Debt: strategic','Paying it down','Splits the check','Happy to treat','Whoever asked pays','Joint finances','Separate finances','A bit of both','Owning in 3 yrs','Starting a business','Retire early','Travel more','Index funds','Real estate','High risk, high reward'];
  prompts text[] := array['Best purchase I ever made…','My most underrated money habit…','A splurge I''ll never regret…','I''m saving up for…','The best free thing in New York…'];
  answers text[] := array['Noise-cancelling headphones. My commute is a spa now.','Auto-transfer to savings the day I get paid.','A cooking class in Oaxaca.','A down payment, slowly but surely.','Walking the High Line at 7am.','A good winter coat. Finally.','Season pass at the Brooklyn Botanic Garden.','Paying off my car early.','A weekend in Montauk every September.','The rooftop at my building, honestly.'];
  bands text[] := array['elite','strong','strong','solid','solid','building'];
  plans text[] := array['membership','membership','membership','premium','premium','black','preview'];
  existing int := (select count(*) from auth.users where email like '%@seed.scoredate.test' and email not like 'waitlist%');
  first text; g text; seek text[]; uid uuid; i int; k int; em text; pth text; zp text; hoodname text;
begin
  if existing = 0 then raise notice 'Run seed_demo.sql first.'; return; end if;
  if existing >= 100 then raise notice 'Already 100 test members. Nothing to add.'; end if;

  for i in 51..100 loop
    exit when existing >= 100;
    k := i - 50;
    if k <= 25 then first := first_w[k]; g := 'woman'; seek := '{man}';
    elsif k <= 45 then first := first_m[k - 25]; g := 'man'; seek := '{woman}';
    else first := first_n[k - 45]; g := 'nonbinary'; seek := '{woman,man,nonbinary}'; end if;
    em := lower(first) || '.' || i || '@seed.scoredate.test';
    continue when exists (select 1 from auth.users where email = em);
    uid := gen_random_uuid();
    zp := zips[1 + (k % array_length(zips, 1))];
    select coalesce(mp.name, 'New York') into hoodname from zip_places z join map_places mp on mp.key = z.place_key where z.zip = zp;

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
      job = jobs[1 + ((k * 7) % array_length(jobs, 1))],
      neighborhood = split_part(hoodname, ' & ', 1), zip = zp,
      prompt_q = prompts[1 + (k % array_length(prompts, 1))],
      prompt_a = answers[1 + ((k * 3) % array_length(answers, 1))],
      money_values = array[vals[1 + (k % 3)], vals[4 + (k % 3)], vals[7 + ((k * 2) % 3)], vals[10 + (k % 3)], vals[13 + (k % 4)]],
      band = bands[1 + ((k * 5) % array_length(bands, 1))],
      trend = case when k % 4 = 0 then 'up' when k % 9 = 0 then 'down' else 'steady' end,
      credit_verified_at = now() - make_interval(days => (random() * 120)::int),
      id_status = 'approved', photo_status = 'approved',
      plan = plans[1 + ((k * 2) % array_length(plans, 1))],
      status = case when plans[1 + ((k * 2) % array_length(plans, 1))] = 'preview' then 'preview' else 'active' end,
      preview_ends_at = case when plans[1 + ((k * 2) % array_length(plans, 1))] = 'preview' then now() + make_interval(days => 1 + (k % 6)) end,
      last_active_at = now() - make_interval(hours => (random() * 120)::int),
      created_at = now() - make_interval(days => (random() * 40)::int)
    where id = uid;

    -- reuse a part-1 portrait of the same gender
    select ph.path into pth from photos ph join profiles p on p.id = ph.user_id join auth.users u on u.id = p.id
    where u.email like '%@seed.scoredate.test' and p.gender = g and ph.path like 'http%'
    order by u.email offset (k % greatest(1, (select count(*) from profiles p2 join auth.users u2 on u2.id = p2.id
                                               where u2.email like '%@seed.scoredate.test' and p2.gender = g) - 1)) limit 1;
    if pth is not null then
      insert into photos(user_id, path, position, match_status, match_similarity) values (uid, pth, 0, 'approved', 99);
    end if;
    existing := existing + 1;
  end loop;

  -- 150 more test waitlist entries across the same neighborhoods.
  insert into waitlist(first_name, email, zip, status, created_at)
  select (array['Alex','Sam','Jamie','Taylor','Morgan','Casey','Drew','Blake','Cameron','Devon'])[1 + (g2 % 10)],
         'waitlist2-' || g2 || '@seed.scoredate.test',
         zips[1 + (g2 % array_length(zips, 1))],
         'waiting',
         now() - make_interval(days => (g2 % 30), hours => g2)
  from generate_series(1, 150) g2
  on conflict (email) do nothing;
end $$;

select
  (select count(*) from auth.users where email like '%@seed.scoredate.test' and email not like 'waitlist%') as test_members,
  (select count(*) from waitlist where email like '%@seed.scoredate.test') as test_waitlist;
