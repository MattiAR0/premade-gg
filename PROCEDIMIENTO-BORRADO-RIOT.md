---
tags: [premadegg, riot, privacidad, procedimiento]
actualizado: 2026-11-09
---

# Procedimiento: solicitudes de borrado que reenvía Riot

Documento interno. Vuelta al [[INDICE]]. Lo cita [[RIOT-REGISTRO]] en "Data protection".

## Cuándo se aplica

1. **Riot reenvía una solicitud de borrado** de un jugador (derecho de supresión, art. 17 RGPD). Según los términos de la API de Riot (apartado sobre el RGPD), Riot pasa a los desarrolladores activos "una lista de identificadores" por sus canales; el ejemplo que dan es el `accountId`.
2. **Se pierde el acceso a la API de Riot** (fin de la clave o del registro del producto). Los términos obligan a borrar toda la información del juego. Ver el último apartado.

Un jugador que escribe directamente a PremadeGG no entra aquí: puede desvincular su Riot ID o borrar su cuenta desde Ajustes de cuenta, y si no puede, se atiende como cualquier petición de derechos de la política de privacidad.

## Quién y en qué plazo

- **Responsable:** el titular (Matti Johannes Ahola Rivas).
- **Dónde llegan:** al email de contacto del portal de desarrolladores de Riot y a `premagegg.app@gmail.com`. Revisar los dos al menos una vez por semana.
- **Plazo:** sin dilación y como máximo **un mes** desde que llega la lista (art. 12.3 RGPD). Los términos de Riot no fijan un plazo propio. Si Riot pide uno más corto, se cumple ese.

## Qué identificador llega

PremadeGG guarda el **PUUID** de cada cuenta vinculada (tabla privada `riot_identities`) y el Riot ID (`profiles.riot_id`). No guarda el `accountId`.

- Si la lista trae **PUUID**: se usa tal cual.
- Si trae **Riot ID** (`Nombre#TAG`): buscar primero el PUUID con la consulta del paso 1.
- Si trae **accountId** u otro identificador que no guardamos: responder a Riot pidiendo el PUUID de esos jugadores. Mientras tanto, no hay nada que borrar con ese dato. [PENDIENTE: confirmar con Riot, al registrar el producto, qué identificador mandan para VALORANT.]

## Qué se borra

Todo lo que viene de Riot o identifica al jugador ante Riot:

- `riot_identities`: el PUUID.
- `profiles`: Riot ID, rango, nivel, tarjeta (URL), fecha de actualización del rango y verificación. La cuenta vuelve al onboarding y sus grupos LFG abiertos se cierran.
- `riot_challenges`: retos de verificación con ese PUUID (de cualquier cuenta).
- `riot_identity_hashes` y `riot_account_history`: el hash del PUUID que se guarda 90 días contra la evasión del karma. La solicitud de Riot prevalece sobre ese interés.

No se borra la cuenta de PremadeGG en sí (email, perfil, karma, valoraciones, mensajes): son datos que el usuario dio a PremadeGG y no datos de Riot. Si el jugador quiere borrar también la cuenta, puede hacerlo desde Ajustes de cuenta. Si Riot pide expresamente borrar la cuenta entera, usar el borrado de cuenta (Edge Function `delete-account` o el panel de Supabase, Authentication → Users) después de este procedimiento.

## Pasos

### 1. Buscar al jugador

En el editor SQL de Supabase (proyecto de producción). Sustituye el valor de ejemplo:

```sql
-- Por PUUID
select i.user_id, p.riot_id, p.onboarded
from public.riot_identities i
join public.profiles p on p.id = i.user_id
where i.puuid = 'PUUID-DE-LA-LISTA';

-- Por Riot ID (si la lista no trae PUUID)
select p.id as user_id, p.riot_id, i.puuid
from public.profiles p
left join public.riot_identities i on i.user_id = p.id
where lower(p.riot_id) = lower('Nombre#TAG');
```

Si no sale nada, igualmente ejecuta el paso 2: borra los retos y los hashes que pudiera haber.

### 2. Borrar

Un bloque por PUUID. Todo va en una transacción: o se borra todo o nada.

```sql
do $$
declare
  v_puuid text := 'PUUID-DE-LA-LISTA';
  v_hash text := public.puuid_hash(v_puuid);
  v_user uuid;
begin
  select user_id into v_user from public.riot_identities where puuid = v_puuid;

  if v_user is not null then
    delete from public.riot_identities where user_id = v_user;
    update public.profiles
    set riot_id = null, onboarded = false, riot_verified_at = null, looking_for_team = false,
        rank = null, card_image = null, account_level = null, last_rank_update = null
    where id = v_user;
    update public.lfg_posts set status = 'closed'
    where author_id = v_user and status in ('open', 'full');
  end if;

  delete from public.riot_challenges where puuid = v_puuid;
  delete from public.riot_identity_hashes where puuid_hash = v_hash;
  delete from public.riot_account_history where puuid_hash = v_hash;

  raise notice 'PUUID borrado. Cuenta afectada: %', coalesce(v_user::text, 'ninguna');
end $$;
```

### 3. Comprobar

```sql
select
  (select count(*) from public.riot_identities where puuid = 'PUUID-DE-LA-LISTA') as identidades,
  (select count(*) from public.riot_challenges where puuid = 'PUUID-DE-LA-LISTA') as retos,
  (select count(*) from public.riot_identity_hashes where puuid_hash = public.puuid_hash('PUUID-DE-LA-LISTA')) as hashes,
  (select count(*) from public.riot_account_history where puuid_hash = public.puuid_hash('PUUID-DE-LA-LISTA')) as historial;
```

Todo tiene que dar 0.

### 4. Texto libre que puede contener el Riot ID

El Riot ID puede aparecer escrito en avisos (`notifications.message`) y en la copia del contenido de las denuncias (`reports.snapshot`). Buscarlo:

```sql
select id, created_at from public.notifications where message ilike '%Nombre#TAG%';
select id, created_at from public.reports where snapshot::text ilike '%Nombre#TAG%';
```

- Los avisos caducan solos (30 días; los de moderación, 7 meses). Si hay alguno, borrarlo.
- Las denuncias se conservan 12 meses para atender reclamaciones (política de privacidad). Si una contiene el Riot ID, se mantiene hasta su plazo salvo que el jugador o Riot pidan expresamente su supresión y no haya una reclamación abierta. Anota la decisión.

### 5. Avisar al usuario

Si había una cuenta afectada, escribe al email de esa cuenta (Authentication → Users en Supabase). Plantilla:

> Hola. Riot Games nos ha trasladado una solicitud de supresión de los datos de tu cuenta de Riot. Hemos desvinculado tu Riot ID de PremadeGG y borrado los datos que venían de Riot (Riot ID, identificador, rango, nivel y tarjeta). Tu cuenta de PremadeGG sigue activa; si quieres borrarla también, puedes hacerlo desde Ajustes de cuenta. Si no pediste esto, responde a este correo.

### 6. Registro

Anota cada solicitud (fecha de llegada, fecha de borrado, cuántos identificadores, si había cuenta afectada y el paso 4) **fuera del repositorio**, que es público: por ejemplo, en una hoja privada o respondiendo al propio email de Riot. No apuntes el PUUID ni el Riot ID en claro en ese registro: basta con la fecha y el número de identificadores.

### 7. Copias de seguridad

Las copias de seguridad de Supabase conservan los datos borrados hasta que caducan. No se restauran para otra cosa que recuperar el servicio; si alguna vez se restaura una, repetir este procedimiento con las solicitudes atendidas desde la fecha de la copia. [PENDIENTE: comprobar en el panel de Supabase cuántos días guarda las copias el plan actual y ponerlo en la política de privacidad.]

## Si se pierde el acceso a la API de Riot

Los términos de la API obligan a borrar "toda la información del juego" que tengamos. En ese caso:

1. Desactivar el vínculo: retirar las Edge Functions `riot-link`, `riot-verify`, `riot-validate` y `riot-refresh` (`supabase functions delete <nombre>`).
2. Borrar los datos de Riot de todas las cuentas en una transacción:

```sql
begin;
delete from public.riot_identities;
delete from public.riot_challenges;
delete from public.riot_identity_hashes;
delete from public.riot_account_history;
update public.profiles
set riot_id = null, onboarded = false, riot_verified_at = null, looking_for_team = false,
    rank = null, card_image = null, account_level = null, last_rank_update = null;
update public.lfg_posts set status = 'closed' where status in ('open', 'full');
commit;
```

3. Avisar a los usuarios en la web y por email, y actualizar la política de privacidad y los términos.
