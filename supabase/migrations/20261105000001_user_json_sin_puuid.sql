-- El puuid deja de salir en user_json, que es lo que devuelven todas las RPC de lectura
-- (perfiles, grupos, equipos, mensajes). El cliente no lo usa y es el identificador de Riot
-- del jugador.
--
-- Ojo: la columna profiles.puuid sigue siendo legible con un select directo a la tabla
-- (política "profiles are public"). No se puede revocar solo esa columna porque las RPC de
-- lectura son security invoker y usan la fila entera (user_json(p)). El arreglo completo es
-- mover el puuid a una tabla privada; queda para la fase 2 junto con la lista de bloqueo.

create or replace function public.user_json(p public.profiles)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    '_id', p.id,
    'riotId', p.riot_id,
    'region', p.region,
    'rank', p.rank,
    'role', p.role,
    'roles', to_jsonb(p.roles),
    'schedule', p.schedule,
    'karma', p.karma,
    'reviewCount', p.review_count,
    'trustKarma', p.trust_karma,
    'accountLevel', p.account_level,
    'cardImage', p.card_image,
    'lastRankUpdate', p.last_rank_update,
    'bio', p.bio,
    'profileImage', p.profile_image,
    'profileImageType', p.profile_image_type,
    'favoriteAgents', to_jsonb(p.favorite_agents),
    'favoriteRole', p.favorite_role,
    'socialLinks', p.social_links,
    'availability', p.availability,
    'lookingForTeam', p.looking_for_team,
    'lftDetails', p.lft_details,
    'isCoach', p.is_coach,
    'coachDetails', p.coach_details,
    'onboarded', p.onboarded,
    'createdAt', p.created_at
  );
$$;
