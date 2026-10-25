-- ════════════════════════════════════════════════════════════
-- PremadeGG · Datos de desarrollo (solo `supabase db reset` en local)
-- Port de server/seed.js + server/utils/seedDefaults.js
--
-- Usuarios de prueba (contraseña: password123):
--   test1@premade.gg · test2@premade.gg · test3@premade.gg
--   player1@premade.gg … player20@premade.gg
-- ════════════════════════════════════════════════════════════

-- Crea un usuario de Auth con login por email (el trigger crea su fila en profiles)
create function pg_temp.seed_auth_user(p_email text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}', '{}', now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );
  return v_id;
end;
$$;

do $$
declare
  v_test1 uuid;
  v_test2 uuid;
  v_test3 uuid;
  v_team uuid;
  v_conv uuid;
  v_post uuid;
  v_players uuid[] := '{}';
  v_uid uuid;
  v_ranks text[] := array['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];
  v_roles text[] := array['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'];
  v_schedules text[] := array['Weekends', 'Evenings', 'Late Night', 'Mornings', 'Flexible'];
  v_agents text[] := array['Jett', 'Reyna', 'Omen', 'Sova', 'Killjoy', 'Sage', 'Raze', 'Fade', 'Viper', 'Clove'];
  v_bios text[] := array[
    'Jugador competitivo buscando equipo serio para ranked.',
    'Casual player, me gusta divertirme y mejorar.',
    'Main Duelist buscando team para torneos.',
    'Support main, buena comunicación y callouts.',
    'Disponible para scrims y ranked.',
    ''
  ];
  i int;
begin
  perform setseed(0.42);

  -- ── Usuarios fijos de prueba (seedDefaults) ──────────────────
  v_test1 := pg_temp.seed_auth_user('test1@premade.gg');
  v_test2 := pg_temp.seed_auth_user('test2@premade.gg');
  v_test3 := pg_temp.seed_auth_user('test3@premade.gg');

  update public.profiles set
    riot_id = 'TestUser1#EUW', puuid = 'test-puuid-1', rank = 'Diamond', role = 'Duelist',
    schedule = 'Evenings', account_level = 100, bio = 'Usuario de prueba 1 - Main Duelist',
    favorite_agents = '{Jett,Reyna}', favorite_role = 'Duelist',
    social_links = '{"discord": "testuser1", "twitter": "", "twitch": ""}',
    looking_for_team = true, lft_details = 'Buscando equipo de prueba', onboarded = true
  where id = v_test1;

  update public.profiles set
    riot_id = 'TestUser2#EUW', puuid = 'test-puuid-2', rank = 'Ascendant', role = 'Controller',
    schedule = 'Weekends', account_level = 150, bio = 'Usuario de prueba 2 - Main Controller',
    favorite_agents = '{Omen,Brimstone}', favorite_role = 'Controller', is_coach = true,
    coach_details = 'Coach de prueba para equipos Ascendant+',
    social_links = '{"discord": "testuser2", "twitter": "", "twitch": ""}', onboarded = true
  where id = v_test2;

  update public.profiles set
    riot_id = 'TestUser3#EUW', puuid = 'test-puuid-3', rank = 'Platinum', role = 'Initiator',
    schedule = 'Flexible', account_level = 80, bio = 'Usuario de prueba 3 - Main Initiator',
    favorite_agents = '{Sova,Fade}', favorite_role = 'Initiator',
    social_links = '{"discord": "testuser3", "twitter": "", "twitch": ""}',
    looking_for_team = true, lft_details = 'Solo queue de prueba', onboarded = true
  where id = v_test3;

  -- ── 20 jugadores aleatorios (seed.js) ────────────────────────
  for i in 1..20 loop
    v_uid := pg_temp.seed_auth_user(format('player%s@premade.gg', i));
    v_players := v_players || v_uid;
    update public.profiles set
      riot_id = format('Player%s#%s', i, (array['EUW', 'NA1', 'KR1', 'ESP'])[1 + floor(random() * 4)::int]),
      puuid = format('seed-puuid-%s', i),
      region = (array['eu', 'na', 'ap', 'kr'])[1 + floor(random() * 4)::int]::public.region,
      rank = v_ranks[1 + floor(random() * 9)::int]::public.valorant_rank,
      role = v_roles[1 + floor(random() * 5)::int]::public.valorant_role,
      schedule = v_schedules[1 + floor(random() * 5)::int],
      account_level = 20 + floor(random() * 300)::int,
      bio = v_bios[1 + floor(random() * 6)::int],
      favorite_agents = array[v_agents[1 + floor(random() * 5)::int], v_agents[6 + floor(random() * 5)::int]],
      looking_for_team = random() < 0.4,
      is_coach = random() < 0.15,
      onboarded = true
    where id = v_uid;
  end loop;

  -- ── 50 reviews cruzadas (el trigger recalcula el karma) ──────
  insert into public.reputations (author_id, target_id, rating, comment)
  select distinct on (a, t) a, t,
    -- Sesgo positivo, como en seed.js: la mayoría de jugadores no son tóxicos
    (array[5, 5, 4, 4, 4, 3, 2, 1])[1 + floor(random() * 8)::int],
    (array['Buen compañero', 'Muy buena comunicación', 'Tóxico en voice', 'Carry absoluto', 'Normalito', null])[1 + floor(random() * 6)::int]
  from (
    select v_players[1 + floor(random() * 20)::int] as a, v_players[1 + floor(random() * 20)::int] as t
    from generate_series(1, 80)
  ) pairs
  where a <> t
  limit 50;

  -- ── Equipos de prueba ────────────────────────────────────────
  insert into public.teams (name, tag, description, owner_id, coach_id, region, target_rank, recruiting, recruiting_roles, recruiting_details, achievements)
  values ('Test Team Alpha', 'TTA', 'Equipo de prueba Alpha.', v_test1, v_test2, 'eu', 'Diamond', true,
    '{Initiator,Sentinel}', 'Buscamos gente para el equipo de prueba Alpha.',
    '[{"title": "Top 4 Liga Amateur", "date": "2026-03-01", "description": "Primera competición del equipo"}]')
  returning id into v_team;
  insert into public.team_players (team_id, user_id, role) values (v_team, v_test1, 'Duelist'), (v_team, v_test2, 'Controller');
  insert into public.conversations (type, name, admin_id, team_id) values ('group', 'Team Test Team Alpha', v_test1, v_team) returning id into v_conv;
  insert into public.conversation_participants (conversation_id, user_id) values (v_conv, v_test1), (v_conv, v_test2);
  insert into public.messages (conversation_id, sender_id, content) values (v_conv, v_test1, '¡Bienvenidos al chat del equipo!');
  update public.conversations set last_message_content = '¡Bienvenidos al chat del equipo!', last_message_sender = v_test1, last_message_at = now() where id = v_conv;

  insert into public.teams (name, tag, description, owner_id, region, target_rank)
  values ('Test Team Beta', 'TTB', 'Equipo de prueba Beta.', v_test2, 'eu', 'Ascendant')
  returning id into v_team;
  insert into public.team_players (team_id, user_id, role) values (v_team, v_test2, 'Controller'), (v_team, v_test3, 'Initiator');
  insert into public.conversations (type, name, admin_id, team_id) values ('group', 'Team Test Team Beta', v_test2, v_team) returning id into v_conv;
  insert into public.conversation_participants (conversation_id, user_id) values (v_conv, v_test2), (v_conv, v_test3);

  -- ── Posts LFG ────────────────────────────────────────────────
  insert into public.lfg_posts (author_id, title, description, team_size, min_rank, min_karma)
  values (v_test3, 'Buscando duo de prueba', 'Soy un usuario de prueba buscando a otro para duo queue.', 2, 'Gold', 3)
  returning id into v_post;
  insert into public.lfg_members (post_id, user_id, status) values (v_post, v_test3, 'accepted');

  insert into public.lfg_posts (author_id, title, description, team_size, min_rank, min_karma)
  values (v_test1, 'Reclutando para Test Team Alpha', 'Buscamos gente para probar las features de premade.gg.', 5, 'Platinum', 4)
  returning id into v_post;
  insert into public.lfg_members (post_id, user_id, status) values (v_post, v_test1, 'accepted');

  for i in 1..8 loop
    v_uid := v_players[i];
    insert into public.lfg_posts (author_id, title, description, team_size, min_rank, min_karma, created_at)
    values (
      v_uid,
      (array['Duo para ranked esta noche', 'Busco trío chill', 'Stack de 5 para subir a Diamond', 'Scrims este finde'])[1 + (i % 4)],
      'Post generado por el seed.',
      (array[2, 3, 5])[1 + (i % 3)],
      v_ranks[1 + (i % 6)]::public.valorant_rank,
      3,
      now() - make_interval(mins => i * 17)
    )
    returning id into v_post;
    insert into public.lfg_members (post_id, user_id, status) values (v_post, v_uid, 'accepted');
  end loop;

  -- ── Chat directo de ejemplo ──────────────────────────────────
  insert into public.conversations (type) values ('direct') returning id into v_conv;
  insert into public.conversation_participants (conversation_id, user_id, last_read_at)
  values (v_conv, v_test1, now()), (v_conv, v_test3, now() - interval '1 hour');
  insert into public.messages (conversation_id, sender_id, content, created_at)
  values (v_conv, v_test3, 'Ey, ¿jugamos unas rankeds luego?', now() - interval '30 minutes'),
         (v_conv, v_test1, '¡Claro! A las 21:00 me conecto.', now() - interval '20 minutes');
  update public.conversations set last_message_content = '¡Claro! A las 21:00 me conecto.', last_message_sender = v_test1,
    last_message_at = now() - interval '20 minutes', updated_at = now() - interval '20 minutes'
  where id = v_conv;
end;
$$;
