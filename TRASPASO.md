# Traspaso: revisión de diseño de PremadeGG (segunda ronda)

> **Obsoleto desde el 2026-10-25.** La migración a Supabase y las migraciones SQL se commitearon en `c3aa6ba` y todo está publicado (`origin/main` = `6cf8b3c`). El índice de git está vacío: no hay borrados que conservar ni archivos mixtos. El estado actual está en [[INDICE]] y los pendientes en [[BACKLOG]].

Documento para que otro agente continúe el trabajo sin el historial de la conversación. Fecha: 2026-10-25.

Lee primero [`CLAUDE.md`](CLAUDE.md) (reglas obligatorias) y las tres primeras entradas de [`CAMBIOS.md`](CAMBIOS.md), que detallan lo hecho.

---

## 1. Contexto

- **Producto:** TFG, plataforma LFG de Valorant basada en reputación (karma de 0 a 5). Angular en `client/`, Supabase en `supabase/`. UI y documentación en español.
- **Rama:** `migrate-supabase`.
- **Trabajo previo:** se ha hecho una revisión estética con el skill `impeccable`. Esa primera crítica dio **24/40**.
- **Primera ronda:** 7 pasos, todos commiteados.
- **Segunda crítica:** **26/40**. Su informe está en `.impeccable/critique/2026-10-24T18-58-36Z__client-src-app.md`.
- **Decisiones de la usuaria para la segunda ronda:**
  - Empezar por el karma con pruebas.
  - Karma y rango al **mismo nivel** visual: ni el karma por delante, ni la jerarquía de antes.
  - Abordar **todos** los problemas.

## 2. Estado de git (importante)

- **Commits de diseño** (encima de `5d203a2`): `ffdfd2c`, `ee76221`, `e48f476`, `7ad796d`, `2fd7f48`, `bdaa01c`. No se ha hecho push.
- **La migración a Supabase está SIN commitear y no es de esta tarea:**
  - `server/` borrado, `supabase/`, `client/src/app/pages/onboarding/`, `services/supabase.client.ts`, `realtime.service.ts`, etc.
  - **No hay que mezclarla** con commits de diseño.
- **Hay 50 borrados de la migración preparados en el índice** (`D`, sobre todo `server/`) que hay que conservar.
  - Antes de cada commit de diseño se guardan:

    ```bash
    git diff --cached --name-status | awk '$1=="D"' | cut -f2 > lista.txt
    git restore --staged --pathspec-from-file=lista.txt
    ```

  - Después del commit se restauran con `git add --pathspec-from-file=lista.txt`.
- **Archivos que mezclan cambios de la migración y de diseño** (preparar solo los bloques de diseño):
  - `client/src/scss/components/_navbar.scss` y `client/src/scss/global/_typography.scss`
  - `client/src/app/app.routes.ts` y `client/src/app/app.config.ts`
  - `client/src/app/pages/register/register.component.{html,ts}` y `login/login.component.html`
  - `client/src/app/models/user.model.ts` y `client/src/app/services/api.service.ts`
- **Método para esos archivos:** construir "HEAD + solo mis ediciones" y meterlo en el índice. Es lo que hacen los scripts del scratchpad de la sesión anterior; la versión simple es `git show HEAD:<ruta>`, aplicar los reemplazos, `git hash-object -w <tmp>` y `git update-index --cacheinfo <modo>,<sha>,<ruta>`.
  - Comprobar después con `git diff --cached` (solo diseño) y `git diff` (solo migración).
  - `git apply --cached` con hunks filtrados también sirve cuando los bloques no se solapan.

## 3. Pasos 1 y 2 de la segunda ronda (funcionan y están verificados)

**Frontend commiteado** en `8195eee` junto con el paso 3. Las dos migraciones SQL siguen sin commitear.

### Paso 1: karma con pruebas

- `supabase/migrations/20261025000001_review_count.sql`:
  - Columna `profiles.review_count`, mantenida por el trigger `recalculate_karma`.
  - `reviewCount` en `user_json`.
  - Filtro `p_min_reviews` en `get_users`.
- `shared/karma-badge/*`:
  - `@Input() count`.
  - Con 0 valoraciones muestra "Nuevo" / "Sin valoraciones"; si hay alguna, "N valoraciones" (tamaños md y lg).
  - Contorno en los segmentos vacíos.
- `scss/components/_badges.scss`:
  - Estilos de karma, `.c-rating` (puntuación en segmentos) y `.c-rating-input` (selector 1–5).
  - Importa `mixins`.
- Portada: "Top jugadores" usa `minReviews: 1` y desempata por `reviewCount`; el total del hero sale de otra petición.
- Perfil:
  - Las estrellas pasan a segmentos.
  - Nuevo método `ratingLevel()`.
  - Fuera los estilos de estrellas.

### Paso 2: karma donde se decide

- `supabase/migrations/20261025000002_lfg_filters.sql`: `get_lfg_posts` acepta `p_my_rank` (min_rank ≤ rango o nulo) y `p_min_author_karma`.
- `lfg-board`:
  - Filtros "Tu rango" y "Karma del creador" sincronizados con `?rank=` y `?karma=`.
  - "Limpiar filtros".
  - `applyFilters()` ahora es público.
- `lfg-card`:
  - Fila "Creador" con rango, karma y región.
  - Línea "Exige … o más · karma N+".
  - `@Input() showStatus`.
- `player-card`: rango y karma en la misma fila (`__standing`).
- `lfg-detail`: rango y karma del creador, y karma de cada miembro.

### Migraciones

- **Aplicadas en local** con `npx supabase migration up`, sin borrar datos. `npm run db:test` pasa 16/16.
- **Decidido:** el frontend ya está en `8195eee`. Las dos migraciones SQL van en el commit de la migración a Supabase, porque dependen de sus migraciones base.

## 4. Lo que queda (plan aceptado, pasos 3 a 6)

### 3. Móvil (`/impeccable adapt`)

**Hecho** el 2026-10-25, commit `8195eee` (ver `CAMBIOS.md`).

Por debajo de `sm`:
- `.c-filters` pasa a ser plegable ("Filtros (n)").
- Se oculta `.c-page-header__desc`.
- "Crear grupo" va en la misma fila que el `h1`.
- `.c-chips` va en una fila con scroll horizontal.

Ahora, a 375px, la primera tarjeta de `/players` empieza en y≈712 y el panel de filtros de `/lfg` termina en y=673.

### 4. Lectores de pantalla y teclado (`/impeccable harden`)

**Hecho** el 2026-10-25, commit `3129148` (ver `CAMBIOS.md`).

- Foco al `h1`/`#contenido` en `NavigationEnd`.
- `TitleStrategy` con el nombre del grupo o del jugador. Ahora los títulos son genéricos: "Perfil · PremadeGG".
- Mini-avatares de `lfg-card` con `tabindex="-1" aria-hidden="true"`; ahora se anuncian como "T".
- `.c-tabs__size` en móvil mide **9,6px**, y es una regresión: subir a ≥ 0,75rem (`lfg-board.component.scss`).
- `.c-tabs` (`<nav>`) pasa a `role="group" aria-label="Tamaño de grupo"`.
- `role="alert"` en `.c-auth-card__error`, `.c-detail__feedback--err` y `.c-error`.

### 5. Tipografía y tokens (`/impeccable typeset`)

**Hecho** el 2026-10-25, commit `d809070` (ver `CAMBIOS.md`).

- Escala `$font-size-*` con 12px como mínimo para etiquetas; hoy hay 23 tamaños en la portada.
- Tokens `$color-danger-text` (`#ff6b76`, que aparece unas 10 veces) y `$color-team` (`#9a8cff`), en lugar de los aproximadamente 38 hex sueltos.
- Quitar `text-transform: uppercase` de nombres de usuario y equipo (`.c-player-card__name`, `.c-profile__name`, `.c-lfg-card__title`).

### 6. Detalles menores (`/impeccable polish`)

**Hecho** el 2026-10-25, commit `721802b` (ver `CAMBIOS.md`).

- **Estilo:**
  - El degradado rojo del hero: `CLAUDE.md` prohíbe los brillos decorativos.
  - `team-detail.component.scss:560` tiene un `border-left` de 2px.
  - El botón de Discord del login pesa más que el CTA.
  - El badge "DUO/TRIO" del detalle LFG, en morado `c-badge--team`.
- **Textos:**
  - "Bienvenido de vuelta" (masculino).
  - El `alt` "… avatar" (en inglés).
  - Restos en inglés: "Posts LFG", "Coach:".
  - "Dúo/Trío" con tilde.
  - Los estados vacíos de "Llenos" y "Cerrados" ofrecen "Crear grupo", que no encaja con esos filtros.

**Hecho** el 2026-10-25: la crítica final da 22/40 (`.impeccable/critique/2026-10-25T15-38-38Z__client-src-app.md`). No es comparable 1:1 con el 26/40: el revisor nuevo recorrió flujos que el anterior no penalizó. Antes: volver a lanzar `/impeccable critique` (dos subagentes aislados, A y B) y comparar con 26/40.

## 5. Cómo trabajar y verificar

- **Arranque:**
  - `npm run db:start` (Supabase, puertos 443xx, requiere Docker Desktop).
  - `npm --prefix client start` arranca en el 4200; hay otra configuración, `client-alt`, en el 4300, en `.claude/launch.json`.
- **Docker:** si no arranca con el error `dockerInference ... cannot be accessed`, hay que borrar como administrador `C:\Users\matti\AppData\Local\Docker\run\dockerInference` o reiniciar Windows.
- **Ids útiles en la base local:**
  - Perfil con valoraciones: `/profile/6fc3893e-4fc6-4585-81a3-016b2d9cc542` (Player10#EUW).
  - Perfil con karma bajo: `/profile/83dc9b32-c200-4dea-a4a9-65c85dc118e5`.
- **Sesión:** todo se ha visto como invitado. No hay credenciales de prueba a mano para las pantallas con sesión iniciada (mensajes, modales, formulario de valoración).
- **Detector:** `./.claude/skills/impeccable/scripts/impeccable.cmd detect --json client/src/app`. Los 15 `broken-image` (`[src]` de Angular) y el `bounce-easing` de `typing-bounce` son falsos positivos.
- **Reglas (en `CLAUDE.md`):**
  - Respetar CRLF en los scripts que editan archivos.
  - Una entrada en `CAMBIOS.md` por cada cambio, antes de terminar el turno.
  - Usar los roles de color.
  - Contraste AA medido.
  - Comprobar en el navegador.
- **Piezas reutilizables:**
  - Pipe `label` (`shared/pipes/label.pipe.ts`): rangos, roles y horarios en español solo al mostrarlos; los valores siguen en inglés.
  - Directiva `appDialog` (`shared/dialog/dialog.directive.ts`): foco, Tab y Esc en modales.
  - Mixins `touch` y `touch-hit` (`_mixins.scss`).
  - `.c-card__link`: tarjeta entera clicable con un `<a>` real.
