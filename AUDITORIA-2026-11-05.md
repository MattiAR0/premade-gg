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
