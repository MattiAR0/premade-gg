-- ════════════════════════════════════════════════════════════
-- PremadeGG · API de lectura (RPC, security invoker → aplica RLS)
-- Port de los GET de server/controllers/*.js
-- ════════════════════════════════════════════════════════════

-- Respuesta paginada estándar: { data, total, limit, totalPages, nextCursor }
create function public.paginated(p_data jsonb, p_total bigint, p_limit int, p_next text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'data', p_data,
    'total', p_total,
    'limit', p_limit,
    'totalPages', case when p_total >= 0 then ceil(p_total::numeric / p_limit)::int else -1 end,
    'nextCursor', p_next
  );
$$;

-- ── Usuario actual ───────────────────────────────────────────
create function public.get_me()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.user_json(p) || jsonb_build_object('email', auth.jwt() ->> 'email')
  from public.profiles p
  where p.id = auth.uid();
$$;

-- ── Usuarios ─────────────────────────────────────────────────
-- Orden karma DESC, id DESC. Cursor: "<karma>_<id>"
create function public.get_users(
  p_rank text default null,
  p_role text default null,
  p_min_karma numeric default null,
  p_looking_for_team boolean default null,
  p_cursor text default null,
  p_limit int default 12
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
      and (p_looking_for_team is not true or p.looking_for_team);
  end if;

  return public.paginated(v_data, v_total, v_limit, case when v_count = v_limit then v_last end);
end;
$$;

create function public.get_user(p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.user_json_by_id(p_id);
$$;

-- Autocompletado por Riot ID (máx. 10)
create function public.search_users(p_q text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.user_json(x.prof)), '[]'::jsonb)
  from (
    select p as prof
    from public.profiles p
    where char_length(coalesce(p_q, '')) >= 2
      and p.onboarded
      and p.riot_id ilike '%' || replace(replace(replace(p_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    order by p.riot_id
    limit 10
  ) x;
$$;

-- ── Reputación ───────────────────────────────────────────────
-- ¿Han jugado juntos? Co-miembros aceptados de un LFG o del mismo equipo.
create function public.played_together(p_a uuid, p_b uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.lfg_members ma
    join public.lfg_members mb on mb.post_id = ma.post_id
    where ma.user_id = p_a and ma.status = 'accepted'
      and mb.user_id = p_b and mb.status = 'accepted'
  )
  or exists (
    with team_people as (
      select t.id as team_id, t.owner_id as user_id from public.teams t
      union select t.id, t.coach_id from public.teams t where t.coach_id is not null
      union select tp.team_id, tp.user_id from public.team_players tp
    )
    select 1
    from team_people a
    join team_people b on b.team_id = a.team_id
    where a.user_id = p_a and b.user_id = p_b
  );
$$;

create function public.get_reviews(p_target uuid default null, p_author uuid default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.reputation_json(r) order by r.created_at desc), '[]'::jsonb)
  from public.reputations r
  where (p_target is null or r.target_id = p_target)
    and (p_author is null or r.author_id = p_author);
$$;

create function public.get_review_eligibility(p_target uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_existing public.reputations;
begin
  if v_uid = p_target then
    return jsonb_build_object(
      'canReview', false, 'reason', 'self', 'playedTogether', false, 'existingReview', null
    );
  end if;

  select * into v_existing
  from public.reputations r
  where r.author_id = v_uid and r.target_id = p_target;

  return jsonb_build_object(
    'canReview', v_existing.id is null,
    'reason', case when v_existing.id is not null then 'already_reviewed' end,
    'playedTogether', public.played_together(v_uid, p_target),
    'existingReview', case when v_existing.id is not null then public.reputation_json(v_existing) end
  );
end;
$$;

-- ── LFG ──────────────────────────────────────────────────────
-- Orden created_at DESC, id DESC. Cursor: "<created_at>_<id>"
create function public.get_lfg_posts(
  p_team_size int default null,
  p_status text default null,
  p_min_rank text default null,
  p_author uuid default null,
  p_cursor text default null,
  p_limit int default 12
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
    where lp.expires_at > now()
      and (p_author is null or lp.author_id = p_author)
      and (v_status is null or lp.status = v_status)
      and (p_team_size is null or lp.team_size = p_team_size)
      and (v_min_rank is null or lp.min_rank = v_min_rank)
      and (v_cursor_id is null or (lp.created_at, lp.id) < (v_cursor_at, v_cursor_id))
    order by lp.created_at desc, lp.id desc
    limit v_limit
  ) x;

  if v_cursor_id is null then
    select count(*) into v_total
    from public.lfg_posts lp
    where lp.expires_at > now()
      and (p_author is null or lp.author_id = p_author)
      and (v_status is null or lp.status = v_status)
      and (p_team_size is null or lp.team_size = p_team_size)
      and (v_min_rank is null or lp.min_rank = v_min_rank);
  end if;

  return public.paginated(v_data, v_total, v_limit, case when v_count = v_limit then v_last end);
end;
$$;

create function public.get_lfg_post(p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.lfg_post_json(lp) from public.lfg_posts lp where lp.id = p_id;
$$;

-- ── Equipos ──────────────────────────────────────────────────
create function public.get_teams(
  p_region text default null,
  p_target_rank text default null,
  p_recruiting boolean default null,
  p_search text default null,
  p_cursor text default null,
  p_limit int default 12
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_limit int := least(100, greatest(1, coalesce(p_limit, 12)));
  v_region public.region := nullif(p_region, '')::public.region;
  v_rank public.valorant_rank := nullif(p_target_rank, '')::public.valorant_rank;
  v_pattern text;
  v_cursor_at timestamptz;
  v_cursor_id uuid;
  v_data jsonb;
  v_count int;
  v_last text;
  v_total bigint := -1;
begin
  if nullif(btrim(p_search), '') is not null then
    v_pattern := '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  if nullif(p_cursor, '') is not null then
    v_cursor_at := split_part(p_cursor, '_', 1)::timestamptz;
    v_cursor_id := public.try_uuid(split_part(p_cursor, '_', 2));
  end if;

  select
    coalesce(jsonb_agg(public.team_json(x.team) order by (x.team).created_at desc, (x.team).id desc), '[]'::jsonb),
    count(*),
    (array_agg((x.team).created_at::text || '_' || (x.team).id::text
      order by (x.team).created_at asc, (x.team).id asc))[1]
  into v_data, v_count, v_last
  from (
    select t as team
    from public.teams t
    where (v_region is null or t.region = v_region)
      and (v_rank is null or t.target_rank = v_rank)
      and (p_recruiting is not true or t.recruiting)
      and (v_pattern is null or t.name ilike v_pattern or t.tag ilike v_pattern)
      and (v_cursor_id is null or (t.created_at, t.id) < (v_cursor_at, v_cursor_id))
    order by t.created_at desc, t.id desc
    limit v_limit
  ) x;

  if v_cursor_id is null then
    select count(*) into v_total
    from public.teams t
    where (v_region is null or t.region = v_region)
      and (v_rank is null or t.target_rank = v_rank)
      and (p_recruiting is not true or t.recruiting)
      and (v_pattern is null or t.name ilike v_pattern or t.tag ilike v_pattern);
  end if;

  return public.paginated(v_data, v_total, v_limit, case when v_count = v_limit then v_last end);
end;
$$;

-- Incluye joinRequests (RLS: solo las ve el dueño o el propio solicitante)
create function public.get_team(p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.team_json(t, true) from public.teams t where t.id = p_id;
$$;

-- ── Notificaciones ───────────────────────────────────────────
create function public.get_notifications(p_unread_only boolean default false, p_limit int default 20)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.notification_json(x.n) order by (x.n).created_at desc), '[]'::jsonb)
  from (
    select n
    from public.notifications n
    where n.recipient_id = auth.uid()
      and (p_unread_only is not true or not n.read)
    order by n.created_at desc
    limit least(50, greatest(1, coalesce(p_limit, 20)))
  ) x;
$$;

create function public.get_unread_notification_count()
returns int
language sql
stable
set search_path = ''
as $$
  select count(*)::int
  from public.notifications n
  where n.recipient_id = auth.uid() and not n.read;
$$;

-- ── Mensajería ───────────────────────────────────────────────
-- Cursor: updated_at de la última conversación devuelta
create function public.get_conversations(p_cursor text default null, p_limit int default 20)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_limit int := least(50, greatest(1, coalesce(p_limit, 20)));
  v_cursor timestamptz := nullif(p_cursor, '')::timestamptz;
  v_data jsonb;
  v_count int;
  v_next text;
begin
  -- Se pide un elemento de más (limit + 1) solo para saber si hay otra página.
  with page as (
    select c.id, c.updated_at, row_number() over (order by c.updated_at desc, c.id desc) as rn
    from public.conversations c
    join public.conversation_participants cp on cp.conversation_id = c.id and cp.user_id = v_uid
    where v_cursor is null or c.updated_at < v_cursor
    order by c.updated_at desc, c.id desc
    limit v_limit + 1
  )
  select
    coalesce(jsonb_agg(public.conversation_json_by_id(page.id, v_uid) order by rn)
      filter (where rn <= v_limit), '[]'::jsonb),
    count(*),
    max(page.updated_at::text) filter (where rn = v_limit)
  into v_data, v_count, v_next
  from page;

  return jsonb_build_object(
    'data', v_data,
    'nextCursor', case when v_count > v_limit then v_next end
  );
end;
$$;

create function public.get_conversation(p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.conversation_json(c, auth.uid())
  from public.conversations c
  where c.id = p_id;
$$;

-- Devuelve los mensajes en orden cronológico. Cursor: created_at del más antiguo.
create function public.get_messages(p_conversation_id uuid, p_cursor text default null, p_limit int default 30)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_limit int := least(50, greatest(1, coalesce(p_limit, 30)));
  v_cursor timestamptz := nullif(p_cursor, '')::timestamptz;
  v_data jsonb;
  v_count int;
  v_next text;
begin
  perform public.require_uid();
  if not public.is_conversation_participant(p_conversation_id) then
    raise exception 'Conversación no encontrada' using errcode = 'P0002';
  end if;

  with page as (
    select m, m.created_at, row_number() over (order by m.created_at desc, m.id desc) as rn
    from public.messages m
    where m.conversation_id = p_conversation_id
      and (v_cursor is null or m.created_at < v_cursor)
    order by m.created_at desc, m.id desc
    limit v_limit + 1
  )
  select
    coalesce(jsonb_agg(public.message_json(page.m) order by rn desc)
      filter (where rn <= v_limit), '[]'::jsonb),
    count(*),
    max(page.created_at::text) filter (where rn = v_limit)
  into v_data, v_count, v_next
  from page;

  return jsonb_build_object(
    'data', v_data,
    'nextCursor', case when v_count > v_limit then v_next end
  );
end;
$$;

create function public.get_unread_message_count()
returns int
language sql
stable
set search_path = ''
as $$
  select count(*)::int
  from public.messages m
  join public.conversation_participants cp
    on cp.conversation_id = m.conversation_id and cp.user_id = auth.uid()
  where m.sender_id <> auth.uid()
    and m.created_at > cp.last_read_at;
$$;
