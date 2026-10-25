-- ════════════════════════════════════════════════════════════
-- PremadeGG · API de escritura (RPC, security definer)
-- Port de los POST/PUT/DELETE de server/controllers/*.js
-- Cada función valida auth.uid() y permisos antes de escribir.
-- ════════════════════════════════════════════════════════════

-- ── Perfil ───────────────────────────────────────────────────
-- Solo campos editables por el usuario (rank, riot_id, karma… los gestiona el servidor).
create function public.update_my_profile(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_profile public.profiles;
begin
  update public.profiles p set
    bio = case when p_data ? 'bio' then coalesce(p_data ->> 'bio', '') else p.bio end,
    profile_image = case when p_data ? 'profileImage' then p_data ->> 'profileImage' else p.profile_image end,
    profile_image_type = case when p_data ? 'profileImageType'
      then coalesce(nullif(p_data ->> 'profileImageType', ''), 'riot_card')::public.profile_image_type
      else p.profile_image_type end,
    favorite_agents = case when p_data ? 'favoriteAgents'
      then array(select jsonb_array_elements_text(coalesce(p_data -> 'favoriteAgents', '[]'::jsonb)))
      else p.favorite_agents end,
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

-- ── Reputación ───────────────────────────────────────────────
create function public.create_review(p_target uuid, p_rating int, p_comment text default null)
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

  begin
    insert into public.reputations (author_id, target_id, rating, comment, played_together)
    values (v_uid, p_target, p_rating, nullif(btrim(p_comment), ''), public.played_together(v_uid, p_target))
    returning * into v_review;
  exception when unique_violation then
    raise exception 'Ya has valorado a este jugador' using errcode = '23505';
  end;

  -- El karma se recalcula en el trigger de reputations
  return public.reputation_json(v_review);
end;
$$;

create function public.delete_review(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  delete from public.reputations where id = p_id and author_id = v_uid;
  if not found then
    raise exception 'Review no encontrada' using errcode = 'P0002';
  end if;
  return jsonb_build_object('message', 'Review eliminada, karma recalculado');
end;
$$;

-- ── LFG ──────────────────────────────────────────────────────
create function public.create_lfg_post(
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
    raise exception 'Completa tu perfil (Riot ID) antes de crear posts LFG';
  end if;
  if v_me.karma < 3 then
    raise exception 'Tu karma es demasiado bajo para crear posts LFG. Mínimo: 3.0';
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

create function public.update_lfg_post(p_id uuid, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_post public.lfg_posts;
begin
  select * into v_post from public.lfg_posts where id = p_id for update;
  if v_post.id is null then
    raise exception 'Post LFG no encontrado' using errcode = 'P0002';
  end if;
  if v_post.author_id <> v_uid then
    raise exception 'Solo el creador puede editar este post' using errcode = '42501';
  end if;

  update public.lfg_posts lp set
    title = case when p_data ? 'title' then btrim(p_data ->> 'title') else lp.title end,
    description = case when p_data ? 'description' then p_data ->> 'description' else lp.description end,
    min_rank = case when p_data ? 'minRank'
      then nullif(p_data ->> 'minRank', '')::public.valorant_rank else lp.min_rank end,
    min_karma = case when p_data ? 'minKarma' then (p_data ->> 'minKarma')::numeric else lp.min_karma end,
    status = case when p_data ? 'status' then (p_data ->> 'status')::public.lfg_status else lp.status end
  where lp.id = p_id
  returning * into v_post;

  return public.lfg_post_json(v_post);
end;
$$;

create function public.delete_lfg_post(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_author uuid;
begin
  select author_id into v_author from public.lfg_posts where id = p_id;
  if v_author is null then
    raise exception 'Post LFG no encontrado' using errcode = 'P0002';
  end if;
  if v_author <> v_uid then
    raise exception 'Solo el creador puede eliminar este post' using errcode = '42501';
  end if;
  delete from public.lfg_posts where id = p_id;
  return jsonb_build_object('message', 'Post LFG eliminado');
end;
$$;

create function public.join_lfg_post(p_id uuid)
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
    raise exception 'Post LFG no encontrado' using errcode = 'P0002';
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
  if v_me.karma < v_post.min_karma then
    raise exception 'Tu karma (%) es menor al mínimo requerido (%)', v_me.karma, v_post.min_karma
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

create function public.handle_lfg_member(p_post_id uuid, p_user_id uuid, p_action text)
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
    raise exception 'Post LFG no encontrado' using errcode = 'P0002';
  end if;
  if v_post.author_id <> v_uid then
    raise exception 'Solo el creador puede gestionar solicitudes' using errcode = '42501';
  end if;
  if not exists (select 1 from public.lfg_members where post_id = p_post_id and user_id = p_user_id) then
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

-- Salir del grupo (uno mismo) o expulsar (el creador)
create function public.leave_lfg_post(p_post_id uuid, p_user_id uuid)
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
begin
  select * into v_post from public.lfg_posts where id = p_post_id for update;
  if v_post.id is null then
    raise exception 'Post LFG no encontrado' using errcode = 'P0002';
  end if;
  v_is_creator := v_post.author_id = v_uid;

  if not v_is_creator and not v_is_self then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501';
  end if;
  if p_user_id = v_post.author_id then
    raise exception 'El creador no puede abandonar su propio grupo. Ciérralo en su lugar.';
  end if;

  delete from public.lfg_members where post_id = p_post_id and user_id = p_user_id;
  if not found then
    raise exception 'Miembro no encontrado' using errcode = 'P0002';
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

-- ── Chat de equipo (helpers internos) ────────────────────────
create function public.team_chat_add(p_team_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv_id uuid;
  r record;
begin
  select id into v_conv_id from public.conversations where team_id = p_team_id;
  if v_conv_id is null then
    return;
  end if;

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_conv_id, p_user_id)
  on conflict do nothing;

  if found then
    for r in select user_id from public.conversation_participants where conversation_id = v_conv_id loop
      perform public.emit_to_user(
        r.user_id,
        case when r.user_id = p_user_id then 'conversation:new' else 'conversation:updated' end,
        public.conversation_json_by_id(v_conv_id, r.user_id)
      );
    end loop;
  end if;
end;
$$;

create function public.team_chat_remove(p_team_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv_id uuid;
  r record;
begin
  select id into v_conv_id from public.conversations where team_id = p_team_id;
  if v_conv_id is null then
    return;
  end if;

  -- Si sigue en el equipo con otro rol (jugador ↔ staff), mantiene el chat
  if exists (select 1 from public.team_players where team_id = p_team_id and user_id = p_user_id)
     or exists (select 1 from public.team_staff where team_id = p_team_id and user_id = p_user_id)
     or exists (select 1 from public.teams where id = p_team_id and (owner_id = p_user_id or coach_id = p_user_id)) then
    return;
  end if;

  delete from public.conversation_participants where conversation_id = v_conv_id and user_id = p_user_id;
  if found then
    perform public.emit_to_user(p_user_id, 'conversation:removed', jsonb_build_object('conversationId', v_conv_id));
    for r in select user_id from public.conversation_participants where conversation_id = v_conv_id loop
      perform public.emit_to_user(r.user_id, 'conversation:updated', public.conversation_json_by_id(v_conv_id, r.user_id));
    end loop;
  end if;
end;
$$;

-- ── Equipos ──────────────────────────────────────────────────
create function public.create_team(p_data jsonb)
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
  insert into public.team_players (team_id, user_id, role)
  select v_team.id, p.id, 'Flex' from public.profiles p where p.id = any (v_initial);

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

create function public.update_team(p_id uuid, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_team public.teams;
begin
  select * into v_team from public.teams where id = p_id for update;
  if v_team.id is null then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  if v_team.owner_id <> v_uid then
    raise exception 'Solo el dueño puede editar el equipo' using errcode = '42501';
  end if;

  begin
    update public.teams t set
      name = case when p_data ? 'name' then btrim(p_data ->> 'name') else t.name end,
      tag = case when p_data ? 'tag' then upper(btrim(p_data ->> 'tag')) else t.tag end,
      logo = case when p_data ? 'logo' then nullif(p_data ->> 'logo', '') else t.logo end,
      description = case when p_data ? 'description' then coalesce(p_data ->> 'description', '') else t.description end,
      region = case when p_data ? 'region' then (p_data ->> 'region')::public.region else t.region end,
      target_rank = case when p_data ? 'targetRank' then (p_data ->> 'targetRank')::public.valorant_rank else t.target_rank end,
      social_links = case when p_data ? 'socialLinks'
        then t.social_links || coalesce(p_data -> 'socialLinks', '{}'::jsonb) else t.social_links end,
      achievements = case when p_data ? 'achievements'
        then coalesce(p_data -> 'achievements', '[]'::jsonb) else t.achievements end,
      recruiting = case when p_data ? 'recruiting'
        then coalesce((p_data ->> 'recruiting')::boolean, false) else t.recruiting end,
      recruiting_roles = case when p_data ? 'recruitingRoles'
        then array(select jsonb_array_elements_text(coalesce(p_data -> 'recruitingRoles', '[]'::jsonb)))
        else t.recruiting_roles end,
      recruiting_details = case when p_data ? 'recruitingDetails'
        then coalesce(p_data ->> 'recruitingDetails', '') else t.recruiting_details end
    where t.id = p_id
    returning * into v_team;
  exception when unique_violation then
    raise exception 'Ya existe un equipo con ese nombre' using errcode = '23505';
  end;

  return public.team_json(v_team, true);
end;
$$;

create function public.delete_team(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_owner uuid;
  r record;
begin
  select owner_id into v_owner from public.teams where id = p_id;
  if v_owner is null then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  if v_owner <> v_uid then
    raise exception 'Solo el dueño puede eliminar el equipo' using errcode = '42501';
  end if;

  for r in
    select cp.user_id, c.id as conversation_id
    from public.conversations c
    join public.conversation_participants cp on cp.conversation_id = c.id
    where c.team_id = p_id
  loop
    perform public.emit_to_user(r.user_id, 'conversation:removed', jsonb_build_object('conversationId', r.conversation_id));
  end loop;

  -- El chat del equipo se borra en cascada (conversations.team_id)
  delete from public.teams where id = p_id;
  return jsonb_build_object('message', 'Equipo eliminado');
end;
$$;

create function public.set_team_coach(p_team_id uuid, p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_team public.teams;
  v_previous uuid;
begin
  select * into v_team from public.teams where id = p_team_id for update;
  if v_team.id is null then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  if v_team.owner_id <> v_uid then
    raise exception 'Solo el dueño puede asignar coach' using errcode = '42501';
  end if;
  v_previous := v_team.coach_id;

  if p_user_id is null then
    update public.teams set coach_id = null where id = p_team_id;
    if v_previous is not null then
      perform public.team_chat_remove(p_team_id, v_previous);
    end if;
    return jsonb_build_object('message', 'Coach removido');
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Usuario no encontrado' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and is_coach) then
    raise exception 'Este usuario no está registrado como coach';
  end if;

  update public.teams set coach_id = p_user_id where id = p_team_id returning * into v_team;
  if v_previous is not null and v_previous <> p_user_id then
    perform public.team_chat_remove(p_team_id, v_previous);
  end if;
  perform public.team_chat_add(p_team_id, p_user_id);

  return jsonb_build_object('message', 'Coach asignado', 'team', public.team_json(v_team, true));
end;
$$;

create function public.add_team_player(p_team_id uuid, p_user_id uuid, p_role text default 'Flex')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_team public.teams;
begin
  select * into v_team from public.teams where id = p_team_id for update;
  if v_team.id is null then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  if v_team.owner_id <> v_uid then
    raise exception 'Solo el dueño puede agregar jugadores' using errcode = '42501';
  end if;
  if exists (select 1 from public.team_players where team_id = p_team_id and user_id = p_user_id) then
    raise exception 'El jugador ya está en el equipo';
  end if;
  if (select count(*) from public.team_players where team_id = p_team_id) >= 10 then
    raise exception 'El equipo tiene el máximo de jugadores (10)';
  end if;

  insert into public.team_players (team_id, user_id, role)
  values (p_team_id, p_user_id, coalesce(nullif(p_role, ''), 'Flex')::public.valorant_role);
  perform public.team_chat_add(p_team_id, p_user_id);

  return jsonb_build_object('message', 'Jugador agregado', 'team', public.team_json(v_team, true));
end;
$$;

-- El dueño expulsa o el propio jugador abandona
create function public.remove_team_player(p_team_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_team public.teams;
  v_is_self boolean := p_user_id = v_uid;
begin
  select * into v_team from public.teams where id = p_team_id for update;
  if v_team.id is null then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  if v_team.owner_id <> v_uid and not v_is_self then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501';
  end if;
  if p_user_id = v_team.owner_id then
    raise exception 'El dueño no puede ser removido. Transfiere la propiedad primero.';
  end if;

  delete from public.team_players where team_id = p_team_id and user_id = p_user_id;
  if not found then
    raise exception 'Jugador no encontrado en el equipo' using errcode = 'P0002';
  end if;
  perform public.team_chat_remove(p_team_id, p_user_id);

  return jsonb_build_object('message', case when v_is_self then 'Has abandonado el equipo' else 'Jugador removido' end);
end;
$$;

create function public.add_team_staff(p_team_id uuid, p_user_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_team public.teams;
begin
  select * into v_team from public.teams where id = p_team_id for update;
  if v_team.id is null then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  if v_team.owner_id <> v_uid then
    raise exception 'Solo el dueño puede agregar staff' using errcode = '42501';
  end if;
  if exists (select 1 from public.team_staff where team_id = p_team_id and user_id = p_user_id) then
    raise exception 'Ya es parte del staff';
  end if;

  insert into public.team_staff (team_id, user_id, role)
  values (p_team_id, p_user_id, p_role::public.staff_role);
  perform public.team_chat_add(p_team_id, p_user_id);

  return jsonb_build_object('message', 'Staff agregado', 'team', public.team_json(v_team, true));
end;
$$;

create function public.remove_team_staff(p_team_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_owner uuid;
begin
  select owner_id into v_owner from public.teams where id = p_team_id;
  if v_owner is null then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  if v_owner <> v_uid then
    raise exception 'Solo el dueño puede remover staff' using errcode = '42501';
  end if;

  delete from public.team_staff where team_id = p_team_id and user_id = p_user_id;
  if not found then
    raise exception 'Staff no encontrado' using errcode = 'P0002';
  end if;
  perform public.team_chat_remove(p_team_id, p_user_id);

  return jsonb_build_object('message', 'Staff removido');
end;
$$;

create function public.request_join_team(p_team_id uuid, p_message text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_owner uuid;
begin
  select owner_id into v_owner from public.teams where id = p_team_id;
  if v_owner is null then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  if v_owner = v_uid
     or exists (select 1 from public.team_players where team_id = p_team_id and user_id = v_uid)
     or exists (select 1 from public.team_staff where team_id = p_team_id and user_id = v_uid) then
    raise exception 'Ya eres miembro de este equipo';
  end if;

  begin
    insert into public.team_join_requests (team_id, user_id, message)
    values (p_team_id, v_uid, left(coalesce(p_message, ''), 500));
  exception when unique_violation then
    raise exception 'Ya tienes una solicitud pendiente para este equipo' using errcode = '23505';
  end;

  return jsonb_build_object('message', 'Solicitud enviada correctamente');
end;
$$;

create function public.review_team_join_request(p_team_id uuid, p_user_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_owner uuid;
begin
  if p_status not in ('accepted', 'rejected') then
    raise exception 'Estado de solicitud inválido';
  end if;

  select owner_id into v_owner from public.teams where id = p_team_id for update;
  if v_owner is null then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  if v_owner <> v_uid then
    raise exception 'Solo el dueño puede revisar solicitudes' using errcode = '42501';
  end if;

  -- Igual que antes: la solicitud procesada se elimina en lugar de guardarse
  delete from public.team_join_requests
  where team_id = p_team_id and user_id = p_user_id and status = 'pending';
  if not found then
    raise exception 'Solicitud no encontrada o ya procesada' using errcode = 'P0002';
  end if;

  if p_status = 'accepted' then
    if (select count(*) from public.team_players where team_id = p_team_id) >= 10 then
      raise exception 'El equipo tiene el máximo de jugadores (10)';
    end if;
    insert into public.team_players (team_id, user_id, role)
    values (p_team_id, p_user_id, 'Flex')
    on conflict do nothing;
    perform public.team_chat_add(p_team_id, p_user_id);
  end if;

  return jsonb_build_object(
    'message', case when p_status = 'accepted' then 'Solicitud aceptada' else 'Solicitud rechazada' end
  );
end;
$$;

-- ── Notificaciones ───────────────────────────────────────────
create function public.mark_notification_read(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications set read = true where id = p_id and recipient_id = public.require_uid();
  if not found then
    raise exception 'Notificación no encontrada' using errcode = 'P0002';
  end if;
  return jsonb_build_object('message', 'Notificación marcada como leída');
end;
$$;

create function public.mark_all_notifications_read()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications set read = true where recipient_id = public.require_uid() and not read;
  return jsonb_build_object('message', 'Todas las notificaciones marcadas como leídas');
end;
$$;

create function public.delete_notification(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications where id = p_id and recipient_id = public.require_uid();
  if not found then
    raise exception 'Notificación no encontrada' using errcode = 'P0002';
  end if;
  return jsonb_build_object('message', 'Notificación eliminada');
end;
$$;

-- ── Mensajería ───────────────────────────────────────────────
create function public.get_or_create_direct_conversation(p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_conv_id uuid;
begin
  if p_target is null then
    raise exception 'targetUserId es obligatorio';
  end if;
  if p_target = v_uid then
    raise exception 'No puedes crear una conversación contigo mismo';
  end if;
  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'Usuario no encontrado' using errcode = 'P0002';
  end if;

  -- Evita crear dos chats directos si ambos usuarios lo abren a la vez
  perform pg_advisory_xact_lock(hashtextextended(least(v_uid, p_target)::text || greatest(v_uid, p_target)::text, 0));

  select c.id into v_conv_id
  from public.conversations c
  where c.type = 'direct'
    and exists (select 1 from public.conversation_participants where conversation_id = c.id and user_id = v_uid)
    and exists (select 1 from public.conversation_participants where conversation_id = c.id and user_id = p_target)
    and (select count(*) from public.conversation_participants where conversation_id = c.id) = 2
  limit 1;

  if v_conv_id is null then
    insert into public.conversations (type) values ('direct') returning id into v_conv_id;
    insert into public.conversation_participants (conversation_id, user_id)
    values (v_conv_id, v_uid), (v_conv_id, p_target);
    perform public.emit_to_user(p_target, 'conversation:new', public.conversation_json_by_id(v_conv_id, p_target));
  end if;

  return public.conversation_json_by_id(v_conv_id, v_uid);
end;
$$;

create function public.create_group_conversation(p_name text, p_participant_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_all uuid[];
  v_conv_id uuid;
  v_user uuid;
begin
  if nullif(btrim(p_name), '') is null then
    raise exception 'El nombre del grupo es obligatorio';
  end if;
  if coalesce(cardinality(p_participant_ids), 0) < 1 then
    raise exception 'Debe incluir al menos 1 participante además de ti';
  end if;

  v_all := array(select distinct u from unnest(array_append(p_participant_ids, v_uid)) u);
  if cardinality(v_all) < 2 then
    raise exception 'Un grupo necesita al menos 2 participantes';
  end if;
  if cardinality(v_all) > 20 then
    raise exception 'Máximo 20 participantes por grupo';
  end if;
  if (select count(*) from public.profiles where id = any (v_all)) <> cardinality(v_all) then
    raise exception 'Uno o más usuarios no existen';
  end if;

  insert into public.conversations (type, name, admin_id)
  values ('group', btrim(p_name), v_uid)
  returning id into v_conv_id;

  insert into public.conversation_participants (conversation_id, user_id)
  select v_conv_id, u from unnest(v_all) u;

  foreach v_user in array v_all loop
    if v_user <> v_uid then
      perform public.emit_to_user(v_user, 'conversation:new', public.conversation_json_by_id(v_conv_id, v_user));
    end if;
  end loop;

  return public.conversation_json_by_id(v_conv_id, v_uid);
end;
$$;

create function public.send_message(p_conversation_id uuid, p_content text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_content text := btrim(coalesce(p_content, ''));
  v_message public.messages;
  v_json jsonb;
  r record;
begin
  if v_content = '' then
    raise exception 'El mensaje no puede estar vacío';
  end if;
  if char_length(v_content) > 2000 then
    raise exception 'El mensaje es demasiado largo (máx. 2000 caracteres)';
  end if;
  if not public.is_conversation_participant(p_conversation_id) then
    raise exception 'Conversación no encontrada' using errcode = 'P0002';
  end if;

  insert into public.messages (conversation_id, sender_id, content)
  values (p_conversation_id, v_uid, v_content)
  returning * into v_message;

  update public.conversations set
    last_message_content = left(v_content, 100),
    last_message_sender = v_uid,
    last_message_at = v_message.created_at,
    updated_at = now()
  where id = p_conversation_id;

  update public.conversation_participants set last_read_at = v_message.created_at
  where conversation_id = p_conversation_id and user_id = v_uid;

  v_json := public.message_json(v_message);
  for r in select user_id from public.conversation_participants where conversation_id = p_conversation_id loop
    perform public.emit_to_user(r.user_id, 'message:new', v_json);
  end loop;

  return v_json;
end;
$$;

create function public.mark_conversation_read(p_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  r record;
begin
  update public.conversation_participants set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = v_uid;
  if not found then
    raise exception 'Conversación no encontrada' using errcode = 'P0002';
  end if;

  for r in
    select user_id from public.conversation_participants
    where conversation_id = p_conversation_id and user_id <> v_uid
  loop
    perform public.emit_to_user(
      r.user_id, 'message:read',
      jsonb_build_object('conversationId', p_conversation_id, 'userId', v_uid)
    );
  end loop;

  return jsonb_build_object('message', 'Mensajes marcados como leídos');
end;
$$;

-- Helpers internos de chat de equipo: no invocables desde el cliente
revoke execute on function public.team_chat_add(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.team_chat_remove(uuid, uuid) from public, anon, authenticated;
