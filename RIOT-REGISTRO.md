---
tags: [premadegg, riot, registro]
actualizado: 2026-11-13
---

# Registro de PremadeGG en el Riot Developer Portal

Vuelta al [[INDICE]]. Contexto en [[BACKLOG]] y [[AUDITORIA-2026-11-05]].

## Notas internas (español, no pegar en el formulario)

**Qué falta antes de enviar**

- Capturas de pantalla (lista al final): hechas la 1 a 4 y la 10; faltan las cinco que necesitan sesión (las hace la titular).
- Procedimiento para solicitudes de borrado reenviadas por Riot: escrito en [[PROCEDIMIENTO-BORRADO-RIOT]] (probado en local). Falta confirmar con Riot qué identificador mandan para VALORANT (no guardamos `accountId`).
- La política de privacidad y los términos son un borrador sin revisar por un abogado (`client/src/app/legal/legal-info.ts`). Riot puede leerlos.
- Los términos `2026-11-09` se publicaron sin los 15 días de aviso (BACKLOG). No lo he mencionado en el texto para Riot.
- Falta la prueba con sesión en producción de desvincular y volver a vincular un Riot ID real (CAMBIOS, 2026-11-09).
- El formulario del portal puede pedir campos que no conozco (tipo de producto, grupo, logo, plataformas). Rellénalo contra el formulario vigente.
- El correo de contacto `premagegg.app@gmail.com` lleva esa "g" a propósito (lo confirmó el titular, ver CAMBIOS del 2026-11-07). Comprobar que el buzón existe y que se revisa: Riot y los usuarios escribirán ahí.
- El login con Google y Discord no está configurado en producción (BACKLOG). El texto para Riot solo habla del registro con email.
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

PremadeGG is a free looking-for-group (LFG) website for VALORANT. Players build a reputation ("karma") from 1 to 5 stars given by players they have actually grouped with, so they can find teammates who are punctual, communicative and respectful. Karma measures behavior, not skill.

## Detailed description

PremadeGG is a personal, non-commercial project run by one individual in Spain. It helps VALORANT players find a duo, trio or five-stack and amateur teams, and it tries to reduce toxic experiences in the process.

How it works:

- A player creates an account and links their Riot ID.
- They can post or join LFG groups (Duo, Trio or 5-Stack), optionally with a minimum rank and a minimum karma, or join amateur teams. They can message other players inside the site.
- After two players have spent at least 15 minutes together in a group or a team on the site, each can rate the other from 1 to 5 stars and leave a comment about punctuality, communication and attitude.
- A player's karma is the average of the ratings received. Filters and requirements use an adjusted karma that starts neutral (3.5) and moves towards the average as ratings come in. A player with an adjusted karma below 3 cannot create new groups.

What karma is not: it is not a skill ranking and it is not an MMR or ELO estimate. PremadeGG does not compute, estimate or show any hidden rating. The only competitive information shown is the player's current competitive rank, displayed as an icon.

PremadeGG has no ads, no analytics and no payments today. In the future we may add non-intrusive, non-personalized ads to cover hosting costs. We would ask Riot for approval before adding them, the core features and all Riot data would stay free, and we will never charge players for access to Riot data.

## Use case / user flows

1. **Sign up and link account.** The user signs up with email, accepts the terms and states they are 16 or older, then enters their Riot ID and region. The onboarding screen warns that once linked, the Riot ID, rank, level, player card and karma are visible to anyone, including people without an account.
2. **Find a group.** The user browses the LFG board, filters by group size, rank and minimum karma, or searches players by Riot ID. Groups are closed or deleted by their author and expire after 24 hours.
3. **Join.** Joining a group, or being added to a group or team, requires acceptance by the other party.
4. **Play together in the game.** PremadeGG offers a "Copy Riot ID" button so players can add each other in the VALORANT client. PremadeGG does not use any friend list API and does not interact with the game client.
5. **Rate.** After 15 minutes together, each player can rate the other (1 to 5) with an optional comment. Ratings are only possible between players who were in the same group or team in the previous 30 days.
6. **Report and moderation.** Any user can report a profile, review, message, team or LFG post with a reason. A moderator decides, and the affected user receives the decision with the reason and can appeal for six months.
7. **Leave.** A user can unlink their Riot ID (their Riot data is deleted, the account stays) or delete their account from Account Settings.

## Riot APIs and endpoints used (with rate)

Used today, with a development key:

| API | Endpoint | Why | When |
|---|---|---|---|
| Riot Account-v1 (europe) | `GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` | Check the Riot ID exists and get the PUUID | Once when a user links an account; also when a user starts a Riot ID verification; also from a public form on sign-up (limited to 30 requests per hour per IP) |

Not an official Riot service (stated for transparency): rank, account level and player card come from HenrikDev (`api.henrikdev.xyz`), an unofficial third-party API. This is a temporary solution. We plan to replace it with official Riot services once a production key is granted (see "RSO plan").

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

## How player data is shown (opt-in)

- PremadeGG only shows data of players who signed up, linked their Riot ID and saw the public-data warning. It does not look up or show data of players who are not registered.
- Shown for linked players: Riot ID, region, current competitive rank (as an icon), account level, player card, karma, ratings received, roles, availability and bio.
- Not shown, not computed: hidden MMR or ELO, data on opponents, scouting data, hidden or anonymous players, or any real-time data during a match. PremadeGG has no in-game overlay.
- The PUUID is private: it is stored in a table that only server-side functions can read. It was readable through the public API until 2026-11-09 and was moved to a private table on that date.
- Browsing the player list: the default order is by adjusted karma, highest first. This is a reputation order, not a skill order: it helps players find reliable teammates first and does not rank anyone by competitive ability. Rank is shown only as the official in-game rank icon and is never combined with karma into a score.

## Player safety

Karma and reviews can be abused to harass people, so PremadeGG treats safety as part of the product:

- **Who can rate whom:** only players who spent at least 15 minutes together in a group or team on the site (confirmed by the server, not by the users), within 30 days. Joining groups requires acceptance. Ratings of 1 to 5 plus a comment; limits apply to repeated or rapid ratings (server-side rate limits on writes).
- **Karma weighting:** accounts start neutral for filtering and requirements, so a new account cannot pass karma filters just by existing, and a single rating cannot make or break a player.
- **Reports:** every profile, review, message, team and LFG post has a Report button with a reason (harassment, hate, cheating and others). A snapshot of the content is stored when reported, so a report can be reviewed even if the author edits or deletes it.
- **Moderation:** moderators decide to remove content, suspend the user or take no action. The reported user gets the decision with its reason. The reporter gets the result.
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
- Riot data stored: Riot ID, PUUID (private table), region, rank, level and player card. Kept until the player unlinks or deletes the account.
- **Unlink:** Account Settings, "Unlink Riot ID". It deletes the Riot ID, PUUID, rank, level, player card and verification, closes the user's open groups and returns the account to onboarding. Karma, ratings and messages stay. For 90 days a keyed hash of the PUUID is kept (this is still personal data) only to prevent karma evasion.
- **Delete account:** Account Settings. A server function deletes the account, its uploaded images and all its data, including the Riot data. Reports and moderation decisions are kept for 12 months after being resolved to answer claims, and, if the account had ratings or a suspension, a keyed hash of the PUUID with that karma and suspension is kept for 90 days (see "Player safety").
- Riot data refresh: at most once per hour per player.
- Backups: our Supabase plan (Free) has no automatic database backups, so deleted data does not survive in any backup. If we move to a paid plan, daily backups are kept for 7 days and we will update the privacy policy before the change.
- Requests to delete data forwarded by Riot: we have a written procedure. The owner checks the developer contact email and the site's contact email at least weekly and acts without undue delay, within one month at most. Players are identified by PUUID (or Riot ID); we store the PUUID, not the accountId, so if Riot sends another identifier we will ask for the PUUID. We delete the Riot ID, PUUID, rank, level, player card, verification challenges and the anti-evasion hash, and we email the affected user. If our API access ends, we delete all Riot data from every account. Question for Riot: which identifier do you send for VALORANT deletion requests?
- The privacy policy names Riot Games and HenrikDev as the sources of the Riot data and lists what is sent to each of them.
- Security: Row Level Security on the tables; private tables (PUUID, reports, suspensions, verification challenges) cannot be read from the public API, and writes go through server-side functions that check the session and the business rules.

## Legal URLs

- Production: https://premade-gg.vercel.app
- Privacy policy: https://premade-gg.vercel.app/privacidad
- Terms of use: https://premade-gg.vercel.app/terminos
- Legal notice: https://premade-gg.vercel.app/aviso-legal
- Cookies: https://premade-gg.vercel.app/cookies

The site and legal pages are currently in Spanish only. The footer shows, in English, "PremadeGG isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.", and the "Legal Jibber Jabber" notice. Agent icons and rank emblems are loaded from valorant-api.com. The legal texts are drafts that have not yet been reviewed by a lawyer.

## Contact

- Name: Matti Johannes Ahola Rivas
- Email: premagegg.app@gmail.com (as published in the legal notice)

## Current status

- In production at https://premade-gg.vercel.app. A personal project in a test phase.
- Linked accounts today: 3, all belonging to friends of the owner. We have no growth numbers and we don't claim any.
- Working today: LFG groups (Duo/Trio/5-Stack), player search, amateur teams, messages, notifications, ratings with comments, Copy Riot ID, reports, moderation with appeal, blocking, suspensions, profanity filter, rate limits, invitations that must be accepted, account deletion and Riot ID unlinking.
- Not working today: RSO (waiting for a production key), official rank data, moderation of images.
- Monetization: none today. Possibly non-personalized ads in the future, only after Riot's approval.

## Screenshots to attach

[Nota interna: las capturas 1 a 4 y 10 están en `screenshots/` (producción, 2026-11-13, 1440 px, tema oscuro). Las 5 a 9 necesitan sesión y las hace la titular; instrucciones en la entrada de CAMBIOS del 2026-11-13. La 10 se rehízo tras publicar la política del 13 de noviembre.]

1. Home page with the footer showing the Riot disclaimer. (`2026-11-inicio.png`, `2026-11-inicio-pie.png`)
2. LFG board with filters. (`2026-11-tablon-lfg.png`)
3. Player list. (`2026-11-jugadores.png`)
4. Public profile with karma, rank icon and the "Copy Riot ID" button. (`2026-11-perfil-publico.png`)
5. Rating form with comment. [PENDIENTE]
6. Report dialog with reasons. [PENDIENTE]
7. Moderation decision page shown to the affected user (with the appeal option). [PENDIENTE]
8. Onboarding with the public-data warning. [PENDIENTE]
9. Account Settings with "Unlink Riot ID" and "Delete account". [PENDIENTE]
10. Privacy policy. (`2026-11-privacidad.png`)

## Sin verificar

Esta lista es para ti. No va al formulario. Comprobado después en el código: los grupos caducan a las 24 h (`lfg_posts.expires_at`), un recurso por decisión en 6 meses (`appeal_report`), valorar solo con pareja confirmada en los últimos 30 días (`played_together`), `delete-account` borra los avatares y el usuario (cascada, también `riot_identities`) y `/players` ordena por karma ajustado. Las 3 cuentas vinculadas se comprobaron en la base de producción el 2026-11-09.

- Las 3 cuentas vinculadas: comprobar de nuevo justo antes de enviar.
- La frase "limits apply to repeated or rapid ratings" se apoya en el comentario de la migración `20261105000003` ("límites de frecuencia en las escrituras"). No leí los números concretos de cada RPC.
- "Cheating" como motivo de denuncia: está en el enum `report_reason`. No leí la lista completa de motivos ni cómo los traduce la UI.
- "Reporter gets the result": comentario de la migración `20261107000002`, sin probar en el navegador. El bloqueo en los dos sentidos está comprobado en el trigger de esa migración (mensajes, chats, grupos, equipos, valoraciones y notificaciones).
- "A new account cannot pass karma filters just by existing": se basa en el comentario de `trust_karma` (media bayesiana, valor neutro 3,5). La UI muestra la media y los filtros usan el karma ajustado.
- El texto exacto del aviso de borrado de cuenta y de desvincular en la UI: me fío de CAMBIOS.
- Que el pie incluya los dos avisos en producción: lo vi en `app.html`, no en el sitio desplegado.
- Que las políticas de Riot no hablan de borrado de datos ni de reputación: lo dice el resumen que devolvió WebFetch de las dos páginas; puede ser incompleto. Conviene leerlas tú.
