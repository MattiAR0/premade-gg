-- ════════════════════════════════════════════════════════════
-- Aceptación de los términos de uso y la política de privacidad.
--
-- Se guarda qué versión aceptó cada usuario y cuándo, como prueba
-- (el contrato se acepta al vincular el Riot ID, que es cuando la
-- cuenta empieza a publicar; las cuentas anteriores la aceptan con
-- un aviso al entrar). Junto con la aceptación, el usuario declara
-- tener la edad mínima (16 años).
--
-- Sin aceptar la versión vigente no se puede escribir: lo comprueba
-- assert_not_suspended, que ya llaman todos los triggers de escritura.
-- ════════════════════════════════════════════════════════════

-- Versión vigente. Debe coincidir con supabase/functions/_shared/legal.ts
-- y con LEGAL.termsVersion del cliente.
create function public.current_terms_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-11-07'::text; $$;

create table public.consents (
  user_id uuid not null references public.profiles (id) on delete cascade,
  document text not null check (document in ('terms_privacy')),
  version text not null check (char_length(version) between 1 and 20),
  accepted_at timestamptz not null default now(),
  primary key (user_id, document, version)
);

alter table public.consents enable row level security;
revoke all on public.consents from anon, authenticated;

-- Última versión aceptada por el usuario actual
create function public.my_terms_version()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select version from public.consents
  where user_id = (select auth.uid()) and document = 'terms_privacy'
  order by accepted_at desc
  limit 1;
$$;

-- Aceptar la versión vigente (cuentas creadas antes de que existieran los textos)
create function public.accept_terms(p_version text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  if p_version is distinct from public.current_terms_version() then
    raise exception 'Esa no es la versión vigente de los términos. Recarga la página e inténtalo de nuevo.';
  end if;
  insert into public.consents (user_id, document, version)
  values (v_uid, 'terms_privacy', p_version)
  on conflict do nothing;
  return jsonb_build_object('message', 'Gracias. Has aceptado los términos y la política de privacidad.');
end;
$$;

create or replace function public.get_me()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.user_json(p) || jsonb_build_object(
    'email', auth.jwt() ->> 'email',
    'isModerator', public.is_moderator(),
    'suspendedUntil', public.my_suspended_until(),
    'termsVersion', public.my_terms_version()
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

-- Escribir exige no estar suspendido y haber aceptado la versión vigente.
-- (Misma función que en 20261107000002, con la comprobación de la aceptación.)
create or replace function public.assert_not_suspended()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_until timestamptz;
begin
  select until into v_until from public.suspensions where user_id = v_uid and until > now();
  if v_until is not null then
    raise exception 'Tu cuenta está suspendida hasta el %. Puedes ver la decisión y recurrirla en Ajustes de cuenta.',
      to_char(v_until at time zone 'Europe/Madrid', 'DD/MM/YYYY HH24:MI')
      using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles where id = v_uid and onboarded)
     and not exists (
       select 1 from public.consents
       where user_id = v_uid and document = 'terms_privacy' and version = public.current_terms_version()
     ) then
    raise exception 'Para seguir usando PremadeGG acepta los términos de uso y la política de privacidad (aviso de arriba).'
      using errcode = '42501';
  end if;
end;
$$;
