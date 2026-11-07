-- ════════════════════════════════════════════════════════════
-- Fase 3: denuncias, moderación, bloqueos y suspensiones.
--
-- Pensado para cumplir el Reglamento de Servicios Digitales (DSA):
--  · art. 16: cualquier usuario puede denunciar un contenido con su motivo;
--  · art. 17: el afectado recibe la decisión motivada (qué se hizo y por qué);
--  · art. 20: el afectado puede recurrir y la decisión se revisa de nuevo;
--  · el denunciante recibe el resultado de su denuncia.
--
-- Moderan los usuarios de la tabla moderators (se añaden a mano con SQL).
-- Las denuncias guardan una copia del contenido al denunciarlo, para que
-- se pueda revisar aunque el autor lo edite o lo borre. Se borran 12 meses
-- después de resolverse.
-- ════════════════════════════════════════════════════════════


-- ── Tablas ───────────────────────────────────────────────────
create table public.moderators (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type public.report_target not null,
  target_id uuid not null,
  -- Autor del contenido denunciado (o el propio perfil)
  target_user_id uuid references public.profiles (id) on delete set null,
  reason public.report_reason not null,
  details text not null default '' check (char_length(details) <= 1000),
  -- Copia del contenido en el momento de la denuncia
  snapshot text not null default '' check (char_length(snapshot) <= 4000),
  status public.report_status not null default 'open',
  action text check (action in ('none', 'content_removed', 'user_suspended', 'content_removed_user_suspended')),
  resolution_note text check (char_length(resolution_note) <= 1000),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  suspended_until timestamptz,
  appeal_text text check (char_length(appeal_text) <= 1000),
  appeal_status public.appeal_status,
  appealed_at timestamptz,
  appeal_note text check (char_length(appeal_note) <= 1000),
  appeal_resolved_at timestamptz,
  created_at timestamptz not null default now()
);
-- Una denuncia abierta por persona y contenido
create unique index reports_open_uidx
  on public.reports (reporter_id, target_type, target_id) where status = 'open';
create index reports_status_idx on public.reports (status, created_at);
create index reports_target_user_idx on public.reports (target_user_id);

-- Bloqueos: A bloquea a B. Afecta en los dos sentidos (ni mensajes, ni
-- invitaciones, ni valoraciones, ni notificaciones entre ellos).
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.moderators enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
revoke all on public.moderators, public.reports, public.blocks from anon, authenticated;

-- Suspensión: mientras dure, la cuenta no puede escribir (sí denunciar y recurrir).
-- En una tabla privada y no en profiles, que es legible por cualquiera.
create table public.suspensions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  until timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.suspensions enable row level security;
revoke all on public.suspensions from anon, authenticated;

-- Los avisos de moderación no llevan remitente: no se identifica al moderador
alter table public.notifications alter column sender_id drop not null;

-- Notificaciones ligadas a una denuncia (decisión y recurso)
alter table public.notifications
  add column report_id uuid references public.reports (id) on delete cascade;


-- ── Ayudantes ────────────────────────────────────────────────
create function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.moderators where user_id = (select auth.uid()));
$$;

-- No se expone a la API: diría quién ha bloqueado a quién
create function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated;

create function public.require_moderator()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  if not exists (select 1 from public.moderators where user_id = v_uid) then
    raise exception 'Solo los moderadores pueden hacer esto' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

revoke execute on function public.require_moderator() from public, anon, authenticated;

-- Fin de la suspensión del usuario actual (null si no está suspendido)
create function public.my_suspended_until()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select until from public.suspensions where user_id = (select auth.uid()) and until > now();
$$;

-- Comprueba que quien escribe no está suspendido (las RPC y los triggers de escritura)
create function public.assert_not_suspended()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_until timestamptz;
begin
  select until into v_until from public.suspensions where user_id = (select auth.uid()) and until > now();
  if v_until is not null then
    raise exception 'Tu cuenta está suspendida hasta el %. Puedes ver la decisión y recurrirla en Ajustes de cuenta.',
      to_char(v_until at time zone 'Europe/Madrid', 'DD/MM/YYYY HH24:MI')
      using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.assert_not_suspended() from public, anon, authenticated;

create or replace function public.get_me()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.user_json(p) || jsonb_build_object(
    'email', auth.jwt() ->> 'email',
    'isModerator', public.is_moderator(),
    'suspendedUntil', public.my_suspended_until()
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

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
    'reportId', n.report_id,
    'message', n.message,
    'read', n.read,
    'createdAt', n.created_at
  );
$$;


-- ── Suspensión y límites de frecuencia ───────────────────────
-- Misma función que en 20261105000003 con dos añadidos: una cuenta
-- suspendida no puede escribir, y las denuncias tienen su límite.
create or replace function public.enforce_rate_limits()
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

  -- Suspensión: todo menos denunciar (y recurrir, que es un update de reports).
  -- En profiles solo cuenta la edición del propio perfil: el recálculo de karma
  -- de otro jugador también actualiza profiles.
  -- (if anidado: PL/pgSQL no corta el "or" y new.id no existe en todas las tablas)
  if tg_table_name <> 'reports' then
    if tg_table_name <> 'profiles' then
      perform public.assert_not_suspended();
    elsif new.id = v_uid then
      perform public.assert_not_suspended();
    end if;
  end if;

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
      if new.id = v_uid then
        perform public.rl_check(v_key, 'profile_update', 30, 3600);
      end if;
    when 'reports' then
      perform public.rl_check(v_key, 'report', 10, 86400);
    else
      null;
  end case;

  return new;
end;
$$;

create trigger reports_rate_limit before insert on public.reports
  for each row execute function public.enforce_rate_limits();

-- Lo que no es una inserción con límite: editar grupos y equipos, aceptar
-- solicitudes e invitaciones, entrar en equipos y chats.
create function public.enforce_not_suspended()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    perform public.assert_not_suspended();
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function public.enforce_not_suspended() from public, anon, authenticated;

create trigger lfg_posts_not_suspended before update on public.lfg_posts
  for each row execute function public.enforce_not_suspended();
create trigger lfg_members_not_suspended before update on public.lfg_members
  for each row execute function public.enforce_not_suspended();
create trigger teams_not_suspended before update on public.teams
  for each row execute function public.enforce_not_suspended();
create trigger team_players_not_suspended before insert on public.team_players
  for each row execute function public.enforce_not_suspended();
create trigger team_staff_not_suspended before insert on public.team_staff
  for each row execute function public.enforce_not_suspended();
create trigger conversation_participants_not_suspended before insert on public.conversation_participants
  for each row execute function public.enforce_not_suspended();


-- ── Bloqueos: qué impiden ────────────────────────────────────
-- Las invitaciones y las notificaciones entre bloqueados se descartan en
-- silencio; lo demás da el mismo error genérico que cualquier otro fallo,
-- para no delatar el bloqueo. No afecta a las valoraciones: bloquear a
-- alguien no debe servir para que no te valore tras jugar juntos.
create function public.enforce_blocks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_other uuid;
begin
  case tg_table_name
    when 'notifications' then
      -- Los avisos de moderación llegan siempre
      if new.type not in ('report_update', 'moderation_notice', 'appeal_update')
         and public.is_blocked_between(new.sender_id, new.recipient_id) then
        return null;
      end if;
      return new;
    else
      null;
  end case;

  if v_uid is null then
    return new;
  end if;

  case tg_table_name
    when 'messages' then
      -- Chat directo: el otro participante
      select cp.user_id into v_other
      from public.conversations c
      join public.conversation_participants cp on cp.conversation_id = c.id
      where c.id = new.conversation_id and c.type = 'direct' and cp.user_id <> v_uid
      limit 1;
      if v_other is not null and public.is_blocked_between(v_uid, v_other) then
        raise exception 'No se ha podido completar la acción.' using errcode = '42501';
      end if;
    when 'conversation_participants' then
      -- Los chats de equipo siguen al equipo (aceptar a alguien no debe fallar por esto)
      if new.user_id <> v_uid
         and not exists (select 1 from public.conversations where id = new.conversation_id and team_id is not null)
         and public.is_blocked_between(v_uid, new.user_id) then
        raise exception 'No se ha podido completar la acción.' using errcode = '42501';
      end if;
    when 'lfg_members' then
      if new.status = 'invited' then
        if public.is_blocked_between(v_uid, new.user_id) then
          return null;
        end if;
      elsif new.user_id = v_uid then
        select author_id into v_other from public.lfg_posts where id = new.post_id;
        if public.is_blocked_between(v_uid, v_other) then
          raise exception 'No se ha podido completar la acción.' using errcode = '42501';
        end if;
      end if;
    when 'team_invites' then
      if public.is_blocked_between(v_uid, new.user_id) then
        return null;
      end if;
    when 'team_join_requests' then
      select owner_id into v_other from public.teams where id = new.team_id;
      if public.is_blocked_between(v_uid, v_other) then
        raise exception 'No se ha podido completar la acción.' using errcode = '42501';
      end if;
    else
      null;
  end case;

  return new;
end;
$$;

revoke execute on function public.enforce_blocks() from public, anon, authenticated;

create trigger notifications_blocks before insert on public.notifications
  for each row execute function public.enforce_blocks();
create trigger messages_blocks before insert on public.messages
  for each row execute function public.enforce_blocks();
create trigger conversation_participants_blocks before insert on public.conversation_participants
  for each row execute function public.enforce_blocks();
create trigger lfg_members_blocks before insert on public.lfg_members
  for each row execute function public.enforce_blocks();
create trigger team_invites_blocks before insert on public.team_invites
  for each row execute function public.enforce_blocks();
create trigger team_join_requests_blocks before insert on public.team_join_requests
  for each row execute function public.enforce_blocks();

-- Bloquear o desbloquear
create function public.set_block(p_user uuid, p_block boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  if p_user = v_uid then
    raise exception 'No puedes bloquearte a ti mismo';
  end if;
  perform public.rl_check(v_uid::text, 'block', 30, 86400);
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Usuario no encontrado' using errcode = 'P0002';
  end if;

  if p_block then
    insert into public.blocks (blocker_id, blocked_id) values (v_uid, p_user) on conflict do nothing;
    -- Se cancelan las invitaciones pendientes entre los dos
    delete from public.lfg_members m using public.lfg_posts p
    where m.post_id = p.id and m.status = 'invited'
      and ((p.author_id = v_uid and m.user_id = p_user) or (p.author_id = p_user and m.user_id = v_uid));
    delete from public.team_invites ti using public.teams t
    where ti.team_id = t.id
      and ((t.owner_id = v_uid and ti.user_id = p_user) or (t.owner_id = p_user and ti.user_id = v_uid));
    -- Y las solicitudes pendientes (grupos y equipos) en los dos sentidos
    delete from public.lfg_members m using public.lfg_posts p
    where m.post_id = p.id and m.status = 'pending'
      and ((p.author_id = v_uid and m.user_id = p_user) or (p.author_id = p_user and m.user_id = v_uid));
    delete from public.team_join_requests r using public.teams t
    where r.team_id = t.id and r.status = 'pending'
      and ((t.owner_id = v_uid and r.user_id = p_user) or (t.owner_id = p_user and r.user_id = v_uid));
    return jsonb_build_object('blocked', true, 'message', 'Jugador bloqueado');
  end if;

  delete from public.blocks where blocker_id = v_uid and blocked_id = p_user;
  return jsonb_build_object('blocked', false, 'message', 'Jugador desbloqueado');
end;
$$;

-- Solo dice si lo has bloqueado tú (no si te ha bloqueado a ti)
create function public.get_block_status(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('blockedByMe', exists (
    select 1 from public.blocks where blocker_id = (select auth.uid()) and blocked_id = p_user
  ));
$$;

create function public.get_my_blocks()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.user_json(p) order by b.created_at desc), '[]'::jsonb)
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = (select auth.uid());
$$;


-- ── Denunciar ────────────────────────────────────────────────
create function public.create_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_type public.report_target;
  v_owner uuid;
  v_snapshot text;
  v_report public.reports;
  v_riot_id text;
begin
  if not coalesce((select onboarded from public.profiles where id = v_uid), false) then
    raise exception 'Completa tu perfil (Riot ID) antes de denunciar';
  end if;

  begin
    v_type := p_target_type::public.report_target;
  exception when invalid_text_representation then
    raise exception 'Tipo de contenido no válido';
  end;

  case v_type
    when 'profile' then
      select id, concat_ws(E'\n', 'Riot ID: ' || riot_id, nullif(bio, ''), nullif(lft_details, ''), nullif(coach_details, ''))
        into v_owner, v_snapshot
      from public.profiles where id = p_target_id;
    when 'review' then
      select author_id, concat_ws(E'\n', 'Puntuación: ' || rating || '/5', nullif(comment, ''))
        into v_owner, v_snapshot
      from public.reputations where id = p_target_id;
    when 'message' then
      select m.sender_id, m.content into v_owner, v_snapshot
      from public.messages m
      where m.id = p_target_id
        and exists (
          select 1 from public.conversation_participants cp
          where cp.conversation_id = m.conversation_id and cp.user_id = v_uid
        );
    when 'team' then
      select owner_id, concat_ws(E'\n', name || ' [' || tag || ']', nullif(description, ''), nullif(recruiting_details, ''))
        into v_owner, v_snapshot
      from public.teams where id = p_target_id;
    when 'lfg_post' then
      select author_id, concat_ws(E'\n', title, nullif(description, ''))
        into v_owner, v_snapshot
      from public.lfg_posts where id = p_target_id;
  end case;

  if v_owner is null then
    raise exception 'No se ha encontrado lo que quieres denunciar' using errcode = 'P0002';
  end if;
  if v_owner = v_uid then
    raise exception 'No puedes denunciar tu propio contenido';
  end if;

  begin
    insert into public.reports (reporter_id, target_type, target_id, target_user_id, reason, details, snapshot)
    values (
      v_uid, v_type, p_target_id, v_owner, p_reason::public.report_reason,
      left(coalesce(btrim(p_details), ''), 1000), left(coalesce(v_snapshot, ''), 4000)
    )
    returning * into v_report;
  exception
    when unique_violation then
      raise exception 'Ya has denunciado esto. Lo estamos revisando y te avisaremos.' using errcode = '23505';
    when invalid_text_representation then
      raise exception 'Elige un motivo de la lista';
  end;

  -- Aviso a los moderadores
  select riot_id into v_riot_id from public.profiles where id = v_owner;
  insert into public.notifications (recipient_id, sender_id, type, report_id, message)
  select m.user_id, v_uid, 'report_update', v_report.id,
    left(format('Nueva denuncia sobre %s. Revísala en Moderación.', coalesce(v_riot_id, 'un usuario')), 300)
  from public.moderators m
  where m.user_id <> v_uid and m.user_id <> v_owner;

  return jsonb_build_object(
    'message', 'Denuncia enviada. La revisaremos y te avisaremos de lo que decidamos.'
  );
end;
$$;


-- ── Moderación ───────────────────────────────────────────────
create function public.report_json(r public.reports)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    '_id', r.id,
    'reporter', case when r.reporter_id is not null then public.user_json_by_id(r.reporter_id) end,
    'targetType', r.target_type,
    'targetId', r.target_id,
    'targetUser', case when r.target_user_id is not null then public.user_json_by_id(r.target_user_id) end,
    'reason', r.reason,
    'details', r.details,
    'snapshot', r.snapshot,
    'status', r.status,
    'action', r.action,
    'resolutionNote', r.resolution_note,
    'resolvedAt', r.resolved_at,
    'suspendedUntil', r.suspended_until,
    'appealText', r.appeal_text,
    'appealStatus', r.appeal_status,
    'appealedAt', r.appealed_at,
    'appealNote', r.appeal_note,
    'createdAt', r.created_at
  );
$$;

revoke execute on function public.report_json(public.reports) from public, anon, authenticated;

-- Cola de moderación: denuncias abiertas y recursos pendientes
create function public.get_reports(p_queue text default 'open')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_moderator();
  if p_queue = 'appeals' then
    return coalesce((
      select jsonb_agg(public.report_json(r) order by r.appealed_at)
      from public.reports r where r.appeal_status = 'pending' and r.target_user_id is distinct from auth.uid()
    ), '[]'::jsonb);
  elsif p_queue = 'resolved' then
    return coalesce((
      select jsonb_agg(public.report_json(x.r) order by (x.r).resolved_at desc)
      from (
        select r from public.reports r
        where r.status <> 'open' and r.target_user_id is distinct from auth.uid()
        order by r.resolved_at desc limit 50
      ) x
    ), '[]'::jsonb);
  end if;
  return coalesce((
    select jsonb_agg(public.report_json(r) order by r.created_at)
    from public.reports r where r.status = 'open' and r.target_user_id is distinct from auth.uid()
  ), '[]'::jsonb);
end;
$$;

-- Texto para el afectado según la acción
create function public.moderation_action_text(p_action text, p_until timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select case p_action
    when 'content_removed' then 'Hemos retirado tu contenido'
    when 'user_suspended' then 'Hemos suspendido tu cuenta hasta el ' || to_char(p_until at time zone 'Europe/Madrid', 'DD/MM/YYYY')
    when 'content_removed_user_suspended' then 'Hemos retirado tu contenido y suspendido tu cuenta hasta el '
      || to_char(p_until at time zone 'Europe/Madrid', 'DD/MM/YYYY')
    else 'No hemos tomado ninguna medida'
  end;
$$;

revoke execute on function public.moderation_action_text(text, timestamptz) from public, anon, authenticated;

-- Resolver una denuncia: desestimar, retirar el contenido y/o suspender.
-- La nota es la motivación que reciben el denunciante y el afectado.
create function public.resolve_report(
  p_report_id uuid,
  p_remove_content boolean,
  p_suspend_days int default null,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mod uuid := public.require_moderator();
  v_report public.reports;
  v_action text;
  v_until timestamptz;
  v_note text := btrim(coalesce(p_note, ''));
begin
  if char_length(v_note) < 10 then
    raise exception 'Explica el motivo de la decisión (al menos 10 caracteres): lo recibirán el denunciante y el afectado.';
  end if;
  if p_suspend_days is not null and p_suspend_days not between 1 and 365 then
    raise exception 'La suspensión debe durar entre 1 y 365 días';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if v_report.id is null then
    raise exception 'Denuncia no encontrada' using errcode = 'P0002';
  end if;
  if v_report.status <> 'open' then
    raise exception 'Esta denuncia ya está resuelta';
  end if;
  if v_report.target_user_id = v_mod or v_report.reporter_id = v_mod then
    raise exception 'No puedes resolver una denuncia sobre ti o que hayas puesto tú: que la revise otro moderador' using errcode = '42501';
  end if;

  if p_remove_content then
    case v_report.target_type
      when 'review' then
        delete from public.reputations where id = v_report.target_id;
      when 'message' then
        update public.messages set content = '[Mensaje retirado por moderación]' where id = v_report.target_id;
        -- La vista previa del chat tampoco debe mostrarlo
        update public.conversations c set last_message_content = '[Mensaje retirado por moderación]'
        from public.messages m
        where m.id = v_report.target_id and c.id = m.conversation_id
          and c.last_message_at = m.created_at and c.last_message_sender = m.sender_id;
      when 'lfg_post' then
        delete from public.lfg_posts where id = v_report.target_id;
      when 'profile' then
        update public.profiles
        set bio = '', lft_details = '', coach_details = '', profile_image = null
        where id = v_report.target_id;
      when 'team' then
        update public.teams set description = '', recruiting_details = '', logo = null
        where id = v_report.target_id;
    end case;
  end if;

  if p_suspend_days is not null and v_report.target_user_id is not null then
    v_until := now() + make_interval(days => p_suspend_days);
    insert into public.suspensions (user_id, until)
    values (v_report.target_user_id, v_until)
    on conflict (user_id) do update set until = greatest(public.suspensions.until, excluded.until);
  end if;

  v_action := case
    when p_remove_content and v_until is not null then 'content_removed_user_suspended'
    when p_remove_content then 'content_removed'
    when v_until is not null then 'user_suspended'
    else 'none'
  end;

  update public.reports
  set status = case when v_action = 'none' then 'dismissed'::public.report_status else 'actioned' end,
      action = v_action,
      resolution_note = left(v_note, 1000),
      resolved_by = v_mod,
      resolved_at = now(),
      suspended_until = v_until
  where id = p_report_id
  returning * into v_report;

  -- Resultado para el denunciante
  if v_report.reporter_id is not null then
    insert into public.notifications (recipient_id, sender_id, type, report_id, message, expires_at)
    values (
      v_report.reporter_id, null, 'report_update', v_report.id,
      left(case when v_action = 'none'
        then 'Hemos revisado tu denuncia y no hemos tomado medidas. Motivo: ' || v_note
        else 'Hemos revisado tu denuncia y hemos actuado. Gracias por avisar. Motivo: ' || v_note
      end, 300),
      now() + interval '90 days'
    );
  end if;

  -- Decisión motivada para el afectado (solo si se actuó), con opción de recurso
  if v_action <> 'none' and v_report.target_user_id is not null then
    insert into public.notifications (recipient_id, sender_id, type, report_id, message, expires_at)
    values (
      v_report.target_user_id, null, 'moderation_notice', v_report.id,
      left(public.moderation_action_text(v_action, v_until) || '. En «Ver la decisión» tienes el motivo y puedes recurrir.', 300),
      -- Más que el plazo de recurso (6 meses). Además está en Ajustes de cuenta.
      now() + interval '7 months'
    );
  end if;

  return jsonb_build_object('message', 'Denuncia resuelta', 'report', public.report_json(v_report));
end;
$$;

-- El afectado ve la decisión completa (motivo, medida, recurso)
create function public.get_moderation_decision(p_report_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_report public.reports;
begin
  select * into v_report from public.reports
  where id = p_report_id and target_user_id = v_uid and status = 'actioned';
  if v_report.id is null then
    raise exception 'Decisión no encontrada' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    '_id', v_report.id,
    'targetType', v_report.target_type,
    'reason', v_report.reason,
    'snapshot', v_report.snapshot,
    'action', v_report.action,
    'actionText', public.moderation_action_text(v_report.action, v_report.suspended_until),
    'resolutionNote', v_report.resolution_note,
    'resolvedAt', v_report.resolved_at,
    'suspendedUntil', v_report.suspended_until,
    'appealStatus', v_report.appeal_status,
    'appealText', v_report.appeal_text,
    'appealNote', v_report.appeal_note,
    'canAppeal', v_report.appeal_status is null and v_report.resolved_at > now() - interval '6 months'
  );
end;
$$;

-- Las decisiones sobre el usuario actual, para encontrarlas sin la notificación
create function public.get_my_moderation_decisions()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    '_id', r.id,
    'actionText', public.moderation_action_text(r.action, r.suspended_until),
    'resolvedAt', r.resolved_at,
    'appealStatus', r.appeal_status,
    'canAppeal', r.appeal_status is null and r.resolved_at > now() - interval '6 months'
  ) order by r.resolved_at desc), '[]'::jsonb)
  from public.reports r
  where r.target_user_id = (select auth.uid()) and r.status = 'actioned';
$$;

-- Recurso del afectado (uno por decisión, en los 6 meses siguientes)
create function public.appeal_report(p_report_id uuid, p_text text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_report public.reports;
  v_text text := btrim(coalesce(p_text, ''));
begin
  if char_length(v_text) < 10 then
    raise exception 'Explica por qué no estás de acuerdo (al menos 10 caracteres)';
  end if;

  select * into v_report from public.reports
  where id = p_report_id and target_user_id = v_uid and status = 'actioned'
  for update;
  if v_report.id is null then
    raise exception 'Decisión no encontrada' using errcode = 'P0002';
  end if;
  if v_report.appeal_status is not null then
    raise exception 'Ya has recurrido esta decisión';
  end if;
  if v_report.resolved_at < now() - interval '6 months' then
    raise exception 'El plazo para recurrir (6 meses) ha terminado';
  end if;

  update public.reports
  set appeal_text = left(v_text, 1000), appeal_status = 'pending', appealed_at = now()
  where id = p_report_id;

  insert into public.notifications (recipient_id, sender_id, type, report_id, message)
  select m.user_id, v_uid, 'report_update', p_report_id, 'Nuevo recurso contra una decisión de moderación. Revísalo en Moderación.'
  from public.moderators m
  where m.user_id <> v_uid;

  return jsonb_build_object('message', 'Recurso enviado. Volveremos a revisar la decisión y te avisaremos.');
end;
$$;

-- Resolver el recurso: mantener o revocar la decisión. Revocar levanta la
-- suspensión que puso esa denuncia; el contenido borrado no se puede recuperar.
create function public.resolve_appeal(p_report_id uuid, p_reverse boolean, p_note text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mod uuid := public.require_moderator();
  v_report public.reports;
  v_note text := btrim(coalesce(p_note, ''));
begin
  if char_length(v_note) < 10 then
    raise exception 'Explica el motivo (al menos 10 caracteres): lo recibirá el afectado.';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if v_report.id is null or v_report.appeal_status is distinct from 'pending' then
    raise exception 'Recurso no encontrado o ya resuelto' using errcode = 'P0002';
  end if;
  if v_report.target_user_id = v_mod or v_report.reporter_id = v_mod then
    raise exception 'No puedes resolver un recurso sobre ti o sobre una denuncia que hayas puesto tú' using errcode = '42501';
  end if;

  update public.reports
  set appeal_status = case when p_reverse then 'reversed'::public.appeal_status else 'upheld' end,
      appeal_note = left(v_note, 1000),
      appeal_resolved_at = now()
  where id = p_report_id;

  -- Al revocar, la suspensión se recalcula con las demás decisiones que siguen en pie
  if p_reverse and v_report.suspended_until is not null then
    with vigente as (
      select max(r.suspended_until) as until
      from public.reports r
      where r.target_user_id = v_report.target_user_id
        and r.status = 'actioned'
        and r.appeal_status is distinct from 'reversed'
        and r.suspended_until > now()
    )
    update public.suspensions s
    set until = v.until
    from vigente v
    where s.user_id = v_report.target_user_id and v.until is not null;

    delete from public.suspensions s
    where s.user_id = v_report.target_user_id
      and not exists (
        select 1 from public.reports r
        where r.target_user_id = v_report.target_user_id
          and r.status = 'actioned'
          and r.appeal_status is distinct from 'reversed'
          and r.suspended_until > now()
      );
  end if;

  insert into public.notifications (recipient_id, sender_id, type, report_id, message, expires_at)
  values (
    v_report.target_user_id, null, 'appeal_update', p_report_id,
    left(case when p_reverse
      then 'Hemos aceptado tu recurso y revocado la decisión. Motivo: ' || v_note
      else 'Hemos revisado tu recurso y mantenemos la decisión. Motivo: ' || v_note
    end, 300),
    now() + interval '7 months'
  );

  return jsonb_build_object('message', case when p_reverse then 'Decisión revocada' else 'Decisión mantenida' end);
end;
$$;

-- Las denuncias resueltas se borran a los 12 meses
select cron.schedule(
  'premadegg-reports-cleanup',
  '15 4 * * *',
  $$
    delete from public.reports where status <> 'open' and coalesce(appeal_resolved_at, resolved_at) < now() - interval '12 months';
    delete from public.suspensions where until < now();
  $$
);
