-- ════════════════════════════════════════════════════════════
-- Disponibilidad por franjas en vez de horas.
-- Antes:  {"monday": {"from": "18:00", "to": "23:00", "available": true}, …}
-- Ahora:  {"monday": ["afternoon", "evening"], …}   (día sin franjas = no disponible)
-- Franjas: night = madrugada 00–08 · morning = mañana 08–14 ·
--          afternoon = tarde 14–20 · evening = noche 20–24
-- Los perfiles con el formato antiguo se convierten con las franjas
-- que tocaba su horario (un 22:00–02:00 da noche y madrugada).
-- ════════════════════════════════════════════════════════════

create function pg_temp.slots_from_hours(p_from text, p_to text)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_from numeric;
  v_to numeric;
  v_slots text[] := '{}';
  v_slot record;
begin
  if p_from is null or p_to is null or p_from !~ '^\d{1,2}:\d{2}$' or p_to !~ '^\d{1,2}:\d{2}$' then
    return '[]'::jsonb;
  end if;
  v_from := split_part(p_from, ':', 1)::numeric + split_part(p_from, ':', 2)::numeric / 60;
  v_to := split_part(p_to, ':', 1)::numeric + split_part(p_to, ':', 2)::numeric / 60;
  -- Un horario que pasa de medianoche (22:00–02:00) sigue al día siguiente
  if v_to <= v_from then
    v_to := v_to + 24;
  end if;

  for v_slot in
    select * from (values ('morning', 8, 14), ('afternoon', 14, 20), ('evening', 20, 24), ('night', 0, 8))
      as s(name, s_from, s_to)
  loop
    -- Solapa con la franja de ese día o con la del día siguiente (+24 h)
    if (v_from < v_slot.s_to and v_to > v_slot.s_from)
       or (v_from < v_slot.s_to + 24 and v_to > v_slot.s_from + 24) then
      v_slots := v_slots || v_slot.name;
    end if;
  end loop;

  return to_jsonb(v_slots);
end;
$$;

update public.profiles p
set availability = coalesce((
  select jsonb_object_agg(d.key, d.slots)
  from (
    select e.key,
      case
        when jsonb_typeof(e.value) = 'array' then e.value
        when (e.value ->> 'available')::boolean then pg_temp.slots_from_hours(e.value ->> 'from', e.value ->> 'to')
        else '[]'::jsonb
      end as slots
    from jsonb_each(p.availability) e
  ) d
  where jsonb_array_length(d.slots) > 0
), '{}'::jsonb)
where exists (
  select 1 from jsonb_each(p.availability) e where jsonb_typeof(e.value) = 'object'
);
