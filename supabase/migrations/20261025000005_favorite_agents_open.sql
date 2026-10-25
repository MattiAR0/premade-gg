-- ════════════════════════════════════════════════════════════
-- Agentes favoritos sin lista cerrada.
-- El CHECK de profiles.favorite_agents enumeraba los 28 agentes de
-- 2026-10-24, así que un agente nuevo (Miks) no se podía guardar.
-- El cliente saca los agentes de valorant-api.com: aquí solo se
-- comprueba el tope de 3 y que cada nombre tenga un formato razonable.
-- ════════════════════════════════════════════════════════════

-- Cada nombre: 1–24 caracteres de letras, cifras, espacio, punto, barra, apóstrofo o guion ("KAY/O")
create function public.valid_agent_names(p_names text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(n ~ '^[A-Za-z0-9 ./''-]{1,24}$'), true)
  from unnest(p_names) as n;
$$;

alter table public.profiles
  drop constraint profiles_favorite_agents_check;

alter table public.profiles
  add constraint profiles_favorite_agents_check check (
    cardinality(favorite_agents) <= 3
    and public.valid_agent_names(favorite_agents)
  );
