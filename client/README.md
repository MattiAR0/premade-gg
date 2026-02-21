# PremadeGG — Frontend (Angular)

Frontend de la plataforma **PremadeGG**, una aplicación LFG (Looking For Group) para Valorant basada en reputación (Karma). Consume la API REST del backend (`/server`) y se comunica en tiempo real mediante Socket.IO.

## Stack Tecnológico

- **Angular 21** — Standalone Components, zoneless (sin `zone.js`).
- **SASS** — Arquitectura 7-1 adaptada con `@use` / `@forward` (prohibido `@import`).
- **Metodología BEM** — Prefijos `c-` (componentes), `l-` (layout), `g-` (global).
- **TypeScript** — Tipado estricto con modelos definidos en `/app/models`.

## Relación con el Backend

El frontend se conecta a la API Express del directorio `/server`:
- En **desarrollo**: usa un proxy (`proxy.conf.json`) que redirige `/api` a `http://localhost:4000`.
- En **producción Docker**: nginx redirige `/api` al contenedor de la API.
- En **producción cloud**: `environment.prod.ts` apunta a la URL de Render.

## Arquitectura SASS

```
src/scss/
├── utilities/        # Variables, mixins, funciones
│   ├── _variables.scss   → Design tokens (colores, spacing, radii, breakpoints, z-index)
│   ├── _mixins.scss      → respond-to, flex-center, glass-effect, social-card, gradient-text, line-clamp...
│   └── _functions.scss   → spacing(), z() con mapa de capas
├── global/           # Reset, tipografía, grid
│   ├── _reset.scss       → Reset moderno + focus-visible + ::selection
│   ├── _typography.scss  → Fuentes, tamaños, clases de texto
│   └── _grid.scss        → l-container, l-grid (1-4 col + feed), l-section, l-flex
└── components/       # Bloques BEM reutilizables
    ├── _buttons.scss     → c-btn (primary, secondary, ghost, sm, icon)
    ├── _cards.scss       → c-card (header, title, body, footer, meta)
    ├── _badges.scss      → c-badge (karma, rank, role, region, status, agent, lft) — usa @each con $karma-colors map
    ├── _navbar.scss      → c-navbar (responsive con hamburger menu)
    ├── _notifications.scss → c-notification-bell + panel desplegable
    ├── _messages.scss    → c-messages (panel de chat, DMs y grupales)
    └── _pagination.scss  → c-pagination
```

## Componentes Angular

### Compartidos (`/app/shared/`)
| Componente | Descripción |
|---|---|
| `player-card` | Tarjeta de jugador con avatar, rango, karma, rol y badges |
| `lfg-card` | Tarjeta de post LFG con autor, miembros y estado |
| `team-card` | Tarjeta de equipo con roster y estado de reclutamiento |
| `navbar` | Barra de navegación con menú responsive y avatar |
| `notification-bell` | Campana con badge de no leídas y panel desplegable |
| `karma-badge` | Badge de karma con color dinámico (alto/medio/bajo) |
| `rank-badge` | Badge de rango de Valorant |
| `message-panel` | Panel de chat con DMs y conversaciones grupales |

### Páginas (`/app/pages/`)
| Página | Ruta | Descripción |
|---|---|---|
| `home` | `/` | Landing con hero, features y top jugadores |
| `players` | `/players` | Listado paginado con filtros e infinite scroll |
| `lfg-board` | `/lfg` | Board de posts LFG con filtros por tipo |
| `lfg-detail` | `/lfg/:id` | Detalle de post con gestión de miembros |
| `teams` | `/teams` | Listado de equipos |
| `team-detail` | `/teams/:id` | Detalle de equipo con roster y solicitudes |
| `profile` | `/profile/:id` | Perfil público con reviews y karma |
| `profile-edit` | `/profile/edit` | Edición de perfil con feedback visual |
| `login` | `/login` | Inicio de sesión |
| `register` | `/register` | Registro con validación de Riot ID |
| `forgot-password` | `/forgot-password` | Solicitar restablecimiento |
| `reset-password` | `/reset-password` | Restablecer contraseña |
| `messages` | `/messages` | Chat con DMs y grupos |

## Instalación Local

```bash
cd client
npm install
npm run start
```

El frontend se sirve en `http://localhost:4200`. Necesita el backend corriendo en `http://localhost:4000` (ver README principal).

## Build de Producción

```bash
npm run build -- --configuration=production
```

El output se genera en `dist/premadegg/browser/`.

## Uso de la IA

El desarrollo de este frontend se ha apoyado en herramientas de IA. Los prompts utilizados, errores encontrados y decisiones tomadas están documentados en el archivo [`diario-ia-prompts.md`](../diario-ia-prompts.md) en la raíz del monorepo.
