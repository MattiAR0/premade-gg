-- ════════════════════════════════════════════════════════════
-- Fase 2: que el karma no se pueda manipular.
--
--  1. Recálculo del karma sin carrera entre valoraciones simultáneas.
--  2. Invitaciones: los miembros que añade el creador de un grupo LFG
--     o el propietario de un equipo tienen que aceptar.
--  3. played_pairs: registro persistente de quién ha coincidido con
--     quién (los grupos LFG se borran a las 24 h y con ellos la prueba).
--  4. Solo se puede valorar a quien coincidió contigo (los dos
--     aceptados) en un grupo o un equipo en los últimos 30 días.
--  5. Límites de frecuencia en las escrituras de la API.
--
-- Las valoraciones que ya existían se conservan y siguen contando.
-- ════════════════════════════════════════════════════════════


-- ── 1. Recálculo del karma sin carrera ───────────────────────
-- Antes: con dos valoraciones a la vez al mismo jugador, la segunda
-- esperaba el bloqueo de la fila del perfil con una instantánea tomada
-- antes de que la primera confirmara, y dejaba karma y review_count
-- desfasados en una valoración. Ahora se bloquea la fila primero (en
-- orden de id) y el cálculo, que es otra sentencia, ve todas las
-- valoraciones confirmadas. FOR NO KEY UPDATE y no FOR UPDATE: el insert
-- en reputations ya tiene un FOR KEY SHARE sobre el perfil por la FK, y
-- FOR UPDATE chocaría con el de la otra transacción (interbloqueo).
create or replace function public.recalculate_karma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid := coalesce(new.target_id, old.target_id);
  v_old_target uuid := case when tg_op = 'UPDATE' and old.target_id <> new.target_id then old.target_id end;
begin
  perform 1 from public.profiles
  where id = v_target or id = v_old_target
  order by id
  for no key update;

  update public.profiles p
  set karma = coalesce((
        select round(avg(r.rating), 1) from public.reputations r where r.target_id = v_target
      ), 5),
      review_count = (select count(*) from public.reputations r where r.target_id = v_target)
  where p.id = v_target;

  if v_old_target is not null then
    update public.profiles p
    set karma = coalesce((
          select round(avg(r.rating), 1) from public.reputations r where r.target_id = v_old_target
        ), 5),
        review_count = (select count(*) from public.reputations r where r.target_id = v_old_target)
    where p.id = v_old_target;
  end if;

  return null;
end;
$$;


-- ── 2a. Tablas nuevas ────────────────────────────────────────
-- Pares de jugadores que han coincidido (user_a < user_b).
create table public.played_pairs (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('lfg', 'team')),
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  -- Se rellena cuando llevan 15 minutos juntos (cron confirm_played_pairs).
  -- Hasta entonces la pareja no permite valorar: entrar y salir no basta.
  confirmed_at timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index played_pairs_user_b_idx on public.played_pairs (user_b);

-- Invitaciones a un equipo pendientes de respuesta
create table public.team_invites (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.valorant_role not null default 'Flex',
  invited_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_invites_user_idx on public.team_invites (user_id);

-- Contadores de los límites de frecuencia. UNLOGGED: no escriben WAL y
-- perderlos en una caída no importa.
create unlogged table public.rate_counters (
  key text not null,
  action text not null,
  window_start timestamptz not null,
  n int not null default 0,
  primary key (key, action, window_start)
) with (fillfactor = 70);

-- Nadie las lee desde la API: RLS sin políticas y sin privilegios.
alter table public.played_pairs enable row level security;
alter table public.team_invites enable row level security;
alter table public.rate_counters enable row level security;
revoke all on public.played_pairs, public.team_invites, public.rate_counters from anon, authenticated;

-- Las notificaciones de invitación a equipo apuntan al equipo
alter table public.notifications
  add column team_id uuid references public.teams (id) on delete cascade;


-- ── 2b. Límites de frecuencia ────────────────────────────────
-- Ventana fija: una upsert por llamada. Si se pasa del límite, la
-- excepción revierte también el incremento. PostgREST convierte el
-- código PT429 en HTTP 429.
create function public.rl_check(p_key text, p_action text, p_limit int, p_secs int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  insert into public.rate_counters as c (key, action, window_start, n)
  values (
    p_key, p_action,
    to_timestamp(floor(extract(epoch from now()) / p_secs) * p_secs),
    1
  )
  on conflict (key, action, window_start) do update set n = c.n + 1
  returning n into v_n;

  if v_n > p_limit then
    raise exception 'Vas demasiado rápido: espera un poco antes de volver a intentarlo.'
      using errcode = 'PT429';
  end if;
end;
$$;

revoke execute on function public.rl_check(text, text, int, int) from public, anon, authenticated;
-- Las Edge Functions (service_role) lo usan para limitar por IP o por usuario
grant execute on function public.rl_check(text, text, int, int) to service_role;

-- Solo cuenta las peticiones de la API con usuario (auth.uid()): el seed,
-- las migraciones y el service_role no pasan por aquí.
create function public.enforce_rate_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
begin
  if v_uid is null then
    return new;
  end if;
  v_key := v_uid::text;

  case tg_table_name
    when 'reputations' then
      perform public.rl_check(v_key, 'review', 10, 86400);
    when 'lfg_posts' then
      perform public.rl_check(v_key, 'lfg_post_hour', 5, 3600);
      perform public.rl_check(v_key, 'lfg_post_day', 15, 86400);
      if (
        select count(*) from public.lfg_posts
        where author_id = new.author_id and status = 'open' and expires_at > now()
      ) >= 3 then
        raise exception 'Ya tienes 3 grupos abiertos: cierra alguno antes de crear otro.';
      end if;
    when 'lfg_members' then
      if new.status = 'pending' then
        perform public.rl_check(v_key, 'lfg_join', 20, 3600);
      elsif new.status = 'invited' then
        perform public.rl_check(v_key, 'invite', 30, 86400);
      end if;
    when 'team_invites' then
      perform public.rl_check(v_key, 'invite', 30, 86400);
    when 'teams' then
      perform public.rl_check(v_key, 'team', 2, 86400);
    when 'team_join_requests' then
      perform public.rl_check(v_key, 'team_join', 20, 86400);
    when 'conversations' then
      if new.type = 'group' then
        perform public.rl_check(v_key, 'group_chat', 5, 3600);
      else
        perform public.rl_check(v_key, 'direct_chat', 20, 3600);
      end if;
    when 'messages' then
      perform public.rl_check(v_key, 'message_minute', 20, 60);
      perform public.rl_check(v_key, 'message_hour', 300, 3600);
    when 'profiles' then
      -- Solo las ediciones del propio perfil (el recálculo de karma de otro no cuenta)
      if new.id = v_uid then
        perform public.rl_check(v_key, 'profile_update', 30, 3600);
      end if;
    else
      null;
  end case;

  return new;
end;
$$;

revoke execute on function public.enforce_rate_limits() from public, anon, authenticated;

create trigger reputations_rate_limit before insert on public.reputations
  for each row execute function public.enforce_rate_limits();
create trigger lfg_posts_rate_limit before insert on public.lfg_posts
  for each row execute function public.enforce_rate_limits();
create trigger lfg_members_rate_limit before insert on public.lfg_members
  for each row execute function public.enforce_rate_limits();
create trigger team_invites_rate_limit before insert on public.team_invites
  for each row execute function public.enforce_rate_limits();
create trigger teams_rate_limit before insert on public.teams
  for each row execute function public.enforce_rate_limits();
create trigger team_join_requests_rate_limit before insert on public.team_join_requests
  for each row execute function public.enforce_rate_limits();
create trigger conversations_rate_limit before insert on public.conversations
  for each row execute function public.enforce_rate_limits();
create trigger messages_rate_limit before insert on public.messages
  for each row execute function public.enforce_rate_limits();
create trigger profiles_rate_limit before update on public.profiles
  for each row execute function public.enforce_rate_limits();

-- Limpieza: contadores de más de 2 días, parejas sin coincidir en 12 meses
-- e invitaciones a equipo sin responder en 30 días (como sus notificaciones)
select cron.schedule(
  'premadegg-anti-abuse-cleanup',
  '*/30 * * * *',
  $$
    delete from public.rate_counters where window_start < now() - interval '2 days';
    delete from public.played_pairs where last_at < now() - interval '12 months';
    delete from public.team_invites where created_at < now() - interval '30 days';
  $$
);


-- ── 3. played_pairs ──────────────────────────────────────────
create function public.record_played_pairs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'lfg_members' then
    insert into public.played_pairs (user_a, user_b, source)
    select least(new.user_id, m.user_id), greatest(new.user_id, m.user_id), 'lfg'
    from public.lfg_members m
    where m.post_id = new.post_id and m.status = 'accepted' and m.user_id <> new.user_id
    on conflict (user_a, user_b) do update set
      last_at = now(),
      -- Sin confirmar: el reloj de los 15 minutos vuelve a empezar
      first_at = case when public.played_pairs.confirmed_at is null then now() else public.played_pairs.first_at end;
  else
    insert into public.played_pairs (user_a, user_b, source)
    select least(new.user_id, tp.user_id), greatest(new.user_id, tp.user_id), 'team'
    from public.team_players tp
    where tp.team_id = new.team_id and tp.user_id <> new.user_id
    on conflict (user_a, user_b) do update set
      last_at = now(),
      -- Sin confirmar: el reloj de los 15 minutos vuelve a empezar
      first_at = case when public.played_pairs.confirmed_at is null then now() else public.played_pairs.first_at end;
  end if;
  return null;
end;
$$;

revoke execute on function public.record_played_pairs() from public, anon, authenticated;

create trigger lfg_members_played_pairs_insert after insert on public.lfg_members
  for each row when (new.status = 'accepted') execute function public.record_played_pairs();
create trigger lfg_members_played_pairs_update after update of status on public.lfg_members
  for each row when (new.status = 'accepted' and old.status is distinct from new.status)
  execute function public.record_played_pairs();
create trigger team_players_played_pairs after insert on public.team_players
  for each row execute function public.record_played_pairs();

-- Confirma las parejas que siguen juntas (mismo grupo LFG o equipo, los dos
-- aceptados) 15 minutos después de formarse, y renueva last_at de las que
-- siguen juntas (así un compañero de equipo no "caduca" a los 30 días).
-- Coexistencia de verdad: si uno sale antes, la pareja nunca se confirma.
-- El coach y el staff de un equipo no forman pareja (se asignan sin que
-- acepten); solo los jugadores.
create function public.confirm_played_pairs()
returns void
language sql
security definer
set search_path = ''
as $$
  with together as (
    select a.user_id as ua, b.user_id as ub
    from public.lfg_members a
    join public.lfg_members b on b.post_id = a.post_id and a.user_id < b.user_id
    where a.status = 'accepted' and b.status = 'accepted'
    union
    select a.user_id, b.user_id
    from public.team_players a
    join public.team_players b on b.team_id = a.team_id and a.user_id < b.user_id
  )
  update public.played_pairs pp
  set confirmed_at = coalesce(pp.confirmed_at, now()), last_at = now()
  from together t
  where pp.user_a = t.ua and pp.user_b = t.ub
    and pp.first_at <= now() - interval '15 minutes';
$$;

revoke execute on function public.confirm_played_pairs() from public, anon, authenticated;

select cron.schedule('premadegg-confirm-played-pairs', '*/5 * * * *', $$ select public.confirm_played_pairs(); $$);

-- Lo que ya había (grupos que aún no han caducado y equipos): se da por confirmado
insert into public.played_pairs (user_a, user_b, source, confirmed_at)
select least(a.user_id, b.user_id), greatest(a.user_id, b.user_id), 'lfg', now()
from public.lfg_members a
join public.lfg_members b on b.post_id = a.post_id and a.user_id < b.user_id
where a.status = 'accepted' and b.status = 'accepted'
on conflict do nothing;

insert into public.played_pairs (user_a, user_b, source, confirmed_at)
select least(a.user_id, b.user_id), greatest(a.user_id, b.user_id), 'team', now()
from public.team_players a
join public.team_players b on b.team_id = a.team_id and a.user_id < b.user_id
on conflict do nothing;

-- ¿Han estado juntos al menos 15 minutos en los últimos 30 días?
-- security definer porque played_pairs no es legible desde la API. Solo
-- responde a uno de los dos: si no, cualquiera podría consultar quién ha
-- jugado con quién.
create or replace function public.played_together(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) in (p_a, p_b) and exists (
    select 1 from public.played_pairs pp
    where pp.user_a = least(p_a, p_b)
      and pp.user_b = greatest(p_a, p_b)
      and pp.confirmed_at is not null
      and pp.last_at > now() - interval '30 days'
  );
$$;

revoke execute on function public.played_together(uuid, uuid) from public, anon;
grant execute on function public.played_together(uuid, uuid) to authenticated;


-- ── 4. Valoraciones solo con interacción real ────────────────
create or replace function public.create_review(p_target uuid, p_rating int, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_review public.reputations;
begin
  if v_uid = p_target then
    raise exception 'No puedes valorarte a ti mismo';
  end if;
  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'Usuario no encontrado' using errcode = 'P0002';
  end if;
  if not coalesce((select onboarded from public.profiles where id = v_uid), false) then
    raise exception 'Completa tu perfil (Riot ID) antes de valorar a otros jugadores';
  end if;
  if not public.played_together(v_uid, p_target) then
    raise exception 'Solo puedes valorar a jugadores con los que hayas estado al menos 15 minutos en un grupo o un equipo en los últimos 30 días.'
      using errcode = '42501';
  end if;

  begin
    insert into public.reputations (author_id, target_id, rating, comment, played_together)
    values (v_uid, p_target, p_rating, nullif(btrim(p_comment), ''), true)
    returning * into v_review;
  exception when unique_violation then
    raise exception 'Ya has valorado a este jugador' using errcode = '23505';
  end;

  -- El karma se recalcula en el trigger de reputations
  return public.reputation_json(v_review);
end;
$$;

create or replace function public.get_review_eligibility(p_target uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_existing public.reputations;
  v_played boolean;
begin
  if v_uid = p_target then
    return jsonb_build_object(
      'canReview', false, 'reason', 'self', 'playedTogether', false, 'existingReview', null
    );
  end if;

  select * into v_existing
  from public.reputations r
  where r.author_id = v_uid and r.target_id = p_target;

  v_played := public.played_together(v_uid, p_target);

  return jsonb_build_object(
    'canReview', v_existing.id is null and v_played,
    'reason', case
      when v_existing.id is not null then 'already_reviewed'
      when not v_played then 'not_played_together'
    end,
    'playedTogether', v_played,
    'existingReview', case when v_existing.id is not null then public.reputation_json(v_existing) end
  );
end;
$$;


-- ── 5. Notificaciones con equipo ─────────────────────────────
create or replace function public.notification_json(n public.notifications)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    '_id', n.id,
    'recipient', n.recipient_id,
    'sender', public.user_json_by_id(n.sender_id),
    'type', n.type,
    'lfgPost', (
      select jsonb_build_object('_id', lp.id, 'title', lp.title)
      from public.lfg_posts lp
      where lp.id = n.lfg_post_id
    ),
    'team', (
      select jsonb_build_object('_id', t.id, 'name', t.name)
      from public.teams t
      where t.id = n.team_id
    ),
    'message', n.message,
    'read', n.read,
    'createdAt', n.created_at
  );
$$;


-- ── 6. Grupos LFG: invitaciones ──────────────────────────────
-- Los invitados solo los ven el creador y el propio invitado, también
-- leyendo la tabla directamente.
drop policy "lfg members are public" on public.lfg_members;
create policy "lfg members are public" on public.lfg_members for select using (
  status <> 'invited'
  or user_id = (select auth.uid())
  or exists (select 1 from public.lfg_posts p where p.id = post_id and p.author_id = (select auth.uid()))
);

create or replace function public.lfg_post_json(lp public.lfg_posts)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    '_id', lp.id,
    'author', public.user_json_by_id(lp.author_id),
    'title', lp.title,
    'description', coalesce(lp.description, ''),
    'teamSize', lp.team_size,
    'minRank', lp.min_rank,
    'minKarma', lp.min_karma,
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object('user', public.user_json(p), 'status', m.status, 'joinedAt', m.joined_at)
        order by m.joined_at
      )
      from public.lfg_members m
      join public.profiles p on p.id = m.user_id
      where m.post_id = lp.id
        and (m.status <> 'invited' or (select auth.uid()) in (lp.author_id, m.user_id))
    ), '[]'::jsonb),
    'status', lp.status,
    'createdAt', lp.created_at,
    'expiresAt', lp.expires_at
  );
$$;

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

  -- El autor es miembro aceptado. Los que añade quedan invitados hasta que acepten
  -- (máximo teamSize - 1): no cuentan como miembros ni como "habéis jugado juntos".
  insert into public.lfg_members (post_id, user_id, status) values (v_post.id, v_uid, 'accepted');
  insert into public.lfg_members (post_id, user_id, status)
  select v_post.id, m.id, 'invited'
  from (
    select distinct u.id
    from unnest(coalesce(p_initial_members, '{}')) as u(id)
    join public.profiles p on p.id = u.id
    where u.id <> v_uid
    limit p_team_size - 1
  ) m;

  insert into public.notifications (recipient_id, sender_id, type, lfg_post_id, message)
  select m.user_id, v_uid, 'lfg_invite', v_post.id,
    left(format('%s te ha invitado a su grupo "%s"', v_me.riot_id, v_post.title), 300)
  from public.lfg_members m
  where m.post_id = v_post.id and m.status = 'invited';

  if p_team_size <= 1 then
    update public.lfg_posts set status = 'full' where id = v_post.id returning * into v_post;
  end if;

  return public.lfg_post_json(v_post);
end;
$$;

-- El invitado acepta o rechaza
create function public.respond_lfg_invite(p_post_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_post public.lfg_posts;
  v_accepted int;
  v_riot_id text;
begin
  select * into v_post from public.lfg_posts where id = p_post_id and expires_at > now() for update;
  if v_post.id is null then
    raise exception 'Grupo no encontrado' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.lfg_members where post_id = p_post_id and user_id = v_uid and status = 'invited'
  ) then
    raise exception 'Invitación no encontrada o ya respondida' using errcode = 'P0002';
  end if;

  delete from public.notifications
  where recipient_id = v_uid and type = 'lfg_invite' and lfg_post_id = p_post_id;

  if not p_accept then
    delete from public.lfg_members where post_id = p_post_id and user_id = v_uid;
    return jsonb_build_object('message', 'Invitación rechazada');
  end if;

  if v_post.status <> 'open' then
    raise exception 'Este grupo ya no acepta miembros';
  end if;
  select count(*) into v_accepted from public.lfg_members where post_id = p_post_id and status = 'accepted';
  if v_accepted >= v_post.team_size then
    raise exception 'El grupo ya está lleno';
  end if;

  update public.lfg_members set status = 'accepted', joined_at = now()
  where post_id = p_post_id and user_id = v_uid;

  if v_accepted + 1 >= v_post.team_size then
    update public.lfg_posts set status = 'full' where id = p_post_id returning * into v_post;
  end if;

  select riot_id into v_riot_id from public.profiles where id = v_uid;
  insert into public.notifications (recipient_id, sender_id, type, lfg_post_id, message)
  values (
    v_post.author_id, v_uid, 'request_accepted', p_post_id,
    left(format('%s ha aceptado tu invitación al grupo "%s"', v_riot_id, v_post.title), 300)
  );

  return jsonb_build_object('message', 'Te has unido al grupo', 'post', public.lfg_post_json(v_post));
end;
$$;

-- Unirse a un grupo al que ya te invitaron = aceptar la invitación
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
  elsif v_existing = 'invited' then
    return public.respond_lfg_invite(p_id, true);
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

-- El creador solo puede aceptar o rechazar solicitudes, no invitaciones:
-- si no, podría "aceptar" a un invitado sin que este diga nada.
create or replace function public.handle_lfg_member(p_post_id uuid, p_user_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_post public.lfg_posts;
  v_accepted int;
begin
  if p_action not in ('accept', 'reject') then
    raise exception 'Acción inválida. Usa "accept" o "reject"';
  end if;

  select * into v_post from public.lfg_posts where id = p_post_id for update;
  if v_post.id is null then
    raise exception 'Grupo no encontrado' using errcode = 'P0002';
  end if;
  if v_post.author_id <> v_uid then
    raise exception 'Solo el creador puede gestionar solicitudes' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.lfg_members where post_id = p_post_id and user_id = p_user_id and status = 'pending'
  ) then
    raise exception 'Solicitud no encontrada' using errcode = 'P0002';
  end if;

  if p_action = 'reject' then
    delete from public.lfg_members where post_id = p_post_id and user_id = p_user_id;
    insert into public.notifications (recipient_id, sender_id, type, lfg_post_id, message)
    values (
      p_user_id, v_uid, 'request_rejected', p_post_id,
      left(format('Tu solicitud para unirte a "%s" fue rechazada', v_post.title), 300)
    );
    return jsonb_build_object('message', 'Solicitud rechazada');
  end if;

  select count(*) into v_accepted from public.lfg_members where post_id = p_post_id and status = 'accepted';
  if v_accepted >= v_post.team_size then
    raise exception 'El grupo ya está lleno';
  end if;

  update public.lfg_members set status = 'accepted'
  where post_id = p_post_id and user_id = p_user_id;

  if v_accepted + 1 >= v_post.team_size then
    update public.lfg_posts set status = 'full' where id = p_post_id returning * into v_post;
  end if;

  insert into public.notifications (recipient_id, sender_id, type, lfg_post_id, message)
  values (
    p_user_id, v_uid, 'request_accepted', p_post_id,
    left(format('¡Tu solicitud para unirte a "%s" fue aceptada!', v_post.title), 300)
  );

  return jsonb_build_object('message', 'Miembro aceptado', 'post', public.lfg_post_json(v_post));
end;
$$;


-- ── 7. Equipos: invitaciones ─────────────────────────────────
create or replace function public.create_team(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_team public.teams;
  v_conv_id uuid;
  v_initial uuid[];
  v_riot_id text;
  r record;
begin
  v_initial := array(
    select distinct x::uuid
    from jsonb_array_elements_text(coalesce(p_data -> 'initialPlayers', '[]'::jsonb)) as x
    where x::uuid <> v_uid
  );
  if cardinality(v_initial) > 9 then
    raise exception 'Máximo 9 jugadores iniciales adicionales';
  end if;

  begin
    insert into public.teams (
      name, tag, description, owner_id, region, target_rank, social_links,
      recruiting, recruiting_roles, recruiting_details
    )
    values (
      btrim(p_data ->> 'name'),
      upper(btrim(p_data ->> 'tag')),
      coalesce(p_data ->> 'description', ''),
      v_uid,
      coalesce(nullif(p_data ->> 'region', ''), 'eu')::public.region,
      coalesce(nullif(p_data ->> 'targetRank', ''), 'Gold')::public.valorant_rank,
      '{"discord": "", "twitter": "", "twitch": "", "youtube": ""}'::jsonb || coalesce(p_data -> 'socialLinks', '{}'::jsonb),
      coalesce((p_data ->> 'recruiting')::boolean, false),
      array(select jsonb_array_elements_text(coalesce(p_data -> 'recruitingRoles', '[]'::jsonb))),
      coalesce(p_data ->> 'recruitingDetails', '')
    )
    returning * into v_team;
  exception when unique_violation then
    raise exception 'Ya existe un equipo con ese nombre' using errcode = '23505';
  end;

  insert into public.team_players (team_id, user_id, role) values (v_team.id, v_uid, 'Flex');

  -- Los jugadores iniciales reciben una invitación; entran al aceptarla
  insert into public.team_invites (team_id, user_id, invited_by)
  select v_team.id, p.id, v_uid from public.profiles p where p.id = any (v_initial);

  select riot_id into v_riot_id from public.profiles where id = v_uid;
  insert into public.notifications (recipient_id, sender_id, type, team_id, message)
  select ti.user_id, v_uid, 'team_invite', v_team.id,
    left(format('%s te ha invitado a su equipo "%s"', v_riot_id, v_team.name), 300)
  from public.team_invites ti
  where ti.team_id = v_team.id;

  -- Chat grupal del equipo
  insert into public.conversations (type, name, admin_id, team_id)
  values ('group', left('Team ' || v_team.name, 60), v_uid, v_team.id)
  returning id into v_conv_id;

  insert into public.conversation_participants (conversation_id, user_id)
  select v_conv_id, tp.user_id from public.team_players tp where tp.team_id = v_team.id;

  for r in select user_id from public.conversation_participants where conversation_id = v_conv_id loop
    perform public.emit_to_user(r.user_id, 'conversation:new', public.conversation_json_by_id(v_conv_id, r.user_id));
  end loop;

  return public.team_json(v_team);
end;
$$;

-- El propietario ya no añade jugadores: los invita
create or replace function public.add_team_player(p_team_id uuid, p_user_id uuid, p_role text default 'Flex')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_team public.teams;
  v_riot_id text;
begin
  select * into v_team from public.teams where id = p_team_id for update;
  if v_team.id is null then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  if v_team.owner_id <> v_uid then
    raise exception 'Solo el propietario puede invitar jugadores' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Usuario no encontrado' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.team_players where team_id = p_team_id and user_id = p_user_id) then
    raise exception 'El jugador ya está en el equipo';
  end if;
  if exists (select 1 from public.team_invites where team_id = p_team_id and user_id = p_user_id) then
    raise exception 'Ya has invitado a este jugador';
  end if;
  if (select count(*) from public.team_players where team_id = p_team_id) >= 10 then
    raise exception 'El equipo tiene el máximo de jugadores (10)';
  end if;

  insert into public.team_invites (team_id, user_id, role, invited_by)
  values (p_team_id, p_user_id, coalesce(nullif(p_role, ''), 'Flex')::public.valorant_role, v_uid);

  select riot_id into v_riot_id from public.profiles where id = v_uid;
  insert into public.notifications (recipient_id, sender_id, type, team_id, message)
  values (
    p_user_id, v_uid, 'team_invite', p_team_id,
    left(format('%s te ha invitado a su equipo "%s"', v_riot_id, v_team.name), 300)
  );

  return jsonb_build_object(
    'message', 'Invitación enviada. Entrará al equipo cuando la acepte.',
    'team', public.team_json(v_team, true)
  );
end;
$$;

create function public.respond_team_invite(p_team_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_team public.teams;
  v_invite public.team_invites;
  v_riot_id text;
begin
  select * into v_team from public.teams where id = p_team_id for update;
  if v_team.id is null then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;

  delete from public.team_invites where team_id = p_team_id and user_id = v_uid
  returning * into v_invite;
  if v_invite.team_id is null then
    raise exception 'Invitación no encontrada o ya respondida' using errcode = 'P0002';
  end if;

  delete from public.notifications
  where recipient_id = v_uid and type = 'team_invite' and team_id = p_team_id;

  if not p_accept then
    return jsonb_build_object('message', 'Invitación rechazada');
  end if;

  if (select count(*) from public.team_players where team_id = p_team_id) >= 10 then
    raise exception 'El equipo tiene el máximo de jugadores (10)';
  end if;

  insert into public.team_players (team_id, user_id, role)
  values (p_team_id, v_uid, v_invite.role)
  on conflict do nothing;
  perform public.team_chat_add(p_team_id, v_uid);

  select riot_id into v_riot_id from public.profiles where id = v_uid;
  insert into public.notifications (recipient_id, sender_id, type, team_id, message)
  values (
    v_team.owner_id, v_uid, 'request_accepted', p_team_id,
    left(format('%s ha aceptado unirse a tu equipo "%s"', v_riot_id, v_team.name), 300)
  );

  return jsonb_build_object('message', 'Te has unido al equipo', 'team', public.team_json(v_team));
end;
$$;

-- Salir del grupo (uno mismo) o expulsar (el creador). Con un invitado, el creador
-- cancela la invitación (sin aviso de "expulsado") y se borra su notificación.
create or replace function public.leave_lfg_post(p_post_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_post public.lfg_posts;
  v_is_creator boolean;
  v_is_self boolean := p_user_id = v_uid;
  v_status public.member_status;
begin
  select * into v_post from public.lfg_posts where id = p_post_id for update;
  if v_post.id is null then
    raise exception 'Grupo no encontrado' using errcode = 'P0002';
  end if;
  v_is_creator := v_post.author_id = v_uid;

  if not v_is_creator and not v_is_self then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501';
  end if;
  if p_user_id = v_post.author_id then
    raise exception 'El creador no puede abandonar su propio grupo. Ciérralo en su lugar.';
  end if;

  delete from public.lfg_members where post_id = p_post_id and user_id = p_user_id
  returning status into v_status;
  if v_status is null then
    raise exception 'Miembro no encontrado' using errcode = 'P0002';
  end if;

  if v_status = 'invited' then
    delete from public.notifications
    where recipient_id = p_user_id and type = 'lfg_invite' and lfg_post_id = p_post_id;
    return jsonb_build_object('message', case when v_is_self then 'Invitación rechazada' else 'Invitación cancelada' end);
  end if;

  if v_post.status = 'full' then
    update public.lfg_posts set status = 'open' where id = p_post_id;
  end if;

  if v_is_creator and not v_is_self then
    insert into public.notifications (recipient_id, sender_id, type, lfg_post_id, message)
    values (
      p_user_id, v_uid, 'member_kicked', p_post_id,
      left(format('Has sido expulsado del grupo "%s"', v_post.title), 300)
    );
  end if;

  return jsonb_build_object('message', case when v_is_self then 'Has abandonado el grupo' else 'Miembro expulsado' end);
end;
$$;
