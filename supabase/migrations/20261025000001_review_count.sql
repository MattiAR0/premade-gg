-- ════════════════════════════════════════════════════════════
-- Número de valoraciones por jugador.
-- Todas las cuentas empiezan con karma 5, así que el karma solo
-- significa algo si se sabe en cuántas valoraciones se basa.
-- ════════════════════════════════════════════════════════════

-- ── Columna mantenida por el trigger de reputación ───────────
alter table public.profiles
  add column review_count integer not null default 0 check (review_count >= 0);

update public.profiles p
set review_count = (select count(*) from public.reputations r where r.target_id = p.id);

-- Karma y nº de valoraciones se recalculan juntos
create or replace function public.recalculate_karma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid := coalesce(new.target_id, old.target_id);
begin
  update public.profiles p
  set karma = coalesce((
        select round(avg(r.rating), 1) from public.reputations r where r.target_id = v_target
      ), 5),
      review_count = (select count(*) from public.reputations r where r.target_id = v_target)
  where p.id = v_target;

  if tg_op = 'UPDATE' and old.target_id <> new.target_id then
    update public.profiles p
    set karma = coalesce((
          select round(avg(r.rating), 1) from public.reputations r where r.target_id = old.target_id
        ), 5),
        review_count = (select count(*) from public.reputations r where r.target_id = old.target_id)
    where p.id = old.target_id;
  end if;

  return null;
end;
$$;

-- ── user_json expone reviewCount ─────────────────────────────
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
    'schedule', p.schedule,
    'karma', p.karma,
    'reviewCount', p.review_count,
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

-- ── get_users: filtro opcional por mínimo de valoraciones ────
-- (la firma cambia: se elimina y se vuelve a crear; mismo orden y cursor)
drop function public.get_users(text, text, numeric, boolean, text, int);

create function public.get_users(
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
  v_cursor_karma numeric;
  v_cursor_id uuid;
  v_data jsonb;
  v_count int;
  v_last text;
  v_total bigint := -1;
begin
  if nullif(p_cursor, '') is not null then
    v_cursor_karma := split_part(p_cursor, '_', 1)::numeric;
    v_cursor_id := public.try_uuid(split_part(p_cursor, '_', 2));
  end if;

  select
    coalesce(jsonb_agg(public.user_json(pg.prof) order by (pg.prof).karma desc, (pg.prof).id desc), '[]'::jsonb),
    count(*),
    (array_agg((pg.prof).karma::text || '_' || (pg.prof).id::text
      order by (pg.prof).karma asc, (pg.prof).id asc))[1]
  into v_data, v_count, v_last
  from (
    select p as prof
    from public.profiles p
    where p.onboarded
      and (v_rank is null or p.rank = v_rank)
      and (v_role is null or p.role = v_role)
      and (p_min_karma is null or p.karma >= p_min_karma)
      and (p_looking_for_team is not true or p.looking_for_team)
      and (p_min_reviews is null or p.review_count >= p_min_reviews)
      and (v_cursor_id is null or (p.karma, p.id) < (v_cursor_karma, v_cursor_id))
    order by p.karma desc, p.id desc
    limit v_limit
  ) pg;

  if v_cursor_id is null then
    select count(*) into v_total
    from public.profiles p
    where p.onboarded
      and (v_rank is null or p.rank = v_rank)
      and (v_role is null or p.role = v_role)
      and (p_min_karma is null or p.karma >= p_min_karma)
      and (p_looking_for_team is not true or p.looking_for_team)
      and (p_min_reviews is null or p.review_count >= p_min_reviews);
  end if;

  return public.paginated(v_data, v_total, v_limit, case when v_count = v_limit then v_last end);
end;
$$;
