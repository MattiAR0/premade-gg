# PremadeGG: reglas para Claude

## Proyecto

- TFG: plataforma LFG (looking for group) de Valorant basada en reputación (karma).
- Frontend Angular en `client/`, backend Supabase en `supabase/` (migraciones SQL, RPC, Edge Functions).
- Toda la UI y la documentación van en español.
- Arranque local: `npm run db:start` (Supabase, puertos 443xx) y `npm --prefix client start` (Angular, puerto 4200).

## Registro de cambios (obligatorio)

Cada vez que modifiques el proyecto (código, estilos, configuración, base de datos o documentación técnica), añade una entrada a [`CAMBIOS.md`](CAMBIOS.md) en la raíz **antes de terminar el turno y antes de cualquier commit**.

- Las entradas nuevas van arriba del todo, debajo del título; el archivo queda en orden cronológico inverso.
- Formato de cada entrada:

  ```markdown
  ## AAAA-MM-DD · Título corto del cambio

  **Commit:** `abc1234` (o "sin commitear")

  **Qué y por qué:** una o dos frases con el objetivo.

  **Cambios:**
  - Cambio concreto, con el archivo o componente afectado.

  **Verificación:** cómo se comprobó (build, navegador, tests, contraste medido…).

  **Pendiente:** lo que queda por hacer o no se pudo comprobar (omitir si no hay nada).
  ```

- No borres ni reescribas entradas anteriores. Si algo se revierte o se corrige, añade una entrada nueva que lo diga.
- Si el cambio se commitea, `CAMBIOS.md` va en el mismo commit.
- Los registros históricos anteriores a este archivo están en `REDISENO-VALORANT.md` y `MIGRACION-SUPABASE.md`.

## Diseño

- Usa los roles de color de `client/src/scss/utilities/_variables.scss` en lugar de hex sueltos:
  - `$color-brand`: logo, el CTA principal de cada vista y avisos de peligro. Texto encima con `$color-on-brand`.
  - `$color-selected` / `$color-on-selected`: estados activos (chips, segmentos, pestañas, navegación).
  - `$color-focus`: anillo de foco.
  - `$color-positive`: estados positivos (abierto, progreso, LFT).
- Contraste mínimo AA: 4,5:1 para texto normal y 3:1 para texto grande y controles. Mídelo con los colores reales, no a ojo.
- Prohibido: franjas de color laterales de más de 1px en tarjetas o listas, texto con degradado y brillos de color decorativos.
- El karma se muestra siempre con `app-karma-badge` y el rango con `app-rank-badge` (colores en `$rank-colors`).

## Forma de trabajar

- Muchos archivos usan saltos de línea CRLF: cualquier script que edite archivos debe respetar `\r\n`.
- En un commit mete solo los archivos de la tarea. Si un archivo mezcla cambios de otra tarea, prepara solo tus bloques.
- Comprueba en el navegador los cambios visibles antes de darlos por terminados.
