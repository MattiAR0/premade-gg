-- ════════════════════════════════════════════════════════════
-- Karma ajustado (media bayesiana).
-- Toda cuenta empieza con karma 5 y 0 valoraciones, así que la media
-- sola deja que una cuenta nueva pase cualquier filtro o requisito.
-- trust_karma parte de un valor neutro (3,5) y se acerca a la media
-- real según se acumulan valoraciones:
--   (C·m + karma·n) / (C + n),  m = 3,5 · C = 3
-- Ejemplos: cuenta nueva 3,50 · un 5 → 3,88 · 4,7 con 3 → 4,10.
-- En pantalla se sigue mostrando la media con su recuento; trust_karma
-- decide orden, filtros y requisitos (crear grupo, unirse).
-- ════════════════════════════════════════════════════════════

alter table public.profiles
  add column trust_karma numeric(3, 2)
  generated always as (round((3 * 3.5 + karma * review_count) / (3 + review_count), 2)) stored;

-- ── Índices: el orden y los filtros pasan de karma a trust_karma ──
drop index public.profiles_karma_idx;
drop index public.profiles_rank_role_karma_idx;
drop index public.profiles_lft_karma_idx;
create index profiles_trust_idx on public.profiles (trust_karma desc, id desc);
create index profiles_rank_role_trust_idx on public.profiles (rank, role, trust_karma desc);
create index profiles_lft_trust_idx on public.profiles (looking_for_team, trust_karma desc);

-- ── user_json expone trustKarma (para explicar requisitos en el cliente) ──
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

-- ── get_users: orden, cursor y karma mínimo sobre trust_karma ──
-- Cursor: "<trust_karma>_<id>"
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
      and (v_role is null or p.role = v_role)
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
      and (v_role is null or p.role = v_role)
      and (p_min_karma is null or p.trust_karma >= p_min_karma)
      and (p_looking_for_team is not true or p.looking_for_team)
      and (p_min_reviews is null or p.review_count >= p_min_reviews);
  end if;

  return public.paginated(v_data, v_total, v_limit, case when v_count = v_limit then v_last end);
end;
$$;

-- ── get_lfg_posts: karma del creador sobre trust_karma ──
create or replace function public.get_lfg_posts(
  p_team_size int default null,
  p_status text default null,
  p_min_rank text default null,
  p_author uuid default null,
  p_cursor text default null,
  p_limit int default 12,
  p_my_rank text default null,
  p_min_author_karma numeric default null
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_limit int := least(100, greatest(1, coalesce(p_limit, 12)));
  v_status public.lfg_status;
  v_min_rank public.valorant_rank := nullif(p_min_rank, '')::public.valorant_rank;
  v_my_rank public.valorant_rank := nullif(p_my_rank, '')::public.valorant_rank;
  v_cursor_at timestamptz;
  v_cursor_id uuid;
  v_data jsonb;
  v_count int;
  v_last text;
  v_total bigint := -1;
begin
  -- Igual que el backend: con author se ignoran los demás estados; si no, 'open' por defecto.
  if p_author is null then
    v_status := coalesce(nullif(p_status, ''), 'open')::public.lfg_status;
  end if;

  if nullif(p_cursor, '') is not null then
    v_cursor_at := split_part(p_cursor, '_', 1)::timestamptz;
    v_cursor_id := public.try_uuid(split_part(p_cursor, '_', 2));
  end if;

  select
    coalesce(jsonb_agg(public.lfg_post_json(x.post) order by (x.post).created_at desc, (x.post).id desc), '[]'::jsonb),
    count(*),
    (array_agg((x.post).created_at::text || '_' || (x.post).id::text
      order by (x.post).created_at asc, (x.post).id asc))[1]
  into v_data, v_count, v_last
  from (
    select lp as post
    from public.lfg_posts lp
    join public.profiles author on author.id = lp.author_id
    where lp.expires_at > now()
      and (p_author is null or lp.author_id = p_author)
      and (v_status is null or lp.status = v_status)
      and (p_team_size is null or lp.team_size = p_team_size)
      and (v_min_rank is null or lp.min_rank = v_min_rank)
      and (v_my_rank is null or lp.min_rank is null or lp.min_rank <= v_my_rank)
      and (p_min_author_karma is null or author.trust_karma >= p_min_author_karma)
      and (v_cursor_id is null or (lp.created_at, lp.id) < (v_cursor_at, v_cursor_id))
    order by lp.created_at desc, lp.id desc
    limit v_limit
  ) x;

  if v_cursor_id is null then
    select count(*) into v_total
    from public.lfg_posts lp
    join public.profiles author on author.id = lp.author_id
    where lp.expires_at > now()
      and (p_author is null or lp.author_id = p_author)
      and (v_status is null or lp.status = v_status)
      and (p_team_size is null or lp.team_size = p_team_size)
      and (v_min_rank is null or lp.min_rank = v_min_rank)
      and (v_my_rank is null or lp.min_rank is null or lp.min_rank <= v_my_rank)
      and (p_min_author_karma is null or author.trust_karma >= p_min_author_karma);
  end if;

  return public.paginated(v_data, v_total, v_limit, case when v_count = v_limit then v_last end);
end;
$$;

-- ── Requisitos de karma al crear y al unirse ──
create or replace function public.create_lfg_post(
  p_title text,
  p_team_size int,
  p_description text default null,
  p_min_rank text default null,
  p_min_karma numeric default 3,
  p_initial_members uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_me public.profiles;
  v_post public.lfg_posts;
begin
  select * into v_me from public.profiles where id = v_uid;
  if not coalesce(v_me.onboarded, false) then
    raise exception 'Completa tu perfil (Riot ID) antes de crear grupos';
  end if;
  if v_me.trust_karma < 3 then
    raise exception 'Tu karma ajustado (%) es demasiado bajo para crear grupos. Mínimo: 3', v_me.trust_karma;
  end if;

  insert into public.lfg_posts (author_id, title, description, team_size, min_rank, min_karma)
  values (
    v_uid,
    btrim(p_title),
    p_description,
    p_team_size,
    nullif(p_min_rank, '')::public.valorant_rank,
    coalesce(p_min_karma, 3)
  )
  returning * into v_post;

  -- El autor cuenta como miembro aceptado + hasta teamSize - 1 miembros iniciales
  insert into public.lfg_members (post_id, user_id, status) values (v_post.id, v_uid, 'accepted');
  insert into public.lfg_members (post_id, user_id, status)
  select v_post.id, m.id, 'accepted'
  from (
    select distinct u.id
    from unnest(coalesce(p_initial_members, '{}')) as u(id)
    join public.profiles p on p.id = u.id
    where u.id <> v_uid
    limit p_team_size - 1
  ) m;

  if (select count(*) from public.lfg_members where post_id = v_post.id and status = 'accepted') >= p_team_size then
    update public.lfg_posts set status = 'full' where id = v_post.id returning * into v_post;
  end if;

  return public.lfg_post_json(v_post);
end;
$$;

create or replace function public.join_lfg_post(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_post public.lfg_posts;
  v_me public.profiles;
  v_existing public.member_status;
begin
  select * into v_post from public.lfg_posts where id = p_id and expires_at > now() for update;
  if v_post.id is null then
    raise exception 'Grupo no encontrado' using errcode = 'P0002';
  end if;
  if v_post.status <> 'open' then
    raise exception 'Este grupo ya no acepta solicitudes';
  end if;
  if v_post.author_id = v_uid then
    raise exception 'Ya eres el creador de este grupo';
  end if;

  select status into v_existing from public.lfg_members where post_id = p_id and user_id = v_uid;
  if v_existing = 'accepted' then
    raise exception 'Ya eres miembro de este grupo';
  elsif v_existing = 'pending' then
    raise exception 'Ya tienes una solicitud pendiente';
  end if;

  select * into v_me from public.profiles where id = v_uid;
  if not coalesce(v_me.onboarded, false) then
    raise exception 'Completa tu perfil (Riot ID) antes de unirte a grupos';
  end if;
  if v_me.trust_karma < v_post.min_karma then
    raise exception 'Tu karma ajustado (% con % valoraciones) es menor al mínimo del grupo (%)',
      v_me.trust_karma, v_me.review_count, v_post.min_karma
      using errcode = '42501';
  end if;
  if v_post.min_rank is not null and v_me.rank < v_post.min_rank then
    raise exception 'Tu rango (%) es menor al mínimo requerido (%)', v_me.rank, v_post.min_rank
      using errcode = '42501';
  end if;

  insert into public.lfg_members (post_id, user_id, status) values (p_id, v_uid, 'pending');

  insert into public.notifications (recipient_id, sender_id, type, lfg_post_id, message)
  values (
    v_post.author_id, v_uid, 'join_request', p_id,
    left(format('%s quiere unirse a tu grupo "%s"', v_me.riot_id, v_post.title), 300)
  );

  return jsonb_build_object('message', 'Solicitud enviada correctamente');
end;
$$;
