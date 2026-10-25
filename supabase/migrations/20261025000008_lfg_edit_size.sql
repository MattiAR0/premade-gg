-- ════════════════════════════════════════════════════════════
-- El creador puede cambiar el tamaño del grupo (Dúo, Trío, 5-Stack).
-- Regla: el nuevo tamaño tiene que dar cabida a los miembros ya aceptados.
-- El estado se recalcula con el tamaño final, salvo que el grupo esté cerrado:
--   aceptados >= tamaño → 'full'; si no → 'open'.
-- Sustituye a update_lfg_post de 20261025000006 (mismas reglas de estado).
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
  v_size int;
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

  select count(*) into v_accepted
  from public.lfg_members where post_id = p_id and status = 'accepted';

  v_size := v_post.team_size;
  if p_data ? 'teamSize' then
    v_size := (p_data ->> 'teamSize')::int;
    if v_size is null or v_size not in (2, 3, 5) then
      raise exception 'Tamaño no válido: Dúo, Trío o 5-Stack';
    end if;
    if v_accepted > v_size then
      raise exception 'El grupo ya tiene % miembros: saca a alguien antes de reducirlo a %', v_accepted, v_size;
    end if;
  end if;

  -- Cerrado se queda cerrado; si no, lleno o abierto según las plazas que quedan
  if coalesce(v_status, v_post.status::text) = 'closed' then
    v_next := 'closed';
  elsif v_accepted >= v_size then
    v_next := 'full';
  else
    v_next := 'open';
  end if;

  update public.lfg_posts lp set
    title = case when p_data ? 'title' then btrim(p_data ->> 'title') else lp.title end,
    description = case when p_data ? 'description' then nullif(btrim(p_data ->> 'description'), '') else lp.description end,
    min_rank = case when p_data ? 'minRank'
      then nullif(p_data ->> 'minRank', '')::public.valorant_rank else lp.min_rank end,
    min_karma = case when p_data ? 'minKarma' then (p_data ->> 'minKarma')::numeric else lp.min_karma end,
    team_size = v_size,
    status = v_next
  where lp.id = p_id
  returning * into v_post;

  return public.lfg_post_json(v_post);
end;
$$;
