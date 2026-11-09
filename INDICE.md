---
tags: [premadegg, indice]
actualizado: 2026-11-09
---

# PremadeGG · Índice del vault

Nota de entrada del vault de Obsidian. La raíz del repositorio es el vault: cada documento `.md` es una nota y se enlaza con `[[Nombre]]`.

Proyecto personal (empezó como TFG): plataforma LFG de Valorant basada en reputación (karma), que se quiere presentar a Riot Games. Frontend Angular en `client/`, backend Supabase en `supabase/`. En producción en premade-gg.vercel.app.

## Estado actual (2026-11-09)

- Rama de trabajo `migrate-supabase`. Lo último publicado (2026-11-09): la verificación provisional del Riot ID, el karma que se conserva al borrar la cuenta y la versión `2026-11-09` de los términos (ver [[CAMBIOS]]).
- Siguiente trabajo: los pendientes de [[BACKLOG]], empezando por decidir si la verificación lleva una versión nueva de los términos.

## Documentos vivos

- [[CLAUDE]]: reglas obligatorias para Claude (diseño, registro de cambios, estilo de respuesta).
- [[CAMBIOS]]: registro de cambios en orden cronológico inverso. Cada cambio añade una entrada.
- [[BACKLOG]]: mejoras hechas, pendientes en orden y flujo de publicación.
- [[DEPLOY]]: despliegue gratuito con Supabase cloud y Vercel.
- [[AUDITORIA-2026-11-05]]: re-auditoría para decidir si se puede presentar a Riot. Veredicto: todavía no; bloqueantes y orden de trabajo.
- [[AUDITORIA-2026-11-03]]: primera auditoría de seguridad, SEO y cumplimiento legal y de Riot, con prioridades.
- [[RIOT-REGISTRO]] · [[PROCEDIMIENTO-BORRADO-RIOT]]: texto en inglés para el registro del producto en el Riot Developer Portal y la clave de producción, con notas internas.
- [[README]]: portada del TFG.

## Registros históricos (no se reescriben)

- [[REDISENO-VALORANT]]: rediseño estilo Valorant del 24/10/2026 (rama `redesign-valorant`, `5d203a2`). Su sección de estado en git ya no es válida.
- [[MIGRACION-SUPABASE]]: migración de MEAN a Supabase del 24/10/2026. Dice "sin commitear"; se commiteó después en `c3aa6ba` y se desplegó el 25/10.
- [[TRASPASO]]: traspaso entre agentes de la segunda ronda de diseño. Obsoleto: todo lo que describe está commiteado.
- [[diario-ia-prompts]]: diario de prompts usados con IA durante el desarrollo.
- `client/README.md`: README del frontend. Desactualizado, describe el backend Express que ya no existe.

## Críticas de diseño (impeccable)

Están en `.impeccable/critique/`. Obsidian oculta las carpetas que empiezan por punto, así que no salen en el grafo; se abren desde el explorador de archivos.

| Fecha | Momento | Nota |
|---|---|---|
| 2026-10-24 12:08 | Primera crítica | 24/40 |
| 2026-10-24 18:58 | Tras la primera ronda (7 pasos) | 26/40 |
| 2026-10-25 15:38 | Tras la segunda ronda (pasos 1 a 6) | 22/40 (revisor más estricto, no comparable 1:1) |

## Backend (supabase/)

**Migraciones** (`supabase/migrations/`):

- `20261024000001_schema.sql`: esquema base, `pg_trgm` y enums.
- `20261024000002_helpers_rls.sql`: helpers, serializadores JSON y RLS (lectura por políticas, escritura solo por RPC).
- `20261024000003_api_read.sql`: RPC de lectura con paginación.
- `20261024000004_api_write.sql`: RPC de escritura `security definer`.
- `20261024000005_triggers_cron.sql`: alta de usuario y tareas cron.
- `20261024000006_storage.sql`: bucket `avatars`.
- `20261025000001_review_count.sql`: número de valoraciones por perfil.
- `20261025000002_lfg_filters.sql`: filtros LFG por rango y karma del creador.
- `20261025000003_trust_karma.sql`: karma ajustado por media bayesiana.
- `20261025000004_availability_slots.sql`: disponibilidad por franjas.
- `20261025000005_favorite_agents_open.sql`: agentes favoritos sin lista cerrada.
- `20261025000006_lfg_edit.sql`: editar, cerrar y borrar grupos LFG.
- `20261025000007_multi_roles.sql`: varios roles por jugador.
- `20261025000008_lfg_edit_size.sql`: cambiar el tamaño del grupo.
- `20261103000001_profanity_filter.sql`: filtro de palabras malsonantes (censura con asteriscos; bloqueo en biografía, comentarios y nombres de equipo).
- `20261103000002_delete_account.sql`: limpieza al borrar una cuenta (equipos, chats, LFG).
- `20261109000001_verificacion_tipos.sql`: notificaciones de verificación del Riot ID.
- `20261109000002_verificacion_riot_id.sql`: verificación del Riot ID, historial de 90 días al borrar una cuenta con karma o suspensión, y liberación de Riot ID sin verificar.
- `20261109000003_terminos_version.sql`: versión `2026-11-09` de los términos y la privacidad.
- `20261109000004_riot_identities.sql`: PUUID en una tabla privada, vincular en una transacción (`link_riot_account`) y desvincular el Riot ID (`unlink_my_riot_account`).

**Edge Functions** (`supabase/functions/`): `riot-validate` (público, valida un Riot ID), `riot-link` (onboarding), `riot-refresh` (refresca rango, con 1 h de espera), `delete-account` (borra la cuenta del usuario que llama), `riot-verify` (reto para verificar el Riot ID con la tarjeta de jugador).

## Agentes de Claude Code

Definidos en `.claude/agents/` (carpeta oculta en Obsidian):

- `revisor-supabase`: revisa migraciones, RLS y Edge Functions. Solo lectura.
- `verificador-ui`: comprueba en el navegador los cambios visibles.
- `documentador`: actualiza [[CAMBIOS]], [[BACKLOG]] y este índice al cerrar una tarea.
- `auditor-seguridad`, `auditor-seo` y `auditor-legal`: auditorías de solo lectura. La primera está en [[AUDITORIA-2026-11-03]] y la segunda en [[AUDITORIA-2026-11-05]].
- `redactor-riot`: material en inglés para presentar el producto a Riot.

Skills propias en `.claude/skills/`: `cumplimiento-legal` y `politicas-riot`.
