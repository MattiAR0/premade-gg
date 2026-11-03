---
tags: [premadegg, auditoria, seguridad, seo, legal, riot]
actualizado: 2026-11-03
---

# Auditoría inicial · 2026-11-03

Primera pasada de los agentes `auditor-seguridad`, `auditor-legal` y `auditor-seo` sobre la rama `migrate-supabase` y la web en producción (premade-gg.vercel.app). Ningún agente modificó archivos. Aquí se juntan los tres informes en una sola lista ordenada por prioridad. El objetivo es presentar PremadeGG a Riot y conseguir la clave de producción.

> La parte legal no es asesoramiento jurídico. Los textos legales finales debería revisarlos un abogado. Las políticas de Riot se leyeron el 2026-11-03 y pueden cambiar.

Limitaciones: no se revisaron los paneles de Supabase cloud ni de Vercel. No se midió el tamaño de los bundles. El código de estado HTTP de las rutas inexistentes se dedujo de `vercel.json`.

## Lo que ya está bien

- No hay secretos filtrados en el código ni en los últimos 200 commits. El cliente solo lleva la clave publicable de Supabase, y las claves de Riot y HenrikDev están en los secretos de las Edge Functions.
- Toda la escritura pasa por RPC con `require_uid()`. Se revocan los insert, update y delete directos a `anon` y `authenticated`.
- No hay `innerHTML`, `bypassSecurityTrust*` ni `eval`. `returnUrl` está validado contra open redirect.
- El bucket `avatars` tiene un límite de 2 MB y no admite SVG. La escritura solo se permite en la carpeta del propio usuario.
- Los títulos por ruta existen y todas las rutas usan `loadComponent`.
- HSTS está activo (lo pone Vercel). `npm audit` de la raíz sale limpio.

## P0 · Bloquea la presentación a Riot

**1. El Riot ID no se verifica y los datos de Valorant salen de HenrikDev, no de RSO.** (seguridad 1, legal T2)
- Archivos: `supabase/functions/riot-link/index.ts:20-49` y `supabase/functions/_shared/riot.ts:63-100`.
- Cualquiera puede registrarse con el Riot ID de otra persona. Hereda su rango y su card, y el dueño real se queda bloqueado por el 409.
- Riot exige opt-in o RSO para mostrar datos de Valorant. Usar una API no oficial está sin verificar con Riot.
- Arreglo: RSO, que exige clave de producción. Mientras tanto, un código de verificación en el perfil de Riot o moderación manual. Preguntar a Riot por HenrikDev.

**2. No hay ningún texto legal.** (legal T1, T2, SEO 20)
- No hay política de privacidad, términos de uso ni aviso legal.
- El pie (`client/src/app/app.html:16-18`) dice "Proyecto Final de Grado" y no lleva el aviso obligatorio de Riot.
- El registro (`register.component.html:119-130`) no tiene casilla de aceptación ni declaración de edad.
- Riot pide las URLs de privacidad y términos en el registro del producto.

**3. No hay denuncias, moderación ni borrado de cuenta.** (legal T1, T2, BACKLOG #6 y #12)
- La DSA exige un mecanismo de denuncia, la motivación de las decisiones y un punto de contacto.
- El RGPD exige la supresión de datos.
- Los términos de Riot exigen borrar la información del juego y atender las solicitudes RGPD que Riot reenvía.
- No hay botón "Denunciar", tabla de denuncias, desvinculación de Riot ni borrado de cuenta.

**4. El karma se puede manipular.** (seguridad 2, 3, 4 y 19; legal T2)
- "Haber jugado juntos" se puede forzar: el autor añade a cualquiera como miembro aceptado de su grupo, equipo o chat (`create_lfg_post`, `create_team`, `create_group_conversation`).
- Hay cuentas desechables, porque la confirmación de email está desactivada (`supabase/config.toml`). Con 3 cuentas que den una estrella, el `trust_karma` de alguien baja a 2,25 y ya no puede crear grupos.
- No hay límites de frecuencia en ninguna RPC de escritura ni en las Edge Functions: spam de mensajes, mensajes directos sin consentimiento, grupos y notificaciones.
- Es el riesgo de acoso que más le importa a Riot en un producto de reputación.

## P1 · Seguridad

| # | Hallazgo | Dónde | Arreglo |
|---|---|---|---|
| 5 | Faltan las cabeceras CSP, Referrer-Policy y Permissions-Policy | `client/vercel.json` | CSP que permita Supabase (https y wss), valorant-api y Google Fonts (o fuentes locales) y `frame-ancestors 'none'` |
| 6 | `riot-validate` es público y sin límite: gasta la cuota de Riot y HenrikDev y devuelve el `puuid` | `supabase/functions/riot-validate/index.ts` | Pedir sesión o limitar por IP; no devolver el `puuid` |
| 7 | CORS `*` en las Edge Functions; `verify_jwt = false` en las tres | `_shared/http.ts:4`, `config.toml` | Permitir solo el origen de producción y localhost; `verify_jwt = true` en `riot-link` y `riot-refresh` |
| 8 | La URL del avatar y del logo de equipo admite cualquier dominio: sirve de píxel de rastreo de IP | `update_my_profile`, `teams.logo` | Validar el dominio en la RPC y reforzarlo con `img-src` en la CSP |
| 9 | Campos de perfil sin límite de tamaño (`schedule`, `social_links`, `availability`) | `profiles`, `update_my_profile` | `CHECK` de longitud y de `pg_column_size`; validar el formato de las redes |
| 10 | Angular 21.1.4 tiene 6 vulnerabilidades altas (riesgo real bajo: sin SSR ni i18n) | `client/package.json` | `npm audit fix` a 21.2.x y probar |
| 16 | El `puuid` de todos los jugadores es público, también para anon | `user_json`, RLS de `profiles` | Quitarlo de `user_json` |

Bajos: errores de Riot expuestos al cliente (`riot.ts:57`), contraseña mínima de 6 caracteres, enumeración de emails en el registro, avatares sin cuota de almacenamiento y sin borrar el anterior.

## P1 · SEO

| # | Hallazgo | Arreglo |
|---|---|---|
| 1 | SPA sin SSR ni prerender: los bots y las vistas previas solo ven `<app-root>` | `@angular/ssr` con prerender de `/`, `/lfg`, `/players` y `/teams`; SSR o prerender periódico para perfiles y grupos |
| 2 | No hay `robots.txt` ni `sitemap.xml`; la reescritura sirve `index.html` en su lugar | Crearlos en `client/public/`; sitemap dinámico con un script en prebuild |
| 3 | 404 blandos: cualquier URL devuelve 200 y `**` redirige a la home | `NotFoundComponent` con `noindex` y reescritura acotada en `vercel.json` |
| 4 | Las rutas privadas no tienen `noindex` | `data.robots` en las rutas y un `SeoService` que lo aplique |
| 5 | Ni description por ruta, ni canonical, ni Open Graph, ni Twitter Card | `SeoService` con `Meta` y canonical; imagen OG de 1200x630 |

Medio y bajo: no hay JSON-LD (`Organization` y `WebSite` en `index.html`), ni manifest, ni iconos; caché `immutable` en el favicon sin hash; imágenes sin `width` ni `height`; Google Fonts bloqueante; dominio `vercel.app` (conviene uno propio antes de acumular enlaces).

## P2 · Protección de datos (además de P0)

- Google Fonts se carga desde los servidores de Google y les pasa la IP de cada visitante sin consentimiento. **Alojar las fuentes en local** lo arregla, y también mejora el SEO (rendimiento) y simplifica la CSP.
- Confirmar que la región de Supabase está en la UE y aceptar los DPA de Supabase y Vercel. HenrikDev no tiene DPA conocido.
- Plazos de conservación: los mensajes (90 días), las notificaciones (30 días) y los grupos LFG (24 horas) los tienen; las reseñas y los perfiles no.
- Dejar de guardar `account_level`, que ya no se usa.
- Hacen falta un registro de actividades (art. 30) y un procedimiento de brechas.
- El bloqueo automático por karma (`min_karma`) hay que documentarlo y ofrecer revisión humana.

## Textos que faltan, por prioridad

1. Política de privacidad, en español y en inglés.
2. Términos de uso y normas de la comunidad: edad mínima, reseñas veraces, acoso, cuentas falsas, moderación y apelación.
3. Aviso de Riot en el pie (texto vigente, en inglés) y corrección de "Proyecto Final de Grado".
4. Aviso legal con punto de contacto (DSA).
5. Política de moderación y denuncias.
6. Política de cookies y almacenamiento local. No hace falta banner mientras no haya analítica.
7. Texto de consentimiento al vincular Riot.
8. Documentos internos: registro de actividades, procedimiento de brechas y descripción para el portal de Riot. Esta última es para `redactor-riot`.

## Datos que tiene que dar el titular

Nombre o razón social, NIF, domicilio y email de contacto. Además: región de Supabase, proveedor SMTP, edad mínima (14 o 16 años), qué pasa con las reseñas al borrar una cuenta, y la configuración real de Auth en el panel de Supabase (URLs de redirección, confirmación de email, límites).

## Orden de trabajo propuesto

1. Lo rápido y sin dependencias:
   - `SeoService` con `noindex`, meta y canonical;
   - `robots.txt` y `sitemap.xml`;
   - cabeceras en `vercel.json`;
   - fuentes en local;
   - aviso de Riot en el pie.
2. Endurecer el karma:
   - miembros iniciales pendientes de aceptar;
   - confirmación de email;
   - límites de frecuencia;
   - validar las URLs de imagen y los tamaños de campo.
3. Textos legales (cuando el titular dé sus datos) y enlaces desde el registro y el pie.
4. Denuncias, moderación, borrado de cuenta y desvinculación de Riot (BACKLOG #6 y #12).
5. Verificación del Riot ID, `riot-validate` y CORS; después, RSO con la clave de producción.
6. SSR o prerender, JSON-LD, dominio propio y subida de Angular.
