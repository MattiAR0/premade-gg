-- ════════════════════════════════════════════════════════════
-- PUUID privado, vincular en una sola transacción y desvincular el Riot ID sin borrar la cuenta.
-- Pendientes de AUDITORIA-2026-11-05.md (P1 16 y P0 3c) antes de presentar el producto a Riot.
--
-- 1. El PUUID sale de profiles (legible por cualquiera con un select directo) y pasa a
--    riot_identities, privada: solo la leen las Edge Functions (service_role) y las funciones
--    security definer. Revocar solo la columna no servía: las RPC de lectura son security
--    invoker y usan la fila entera de profiles.
-- 2. riot_identity_hashes: HMAC de los PUUID que una cuenta tuvo vinculados en los últimos 90
--    días (al desvincular o al cambiar de Riot ID). Si la cuenta se borra, el historial de karma
--    de 20261109000002 se guarda también con esos hashes: cambiar de Riot ID o desvincular y
--    después borrar la cuenta no limpia el karma del Riot ID anterior.
-- 3. link_riot_account: todo el vínculo en una transacción (quitar el Riot ID a las cuentas sin
--    verificar que lo tenían, aceptar los términos, guardar el PUUID, actualizar el perfil y
--    restaurar el historial). Antes riot-link lo hacía en varias llamadas y un fallo a mitad
--    podía dejar a alguien sin Riot ID o una identidad sin perfil.
-- 4. unlink_my_riot_account: el jugador desvincula su cuenta de Riot y se borran el Riot ID,
--    el PUUID, el rango, el nivel y la tarjeta. La cuenta de PremadeGG sigue (perfil, karma,
--    valoraciones, mensajes) y vuelve al onboarding.
--
-- Despliegue: aplicar esta migración y desplegar enseguida riot-link y riot-verify (las
-- versiones anteriores leen profiles.puuid).
-- ════════════════════════════════════════════════════════════


-- ── 1. Tablas privadas ───────────────────────────────────────
create table public.riot_identities (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  puuid text not null unique
);
alter table public.riot_identities enable row level security;
revoke all on public.riot_identities from anon, authenticated;

insert into public.riot_identities (user_id, puuid)
select id, puuid from public.profiles where puuid is not null;

alter table public.profiles drop column puuid;

create table public.riot_identity_hashes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  puuid_hash text not null,
  until timestamptz not null,
  primary key (user_id, puuid_hash)
);
alter table public.riot_identity_hashes enable row level security;
revoke all on public.riot_identity_hashes from anon, authenticated;

-- Guarda 90 días el hash de un PUUID que la cuenta deja de tener vinculado
create function public.remember_riot_identity_hash(p_user uuid, p_puuid text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.riot_identity_hashes (user_id, puuid_hash, until)
  values (p_user, public.puuid_hash(p_puuid), now() + interval '90 days')
  on conflict (user_id, puuid_hash) do update set until = excluded.until;
$$;
revoke execute on function public.remember_riot_identity_hash(uuid, text) from public, anon, authenticated;


-- ── 2. Vincular (riot-link) ──────────────────────────────────
-- riot-link valida la cuenta en Riot, pide rango y tarjeta a HenrikDev y llama a esta función
-- con el resultado. Los errores llevan en `hint` el código que ve el cliente.
create function public.link_riot_account(
  p_user uuid,
  p_puuid text,
  p_riot_id text,
  p_region text,
  p_rank text,
  p_role text,
  p_schedule text,
  p_account_level integer,
  p_card_image text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_puuid text;
  v_was_verified timestamptz;
  v_verified boolean;
  v_restored boolean;
  h record;
begin
  select riot_verified_at into v_was_verified from public.profiles where id = p_user for update;
  if not found then
    raise exception 'Perfil no encontrado' using errcode = 'P0002';
  end if;
  select puuid into v_current_puuid from public.riot_identities where user_id = p_user for update;

  -- Reto de la tarjeta superado (riot-verify) o mismo Riot ID ya verificado
  v_verified := exists (
      select 1 from public.riot_challenges c
      where c.user_id = p_user and c.puuid = p_puuid and c.verified_at is not null and c.expires_at > now()
    )
    or (v_current_puuid = p_puuid and v_was_verified is not null);

  -- Otras cuentas con este Riot ID o esta cuenta de Riot
  for h in
    select p.id, p.riot_verified_at, i.puuid
    from public.profiles p
    left join public.riot_identities i on i.user_id = p.id
    where p.id <> p_user and (p.riot_id = p_riot_id or i.puuid = p_puuid)
    order by p.id
    for update of p
  loop
    if h.riot_verified_at is not null then
      if h.puuid is distinct from p_puuid then
        -- Verificado con otro PUUID: un nombre que esa cuenta de Riot ya no usa
        raise exception 'Ese Riot ID figura en otra cuenta con un nombre que ya no usa. Escríbenos desde el enlace de contacto del pie y lo resolvemos.'
          using errcode = 'P0001', hint = 'riot_id_stale';
      end if;
      raise exception 'Este Riot ID ya está registrado y verificado por otra cuenta. Si crees que es un error, escríbenos desde el enlace de contacto del pie.'
        using errcode = 'P0001', hint = 'riot_id_verified';
    end if;
    if not v_verified then
      raise exception 'Este Riot ID ya está registrado por otra cuenta. Si es tuyo, demuéstralo con tu tarjeta de jugador y lo recuperas.'
        using errcode = 'P0001', hint = 'riot_id_claimable';
    end if;
    perform public.release_unverified_riot_id(h.id, p_riot_id, p_puuid);
  end loop;

  -- Prueba de la aceptación de los términos (riot-link exige acceptTerms)
  insert into public.consents (user_id, document, version)
  values (p_user, 'terms_privacy', public.current_terms_version())
  on conflict do nothing;

  -- Cambio de Riot ID: el anterior se recuerda 90 días
  if v_current_puuid is not null and v_current_puuid <> p_puuid then
    perform public.remember_riot_identity_hash(p_user, v_current_puuid);
  end if;
  delete from public.riot_identity_hashes where user_id = p_user and puuid_hash = public.puuid_hash(p_puuid);

  insert into public.riot_identities (user_id, puuid)
  values (p_user, p_puuid)
  on conflict (user_id) do update set puuid = excluded.puuid;

  update public.profiles
  set riot_id = p_riot_id,
      region = p_region::public.region,
      rank = p_rank::public.valorant_rank,
      role = p_role::public.valorant_role,
      schedule = p_schedule,
      account_level = p_account_level,
      card_image = p_card_image,
      last_rank_update = now(),
      riot_verified_at = case
        when not v_verified then null
        when v_current_puuid = p_puuid then coalesce(v_was_verified, now())
        else now()
      end,
      onboarded = true
  where id = p_user;

  delete from public.riot_challenges where user_id = p_user;

  -- Karma y suspensión de una cuenta borrada con este Riot ID (90 días)
  v_restored := public.restore_riot_account(p_user, p_puuid, v_verified);

  return jsonb_build_object('verified', v_verified, 'restored', v_restored);
end;
$$;
revoke execute on function public.link_riot_account(uuid, text, text, text, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.link_riot_account(uuid, text, text, text, text, text, text, integer, text) to service_role;


-- ── 3. Historial al borrar la cuenta: Riot ID actual y anteriores ──
-- Igual que en 20261109000002, pero con el PUUID de riot_identities (la fila todavía existe: el
-- trigger es BEFORE DELETE y la cascada llega después) y con los hashes de los últimos 90 días.
create or replace function public.remember_deleted_riot_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_sum integer;
  v_count integer;
  v_until timestamptz;
begin
  select coalesce(sum(r.rating), 0)::integer, count(*)::integer
  into v_sum, v_count
  from public.reputations r
  where r.target_id = old.id;
  v_sum := v_sum + old.karma_carry_sum;
  v_count := v_count + old.karma_carry_count;

  select s.until into v_until from public.suspensions s where s.user_id = old.id and s.until > now();

  -- Sin valoraciones ni suspensión no hay nada que conservar
  if v_count = 0 and v_until is null then
    return old;
  end if;

  for v_hash in
    select public.puuid_hash(i.puuid) from public.riot_identities i where i.user_id = old.id
    union
    select x.puuid_hash from public.riot_identity_hashes x where x.user_id = old.id and x.until > now()
  loop
    insert into public.riot_account_history (puuid_hash, rating_sum, rating_count, suspended_until)
    values (v_hash, v_sum, v_count, v_until)
    on conflict (puuid_hash) do update
    set rating_sum = excluded.rating_sum,
        rating_count = excluded.rating_count,
        suspended_until = excluded.suspended_until,
        deleted_at = now(),
        expires_at = now() + interval '90 days';
  end loop;

  return old;
end;
$$;


-- ── 4. Quitar un Riot ID sin verificar, con riot_identities ──
-- Igual que en 20261109000002. La cuenta que lo pierde no guarda el hash de ese PUUID: no lo
-- ha soltado ella y pudo ser un suplantador (los hashes de Riot ID anteriores se conservan).
create or replace function public.release_unverified_riot_id(p_holder uuid, p_riot_id text, p_puuid text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.profiles%rowtype;
  v_puuid text;
begin
  select * into v from public.profiles where id = p_holder for update;
  select puuid into v_puuid from public.riot_identities where user_id = p_holder;
  if v.id is null or (v.riot_id is distinct from p_riot_id and v_puuid is distinct from p_puuid) then
    return;
  end if;
  if v.riot_verified_at is not null then
    raise exception 'Este Riot ID ya está verificado por otra cuenta.' using errcode = 'P0001', hint = 'riot_id_verified';
  end if;

  delete from public.riot_identities where user_id = p_holder;

  update public.profiles
  set riot_id = null, onboarded = false, looking_for_team = false,
      rank = null, card_image = null, account_level = null, last_rank_update = null
  where id = p_holder;

  update public.lfg_posts set status = 'closed'
  where author_id = p_holder and status in ('open', 'full');

  insert into public.notifications (recipient_id, sender_id, type, message)
  values (
    p_holder, null, 'riot_id_claimed',
    left(format(
      'Otra cuenta ha demostrado con su tarjeta de jugador que el Riot ID %s es suyo y se lo hemos asignado. Vincula tu propio Riot ID y verifícalo para que nadie más pueda reclamarlo. Si crees que es un error, escríbenos desde el enlace de contacto del pie.',
      coalesce(v.riot_id, p_riot_id)
    ), 300)
  );
end;
$$;


-- ── 5. Desvincular el Riot ID propio ─────────────────────────
create function public.unlink_my_riot_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_puuid text;
  v_riot_id text;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión' using errcode = '42501';
  end if;

  select riot_id into v_riot_id from public.profiles where id = v_uid for update;
  select puuid into v_puuid from public.riot_identities where user_id = v_uid for update;
  -- Basta con uno de los dos: un perfil antiguo puede tener Riot ID sin PUUID guardado
  if v_puuid is null and v_riot_id is null then
    raise exception 'No tienes ningún Riot ID vinculado.' using errcode = 'P0002';
  end if;

  if v_puuid is not null then
    perform public.remember_riot_identity_hash(v_uid, v_puuid);
  end if;
  delete from public.riot_identities where user_id = v_uid;

  update public.profiles
  set riot_id = null, onboarded = false, riot_verified_at = null, looking_for_team = false,
      rank = null, card_image = null, account_level = null, last_rank_update = null
  where id = v_uid;

  update public.lfg_posts set status = 'closed'
  where author_id = v_uid and status in ('open', 'full');

  delete from public.riot_challenges where user_id = v_uid;

  return jsonb_build_object('message', 'Riot ID desvinculado');
end;
$$;
revoke execute on function public.unlink_my_riot_account() from public, anon;
grant execute on function public.unlink_my_riot_account() to authenticated;


-- ── 6. Limpieza: los hashes de Riot ID anteriores duran 90 días ──
select cron.schedule(
  'premadegg-riot-identities-cleanup',
  '23 * * * *',
  $$ delete from public.riot_identity_hashes where until < now(); $$
);
