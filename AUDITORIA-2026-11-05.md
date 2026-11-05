---
tags: [premadegg, auditoria, seguridad, seo, legal, riot]
actualizado: 2026-11-05
---

# Re-auditoría · 2026-11-05

Segunda pasada de los agentes `auditor-legal`, `auditor-seguridad` y `auditor-seo` sobre el commit `1b0a4d9` (`migrate-supabase` = `main`) y la web en producción (premade-gg.vercel.app). La pregunta era si PremadeGG está listo para presentarlo a Riot (registro del producto y clave de producción). Se compara con [[AUDITORIA-2026-11-03]]. Ningún agente modificó archivos.

> La parte legal no es asesoramiento jurídico. Los textos legales finales debería revisarlos un abogado. Las políticas de Riot se leyeron el 2026-11-05 (developer.riotgames.com/policies/general, /docs/valorant, /terms, /docs/portal y riotgames.com/en/legal) y pueden cambiar.

Limitaciones: no se revisaron los paneles de Supabase ni de Vercel, así que la región de Supabase, los DPA y la configuración real de Auth (confirmación de email, redirecciones, SMTP, límites) quedan sin verificar. `supabase/config.toml` es la configuración local. En producción solo se hicieron peticiones sin sesión (`curl -I`, `OPTIONS` y `POST` que devuelven error).

## Veredicto

**No está listo para presentarlo a Riot.** Desde el 2026-11-03 solo se ha resuelto, en parte, el borrado de cuenta. Los cuatro bloqueantes P0 siguen abiertos y el borrado de cuenta abre una vía nueva para limpiar el karma.

## Lo que ya está bien

- No hay secretos en el cliente ni en el historial (`RGAPI`, `sb_secret`, `HDEV`, JWT de `service_role`). `.env` está en `.gitignore`.
- No hay `innerHTML` ni `bypassSecurityTrust`. Los enlaces con `target="_blank"` llevan `rel="noopener"`.
- `delete-account`: el id sale siempre del token (sin IDOR), 401 sin sesión y 405 con GET (comprobado en producción), errores internos sin detalles, Storage borrado antes que el usuario con paginación.
- El borrado de cuenta elimina perfil, `puuid`, Riot ID, reseñas, mensajes y notificaciones: cubre la supresión del RGPD (art. 17) y el borrado de datos del juego que pide Riot para quien lo solicita.
- Filtro de palabras: sin riesgo apreciable de DoS (regex anclada por token, textos acotados por `check`). Los triggers son `security definer` con `search_path=''` y `revoke`.
- Los errores de Riot ya llegan al cliente con mensajes genéricos (salvo 429 y "API key inválida" en `riot.ts`, poco grave).
- La home explica el producto: título, "Cómo funciona", grupos, jugadores y equipos.

## P0 · Bloquea la presentación a Riot

| # | Punto | Estado | Evidencia |
|---|---|---|---|
| 1 | Riot ID sin verificar; datos de HenrikDev, no de RSO | Abierto | `supabase/functions/riot-link/index.ts:21-49` solo comprueba que la cuenta existe. Riot exige opt-in con RSO para mostrar datos de Valorant a otros (docs/valorant). El onboarding no avisa de que los datos pasan a ser públicos. |
| 2 | Sin textos legales | Abierto | No hay rutas legales en `client/src/app/app.routes.ts`. El registro (`register.component.html:119-130`) no tiene casilla de aceptación ni declaración de edad. Ninguna coincidencia de privacidad, términos, cookies o edad en `client/src`. |
| 2b | Aviso de Riot y restos de TFG | Abierto | `client/src/app/app.html:16-18`: "Proyecto Final de Grado. No afiliado a Riot Games." También `README.md:3`. |
| 3 | Denuncias, moderación y apelación | Abierto | Ninguna coincidencia de report, abuse o denuncia en `supabase/` ni en `client/src`. |
| 3b | Borrado de cuenta | Parcial | Hecho y publicado el 2026-11-05. Falta documentarlo en la política de privacidad (incluido el plazo de copias de seguridad y logs). |
| 3c | Desvincular Riot sin borrar la cuenta | Abierto | Solo se desvincula borrando la cuenta. |
| 3d | Solicitudes de supresión que reenvía Riot (por accountId o PUUID) | Abierto | No hay procedimiento ni email para recibirlas. |
| 4 | Karma manipulable y riesgo de acoso | Abierto | Ver la sección siguiente. |

### Aviso de Riot: dos textos

- Políticas generales del portal: "[Your product] isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc."
- "Legal Jibber Jabber" (riotgames.com/en/legal, apartado 6), relevante porque se usan emblemas de rango e iconos de agentes de valorant-api.com: "[The title of your Project] was created under Riot Games' 'Legal Jibber Jabber' policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project."

El agente legal recomienda poner los dos en el pie con el nombre del producto y confirmar con Riot cuál prefieren. La skill `politicas-riot` solo recoge el primero.

### Karma y abuso

- **"Haber jugado juntos" forzable:** `create_lfg_post` mete a cualquiera de `p_initial_members` como `accepted` (`20261025000003_trust_karma.sql:245-256`). Igual con `create_team` y `create_group_conversation`.
- **Reseñas sin tope:** `create_review` (`20261024000004_api_write.sql:53-80`) acepta una reseña de cualquier cuenta a cualquier jugador.
- **Sin límites de frecuencia** en ninguna RPC de escritura ni Edge Function: `send_message`, `create_lfg_post`, `create_team`, `create_group_conversation`, `create_review`, `riot-validate`, `riot-link` y `riot-refresh`.
- **Cuentas desechables:** `enable_confirmations = false` (`config.toml:228`) y contraseña mínima de 6 (`config.toml:184`) en local. Falta comprobarlo en el panel de producción.
- **Nuevo: borrado de cuenta como vía de evasión.** Al borrar la cuenta se liberan el `riot_id` y el `puuid` (únicos). Quien tiene mal karma borra la cuenta y se vuelve a registrar con el mismo Riot ID con karma 5 y sin reseñas. Al revés, quien escribe reseñas falsas borra la cuenta y desaparecen las pruebas. Arreglos posibles: lista de bloqueo con el hash del `puuid` y las sanciones, conservar valoraciones anonimizadas hasta moderarlas o una espera antes de reutilizar el Riot ID. Choca en parte con la supresión: decisión del titular.
- El filtro de palabras no sustituye a las denuncias: no detecta acoso sin palabrotas, amenazas, doxxing ni reseñas falsas, y se salta con espacios u homoglifos (lo admite la propia migración, líneas 14-16).

## P1 · Seguridad

| # | Hallazgo | Estado | Evidencia y arreglo |
|---|---|---|---|
| 5 | Faltan CSP, Referrer-Policy y Permissions-Policy | Abierto | `curl -I` solo devuelve HSTS, `X-Content-Type-Options` y `X-Frame-Options: DENY`. Propuesta abajo. |
| 6 | `riot-validate` público y sin límite | Abierto | `riot-validate/index.ts:9-25` no llama a `requireUser`. Devuelve `puuid` y `taken`: permite enumerar Riot IDs registrados y gastar la cuota de la clave de Riot y de HenrikDev. |
| 7 | CORS `*` y `verify_jwt = false` | Abierto | `_shared/http.ts:4`; un `OPTIONS` desde `Origin: evil.example` devuelve `*`. Las cuatro funciones, `delete-account` incluida, tienen `verify_jwt = false`. Arreglo: lista de orígenes (producción y localhost) y `verify_jwt = true` en `riot-link`, `riot-refresh` y `delete-account`. |
| 8 | URL de avatar y logo de cualquier dominio | Abierto | `api_write.sql:21` y `:523`. Sin CSP sirve de píxel de rastreo de IP. |
| 9 | Campos sin límite de tamaño | Parcial | Hay `check` en `bio`, `lft_details`, `coach_details` y `message`. Siguen sin tope `schedule`, `social_links`, `availability`, `profile_image` y `teams.social_links` (merge con `\|\|` en `api_write.sql:30` y `:527`). |
| 10 | Angular 21.1.4 con 6 vulnerabilidades altas | Abierto | `npm audit --omit=dev` en `client/`. Riesgo real bajo (sin SSR, i18n ni `innerHTML`). Subir a 21.2.x. |
| 16 | `puuid` público, también para anon | Abierto | `'puuid', p.puuid` en `user_json` (`20261025000007_multi_roles.sql:60`). |

Medios y bajos nuevos:

- Enlaces de redes sociales con texto libre (`profile.component.html:108,114`, `'https://twitter.com/' + valor`). Validar con `^[A-Za-z0-9_]{1,25}$` en `update_my_profile` y añadir `noreferrer`.
- `secure_password_change = false`: con un token robado se cambia la contraseña sin la actual, porque la comprobación solo está en el cliente (`auth.service.ts:270-281`).
- `delete-account` sin límite de frecuencia ni reautenticación: con un token robado se borra la cuenta.
- Si `deleteUser` falla después de vaciar Storage, el usuario conserva la cuenta sin foto (asumido a propósito, reintentable).
- Avatares sin cuota ni borrado del anterior al cambiar de foto.
- Enumeración de emails en el registro si la confirmación está desactivada (sin verificar en producción).

Propuesta mínima de cabeceras para `client/vercel.json` (probar en producción por si Angular necesita nonce):

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://*.supabase.co https://media.valorant-api.com; connect-src 'self' https://taprgsiozhwralnzqxri.supabase.co wss://taprgsiozhwralnzqxri.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## P1 · SEO y presentación pública

| # | Punto | Estado | Evidencia |
|---|---|---|---|
| 1 | SPA sin SSR ni prerender | Abierto | `/` y `/lfg` devuelven el mismo HTML de 2075 bytes con `<app-root>` vacío. |
| 2 | `robots.txt` y `sitemap.xml` | Abierto | `client/public/` solo tiene `favicon.ico`. Las dos URLs devuelven 200 con `text/html` (el `index.html`). Basta con crear los archivos: Vercel sirve antes los estáticos. |
| 3 | 404 blandos | Abierto | `/no-existe-xyz` da 200. `app.routes.ts:105` redirige `**` a la home. |
| 4 | `noindex` en rutas privadas | Abierto | Ni `SeoService` ni `data.robots`. Login, registro, mensajes, ajustes, onboarding y restablecer contraseña son indexables. Alternativa sin JS: cabecera `X-Robots-Tag` en `vercel.json`. |
| 5 | Description por ruta, canonical, Open Graph y Twitter Card | Parcial | Solo hay título por ruta. La description es global y corta (`index.html:8`, unos 57 caracteres). Sin `canonical`, `og:*`, `twitter:*` ni imagen OG: al compartir el enlace la vista previa sale vacía y todos los perfiles y grupos se ven igual que la home. |
| 6 | JSON-LD | Abierto | Ninguno. |
| 7 | Google Fonts desde sus servidores | Abierto | `index.html:11-13`. Ya carga con `display=swap` y sin bloquear. Alojarlas en local también arregla la transferencia de IP a Google (RGPD). |
| 8 | Manifest e iconos | Parcial | Solo `favicon.ico`. Sin manifest, `apple-touch-icon` ni `theme-color`. |
| 9 | Dominio propio | Abierto | Sigue en `vercel.app`. |

## P2 · Protección de datos

- Región de Supabase en la UE y DPA de Supabase y Vercel: sin verificar. HenrikDev no tiene DPA conocido.
- Reseñas y perfiles siguen sin plazo de conservación.
- `account_level` se sigue guardando (`riot-link/index.ts:45`) y no se usa.
- No hay registro de actividades (art. 30) ni procedimiento de brechas (72 h a la AEPD).
- El bloqueo automático por `min_karma` (`api_write.sql:246-247`) no ofrece revisión humana (art. 22).
- El reseñado no puede oponerse, rectificar ni denunciar una reseña recibida.
- Edad mínima sin fijar. En España el consentimiento propio empieza a los 14 años (art. 7 LOPDGDD); el agente propone 16 por Valorant (edad exacta de los términos de Riot sin verificar).
- Cookies: solo técnicas (sesión de Supabase). Hace falta una política breve; no hace falta banner si se alojan las fuentes en local.

## Lo que pedirá Riot en el registro del producto

El portal no lista los campos exactos del formulario. Esto es lo que se deduce de las políticas y de lo que Riot dice revisar.

| Qué | ¿Existe hoy? | Comentario |
|---|---|---|
| Producto registrado en el Developer Portal | No consta | Uno por clave de producción. |
| Nombre y descripción en inglés | No | Para `redactor-riot`. Sin cifras inventadas. |
| Web completa en producción | Parcial | Riot avisa de que una web incompleta probablemente no se aprueba. Faltan textos legales y el pie correcto. |
| Prototipo funcionando | Sí | |
| URL de privacidad y de términos | No | |
| Email de contacto | No | También lo exige la DSA. |
| Plan de RSO y aviso al vincular | No | RSO solo se activa con clave de producción: hay que describir el plan. |
| Endpoints y frecuencia | Parcial | account-v1 (europe) y HenrikDev, no oficial (`_shared/riot.ts:6-7`). Explicarlo o sustituirlo por la API oficial. |
| Clave guardada de forma segura | Sí | Solo en secretos de las Edge Functions. Regenerar `HENRIK_API_KEY` sigue pendiente (BACKLOG). |
| Capturas | No | Pendiente en BACKLOG. |
| Moderación y protección de jugadores | No | Solo filtro de palabras y borrado de cuenta. |
| Monetización | No aplica | Si cambia, hace falta aprobación previa por escrito de Riot. |

## Orden de trabajo propuesto

1. Rápido y sin dependencias:
   - pie con los dos avisos de Riot y sin "Proyecto Final de Grado" (también `README.md:3`);
   - meta de compartir en `index.html` (Open Graph, Twitter Card, canonical, description de unos 150 caracteres, imagen de 1200x630);
   - `robots.txt` y `sitemap.xml` en `client/public/`;
   - `NotFoundComponent` con `noindex` en lugar de `redirectTo: ''`;
   - cabeceras CSP, Referrer-Policy y Permissions-Policy, y CORS limitado;
   - fuentes en local;
   - `requireUser` y límite en `riot-validate`, y quitar el `puuid` de `user_json`.
2. Textos legales (cuando el titular dé sus datos), casilla de aceptación y edad en el registro, y aviso al vincular Riot.
3. Denuncias con tabla, botón, revisión y apelación, más email de contacto.
4. Endurecer el karma: confirmación de email, límites de frecuencia, miembros iniciales pendientes de aceptar y que el borrado de cuenta no limpie el karma.
5. Verificación provisional del Riot ID (código en el perfil de Riot o moderación manual) y preguntar a Riot por HenrikDev.
6. Procedimientos internos: supresión por PUUID que reenvía Riot, brechas y registro del art. 30.
7. Capturas, descripción en inglés y registro en el portal. Después, clave de producción y RSO.

## Datos que tiene que dar el titular

Nombre o razón social, NIF, domicilio, email de contacto y edad mínima. Además, comprobar en los paneles: región de Supabase, confirmación de email, SMTP y límites de Auth. Decidir cómo verificar el Riot ID mientras no haya RSO y qué hacer con el karma al borrar una cuenta.

Corrección al informe de seguridad: habla de la "clave de producción" en `riot-validate`, pero todavía no hay ninguna. El riesgo es el mismo con la clave actual.

## Anexo · Revisión con agentes de VoltAgent

El mismo día se pasaron cinco agentes del repositorio [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) para cubrir lo que la auditoría no había mirado: `accessibility-tester`, `performance-engineer`, `postgres-pro`, `angular-architect` y `ux-microcopy-reviewer`. Se descartaron `security-auditor`, `seo-specialist`, `legal-advisor` y `gdpr-ccpa-compliance` porque repetían lo anterior.

No se instalaron en `.claude/agents/`: cada uno corrió como agente genérico con la definición del repositorio como guía de qué revisar, en solo lectura. Solo se ejecutaron el build, unos `curl -I` a producción y `npm outdated`.

**Conclusión:** ninguno de estos frentes bloquea la presentación a Riot. Los bloqueantes siguen siendo los P0 de arriba. Lo más urgente de este anexo son los textos que sugieren respaldo de Riot y el posible fallo de concurrencia del karma.

### Textos de la UI (`ux-microcopy-reviewer`)

Referencia usada: español de España, tuteo, mayúscula solo al inicio. El repositorio no tiene glosario ni guía de estilo.

Alta (comprobado con grep):

| Dónde | Texto actual | Problema | Propuesta |
|---|---|---|---|
| `app.html:17` | "PremadeGG — Proyecto Final de Grado. No afiliado a Riot Games." | Resto del TFG en todas las páginas y aviso de Riot incompleto | Avisos de Riot de la sección P0 |
| `onboarding.component.html:6` | "tu rango se obtiene de Riot, así el matchmaking es real." | Sugiere datos oficiales; "matchmaking" es el sistema de Riot | "Un último paso: comprobamos tu Riot ID para mostrar tu rango en tu perfil." |
| `home.component.html:104` | "Tu rango y nivel se sincronizan con tu cuenta real de Valorant." | Promete una sincronización continua y oficial | "Comprobamos tu Riot ID y mostramos tu rango y nivel de Valorant." |
| `home.component.html:15` | "Los jugadores tóxicos se quedan fuera." | Promesa que el producto no cumple | "Filtra por reputación, no solo por rango." |
| `supabase/functions/_shared/riot.ts:55` | "La API key de Riot es inválida o ha expirado" | Detalle interno; se vería en el onboarding si la clave caduca durante la revisión | "No hemos podido comprobar tu cuenta de Riot ahora mismo. Inténtalo de nuevo en unos minutos." |
| `supabase/functions/_shared/riot.ts:94` | "Límite de la API de HenrikDev alcanzado…" | Nombra al usuario una API no oficial | Mismo mensaje genérico |

Patrones:

- Más de 12 mensajes "Error" o "Error al…" sin siguiente paso (`lfg-detail.ts`, `team-detail.ts`, `teams.ts`, `profile-edit.ts`, auth). Patrón propuesto: "No se pudo X. Inténtalo de nuevo."
- Mensajes técnicos al usuario: "Comprueba que el servidor está en marcha" (`lfg-board.ts:237`, `players.ts:163`), "gameName y tagLine son obligatorios" (`riot-validate/index.ts:12`), códigos de región en `riot.ts:104`.
- Giros latinoamericanos y calcos del inglés: "ingresa" (`forgot-password.ts:26`), "ustedes" (`team-detail.html:424`), "agregar", "remover"/"removido", "post", "review", "Owner", "card".
- Mayúscula en cada palabra en `team-detail.html` y `messages.html` ("Eliminar Equipo", "Solicitar Unirse", "Crear Grupo").
- Las RPC devuelven sus mensajes sin traducir (`db-errors.ts:47`) y con punto decimal ("Mínimo: 3.0"), mientras la UI usa coma.
- "Por favor completa todos los campos obligatorios" en lugar de un mensaje por campo (registro, login, onboarding, restablecer contraseña).
- `register.html:117` dice que el horario se elige luego, pero el onboarding lo pide como obligatorio.
- `profile.html:182` y `:253`: "verificada"/"Verificado" puede leerse como verificado por Riot.
- "Una cuenta nueva cuenta como karma 3,5" (`lfg-detail.html:113`, `players.html:42`): repetición confusa.

Términos con varios nombres (elegir uno): valoración / reseña / review; grupo / post LFG; propietario / dueño / owner; quitar / remover / expulsar; correo / email; tarjeta / card; Flex / Flexible (no es un rol de Valorant).

### Base de datos (`postgres-pro`)

Diseño propuesto, sin aplicar ni probar. Cada migración debe pasar por `revisor-supabase`.

1. **Posible carrera en el recálculo del karma (sin verificar).** En READ COMMITTED, el `update profiles set karma = (select avg…)` de `recalculate_karma` (`20261025000001_review_count.sql:14-40`) toma su snapshot antes de esperar el bloqueo de la fila. Con dos valoraciones simultáneas al mismo jugador, la segunda puede no ver la primera y dejar `karma` y `review_count` desfasados en una valoración hasta el siguiente cambio. Arreglo: llevar `review_sum` y `review_count` de forma incremental dentro del propio `update`, o `select … for update` del perfil al inicio del trigger.
2. **Límites de frecuencia en Postgres.** Tabla `unlogged` `private.rate_counters (key, action, window_start, n)` con ventana fija y una sola upsert por llamada (`private.rl_check`, error `PT429`, que PostgREST devuelve como HTTP 429). Limpieza con el pg_cron existente. Límites propuestos: `create_review` 10/día; `create_lfg_post` 5/h y máximo 3 grupos abiertos; `join_lfg_post` 20/h; `create_team` 2/día; `create_group_conversation` 5/h; `send_message` 20/min y 300/h; `update_my_profile` 30/h; `delete-account` 1/día. Para las Edge Functions, una RPC solo para `service_role`, por IP (con hash y sal diaria) en `riot-validate` y por usuario en `riot-link`.
3. **Interacción real.** Miembros iniciales de grupos y equipos como `pending` con `invited_by` y una RPC para aceptar. Tabla persistente `played_pairs (user_a, user_b, first_at, last_at, source)` alimentada por triggers al aceptar, porque hoy la prueba desaparece cuando el cron borra el grupo a las 24 h. `create_review` exigiría un par en los últimos 14-30 días, una cuenta con 24 h o más y 10 minutos desde que se aceptó al jugador.
4. **Borrado de cuenta sin limpiar el karma.** Tabla `private.identity_blocklist` con HMAC del `puuid` (pepper en Vault), solo para cuentas con karma bajo o sanción y durante 12 meses. Al volver a vincular el mismo `puuid`, se heredan las valoraciones recibidas o se rechaza si hay sanción. Las valoraciones escritas por la cuenta borrada se conservan sin autor ni comentario (`on delete set null`). Es dato seudónimo: hay que validarlo con `auditor-legal` y contarlo en la política de privacidad.
5. **Índices y bloqueos.** Índice parcial `lfg_members (user_id, post_id) where status = 'accepted'`. El CTE de equipos de `played_together` (`20261024000003_api_read.sql:128-152`) recorre todos los equipos. Dos borrados simultáneos de usuarios que se valoraron entre sí pueden dar un deadlock (poco probable).

Orden propuesto: karma (1) → límites (2) → `played_pairs` (3) → invitaciones (3) → borrado de cuenta (4) → límites en las Edge Functions.

### Accesibilidad (`accessibility-tester`)

Revisión estática WCAG 2.2 AA, sin lector de pantalla ni navegador. **No bloquea.** Bien: `lang="es"`, skip link, foco al título al navegar, `:focus-visible` (13:1), `prefers-reduced-motion`, diálogos con trampa de foco y Esc, `role="alert"`/`status` en la mayoría de los errores, badges con `role="img"` y `aria-label`.

Contraste medido con los hex de `_variables.scss`: el texto principal pasa con margen. Rozan o no llegan: `$color-text-subtle` sobre elevated (4,10:1), `$color-brand` como texto sobre elevated (4,31:1) y los bordes de los campos (1,7–2,0:1, por debajo del 3:1 de 1.4.11).

Incumplimientos AA a arreglar antes de presentar:

- `messages.component.html:264`: botón de enviar solo con icono, sin nombre accesible (4.1.2).
- `messages.component.html:191-243`: el chat no tiene región viva; los mensajes entrantes y "escribiendo…" no se anuncian (4.1.3).
- `messages.component.html:20, 23, 264`: tres campos solo con placeholder (1.3.1, 3.3.2).
- `messages.component.html:29, 50` y `notification-bell.component.html:37-39`: elementos con `(click)` que no se usan con teclado (2.1.1).
- Bordes de `input`, `select` y `textarea` (`_mixins.scss:103-104`) por debajo de 3:1 (1.4.11).

Mejoras: errores asociados al campo con `aria-invalid` y `aria-describedby` (solo lo hacen `account-settings` y `profile-edit`); campana y panel de mensajes con `aria-expanded`, Esc y retorno del foco; `role="alert"`/`status` en los avisos de valoraciones (`profile.html`); `aria-label` distinto en los dos `<nav>` y `ariaCurrentWhenActive="page"`.

### Rendimiento (`performance-engineer`)

**No bloquea.** Bundle inicial de 553,94 kB sin comprimir y 135,8 kB transferidos. El 86 % es el núcleo de Angular, RxJS y supabase-js; no hay nada grande evitable. Rutas en carga diferida (el mayor chunk diferido pesa 36 kB). Caché correcta: `index.html` con `max-age=0` y los assets `immutable`.

- Lo único que nota un usuario: `provideAppInitializer` (`app.config.ts:16`) espera a `getSession()` y a `get_me` antes de pintar, así que quien tiene sesión ve 0,2–0,8 s en blanco en cada recarga. Arreglo: esperar solo a la sesión local y cargar el perfil en segundo plano.
- Google Fonts bloquea el render (ya en P2).
- SQL a escala futura: N+1 en `get_lfg_posts` y `lfg_post_json`; `unreadCount` por conversación en `get_conversations`; el índice `profiles_rank_role_trust_idx` no se usa porque `get_users` filtra por `roles`; faltan índices parciales `where onboarded`.
- Imágenes de avatares y logos sin `width`/`height` ni `loading="lazy"` (`player-card`, `team-card`, `navbar`, `messages`, `profile`): saltos de diseño leves en los listados.
- El aviso de presupuesto es interno: se puede subir a 600 kB.

### Cliente Angular (`angular-architect`)

**Calidad aceptable.** Servicios claros, guards que esperan a la sesión, carga diferida completa, modo estricto, errores de Supabase traducidos de forma centralizada (`toApiError`, `translateDbError`) y Realtime sin fugas. La app no usa zone.js (comprobado: no está en `package.json`, `angular.json`, `app.config.ts` ni `node_modules`).

- Antes de presentar: subir Angular de 21.1.4 a 21.2.x (cierra las 6 vulnerabilidades altas; el rango `^21.1.0` ya lo admite) y añadir tests. Hoy no hay ningún `*.spec.ts` aunque vitest está configurado.
- `auth.service.ts` (`loadProfile`): cualquier error de `get_me`, también uno de red, deja al usuario como deslogueado y el guard lo manda a `/login`.
- El initializer no tiene timeout: si Supabase tarda, la app se queda en blanco.
- Las páginas guardan el estado en campos normales con unas 120 llamadas a `ChangeDetectorRef` y sin `OnPush`. Sin zone.js, un `markForCheck` olvidado deja la pantalla sin actualizar.
- `route.params.subscribe` sin `switchMap` en `lfg-detail`, `profile`, `team-detail` y `messages`: si navegas rápido entre dos perfiles, puede pintarse la respuesta antigua.
- `message.service.ts` (~L284): si `send_message` falla, el mensaje desaparece sin aviso.
- Sin tipos generados de Supabase: un cambio de esquema no da error al compilar.

Mejoras por orden: subir Angular, tests de guards y servicios, tipos generados de Supabase, sesión más resistente a fallos de red y, a medio plazo, pasar las páginas a signals con `OnPush`.
