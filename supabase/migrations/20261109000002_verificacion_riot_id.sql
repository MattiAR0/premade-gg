-- ════════════════════════════════════════════════════════════
-- Verificación del Riot ID y karma que no se limpia al borrar la cuenta.
-- Bloqueantes de AUDITORIA-2026-11-05.md (P0 1 y "borrado de cuenta como vía de evasión").
--
-- 1. Verificación con la tarjeta de jugador (mientras no haya RSO).
--    Ningún servicio de terceros puede leer la tarjeta equipada en directo: solo se ve en las
--    partidas. La Edge Function riot-verify crea un reto en dos partidas, ambas empezadas después
--    del reto: en la primera hay que llevar otra tarjeta (la de por defecto, o cualquiera menos
--    esa si ya la llevabas) y en una posterior volver a la de siempre (baseline_card, la de la
--    última partida al crear el reto). Solo el dueño de la cuenta de Riot puede cambiarla, y que
--    lo haga por su cuenta en ese orden en 24 horas es muy improbable.
--    · Sin verificar se puede usar la web como hasta ahora.
--    · Si un Riot ID lo tiene una cuenta sin verificar, quien lo verifica se lo queda: la otra
--      cuenta pierde el Riot ID, vuelve al onboarding y recibe un aviso.
--    · Un Riot ID verificado no lo puede vincular nadie más.
--
-- 2. Historial de cuentas borradas (90 días).
--    Al borrar una cuenta con valoraciones o una suspensión vigente se guarda un HMAC del PUUID
--    (clave secreta en app_secrets, fuera del repositorio) con la suma y el número de
--    valoraciones y la suspensión. Si en 90 días alguien vincula ese Riot ID, recibe un aviso y
--    hereda la suspensión y el karma bajo siempre (verificarse al volver no lo limpia); el karma
--    bueno, solo si verifica (un suplantador no se lo lleva). No se guarda el PUUID ni el Riot ID.
--    La suspensión heredada no tiene denuncia detrás: va en suspensions.carried_until para que
--    resolve_appeal no la borre al recalcular las suspensiones.
-- ════════════════════════════════════════════════════════════


-- ── 1. Columnas del perfil ───────────────────────────────────
alter table public.profiles
  add column riot_verified_at timestamptz,
  -- Valoraciones heredadas de una cuenta borrada con el mismo Riot ID: cuentan en el karma
  -- y en review_count, aunque las valoraciones en sí ya no existan.
  add column karma_carry_sum integer not null default 0 check (karma_carry_sum >= 0),
  add column karma_carry_count integer not null default 0 check (karma_carry_count >= 0);


-- ── 2. Retos de verificación (privada) ───────────────────────
-- Un reto por usuario; empezar otro sustituye al anterior.
create table public.riot_challenges (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  puuid text not null,
  riot_id text not null,
  region text not null check (region in ('eu', 'na', 'ap', 'kr')),
  -- Tarjeta de la última partida al crear el reto: hay que cambiarla y luego volver a ella
  baseline_card uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  -- Inicio de la partida que cumplió el primer paso (llevar otra tarjeta)
  step1_at timestamptz,
  verified_at timestamptz
);
alter table public.riot_challenges enable row level security;
revoke all on public.riot_challenges from anon, authenticated;


-- ── 3. Historial de cuentas borradas (privada) ───────────────
create table public.riot_account_history (
  puuid_hash text primary key,
  rating_sum integer not null check (rating_sum >= 0),
  rating_count integer not null check (rating_count >= 0),
  suspended_until timestamptz,
  deleted_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days'
);
alter table public.riot_account_history enable row level security;
revoke all on public.riot_account_history from anon, authenticated;

-- Clave del HMAC: aleatoria, generada en cada base de datos y nunca en el repositorio.
-- Sin ella, quien conozca un PUUID no puede comprobar si tiene historial guardado.
create table public.app_secrets (
  name text primary key,
  value bytea not null
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
insert into public.app_secrets (name, value) values ('puuid_hash_key', extensions.gen_random_bytes(32));

create function public.puuid_hash(p_puuid text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(
    extensions.hmac(convert_to(p_puuid, 'UTF8'), (select value from public.app_secrets where name = 'puuid_hash_key'), 'sha256'),
    'hex'
  );
$$;
revoke execute on function public.puuid_hash(text) from public, anon, authenticated;


-- ── 4. Karma con las valoraciones heredadas ──────────────────
create function public.refresh_karma(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles p
  set karma = coalesce(round((s.rating_sum + p.karma_carry_sum)::numeric / nullif(s.rating_count + p.karma_carry_count, 0), 1), 5),
      review_count = s.rating_count + p.karma_carry_count
  from (
    select coalesce(sum(r.rating), 0)::integer as rating_sum, count(*)::integer as rating_count
    from public.reputations r
    where r.target_id = p_id
  ) s
  where p.id = p_id;
$$;
revoke execute on function public.refresh_karma(uuid) from public, anon, authenticated;

-- Igual que en 20261105000003_anti_abuso_karma.sql (bloqueo de la fila incluido), pero con
-- refresh_karma para que cuenten las valoraciones heredadas.
create or replace function public.recalculate_karma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid := coalesce(new.target_id, old.target_id);
  v_old_target uuid := case when tg_op = 'UPDATE' and old.target_id <> new.target_id then old.target_id end;
begin
  perform 1 from public.profiles
  where id = v_target or id = v_old_target
  order by id
  for no key update;

  perform public.refresh_karma(v_target);
  if v_old_target is not null then
    perform public.refresh_karma(v_old_target);
  end if;

  return null;
end;
$$;


-- ── 5. Al borrar la cuenta: guardar el historial ─────────────
create function public.remember_deleted_riot_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sum integer;
  v_count integer;
  v_until timestamptz;
begin
  if old.puuid is null then
    return old;
  end if;

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

  insert into public.riot_account_history (puuid_hash, rating_sum, rating_count, suspended_until)
  values (public.puuid_hash(old.puuid), v_sum, v_count, v_until)
  on conflict (puuid_hash) do update
  set rating_sum = excluded.rating_sum,
      rating_count = excluded.rating_count,
      suspended_until = excluded.suspended_until,
      deleted_at = now(),
      expires_at = now() + interval '90 days';

  return old;
end;
$$;
revoke execute on function public.remember_deleted_riot_account() from public, anon, authenticated;

-- BEFORE DELETE: las valoraciones y la suspensión todavía existen (luego caen en cascada)
create trigger on_profile_deleted_remember_riot
  before delete on public.profiles
  for each row execute function public.remember_deleted_riot_account();


-- ── 6. Al vincular: restaurar el historial ───────────────────
-- La llama riot-link (service_role) después de guardar el Riot ID.
alter table public.suspensions add column carried_until timestamptz;

-- p_verified: quien vincula ha demostrado que la cuenta de Riot es suya.
-- Lo que perjudica (suspensión vigente o karma por debajo del neutro 3,5) se hereda siempre:
-- si no, bastaría con borrar la cuenta y volver. El karma bueno solo se lo lleva quien verifica;
-- si no, un suplantador se quedaría con el de otro. En ese caso el historial se conserva
-- (hasta que caduque) por si vuelve el dueño.
create function public.restore_riot_account(p_user uuid, p_puuid text, p_verified boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.riot_account_history%rowtype;
  v_suspended boolean;
begin
  select * into h from public.riot_account_history
  where puuid_hash = public.puuid_hash(p_puuid)
  for update;

  if not found or h.expires_at <= now() then
    return false;
  end if;

  if not p_verified
     and not coalesce(h.suspended_until > now(), false)
     and h.rating_sum::numeric / nullif(h.rating_count, 0) > 3.5 then
    return false;
  end if;

  delete from public.riot_account_history where puuid_hash = h.puuid_hash;

  perform 1 from public.profiles where id = p_user for no key update;
  update public.profiles
  set karma_carry_sum = karma_carry_sum + h.rating_sum,
      karma_carry_count = karma_carry_count + h.rating_count
  where id = p_user;
  perform public.refresh_karma(p_user);

  v_suspended := h.suspended_until > now();
  if v_suspended then
    insert into public.suspensions (user_id, until, carried_until)
    values (p_user, h.suspended_until, h.suspended_until)
    on conflict (user_id) do update
    set until = greatest(public.suspensions.until, excluded.until),
        carried_until = greatest(public.suspensions.carried_until, excluded.carried_until);
  end if;

  insert into public.notifications (recipient_id, sender_id, type, message)
  values (
    p_user, null, 'riot_history_restored',
    left(
      'Hemos recuperado el karma'
      || case when v_suspended
           then ' y la suspensión (hasta el ' || to_char(h.suspended_until at time zone 'Europe/Madrid', 'DD/MM/YYYY HH24:MI') || ')'
           else '' end
      || ' de una cuenta anterior con este Riot ID que se borró hace menos de 90 días. Si crees que es un error, escríbenos desde el enlace de contacto del pie y lo revisará una persona.',
      300
    )
  );

  return true;
end;
$$;
revoke execute on function public.restore_riot_account(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.restore_riot_account(uuid, text, boolean) to service_role;

-- Igual que en 20261107000002_denuncias_moderacion.sql, pero al revocar un recurso la
-- suspensión heredada de una cuenta borrada (carried_until) se mantiene.
create or replace function public.resolve_appeal(p_report_id uuid, p_reverse boolean, p_note text default '')
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
  -- y con la heredada de una cuenta borrada, si sigue vigente.
  if p_reverse and v_report.suspended_until is not null then
    delete from public.suspensions s
    where s.user_id = v_report.target_user_id
      and (s.carried_until is null or s.carried_until <= now())
      and not exists (
        select 1 from public.reports r
        where r.target_user_id = v_report.target_user_id
          and r.status = 'actioned'
          and r.appeal_status is distinct from 'reversed'
          and r.suspended_until > now()
      );

    with vigente as (
      select max(r.suspended_until) as until
      from public.reports r
      where r.target_user_id = v_report.target_user_id
        and r.status = 'actioned'
        and r.appeal_status is distinct from 'reversed'
        and r.suspended_until > now()
    )
    update public.suspensions s
    set until = greatest(v.until, case when s.carried_until > now() then s.carried_until end)
    from vigente v
    where s.user_id = v_report.target_user_id;
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


-- ── 7. Quitar un Riot ID sin verificar a quien lo tenía ──────
-- La llama riot-link (service_role) cuando quien vincula ha superado el reto.
-- Idempotente: si ya se le quitó (dos peticiones a la vez) no hace nada ni avisa dos veces.
-- La cuenta vuelve al onboarding; se cierran sus grupos LFG y deja de buscar equipo.
create function public.release_unverified_riot_id(p_holder uuid, p_riot_id text, p_puuid text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.profiles%rowtype;
begin
  select * into v from public.profiles where id = p_holder for update;
  if not found or (v.riot_id is distinct from p_riot_id and v.puuid is distinct from p_puuid) then
    return;
  end if;
  if v.riot_verified_at is not null then
    raise exception 'Este Riot ID ya está verificado por otra cuenta.' using errcode = 'P0001';
  end if;

  update public.profiles
  set riot_id = null, puuid = null, onboarded = false, looking_for_team = false,
      card_image = null, account_level = null, last_rank_update = null
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
revoke execute on function public.release_unverified_riot_id(uuid, text, text) from public, anon, authenticated;
grant execute on function public.release_unverified_riot_id(uuid, text, text) to service_role;


-- ── 8. riotVerified en user_json ─────────────────────────────
create or replace function public.user_json(p public.profiles)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    '_id', p.id,
    'riotId', p.riot_id,
    'riotVerified', p.riot_verified_at is not null,
    'region', p.region,
    'rank', p.rank,
    'role', p.role,
    'roles', to_jsonb(p.roles),
    'schedule', p.schedule,
    'karma', p.karma,
    'reviewCount', p.review_count,
    'trustKarma', p.trust_karma,
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


-- ── 9. Limpieza ──────────────────────────────────────────────
select cron.schedule(
  'premadegg-riot-verification-cleanup',
  '17 * * * *',
  $$
    delete from public.riot_challenges where expires_at < now() - interval '1 day';
    delete from public.riot_account_history where expires_at < now();
  $$
);
