---
tags: [premadegg, riot, registro]
actualizado: 2026-11-19
---

# Registro de PremadeGG en el Riot Developer Portal

Vuelta al [[INDICE]]. Contexto en [[BACKLOG]] y [[AUDITORIA-2026-11-05]].

## Notas internas (español, no pegar en el formulario)

**Qué falta antes de enviar** (repasado el 2026-11-19)

- Hecho: 10 capturas; buzón de contacto comprobado; email de confirmación de cuentas nuevas comprobado (SMTP de Gmail); moderadora en producción (MattZ#Hana); clave de desarrollo renovada y probada; 3 cuentas vinculadas y URLs legales con 200, comprobadas hoy.
- **Clave de desarrollo en un producto público.** La página del portal (https://developer.riotgames.com/docs/portal) dice: "You may not maintain a public product with a development API key". PremadeGG ya es pública y usa una clave de desarrollo. El texto lo presenta como lo que es: un prototipo que solo usan la titular y 2 amigos, sin promocionarlo, mientras se pide la clave. Si Riot pide cerrarla hasta la aprobación, se puede desactivar el registro.
- **Cómo es el registro, según el portal:** botón "Register Product", elegir producto de producción (no personal), rellenar el formulario, **verificar el producto** ("just to make sure you're really the developer"; la página no dice cómo) y esperar la revisión de Developer Relations, que responde por mensajes del portal. No hay plazo fijo. Si la verificación pide subir un archivo con un código a la raíz de la web, va en `client/public/` y se publica con un push.
- Procedimiento para solicitudes de borrado reenviadas por Riot: escrito en [[PROCEDIMIENTO-BORRADO-RIOT]] (probado en local). Falta confirmar con Riot qué identificador mandan para VALORANT (no guardamos `accountId`).
- La política de privacidad y los términos son un borrador sin revisar por un abogado (`client/src/app/legal/legal-info.ts`). Riot puede leerlos.
- Los términos `2026-11-09` se publicaron sin los 15 días de aviso (BACKLOG). No lo he mencionado en el texto para Riot.
- Falta la prueba con sesión en producción de desvincular y volver a vincular un Riot ID real (CAMBIOS, 2026-11-09). No bloquea el envío.
- El formulario del portal puede pedir campos que no conozco (tipo de producto, grupo, logo, plataformas). Rellénalo contra el formulario vigente.
- El correo de contacto `premagegg.app@gmail.com` lleva esa "g" a propósito (lo confirmó el titular, ver CAMBIOS del 2026-11-07). El buzón existe y recibe correo (comprobado por la titular el 2026-11-19). Revisarlo al menos una vez por semana.
- El login con Google y Discord no está configurado en producción y los botones están ocultos (2026-11-13). El texto para Riot solo habla del registro con email.
- Anuncios: la titular quiere poner anuncios cuando Riot apruebe el producto (2026-11-13). El texto lo anuncia como posibilidad y promete pedir aprobación antes. Según [[AUDITORIA-2026-11-05]], cambiar la monetización exige aprobación previa por escrito de Riot; no lo he comprobado en la política vigente. Antes de activarlos: política de Riot, banner de cookies con CMP, NIF y domicilio en el aviso legal, privacidad y términos nuevos, y anuncios no personalizados por los menores de 18 (DSA).

**Qué he comprobado en el código y en las políticas**

- Rutas legales (`/privacidad`, `/terminos`, `/aviso-legal`, `/cookies`) existen en `app.routes.ts`.
- Aviso de Riot y "Legal Jibber Jabber" en `client/src/app/app.html` (líneas 54 y 59) y en `/aviso-legal`.
- `account-v1` by-riot-id con `europe.api.riotgames.com` en `supabase/functions/_shared/riot.ts`. La clave va en `RIOT_API_KEY` (secreto de la función).
- Rate limits por usuario/IP: `riot-link` 10/h por usuario; `riot-validate` 30/h por IP; `riot-verify` start 10/h por usuario y 30/h por IP, check 30/h por usuario y 90/h por IP; `delete-account` 5/día; `riot-refresh` 6/h por usuario (añadido el 2026-11-13; solo cuentan las llamadas que salen a HenrikDev) además de la espera de 1 h por jugador, y exige sesión.
- Moderación (migración `20261107000002`): denuncias con motivo, copia del contenido, decisión motivada, recurso en 6 meses, bloqueos y suspensiones. Las denuncias se guardan 12 meses tras resolverse (privacidad, apartado 7).
- Valoraciones: solo entre jugadores que coincidieron 15 minutos (cron `confirm_played_pairs`) y, según el comentario de la migración `20261105000003`, en los últimos 30 días. Sin crear grupos con karma ajustado menor de 3 (`create_lfg_post`).
- Lo que dice la documentación de Riot que he leído hoy (https://developer.riotgames.com/docs/valorant y /policies/general):
  - RSO exige clave de producción; todas las apps de Valorant deben pedir opt-in por RSO.
  - LFG y mostrar estadísticas de jugadores requieren opt-in.
  - No se puede identificar ni analizar a jugadores ocultos, ni mostrar estadísticas de rivales antes de la partida (scouting), ni dar datos en tiempo real que cambien el comportamiento.
  - No se pueden crear alternativas al ranking oficial (calculadoras de MMR/ELO).
  - Hay que mostrar el aviso "isn't endorsed by Riot Games".
  - La clave no puede ir en el código; una clave de producción por producto.
  - La página de políticas generales **no** dice nada sobre almacenamiento o borrado de datos, ni sobre productos de reputación o denuncias. Lo he dejado como práctica propia, sin citar una norma de Riot.
  - "Personal API key": la página dice que no se admiten solicitudes de clave personal. Hay que pedir directamente la clave de producción (el backlog ya está actualizado, 2026-11-13).

**Revisión de `redactor-riot` (2026-11-19)** aplicada: consentimiento sin llamarlo opt-in, vincular un Riot ID ajeno es posible hoy, cita de la política de servicios de datos de Riot sobre HenrikDev, números reales del karma ajustado (una valoración de 1 deja una cuenta nueva en 2,88, por debajo de 3), la excepción del hash en los datos de Riot, monetización solo con estado Approved o Acknowledged, traducción del aviso del onboarding, pie de las capturas locales y la regla de la clave de desarrollo reconocida. Se quitaron de "Data protection" las copias de seguridad, el registro del art. 30 y las brechas (están en la política y en los documentos internos). No se ofreció a Riot dejar HenrikDev: es una decisión de la titular.

**Puntos que Riot puede cuestionar (decidir cómo responder)**

1. **Orden por karma.** El listado `/players` se ordena por karma ajustado descendente (`get_users`, `order by trust_karma desc`, migración `20261025000003`). Es un orden por reputación, no por habilidad, pero puede leerse como un ranking público. El texto lo dice abiertamente. Decisión del titular (2026-11-09): se mantiene. El texto explica que es un orden por reputación y que el rango solo aparece como el icono oficial.
2. **HenrikDev.** Rango, nivel, tarjeta y comprobación de partidas vienen de una API no oficial. Está explicado con claridad en el texto. Riot puede pedir que se quite antes de dar la clave. En el backlog consta "Preguntar a Riot por HenrikDev" sin hacer.
3. **Datos públicos sin cuenta.** Perfiles y listados son públicos, también para quien no tiene cuenta. El onboarding avisa de ello (`onboarding.component.html`, línea 6). Hoy el consentimiento es ese aviso, no RSO.
4. **`riot-validate` es público.** Consulta `account-v1` por IP sin sesión (30/h). Devuelve si el Riot ID existe y si ya está registrado. Se describe como tal.
5. Nombre de dominio: `premade-gg.vercel.app` es un subdominio de Vercel. No sugiere ser oficial.

**Afirmaciones que no he podido verificar**: ver la lista al final de este archivo, en "Sin verificar".

---

# Texto para el portal (inglés, campo a campo)

## Product name

PremadeGG

## Short description

PremadeGG is a free VALORANT looking-for-group (LFG) website. Players who shared a group for at least 15 minutes rate each other from 1 to 5 stars, and the average ("karma") helps others find punctual, communicative and respectful teammates. Karma measures behavior, not skill.

## Detailed description

PremadeGG is a personal, non-commercial project run by one individual in Spain. It helps VALORANT players find a duo, trio or five-stack and amateur teams, and it tries to reduce toxic experiences in the process.

How it works:

- A player creates an account and links their Riot ID.
- They can post or join LFG groups (Duo, Trio or 5-Stack), optionally with a minimum rank and a minimum karma, or join amateur teams. They can message other players inside the site.
- After two players have spent at least 15 minutes together in a group or a team on the site, each can rate the other from 1 to 5 stars and leave a comment about punctuality, communication and attitude.
- A player's karma is the average of the ratings received. Filters and requirements use an adjusted karma that starts neutral (3.5) and moves towards the average as ratings come in. A player with an adjusted karma below 3 cannot create new groups.

What karma is not: it is not a skill ranking and it is not an MMR or ELO estimate. PremadeGG does not compute, estimate or show any hidden rating. The only competitive information shown is the player's current competitive rank, displayed as an icon.


## Use case / user flows

1. **Sign up and link account.** The user signs up with email, accepts the terms and states they are 16 or older, then enters their Riot ID and region. The onboarding screen warns that once linked, the Riot ID, rank, level, player card and karma are visible to anyone, including people without an account.
2. **Find a group.** The user browses the LFG board, filters by group size, rank and minimum karma, or searches players by Riot ID. Groups are closed or deleted by their author and expire after 24 hours.
3. **Join.** Joining a group, or being added to a group or team, requires acceptance by the other party.
4. **Play together in the game.** PremadeGG offers a "Copy Riot ID" button so players can add each other in the VALORANT client. PremadeGG does not use any friend list API and does not interact with the game client.
5. **Rate.** After both players have been members of the same group or team on PremadeGG for at least 15 minutes, each can rate the other (1 to 5) with an optional comment, for up to 30 days. PremadeGG does not check whether a match was played.
6. **Report and moderation.** Any user can report a profile, review, message, team or LFG post with a reason. A moderator decides, and the affected user receives the decision with the reason and can appeal for six months.
7. **Leave.** A user can unlink their Riot ID (their Riot data is deleted, the account stays) or delete their account from Account Settings.

## Riot APIs and endpoints used (with rate)

Used today, with a development key:

| API | Endpoint | Why | When |
|---|---|---|---|
| Riot Account-v1 (europe) | `GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` | Check the Riot ID exists and get the PUUID | Once when a user links an account; also when a user starts a Riot ID verification; also from a public form on sign-up (limited to 30 requests per hour per IP) |

Not an official Riot service (stated for transparency): rank, account level and player card come from HenrikDev (`api.henrikdev.xyz`), an unofficial third-party API. Riot's general policy says products should use Riot's supported services for data ingestion. We use HenrikDev today only because RSO and official rank data need a production key, and we plan to replace it with official Riot services once one is granted (see "RSO plan"). Question for Riot: is this acceptable in the meantime?

HenrikDev is also used for the temporary Riot ID verification: the player changes their player card and plays two matches. PremadeGG reads the card used in that player's last matches (and when they started) to check the change. It does not store the match history; the challenge row lives for up to 2 days.

Request rates:

- Account-v1: one request when linking, one when starting a verification, and one per public sign-up check. Per-user and per-IP limits are enforced in the Edge Functions: linking 10 per hour per user, public check 30 per hour per IP, verification start 10 per hour per user and 30 per hour per IP.
- Rank refresh: at most once per hour per player (server-side cooldown, requires a signed-in session), plus a limit of 6 external lookups per hour per user. This refresh calls HenrikDev, not the Riot API.
- API key: stored only as a secret of Supabase Edge Functions. It is not in the client, the environment files or the repository (the repository is public).

All calls go over HTTPS and have a 10-second timeout. `429` and `401/403` responses are handled without exposing details to the player.

## RSO plan

We know RSO requires a production key and that VALORANT products must ask the player for opt-in. If a production key is granted, we will:

1. Make RSO the only way to link a Riot ID. The Riot ID would come from `/riot/account/v1/accounts/me` after the player signs in with Riot, so nobody could link an account that is not theirs.
2. Remove the temporary card-based verification and the HenrikDev dependency for verification.
3. Keep the existing onboarding warning that linking makes the player's data public, shown before the RSO redirect.
4. Use official data for rank. We would like to use what Riot allows; for example `val-match-v1` to read the competitive tier from the recent matches of the player who gave consent. We would like Riot's guidance on the right source.
5. Keep deleting the player's Riot data when they unlink or delete the account.

RSO is not implemented today. [PENDIENTE: redirect_uri and OAuth client details to enter once Riot confirms the RSO client.]

## How player data is shown (consent)

- PremadeGG only shows data of players who signed up, entered their Riot ID and accepted the public-data warning. Today this consent is a warning in onboarding, not RSO. The only lookup of a Riot ID that is not registered is the sign-up check: it returns whether the ID exists and whether it is already registered, and no profile data is shown.
- Today a user could type a Riot ID that is not theirs. Verification is optional: the real owner can prove ownership with the player-card challenge, and then the Riot ID moves to their account. Anyone can also report an impersonation. RSO (see "RSO plan") will make consent and ownership verifiable for every account.
- Shown for linked players: Riot ID, region, current competitive rank (as an icon), account level, player card, karma, ratings received, roles, availability and bio.
- Not shown, not computed: hidden MMR or ELO, data on opponents, scouting data, hidden or anonymous players, or any real-time data during a match. PremadeGG has no in-game overlay.
- The PUUID is private: it is stored in a table that only server-side functions can read. It was readable through the public API until 2026-11-09 and was moved to a private table on that date.
- The player list is ordered by adjusted karma, highest first. This is a reputation order. Rank appears only as the official icon, is not used to sort the list and is never combined with karma into a score.

## Player safety

Karma and reviews can be abused to harass people, so PremadeGG treats safety as part of the product:

- **Who can rate whom:** only players who spent at least 15 minutes together in a group or team on the site (confirmed by the server, not by the users), within 30 days. Joining groups requires acceptance. Ratings of 1 to 5 plus a comment, at most 10 ratings per user per day (server-side limit).
- **Karma weighting:** filters and requirements use an adjusted karma, (3 × 3.5 + sum of ratings) / (3 + number of ratings), so a new account starts at a neutral 3.5 instead of a perfect score. One 5-star rating moves it to 3.88; one 1-star rating moves it to 2.88, which is below the 3.0 needed to create groups. A player who thinks a rating is unfair can report it ("fake review") and ask for a human review.
- **Reports:** every profile, review, message, team and LFG post has a Report button with a reason (harassment, hate, cheating and others). A snapshot of the content is stored when reported, so a report can be reviewed even if the author edits or deletes it.
- **Moderation:** a human moderator (today, the owner) decides to remove content, suspend the user or take no action, and must write the reason. The reported user gets the decision with its reason. The reporter gets the result.
- **Appeal:** the affected user can appeal each decision once, within 6 months, and it is reviewed again.
- **Blocking:** a user can block another. It works both ways: no direct messages, group chat additions, LFG or team invitations or requests, ratings or notifications between them.
- **Suspensions:** a suspended account cannot write while the suspension lasts, but it can still report and appeal.
- **Profanity filter:** offensive words are censored with asterisks; in the bio and in review comments the text is rejected.
- **Rate limits** on writes in the API.
- **Evading karma:** if an account with ratings or a suspension is deleted, a pseudonymised hash of its PUUID and its karma are kept for 90 days and applied if the same Riot ID is linked again. Unlinking before deleting does not avoid this.
- **No cheating:** the site gives no in-game advantage. It never touches the game client, and it has a "cheating" report reason.
- **Minimum age:** 16, declared on sign-up.

Planned, not done: moderation of uploaded images by an external service (avatars).

## Data protection

- Data controller: an individual in Spain, under GDPR. Database and functions are hosted in the EU (Supabase, Paris); the frontend is on Vercel. No ads and no analytics.
- Riot data stored: Riot ID, PUUID (private table), region, rank, level and player card. Kept until the player unlinks or deletes the account. The only exception is a keyed hash of the PUUID kept for 90 days to prevent karma evasion (see "Unlink").
- **Unlink:** Account Settings, "Unlink Riot ID". It deletes the Riot ID, PUUID, rank, level, player card and verification, closes the user's open groups and returns the account to onboarding. Karma, ratings and messages stay. For 90 days a keyed hash of the PUUID is kept (this is still personal data) only to prevent karma evasion.
- **Delete account:** Account Settings. A server function deletes the account, its uploaded images and all its data, including the Riot data. Reports and moderation decisions are kept for 12 months after being resolved to answer claims, and, if the account had ratings or a suspension, a keyed hash of the PUUID with that karma and suspension is kept for 90 days (see "Player safety").
- Requests to delete data forwarded by Riot: we have a written procedure. The owner checks the developer contact email and the site's contact email at least weekly and acts without undue delay, within one month at most. Players are identified by PUUID (or Riot ID); we store the PUUID, not the accountId, so if Riot sends another identifier we will ask for the PUUID. We delete the Riot ID, PUUID, rank, level, player card, verification challenges and the anti-evasion hash, and we email the affected user. If our API access ends, we delete all Riot data from every account, including the anti-evasion hashes. Question for Riot: which identifier do you send for VALORANT deletion requests?
- The privacy policy names Riot Games and HenrikDev as the sources of the Riot data and lists what is sent to each of them.
- Security: Row Level Security on the tables; private tables (PUUID, reports, suspensions, verification challenges) cannot be read from the public API, and writes go through server-side functions that check the session and the business rules.

## Legal URLs

- Production: https://premade-gg.vercel.app
- Privacy policy: https://premade-gg.vercel.app/privacidad
- Terms of use: https://premade-gg.vercel.app/terminos
- Legal notice: https://premade-gg.vercel.app/aviso-legal
- Cookies: https://premade-gg.vercel.app/cookies

The site and the legal pages are in Spanish only. The public-data warning shown before linking reads, in English: "One last step: we check your Riot ID to show your rank on your profile. Once linked, your Riot ID, rank, level, player card and karma will be visible to anyone, including people without an account. Later you can verify in Account Settings that the Riot account is yours; if you don't and another person proves that the Riot ID is theirs, it will be assigned to them."

The footer shows, in English, "PremadeGG isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.", and the "Legal Jibber Jabber" notice. Agent icons and rank emblems are loaded from valorant-api.com. The legal texts are drafts that have not yet been reviewed by a lawyer.

## Contact

- Name: Matti Johannes Ahola Rivas
- Email: premagegg.app@gmail.com (as published in the legal notice)

## Current status

- Online at https://premade-gg.vercel.app. Sign-up is currently open to anyone, on a development API key that the owner renews by hand. We know the Developer Portal does not allow a public product on a development key. It is a prototype in a test phase with 3 linked accounts (the owner and two friends), and we have not promoted it. We are applying for a production key before opening it to more players. If you ask, we will close sign-ups until the product is approved.
- We have no growth numbers and we don't claim any.
- Working today: LFG groups (Duo/Trio/5-Stack), player search, amateur teams, messages, notifications, ratings with comments, Copy Riot ID, reports, moderation with appeal, blocking, suspensions, profanity filter, rate limits, invitations that must be accepted, account deletion and Riot ID unlinking.
- Not working today: RSO (waiting for a production key), official rank data, moderation of images.
- Monetization: none today (no ads, no analytics, no payments). We may add non-personalized ads in the future, only after the product has Approved or Acknowledged status and after asking Riot. The core features would stay free.

## Screenshots to attach

[Nota interna: todas están en `screenshots/` (1440 px, tema oscuro). Las 1 a 4 y la 10 son de producción (2026-11-13). Las 5 a 9 necesitan sesión y se hicieron en local con los usuarios de prueba del seed (2026-11-17), con la misma web que producción. Si Riot pide capturas de producción, rehacerlas con tu cuenta.]

Screenshots 1 to 4 and 10 were taken in production. Screenshots 5 to 9 were taken from a local build of the same code with test accounts.

1. Home page with the footer showing the Riot disclaimer. (`2026-11-inicio.png`, `2026-11-inicio-pie.png`)
2. LFG board with filters. (`2026-11-tablon-lfg.png`)
3. Player list. (`2026-11-jugadores.png`)
4. Public profile with karma, rank icon and the "Copy Riot ID" button. (`2026-11-perfil-publico.png`)
5. Rating form with comment. (`2026-11-valoracion.png`)
6. Report dialog with reasons. (`2026-11-denuncia.png`; the moderator's queue is in `2026-11-moderacion-cola.png`)
7. Moderation decision page shown to the affected user (with the appeal option). (`2026-11-decision-moderacion.png`)
8. Onboarding with the public-data warning. (`2026-11-onboarding.png`)
9. Account Settings with "Unlink Riot ID" and "Delete account". (`2026-11-ajustes-cuenta.png`)
10. Privacy policy. (`2026-11-privacidad.png`)

## Sin verificar

Esta lista es para ti. No va al formulario. Comprobado después en el código: los grupos caducan a las 24 h (`lfg_posts.expires_at`), un recurso por decisión en 6 meses (`appeal_report`), valorar solo con pareja confirmada en los últimos 30 días (`played_together`), `delete-account` borra los avatares y el usuario (cascada, también `riot_identities`) y `/players` ordena por karma ajustado. Las 3 cuentas vinculadas se comprobaron en la base de producción el 2026-11-09.

- Las 3 cuentas vinculadas: comprobadas de nuevo el 2026-11-19 (MattZ#Hana, Valar Morghulis#NyX y OTP Trebor#EUW). Volver a mirar si pasan días antes de enviar.
- Resuelto el 2026-11-19:
  - límite de valoraciones: 10 por usuario y día (`rl_check(v_key, 'review', 10, 86400)` en `20261105000003`);
  - "Trampas en Valorant" es un motivo de denuncia en la UI (`REPORT_REASONS`);
  - quien denuncia recibe "Hemos revisado tu denuncia…" con el motivo (`20261107000002`, líneas 748-749);
  - el pie con los dos avisos de Riot sale en producción (captura `2026-11-inicio-pie.png`);
  - los textos de desvincular y borrar cuenta se ven en `2026-11-ajustes-cuenta.png`.
- El bloqueo en los dos sentidos está comprobado en el trigger de `20261107000002` (mensajes, chats, grupos, equipos, valoraciones y notificaciones).
- "A new account cannot pass karma filters just by existing": se basa en el comentario de `trust_karma` (media bayesiana, valor neutro 3,5). La UI muestra la media y los filtros usan el karma ajustado.
- Que las políticas de Riot no hablan de borrado de datos ni de reputación: lo dice el resumen que devolvió WebFetch de las dos páginas; puede ser incompleto. Conviene leerlas tú.
