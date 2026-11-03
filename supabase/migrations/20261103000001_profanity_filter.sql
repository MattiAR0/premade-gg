-- ════════════════════════════════════════════════════════════
-- Filtro de palabras malsonantes (punto 12 del backlog).
--
-- Regla única en la base de datos, aplicada con triggers en las tablas que
-- escriben las RPC, así cubre también las RPC futuras:
--   · Bloqueo con error 23514 (detail 'profanity:<campo>'): biografía del
--     perfil, comentario de valoraciones y nombres visibles que no admiten
--     asteriscos (nombre y tag de equipo, nombre de chat de grupo).
--   · Censura con asteriscos: el resto de textos libres (grupos LFG,
--     descripciones de equipo, mensajes, solicitudes, detalles LFT/coach).
--
-- Variantes cubiertas: mayúsculas, tildes, letras repetidas ("puuuta") y
-- sustituciones típicas (0→o, 1→i, 3→e, 4/@→a, 5/$→s, 7→t) en palabras que
-- tengan al menos una letra ("455" no cuenta). Solo palabras completas, para
-- no tocar "computadora" o "disputa". No cubre separaciones ("p u t a"),
-- sufijos fuera de la lista ("puta2") ni homoglifos.
--
-- Los triggers solo miran un texto si cambia: lo guardado antes de esta
-- migración no se modifica ni impide guardar el resto de la fila.
-- Las funciones auxiliares no se exponen por la API (revoke al final).
-- ════════════════════════════════════════════════════════════

-- ── Normalización ────────────────────────────────────────────
-- translate y lower cambian carácter a carácter, así que las posiciones del
-- texto normalizado coinciden con las del original (lo usa profanity_tokens).
create function public.profanity_normalize(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select translate(lower(p_text), 'áàâäãéèêëíìîïóòôöõúùûü013457@$', 'aaaaaeeeeiiiiooooouuuuoieastas');
$$;

-- ── Lista de palabras ────────────────────────────────────────
-- Palabras en minúscula y sin tildes. Cada letra admite repeticiones (p+u+t+a+).
-- Para ampliar la lista: create or replace en una migración nueva.
create function public.profanity_pattern()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select '^(?:' || string_agg(regexp_replace(w, '(.)', '\1+', 'g'), '|' order by length(w) desc, w) || ')$'
  from unnest(array[
    -- Español
    'puta', 'putas', 'puto', 'putos', 'putada', 'putadas', 'putear',
    'hijoputa', 'hijoputas', 'hijodeputa', 'hijueputa',
    'mierda', 'mierdas', 'mierdoso', 'mierdosa',
    'joder', 'jodete', 'jodido', 'jodida', 'jodidos', 'jodidas',
    'coño', 'cojones', 'carajo', 'follar', 'follando', 'ojete',
    'cabron', 'cabrona', 'cabrones', 'cabronas',
    'gilipollas', 'gilipolla', 'capullo', 'capullos',
    'pendejo', 'pendeja', 'pendejos', 'pendejas', 'pendejada',
    'maricon', 'maricones', 'marica', 'maricas',
    'polla', 'pollas', 'zorra', 'zorras',
    'imbecil', 'imbeciles', 'subnormal', 'subnormales',
    'mamon', 'mamona', 'mamones', 'mamada',
    'culero', 'culera', 'culeros', 'verga', 'vergas',
    'chingar', 'chinga', 'chingada', 'chingado', 'chingadera',
    'malparido', 'malparida', 'malparidos', 'conchatumadre',
    'sudaca', 'sudacas', 'negrata', 'negratas',
    -- Inglés
    'fuck', 'fucks', 'fucked', 'fucker', 'fuckers', 'fucking', 'fuckin',
    'motherfucker', 'motherfuckers',
    'shit', 'shits', 'shitty', 'bullshit',
    'bitch', 'bitches', 'ass', 'asshole', 'assholes', 'bastard', 'bastards',
    'cunt', 'cunts', 'dickhead', 'prick', 'pussy', 'twat', 'wanker',
    'whore', 'whores', 'slut', 'sluts',
    'nigger', 'niggers', 'nigga', 'niggas', 'faggot', 'faggots', 'fag', 'fags',
    'retard', 'retards', 'retarded', 'kys'
  ]) as t(w);
$$;

-- ── Detección y censura ──────────────────────────────────────
-- Parte el texto en palabras y separadores y marca las palabras malsonantes.
-- Una sola pasada: el coste crece en línea con la longitud del texto.
create function public.profanity_tokens(p_text text)
returns table (ord bigint, token text, bad boolean)
language sql
immutable
parallel safe
set search_path = ''
as $$
  with parts as (
    select r.ord, r.m[1] as norm,
      sum(length(r.m[1])) over (order by r.ord) - length(r.m[1]) + 1 as pos
    from regexp_matches(public.profanity_normalize(p_text), '(\w+|\W+)', 'g') with ordinality as r(m, ord)
  )
  select p.ord, substr(p_text, p.pos::int, length(p.norm)),
    p.norm ~ public.profanity_pattern() and substr(p_text, p.pos::int, length(p.norm)) ~ '[[:alpha:]]'
  from parts p;
$$;

create function public.has_profanity(p_text text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(p_text <> '' and exists (select 1 from public.profanity_tokens(p_text) t where t.bad), false);
$$;

-- Sustituye cada palabra malsonante por tantos asteriscos como letras tenga.
create function public.censor_profanity(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case when p_text is null or p_text = '' then p_text else (
    select string_agg(case when t.bad then repeat('*', length(t.token)) else t.token end, '' order by t.ord)
    from public.profanity_tokens(p_text) t
  ) end;
$$;

-- ── Triggers genéricos ───────────────────────────────────────
-- security definer: llaman a las funciones auxiliares, que no son públicas.

-- Argumentos: nombres de columnas de texto a censurar.
create function public.censor_profanity_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_patch jsonb := '{}';
  v_col text;
begin
  foreach v_col in array tg_argv loop
    if not v_row ? v_col then
      raise exception 'censor_profanity_columns: la columna % no existe en %', v_col, tg_table_name;
    end if;
    continue when tg_op = 'UPDATE' and v_row ->> v_col is not distinct from v_old ->> v_col;
    if public.has_profanity(v_row ->> v_col) then
      v_patch := v_patch || jsonb_build_object(v_col, public.censor_profanity(v_row ->> v_col));
    end if;
  end loop;
  if v_patch <> '{}' then
    new := jsonb_populate_record(new, v_patch);
  end if;
  return new;
end;
$$;

-- Argumentos: pares (columna, mensaje de error).
create function public.block_profanity_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_col text;
begin
  for i in 0 .. tg_nargs - 1 by 2 loop
    v_col := tg_argv[i];
    if not v_row ? v_col then
      raise exception 'block_profanity_columns: la columna % no existe en %', v_col, tg_table_name;
    end if;
    continue when tg_op = 'UPDATE' and v_row ->> v_col is not distinct from v_old ->> v_col;
    if public.has_profanity(v_row ->> v_col) then
      raise exception using
        message = tg_argv[i + 1],
        errcode = '23514',
        detail = 'profanity:' || v_col;
    end if;
  end loop;
  return new;
end;
$$;

-- ── Bloqueo ──────────────────────────────────────────────────
create trigger profiles_block_profanity
  before insert or update of bio on public.profiles
  for each row execute function public.block_profanity_columns(
    'bio', 'Tu biografía contiene palabras malsonantes. Cámbiala para poder guardar el perfil.'
  );

create trigger reputations_block_profanity
  before insert or update of comment on public.reputations
  for each row execute function public.block_profanity_columns(
    'comment', 'Tu comentario contiene palabras malsonantes. Cámbialo para poder publicar la valoración.'
  );

-- Nombres visibles: con asteriscos quedarían ilegibles y chocarían con el unique.
create trigger teams_block_profanity
  before insert or update of name, tag on public.teams
  for each row execute function public.block_profanity_columns(
    'name', 'El nombre del equipo contiene palabras malsonantes. Elige otro.',
    'tag', 'El tag del equipo contiene palabras malsonantes. Elige otro.'
  );

create trigger conversations_block_profanity
  before insert or update of name on public.conversations
  for each row execute function public.block_profanity_columns(
    'name', 'El nombre del grupo contiene palabras malsonantes. Elige otro.'
  );

-- ── Censura con asteriscos ───────────────────────────────────
create trigger profiles_censor_profanity
  before insert or update of lft_details, coach_details, schedule on public.profiles
  for each row execute function public.censor_profanity_columns('lft_details', 'coach_details', 'schedule');

create trigger lfg_posts_censor_profanity
  before insert or update of title, description on public.lfg_posts
  for each row execute function public.censor_profanity_columns('title', 'description');

create trigger teams_censor_profanity
  before insert or update of description, recruiting_details on public.teams
  for each row execute function public.censor_profanity_columns('description', 'recruiting_details');

create trigger team_join_requests_censor_profanity
  before insert or update of message on public.team_join_requests
  for each row execute function public.censor_profanity_columns('message');

create trigger messages_censor_profanity
  before insert or update of content on public.messages
  for each row execute function public.censor_profanity_columns('content');

-- send_message copia el texto sin censurar en la vista previa de la conversación.
create trigger conversations_censor_profanity
  before insert or update of last_message_content on public.conversations
  for each row execute function public.censor_profanity_columns('last_message_content');

-- ── Permisos ─────────────────────────────────────────────────
-- Ni la lista ni el cálculo quedan expuestos por PostgREST.
revoke execute on function public.profanity_normalize(text) from public, anon, authenticated;
revoke execute on function public.profanity_pattern() from public, anon, authenticated;
revoke execute on function public.profanity_tokens(text) from public, anon, authenticated;
revoke execute on function public.has_profanity(text) from public, anon, authenticated;
revoke execute on function public.censor_profanity(text) from public, anon, authenticated;
revoke execute on function public.censor_profanity_columns() from public, anon, authenticated;
revoke execute on function public.block_profanity_columns() from public, anon, authenticated;
