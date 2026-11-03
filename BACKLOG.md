---
tags: [premadegg, backlog]
actualizado: 2026-11-03
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
- [x] 5 · "Agregar en el juego": botón **Copiar Riot ID** en perfil, tarjeta de jugador y miembros del detalle LFG (sin publicar).
- [x] 12 · Palabras malsonantes: censura con asteriscos en general; en biografía y comentarios de valoraciones se bloquea el guardado. Migración `20261103000001_profanity_filter.sql` (sin publicar).

## Pendientes (en orden)

- [ ] 13 · Moderación de imágenes con un servicio externo (Sightengine o Google Vision). Necesita una cuenta de la usuaria.
- [ ] 6 · Ajustes de cuenta: cambiar email y contraseña, borrar cuenta.
- [ ] 7 · Búsqueda de equipo más automática. Falta definir qué es "automático".
- [ ] 8 · Modo claro / oscuro.
- [ ] 9 · Idiomas inglés / español.
- [ ] RSO (login con Riot): necesita clave de producción aprobada por Riot (semanas).

## Otros pendientes técnicos

- [ ] OAuth de Google y Discord en Supabase cloud.
- [ ] Regenerar `HENRIK_API_KEY`.
- [ ] Pedir una Personal API key de Riot (la de desarrollo caduca cada 24 h).
- [x] Traducir los errores de base de datos al editar el perfil (`client/src/app/services/db-errors.ts`, misma rama que el punto 12); falta publicar.
- [ ] Capturas del README.
- [ ] Apagar Render y MongoDB Atlas.

## Flujo de publicación

1. Commit solo con los archivos de la tarea (ver [[CLAUDE]]).
2. Si hay migración: `npx supabase db push --linked --yes` antes del push.
3. Push a `migrate-supabase` y `migrate-supabase:main` (Vercel despliega `main`). Detalles en [[DEPLOY]].
