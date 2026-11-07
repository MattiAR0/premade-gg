-- ════════════════════════════════════════════════════════════
-- Tests de denuncias, moderación, recurso y bloqueos (pgTAP)
-- Ejecutar: npm run db:test
-- ════════════════════════════════════════════════════════════
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- ── Fixtures: A (denunciante), B (denunciado), M (moderador) ──
insert into auth.users (id, email, aud, role)
values
  ('a1000000-0000-0000-0000-00000000000a', 'mod-a@test.gg', 'authenticated', 'authenticated'),
  ('b1000000-0000-0000-0000-00000000000b', 'mod-b@test.gg', 'authenticated', 'authenticated'),
  ('e1000000-0000-0000-0000-00000000000e', 'mod-m@test.gg', 'authenticated', 'authenticated');

update public.profiles set riot_id = 'ModA#1', rank = 'Gold', role = 'Duelist', schedule = 'Evenings', onboarded = true
where id = 'a1000000-0000-0000-0000-00000000000a';
update public.profiles set riot_id = 'ModB#1', rank = 'Gold', role = 'Sentinel', schedule = 'Evenings', onboarded = true, bio = 'Texto denunciado'
where id = 'b1000000-0000-0000-0000-00000000000b';
update public.profiles set riot_id = 'ModM#1', rank = 'Gold', role = 'Controller', schedule = 'Evenings', onboarded = true
where id = 'e1000000-0000-0000-0000-00000000000e';
insert into public.moderators (user_id) values ('e1000000-0000-0000-0000-00000000000e');

-- Han aceptado los términos vigentes (sin eso no se puede escribir)
insert into public.consents (user_id, document, version)
select id, 'terms_privacy', public.current_terms_version() from public.profiles
on conflict do nothing;

create function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- ── Denunciar ────────────────────────────────────────────────
select pg_temp.login('a1000000-0000-0000-0000-00000000000a');
set local role authenticated;

select lives_ok(
  $$ select public.create_report('profile', 'b1000000-0000-0000-0000-00000000000b', 'harassment', 'Me insulta') $$,
  'A denuncia el perfil de B'
);
select throws_ok(
  $$ select public.create_report('profile', 'b1000000-0000-0000-0000-00000000000b', 'spam') $$,
  '23505', null, 'no se puede denunciar dos veces lo mismo mientras está abierto'
);
select throws_ok(
  $$ select public.create_report('profile', 'a1000000-0000-0000-0000-00000000000a', 'spam') $$,
  'P0001', 'No puedes denunciar tu propio contenido', 'no se puede denunciar lo propio'
);
select throws_ok(
  $$ select public.create_report('profile', 'b1000000-0000-0000-0000-00000000000b', 'inventado') $$,
  'P0001', null, 'el motivo tiene que ser de la lista'
);
select throws_ok(
  $$ select count(*) from public.reports $$,
  '42501', null, 'la tabla de denuncias no se lee desde la API'
);
select throws_ok(
  $$ select public.get_reports() $$,
  '42501', null, 'quien no modera no ve la cola'
);

-- ── Resolver ─────────────────────────────────────────────────
select pg_temp.login('e1000000-0000-0000-0000-00000000000e');
select is(jsonb_array_length(public.get_reports()), 1, 'el moderador ve la denuncia abierta');
select is(
  (public.get_reports() -> 0 ->> 'snapshot') like '%Texto denunciado%', true,
  'la denuncia guarda una copia del contenido'
);
select throws_ok(
  format($$ select public.resolve_report(%L, false, 7, 'corto') $$, public.get_reports() -> 0 ->> '_id'),
  'P0001', null, 'la decisión necesita un motivo'
);
select lives_ok(
  format($$ select public.resolve_report(%L, true, 7, 'Insultos repetidos en la biografía') $$, public.get_reports() -> 0 ->> '_id'),
  'el moderador retira el contenido y suspende 7 días'
);

reset role;
select ok(
  (select until > now() + interval '6 days' from public.suspensions where user_id = 'b1000000-0000-0000-0000-00000000000b'),
  'B queda suspendido'
);
select is(
  (select sender_id from public.notifications where recipient_id = 'b1000000-0000-0000-0000-00000000000b' and type = 'moderation_notice'),
  null, 'el aviso al afectado no identifica al moderador'
);
select is(
  (select bio from public.profiles where id = 'b1000000-0000-0000-0000-00000000000b'), '',
  'la biografía denunciada se retira'
);
select is(
  (select count(*)::int from public.notifications where recipient_id = 'a1000000-0000-0000-0000-00000000000a' and type = 'report_update'),
  1, 'el denunciante recibe el resultado'
);
select is(
  (select count(*)::int from public.notifications where recipient_id = 'b1000000-0000-0000-0000-00000000000b' and type = 'moderation_notice'),
  1, 'el afectado recibe la decisión motivada'
);

-- ── El suspendido no escribe, pero puede recurrir ────────────
select pg_temp.login('b1000000-0000-0000-0000-00000000000b');
set local role authenticated;
select throws_ok(
  $$ select public.update_my_profile('{"schedule": "Weekends"}') $$,
  '42501', null, 'una cuenta suspendida no puede escribir'
);
select is(
  (public.get_moderation_decision((select report_id from public.notifications where type = 'moderation_notice' limit 1)) ->> 'canAppeal'),
  'true', 'el afectado ve la decisión y puede recurrir'
);
select lives_ok(
  $$ select public.appeal_report((select report_id from public.notifications where type = 'moderation_notice' limit 1), 'No insulté, era una broma entre amigos') $$,
  'el afectado recurre'
);

select pg_temp.login('e1000000-0000-0000-0000-00000000000e');
select lives_ok(
  $$ select public.resolve_appeal((select (public.get_reports('appeals') -> 0 ->> '_id')::uuid), true, 'Revisado: no hay insultos claros') $$,
  'el moderador revoca la decisión'
);
reset role;
select ok(
  not exists (select 1 from public.suspensions where user_id = 'b1000000-0000-0000-0000-00000000000b'),
  'al revocar se levanta la suspensión'
);
set local role anon;
select throws_ok(
  $$ select count(*) from public.suspensions $$,
  '42501', null, 'las suspensiones no se leen desde la API'
);
reset role;

-- ── Bloqueos ─────────────────────────────────────────────────
select pg_temp.login('a1000000-0000-0000-0000-00000000000a');
set local role authenticated;
select public.set_block('b1000000-0000-0000-0000-00000000000b', true);
select is(
  (public.get_block_status('b1000000-0000-0000-0000-00000000000b') ->> 'blockedByMe'), 'true',
  'A ve que ha bloqueado a B'
);

select pg_temp.login('b1000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$ select public.get_or_create_direct_conversation('a1000000-0000-0000-0000-00000000000a') $$,
  '42501', 'No se ha podido completar la acción.', 'B no puede abrir un chat con quien le ha bloqueado (error genérico)'
);
select is(
  (public.get_block_status('a1000000-0000-0000-0000-00000000000a') ->> 'blockedByMe'), 'false',
  'B no sabe que A le ha bloqueado'
);

-- Un moderador no resuelve lo que ha denunciado él
select pg_temp.login('e1000000-0000-0000-0000-00000000000e');
select public.create_report('profile', 'a1000000-0000-0000-0000-00000000000a', 'spam', 'Prueba');
reset role;
insert into public.moderators (user_id) values ('a1000000-0000-0000-0000-00000000000a');
select pg_temp.login('a1000000-0000-0000-0000-00000000000a');
set local role authenticated;
select is(jsonb_array_length(public.get_reports()), 0, 'un moderador no ve las denuncias contra él');

select * from finish();
rollback;
