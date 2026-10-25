-- ════════════════════════════════════════════════════════════
-- Editar, cerrar y borrar grupos LFG desde el detalle.
-- update_lfg_post ya existía, pero aceptaba cualquier estado: el cliente
-- solo puede cerrar ('closed') o reabrir ('open'). Al reabrir un grupo que
-- ya tiene todas las plazas cubiertas, queda 'full'.
-- Mensajes en español de usuario ("grupo" en vez de "post LFG").
-- ════════════════════════════════════════════════════════════

create or replace function public.update_lfg_post(p_id uuid, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_post public.lfg_posts;
  v_status text := nullif(p_data ->> 'status', '');
  v_next public.lfg_status;
  v_accepted int;
begin
  select * into v_post from public.lfg_posts where id = p_id and expires_at > now() for update;
  if v_post.id is null then
    raise exception 'Grupo no encontrado' using errcode = 'P0002';
  end if;
  if v_post.author_id <> v_uid then
    raise exception 'Solo el creador puede editar este grupo' using errcode = '42501';
  end if;
  if v_status is not null and v_status not in ('open', 'closed') then
    raise exception 'Estado no válido: solo se puede cerrar o reabrir el grupo';
  end if;

  v_next := coalesce(v_status, v_post.status::text)::public.lfg_status;
  if v_status = 'open' then
    select count(*) into v_accepted
    from public.lfg_members where post_id = p_id and status = 'accepted';
    if v_accepted >= v_post.team_size then
      v_next := 'full';
    end if;
  end if;

  update public.lfg_posts lp set
    title = case when p_data ? 'title' then btrim(p_data ->> 'title') else lp.title end,
    description = case when p_data ? 'description' then nullif(btrim(p_data ->> 'description'), '') else lp.description end,
    min_rank = case when p_data ? 'minRank'
      then nullif(p_data ->> 'minRank', '')::public.valorant_rank else lp.min_rank end,
    min_karma = case when p_data ? 'minKarma' then (p_data ->> 'minKarma')::numeric else lp.min_karma end,
    status = v_next
  where lp.id = p_id
  returning * into v_post;

  return public.lfg_post_json(v_post);
end;
$$;

create or replace function public.delete_lfg_post(p_id uuid)
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
    raise exception 'Grupo no encontrado' using errcode = 'P0002';
  end if;
  if v_author <> v_uid then
    raise exception 'Solo el creador puede eliminar este grupo' using errcode = '42501';
  end if;
  delete from public.lfg_posts where id = p_id;
  return jsonb_build_object('message', 'Grupo eliminado');
end;
$$;
