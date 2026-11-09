-- ════════════════════════════════════════════════════════════
-- Tests de la aceptación de términos y privacidad (pgTAP)
-- Ejecutar: npm run db:test
-- ════════════════════════════════════════════════════════════
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, aud, role)
values ('f1000000-0000-0000-0000-00000000000f', 'terms@test.gg', 'authenticated', 'authenticated');
update public.profiles set riot_id = 'Terms#1', rank = 'Gold', role = 'Duelist', schedule = 'Evenings', onboarded = true
where id = 'f1000000-0000-0000-0000-00000000000f';

select set_config('request.jwt.claims', json_build_object('sub', 'f1000000-0000-0000-0000-00000000000f', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(public.get_me() ->> 'termsVersion', null, 'una cuenta anterior no ha aceptado ninguna versión');
select throws_ok(
  $$ select public.update_my_profile('{"schedule": "Weekends"}') $$,
  '42501', null, 'sin aceptar los términos no se puede escribir'
);
select throws_ok(
  $$ select public.accept_terms('2020-01-01') $$,
  'P0001', null, 'solo se acepta la versión vigente'
);
select lives_ok($$ select public.accept_terms('2026-11-09') $$, 'acepta la versión vigente');
select is(public.get_me() ->> 'termsVersion', '2026-11-09', 'get_me devuelve la versión aceptada');
select lives_ok($$ select public.accept_terms('2026-11-09') $$, 'aceptar dos veces no falla');
select throws_ok($$ select count(*) from public.consents $$, '42501', null, 'las aceptaciones no se leen desde la API');

select * from finish();
rollback;
