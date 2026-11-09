-- Versión nueva de los términos y la política de privacidad (2026-11-09): verificación del Riot ID,
-- pérdida de un Riot ID sin verificar y karma que se conserva 90 días al borrar la cuenta
-- (ver 20261109000002_verificacion_riot_id.sql). Es un cambio importante, así que todas las
-- cuentas tienen que volver a aceptar (aviso de arriba en la web).
-- Sin los 15 días de aviso de los términos por decisión del titular: los únicos usuarios son
-- personas conocidas y el producto aún no está lanzado (ver CAMBIOS.md).
-- Debe coincidir con LEGAL.termsVersion (client/src/app/legal/legal-info.ts) y con
-- TERMS_VERSION (supabase/functions/_shared/legal.ts).
create or replace function public.current_terms_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-11-09'::text; $$;
