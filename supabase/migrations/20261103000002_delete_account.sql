-- ════════════════════════════════════════════════════════════
-- Borrado de cuenta (Edge Function delete-account → auth.admin.deleteUser).
--
-- Al borrar auth.users, la fila de profiles cae en cascada y con ella todo
-- lo que cuelga del usuario (las FK ya son on delete cascade):
--   · sus grupos LFG y sus solicitudes en grupos ajenos
--   · las valoraciones que escribió y las que recibió (el trigger de
--     reputación recalcula el karma de los jugadores que valoró)
--   · sus plazas en equipos ajenos y sus solicitudes
--   · sus mensajes y notificaciones
-- Se borra en vez de anonimizar: una valoración o un mensaje sin autor no
-- aporta nada y el karma de los demás no puede depender de una cuenta que
-- ya no existe.
--
-- La cascada deja algunos datos incoherentes; este trigger los arregla
-- antes de que se borre el perfil y avisa por Realtime a quien le afecte:
--   1. Grupos LFG ajenos llenos en los que estaba aceptado → vuelven a 'open'.
--   2. Equipos que creó → pasan al jugador más antiguo, si no al coach y si
--      no al staff más antiguo. Solo se borran si no queda nadie más.
--   3. Chats directos con él → se borran (el otro se quedaría hablando solo).
--   4. Chats de grupo (no de equipo) que administraba → admin al participante
--      más antiguo; si no queda nadie más, se borra el chat.
--   5. Sus mensajes y su participación en los chats que siguen vivos → fuera,
--      con la vista previa del último mensaje recalculada.
-- ════════════════════════════════════════════════════════════

create function public.cleanup_deleted_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_owner uuid;
  v_convs uuid[];
begin
  -- 1. Plazas que deja libres en grupos LFG ajenos
  update public.lfg_posts p
  set status = 'open'
  where p.status = 'full'
    and p.author_id <> old.id
    and exists (
      select 1 from public.lfg_members m
      where m.post_id = p.id and m.user_id = old.id and m.status = 'accepted'
    );

  -- 2. Equipos que creó: no se llevan por delante a los demás miembros
  for r in select t.id, t.coach_id from public.teams t where t.owner_id = old.id loop
    v_owner := coalesce(
      (select tp.user_id from public.team_players tp
       where tp.team_id = r.id and tp.user_id <> old.id
       order by tp.joined_at, tp.user_id limit 1),
      nullif(r.coach_id, old.id),
      (select ts.user_id from public.team_staff ts
       where ts.team_id = r.id and ts.user_id <> old.id
       order by ts.joined_at, ts.user_id limit 1)
    );
    if v_owner is not null then
      update public.teams set owner_id = v_owner where id = r.id;
      update public.conversations set admin_id = v_owner where team_id = r.id;
    end if;
  end loop;

  -- 3. Chats directos en los que participa: se avisa al otro y se borran
  for r in
    select c.id, other.user_id
    from public.conversations c
    join public.conversation_participants me on me.conversation_id = c.id and me.user_id = old.id
    join public.conversation_participants other on other.conversation_id = c.id and other.user_id <> old.id
    where c.type = 'direct'
  loop
    perform public.emit_to_user(r.user_id, 'conversation:removed', jsonb_build_object('conversationId', r.id));
  end loop;

  delete from public.conversations c
  where c.type = 'direct'
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = c.id and cp.user_id = old.id
    );

  -- 4. Chats de grupo sin nadie más: se borran
  delete from public.conversations c
  where c.type = 'group'
    and c.team_id is null
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = c.id and cp.user_id = old.id
    )
    and not exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = c.id and cp.user_id <> old.id
    );

  --    Chats de grupo que administraba: pasan al participante más antiguo
  update public.conversations c
  set admin_id = (
    select cp.user_id from public.conversation_participants cp
    where cp.conversation_id = c.id and cp.user_id <> old.id
    order by cp.joined_at, cp.user_id
    limit 1
  )
  where c.admin_id = old.id and c.team_id is null;

  -- 5. Chats que siguen vivos: se le quita ya (la cascada llegaría tarde)
  --    para recalcular la vista previa y avisar con los datos finales
  v_convs := array(select cp.conversation_id from public.conversation_participants cp where cp.user_id = old.id);

  delete from public.messages where sender_id = old.id;
  delete from public.conversation_participants where user_id = old.id;

  update public.conversations c
  set (last_message_content, last_message_sender, last_message_at) = (
    select m.content, m.sender_id, m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  )
  where c.last_message_sender = old.id;

  for r in
    select cp.conversation_id, cp.user_id
    from public.conversation_participants cp
    where cp.conversation_id = any (v_convs)
  loop
    perform public.emit_to_user(
      r.user_id, 'conversation:updated', public.conversation_json_by_id(r.conversation_id, r.user_id)
    );
  end loop;

  return old;
end;
$$;

-- Solo la usa el trigger
revoke execute on function public.cleanup_deleted_profile() from public, anon, authenticated;

create trigger on_profile_deleted
  before delete on public.profiles
  for each row execute function public.cleanup_deleted_profile();

-- ── Índices para que el borrado no recorra tablas enteras ────
create index messages_sender_idx on public.messages (sender_id);
create index conversations_admin_idx on public.conversations (admin_id);
create index conversations_last_sender_idx on public.conversations (last_message_sender);
