# Skills de Claude Code — PremadeGG

Registro de la instalación y verificación de skills realizada el **2026-10-24** (rama `redesign-valorant`).

Las skills viven en `.claude/skills/` (alcance de proyecto): Claude Code las carga automáticamente en cualquier sesión abierta en `D:\premade-gg`. Desde el 2026-11-05 están versionadas en git, porque varios agentes de `.claude/agents/` las cargan.

> **Nota (2026-11-05):** este registro se escribió cuando el backend era Express + MongoDB. Tras la migración a Supabase, la columna "¿Encaja?" de las tablas está actualizada al stack actual (Angular + Supabase: Postgres, RLS, RPC y Edge Functions en Deno).

---

## 1. Skills importadas desde `D:\MC-AHOLA\MC-AHOLA\.claude\skills` (17)

| Skill | Para qué sirve | ¿Encaja con PremadeGG? |
|---|---|---|
| `animate` | Construir animaciones desde cero | Sí (frontend) |
| `copy-editing` | Revisar y pulir textos existentes | Parcial (landing / textos UI) |
| `copywriting` | Escribir textos de marketing | Parcial (landing) |
| `cro` | Optimizar conversión de páginas y formularios | Parcial (landing / registro) |
| `emil-design-eng` | Filosofía de pulido UI de Emil Kowalski | Sí |
| `frontend-design` | Dirección visual distintiva | Sí |
| `impeccable` | Diseño, auditoría y pulido de interfaces | Sí (requiere motor, ver §4) |
| `improve-animations` | Auditoría de animaciones del código | Sí |
| `product-marketing` | Documento de contexto de producto | Parcial |
| `resend` | API de email Resend | **No** — los correos los envía Supabase Auth con las plantillas de `supabase/templates/` |
| `review-animations` | Revisión de animaciones (solo invocación manual) | Sí |
| `schema` | Datos estructurados JSON-LD | Parcial (SEO); la usa `auditor-seo` |
| `security-and-hardening` | Endurecimiento OWASP, auth, dependencias | Sí (auth de Supabase, RLS, Edge Functions); la usa `auditor-seguridad` |
| `security-best-practices` | Revisión de seguridad por lenguaje/framework | Sí, sobre todo las Edge Functions en TypeScript (no tiene guía para Angular); la usa `auditor-seguridad` |
| `seo-audit` | Auditoría SEO | Parcial; la usa `auditor-seo` |
| `vercel-react-best-practices` | Rendimiento en React/Next.js | **No** — el frontend es Angular |
| `web-design-guidelines` | Revisión UI contra las Web Interface Guidelines de Vercel | Sí |

Se decidió **mantener todas**, incluidas las que no encajan.

## 2. Skills nuevas añadidas (4)

Elegidas entre repositorios oficiales o de las más instaladas, según el stack MEAN (Angular 21 + Express + MongoDB/Mongoose + socket.io).

| Skill | Origen | Licencia | Uso en PremadeGG |
|---|---|---|---|
| `angular-developer` | [angular/skills](https://github.com/angular/skills) (equipo de Angular, Google) | MIT | Signals, routing, guards, formularios, testing, CLI |
| `mongodb-schema-design` | [mongodb/agent-skills](https://github.com/mongodb/agent-skills) (oficial) | Apache-2.0 | Ya no aplica: el proyecto migró a Postgres (Supabase). Para la base de datos se usa la skill de usuario `supabase-postgres-best-practices` |
| `mongodb-query-optimizer` | [mongodb/agent-skills](https://github.com/mongodb/agent-skills) (oficial) | Apache-2.0 | Ya no aplica (ver la fila anterior) |
| `systematic-debugging` | [obra/superpowers](https://github.com/obra/superpowers) | MIT | Depuración buscando la causa raíz antes de arreglar |

Descartada: `webapp-testing` ([anthropics/skills](https://github.com/anthropics/skills)), porque requiere instalar Playwright para Python y el navegador integrado de la app ya cubre ese uso.

## 3. Verificación

Se validaron las 21 skills:

- **Frontmatter YAML**: válido en todas (comprobado con `js-yaml`); `name` coincide con la carpeta y `description` ≤ 1024 caracteres.
- **Referencias internas**: se encontró una rota y se corrigió:
  - `security-and-hardening` apuntaba a `../../references/security-checklist.md`, que no venía en la carpeta original. Se descargó del repo original ([addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)), se colocó en `security-and-hardening/references/security-checklist.md` y se actualizaron los 3 enlaces del `SKILL.md`.
  - `cro` → `references/inbound-routing.md`: falso positivo, es un enlace externo a GitHub.
- **Fuente remota**: la URL que usa `web-design-guidelines` (`raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`) responde 200.
- **Carga en Claude Code**: las 21 skills aparecen como disponibles.

## 4. Motor de `impeccable`

`impeccable` necesita un binario externo que su lanzador descarga en el primer uso.

- Descargado con `.claude/skills/impeccable/scripts/impeccable.cmd engine-probe`.
- Ubicación: `C:\Users\matti\.impeccable\bin\0.1.15\impeccable.exe` (~19 MB), checksum SHA-256 verificado por el lanzador.
- Probado con `impeccable.cmd context` sobre el proyecto: funciona.
- Aviso de la skill: el proyecto aún no tiene `PRODUCT.md`. Para cambios concretos no hace falta; para rediseños grandes conviene ejecutar `/impeccable init` (entrevista corta sobre producto, público y tono).

## 5. Pendiente

- Ejecutar `/impeccable init` para crear `PRODUCT.md` antes de rediseños grandes.
- Valorar si se eliminan `vercel-react-best-practices` y `resend` (cada skill añade su descripción al contexto de cada sesión).
- Valorar también si se eliminan `mongodb-schema-design` y `mongodb-query-optimizer`, que dejaron de aplicar con la migración a Supabase.

## 6. Skills propias del proyecto

Escritas para PremadeGG el 2026-11-03 (ver `CAMBIOS.md`):

- `cumplimiento-legal`: checklist legal española y europea (RGPD, LOPDGDD, LSSI-CE, cookies, DSA, menores).
- `politicas-riot`: políticas de Riot para productos de terceros y guion para el registro del producto.
