-- ════════════════════════════════════════════════════════════
-- Varios roles por jugador.
-- profiles.role (un solo rol) se queda como rol principal = roles[1],
-- para no romper equipos, onboarding (Edge Function riot-link) ni filtros.
-- profiles.roles guarda todos los que juega (máx. 5, sin repetir, orden del enum).
-- Un trigger mantiene los dos sincronizados:
--   · si cambia roles → role = roles[1]
--   · si alguien escribe solo role (onboarding) → role pasa a encabezar roles
-- Datos existentes: roles = {role} y, si tenía un rol favorito distinto, se añade.
-- ════════════════════════════════════════════════════════════

alter table public.profiles
  add column roles public.valorant_role[] not null default '{}' check (cardinality(roles) <= 5);

update public.profiles
set roles = array_remove(array[role, case when favorite_role is distinct from role then favorite_role end], null)
where role is not null;

create function public.sync_profile_roles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if cardinality(new.roles) = 0 and new.role is not null then
      new.roles := array[new.role];
    end if;
  elsif new.roles is distinct from old.roles then
    if cardinality(new.roles) > 0 then
      new.role := new.roles[1];
    end if;
  elsif new.role is distinct from old.role and new.role is not null then
    new.roles := array[new.role] || array_remove(new.roles, new.role);
  end if;
  if cardinality(new.roles) > 0 and new.role is null then
    new.role := new.roles[1];
  end if;
  return new;
end;
$$;

create trigger profiles_sync_roles
  before insert or update of role, roles on public.profiles
  for each row execute function public.sync_profile_roles();

-- Filtro "juega este rol": roles @> array[rol]
create index profiles_roles_idx on public.profiles using gin (roles);

-- ── user_json expone roles ───────────────────────────────────
create or replace function public.user_json(p public.profiles)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    '_id', p.id,
    'riotId', p.riot_id,
    'puuid', p.puuid,
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

-- ── get_users: el filtro de rol busca dentro de roles ─────────
create or replace function public.get_users(
  p_rank text default null,
  p_role text default null,
  p_min_karma numeric default null,
  p_looking_for_team boolean default null,
  p_cursor text default null,
  p_limit int default 12,
  p_min_reviews int default null
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_limit int := least(100, greatest(1, coalesce(p_limit, 12)));
  v_rank public.valorant_rank := nullif(p_rank, '')::public.valorant_rank;
  v_role public.valorant_role := nullif(p_role, '')::public.valorant_role;
  v_cursor_trust numeric;
  v_cursor_id uuid;
  v_data jsonb;
  v_count int;
  v_last text;
  v_total bigint := -1;
begin
  if nullif(p_cursor, '') is not null then
    v_cursor_trust := split_part(p_cursor, '_', 1)::numeric;
    v_cursor_id := public.try_uuid(split_part(p_cursor, '_', 2));
  end if;

  select
    coalesce(jsonb_agg(public.user_json(pg.prof) order by (pg.prof).trust_karma desc, (pg.prof).id desc), '[]'::jsonb),
    count(*),
    (array_agg((pg.prof).trust_karma::text || '_' || (pg.prof).id::text
      order by (pg.prof).trust_karma asc, (pg.prof).id asc))[1]
  into v_data, v_count, v_last
  from (
    select p as prof
    from public.profiles p
    where p.onboarded
      and (v_rank is null or p.rank = v_rank)
      and (v_role is null or p.roles @> array[v_role])
      and (p_min_karma is null or p.trust_karma >= p_min_karma)
      and (p_looking_for_team is not true or p.looking_for_team)
      and (p_min_reviews is null or p.review_count >= p_min_reviews)
      and (v_cursor_id is null or (p.trust_karma, p.id) < (v_cursor_trust, v_cursor_id))
    order by p.trust_karma desc, p.id desc
    limit v_limit
  ) pg;

  if v_cursor_id is null then
    select count(*) into v_total
    from public.profiles p
    where p.onboarded
      and (v_rank is null or p.rank = v_rank)
      and (v_role is null or p.roles @> array[v_role])
      and (p_min_karma is null or p.trust_karma >= p_min_karma)
      and (p_looking_for_team is not true or p.looking_for_team)
      and (p_min_reviews is null or p.review_count >= p_min_reviews);
  end if;

  return public.paginated(v_data, v_total, v_limit, case when v_count = v_limit then v_last end);
end;
$$;

-- ── update_my_profile acepta roles ────────────────────────────
create or replace function public.update_my_profile(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_profile public.profiles;
  v_roles public.valorant_role[];
begin
  -- Roles: sin repetir, en el orden del enum; al menos uno. El trigger deja role = roles[1].
  if p_data ? 'roles' then
    select coalesce(array_agg(distinct r order by r), '{}')
    into v_roles
    from jsonb_array_elements_text(coalesce(p_data -> 'roles', '[]'::jsonb)) as e(v)
    cross join lateral (select e.v::public.valorant_role as r) x;
    if cardinality(v_roles) = 0 then
      raise exception 'Elige al menos un rol';
    end if;
  end if;

  update public.profiles p set
    bio = case when p_data ? 'bio' then coalesce(p_data ->> 'bio', '') else p.bio end,
    profile_image = case when p_data ? 'profileImage' then p_data ->> 'profileImage' else p.profile_image end,
    profile_image_type = case when p_data ? 'profileImageType'
      then coalesce(nullif(p_data ->> 'profileImageType', ''), 'riot_card')::public.profile_image_type
      else p.profile_image_type end,
    favorite_agents = case when p_data ? 'favoriteAgents'
      then array(select jsonb_array_elements_text(coalesce(p_data -> 'favoriteAgents', '[]'::jsonb)))
      else p.favorite_agents end,
    roles = case when p_data ? 'roles' then v_roles else p.roles end,
    favorite_role = case when p_data ? 'favoriteRole'
      then nullif(p_data ->> 'favoriteRole', '')::public.valorant_role else p.favorite_role end,
    social_links = case when p_data ? 'socialLinks'
      then p.social_links || coalesce(p_data -> 'socialLinks', '{}'::jsonb) else p.social_links end,
    availability = case when p_data ? 'availability'
      then coalesce(p_data -> 'availability', '{}'::jsonb) else p.availability end,
    schedule = case when p_data ? 'schedule' then p_data ->> 'schedule' else p.schedule end,
    looking_for_team = case when p_data ? 'lookingForTeam'
      then coalesce((p_data ->> 'lookingForTeam')::boolean, false) else p.looking_for_team end,
    lft_details = case when p_data ? 'lftDetails' then coalesce(p_data ->> 'lftDetails', '') else p.lft_details end,
    is_coach = case when p_data ? 'isCoach'
      then coalesce((p_data ->> 'isCoach')::boolean, false) else p.is_coach end,
    coach_details = case when p_data ? 'coachDetails' then coalesce(p_data ->> 'coachDetails', '') else p.coach_details end
  where p.id = v_uid
  returning * into v_profile;

  if v_profile.id is null then
    raise exception 'Usuario no encontrado' using errcode = 'P0002';
  end if;

  return public.user_json(v_profile) || jsonb_build_object('email', auth.jwt() ->> 'email');
end;
$$;
