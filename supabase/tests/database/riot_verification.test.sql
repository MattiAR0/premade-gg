-- ════════════════════════════════════════════════════════════
-- Tests de la verificación del Riot ID y del historial de cuentas borradas (pgTAP)
-- Ejecutar: npm run db:test
-- ════════════════════════════════════════════════════════════
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

-- A: tiene el Riot ID sin verificar · B y D: valoran · C: vuelve con el Riot ID de B
-- V: verificado · M: moderador · G: buen karma, se borra
insert into auth.users (id, email, aud, role) values
  ('a2000000-0000-0000-0000-00000000000a', 'holder@test.gg', 'authenticated', 'authenticated'),
  ('b2000000-0000-0000-0000-00000000000b', 'rater@test.gg', 'authenticated', 'authenticated'),
  ('d2000000-0000-0000-0000-00000000000d', 'rater2@test.gg', 'authenticated', 'authenticated'),
  ('c2000000-0000-0000-0000-00000000000c', 'claimer@test.gg', 'authenticated', 'authenticated'),
  ('e2000000-0000-0000-0000-00000000000e', 'verified@test.gg', 'authenticated', 'authenticated'),
  ('f2000000-0000-0000-0000-00000000000f', 'mod@test.gg', 'authenticated', 'authenticated'),
  ('92000000-0000-0000-0000-000000000009', 'good@test.gg', 'authenticated', 'authenticated');
update public.profiles set riot_id = 'Holder#1', rank = 'Gold', role = 'Duelist', schedule = 'Evenings',
  onboarded = true, looking_for_team = true, card_image = 'https://media.valorant-api.com/x.png', account_level = 50
where id = 'a2000000-0000-0000-0000-00000000000a';
update public.profiles set riot_id = 'Rater#1', rank = 'Gold', role = 'Duelist', schedule = 'Evenings', onboarded = true
where id = 'b2000000-0000-0000-0000-00000000000b';
update public.profiles set riot_id = 'Rater#2', rank = 'Gold', role = 'Duelist', schedule = 'Evenings', onboarded = true
where id = 'd2000000-0000-0000-0000-00000000000d';
update public.profiles set riot_id = 'Verified#1', rank = 'Gold', role = 'Duelist', schedule = 'Evenings',
  onboarded = true, riot_verified_at = now()
where id = 'e2000000-0000-0000-0000-00000000000e';
update public.profiles set riot_id = 'Mod#1', rank = 'Gold', role = 'Duelist', schedule = 'Evenings', onboarded = true
where id = 'f2000000-0000-0000-0000-00000000000f';
update public.profiles set riot_id = 'Good#1', rank = 'Gold', role = 'Duelist', schedule = 'Evenings', onboarded = true
where id = '92000000-0000-0000-0000-000000000009';
-- El PUUID va en riot_identities (privada)
insert into public.riot_identities (user_id, puuid) values
  ('a2000000-0000-0000-0000-00000000000a', 'puuid-holder'),
  ('b2000000-0000-0000-0000-00000000000b', 'puuid-rater'),
  ('d2000000-0000-0000-0000-00000000000d', 'puuid-rater2'),
  ('e2000000-0000-0000-0000-00000000000e', 'puuid-verified'),
  ('f2000000-0000-0000-0000-00000000000f', 'puuid-mod'),
  ('92000000-0000-0000-0000-000000000009', 'puuid-good');
insert into public.moderators (user_id) values ('f2000000-0000-0000-0000-00000000000f');
insert into public.consents (user_id, document, version)
select id, 'terms_privacy', public.current_terms_version() from public.profiles
where id in ('f2000000-0000-0000-0000-00000000000f');

-- ── user_json ──
select is((public.user_json_by_id('a2000000-0000-0000-0000-00000000000a') ->> 'riotVerified')::boolean, false, 'sin verificar: riotVerified false');
select is((public.user_json_by_id('e2000000-0000-0000-0000-00000000000e') ->> 'riotVerified')::boolean, true, 'verificado: riotVerified true');

-- ── Quitar un Riot ID sin verificar ──
insert into public.lfg_posts (author_id, title, team_size)
values ('a2000000-0000-0000-0000-00000000000a', 'Grupo de prueba', 2);
select is(
  (select count(*)::int from public.lfg_posts where author_id = 'a2000000-0000-0000-0000-00000000000a' and status = 'open'),
  1, 'tiene un grupo LFG abierto'
);

select lives_ok(
  $$ select public.release_unverified_riot_id('a2000000-0000-0000-0000-00000000000a', 'Holder#1', 'puuid-holder') $$,
  'se puede quitar un Riot ID sin verificar'
);
select ok(
  (select riot_id is null and not onboarded and not looking_for_team and card_image is null and account_level is null
   from public.profiles where id = 'a2000000-0000-0000-0000-00000000000a')
  and not exists (select 1 from public.riot_identities where user_id = 'a2000000-0000-0000-0000-00000000000a'),
  'la cuenta que lo tenía vuelve al onboarding sin Riot ID ni datos de esa cuenta de Riot'
);
select is(
  (select count(*)::int from public.lfg_posts where author_id = 'a2000000-0000-0000-0000-00000000000a' and status <> 'closed'),
  0, 'sus grupos LFG quedan cerrados'
);
select is(
  (select count(*)::int from public.notifications where recipient_id = 'a2000000-0000-0000-0000-00000000000a' and type = 'riot_id_claimed'),
  1, 'y recibe un aviso'
);
select lives_ok(
  $$ select public.release_unverified_riot_id('a2000000-0000-0000-0000-00000000000a', 'Holder#1', 'puuid-holder') $$,
  'repetirlo no falla'
);
select is(
  (select count(*)::int from public.notifications where recipient_id = 'a2000000-0000-0000-0000-00000000000a' and type = 'riot_id_claimed'),
  1, 'ni avisa dos veces'
);
select throws_ok(
  $$ select public.release_unverified_riot_id('e2000000-0000-0000-0000-00000000000e', 'Verified#1', 'puuid-verified') $$,
  'P0001', null, 'un Riot ID verificado no se puede quitar'
);

-- ── Historial al borrar la cuenta ──
-- B recibe un 1 y un 2 (media 1,5) y tiene una suspensión vigente
insert into public.reputations (author_id, target_id, rating) values
  ('a2000000-0000-0000-0000-00000000000a', 'b2000000-0000-0000-0000-00000000000b', 1),
  ('d2000000-0000-0000-0000-00000000000d', 'b2000000-0000-0000-0000-00000000000b', 2);
insert into public.suspensions (user_id, until) values ('b2000000-0000-0000-0000-00000000000b', now() + interval '10 days');
delete from auth.users where id = 'b2000000-0000-0000-0000-00000000000b';

select ok(
  exists (
    select 1 from public.riot_account_history
    where puuid_hash = public.puuid_hash('puuid-rater') and rating_sum = 3 and rating_count = 2
      and suspended_until > now() and expires_at > now() + interval '89 days'
  ),
  'al borrar la cuenta se guardan las valoraciones y la suspensión durante 90 días'
);
select ok(
  public.puuid_hash('puuid-rater') <> encode(sha256(convert_to('puuid-rater', 'UTF8')), 'hex')
    and not exists (select 1 from public.riot_account_history where puuid_hash like '%puuid-rater%'),
  'no se guarda el PUUID en claro y el hash lleva clave secreta'
);

-- Una cuenta sin valoraciones ni suspensión no deja historial
delete from auth.users where id = 'a2000000-0000-0000-0000-00000000000a';
select is((select count(*)::int from public.riot_account_history), 1, 'sin valoraciones ni suspensión no se guarda nada');

-- ── Restaurar al volver con el mismo Riot ID ──
update public.profiles set riot_id = 'Rater#1', rank = 'Gold', role = 'Duelist', schedule = 'Evenings', onboarded = true
where id = 'c2000000-0000-0000-0000-00000000000c';

select is(
  public.restore_riot_account('c2000000-0000-0000-0000-00000000000c', 'puuid-rater', true),
  true, 'quien vuelve recupera el historial aunque esta vez lo verifique'
);
select is((select count(*)::int from public.riot_account_history), 0, 'el historial se consume al restaurarlo');
select ok(
  (select karma = 1.5 and review_count = 2 and karma_carry_sum = 3 and karma_carry_count = 2
   from public.profiles where id = 'c2000000-0000-0000-0000-00000000000c'),
  'hereda el karma y el número de valoraciones'
);
select ok(
  exists (
    select 1 from public.suspensions
    where user_id = 'c2000000-0000-0000-0000-00000000000c' and until > now() + interval '9 days' and carried_until = until
  ),
  'y la suspensión vigente, marcada como heredada'
);
select is(
  (select count(*)::int from public.notifications where recipient_id = 'c2000000-0000-0000-0000-00000000000c' and type = 'riot_history_restored'),
  1, 'y recibe un aviso de lo que ha recuperado'
);

-- Una valoración nueva se suma a las heredadas: (1 + 2 + 5) / 3 = 2,7
insert into public.reputations (author_id, target_id, rating)
values ('d2000000-0000-0000-0000-00000000000d', 'c2000000-0000-0000-0000-00000000000c', 5);
select ok(
  (select karma = 2.7 and review_count = 3 from public.profiles where id = 'c2000000-0000-0000-0000-00000000000c'),
  'las valoraciones nuevas cuentan junto a las heredadas'
);
delete from public.reputations where target_id = 'c2000000-0000-0000-0000-00000000000c';
select ok(
  (select karma = 1.5 and review_count = 2 from public.profiles where id = 'c2000000-0000-0000-0000-00000000000c'),
  'al borrar una valoración las heredadas se mantienen'
);

-- Revocar un recurso no borra la suspensión heredada
insert into public.reports (id, reporter_id, target_type, target_id, target_user_id, reason, status, suspended_until, appeal_status, resolved_at)
values ('77000000-0000-0000-0000-000000000007', 'd2000000-0000-0000-0000-00000000000d', 'profile', 'c2000000-0000-0000-0000-00000000000c',
  'c2000000-0000-0000-0000-00000000000c', 'harassment', 'actioned', now() + interval '20 days', 'pending', now());
update public.suspensions set until = now() + interval '20 days' where user_id = 'c2000000-0000-0000-0000-00000000000c';

select set_config('request.jwt.claims', json_build_object('sub', 'f2000000-0000-0000-0000-00000000000f', 'role', 'authenticated')::text, true);
select lives_ok(
  $$ select public.resolve_appeal('77000000-0000-0000-0000-000000000007', true, 'Revocada en el test') $$,
  'el moderador revoca la decisión'
);
select ok(
  exists (
    select 1 from public.suspensions
    where user_id = 'c2000000-0000-0000-0000-00000000000c' and until = carried_until and until > now() + interval '9 days'
      and until < now() + interval '11 days'
  ),
  'al revocar un recurso se mantiene la suspensión heredada'
);
select set_config('request.jwt.claims', '', true);

-- ── Karma bueno: solo lo hereda quien verifica ──
insert into public.reputations (author_id, target_id, rating) values
  ('d2000000-0000-0000-0000-00000000000d', '92000000-0000-0000-0000-000000000009', 5),
  ('e2000000-0000-0000-0000-00000000000e', '92000000-0000-0000-0000-000000000009', 5);
delete from auth.users where id = '92000000-0000-0000-0000-000000000009';
select is(
  public.restore_riot_account('d2000000-0000-0000-0000-00000000000d', 'puuid-good', false),
  false, 'sin verificar no se hereda el karma bueno de otro'
);
select is(
  (select count(*)::int from public.riot_account_history where puuid_hash = public.puuid_hash('puuid-good')),
  1, 'y el historial se queda para el dueño'
);
select is(
  public.restore_riot_account('e2000000-0000-0000-0000-00000000000e', 'puuid-good', true),
  true, 'quien verifica sí lo hereda'
);

-- Historial caducado: no se restaura
insert into public.riot_account_history (puuid_hash, rating_sum, rating_count, expires_at)
values (public.puuid_hash('puuid-old'), 1, 1, now() - interval '1 day');
select is(
  public.restore_riot_account('d2000000-0000-0000-0000-00000000000d', 'puuid-old', false),
  false, 'un historial de más de 90 días no se restaura'
);

-- ── Desvincular el Riot ID propio ──
insert into public.reputations (author_id, target_id, rating)
values ('d2000000-0000-0000-0000-00000000000d', 'f2000000-0000-0000-0000-00000000000f', 1);
select set_config('request.jwt.claims', json_build_object('sub', 'f2000000-0000-0000-0000-00000000000f', 'role', 'authenticated')::text, true);
set local role authenticated;
select lives_ok($$ select public.unlink_my_riot_account() $$, 'el jugador desvincula su Riot ID');
select throws_ok($$ select public.unlink_my_riot_account() $$, 'P0002', null, 'sin Riot ID vinculado no se puede desvincular');
reset role;
select ok(
  (select riot_id is null and not onboarded and riot_verified_at is null and rank is null and card_image is null
   from public.profiles where id = 'f2000000-0000-0000-0000-00000000000f'),
  'se borran el Riot ID y los datos de Riot del perfil'
);
select ok(
  not exists (select 1 from public.riot_identities where user_id = 'f2000000-0000-0000-0000-00000000000f')
  and exists (
    select 1 from public.riot_identity_hashes
    where user_id = 'f2000000-0000-0000-0000-00000000000f' and puuid_hash = public.puuid_hash('puuid-mod')
      and until > now() + interval '89 days'
  ),
  'el PUUID se borra y solo queda su hash 90 días'
);
select ok(
  (select karma = 1 and review_count = 1 from public.profiles where id = 'f2000000-0000-0000-0000-00000000000f'),
  'la cuenta conserva su karma'
);

-- Vincula otro Riot ID y borra la cuenta: el historial se guarda con los dos
select lives_ok(
  $$ select public.link_riot_account('f2000000-0000-0000-0000-00000000000f', 'puuid-mod-2', 'ModDos#1', 'eu', 'Gold', 'Duelist', 'Evenings', 10, null) $$,
  'vincula otro Riot ID después de desvincular'
);
delete from auth.users where id = 'f2000000-0000-0000-0000-00000000000f';
select is(
  (select count(*)::int from public.riot_account_history
   where puuid_hash in (public.puuid_hash('puuid-mod'), public.puuid_hash('puuid-mod-2')) and rating_count = 1),
  2, 'desvincular, vincular otro y borrar la cuenta no limpia el karma de ninguno'
);

-- ── Vincular en una sola transacción ──
-- V (verificado) intenta quedarse el Riot ID de D (sin verificar) sin superar el reto
select throws_ok(
  $$ select public.link_riot_account('e2000000-0000-0000-0000-00000000000e', 'puuid-rater2', 'Rater#2', 'eu', 'Gold', 'Duelist', 'Evenings', 10, null) $$,
  'P0001', 'Este Riot ID ya está registrado por otra cuenta. Si es tuyo, demuéstralo con tu tarjeta de jugador y lo recuperas.',
  'sin reto superado no se quita el Riot ID a otra cuenta'
);
select ok(
  (select puuid = 'puuid-verified' from public.riot_identities where user_id = 'e2000000-0000-0000-0000-00000000000e')
  and (select puuid = 'puuid-rater2' from public.riot_identities where user_id = 'd2000000-0000-0000-0000-00000000000d'),
  'y no se toca nada'
);
-- Con el reto superado, V se lo queda y su Riot ID anterior se recuerda 90 días
insert into public.riot_challenges (user_id, puuid, riot_id, region, baseline_card, verified_at)
values ('e2000000-0000-0000-0000-00000000000e', 'puuid-rater2', 'Rater#2', 'eu', '9fb348bc-41a0-91ad-8a3e-818035c4e561', now());
select is(
  (public.link_riot_account('e2000000-0000-0000-0000-00000000000e', 'puuid-rater2', 'Rater#2', 'eu', 'Gold', 'Duelist', 'Evenings', 10, null) ->> 'verified')::boolean,
  true, 'con el reto superado se queda el Riot ID, verificado'
);
select ok(
  (select riot_id is null and not onboarded from public.profiles where id = 'd2000000-0000-0000-0000-00000000000d')
  and not exists (select 1 from public.riot_identities where user_id = 'd2000000-0000-0000-0000-00000000000d')
  and exists (select 1 from public.riot_identity_hashes where user_id = 'e2000000-0000-0000-0000-00000000000e' and puuid_hash = public.puuid_hash('puuid-verified'))
  and not exists (select 1 from public.riot_challenges where user_id = 'e2000000-0000-0000-0000-00000000000e'),
  'la otra cuenta lo pierde, el Riot ID anterior queda como hash y el reto se borra'
);

-- ── Desde la API ──
select set_config('request.jwt.claims', json_build_object('sub', 'd2000000-0000-0000-0000-00000000000d', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok($$ select count(*) from public.riot_challenges $$, '42501', null, 'los retos no se leen desde la API');
select throws_ok($$ select count(*) from public.riot_account_history $$, '42501', null, 'el historial no se lee desde la API');
select throws_ok($$ select count(*) from public.app_secrets $$, '42501', null, 'la clave del hash no se lee desde la API');
select throws_ok($$ select count(*) from public.riot_identities $$, '42501', null, 'los PUUID no se leen desde la API');
select throws_ok($$ select count(*) from public.riot_identity_hashes $$, '42501', null, 'los hashes de Riot ID anteriores no se leen desde la API');
select throws_ok(
  $$ select public.release_unverified_riot_id('e2000000-0000-0000-0000-00000000000e', 'x', 'y') $$,
  '42501', null, 'quitar un Riot ID solo lo hace el servidor'
);
select throws_ok(
  $$ select public.restore_riot_account('d2000000-0000-0000-0000-00000000000d', 'puuid-rater', false) $$,
  '42501', null, 'restaurar el historial solo lo hace el servidor'
);

select * from finish();
rollback;
