-- ════════════════════════════════════════════════════════════
-- Filtros del tablero LFG pensados para quien busca grupo:
--   p_my_rank            → grupos a los que puedo unirme con mi rango
--                          (sin rango mínimo o con mínimo ≤ mi rango)
--   p_min_author_karma   → karma mínimo del creador
-- p_min_rank (igualdad exacta) se mantiene por compatibilidad.
-- ════════════════════════════════════════════════════════════

drop function public.get_lfg_posts(int, text, text, uuid, text, int);

create function public.get_lfg_posts(
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
      and (p_min_author_karma is null or author.karma >= p_min_author_karma)
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
      and (p_min_author_karma is null or author.karma >= p_min_author_karma);
  end if;

  return public.paginated(v_data, v_total, v_limit, case when v_count = v_limit then v_last end);
end;
$$;
