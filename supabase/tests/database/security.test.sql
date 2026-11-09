-- ════════════════════════════════════════════════════════════
-- Tests de seguridad y reglas de negocio (pgTAP)
-- Ejecutar: npm run db:test
-- ════════════════════════════════════════════════════════════
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

-- ── Fixtures: tres usuarios (A, B, C) ────────────────────────
insert into auth.users (id, email, aud, role)
values
  ('a0000000-0000-0000-0000-00000000000a', 'a@test.gg', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@test.gg', 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-00000000000c', 'c@test.gg', 'authenticated', 'authenticated');

update public.profiles set riot_id = 'A#1', rank = 'Gold', role = 'Duelist', schedule = 'Evenings', onboarded = true
where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set riot_id = 'B#1', rank = 'Iron', role = 'Flex', schedule = 'Evenings', onboarded = true, karma = 2, review_count = 5
where id = 'b0000000-0000-0000-0000-00000000000b';
update public.profiles set riot_id = 'C#1', rank = 'Diamond', role = 'Sentinel', schedule = 'Evenings', onboarded = true
where id = 'c0000000-0000-0000-0000-00000000000c';


-- Han aceptado los términos vigentes (sin eso no se puede escribir)
insert into public.consents (user_id, document, version)
select id, 'terms_privacy', public.current_terms_version() from public.profiles
on conflict do nothing;
-- Cambia el usuario autenticado de la sesión
create function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- ── Escritura directa bloqueada ──────────────────────────────
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
set local role authenticated;

select throws_ok(
  $$ update public.profiles set karma = 5, rank = 'Radiant' where id = 'a0000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'un usuario no puede editar su karma/rango con UPDATE directo'
);
select throws_ok(
  $$ insert into public.reputations (author_id, target_id, rating) values ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b', 1) $$,
  '42501', null, 'no se pueden insertar reviews sin pasar por la RPC'
);

-- ── Perfil vía RPC: campos editables sí, rango no ────────────
select is(
  (public.update_my_profile('{"bio": "hola", "rank": "Radiant", "karma": 5}') ->> 'bio'),
  'hola', 'update_my_profile cambia la bio'
);
select is(
  (select rank::text from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a'),
  'Gold', 'update_my_profile ignora rank'
);

-- ── Varios roles: role = el primero de roles ─────────────────
select is(
  (public.update_my_profile('{"roles": ["Sentinel", "Duelist", "Sentinel"]}') -> 'roles'),
  '["Duelist", "Sentinel"]'::jsonb, 'roles se guarda sin repetir y en orden'
);
select is(
  (select role::text from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a'),
  'Duelist', 'role pasa a ser el primero de roles'
);
select throws_ok(
  $$ select public.update_my_profile('{"roles": []}') $$,
  'P0001', 'Elige al menos un rol', 'no se puede quedar sin roles'
);

-- ── Reviews y karma ──────────────────────────────────────────
-- A y C coincidieron en un grupo (solo se valora a quien coincidió contigo)
reset role;
insert into public.played_pairs (user_a, user_b, source, confirmed_at) values ('a0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000c', 'lfg', now());
set local role authenticated;
select lives_ok(
  $$ select public.create_review('c0000000-0000-0000-0000-00000000000c', 2, 'meh') $$,
  'A puede valorar a C'
);
select is(
  (select karma from public.profiles where id = 'c0000000-0000-0000-0000-00000000000c'),
  2.0::numeric, 'el trigger recalcula el karma de C'
);
select is(
  (select trust_karma from public.profiles where id = 'c0000000-0000-0000-0000-00000000000c'),
  3.13::numeric, 'karma ajustado de C: (3·3,5 + 2·1) / (3 + 1)'
);
select is(
  (select trust_karma from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a'),
  3.50::numeric, 'una cuenta sin valoraciones cuenta como 3,5 aunque su media sea 5'
);
select throws_ok(
  $$ select public.create_review('c0000000-0000-0000-0000-00000000000c', 5) $$,
  '23505', null, 'no se puede valorar dos veces al mismo jugador'
);
select throws_ok(
  $$ select public.create_review('a0000000-0000-0000-0000-00000000000a', 5) $$,
  'P0001', 'No puedes valorarte a ti mismo', 'no puedes valorarte a ti mismo'
);
select throws_ok(
  $$ select public.create_review('b0000000-0000-0000-0000-00000000000b', 1, 'no te conozco') $$,
  '42501', 'Solo puedes valorar a jugadores con los que hayas estado al menos 15 minutos en un grupo o un equipo en los últimos 30 días.',
  'no se puede valorar a quien no ha coincidido contigo'
);

-- ── LFG: filtros anti-toxicidad ──────────────────────────────
select ok(
  (public.create_lfg_post('Duo ranked', 2, null, 'Silver', 3) ->> '_id') is not null,
  'A crea un post LFG'
);
select throws_ok(
  format($$ select public.update_lfg_post(%L, '{"status": "full"}') $$, (select id from public.lfg_posts where title = 'Duo ranked')),
  'P0001', 'Estado no válido: solo se puede cerrar o reabrir el grupo', 'el creador no puede poner un estado arbitrario'
);
select is(
  (public.update_lfg_post((select id from public.lfg_posts where title = 'Duo ranked'), '{"status": "closed"}') ->> 'status'),
  'closed', 'el creador puede cerrar su grupo'
);
select public.update_lfg_post((select id from public.lfg_posts where title = 'Duo ranked'), '{"status": "open"}');
select is(
  (public.update_lfg_post((select id from public.lfg_posts where title = 'Duo ranked'), '{"teamSize": 5}') ->> 'teamSize'),
  '5', 'el creador puede cambiar el tamaño del grupo'
);
select throws_ok(
  format($$ select public.update_lfg_post(%L, '{"teamSize": 4}') $$, (select id from public.lfg_posts where title = 'Duo ranked')),
  'P0001', 'Tamaño no válido: Dúo, Trío o 5-Stack', 'solo se admiten 2, 3 o 5'
);

select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
select throws_ok(
  format($$ select public.update_lfg_post(%L, '{"title": "hackeado"}') $$, (select id from public.lfg_posts where title = 'Duo ranked')),
  '42501', null, 'otro usuario no puede editar un grupo ajeno'
);
select throws_ok(
  $$ select public.create_lfg_post('Post tóxico', 2) $$,
  'P0001', 'Tu karma ajustado (2.56) es demasiado bajo para crear grupos. Mínimo: 3', 'karma ajustado < 3 no puede crear grupos'
);
select throws_ok(
  format($$ select public.join_lfg_post(%L) $$, (select id from public.lfg_posts where title = 'Duo ranked')),
  '42501', null, 'karma insuficiente no puede unirse'
);

-- ── Mensajería privada ───────────────────────────────────────
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select ok(
  (public.get_or_create_direct_conversation('c0000000-0000-0000-0000-00000000000c') ->> '_id') is not null,
  'A abre un chat directo con C'
);
select lives_ok(
  format($$ select public.send_message(%L, 'secreto') $$, (select conversation_id from public.conversation_participants where user_id = 'c0000000-0000-0000-0000-00000000000c' limit 1)),
  'A envía un mensaje'
);

-- Guarda el id del chat A↔C antes de cambiar a B (B no puede leerlo por RLS)
reset role;
select set_config('test.conv_id', (select id::text from public.conversations limit 1), true);
select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
set local role authenticated;
select is_empty(
  $$ select 1 from public.messages $$,
  'B no ve mensajes de conversaciones ajenas'
);
select throws_ok(
  $$ select public.send_message(current_setting('test.conv_id')::uuid, 'intruso') $$,
  'P0002', null, 'B no puede escribir en una conversación ajena'
);

-- ── Notificaciones privadas ──────────────────────────────────
reset role;
insert into public.notifications (recipient_id, sender_id, type, message)
values ('a0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000c', 'join_request', 'test');
select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
set local role authenticated;
select is(public.get_unread_notification_count(), 0, 'B no ve las notificaciones de A');

-- ── El puuid no sale en las respuestas de las RPC ────────────
reset role;
insert into public.riot_identities (user_id, puuid) values ('a0000000-0000-0000-0000-00000000000a', 'puuid-de-prueba-a')
  on conflict (user_id) do update set puuid = excluded.puuid;
select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
set local role authenticated;
select ok(
  not (public.user_json_by_id('a0000000-0000-0000-0000-00000000000a') ? 'puuid'),
  'user_json no expone el puuid'
);
select throws_ok($$ select count(*) from public.riot_identities $$, '42501', null, 'los PUUID no se leen desde la API');
select throws_ok($$ select puuid from public.profiles limit 1 $$, '42703', null, 'profiles ya no tiene la columna puuid');

-- ── Invitaciones a grupos LFG ────────────────────────────────
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select ok(
  (public.create_lfg_post('Con invitado', 3, null, null, 0, array['b0000000-0000-0000-0000-00000000000b']::uuid[]) ->> '_id') is not null,
  'A crea un grupo invitando a B'
);
select is(
  (select m.status::text from public.lfg_members m join public.lfg_posts p on p.id = m.post_id
   where p.title = 'Con invitado' and m.user_id = 'b0000000-0000-0000-0000-00000000000b'),
  'invited', 'B queda invitado, no aceptado'
);
select throws_ok(
  format($$ select public.handle_lfg_member(%L, 'b0000000-0000-0000-0000-00000000000b', 'accept') $$, (select id from public.lfg_posts where title = 'Con invitado')),
  'P0002', 'Solicitud no encontrada', 'el creador no puede aceptar a un invitado por él'
);
select ok(not public.played_together('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b'), 'un invitado no cuenta como haber jugado juntos');
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select is(
  (select count(*)::int from public.lfg_members where status = 'invited'),
  0, 'sin sesión no se ven las invitaciones leyendo la tabla'
);
set local role authenticated;
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');

select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
select lives_ok(
  format($$ select public.respond_lfg_invite(%L, true) $$, (select id from public.lfg_posts where title = 'Con invitado')),
  'B acepta la invitación'
);
select is(
  (select m.status::text from public.lfg_members m join public.lfg_posts p on p.id = m.post_id
   where p.title = 'Con invitado' and m.user_id = 'b0000000-0000-0000-0000-00000000000b'),
  'accepted', 'tras aceptar, B es miembro'
);
select ok(not public.played_together('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b'), 'recién aceptado aún no cuenta: hacen falta 15 minutos juntos');

-- 20 minutos después siguen juntos: el cron confirma la pareja
reset role;
update public.played_pairs set first_at = now() - interval '20 minutes'
where user_a = 'a0000000-0000-0000-0000-00000000000a' and user_b = 'b0000000-0000-0000-0000-00000000000b';
select public.confirm_played_pairs();
set local role authenticated;
select ok(public.played_together('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b'), 'tras 15 minutos juntos, A y B pueden valorarse');

-- ── Invitaciones a equipos ───────────────────────────────────
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select ok(
  (public.create_team(jsonb_build_object('name', 'Equipo Invitación', 'tag', 'INV', 'initialPlayers', jsonb_build_array('c0000000-0000-0000-0000-00000000000c'))) ->> '_id') is not null,
  'A crea un equipo invitando a C'
);
select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select lives_ok(
  format($$ select public.respond_team_invite(%L, true) $$, (select id from public.teams where name = 'Equipo Invitación')),
  'C acepta la invitación al equipo'
);
select is(
  (select count(*)::int from public.team_players tp join public.teams t on t.id = tp.team_id where t.name = 'Equipo Invitación'),
  2, 'C entra al equipo solo al aceptar'
);

-- ── Límites de frecuencia ────────────────────────────────────
select throws_ok(
  $$ select public.rl_check('x', 'y', 1, 60) $$,
  '42501', null, 'la API no puede llamar directamente a rl_check'
);
reset role;
select public.rl_check('test-key', 'test', 1, 60);
select throws_ok(
  $$ select public.rl_check('test-key', 'test', 1, 60) $$,
  'PT429', null, 'pasado el límite, rl_check corta con PT429'
);

-- El trigger de mensajes corta a partir del 21.º en un minuto
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
set local role authenticated;
select throws_ok(
  format(
    $$ select public.send_message(%L, 'spam') from generate_series(1, 25) $$,
    public.get_or_create_direct_conversation('c0000000-0000-0000-0000-00000000000c') ->> '_id'
  ),
  'PT429', null, 'más de 20 mensajes por minuto se cortan'
);

select * from finish();
rollback;
