-- ════════════════════════════════════════════════════════════
-- PremadeGG · Helpers, serializadores JSON y RLS
--
-- Modelo de seguridad:
--   · Lectura: tablas con RLS + políticas SELECT.
--   · Escritura: SOLO a través de funciones RPC (security definer) que validan
--     auth.uid() y las reglas de negocio. Los clientes no tienen INSERT/UPDATE/DELETE
--     sobre ninguna tabla.
-- ════════════════════════════════════════════════════════════

-- ── Helpers genéricos ────────────────────────────────────────

-- Devuelve el usuario autenticado o lanza error.
create function public.require_uid()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- Convierte texto a uuid sin lanzar error.
create function public.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

-- ¿El usuario actual participa en la conversación?
-- security definer para que las políticas RLS no se llamen a sí mismas en bucle.
create function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = auth.uid()
  );
$$;

-- Emite un evento Realtime (broadcast privado) al canal personal del usuario.
-- Equivale a socketService.emitToUser del backend anterior.
create function public.emit_to_user(p_user_id uuid, p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(p_payload, p_event, 'user:' || p_user_id::text, true);
exception when others then
  -- Un fallo de Realtime nunca debe tumbar la transacción de negocio.
  raise warning 'emit_to_user(%) failed: %', p_event, sqlerrm;
end;
$$;

-- ── Serializadores JSON ──────────────────────────────────────
-- Devuelven la misma forma que la API Express (_id, camelCase, objetos poblados)
-- para que los modelos de Angular no cambien.

create function public.user_json(p public.profiles)
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

create function public.user_json_by_id(p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.user_json(p) from public.profiles p where p.id = p_id;
$$;

create function public.lfg_post_json(lp public.lfg_posts)
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
    ), '[]'::jsonb),
    'status', lp.status,
    'createdAt', lp.created_at,
    'expiresAt', lp.expires_at
  );
$$;

create function public.team_json(t public.teams, p_with_requests boolean default false)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    '_id', t.id,
    'name', t.name,
    'tag', t.tag,
    'logo', t.logo,
    'description', t.description,
    'owner', public.user_json_by_id(t.owner_id),
    'coach', public.user_json_by_id(t.coach_id),
    'players', coalesce((
      select jsonb_agg(
        jsonb_build_object('user', public.user_json(p), 'role', tp.role, 'joinedAt', tp.joined_at)
        order by tp.joined_at
      )
      from public.team_players tp
      join public.profiles p on p.id = tp.user_id
      where tp.team_id = t.id
    ), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(
        jsonb_build_object('user', public.user_json(p), 'role', ts.role, 'joinedAt', ts.joined_at)
        order by ts.joined_at
      )
      from public.team_staff ts
      join public.profiles p on p.id = ts.user_id
      where ts.team_id = t.id
    ), '[]'::jsonb),
    'region', t.region,
    'targetRank', t.target_rank,
    'socialLinks', t.social_links,
    'achievements', t.achievements,
    'recruiting', t.recruiting,
    'recruitingRoles', to_jsonb(t.recruiting_roles),
    'recruitingDetails', t.recruiting_details,
    'joinRequests', case when p_with_requests then coalesce((
      select jsonb_agg(
        jsonb_build_object(
          '_id', r.id,
          'user', public.user_json(p),
          'message', r.message,
          'status', r.status,
          'createdAt', r.created_at
        )
        order by r.created_at
      )
      from public.team_join_requests r
      join public.profiles p on p.id = r.user_id
      where r.team_id = t.id and r.status = 'pending'
    ), '[]'::jsonb) end,
    'createdAt', t.created_at
  );
$$;

create function public.reputation_json(r public.reputations)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    '_id', r.id,
    'author', public.user_json_by_id(r.author_id),
    'target', public.user_json_by_id(r.target_id),
    'rating', r.rating,
    'comment', coalesce(r.comment, ''),
    'playedTogether', r.played_together,
    'createdAt', r.created_at
  );
$$;

create function public.notification_json(n public.notifications)
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
    'message', n.message,
    'read', n.read,
    'createdAt', n.created_at
  );
$$;

-- readBy se deriva de conversation_participants.last_read_at (+ el propio remitente).
create function public.message_json(m public.messages)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    '_id', m.id,
    'conversation', m.conversation_id,
    'sender', public.user_json_by_id(m.sender_id),
    'content', m.content,
    'readBy', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user', cp.user_id,
        'readAt', case when cp.user_id = m.sender_id then m.created_at else cp.last_read_at end
      ))
      from public.conversation_participants cp
      where cp.conversation_id = m.conversation_id
        and (cp.user_id = m.sender_id or cp.last_read_at >= m.created_at)
    ), '[]'::jsonb),
    'createdAt', m.created_at,
    'updatedAt', m.updated_at
  );
$$;

-- unreadCount se calcula para p_viewer (el usuario que recibe el JSON).
create function public.conversation_json(c public.conversations, p_viewer uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    '_id', c.id,
    'participants', coalesce((
      select jsonb_agg(public.user_json(p) order by cp.joined_at)
      from public.conversation_participants cp
      join public.profiles p on p.id = cp.user_id
      where cp.conversation_id = c.id
    ), '[]'::jsonb),
    'type', c.type,
    'name', c.name,
    'groupImage', c.group_image,
    'admin', (
      select jsonb_build_object('_id', p.id, 'riotId', p.riot_id)
      from public.profiles p
      where p.id = c.admin_id
    ),
    'teamId', c.team_id,
    'lastMessage', case when c.last_message_at is null then null else jsonb_build_object(
      'content', c.last_message_content,
      'sender', c.last_message_sender,
      'createdAt', c.last_message_at
    ) end,
    'unreadCount', (
      select count(*)
      from public.messages m
      join public.conversation_participants cp
        on cp.conversation_id = m.conversation_id and cp.user_id = p_viewer
      where m.conversation_id = c.id
        and m.sender_id <> p_viewer
        and m.created_at > cp.last_read_at
    ),
    'createdAt', c.created_at,
    'updatedAt', c.updated_at
  );
$$;

create function public.conversation_json_by_id(p_id uuid, p_viewer uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.conversation_json(c, p_viewer) from public.conversations c where c.id = p_id;
$$;

-- ── Row Level Security ───────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_players enable row level security;
alter table public.team_staff enable row level security;
alter table public.team_join_requests enable row level security;
alter table public.lfg_posts enable row level security;
alter table public.lfg_members enable row level security;
alter table public.reputations enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

-- Datos públicos
create policy "profiles are public" on public.profiles for select using (true);
create policy "teams are public" on public.teams for select using (true);
create policy "team players are public" on public.team_players for select using (true);
create policy "team staff is public" on public.team_staff for select using (true);
create policy "lfg posts are public" on public.lfg_posts for select using (true);
create policy "lfg members are public" on public.lfg_members for select using (true);
create policy "reputations are public" on public.reputations for select using (true);

-- Solicitudes de equipo: el solicitante y el dueño del equipo
create policy "join requests visible to requester and owner" on public.team_join_requests
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.teams t
      where t.id = team_id and t.owner_id = (select auth.uid())
    )
  );

-- Mensajería: solo participantes
create policy "participants read conversations" on public.conversations
  for select to authenticated using (public.is_conversation_participant(id));
create policy "participants read participants" on public.conversation_participants
  for select to authenticated using (public.is_conversation_participant(conversation_id));
create policy "participants read messages" on public.messages
  for select to authenticated using (public.is_conversation_participant(conversation_id));

-- Notificaciones: solo el destinatario
create policy "recipient reads notifications" on public.notifications
  for select to authenticated using (recipient_id = (select auth.uid()));

-- ── Privilegios ──────────────────────────────────────────────
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;

-- Helpers internos: no invocables desde el cliente
revoke execute on function public.emit_to_user(uuid, text, jsonb) from public, anon, authenticated;

-- ── Realtime (broadcast privado) ─────────────────────────────
-- user:<uid>        → eventos del servidor para ese usuario (mensajes, notificaciones…)
-- typing:<conv_id>  → indicador "escribiendo…" entre participantes
create policy "receive own channel and typing" on realtime.messages
  for select to authenticated
  using (
    realtime.topic() = 'user:' || (select auth.uid())::text
    or (
      realtime.topic() like 'typing:%'
      and public.is_conversation_participant(public.try_uuid(substr(realtime.topic(), 8)))
    )
  );

create policy "participants broadcast typing" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'typing:%'
    and public.is_conversation_participant(public.try_uuid(substr(realtime.topic(), 8)))
  );
