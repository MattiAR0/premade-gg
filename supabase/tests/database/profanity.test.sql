-- ════════════════════════════════════════════════════════════
-- Tests del filtro de palabras malsonantes (pgTAP)
-- Ejecutar: npm run db:test
-- ════════════════════════════════════════════════════════════
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- ── Detección ────────────────────────────────────────────────
select ok(public.has_profanity('Eres un PUTO manco'), 'detecta mayúsculas');
select ok(public.has_profanity('vaya mi3rd4 de partida'), 'detecta sustituciones por números');
select ok(public.has_profanity('puuuuta suerte'), 'detecta letras repetidas');
select ok(public.has_profanity('qué MIÉRDA'), 'detecta palabras con tilde');
select ok(public.has_profanity('what the fuck'), 'detecta palabras en inglés');
select ok(not public.has_profanity('Computadora nueva, disputa del as de picas'), 'no marca palabras que solo contienen una malsonante');
select ok(not public.has_profanity(null), 'null no es malsonante');
select ok(not public.has_profanity('Tengo 455 horas y voy 13-5'), 'los números sueltos no se leen como letras');
select ok(public.has_profanity('qué coño'), 'detecta palabras con ñ');

-- ── Censura ──────────────────────────────────────────────────
select is(public.censor_profanity('Vaya mierda de partida'), 'Vaya ****** de partida', 'censura con un asterisco por letra');
select is(public.censor_profanity('Que PUUUTO lag, joder'), 'Que ****** lag, *****', 'censura varias palabras y respeta el resto');
select is(public.censor_profanity('Duo para subir a Oro'), 'Duo para subir a Oro', 'un texto limpio no cambia');
select is(
  length(public.censor_profanity(left(repeat('fuck mierda ', 170), 2000))), 2000,
  'un mensaje largo lleno de palabrotas se censura entero'
);

-- ── Fixtures ─────────────────────────────────────────────────
insert into auth.users (id, email, aud, role)
values
  ('a0000000-0000-0000-0000-00000000000a', 'a@test.gg', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@test.gg', 'authenticated', 'authenticated');

update public.profiles set riot_id = 'A#1', rank = 'Gold', role = 'Duelist', schedule = 'Evenings', onboarded = true
where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set riot_id = 'B#1', rank = 'Gold', role = 'Flex', schedule = 'Evenings', onboarded = true
where id = 'b0000000-0000-0000-0000-00000000000b';

create function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
set local role authenticated;

-- ── Bloqueo: biografía ───────────────────────────────────────
select throws_ok(
  $$ select public.update_my_profile('{"bio": "Soy un cabrón"}') $$,
  '23514', 'Tu biografía contiene palabras malsonantes. Cámbiala para poder guardar el perfil.',
  'una biografía con palabras malsonantes no se guarda'
);
select is(
  (public.update_my_profile('{"bio": "Main Jett", "lftDetails": "Busco equipo, nada de gilipollas"}') ->> 'lftDetails'),
  'Busco equipo, nada de **********', 'los detalles LFT se censuran en vez de bloquear'
);

-- Una biografía antigua (anterior al filtro) no impide guardar otros campos
reset role;
set local session_replication_role = replica; -- sin triggers, como un dato de antes de la migración
update public.profiles set bio = 'texto viejo con mierda' where id = 'a0000000-0000-0000-0000-00000000000a';
set local session_replication_role = origin;
set local role authenticated;
select lives_ok(
  $$ select public.update_my_profile('{"schedule": "Weekends"}') $$,
  'una biografía antigua no bloquea el resto del perfil'
);

-- ── Bloqueo: comentario de valoración ────────────────────────
-- Solo se valora a quien coincidió contigo: A y B estuvieron en un grupo
reset role;
insert into public.played_pairs (user_a, user_b, source, confirmed_at) values ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b', 'lfg', now());
set local role authenticated;
select throws_ok(
  $$ select public.create_review('b0000000-0000-0000-0000-00000000000b', 1, 'menudo imbécil') $$,
  '23514', 'Tu comentario contiene palabras malsonantes. Cámbialo para poder publicar la valoración.',
  'un comentario con palabras malsonantes no se publica'
);
select lives_ok(
  $$ select public.create_review('b0000000-0000-0000-0000-00000000000b', 4, 'Buen compañero') $$,
  'un comentario limpio se publica'
);

-- ── Censura: grupos LFG ──────────────────────────────────────
select is(
  (public.create_lfg_post('Duo sin pendejos', 2, 'Nada de shit talk') ->> 'title'),
  'Duo sin ********', 'el título del grupo se censura'
);
select is(
  (select description from public.lfg_posts where title = 'Duo sin ********'),
  'Nada de **** talk', 'la descripción del grupo se censura'
);
select is(
  (public.update_lfg_post((select id from public.lfg_posts where title = 'Duo sin ********'), '{"title": "Trío, f u c k no, fuck sí"}') ->> 'title'),
  'Trío, f u c k no, **** sí', 'editar el grupo también censura'
);

-- ── Equipos: el nombre se bloquea, la descripción se censura ──
select throws_ok(
  $$ select public.create_team('{"name": "Los Cabrones", "tag": "LCB"}') $$,
  '23514', 'El nombre del equipo contiene palabras malsonantes. Elige otro.',
  'un nombre de equipo con palabras malsonantes no se guarda'
);
select is(
  (public.create_team('{"name": "Los Tranquilos", "tag": "LTQ", "description": "Sin mierdas"}') ->> 'description'),
  'Sin *******', 'la descripción del equipo se censura'
);

-- ── Censura: mensajes ────────────────────────────────────────
select is(
  (public.send_message(
    (public.get_or_create_direct_conversation('b0000000-0000-0000-0000-00000000000b') ->> '_id')::uuid,
    'gg, eres un crack hijueputa'
  ) ->> 'content'),
  'gg, eres un crack *********', 'el mensaje se censura'
);
select is(
  (select last_message_content from public.conversations
    where id = (public.get_or_create_direct_conversation('b0000000-0000-0000-0000-00000000000b') ->> '_id')::uuid),
  'gg, eres un crack *********', 'la vista previa de la conversación también se censura'
);

-- ── Las funciones auxiliares no se exponen por la API ────────
select throws_ok(
  $$ select public.profanity_pattern() $$,
  '42501', null, 'un usuario no puede leer la lista de palabras'
);

select * from finish();
rollback;
