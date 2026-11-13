---
tags: [premadegg, backlog]
actualizado: 2026-11-13
---

# Backlog de PremadeGG

Lista de mejoras acordada con la usuaria el 2026-10-25. El orden de los pendientes es el acordado; antes de publicar cada punto hay que confirmarlo con ella. Historial detallado en [[CAMBIOS]]. Vuelta al [[INDICE]].

## Hechas y publicadas

- [x] 1 · Rango con emblema del juego (solo icono, junto al karma en el perfil).
- [x] 2 · Disponibilidad por franjas en vez de horas.
- [x] 3/4 · Agentes desde valorant-api para avatares y favoritos, con filtros.
- [x] 10 · Editar, cerrar y eliminar grupos LFG (incluido cambiar Dúo/Trío/5-Stack).
- [x] 11 · Varios roles por jugador.
- [x] Perfil sin nivel de cuenta.
- [x] Emblema de rango más grande (32px en tarjetas, 52px en perfil).
- [x] 5 · "Agregar en el juego": botón **Copiar Riot ID** en perfil, tarjeta de jugador y miembros del detalle LFG. Publicado el 2026-11-05.
- [x] 12 · Palabras malsonantes: censura con asteriscos en general; en biografía y comentarios de valoraciones se bloquea el guardado. Migración `20261103000001_profanity_filter.sql`. Publicado el 2026-11-05.
- [x] 6 · Ajustes de cuenta: cambiar email y contraseña, borrar cuenta (`/settings/account`). Publicado el 2026-11-05.
- [x] Verificación provisional del Riot ID con la tarjeta de jugador (paso 5 del orden de trabajo de [[AUDITORIA-2026-11-05]], mientras no haya RSO). Publicado el 2026-11-09. Migraciones `20261109000001_verificacion_tipos.sql`, `20261109000002_verificacion_riot_id.sql` y `20261109000003_terminos_version.sql`, Edge Function `riot-verify`, sección "Riot ID" en ajustes y "Recupera tu Riot ID" en el onboarding. Detalle en [[CAMBIOS]].
- [x] Borrado de cuenta como vía de evasión del karma (P0 punto 4 de [[AUDITORIA-2026-11-05]]): al borrar una cuenta con valoraciones o suspensión se guardan 90 días un hash del PUUID con el karma y la suspensión, y se heredan al volver a vincular el mismo Riot ID. Publicado el 2026-11-09. Migración `20261109000002_verificacion_riot_id.sql`.
- [x] PUUID privado (tabla `riot_identities`) y desvincular el Riot ID sin borrar la cuenta (P1 16 y P0 3c de [[AUDITORIA-2026-11-05]]). Migración `20261109000004_riot_identities.sql`. Publicado el 2026-11-09.

## Pendientes (en orden)

- [ ] 13 · Moderación de imágenes con un servicio externo (Sightengine o Google Vision). Necesita una cuenta de la usuaria.
- [ ] 7 · Búsqueda de equipo más automática. Falta definir qué es "automático".
- [ ] 8 · Modo claro / oscuro.
- [ ] 9 · Idiomas inglés / español.
- [ ] RSO (login con Riot): necesita clave de producción aprobada por Riot (semanas).

## Pendientes antes de publicar la verificación del Riot ID

Estos puntos salen de la entrada de [[CAMBIOS]] del 2026-11-09. Antes de publicar hay que confirmarlo con la usuaria.

- [x] Versión nueva de los términos `2026-11-09` sin los 15 días de aviso (decisión del titular: los usuarios son amigos). Todas las cuentas vuelven a aceptar.
- [ ] Probar con una cuenta real de Valorant cuánto tarda HenrikDev en mostrar una partida, si `started_at` es el inicio real y si incluye todos los modos (combate a muerte).
- [ ] Ponderación del interés legítimo por escrito (documento interno; borrador en el informe de `auditor-legal`).
- [ ] Revisar si la respuesta de `start` debe decir si el jugador lleva la tarjeta por defecto. Es un dato menor sobre terceros, necesario para dar las instrucciones.
- [ ] Riot ID verificado con un nombre antiguo: hoy hay que resolverlo a mano (`riot_id_stale`).
- [x] `riot-link` no era una sola transacción. Resuelto con la RPC `link_riot_account` (migración `20261109000004_riot_identities.sql`, publicada el 2026-11-09).
- [ ] Preguntar a Riot por HenrikDev como datos de la verificación (paso 5 del orden de [[AUDITORIA-2026-11-05]], todavía sin hacer).
- [x] Publicar (2026-11-09): migraciones, `riot-verify` y las funciones que usan `_shared`, y push.

## Otros pendientes técnicos

- [ ] OAuth de Google y Discord en Supabase cloud.
- [ ] Regenerar `HENRIK_API_KEY`.
- [ ] ~~Pedir una Personal API key de Riot~~: ya no aplica. La página de VALORANT del Developer Portal dice que no admite solicitudes de clave personal; hay que pedir directamente la clave de producción registrando el producto (texto en [[RIOT-REGISTRO]]). Mientras tanto, la clave de desarrollo caduca cada 24 h.
- [ ] Registrar el producto en el Riot Developer Portal y pedir la clave de producción con el texto de [[RIOT-REGISTRO]] (lo envía la titular).
- [x] Traducir los errores de base de datos al editar el perfil (`client/src/app/services/db-errors.ts`). Publicado el 2026-11-05 con el punto 12.
- [ ] Capturas del README: rehechas en producción el 2026-11-13 las de inicio, grupos LFG, jugadores y perfil público. Faltan mensajes, notificaciones, editar perfil y equipos (necesitan sesión).
- [ ] Apagar Render y MongoDB Atlas.

## Flujo de publicación

1. Commit solo con los archivos de la tarea (ver [[CLAUDE]]).
2. Si hay migración: `npx supabase db push --linked --yes` antes del push.
3. Push a `migrate-supabase` y `migrate-supabase:main` (Vercel despliega `main`). Detalles en [[DEPLOY]].
