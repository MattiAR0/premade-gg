# Registro de cambios

Cambios del proyecto, del más reciente al más antiguo. Las normas para mantener este archivo están en [`CLAUDE.md`](CLAUDE.md). Los registros anteriores están en `REDISENO-VALORANT.md` y `MIGRACION-SUPABASE.md`.

---

## 2026-11-09 · Publicación de la verificación del Riot ID

**Commit:** este commit (publica `42f4015`)

**Qué y por qué:** llevar a producción la verificación del Riot ID, el karma que se conserva al borrar la cuenta y la versión `2026-11-09` de los términos.

**Cambios:**
- Producción: `supabase db push --linked` de `20261109000001_verificacion_tipos.sql`, `20261109000002_verificacion_riot_id.sql` y `20261109000003_terminos_version.sql`.
- `supabase functions deploy --no-verify-jwt` de `riot-verify` (nueva), `riot-link`, `riot-validate`, `riot-refresh` y `delete-account` (todas usan `_shared`, que cambió).
- Git: push de `migrate-supabase` y avance rápido de `main` a `42f4015`; Vercel desplegó la web.

**Verificación:**
- `db push --dry-run` antes: solo las tres migraciones nuevas.
- Con la clave publicable de producción: `riot_challenges`, `riot_account_history` y `app_secrets` responden 401; `restore_riot_account`, `release_unverified_riot_id` y `puuid_hash`, "permission denied"; `riot-verify` sin sesión, 401; `profiles.riot_verified_at` existe.
- `supabase secrets list`: no hay `RIOT_BASE_URL` ni `HENRIK_BASE_URL` en producción.
- Navegador en producción: `/privacidad` muestra la fecha del 9 de noviembre y los textos nuevos, sin errores de consola.

**Pendiente:**
- Todas las cuentas, también la del titular, tienen que aceptar los términos nuevos desde el aviso de arriba.
- Probar el reto con una cuenta real de Valorant (lo demás sigue en la entrada anterior).

---

## 2026-11-09 · Verificación del Riot ID con la tarjeta de jugador y karma que no se limpia al borrar la cuenta

**Commit:** este commit

**Qué y por qué:** dos bloqueantes de `AUDITORIA-2026-11-05.md`: el Riot ID no se verificaba (cualquiera podía vincular el de otro) y borrar la cuenta limpiaba el karma y las suspensiones. Decisiones del titular: verificar con la tarjeta de jugador mientras no haya RSO y guardar 90 días un hash del PUUID con el karma y la suspensión.

**Cambios:**
- `20261109000001_verificacion_tipos.sql` (nueva): notificaciones `riot_id_claimed` y `riot_history_restored`.
- `20261109000002_verificacion_riot_id.sql` (nueva):
  - `profiles.riot_verified_at` y `riotVerified` en `user_json`.
  - `riot_challenges` (privada): reto de verificación por usuario, con la tarjeta de la última partida (`baseline_card`), el primer paso cumplido y la caducidad (24 h).
  - `riot_account_history` (privada): al borrar un perfil con valoraciones o suspensión vigente (trigger `remember_deleted_riot_account`) se guardan 90 días la suma y el número de valoraciones y el fin de la suspensión, con un HMAC del PUUID. La clave está en `app_secrets` (privada), se genera en cada base de datos y no está en el repositorio.
  - `restore_riot_account`: al vincular se hereda siempre la suspensión y el karma por debajo del neutro (3,5); el karma alto solo si quien vincula verifica. Si no, el historial se guarda para el dueño. Avisa con una notificación.
  - `profiles.karma_carry_sum` y `karma_carry_count`, y `refresh_karma`. `recalculate_karma` cuenta lo heredado, así que `trust_karma` también.
  - `suspensions.carried_until` y nueva `resolve_appeal`: revocar un recurso ya no borra la suspensión heredada.
  - `release_unverified_riot_id`: quita el Riot ID a una cuenta sin verificar. La cuenta vuelve al onboarding sin los datos de esa cuenta de Riot, se cierran sus grupos LFG y recibe un aviso. Es idempotente y no toca cuentas verificadas.
  - Cron `premadegg-riot-verification-cleanup`.
- Edge Function `riot-verify` (nueva), con las acciones `status`, `start` y `check`. El reto pide dos partidas empezadas después de crearlo: una con otra tarjeta (la de por defecto o, si ya la llevabas, cualquier otra) y otra posterior con la de siempre. Usa las partidas v4 de HenrikDev por PUUID. Límites por usuario y por IP.
- `riot-link`:
  - Si el Riot ID lo tiene una cuenta sin verificar, responde `409 riot_id_claimable`; con el reto superado se lo quita a esa cuenta y vincula verificado.
  - Primero pide los datos a HenrikDev y después libera, para que un fallo no deje a nadie sin Riot ID.
  - Un verificado con otro PUUID (nombre antiguo) da `riot_id_stale`.
  - Llama a `restore_riot_account` y borra el reto.
- `_shared/http.ts`: los errores pueden llevar `code`. `_shared/riot.ts`: `getRecentMatchCards` y `DEFAULT_CARD`. `RIOT_BASE_URL` y `HENRIK_BASE_URL` solo se aceptan si apuntan a una dirección local (pruebas con un servidor falso).
- Cliente:
  - Componente `app-riot-verify`: pasos del reto, progreso y retomar el reto después de jugar.
  - Ajustes de cuenta: sección "Riot ID".
  - Onboarding: "Recupera tu Riot ID" cuando el Riot ID está ocupado sin verificar, y al superarlo vincula solo.
  - El registro ya no bloquea un Riot ID ocupado.
  - Sello "Riot ID verificado" en el perfil (`c-badge--riot-verified`) e icono en la tarjeta de jugador.
  - Notificaciones nuevas en la campana.
- Textos: privacidad (finalidades y bases, decisiones automáticas, conservación con la huella seudonimizada, supresión con excepciones, HenrikDev), términos (verificación, pérdida del Riot ID con revisión humana, reputación tras borrar), Ajustes de cuenta, modal de borrado y onboarding.
- `config.toml` y `DEPLOY.md`: `riot-verify`.
- Versión nueva de los términos y la privacidad, `2026-11-09`: `20261109000003_terminos_version.sql` (`current_terms_version()`), `legal-info.ts` (también la fecha mostrada), `_shared/legal.ts` y `terms.test.sql`. Todas las cuentas tienen que volver a aceptar. Sin los 15 días de aviso que prometen los términos, por decisión del titular: los únicos usuarios son amigos suyos y el producto aún no está lanzado.
- El aviso de aceptar los términos (`app.html`) dice "Hemos actualizado…" y resume los cambios a quien ya había aceptado una versión anterior.
- Arreglo de un fallo anterior: `riot-refresh` (cada hora) y editar el perfil sustituían el usuario entero en el cliente y se perdían `termsVersion`, `isModerator` y `suspendedUntil`, que solo da `get_me`. Volvía a salir el aviso de los términos a quien ya los había aceptado y desaparecía el enlace de moderación. Ahora se fusionan (`auth.service.ts`).

**Verificación:**
- `npx supabase db reset` y `npm run db:test`: 132 de 132. `riot_verification.test.sql` (nuevo, 31 tests):
  - liberar el Riot ID, que repetirlo no avisa dos veces y que un verificado no se libera;
  - el historial al borrar y que el hash lleva clave;
  - restaurar con y sin verificar, y el karma heredado con valoraciones nuevas y borradas;
  - revocar un recurso con suspensión heredada;
  - el karma alto que no hereda un suplantador;
  - el historial caducado y los permisos desde la API.
- Prueba de punta a punta con un servidor falso de Riot y HenrikDev (`supabase functions serve` con las URL locales): 19 de 19 (verificar el propio Riot ID en dos pasos, recuperar un Riot ID ocupado, que el reto a medias no basta, y Riot ID verificado bloqueado).
- Navegador en local:
  - Ajustes de cuenta: reto, paso 1 "Hecho" y verificado.
  - Onboarding: Riot ID ocupado → reto → vinculado y verificado; la cuenta anterior queda sin Riot ID y con aviso.
  - El sello en el perfil (#ece8e1 sobre #16232f) y en la lista de jugadores. Sin scroll horizontal a 375 px.
  - Una cuenta que había aceptado `2026-11-07` ve "Hemos actualizado…"; al aceptar desaparece y no vuelve tras recargar, aunque `riot-refresh` actualice el perfil.
- `npm --prefix client run build` sin errores.
- `revisor-supabase`, `auditor-seguridad` y `auditor-legal` revisaron la primera versión. Se aplicaron:
  - el reto en dos partidas: con una bastaba con que el dueño ya hubiera cambiado de tarjeta;
  - restaurar también a quien verifica, porque si no verificarse limpiaba el historial;
  - que el karma alto ajeno no lo herede un suplantador;
  - la suspensión heredada frente a `resolve_appeal`;
  - el HMAC con clave secreta;
  - la liberación idempotente y después de pedir los datos;
  - la caducidad del reto superado;
  - el override de URL solo local;
  - el límite por IP;
  - el reto de un PUUID distinto al vinculado;
  - los nombres antiguos;
  - las notificaciones y los textos legales.

**Pendiente:**
- Probar con una cuenta real de Valorant cuánto tarda HenrikDev en mostrar una partida, si `started_at` es el inicio real y si incluye todos los modos (combate a muerte).
- Ponderación del interés legítimo por escrito (documento interno; borrador en el informe de `auditor-legal`).
- La respuesta de `start` dice si el jugador lleva la tarjeta por defecto: un dato menor sobre terceros, necesario para dar las instrucciones.
- Riot ID verificado con un nombre antiguo: hoy hay que resolverlo a mano (`riot_id_stale`).
- `riot-link` no es una sola transacción: si falla la actualización del perfil después de liberar, quien reclama tiene que reintentarlo.

---

## 2026-11-07 · Publicación de los textos legales

**Commit:** este commit (publica `da3c702`)

**Qué y por qué:** llevar a producción los textos legales y la aceptación obligatoria de los términos.

**Cambios:**
- Producción: `supabase db push --linked` de `20261107000003_aceptacion_terminos.sql` y `supabase functions deploy riot-link --no-verify-jwt`.
- Git: push de `migrate-supabase` y avance rápido de `main` a `da3c702`; Vercel desplegó la web.
- Antes de subir se rehízo el commit de los textos (`9181ff7` → `da3c702`) para que el NIF y el domicilio no llegaran al repositorio, que es público.

**Verificación:**
- `supabase migration list --linked`: la migración consta en remoto. `consents` responde 401 sin sesión y `riot-link` sin sesión, 401.
- Navegador en producción: `/aviso-legal` muestra titular y email, sin NIF ni domicilio (tampoco en el `main-*.js`); el pie enlaza a términos, privacidad, cookies, aviso legal y contacto; `/privacidad`, `/terminos` y `/cookies` se sirven.

**Pendiente:**
- Todas las cuentas de producción, también la del titular, tienen que aceptar los términos desde el aviso de arriba para volver a escribir.
- Lo demás sigue en la entrada de los textos legales (revisión por un abogado, buzón de contacto, proveedor de email, DPA y documentos internos).

---

## 2026-11-07 · Textos legales y aceptación de los términos

**Commit:** `da3c702`

**Qué y por qué:** el bloqueante "no hay ningún texto legal" de `AUDITORIA-2026-11-05.md`, también exigido para el registro del producto en Riot. Son borradores pendientes de revisión por un abogado.

**Cambios:**
- `client/src/app/legal/legal-info.ts` (nuevo): titular (nombre) y email de contacto, edad mínima (16), versión de los términos (`2026-11-07`) y fecha. Es el único sitio donde se cambian. Por decisión del titular no se publican NIF ni domicilio (sin actividad económica no los exige la LSSI) y no están en el código, porque el repositorio es público.
- `pages/legal/` (nuevo): `/privacidad`, `/terminos`, `/aviso-legal` y `/cookies`, con índice y estilos comunes (`legal.scss`).
  - Privacidad (RGPD 13 y 14): responsable, datos y su origen, qué datos son obligatorios, bases legales, qué es público (incluido el PUUID, que hoy sigue legible), karma y decisiones automáticas con revisión humana, denuncias y bloqueos, plazos reales de conservación, encargados (Supabase en París, Vercel, proveedor de email) y comunicaciones (Riot, HenrikDev, Google/Discord, imágenes externas), transferencias, derechos, AEPD, edad mínima y cambios con 15 días de aviso.
  - Términos: punto de contacto, requisitos, normas de la comunidad, valoraciones y karma, denuncias, medidas (retirar y suspender de 1 a 365 días), decisión motivada, recurso en 6 meses, denuncias abusivas, bloqueos, licencia sobre el contenido, Riot, responsabilidad, baja, cambios y ley aplicable.
  - Aviso legal (LSSI art. 10 y DSA arts. 11 y 12) y cookies (solo almacenamiento técnico, sin banner; si se añaden analítica o anuncios, banner con consentimiento previo).
- Pie: enlaces a términos, privacidad, cookies, aviso legal y contacto. `sitemap.xml` con las cuatro páginas. `app.config.ts`: `withInMemoryScrolling` para que el índice lleve a cada apartado.
- Registro y onboarding: casilla obligatoria "Acepto los términos de uso, he leído la política de privacidad y tengo 16 años o más". El onboarding avisa de que el Riot ID, el rango, el nivel, la tarjeta y el karma serán públicos. El formulario de valoración avisa de que se publica con tu Riot ID.
- `20261107000003_aceptacion_terminos.sql` (nueva):
  - tabla privada `consents` (usuario, versión, fecha), `current_terms_version()`, `accept_terms` (solo la versión vigente) y `termsVersion` en `get_me`;
  - `assert_not_suspended` ahora también exige haber aceptado la versión vigente, así que sin aceptar no se puede publicar, escribir ni valorar.
- `riot-link`: exige `acceptTerms` y guarda la aceptación antes de activar la cuenta. `_shared/legal.ts` con la versión.
- Aviso para las cuentas que ya existían: "Acepto y tengo 16 años o más" (`app.html`, `auth.service.acceptTerms`).
- `seed.sql` y los tests: los usuarios de prueba han aceptado la versión vigente. `terms.test.sql` (nuevo, 7 tests).

**Verificación:**
- `npx supabase db reset` y `npm run db:test`: 101 de 101.
- Navegador en local:
  - las cuatro páginas se ven, el índice lleva a cada apartado y el pie enlaza a todas y al email;
  - el registro no deja seguir sin la casilla y lo explica;
  - Player1 (cuenta anterior) ve el aviso, acepta y la aceptación queda guardada con versión y fecha;
  - sin scroll horizontal.
- `npm --prefix client run build` sin errores.
- `auditor-legal` revisó los textos frente al código. Se corrigieron:
  - la obligatoriedad del aviso;
  - los plazos de notificaciones y denuncias abiertas;
  - los chats directos que se borran;
  - el PUUID público;
  - el "cierre de cuenta" que no existía;
  - el preaviso de cambios;
  - la información del art. 13;
  - la licencia sobre el contenido;
  - la vía para quien vea su Riot ID usado por otro;
  - la redacción de la casilla.

**Pendiente:**
- Revisión por un abogado.
- Comprobar que el buzón `premagegg.app@gmail.com` existe y se revisa (el titular confirmó que la dirección es así).
- Si llegan anuncios o ingresos: añadir NIF y domicilio al aviso legal y quitar "sin ánimo de lucro".
- Nombrar el proveedor de email en la privacidad cuando se confirme cuál es (¿Brevo?).
- Aceptar los DPA de Supabase, Vercel y el proveedor de email.
- Documentos internos: registro de actividades (art. 30), procedimiento de brechas (72 h) y procedimiento para las solicitudes de borrado que reenvíe Riot.
- No implementado:
  - mover el PUUID a una tabla privada;
  - borrar cuentas sin onboarding o inactivas;
  - caducidad de las denuncias abiertas;
  - informar al denunciante de la vía de revisión dentro de la propia notificación.
- Antes de activar anuncios o Google Analytics: banner de cookies con Aceptar y Rechazar del mismo peso y actualizar privacidad y cookies.
- Riot: RSO y verificar la propiedad del Riot ID; preguntar por HenrikDev.

---

## 2026-11-07 · Publicación de denuncias y moderación

**Commit:** `3eb171b` (publica `b0a1955`)

**Qué y por qué:** llevar a producción las denuncias, la moderación, los bloqueos y las suspensiones.

**Cambios:**
- Producción: `supabase db push --linked` de `20261107000001_moderacion_tipos.sql` y `20261107000002_denuncias_moderacion.sql`.
- Git: push de `migrate-supabase` y avance rápido de `main` a `b0a1955`; Vercel desplegó la web.

**Verificación:**
- `supabase migration list --linked`: las dos migraciones constan en remoto.
- Con la clave publicable de producción: `reports`, `blocks`, `moderators` y `suspensions` responden 401; `rpc/get_reports` 401; `is_blocked_between`, `report_json` y `create_report` sin sesión no son invocables; `profiles.suspended_until` ya no existe; `get_lfg_posts` 200.
- Navegador en producción: el `main-*.js` servido incluye `/moderacion` y la recarga de chunks; `/moderacion` sin sesión lleva al login; `/players` sin errores de consola.

**Pendiente:**
- Dar de alta al titular como moderador en el editor SQL de Supabase: `insert into public.moderators (user_id) select id from auth.users where email = '<email del titular>';`
- Probar en producción con sesión: denunciar, resolver y recurrir.
- Durante la comprobación, Vercel empezó a responder 403 con su "Security Checkpoint" a todas las peticiones de `curl` desde este equipo, también con el user agent de Googlebot, Discord o WhatsApp (en el navegador el reto se pasa solo). Lo más probable es una mitigación temporal por IP tras cientos de peticiones automáticas, pero hay que revisar en Vercel (Firewall: Attack Challenge Mode y Bot Protection) que no esté activa para todo el tráfico: bloquearía a Google y las vistas previas de enlaces.

---

## 2026-11-07 · Denuncias, moderación, bloqueos y suspensiones

**Commit:** `b0a1955`

**Qué y por qué:** el bloqueante "no hay denuncias ni moderación" de `AUDITORIA-2026-11-05.md`. Pensado para la DSA: cualquiera puede denunciar con un motivo, la persona afectada recibe la decisión motivada y puede recurrirla, y el denunciante recibe el resultado. Modera el titular (tabla `moderators`, se añaden a mano).

**Cambios:**
- `20261107000001_moderacion_tipos.sql` (nueva): enums `report_target`, `report_reason`, `report_status` y `appeal_status`, y los tipos de notificación `report_update`, `moderation_notice` y `appeal_update`.
- `20261107000002_denuncias_moderacion.sql` (nueva):
  - Tablas privadas (RLS sin políticas y `revoke all`): `moderators`, `reports` (con copia del contenido al denunciarlo), `blocks` y `suspensions`. `notifications.report_id`, y `sender_id` admite null para no identificar al moderador.
  - Denunciar (`create_report`): perfil, valoración, mensaje (solo de un chat en el que estás), equipo o grupo LFG, con motivo de una lista y detalles. Exige perfil completo, una denuncia abierta por persona y contenido, y 10 al día. Avisa a los moderadores salvo al denunciado.
  - Moderar (`get_reports`, `resolve_report`): desestimar, retirar el contenido y/o suspender de 1 a 365 días, con un motivo obligatorio que reciben el denunciante y el afectado. Un moderador no ve ni resuelve denuncias sobre él ni las que ha puesto él. Retirar un mensaje también limpia la vista previa del chat.
  - Decisión y recurso (`get_moderation_decision`, `get_my_moderation_decisions`, `appeal_report`, `resolve_appeal`): el afectado ve qué se hizo, por qué y sobre qué contenido, y puede recurrir una vez en 6 meses. Al revocar se recalcula la suspensión con las demás decisiones que siguen en pie.
  - Suspensión: una cuenta suspendida no puede crear, editar, unirse, aceptar, escribir ni valorar (`enforce_rate_limits` y el trigger nuevo `enforce_not_suspended`); sí denunciar y recurrir. `get_me` devuelve `isModerator` y `suspendedUntil`.
  - Bloqueos (`set_block`, `get_block_status`, `get_my_blocks`): sin chats directos, invitaciones, solicitudes ni notificaciones entre los dos. Bloquear cancela las invitaciones y solicitudes pendientes. Los errores son genéricos para no delatar el bloqueo, no afectan a las valoraciones (si no, bloquear serviría para que no te valoren) ni a los chats de equipo. 30 bloqueos al día. Nadie puede saber quién le ha bloqueado.
  - Limpieza diaria: denuncias resueltas hace más de 12 meses y suspensiones cumplidas. Los avisos de decisión duran 7 meses (más que el plazo de recurso).
- `supabase/tests/database/moderation.test.sql` (nuevo, 25 tests).
- Cliente:
  - `shared/report-button` (nuevo): botón "Denunciar" con diálogo accesible, en perfiles, valoraciones, mensajes de otros, equipos y grupos LFG.
  - Perfil: "Bloquear" / "Desbloquear".
  - `pages/moderation` (nueva, `/moderacion`, solo moderadores con `moderatorGuard`): denuncias abiertas, recursos y resueltas, con la copia del contenido y el formulario de decisión.
  - `pages/moderation-decision` (nueva, `/moderacion/decision/:id`): decisión motivada y recurso.
  - Ajustes de cuenta: lista de decisiones de moderación sobre la cuenta, para no depender de la notificación.
  - Campana: enlaces "Ver la decisión y recurrir" y "Abrir moderación". Menú: "Moderación" para moderadores. Aviso fijo cuando la cuenta está suspendida.
  - `team-detail`: "Eliminar equipo", "Solicitud pendiente" y "Solicitar unirse" con mayúscula solo al inicio.
  - `/moderacion` con `noindex` en `vercel.json` y `Disallow` en `robots.txt`.

**Verificación:**
- `npx supabase db reset` y `npm run db:test`: 94 de 94 (25 nuevos).
- Navegador en local:
  - test2 denuncia a Player1 desde su perfil: el diálogo avisa si falta el motivo y confirma el envío. "Bloquear" y "Desbloquear" funcionan.
  - test1 (moderador) ve la denuncia en `/moderacion` con la copia del perfil y la suspende 1 día.
  - Player1 ve el aviso de suspensión, la notificación con "Ver la decisión y recurrir", la decisión completa y la lista en Ajustes de cuenta, y envía un recurso. Por la API, editar su perfil devuelve 403 con el mensaje de suspensión.
  - `profiles?select=suspended_until` ya no existe para nadie.
- `npm --prefix client run build` sin errores.
- `revisor-supabase`, `auditor-seguridad` y `auditor-legal` revisaron el diff. Se aplicó:
  - suspensión en tabla privada y aplicada también a ediciones y aceptaciones;
  - errores de bloqueo genéricos y fuera de las valoraciones;
  - avisos sin el nombre del moderador;
  - el moderador no resuelve lo que ha denunciado él;
  - acceso a la decisión durante todo el plazo de recurso;
  - textos sin promesas de "equipo" ni de anonimato garantizado.

**Pendiente:**
- Publicar (`db push`, push a `migrate-supabase` y `main`) y añadir al titular como moderador en producción.
- Lo legal, según `auditor-legal`, va con los textos legales:
  - punto de contacto (DSA 11 y 12);
  - términos con las normas, las medidas, su duración, el recurso y las denuncias abusivas (DSA 14);
  - política de privacidad con denuncias, bloqueos, copia del contenido y retención (RGPD 13 y 14);
  - protocolo de delitos graves (DSA 18);
  - registro de actividades.
- No hecho:
  - el denunciante no puede reclamar una desestimación (DSA 20 no aplica a microempresas, pero sería buena práctica);
  - el motivo en la notificación al denunciante se corta a 300 caracteres;
  - sin plazo de respuesta comprometido;
  - con un solo moderador, el recurso lo revisa la misma persona que decidió;
  - borrar la cuenta evita una suspensión;
  - un tercero puede juntar a dos bloqueados en un chat de grupo;
  - en chats de grupo y equipo los bloqueos no impiden ver mensajes;
  - `get_reports` no pagina.

---

## 2026-11-05 · Prueba descartada: quitar el preset angular de Vercel

**Commit:** `89e15a9` (la prueba está en `d80664a`, solo en la rama `prueba/vercel-sin-preset`)

**Qué y por qué:** comprobar si con `"framework": null` en `client/vercel.json` un chunk que no existe pasaba a dar 404 en lugar de `index.html`.

**Cambios:**
- Ninguno en `migrate-supabase` ni en producción: `client/vercel.json` sigue con `"framework": "angular"`.
- Rama `prueba/vercel-sin-preset` subida a GitHub; Vercel creó su preview y la compiló bien.

**Verificación:** en el preview (con la sesión de Vercel del titular, porque los previews están protegidos), las rutas de la app, `robots.txt`, `sitemap.xml`, la imagen OG, la CSP y `X-Robots-Tag` funcionan igual que en producción. Pero `/chunk-NOEXISTE123.js` y `/styles-NOEXISTE.css` siguen respondiendo 200 con `index.html`. El preset no era la causa, o no la única: Vercel aplica alguna regla de respaldo más que no se ve desde el repositorio.

**Pendiente:** nada urgente. Para el usuario el problema ya lo resuelve la recarga del router (`stale-chunk-reload.ts`). Si se quiere el 404, mirar en el panel de Vercel la configuración del proyecto (Framework Preset y Root Directory) o la salida de la build. Se puede borrar la rama `prueba/vercel-sin-preset`.

---

## 2026-11-05 · Publicación del arreglo de chunks: la regla de vercel.json no tiene efecto

**Commit:** `79d4316` (publica `944373b`)

**Qué y por qué:** al publicar el arreglo de las pestañas abiertas durante un despliegue se vio que la mitad de `vercel.json` no funciona en Vercel.

**Cambios:**
- Git: push de `migrate-supabase` y avance rápido de `main` a `944373b`; Vercel desplegó la web.
- Nada más. Este registro corrige lo que decía la entrada anterior sobre `vercel.json`.

**Verificación:**
- Vercel sirve el mismo `main-*.js` que la build local, así que la recarga del router (`stale-chunk-reload.ts`) está en producción.
- `curl` a producción: las rutas de la app responden 200 con HTML, y `robots.txt`, `sitemap.xml`, la imagen OG y `main-*.js` con su tipo. Pero `/chunk-NOEXISTE123.js` y `/styles-NOEXISTE.css` siguen respondiendo 200 con `index.html`, no 404.
- Causa: el preset `angular` de Vercel (`"framework": "angular"` en `vercel.json`) añade sus propias rutas por defecto (`handle: filesystem` y después `/(.*)` → `/index.html`) detrás de las reescrituras del proyecto. Comprobado en `packages/frameworks/src/frameworks.ts` del repositorio de Vercel. La exclusión de extensiones es correcta (probada con `path-to-regexp` 6, el que usa Vercel), pero esa ruta por defecto la recoge igualmente.
- No afecta al arreglo para el usuario: con HTML en lugar del chunk, el navegador da el mismo error ("Failed to fetch dynamically imported module") y el router recarga la página.

**Pendiente:** para que un chunk inexistente responda 404 de verdad haría falta quitar el preset (`"framework": null`, con `buildCommand` y `outputDirectory`, que ya están puestos) y comprobarlo en un despliegue de prueba antes de producción.

---

## 2026-11-05 · Pestañas abiertas durante un despliegue

**Commit:** `944373b`

**Qué y por qué:** tras cada despliegue, una pestaña que ya estaba abierta seguía con el JavaScript anterior y, al navegar a una ruta con carga diferida, pedía un chunk que ya no existía. La reescritura de `vercel.json` devolvía `index.html` en su lugar y la navegación fallaba ("Failed to fetch dynamically imported module"). Se vio al comprobar la publicación de la fase 2.

**Cambios:**
- `client/vercel.json`: la reescritura a `index.html` deja fuera las rutas que acaban en una extensión de archivo (`js`, `mjs`, `css`, `map`, fuentes, imágenes, `txt`, `xml`, `json`). Un chunk que no existe responde 404 en vez de HTML.
- `services/stale-chunk-reload.ts` (nuevo) y `app.config.ts`: `withNavigationErrorHandler` recarga la página en la URL de destino cuando falla la carga de un chunk (mensajes de Chrome, Firefox y Safari). Si vuelve a fallar en menos de 10 segundos no reintenta, para no entrar en bucle.

**Verificación:**
- El patrón nuevo, probado con Node: `/`, `/lfg`, `/profile/abc`, `/settings/account` y `/lfg/a.b` van a `index.html`; `/chunk-*.js`, `/styles-*.css`, `/media/*.woff2`, `/robots.txt` y `/assets/*` no.
- Build de producción servida en local con las reglas de Vercel (archivo, reescritura o 404): con la web abierta se quitó el chunk de `/players`. Al pulsar el enlace, el chunk respondió 404 y la página se recargó una sola vez en `/players`. Al restaurar el chunk, la recarga cargó "Jugadores · PremadeGG".
- `npm --prefix client run build` sin errores.

**Pendiente:** publicar (push a `migrate-supabase` y `main`) y comprobar con `curl` en producción que un chunk inexistente responde 404.

---

## 2026-11-05 · Publicación de la fase 2

**Commit:** `c3fd59b` (publica `3c34593`)

**Qué y por qué:** llevar a producción la fase 2 (karma no manipulable).

**Cambios:**
- Producción: `supabase db push --linked` de `20261105000002_invitaciones_tipos.sql` y `20261105000003_anti_abuso_karma.sql`.
- Producción: `supabase functions deploy riot-validate riot-link delete-account --no-verify-jwt`.
- Git: push de `migrate-supabase` y avance rápido de `main` a `3c34593`; Vercel desplegó la web.

**Verificación:**
- `supabase migration list --linked`: las dos migraciones constan en remoto.
- Con la clave publicable de producción: `played_pairs`, `team_invites`, `rate_counters`, `rpc/rl_check` y `rpc/played_together` responden 401; `lfg_members?status=eq.invited` devuelve `[]`; `get_lfg_posts` responde 200.
- `riot-validate` con el cuerpo vacío pasa por el límite de frecuencia y devuelve el mensaje de validación; `delete-account` sin sesión, 401.
- Vercel sirve el mismo `main-*.js` que la build local. En una pestaña nueva, la home (con el texto nuevo del paso 3), `/players` y `/teams` cargan sin errores de consola.

**Pendiente:**
- `RATE_LIMIT_SECRET` no está definido: `ipKey` usa la service role key como clave del HMAC. Funciona, pero conviene un secreto propio (`supabase secrets set RATE_LIMIT_SECRET=...`).
- Probar en producción con sesión: una invitación de verdad y una valoración tras 15 minutos juntos.
- Fallo anterior a esta fase: una pestaña abierta durante un despliegue pide chunks que ya no existen; la reescritura de `vercel.json` devuelve `index.html` y la navegación falla ("Failed to fetch dynamically imported module"). Arreglo: no reescribir las rutas `*.js` y recargar la página ante ese error del router.

---

## 2026-11-05 · Fase 2: que el karma no se pueda manipular

**Commit:** `3c34593`

**Qué y por qué:** el bloqueante "karma manipulable" de `AUDITORIA-2026-11-05.md`. Decisiones del titular: solo se puede valorar a quien coincidió contigo, aceptado por los dos, y los miembros que añade el creador de un grupo o el propietario de un equipo pasan a ser invitaciones que hay que aceptar.

**Cambios:**
- `20261105000002_invitaciones_tipos.sql` (nueva): `member_status` admite `invited` y `notification_type` admite `lfg_invite` y `team_invite`. Va aparte porque un valor nuevo de un enum no se puede usar en la misma transacción.
- `20261105000003_anti_abuso_karma.sql` (nueva):
  - `recalculate_karma` bloquea la fila del perfil con `for no key update` antes de recalcular. Con dos valoraciones simultáneas al mismo jugador, la segunda no veía la primera.
  - `played_pairs`: registro persistente de quién ha coincidido con quién (los grupos LFG se borran a las 24 h y con ellos la prueba). La pareja se forma al aceptar y el cron `confirm_played_pairs` (cada 5 min) solo la confirma si siguen juntos 15 minutos después; si se forma de nuevo sin confirmar, el reloj vuelve a empezar. Se rellenó con los grupos y equipos actuales, ya confirmados.
  - `played_together`: pareja confirmada y renovada en los últimos 30 días. Es `security definer` y solo responde si quien pregunta es uno de los dos; `anon` no puede llamarla.
  - `create_review` exige `played_together` y perfil completo. `get_review_eligibility` devuelve `reason: 'not_played_together'`. Las valoraciones que ya existían se conservan.
  - Grupos LFG: `create_lfg_post` deja a los añadidos como `invited` y les manda una notificación. Nueva `respond_lfg_invite`. `join_lfg_post` acepta la invitación si ya estabas invitado. `handle_lfg_member` solo actúa sobre solicitudes `pending` (el creador no puede "aceptar" a un invitado por él). `leave_lfg_post` cancela una invitación sin aviso de expulsión. Los invitados solo los ven el creador y el invitado, también leyendo `lfg_members` directamente (política nueva).
  - Equipos: tabla `team_invites`. `create_team` y `add_team_player` invitan en lugar de añadir. Nueva `respond_team_invite`. `notifications.team_id` y `notification_json` con el equipo.
  - Límites de frecuencia: tabla `unlogged` `rate_counters`, `rl_check` (ventana fija, error `PT429` → HTTP 429, solo para `service_role`) y el trigger `enforce_rate_limits` para las peticiones con usuario: 10 valoraciones al día; 5 grupos por hora, 15 al día y máximo 3 abiertos; 20 solicitudes a grupos por hora; 30 invitaciones al día; 20 solicitudes a equipos al día; 2 equipos al día; 5 chats de grupo y 20 directos por hora; 20 mensajes por minuto y 300 por hora; 30 ediciones de perfil por hora.
  - Cron `premadegg-anti-abuse-cleanup`: contadores de más de 2 días, parejas sin coincidir en 12 meses e invitaciones a equipo de más de 30 días.
- Edge Functions: `rateLimit` e `ipKey` en `_shared/supabase.ts`. `riot-validate` 30 por hora por IP (HMAC de la IP de `cf-connecting-ip` o de la última entrada de `x-forwarded-for`, con la fecha y un secreto: `RATE_LIMIT_SECRET` o, si no existe, la service role key). `riot-link` 10 por hora y `delete-account` 5 al día por usuario. `riot-refresh` ya tenía una espera de 1 hora.
- Cliente:
  - Campana con Aceptar y Rechazar en las invitaciones, enlace "Ver equipo" e icono propio (`notification-bell`, `notification.service.ts`, `_notifications.scss`).
  - Detalle del grupo: el invitado ve "Aceptar invitación" y "Rechazar"; el creador ve "Invitaciones sin responder" y puede cancelarlas (`lfg-detail`).
  - Perfil: aviso de que solo se valora a quien estuvo contigo al menos 15 minutos, y el sello "Verificado" pasa a "Jugaron juntos".
  - Textos de "Invitar a jugadores" al crear grupos y equipos, paso 3 de la home y `README.md`.
  - Modelos: `invited`, `lfg_invite`, `team_invite`, `team` y `not_played_together`.

**Verificación:**
- `npx supabase db reset` con la cadena completa de migraciones en orden y `npm run db:test`: 69 de 69. Tests nuevos: no se valora sin haber coincidido, el invitado no cuenta hasta aceptar, el creador no acepta por el invitado, `anon` no ve invitaciones, la pareja no cuenta hasta 15 minutos juntos, invitación a equipo, `rl_check` no se puede llamar desde la API, corte con `PT429` y más de 20 mensajes por minuto cortados por el trigger.
- Carrera del karma reproducida en local: con la función antigua, dos valoraciones simultáneas dejaban `review_count` en 1 con 2 filas; con la nueva, 2 de 2 en tres pasadas y sin interbloqueos.
- PostgREST local: `rl_check` responde 204 y luego 429 con código `PT429`; con la clave publicable, 401; `played_pairs` no se puede leer.
- Navegador en local: Player1 invita a TestUser2; la campana de TestUser2 muestra la invitación con Aceptar y Rechazar; al aceptar desaparece y el grupo dice "Estás en este grupo". En el perfil de alguien con quien no ha coincidido sale el aviso y no hay botón Valorar.
- `npm --prefix client run build` sin errores.
- `revisor-supabase` y `auditor-seguridad` revisaron el diff. Se aplicaron: `for no key update` (el `for update` podía interbloquearse con el `key share` de la FK), `played_together` restringida a la pareja, política de `lfg_members`, 15 minutos de coexistencia, IP fiable con HMAC, límite a `team_join_requests` y caducidad de parejas e invitaciones.

**Pendiente:**
- Publicar: `db push --linked` de las dos migraciones, `functions deploy riot-validate riot-link delete-account --no-verify-jwt` y push. Opcional: `supabase secrets set RATE_LIMIT_SECRET=...`.
- Sigue abierto (fase 3), según `auditor-seguridad`:
  - colusión entre cuentas propias (dos cuentas que estén juntas 15 minutos pueden valorarse);
  - cuentas desechables (confirmación de email desactivada en local, falta verlo en producción);
  - Riot ID sin verificar;
  - borrar la cuenta y volver con el mismo Riot ID limpia el karma;
  - no hay bloquear ni denunciar;
  - los chats de grupo, el coach y el staff se asignan sin aceptación.

  El arreglo de fondo de "habéis jugado juntos" es comprobar partidas reales con la API de Riot cuando haya clave de producción.
- El coach y el staff de un equipo ya no forman pareja para valorar, porque se asignan sin que acepten. Antes sí contaban.
- No hay forma de que el propietario cancele una invitación a equipo, y las invitaciones a un grupo que se llena se quedan hasta que el grupo caduca.

---

## 2026-11-05 · Publicación de la fase 1

**Commit:** `8916b86` (publica `edf03ca`)

**Qué y por qué:** llevar a producción la fase 1 antes de presentar a Riot.

**Cambios:**
- Producción: `supabase db push --linked` de `20261105000001_user_json_sin_puuid.sql`.
- Producción: `supabase functions deploy riot-validate riot-link riot-refresh delete-account --no-verify-jwt`.
- Git: push de `migrate-supabase` y avance rápido de `main` a `edf03ca`; Vercel desplegó la web.

**Verificación:**
- `curl -I https://premade-gg.vercel.app/`: llegan `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, `X-Content-Type-Options` y HSTS. `/login` lleva `X-Robots-Tag: noindex` y `/lfg` no.
- `robots.txt` se sirve como `text/plain`, `sitemap.xml` como `application/xml` y `og-premadegg-v1.png` como `image/png`; el HTML inicial lleva `og:image` y ya no carga Google Fonts.
- CORS de `riot-validate`: el preflight desde `https://premade-gg.vercel.app` devuelve ese origen y desde un origen ajeno no devuelve ninguno. `delete-account` sin sesión da 401; `riot-validate` con el cuerpo vacío da el mensaje nuevo.
- Navegador en producción: home, `/players` y una ruta inexistente sin errores de consola; el CSS en `media=all`, 4 fuentes cargadas desde el propio dominio, las RPC de Supabase con 200 y un `fetch` a `valorant-api.com` permitido por la CSP (200).

**Pendiente:** probar en producción con sesión (chat, campana, onboarding) y la vista previa al pegar el enlace en Discord o WhatsApp.

---

## 2026-11-05 · Fase 1 antes de presentar a Riot: avisos, textos, SEO, cabeceras y accesibilidad

**Commit:** `edf03ca`

**Qué y por qué:** primera tanda del orden de trabajo de `AUDITORIA-2026-11-05.md`: lo que se podía hacer sin datos del titular ni cambios de producto. Quitar lo que hace parecer el producto oficial de Riot o un trabajo académico, enseñar algo útil al compartir el enlace, endurecer cabeceras y CORS, y arreglar los incumplimientos AA del chat.

**Cambios:**
- Avisos y textos:
  - `app.html`: fuera "Proyecto Final de Grado". El pie lleva una frase en español y los dos avisos de Riot en inglés (`lang="en"`): el de las políticas del portal y el de "Legal Jibber Jabber". El lema ya no dice "reputación real". El `<nav>` del pie tiene `aria-label`.
  - `home.component.html` y `onboarding.component.html`: fuera "los jugadores tóxicos se quedan fuera", "se sincronizan con tu cuenta real" y "así el matchmaking es real". El onboarding avisa de que el Riot ID y el rango serán visibles para los demás.
  - `README.md`: el proyecto se presenta como independiente (empezó como TFG), sin "matchmaking", y con el aviso de Riot.
  - `_shared/riot.ts`, `riot-validate` y `riot-link`: los errores ya no nombran la API key, HenrikDev, `gameName`/`tagLine` ni los códigos de región. Los fallos de la clave y el 429 de HenrikDev se registran solo en los logs.
  - Unos 25 mensajes "Error al…" o "Por favor…" de las páginas pasan a "No se pudo X. Inténtalo de nuevo." o a qué campo rellenar.
  - `db-errors.ts`: los mensajes de las RPC se ajustan al vocabulario de la UI ("post LFG" → grupo, "review" → valoración, "dueño" → propietario, "remover" → quitar, "agregar" → añadir, decimales con coma) sin redefinir las RPC.
- SEO y vista previa:
  - `index.html`: description de 150 caracteres, `theme-color`, Open Graph, Twitter Card e imagen `og-premadegg-v1.png` (1200x630, generada con Edge sin interfaz a partir de los colores y fuentes de la marca). Sin `canonical` ni `og:url` estáticos: sin SSR marcarían todas las páginas como la home.
  - `client/public/robots.txt` y `sitemap.xml` (`/`, `/lfg`, `/players`, `/teams`).
  - `pages/not-found` (nuevo): la ruta `**` muestra "Esta página no existe" con `noindex` en lugar de redirigir a la home. Vercel sigue respondiendo 200 (sin SSR no hay 404 HTTP).
- Cabeceras y Edge Functions:
  - `client/vercel.json`: `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy` y `X-Robots-Tag: noindex` en login, registro, onboarding, contraseñas, mensajes y ajustes. La CSP permite por hash (`'unsafe-hashes'`) el `onload="this.media='all'"` que Angular pone en el CSS; `img-src` admite cualquier `https:` porque los logos y avatares pueden venir de cualquier dominio. La caché `immutable` queda solo para JS, CSS y fuentes con hash (ya no para `favicon.ico` ni la imagen OG).
  - `_shared/http.ts`: CORS con lista de orígenes (producción, localhost y el secreto opcional `ALLOWED_ORIGINS`) en lugar de `*`, con `Vary: Origin`; a un origen ajeno no se le devuelve cabecera.
  - `riot-validate` ya no devuelve el `puuid`. Sigue siendo pública porque el registro la llama antes de que haya sesión.
  - `verify_jwt` sigue en `false`, como explica `config.toml` (las funciones validan el token dentro).
- Datos:
  - `20261105000001_user_json_sin_puuid.sql` (nueva): `user_json` deja de incluir el `puuid`, así que ninguna RPC lo devuelve. Test nuevo en `security.test.sql`.
  - `user.model.ts` y `riot.model.ts`: fuera el campo `puuid`.
- Fuentes: Anton, Barlow y Barlow Condensed se sirven desde el propio dominio con `@fontsource/*` (OFL, solo el subconjunto latino, en `angular.json`). Fuera Google Fonts de `index.html`: ya no se envía la IP de los visitantes a Google.
- Accesibilidad:
  - `messages.component.html`: el botón de enviar tiene nombre; los tres campos tienen `aria-label`; la lista de mensajes es `role="log"` con `aria-live`; "escribiendo…" va en un `role="status"` que existe siempre; los resultados de búsqueda y las etiquetas de usuarios elegidos son botones (antes `li` y `span` con `click`).
  - `notification-bell` y `message-panel`: `aria-expanded`, `aria-controls`, el número sin leer en el nombre del botón, Esc cierra el panel y devuelve el foco, `type="button"` y SVG con `aria-hidden`. "Ver grupo" también marca la notificación como leída.
  - Nuevo `$color-border-input` (`#667a8c`): 3,26:1 sobre elevated, 3,59:1 sobre card y 4,21:1 sobre el fondo del campo. Lo usan el mixin `form-control` y los campos de login, registro, contraseñas, chat, perfil, edición de perfil y equipos (antes 1,2–2,0:1).
- Angular de 21.1.4 a 21.2.26 (`@angular/build` y `cli` a 21.2.29) con `ng update`.

**Verificación:**
- `npm --prefix client run build` sin errores; el aviso de presupuesto sube de 554 a 569 kB.
- `npm audit --omit=dev` en `client/`: 0 vulnerabilidades (antes 6 altas).
- `npx supabase migration up` en local y `npm run db:test`: 53 de 53.
- Build de producción servida en local con las cabeceras de `vercel.json`: sin errores de CSP en consola, el CSS pasa a `media=all`, las fuentes se cargan desde el propio dominio, `get_lfg_posts` responde 200 y una ruta inexistente muestra la página nueva con `noindex`.
- Navegador en local con `test1@premade.gg`: botones del chat y de la búsqueda con nombre y 44 px de alto, Esc cierra la campana y el foco vuelve a ella, borde de los campos `#667a8c`. A 375 px el pie no provoca scroll horizontal.
- `revisor-supabase`: sin bloqueantes. `auditor-seguridad`: detectó que la CSP bloqueaba el `fetch` de `agent-icons.service.ts` a `valorant-api.com`; se añadió a `connect-src`.

**Pendiente:**
- Publicar: `npx supabase db push --linked`, `supabase functions deploy riot-validate riot-link riot-refresh delete-account --no-verify-jwt` y push a `migrate-supabase` y `main`. Si se usa un dominio propio o las previews de Vercel, definir antes `ALLOWED_ORIGINS`.
- Comprobar en producción las cabeceras reales (`curl -I`) y la vista previa al compartir el enlace.
- `profiles.puuid` sigue siendo legible con un `select` directo a la tabla. No se puede revocar la columna porque las RPC de lectura usan la fila entera; el arreglo completo es moverlo a una tabla privada (fase 2). No está resuelto del todo.
- `riot-validate` sigue sin límite de frecuencia (fase 2).
- `account_level` no se ha dejado de guardar: se muestra en la tarjeta del jugador ("Nv."), así que la auditoría se equivocaba al decir que no se usa.
- No hay enlaces a privacidad ni a términos: faltan los textos legales (fase 3).

---

## 2026-11-05 · Anexo de la re-auditoría con agentes de VoltAgent

**Commit:** `55fed06`

**Qué y por qué:** completar la re-auditoría con lo que no se había mirado (accesibilidad, rendimiento, diseño de la base de datos contra el abuso, calidad del cliente Angular y textos de la UI), usando cinco agentes del repositorio VoltAgent/awesome-claude-code-subagents.

**Cambios:**
- `AUDITORIA-2026-11-05.md`: nuevo anexo con los informes de `ux-microcopy-reviewer`, `postgres-pro`, `accessibility-tester`, `performance-engineer` y `angular-architect`.
- Los agentes no se instalaron en `.claude/agents/`: corrieron como agentes genéricos con la definición del repositorio como guía, en solo lectura.

**Verificación:** antes de usarlas se leyeron las cinco definiciones (solo instrucciones de rol, sin scripts). Se comprobaron con grep los textos de alta severidad (`onboarding.component.html:6`, `home.component.html:15`, `riot.ts:55` y `:94`), que el botón de enviar del chat no tiene `aria-label` y que el cliente no usa zone.js (los agentes se contradecían en esto). Ninguno de estos frentes bloquea la presentación a Riot.

**Pendiente:** la posible carrera en el recálculo del karma (`recalculate_karma`) está sin reproducir. El resto de los arreglos del anexo están sin hacer.

---

## 2026-11-05 · Re-auditoría antes de presentar a Riot

**Commit:** `f4270b1`

**Qué y por qué:** comprobar si PremadeGG está listo para el registro del producto en Riot y la clave de producción. Los agentes `auditor-legal`, `auditor-seguridad` y `auditor-seo` revisaron el commit `1b0a4d9` y producción frente a la auditoría del 2026-11-03.

**Cambios:**
- `AUDITORIA-2026-11-05.md` (nuevo): informe conjunto con el estado de cada punto anterior, hallazgos nuevos, lo que pedirá Riot en el registro y el orden de trabajo.
- `INDICE.md`: enlace a la nueva auditoría.

**Verificación:** los agentes son de solo lectura; en producción solo hicieron peticiones sin sesión. Veredicto: no está listo. Los cuatro bloqueantes P0 siguen abiertos (Riot ID sin verificar, sin textos legales, sin denuncias, karma manipulable) y el borrado de cuenta permite limpiar el karma volviendo a registrarse con el mismo Riot ID.

**Pendiente:** todo el orden de trabajo de la auditoría. Hacen falta los datos del titular para los textos legales y comprobar en los paneles la región de Supabase, la confirmación de email y el SMTP.

---

## 2026-11-05 · Fuera las skills que no encajan con el stack

**Commit:** `1b0a4d9`

**Qué y por qué:** cada skill añade su descripción al contexto de cada sesión. Cuatro no sirven para PremadeGG: `resend` (los correos los manda Supabase Auth), `vercel-react-best-practices` (el frontend es Angular) y `mongodb-schema-design` y `mongodb-query-optimizer` (la base de datos es Postgres desde la migración a Supabase).

**Cambios:**
- `.claude/skills/`: borradas las cuatro carpetas. Siguen en el historial de git (commit `54cfb68`).
- `.claude/skills/README.md`: nota con el borrado, fuera sus filas de las tablas y el punto del pendiente que proponía quitarlas.

**Verificación:** ningún agente, `CLAUDE.md` ni otra skill las menciona (búsqueda en `*.md` y `*.json`). Quedan 17 skills de terceros y las 2 propias.

---

## 2026-11-05 · Publicación del filtro de palabras y del borrado de cuenta

**Commit:** este commit (publicación de lo fusionado el 2026-11-03)

**Qué y por qué:** quedaba pendiente llevar a producción las dos migraciones del 2026-11-03, la Edge Function `delete-account` y los commits sin subir de `migrate-supabase`.

**Cambios:**
- Supabase local: `db reset` con la cadena completa de migraciones en orden (las del 2026-11-03 se habían aplicado al revés en local). Aplican sin errores y el seed carga.
- Producción: `supabase db push --linked` de `20261103000001_profanity_filter.sql` y `20261103000002_delete_account.sql`.
- Producción: `supabase functions deploy delete-account --no-verify-jwt` (versión 1, activa).
- Git: push de `migrate-supabase` y avance rápido de `main` hasta el mismo commit.
- Docker Desktop 4.41.2 no arrancaba ("initializing Inference manager… The file cannot be accessed by the system") por un socket viejo `dockerInference`. Se renombró `%LOCALAPPDATA%\Docker\run` a `run.old-20261105` y arrancó. Es un problema del equipo, no del repositorio.

**Verificación:**
- `npm run db:test`: 52 de 52 en verde tras el `db reset`.
- `npm --prefix client run build` sin errores (solo el aviso de presupuesto del bundle inicial, que ya existía).
- `supabase migration list --linked`: las dos migraciones constan en remoto.
- `delete-account` en producción con curl: 405 con GET y 401 con POST sin sesión.

**Pendiente:**
- Pegar `supabase/templates/email_change.html` en el panel de Supabase (Authentication → Email Templates → Change Email Address). No se hizo con `supabase config push` porque sube toda la configuración de auth local y podría pisar la de producción.
- Comprobar en `premade-gg.vercel.app` el despliegue de `main` (Copiar Riot ID, ajustes de cuenta y censura en el chat).
- Borrar `%LOCALAPPDATA%\Docker\run.old-20261105` cuando Windows lo permita (contiene el socket bloqueado).

---

## 2026-11-05 · Skills de terceros versionadas

**Commit:** `54cfb68`

**Qué y por qué:** `.claude/skills/` tenía 21 skills importadas el 2026-10-24 sin versionar. Los agentes `auditor-seo` y `auditor-seguridad` cargan `seo-audit`, `schema`, `security-and-hardening` y `security-best-practices`, así que sin ellas un clon del repositorio deja a los agentes cojos.

**Cambios:**
- `.claude/skills/` (288 archivos, ~4 MB): las 21 skills entran en git tal como estaban.
- `.claude/skills/README.md`: nota de que el registro es de la época Express + MongoDB, columna "¿Encaja?" puesta al día con Supabase, qué agente usa cada skill, las dos skills de MongoDB marcadas como que ya no aplican y nueva sección con las skills propias (`cumplimiento-legal` y `politicas-riot`).

**Verificación:** búsqueda de claves y secretos en `.claude/skills/` sin resultados. El archivo más grande es `impeccable/scripts/data/font-index.json` (1,1 MB); no hay binarios.

**Pendiente:** decidir si se borran `resend`, `vercel-react-best-practices` y las dos de MongoDB, que no encajan con el stack y añaden su descripción al contexto de cada sesión.

---

## 2026-11-03 · Fusión de los puntos 5, 12 y 6 y arreglo de un test

**Commit:** este commit (fusiones `e82c177`, `f937a19` y `1f5c0fc`)

**Qué y por qué:** juntar en `migrate-supabase` las tres ramas hechas en paralelo (Copiar Riot ID, filtro de palabras malsonantes y ajustes de cuenta).

**Cambios:**
- Fusionadas `claude/copiar-riot-id-4036b5`, `claude/filtro-palabrotas-df927d` y `claude/ajustes-cuenta-ee319b`. El código entró sin conflictos. En `CAMBIOS.md`, `BACKLOG.md` e `INDICE.md` se conservaron las entradas de todas las ramas. En el backlog, el punto 12 pasa a la lista de hechas.
- En las entradas de esta tanda, "este commit" se cambia por el hash real de cada commit.
- `supabase/tests/database/profanity.test.sql`: el test de la vista previa censurada leía `conversations limit 1` y, con los datos de prueba que añade el seed de ajustes de cuenta, cogía otra conversación (`NULL`). Ahora lee la conversación del propio test.

**Verificación:**
- `npm --prefix client run build` sin errores (solo el aviso de presupuesto del bundle inicial, que ya existía).
- `npm run db:test`: 52 de 52 en verde tras el arreglo (antes fallaba el 25).
- Navegador en local: el perfil de Player10 muestra "Copiar Riot ID", `/settings/account` sin sesión lleva al login y la consola no da errores.

**Pendiente:**
- En el Supabase local las dos migraciones nuevas se aplicaron en orden inverso (`000002` antes que `000001`). No se ha probado la cadena completa en orden con `db reset`, porque borra los datos locales; en producción `db push` las aplicará en orden.
- Publicar: `npx supabase db push --linked`, `supabase functions deploy delete-account --no-verify-jwt`, plantilla `email_change.html` en el panel de Supabase y push a `migrate-supabase` y `main`.

---

## 2026-11-03 · Enlaces entre Editar perfil y Ajustes de cuenta

**Commit:** `0c331d2`

**Qué y por qué:** la sesión coordinadora pidió dejar los ajustes en `settings/account`, junto a `settings/profile`, y enlazar las dos pantallas. La ruta ya era esa. El enlace a Editar perfil iba dentro de la descripción de la cabecera, que se oculta en móvil.

**Cambios:**
- `account-settings.component.html`: botón "Editar perfil" en `c-page-header__actions`. La descripción queda solo como texto.
- `profile-edit.component.html`: botón "Ajustes de cuenta" en la misma posición.
- `account-settings.component.scss`: fuera el estilo `c-account__link`, que ya no se usa.

**Verificación:** `ng build` sin errores. En el navegador (puerto 4303) los dos botones llevan a la otra pantalla. A 375 px se ven bajo el título, miden 44 px y no hay scroll horizontal.

---

## 2026-11-03 · Ajustes de cuenta: email, contraseña y borrado

**Commit:** `9564fc7`

**Qué y por qué:** punto 6 del backlog. La usuaria no podía cambiar su email o su contraseña ni borrar su cuenta desde la web.

**Cambios:**
- Ruta nueva `/settings/account` (protegida, junto a `/settings/profile`): `pages/account-settings/` con tres bloques.
  - **Email:** `supabase.auth.updateUser({ email })` con vuelta a la misma página. Avisa de que llega un correo de confirmación y muestra el cambio pendiente (`new_email`).
  - **Contraseña:** pide la actual, la nueva y su repetición. La actual se comprueba volviendo a iniciar sesión con ella antes de `updateUser({ password })`. Si la cuenta solo entra con Google o Discord, explica que no hay contraseña de PremadeGG en vez de mostrar el formulario.
  - **Borrar cuenta:** botón con `$color-brand` (aviso de peligro) que abre un `alertdialog` con `appDialog`. Hay que escribir el Riot ID (sin distinguir mayúsculas) o `BORRAR`; el botón final está desactivado hasta entonces.
- `AuthService`: `getAccountInfo`, `changeEmail`, `changePassword` y `deleteAccount` (cierra la sesión local al terminar). Dos errores de Auth más traducidos.
- Menú del usuario: "Configuración" pasa a llamarse "Editar perfil" y se añade "Ajustes de cuenta".
- Edge Function nueva `delete-account` (`requireUser`): repite la comprobación del Riot ID o `BORRAR`, borra los avatares de `avatars/<uid>/` (en bucle, porque `list` no pagina) y después `auth.admin.deleteUser`. Storage va primero a propósito: si falla `deleteUser`, como mucho se pierde la foto y se reintenta; al revés quedarían fotos públicas de una cuenta que ya no existe.
- Migración `20261103000002_delete_account.sql`: decisión de **borrar en cascada, sin anonimizar**. Una valoración o un mensaje de una cuenta que ya no existe no aporta nada y el karma de los demás no debe depender de ella. Las FK ya eran `on delete cascade`; el trigger `on_profile_deleted` (antes del borrado del perfil) arregla lo que la cascada deja incoherente:
  - grupos LFG ajenos llenos en los que estaba aceptado vuelven a `open`;
  - los equipos que creó pasan al jugador más antiguo (si no, al coach; si no, al staff más antiguo), también como admin del chat del equipo. Solo se borran si no queda nadie;
  - sus chats directos se borran;
  - los chats de grupo que administraba pasan al participante más antiguo, o se borran si no queda nadie;
  - la vista previa del último mensaje se recalcula sin sus mensajes;
  - avisa por Realtime (`conversation:removed` / `conversation:updated`) a los demás participantes, igual que las RPC de equipo.
  - El karma de los jugadores que valoró ya lo recalculaba el trigger de reputación.
  - La función del trigger no se puede ejecutar desde fuera (`revoke execute`) y hay índices nuevos en `messages.sender_id`, `conversations.admin_id` y `conversations.last_message_sender` para que el borrado no recorra tablas enteras.
- `supabase/templates/email_change.html` y su entrada en `config.toml`: correo de cambio de email en español. `config.toml` también declara `delete-account` con `verify_jwt = false`, como las otras funciones.
- `seed.sql`: cuenta de prueba `borrame@premade.gg` (contraseña del seed) con datos en todo lo que limpia el trigger.
- `DEPLOY.md`: despliegue de `delete-account` y la plantilla nueva.

**Verificación:**
- `ng build` sin errores (solo el aviso de presupuesto del bundle inicial, que ya existía; la página va en un chunk aparte de 16,8 kB).
- En el navegador (puerto 4303) con `borrame@premade.gg`: cambio de email con los dos correos en Mailpit y el enlace aplicado; contraseña actual errónea (error con `role="alert"` y foco en el campo), cambio correcto y login con la nueva; rama OAuth simulando `providers = [discord, google]`; borrado escribiendo el Riot ID en minúsculas, que cierra la sesión y lleva a la portada.
- En la base de datos tras borrar: usuario y avatar fuera, karma de TestUser1 de 1,0 a 5,0, dúo de nuevo `open`, equipo y su chat pasados a TestUser3, chat directo eliminado, admin del grupo pasado a TestUser2, vista previa recalculada y cuatro eventos en `realtime.messages` para los afectados. El segundo borrado se hizo escribiendo `BORRAR`.
- `delete-account` con curl: 401 sin sesión, 400 con confirmación incorrecta, 405 con GET.
- Modal: foco al abrir en el campo, Tab cíclico, Esc cierra y devuelve el foco al botón. Móvil a 375 px sin scroll horizontal y controles de 44 px.
- Contraste medido: título de peligro 5,8:1, error 5,5:1, éxito 7,8:1, aviso pendiente 9,4:1, botón de borrar 5,3:1.
- Subagente `revisor-supabase` sobre la migración y la función. Sin fallos de seguridad (el `id` sale siempre del token). Se aplicaron sus propuestas de traspasar equipos, avisar por Realtime, índices, `revoke` y paginar Storage.

**Pendiente:**
- La confirmación es contra accidentes, no autenticación: con una sesión robada se puede borrar la cuenta. Se podría exigir haber iniciado sesión hace pocos minutos.
- Las notificaciones que envió desaparecen de las bandejas de los demás sin aviso por Realtime (se ven bien al recargar).
- Publicar: `db push --linked` de la migración, `functions deploy delete-account --no-verify-jwt` y pegar la plantilla de cambio de email en el panel de Supabase.
- En local, la plantilla nueva se aplica al reiniciar Supabase (no lo he reiniciado porque el entorno es compartido).
- La migración se aplicó en local con `psql` y se registró a mano en `schema_migrations`: `migration up` se negaba porque `20261103000001` (filtro de palabrotas, otra rama) aún no está en esta carpeta.

---

## 2026-11-03 · Filtro de palabras malsonantes y errores de perfil en español

**Commit:** `616e1e1`

**Qué y por qué:** punto 12 del backlog y el pendiente "traducir los errores de base de datos al editar el perfil", que tocan el mismo formulario. Decisión de la usuaria: censurar con asteriscos en general y bloquear el guardado en la biografía y en los comentarios de valoraciones.

**Cambios:**
- `supabase/migrations/20261103000001_profanity_filter.sql` (nueva):
  - `has_profanity` y `censor_profanity`: lista de palabras en español e inglés. Detecta mayúsculas, tildes, letras repetidas ("puuuta") y sustituciones típicas (0→o, 1→i, 3→e, 4/@→a, 5/$→s, 7→t) en palabras con al menos una letra, así que "455" no cuenta. Solo palabras completas: "computadora" o "disputa" no se tocan.
  - El texto se parte en palabras en una sola pasada (`profanity_tokens`): censurar un mensaje de 2000 caracteres lleno de palabrotas tarda unos 9 ms.
  - La regla se aplica con triggers en las tablas que escriben las RPC, así cubre también las RPC futuras sin copiar sus cuerpos. Los triggers solo miran un texto si cambia: lo guardado antes de la migración no se modifica ni impide guardar el resto de la fila.
  - Bloqueo (error `23514`, detalle `profanity:<campo>`): `profiles.bio`, `reputations.comment` y los nombres visibles que no admiten asteriscos (nombre y tag de equipo, nombre de chat de grupo; con asteriscos chocarían con el `unique` del nombre).
  - Censura con asteriscos: detalles LFT y coach, horario, título y descripción de grupos LFG, descripción y reclutamiento de equipos, solicitudes a equipos, mensajes y la vista previa del último mensaje de cada conversación.
  - Las funciones auxiliares no se exponen por la API (`revoke execute`); los dos triggers genéricos son `security definer`.
- `supabase/tests/database/profanity.test.sql` (nuevo): 26 tests (detección, números, ñ, censura, texto largo, bloqueo de bio, comentario y nombre de equipo, censura en LFG, equipos y mensajes, funciones no expuestas). Archivo aparte de `security.test.sql` para no chocar con otras ramas.
- `client/src/app/services/db-errors.ts` (nuevo): `translateDbError` traduce los errores en inglés de Postgres, PostgREST y Storage (restricciones del perfil, enums, booleanos, sesión caducada, sin conexión, imagen demasiado grande o de formato no admitido). Los mensajes de las RPC, que ya están en español, pasan tal cual.
- `supabase.client.ts`: `toApiError` traduce el mensaje y conserva `details`. `auth.service`: la subida de avatar también traduce el error.
- `profile-edit`: el bloqueo de la biografía se muestra junto al campo (borde rojo, `aria-invalid`, mensaje con `role="alert"`) y el foco vuelve a la biografía. El error se borra al escribir. Tras guardar, los detalles LFT y coach se muestran tal como quedaron (censurados).

**Verificación:**
- `npm run db:test`: 52 tests en verde (26 de seguridad y 26 del filtro).
- Subagente `revisor-supabase` sobre la migración. Corregido lo que encontró: censura cuadrática (3 s con un mensaje largo), "455" leído como "ass", nombres de equipo censurados que chocaban con el `unique`, lista de palabras legible por la API, censura de textos antiguos al guardar otra cosa y falsos positivos (`mongolo`, `dick`, `pinche`).
- Navegador en local (puerto 4302): una biografía con "gilipollas" o "m13rd4" no se guarda y sale el mensaje bajo el campo; con una biografía limpia guarda. Los detalles LFT con "pendejos" se guardan como "********". Un grupo "Duo ranked sin pendejos" / "Nada de shit talk" se publica como "Duo ranked sin ********" / "Nada de **** talk".
- Contraste del error: texto `#ff6b76` sobre la sección `#16232f` 5,79:1; borde sobre el campo `#0b131b` 6,78:1.
- `translateDbError` probado con los mensajes reales que devuelve Postgres local (agentes favoritos, enum de rol, booleano, longitud de detalles LFT).

**Pendiente:**
- Publicar: `npx supabase db push --linked` de la migración antes del push.
- El comentario de valoración bloqueado solo se probó en los tests de BD; en el navegador hace falta haber jugado con el jugador para poder valorarlo. El mensaje sale en el aviso que ya había bajo el comentario.
- No se cubren los logros de equipo (`teams.achievements`) ni las redes sociales (`social_links`), que son JSON, ni separaciones con espacios o puntos ("p u t a"), sufijos fuera de la lista ("puta2") u homoglifos.
- En la BD local la migración se aplicó con `psql` y se registró a mano en `schema_migrations`, porque otra rama ya había aplicado `20261103000002` y `migration up` se negaba.

---

## 2026-11-03 · Botón "Copiar Riot ID" para agregar en el juego

**Commit:** `07ffdec`

**Qué y por qué:** punto 5 del backlog. Riot no tiene API de amigos, así que para agregar a alguien en Valorant se copia su Riot ID (`Nombre#TAG`) al portapapeles.

**Cambios:**
- `shared/copy-riot-id` (nuevo): componente `app-copy-riot-id` con dos variantes.
  - `button`: botón secundario con texto; al copiar cambia a "Riot ID copiado" con un check en `$color-positive`.
  - `icon`: botón de icono (30px, 44px con pantalla táctil vía `m.touch`) con aviso flotante "Riot ID copiado".
  - Copia con `navigator.clipboard.writeText` y, si falla (sin permiso o http en la red local), con un textarea oculto y `execCommand('copy')`. Si fallan los dos dice "No se pudo copiar".
  - Región `role="status"` / `aria-live="polite"` siempre presente que anuncia el resultado; sin `alert()`. El foco vuelve al botón.
- Perfil (`pages/profile`): "Copiar Riot ID" en una fila nueva `c-profile__actions` junto a "Enviar mensaje" o "Editar perfil". Es el sitio principal: donde se decide agregar a alguien.
- Tarjeta de jugador (`shared/player-card`): icono de copiar al lado del de mensaje, en el pie. No añade texto, así que no satura la tarjeta; el clic no abre el perfil. El botón de mensaje gana `aria-label`.
- Detalle LFG (`pages/lfg-detail`): icono de copiar en cada miembro aceptado salvo uno mismo, porque es justo donde hay que agregar al resto del grupo. En las solicitudes pendientes no se pone.

**Verificación:**
- `npm --prefix client run build` sin errores (sigue el aviso de presupuesto inicial, que ya existía; el componente solo va en chunks lazy).
- Navegador en local (puerto 4301), con y sin sesión: el portapapeles del sistema recibe `TestUser1#EUW`, `Player10#EUW` y `Borrame#TEST`; el estado anuncia "Riot ID copiado". Con `writeText` forzado a fallar, el respaldo copia igual con un clic real; con los dos fallando sale "No se pudo copiar".
- 375px: botones de 44×44, fila de acciones del perfil en una línea, sin scroll horizontal en perfil, `/players` ni detalle LFG.
- Contraste medido: icono en reposo 5,30:1 (tarjeta) y 4,80:1 (fila de miembro); copiado 8,79:1 y 7,97:1; aviso "copiado" 7,97:1 y "no se pudo copiar" 5,25:1; texto del botón 13,07:1.

**Pendiente:** el borde del botón secundario global (`.c-btn--secondary`) da 2,82:1 sobre la tarjeta; no es de esta tarea y el texto ya identifica el botón, pero conviene subirlo a 3:1.

---

## 2026-11-03 · Primera auditoría de seguridad, SEO y cumplimiento

**Commit:** `c806047`

**Qué y por qué:** primera pasada de los agentes `auditor-seguridad`, `auditor-seo` y `auditor-legal` para saber qué falta antes de presentar PremadeGG a Riot.

**Cambios:**
- `AUDITORIA-2026-11-03.md`: informe que junta los tres análisis, con prioridades (P0 bloquea a Riot, P1 seguridad y SEO, P2 datos), los textos legales que faltan, los datos que debe aportar el titular y un orden de trabajo.
- `INDICE.md`: enlace a la auditoría, agentes y skills nuevos, y el proyecto descrito como personal (ya no TFG).

**Verificación:** los agentes leyeron el código, las migraciones y las Edge Functions; comprobaron las cabeceras reales de producción con `curl -I`, pasaron `npm audit` en la raíz y en `client/`, y leyeron con WebFetch las políticas vigentes de Riot. No se tocó código de la aplicación.

**Pendiente:**
- Nada del informe está arreglado todavía.
- No se revisaron los paneles de Supabase cloud ni de Vercel.
- Faltan los datos del titular para los textos legales.
- Conviene pasar los puntos al `BACKLOG.md`.

---

## 2026-11-03 · Agentes y skills para Riot, SEO, seguridad y cumplimiento legal

**Commit:** `c806047`

**Qué y por qué:** PremadeGG deja de ser un TFG y pasa a ser un proyecto personal que se quiere presentar a Riot Games. Hacen falta agentes que preparen ese material y auditen el SEO, la seguridad y el cumplimiento legal de la web.

**Cambios:**
- `.claude/agents/redactor-riot.md`: redacta en inglés el material para Riot (registro del producto, clave de producción, pitch) y lo guarda en `presentacion-riot/`. Solo afirma lo que puede comprobar en el código.
- `.claude/agents/auditor-seo.md` (solo lectura): SEO de la SPA de Angular (prerender, título y meta por ruta, `noindex` en rutas privadas, 404 blandos, sitemap, JSON-LD, rendimiento). Carga las skills `seo-audit` y `schema`.
- `.claude/agents/auditor-seguridad.md` (solo lectura): secretos, cabeceras de `vercel.json`, Edge Functions, auth, XSS, Storage, abuso del karma y `npm audit`. Carga las skills `security-and-hardening` y `security-best-practices`.
- `.claude/agents/auditor-legal.md` (solo lectura): RGPD, LOPDGDD, LSSI-CE, cookies, DSA y políticas de Riot. Devuelve tablas de cumplimiento y borradores de textos legales.
- `.claude/skills/cumplimiento-legal/SKILL.md`: checklist legal española y europea adaptada a PremadeGG.
- `.claude/skills/politicas-riot/SKILL.md`: checklist de políticas de Riot (claves, RSO, datos de jugadores, riesgo de acoso con el karma, aviso "Legal Jibber Jabber") y guion para el registro del producto.
- `CLAUDE.md`: el proyecto ya no es un TFG. Nueva sección "Agentes y skills" que dice qué agente usar según lo que toque la tarea.

**Verificación:** frontmatter revisado (nombres, `tools`, `skills` y descripciones sin secuencias que rompan el YAML). Las dos skills nuevas aparecen como disponibles en la sesión. Los agentes no se han lanzado todavía.

**Pendiente:**
- Lanzar los auditores por primera vez y priorizar sus hallazgos.
- El pie de `client/src/app/app.html` aún dice "Proyecto Final de Grado".
- La web no tiene todavía política de privacidad, aviso legal ni términos de uso.
- Las skills legal y de Riot resumen normas que cambian: los agentes deben contrastarlas con la fuente oficial, y los textos legales finales debería revisarlos un abogado.

---

## 2026-11-03 · README del frontend al día con Supabase

**Commit:** `65a948d`

**Qué y por qué:** `client/README.md` seguía describiendo la API Express de `/server`, Socket.IO y el proxy al puerto 4000, que ya no existen desde la migración a Supabase.

**Cambios:**
- `client/README.md`: introducción y sección "Relación con el Backend" reescritas para Supabase (entornos local y cloud, RPC de lectura y escritura, Realtime, `supabase.client.ts`, enlace a `DEPLOY.md`).
- Tabla de componentes compartidos con `oauth-buttons`, `user-picker`, `dialog` y `pipes`. Tabla de páginas con `onboarding`, `/messages/:id` y la ruta real de edición de perfil (`/settings/profile`).
- Lista de mixins sin `gradient-text` (prohibido en `CLAUDE.md`) y con `touch` y `touch-hit`. Instalación local: requiere el Supabase local en vez del backend en el 4000.

**Verificación:** rutas cotejadas con `app.routes.ts`, mixins con `_mixins.scss`, servicios y componentes con sus carpetas, y el uso de `rpc()` con `api.service.ts`.

**Pendiente:** en paralelo hay tres sesiones en sus propios worktrees con los puntos 5 (Copiar Riot ID), 12 (palabras malsonantes y errores de BD traducidos) y 6 (ajustes de cuenta) de `BACKLOG.md`. Cada una commitea en su rama; falta revisarlas y fusionarlas en `migrate-supabase`.

---

## 2026-11-03 · Vault de Obsidian, backlog y agentes de Claude Code

**Commit:** `ba9206c`

**Qué y por qué:** petición de la usuaria: retomar lo que quedaba sin confirmar, vincular la documentación con Obsidian y preparar el trabajo con varios agentes.

**Cambios:**
- `INDICE.md` (nuevo): nota de entrada del vault. Estado actual, documentos vivos e históricos, críticas de impeccable, migraciones, Edge Functions y agentes, con wikilinks `[[…]]`.
- `BACKLOG.md` (nuevo): mejoras hechas y pendientes en el orden acordado, pendientes técnicos y flujo de publicación. Hasta ahora solo estaba en la memoria de Claude, fuera del repositorio.
- `.obsidian/app.json` (nuevo): la raíz del repositorio es el vault. Oculta `node_modules`, `.angular`, `dist`, `public` y las carpetas temporales de Supabase, y usa wikilinks.
- `.gitignore`: ignora `.claude/settings.local.json` y el estado personal de Obsidian (`workspace*.json`, caché, `data.json` de plugins, `.trash/`).
- `.claude/agents/` (nuevo): tres subagentes de proyecto: `revisor-supabase` (revisa SQL y RLS, solo lectura), `verificador-ui` (comprueba en el navegador) y `documentador` (mantiene este registro, el backlog y el índice).
- `TRASPASO.md`: aviso al principio de que está obsoleto. La migración se commiteó en `c3aa6ba`, el índice de git está vacío y no hay archivos mixtos.
- La regla del modo caveman (entrada del 2026-10-25 más abajo) queda comprobada: esta sesión la aplicó desde el primer mensaje.

**Verificación:** los wikilinks de `INDICE.md`, `BACKLOG.md` y `TRASPASO.md` apuntan a archivos existentes (comprobado con un script). El inventario de documentos y la comparación de `TRASPASO.md` con `git log` los hizo un subagente de exploración. Las opciones de Obsidian se investigaron con otro subagente. No se ha abierto en Obsidian porque no está instalado en este equipo.

**Pendiente:**
- Instalar Obsidian y abrir `D:\premade-gg` como vault. Si va lento por `node_modules` (Obsidian lo lee aunque lo oculte), mover las notas a una subcarpeta `docs/`.
- En este commit se versionan también `.claude/launch.json`, las críticas de `.impeccable/critique/`, `REDISENO-VALORANT.md` y `TRASPASO.md`, que estaban sin versionar. `.claude/skills/` (288 archivos de skills importadas de otro proyecto) sigue fuera: falta decidir si se versiona.
- `MIGRACION-SUPABASE.md` y `client/README.md` siguen diciendo cosas que ya no son ciertas (sin commitear, backend Express).

---

## 2026-10-25 · Emblema de rango más grande

**Commit:** `6cf8b3c`

**Qué y por qué:** petición de la usuaria: el emblema de rango se veía pequeño.

**Cambios:** `_badges.scss`, `.c-rank-icon`: `md` (tarjetas y filas) de 26 a 32px, `lg` (perfil) de 40 a 52px y `sm` de 22 a 26px (sin uso ahora).

**Verificación:** navegador en local.
- `/players`: emblema de 32px y la fila rango + karma mide lo mismo que el emblema (32px).
- Perfil: emblema de 52px alineado con el karma.
- `/lfg` a 375px: la fila "Creador" (emblema, karma, región) sigue en una línea, sin scroll horizontal.

---

## 2026-10-25 · Editar grupo: cambiar Dúo, Trío o 5-Stack

**Commit:** `bce677c`

**Qué y por qué:** la usuaria vio que al editar un grupo no se podía cambiar el tamaño. Se había dejado fuera porque afecta a los miembros; ahora se permite con una regla que lo hace seguro.

**Cambios:**
- `supabase/migrations/20261025000008_lfg_edit_size.sql` (nueva): `update_lfg_post` acepta `teamSize`.
  - Solo 2, 3 o 5.
  - No puede quedar por debajo de los miembros aceptados: "El grupo ya tiene N miembros: saca a alguien antes de reducirlo a M".
  - El estado se recalcula con el tamaño final: cerrado se queda cerrado; si no, lleno o abierto según las plazas.
- `tests/database/security.test.sql`: 2 tests nuevos (cambio de tamaño y tamaño inválido). En total, 26.
- `api.service`: `updateLfgPost` admite `teamSize`.
- `lfg-detail`:
  - El modal de edición empieza con el segmentado Dúo / Trío / 5-Stack.
  - Los tamaños donde no caben los miembros actuales salen desactivados, con el aviso "Ya sois N: para un grupo más pequeño, saca antes a alguien".
  - Fuera el subtítulo que decía que el tamaño no se podía cambiar.
- `_page.scss`: estilo desactivado para `.c-segmented__btn:disabled` (no existía).

**Verificación:**
- `npm run db:test`: 26/26.
- Navegador en local con `test1@premade.gg`, en su grupo 5-Stack con 3 miembros (2 añadidos para la prueba):
  - Dúo sale desactivado con el aviso.
  - Pasar a Trío deja "Trío · Lleno" y 3/3; volver a 5-Stack lo reabre con 3/5.
- La RPC rechaza reducir a Dúo con 3 miembros (probado con rollback).

**Pendiente:**
- Aplicar la migración en Supabase cloud antes de publicar.
- En la base local, el grupo de test1 se queda con 3 miembros de prueba.

---

## 2026-10-25 · Perfil sin nivel de cuenta

**Commit:** `6240606`

**Qué y por qué:** petición de la usuaria: quitar el nivel de cuenta de Valorant del perfil.

**Cambios:** `profile.component.html`: fuera el badge "Nivel N" del pie del perfil; queda "Miembro desde …". La tarjeta de jugador (`player-card`) sigue mostrando "Nv. N".

**Verificación:** navegador en local, perfil de Player10: el pie muestra solo "Miembro desde octubre 2026" y la palabra "nivel" ya no aparece en la página.

---

## 2026-10-25 · Varios roles por jugador

**Commit:** `6240606`

**Qué y por qué:** petición de la usuaria: poder poner más de un rol. Cada jugador tenía un solo `role` y, aparte, un "rol favorito".

**Cambios:**
- `supabase/migrations/20261025000007_multi_roles.sql` (nueva):
  - `profiles.roles` (`valorant_role[]`, máximo 5) con índice GIN.
  - Datos existentes: `{role}` y, si había un rol favorito distinto, se añade.
  - Trigger `sync_profile_roles`: si cambia `roles`, `role` pasa a ser el primero. Si se escribe solo `role` (onboarding con la Edge Function `riot-link`, que no cambia), ese rol encabeza `roles`.
  - `user_json` expone `roles`.
  - El filtro de rol de `get_users` busca dentro de `roles` (`roles @> array[rol]`).
  - `update_my_profile` acepta `roles`: sin repetir, en el orden del enum y al menos uno ("Elige al menos un rol").
- `tests/database/security.test.sql`: 3 tests nuevos (orden y duplicados, `role` = primero, lista vacía rechazada). En total, 24.
- `user.model.ts`: `roles?` y helper `rolesOf()`, que si el perfil no trae `roles` cae al rol principal.
- Editar perfil: el selector "Rol favorito" pasa a chips multiselección "Roles que juegas". Al quitar el último aparece "Necesitas al menos un rol".
- Perfil: todos los roles como etiquetas junto a la región; fuera la sección "Rol favorito".
- `player-card`: "Duelista / Iniciador / Centinela". Con más de un rol van en su línea y región · nivel bajan sin un "·" suelto delante.
- `user-picker`: muestra todos los roles.
- Registro y onboarding siguen pidiendo un rol principal; los demás se añaden en el perfil.

**Verificación:**
- `npm run db:test`: 24/24.
- Trigger probado con rollback: cambiar `roles` a Controlador + Centinela deja `role` = Controller; escribir `role` = Duelist deja `{Duelist,Controller,Sentinel}`.
- Navegador en local con `test3@premade.gg`:
  - Quitar el único rol muestra el aviso.
  - Marcar Duelista + Centinela y guardar deja `role` = Duelist y `roles` = `{Duelist,Initiator,Sentinel}` en la base.
  - El perfil muestra las tres etiquetas.
  - `/players?role=Sentinel` encuentra a TestUser3 aunque su rol principal sea Duelista.
  - A 375px la tarjeta queda en dos líneas sin scroll horizontal.

**Pendiente:**
- Aplicar la migración en Supabase cloud antes de publicar.
- `favorite_role` sigue en la base pero ya no se edita ni se muestra.

---

## 2026-10-25 · Editar, cerrar y eliminar grupos LFG

**Commit:** `792ec26`

**Qué y por qué:** petición de la usuaria: no se podían editar ni borrar los grupos publicados. La crítica final también señaló que el creador no podía cerrar su grupo, aunque existe el filtro "Cerrados". Las RPC existían, pero no había forma de usarlas desde la app.

**Cambios:**
- `supabase/migrations/20261025000006_lfg_edit.sql` (nueva):
  - `update_lfg_post` solo acepta `open` o `closed` como estado (antes cualquiera). Al reabrir un grupo completo queda `full`. Ya no se edita un grupo caducado.
  - Mensajes en español ("Grupo no encontrado", "Solo el creador puede editar este grupo").
  - `delete_lfg_post` igual.
- `tests/database/security.test.sql`: 3 tests nuevos (estado arbitrario rechazado, el creador cierra, otro usuario no puede editar). En total, 21.
- `api.service`: `updateLfgPost()` y `deleteLfgPost()`, que invalidan la caché del tablero.
- `lfg-detail`:
  - Para el creador, botones Editar · Cerrar grupo / Reabrir grupo · Eliminar en el bloque de requisitos, con el resultado en `role="status"`.
  - Modal de edición (título, descripción, rango mínimo y karma mínimo; el tamaño no, porque afecta a los miembros) con `appDialog`.
  - Confirmación de borrado (`role="alertdialog"`) que sugiere cerrar en vez de borrar; tras borrar vuelve a `/lfg`.
- `_modal.scss`: `c-modal--small` y `c-modal__text` pasan a ser globales (antes solo existían dentro de `team-detail`).

**Verificación:**
- `npm run db:test`: 21/21.
- Navegador en local con `test3@premade.gg` (creador de "Buscando duo de prueba"):
  - Editar título y karma (3 → 4) actualiza el `h1`, el título de la pestaña y los requisitos, y muestra "Grupo actualizado".
  - Cerrar muestra el badge "Cerrado" y el botón "Reabrir grupo"; reabrir lo devuelve a abierto.
  - Eliminar abre el diálogo con el foco dentro; al confirmar vuelve a `/lfg` y en la base no quedan ni el grupo ni sus miembros.

**Pendiente:**
- Aplicar la migración en Supabase cloud antes de publicar.
- No probado a 375px con sesión de creador.
- En la base local ya no está el grupo "Buscando duo de prueba" del seed.

---

## 2026-10-25 · Respuestas de Claude en modo caveman por defecto

**Commit:** el mismo que la entrada "Vault de Obsidian, backlog y agentes de Claude Code" (2026-11-03)

**Qué y por qué:** reducir los tokens de salida de Claude en el proyecto. Se creó la skill de usuario `caveman`, que comprime las respuestas, y se activó por defecto.

**Cambios:**
- `CLAUDE.md`: nueva sección "Estilo de respuesta". Ordena responder en modo caveman (nivel full) desde el inicio de cada sesión y se desactiva con "modo normal". Commits, PRs, `CAMBIOS.md`, documentación y UI siguen en español normal.
- Skill `caveman` creada a mano en `~/.claude/skills/caveman/SKILL.md` (fuera del repositorio), sin descargar la versión de terceros.

**Verificación:** ninguna todavía. La regla se aplica a partir de la próxima sesión.

---

## 2026-10-25 · Perfil: disponibilidad alineada con muchas franjas

**Commit:** `cc4ebac`

**Qué y por qué:** la usuaria vio que, con muchas franjas, el cuadro de disponibilidad se descuadraba: el texto ("Mañana, Tarde, Noche, Madrugada") partía en dos líneas junto al día y las tarjetas quedaban desiguales.

**Cambios:**
- `profile.component.scss`: `.c-profile__day` pasa a columna (día arriba, franjas debajo).
- `profile.component.ts`: con las 4 franjas, `slotsLabel()` devuelve "Todo el día".

**Verificación:** navegador en local, con test2 con 2, 3 y 4 franjas según el día. Las 7 tarjetas miden 62px; Viernes y Sábado muestran "Todo el día" y Domingo "Mañana, Noche, Madrugada" sin partir.

---

## 2026-10-25 · Perfil: rango junto al karma y favoritos en orden alfabético

**Commit:** `cc4ebac`

**Qué y por qué:** petición de la usuaria: el emblema de rango tenía que ir al lado del karma, no entre las etiquetas de rol y región. Además, los agentes tenían que verse en orden alfabético; los favoritos salían en el orden en que se eligieron.

**Cambios:**
- `profile`:
  - Nuevo bloque `.c-profile__standing` con el emblema (`lg`) a la izquierda del karma (`lg`), con el fondo y las esquinas que antes tenía `.c-profile__karma`. El emblema sale de `.c-profile__badges`.
  - Los agentes favoritos se muestran por orden alfabético (`favoriteAgentsSorted`).
- `profile-edit`: al marcar un favorito se ordena la lista, así que se guarda ya ordenada. Los selectores de avatar y de favoritos ya eran alfabéticos (catálogo de la entrada anterior); en producción todavía está la lista antigua.

**Verificación:** navegador en local con `test2@premade.gg`.
- Emblema y karma en la misma fila, a 24px.
- La fila de etiquetas ya no tiene el rango.
- Favoritos guardados como Omen, Brimstone, Miks se muestran como Brimstone, Miks, Omen.
- A 375px el bloque queda centrado bajo el nombre y no hay scroll horizontal.

---

## 2026-10-25 · Agentes desde valorant-api: avatares y favoritos con filtros

**Commit:** `1c52b96`

**Qué y por qué:** petición de la usuaria: faltaban personajes para la foto de perfil y para elegir como favoritos, y el selector de imágenes no tenía filtros. Las dos listas estaban escritas a mano con 28 agentes y faltaba Miks.

**Cambios:**
- `AgentIconsService`: pasa de "nombre → icono" a catálogo completo `AgentInfo` (nombre, rol, icono) desde valorant-api.com.
  - Orden alfabético y caché en `localStorage` (`premadegg:agents:v2`).
  - Lista de respaldo con los 29 agentes de hoy por si la API no responde.
  - `iconFor()` sigue igual para el perfil.
- Editar perfil:
  - Avatares y favoritos salen del catálogo, así que un agente nuevo aparece solo.
  - Selector de avatar con chips de rol (Todos, Duelista, Controlador, Iniciador, Centinela), búsqueda por nombre y estado vacío "Ningún agente coincide con «…»". El avatar elegido lleva `aria-pressed`.
  - Favoritos con icono, el mismo filtro por rol y `aria-pressed`.
- Fuera la lista fija `PRESET_AVATARS` (`profile-edit`) y la constante sin uso `VALORANT_AGENTS` (`user.model.ts`). Los avatares ya guardados siguen valiendo: es la misma URL de valorant-api.
- `supabase/migrations/20261025000005_favorite_agents_open.sql` (nueva):
  - El `CHECK` de `profiles.favorite_agents` enumeraba los 28 agentes y rechazaba Miks al guardar; lo destapó la prueba en el navegador.
  - Ahora exige como mucho 3 nombres y un formato razonable por nombre (función `valid_agent_names`).

**Verificación:**
- Navegador en local con `test2@premade.gg`:
  - 29 agentes en avatares y en favoritos, Miks incluido.
  - "Controlador" deja 7 (Astra, Brimstone, Clove, Harbor, Miks, Omen, Viper); la búsqueda "je" deja Jett.
  - Avatar de Miks + Miks como favorito → "Guardado con éxito" y en la base `profile_image_type = avatar` y `{Omen,Brimstone,Miks}`.
  - El perfil público muestra el avatar de Miks.
- Las 58 imágenes cargan. A 375px, chips de 44px y sin scroll horizontal.
- Restricción probada en transacciones con rollback: `{Miks,KAY/O,Omen}` pasa; 4 agentes o `<script>` se rechazan. `npm run db:test`: 18/18.

**Pendiente:**
- Aplicar la migración en Supabase cloud antes de publicar: sin ella, guardar Miks como favorito falla en producción.
- El error de la base se muestra tal cual al usuario ("violates check constraint…"); habría que traducir los errores de `update_my_profile`.

---

## 2026-10-25 · Rango solo con emblema, sin nombre

**Commit:** `51a8828`

**Qué y por qué:** petición de la usuaria: quitar el texto que acompañaba al emblema en las cabeceras (perfil, detalle de equipo, creador en el detalle LFG) y dejar solo el icono en toda la app. Corrige parte de la entrada `4422c1d`.

**Cambios:**
- `app-rank-badge`: fuera la entrada `showLabel` y su `<span>`.
  - El nombre sigue en `aria-label` ("Rango Bronce") para lectores de pantalla y en `title` como tooltip.
  - Si el emblema no carga, se mantiene la pastilla de texto de respaldo.
- `_badges.scss`: fuera `.c-rank-icon__label`, sus colores por tier y el `gap`.
- `profile`, `team-detail` y `lfg-detail`: sin `[showLabel]`. El perfil mantiene el emblema grande (`size="lg"`, 40px).

**Verificación:** navegador en local.
- Perfil: emblema de 40px sin texto y `aria-label` "Rango Bronce".
- Detalle LFG: los dos rangos "Rango Diamante" sin texto visible.
- Sin errores nuevos en consola (los 503 son `riot-refresh` sin levantar en local).

---

## 2026-10-25 · Disponibilidad por franjas, sin horas

**Commit:** `d189e22`

**Qué y por qué:** petición de la usuaria: quitar las horas de la disponibilidad. Cada día pedía una hora de inicio y otra de fin; ahora basta con marcar en qué franjas sueles jugar.

**Cambios:**
- `supabase/migrations/20261025000004_availability_slots.sql` (nueva):
  - `profiles.availability` pasa de `{"monday": {"from", "to", "available"}}` a `{"monday": ["afternoon", "evening"]}`.
  - Convierte los perfiles existentes según las franjas que tocaba su horario: madrugada 00–08, mañana 08–14, tarde 14–20, noche 20–24. Un horario que cruza la medianoche cuenta también al día siguiente.
  - Los días marcados como no disponibles desaparecen.
- `user.model.ts`: `DAY_SLOTS`, `DAY_SLOT_LABELS` (Mañana, Tarde, Noche, Madrugada), tipo `Availability` y `normalizeAvailability()`, que descarta el formato antiguo si aún llegara alguno.
- Editar perfil (`/settings/profile`):
  - Cada día es un grupo con 4 chips conmutables (`aria-pressed`), en lugar de casilla + dos campos de hora. Un día sin franjas no aparece en el perfil.
  - Fuera los estilos de casilla y hora.
- Perfil: "Lunes · Tarde, Noche" en vez de "18:00 - 23:00".

**Verificación:**
- Migración aplicada en local con datos antiguos de prueba:
  - 18:00–23:00 → tarde y noche.
  - 22:00–02:00 → noche y madrugada.
  - 09:00–21:00 → mañana, tarde y noche.
  - El día no disponible desaparece.
- `npm run db:test`: 18/18.
- Navegador con `test2@premade.gg`: marcar Viernes → Noche + Madrugada y guardar deja `{"friday": ["evening", "night"]}` en la base.
- El perfil de Player10 muestra "Lunes · Tarde, Noche" y "Viernes · Noche, Madrugada".
- A 375px, chips de 44px sin scroll horizontal. Consola limpia.

**Pendiente:**
- Aplicar la migración en Supabase cloud (`npx supabase db push --linked`) antes de publicar el frontend.
- `scripts/migrate-mongo-to-supabase.mjs` sigue copiando el formato antiguo (no hay usuarios que migrar).
- En la base local, Player10, Player19 y test2 se quedan con disponibilidad de prueba.

---

## 2026-10-25 · Rango con emblema en vez de texto

**Commit:** `4422c1d`

**Qué y por qué:** petición de la usuaria: mostrar el rango con su icono del juego, no escrito. Es lo que reconoce de un vistazo cualquier jugador de Valorant.

**Cambios:**
- `app-rank-badge`:
  - Muestra el emblema de valorant-api.com, la misma fuente que los iconos de agentes. La URL es fija por episodio y nº de tier (`media.valorant-api.com/competitivetiers/<episodio>/<tier>/smallicon.png`), así que no hay petición a la API.
  - Accesibilidad: `role="img"` con `aria-label` "Rango Oro" y `title` con el nombre como tooltip.
  - Nuevas entradas `size` (`sm` 22px, `md` 26px, `lg` 40px) y `showLabel` (emblema + nombre).
  - Si la imagen no carga, vuelve la pastilla de texto de antes (`.c-rank`).
  - La base de datos guarda solo el tier: sin división se usa el emblema de la división 1. Si el valor trae división ("Gold 2"), se respeta.
- `_badges.scss`: nuevo `.c-rank-icon`. El nombre usa `$rank-colors`.
- Con nombre visible: cabecera del perfil (`lg`), rango objetivo en el detalle de equipo y creador en el detalle LFG. En tarjetas, filas y miembros va solo el emblema.

**Verificación:**
- `/players`: 12 emblemas cargados (Bronce → tier 6, Plata → 9, Radiante → 27) y 0 respaldos.
- Perfil: emblema de 40px + "BRONCE".
- Detalle LFG a 375px: emblema + "DIAMANTE" en el creador y solo emblema en miembros, sin scroll horizontal.
- Contraste de los nombres sobre `bg-card`: de 5,17:1 (Hierro) a 13,28:1 (Radiante); sobre `bg-elevated`, mínimo 4,68:1.
- Consola limpia.

**Pendiente:**
- El icono de división 1 cuando no hay división puede inducir a error. Guardar la división exige cambiar el enum `valorant_rank` y la Edge Function de Riot.
- Los selectores de rango (filtros, crear grupo) siguen en texto.

---

## 2026-10-25 · Ignorar la carpeta .vercel

**Commit:** `d05c54e`

**Qué y por qué:** el CLI de Vercel crea `.vercel/` al enlazar el proyecto (ID del proyecto y de la organización). Es configuración local y no debe entrar en el repositorio.

**Cambios:**
- `.gitignore`: añade `.vercel`.

**Verificación:** `git check-ignore .vercel` lo marca como ignorado.

---

## 2026-10-25 · Fusión de main en migrate-supabase (capturas del README)

**Commit:** `efc20a8`

**Qué y por qué:** `main` tenía un commit que no estaba en la rama (`a577b89`, capturas en el README). Hay que integrarlo para que `main` pueda avanzar hasta la rama sin perder nada.

**Cambios:**
- `README.md`: conflicto resuelto.
  - Se mantiene el stack nuevo (Angular + Supabase) y se añade la sección de capturas de `main`.
  - Una nota avisa de que las capturas son de la versión 1.0 (MEAN) y que el diseño ha cambiado.
- `screenshots/` (10 imágenes) entra desde `main`.

**Verificación:** sin marcadores de conflicto; la sección "Stack Tecnológico" aparece una sola vez, con el de Supabase.

**Pendiente:** rehacer las capturas con el diseño actual.

---

## 2026-10-25 · Producción apuntando a Supabase cloud

**Commit:** `66ad5ed`

**Qué y por qué:** el proyecto de Supabase cloud (`taprgsiozhwralnzqxri`, West EU) ya tiene el esquema; el frontend de producción tiene que apuntar a él para poder desplegar en Vercel.

**Cambios:**
- `client/src/environments/environment.prod.ts`: Project URL y publishable key del proyecto. La clave es pública por diseño; la seguridad la dan las políticas RLS y las RPC `security definer`.
- Fuera del repositorio, en el proyecto cloud:
  - `supabase db push` con las 9 migraciones, sin seed.
  - Despliegue de `riot-validate`, `riot-link` y `riot-refresh` con `--no-verify-jwt`.

**Verificación:**
- `migration list` muestra las 9 migraciones aplicadas.
- Con la publishable key, `get_users` y `get_lfg_posts` responden (base vacía).
- Un `PATCH` directo sobre `profiles` devuelve 401.

**Pendiente:**
- Secrets `RIOT_API_KEY` y `HENRIK_API_KEY`: sin ellos no funciona vincular el Riot ID.
- En el panel: URLs de Auth, SMTP de Brevo, plantillas de email y proveedores Google/Discord.
- Migración de datos desde MongoDB.

---

## 2026-10-25 · DEPLOY.md: dominio real y despliegue por preview

**Commit:** `b5e07e3`

**Qué y por qué:** `DEPLOY.md` apuntaba a `premadegg.vercel.app`, que da `404 DEPLOYMENT_NOT_FOUND`; la producción está en `premade-gg.vercel.app`. Además mandaba importar un proyecto de Vercel que ya existe, y no tenía en cuenta que las previews necesitan estar en Redirect URLs.

**Cambios:**
- Site URL y Redirect URLs con `premade-gg.vercel.app` y el comodín de previews `premade-*-mattis-projects-43eade79.vercel.app/**`. Nota de por qué: el cliente redirige a `window.location.origin`.
- Paso 5b: revisar el proyecto existente (Root Directory `client`, Node 20+), probar en el preview de la rama y fusionar en `main` para producción.

**Verificación:** dominios comprobados en el navegador (`premade-gg.vercel.app` responde con la versión de febrero; `premadegg.vercel.app`, 404) y despliegues leídos de la API de GitHub.

---

## 2026-10-25 · Migración a Supabase (commit)

**Commit:** `c3aa6ba`

**Qué y por qué:** dejar en git la migración de MEAN (Express + MongoDB en Render) a Angular + Supabase, que llevaba sin commitear desde el 2026-10-24. Sobre esa base se han ido commiteando por separado los cambios de diseño, y sin ella no se puede desplegar. El detalle de la migración está en `MIGRACION-SUPABASE.md`.

**Cambios:**
- Fuera `server/`, `docker-compose.yml`, los Dockerfile, `nginx.conf`, `proxy.conf.json`, `socket.service`, `auth.interceptor` y `environment.docker`.
- `supabase/`:
  - `config.toml` con puertos 443xx.
  - 9 migraciones: esquema, RLS, RPC de lectura y escritura, triggers y cron, storage, `review_count`, filtros LFG y `trust_karma`.
  - `seed.sql`, tests pgTAP, plantillas de email y las Edge Functions `riot-validate`, `riot-link` y `riot-refresh`.
- Cliente:
  - `supabase.client`, `realtime.service` y `auth.service` con Supabase Auth (email, Google y Discord).
  - Página `onboarding`, componente `oauth-buttons` y `api.service` sobre RPC.
  - `environment.prod.ts` con marcadores para la URL y la clave publicable.
- `scripts/migrate-mongo-to-supabase.mjs`, `package.json` raíz con `db:*`, workflow `supabase-keepalive` y `.env.example` por ámbito.
- `DEPLOY.md`, `README.md`, `.gitignore` y `MIGRACION-SUPABASE.md`.
- En `_navbar.scss` y `_typography.scss`, los bloques de la migración: cajón móvil con `transform` y `font-synthesis: none`.

**Verificación:**
- `ng build --configuration=production` sin errores. Aviso: el bundle inicial pesa 549,6 kB, 49,6 kB por encima del presupuesto de 500 kB.
- `npm run db:test`: 18/18.
- Búsqueda de secretos en los archivos del commit: solo marcadores y la clave publicable de demostración del CLI local.

**Pendiente:**
- Configurar Supabase cloud y Vercel antes de subir la rama (ver `DEPLOY.md`).
- Probar `riot-link` con una `RIOT_API_KEY` vigente.
- No entran en este commit: `CLAUDE.md` y la entrada "caveman" (otra tarea), `TRASPASO.md`, `REDISENO-VALORANT.md`, `.claude/` y `.impeccable/`.

---

## 2026-10-25 · Flujo de unirse: requisitos a la vista y sin recarga (tercera ronda, paso 2)

**Commit:** `c6f11cc`

**Qué y por qué:** la crítica final encontró varios fallos en el flujo de unirse:
- El botón "Solicitar unirse" quedaba bajo el pliegue (y≈760 a 1366×768).
- No decía si cumplías los requisitos: el error llegaba del servidor después del clic.
- Al enviar, la página volvía al esqueleto y el foco caía al `body`.

**Cambios:**
- `lfg-detail` (HTML, TS y SCSS): nuevo bloque `.c-join` en la cabecera, debajo del creador.
  - Lista los requisitos (rango y karma). Si puedes pedir unirte, marca cada uno con ✓/✕ (con texto para lectores de pantalla) y muestra lo tuyo: "tienes Ascendente", "tienes 3,5 ajustado".
  - Si te falta algo, el botón se desactiva y lo explica, enlazado con `aria-describedby`: "Te falta karma para unirte a este grupo. El karma sube con las valoraciones de tus compañeros."
  - La comprobación usa `trustKarma`; si el perfil en memoria no lo trae, lo calcula igual que la columna generada. El rango se compara por el orden de `VALORANT_RANKS`.
  - Tras enviar, el estado pendiente lo dice todo: "Solicitud enviada. El creador la verá en sus notificaciones y te avisaremos cuando responda." Lleva `role="status"` y recibe el foco.
  - Otros estados: "Estás en este grupo" y "Este grupo ya no acepta solicitudes".
  - Texto para invitados corregido: "Una cuenta nueva cuenta como karma 3,5 hasta recibir valoraciones" (antes decía que todas empiezan con 5).
  - En móvil el botón ocupa todo el ancho.
- `loadPost(id, silent, focusStatus)`: tras unirse, aceptar, rechazar, expulsar o abandonar, la página se refresca sin el esqueleto.
- Los mensajes de resultado salen junto a su acción (`feedbackAt`): los de unirse en el bloque nuevo; los de gestionar miembros al final, con `role="status"`.
- Fuera el bloque "Requisitos" de la info y las acciones del final, que estaban duplicados. También sus estilos sin uso.
- "No se pudo cargar el post LFG" pasa a "No se pudo cargar el grupo".
- **Corrección del paso 4:** la regla que quita el anillo del `h1` enfocado por código estaba en `app.scss`, que está encapsulado y no llegaba a las páginas. Pasa a `scss/global/_reset.scss`.

**Verificación:**
- Navegador, como invitado: el botón de iniciar sesión queda en y=406 (antes ≈760).
- Con `test2@premade.gg` del seed, en la base local:
  - En "Reclutando…" (Platino, karma 4): rango ✓, karma ✕ con 3,5, botón desactivado y motivo enlazado.
  - En "Buscando duo de prueba" (Oro, karma 3): ambos ✓. Al enviar no aparece el esqueleto, la página no se mueve y el foco pasa al mensaje con `role="status"`.
  - A 375px el botón mide 309×44 en y=386, sin scroll horizontal.
- El `h1` enfocado ya no muestra el anillo.
- Build sin errores.

**Pendiente:**
- La prueba dejó en la base local una solicitud pendiente de test2 en "Buscando duo de prueba" (útil para ver el panel del creador con test3).
- Los 503 de consola son de la Edge Function `riot-refresh`, que no está levantada en local; no vienen de este cambio.
- El panel de aceptar o rechazar del creador no se ha probado con sesión de creador.

---

## 2026-10-25 · Karma ajustado con media bayesiana (tercera ronda, paso 1)

**Commit:** `0d6c7e2` (solo frontend; la migración y los tests SQL van con el commit de la migración a Supabase)

**Qué y por qué:** la crítica final (22/40) vio que las cuentas nuevas, con un 5,0 implícito, pasaban cualquier filtro o requisito de karma. En `/players`, "4,5+" devolvía 8 jugadores y 4 no tenían ninguna valoración. Además, en tarjetas y filas no se veía en cuántas valoraciones se basaba el karma. Se eligió la media bayesiana.

**Cambios:**
- Skill `supabase-postgres-best-practices` (Supabase) instalado con `npx skills add` y usado para la migración.
- `supabase/migrations/20261025000003_trust_karma.sql` (nueva):
  - Columna generada `profiles.trust_karma` = `(3·3,5 + karma·n) / (3 + n)`. Una cuenta nueva vale 3,50, un solo 5 da 3,88 y 4,7 con 3 valoraciones da 4,10.
  - Índices: los tres de `karma` pasan a `trust_karma` (orden, rango+rol, LFT).
  - `user_json` expone `trustKarma`.
  - `get_users` ordena, pagina (cursor `<trust>_<id>`) y filtra el karma mínimo sobre `trust_karma`.
  - `get_lfg_posts` filtra el karma del creador sobre `trust_karma`.
  - `create_lfg_post` exige `trust_karma` ≥ 3 y `join_lfg_post` exige `trust_karma` ≥ el mínimo del grupo. Los mensajes dicen "karma ajustado" y cuántas valoraciones hay; "posts LFG" pasa a "grupos".
- `tests/database/security.test.sql`:
  - El fixture de B lleva 5 valoraciones (karma 2 → ajustado 2,56).
  - Mensaje esperado actualizado.
  - Dos tests nuevos: karma ajustado de C y una cuenta nueva = 3,5. En total, 18.
- En pantalla se sigue mostrando la media real:
  - `karma-badge` en tamaño sm añade el recuento: "4,7 (3)".
  - El `title` explica el ajuste.
- Filtros de karma en `/players` y `/lfg`:
  - Las opciones pasan a Cualquiera / 3+ / 3,5+ / 4+. Con tan pocas valoraciones, "4,5+" siempre salía vacío.
  - Debajo, la explicación "Ajustado por nº de valoraciones: una cuenta nueva cuenta como 3,5", enlazada con `aria-describedby`.
- Portada: "Top jugadores" usa el orden del servidor; desaparece la ordenación en el cliente.
- `User.trustKarma` en el modelo.

**Verificación:**
- `npx supabase migration up` sin borrar datos y `npm run db:test`: 18/18.
- Datos locales:
  - "4,5+" pasa de 8 jugadores a 0.
  - "4+" deja 2 (Player10 4,7 (3), ajustado 4,10; Player19 4,5 (4), ajustado 4,07).
  - Las 4 cuentas nuevas ya no pasan un requisito de 4.
- Navegador:
  - `/players?karma=4` muestra esos 2.
  - "Top jugadores": Player10, Player19, Player1 (antes Player4, 5,0 con una valoración, iba primero).
  - `/lfg?karma=3.5` a 375px: 6 grupos, explicación visible y sin scroll horizontal.
- Build sin errores y consola limpia.

**Pendiente:**
- La migración va con el commit de la migración a Supabase, porque depende de sus migraciones base.
- Las constantes (3,5 y 3) están en la columna generada: cambiarlas exige otra migración.

---

## 2026-10-25 · Crítica final de la segunda ronda (22/40)

**Commit:** sin commitear (`.impeccable/` no está en git)

**Qué y por qué:** medir el resultado de los pasos 1 a 6 con el mismo método que la crítica anterior (26/40): dos subagentes aislados, uno para la revisión de diseño y otro para el detector con el navegador.

**Cambios:**
- `.impeccable/critique/2026-10-25T15-38-38Z__client-src-app.md` (nuevo): informe completo. Tendencia: 24 → 26 → 22.
- `TRASPASO.md`: segunda ronda cerrada y siguientes pasos.

**Verificación:**
- Detector CLI: 16 hallazgos, todos falsos positivos (`[src]` de Angular y el indicador de escritura).
- Overlay en 6 páginas, en escritorio y a 375px:
  - Mínimo de 12px en todas, sin scroll horizontal.
  - Un contraste de 4,46:1: `c-rank--immortal` sobre el degradado de `player-card`.
- Comprobados en el código los tres problemas P1 que más pesan en la nota:
  - `canJoin` no mira requisitos.
  - No hay filtro de región en `/lfg` ni en `/players`.
  - 4 de 8 perfiles con karma ≥ 4,5 no tienen valoraciones.

**Pendiente:**
- La nota baja porque este revisor recorrió flujos que la crítica anterior no penalizó (unirse, confirmaciones, región, prevención de errores). No hay regresiones: lo que corrigieron los pasos 1 a 6 consta como resuelto.
- Quedan 3 P1 y 2 P2 por decidir.

---

## 2026-10-25 · Detalles menores (segunda ronda, paso 6)

**Commit:** `721802b` (los cambios de `oauth-buttons` van con el commit de la migración)

**Qué y por qué:** cerrar las observaciones menores de la segunda crítica. Unas incumplían `CLAUDE.md` (brillo decorativo, franja lateral de 2px); otras pesaban más de la cuenta en la jerarquía o eran textos en inglés o en masculino.

**Cambios:**
- **Estilo:**
  - Hero de la portada: fuera el degradado rojo; queda el fondo liso y el bloque diagonal.
  - `team-detail`: el mensaje de las solicitudes pasa de `border-left: 2px` a un borde completo de 1px.
  - `oauth-buttons`: Discord deja de ser un botón relleno de su color de marca. Los dos proveedores son botones secundarios iguales y solo el icono de Discord lleva su color; así el CTA rojo "Iniciar sesión" es lo que más pesa. El foco usa `$color-focus` y el error `$color-danger-text`.
  - Detalle LFG: el badge de tamaño (Dúo/Trío) pasa del morado de equipos a un badge neutro nuevo, `.c-badge--neutral`; el `--team` local desaparece.
- **Textos:**
  - Login: "Bienvenido de vuelta a PremadeGG" pasa a "Entra en tu cuenta de PremadeGG" (sin género).
  - `TEAM_SIZE_LABELS`: "Dúo" y "Trío" con tilde. Afecta a pestañas, chips, títulos sugeridos y badges. En la portada, "Dúo, trío o 5-stack".
  - Perfil: "Posts LFG" pasa a "Grupos LFG".
  - Equipos: "Remover" y "Remover coach" pasan a "Quitar" y "Quitar coach".
  - "Coach" se mantiene: es el término habitual en los esports en español y no tiene género.
  - `alt=""` en los avatares de `player-card` y de las solicitudes de equipo (antes "… avatar" y "Avatar"), porque el nombre está al lado. La inicial que sustituye al avatar lleva `aria-hidden`.
- **Estados vacíos de `/lfg`:**
  - "Llenos" y "Cerrados" explican qué se lista y ofrecen "Ver grupos abiertos" en lugar de "Crear grupo".
  - "Abiertos" con filtros activos añade "Limpiar filtros".

**Verificación:**
- Login: los dos botones de proveedor se ven iguales y el CTA rojo destaca. Icono de Discord sobre `bg-input`: 4,06:1 (gráfico, mínimo 3:1).
- `/lfg?status=closed`: el estado vacío muestra el texto nuevo y "Ver grupos abiertos" lleva a los 10 grupos abiertos.
- Pestañas "Dúo", "Trío"; badge neutro "Trío" en el detalle; "Grupos LFG (1)" en el perfil de Player1#KR1; hero sin degradado.
- Build sin errores y consola limpia.

**Pendiente:**
- El mensaje de solicitud de `team-detail` necesita sesión de capitán para verse; solo se ha comprobado compilando.
- `oauth-buttons` es un archivo nuevo de la migración: estos cambios irán con su commit.
- `login.component.html` mezcla cambios de la migración: al commitear, preparar solo la línea del subtítulo.
- Falta volver a lanzar `/impeccable critique` y compararlo con el 26/40.

---

## 2026-10-25 · Escala tipográfica y roles de color (segunda ronda, paso 5)

**Commit:** `d809070`

**Qué y por qué:** había unos 38 tamaños de letra distintos (22 solo en la portada, alguno de 9,6 a 11,5px) y 39 colores hex sueltos fuera de `_variables.scss`. Además, los Riot ID y los nombres de equipo salían en mayúsculas y se perdía cómo se escriben.

**Cambios:**
- `_variables.scss`:
  - Escala `$font-size-2xs` … `$font-size-6xl`: 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36 y 52px. Para el hero, `$font-size-display` (72px) y `$font-size-display-lg` (96px).
  - El mínimo es 12px.
  - Roles nuevos: `$color-danger-text` (#ff6b76), `$color-warning`, `$color-info`, `$color-team` y `$color-text-bright`.
- 268 `font-size` en rem pasan al paso más cercano de la escala, en 28 SCSS (componentes, páginas, `_mixins` y `_typography`). Todo lo que bajaba de 12px sube a 12px. `ui-label` pasa de 0,78 a 0,8125rem.
- 39 hex sueltos pasan a roles: #ff6b76, #9a8cff, #2fd8b0, #f5c451, #5aa9ff, #8a96a3 y los `#fff` de hover. El fondo de `styles.scss` usa `$color-bg-dark`.
- `text-transform: none` en los nombres propios: `.c-player-card__name`, `.c-team-card__name`, `.c-profile__name`, `.c-team-detail__name` y los títulos de grupo (`.c-lfg-card__title`, `.c-detail__title`).
- `.c-detail__title`: con la escala, móvil y escritorio quedaban iguales; en escritorio sube a 28px para mantener la jerarquía.

**Verificación:**
- Portada: de 22 tamaños distintos (mínimo 10,88px) a 12 (mínimo 12px).
- A 375px, en 10 páginas (portada, listados, perfil, detalle LFG, detalle de equipo y acceso): sin scroll horizontal y ningún texto por debajo de 12px.
- "Player10#EUW", "Test Team Alpha" y "Busco trío chill" conservan sus mayúsculas y minúsculas.
- Contraste medido sobre `bg-card` (#16232f):
  - `danger-text` 5,79:1 (6,11:1 sobre el fondo de `.c-error`)
  - `team` 5,75:1
  - `warning` 9,8:1
  - `info` 6,5:1
- Build sin errores y consola limpia.

**Pendiente:**
- Quedan sin tocar los archivos nuevos de la migración (`oauth-buttons`, que tiene los colores de marca de Discord) y el `#fff` de la máscara de `gradient-border` (`_mixins.scss`), que es funcional.
- `_navbar.scss` y `_typography.scss` también tienen cambios de la migración: al commitear, preparar solo los bloques de este paso.

---

## 2026-10-25 · Lectores de pantalla y teclado (segunda ronda, paso 4)

**Commit:** `3129148`

**Qué y por qué:** al cambiar de página el foco se quedaba en el enlace pulsado, los títulos eran genéricos ("Perfil · PremadeGG"), los mini-avatares de las tarjetas LFG se anunciaban como "T", las pestañas de tamaño medían 9,6px en móvil y los errores no se anunciaban.

**Cambios:**
- `app.ts` y `app.scss`: al cambiar de ruta (no al cambiar filtros), el foco pasa al `h1` de `main` con `tabindex="-1"`. Si la página aún carga datos, espera en `#contenido` y pasa al `h1` cuando aparece, salvo que el usuario ya haya movido el foco. Sin anillo en ese `h1`, que no es un control.
- Títulos con nombre (`Title`): "Busco trío chill · PremadeGG", "Player1#KR1 · Jugadores · PremadeGG", "Test Team Alpha · Equipos · PremadeGG" (`lfg-detail`, `profile`, `team-detail`).
- `lfg-card`:
  - Los mini-avatares llevan `tabindex="-1"` y `aria-hidden="true"`; siguen siendo clicables con ratón.
  - El recuento se lee "1/5 jugadores" (texto `u-sr-only`).
- `lfg-board`:
  - Las pestañas de tamaño pasan de `<nav>` a `<div role="group" aria-label="Tamaño de grupo">`, porque filtran y no navegan.
  - `.c-tabs__size` sube a 0,75rem (12px) también en móvil.
- `role="alert"` en `.c-auth-card__error`, `.c-error`, `.c-detail__feedback--err` y `.c-modal__error` (login, registro, recuperar y nueva contraseña, portada, listados, detalle LFG, perfil y modales de equipos). Se deja fuera el aviso fijo de "Enlace inválido".

**Verificación:**
- Navegador a 375px:
  - Tarjeta → detalle, detalle → perfil y listado → equipo: el foco acaba en el `h1` con el nombre y el título de la pestaña cambia.
  - Del pie a `/lfg`: el foco va al `h1` "Grupos LFG". Al pulsar una pestaña de tamaño el foco se queda en ella.
  - Las 4 pestañas caben a 12px (86px cada una, sin desbordar). Contraste del texto de tamaño: 5,03:1.
  - Avatares con `tabIndex` -1 y `aria-hidden`.
- Build sin errores y consola limpia.

**Pendiente:** los `role="alert"` no se han visto disparar: los errores necesitan forzar un fallo del servidor o iniciar sesión.

---

## 2026-10-25 · Móvil: filtros plegables y cabecera compacta (segunda ronda, paso 3)

**Commit:** `8195eee` (solo frontend; las migraciones SQL van con el commit de la migración a Supabase)

**Qué y por qué:** a 375px los filtros y la cabecera ocupaban casi toda la primera pantalla: la primera tarjeta de `/players` empezaba en y≈712 y el panel de filtros de `/lfg` terminaba en y=673.

**Cambios:**
- `scss/components/_page.scss`, por debajo de `sm` (576px):
  - `.c-page-header`: título y acción ("Crear grupo", "Crear equipo") en la misma fila; se oculta `__desc`.
  - `.c-filters`: el contenido va en `__body` y se pliega. El pie (recuento) pasa arriba con el botón `__toggle` "Filtros (n)", con `aria-expanded` y `aria-controls`.
  - Plegado se oculta "Limpiar filtros" (el botón ya dice cuántos hay); abierto baja a su propia línea.
  - `.c-filters .c-chips`: una sola fila con scroll horizontal que llega al borde del panel, con 4px de relleno vertical para no recortar el anillo de foco. Los chips de la portada no cambian.
- `lfg-board`, `players` y `teams`: `<div class="c-filters__body">` alrededor de las filas, botón en el pie y propiedad `filtersOpen`.
- En escritorio no cambia nada: el botón no se muestra y el cuerpo siempre está abierto.

**Verificación:**
- Navegador a 375px, sin scroll horizontal:
  - `/players`: la primera tarjeta empieza en y=252 (antes ≈712); el panel plegado mide 71px. Abierto, los roles van en una fila con scroll.
  - `/lfg?rank=Silver&karma=3`: "Filtros (2)" y la primera tarjeta en y=305 (antes el panel acababa en y=673).
  - `/teams?region=eu&recruiting=1`: "Filtros (2)" en la misma fila que el recuento.
- A 1024px el panel se ve como antes, con la descripción de la cabecera.
- Build sin errores y consola limpia.
- Para probar `/lfg` se reinsertaron en la base local los 10 grupos del seed: el cron `delete … where expires_at < now()` los había borrado al caducar (24 h).

**Pendiente:** el panel se pliega de nuevo al cambiar de página; no se guarda el estado.

---

## 2026-10-25 · Documento de traspaso

**Commit:** no se commitea (documento de trabajo local)

**Qué y por qué:** pasar la segunda ronda de la revisión de diseño a otro agente.

**Cambios:**
- `TRASPASO.md` (nuevo) recoge:
  - El estado de git y cómo no mezclar la migración a Supabase.
  - El trabajo sin commitear de los pasos 1 y 2.
  - Los pasos 3 a 6 pendientes.
  - Cómo verificar y las trampas conocidas (CRLF, archivos mezclados, Docker).

---

## 2026-10-25 · Karma donde se decide (segunda ronda, paso 2)

**Commit:** `8195eee` (solo frontend; las migraciones SQL van con el commit de la migración a Supabase)

**Qué y por qué:** el karma no aparecía en los momentos de decidir. Faltaba en el detalle LFG, el tablero no filtraba por él y en la tarjeta LFG iba en el pie. Además, el rango del creador salía junto a "Mín. Oro" y no se sabía de quién era cada dato. Se pidió karma y rango al mismo nivel.

**Cambios:**
- `supabase/migrations/20261025000002_lfg_filters.sql` (nueva): `get_lfg_posts` gana dos filtros, con el mismo orden y cursor.
  - `p_my_rank`: grupos sin rango mínimo o con un mínimo igual o inferior a ese rango (el enum está ordenado).
  - `p_min_author_karma`: karma mínimo del creador.
  - Se mantiene `p_min_rank` (igualdad) por compatibilidad.
- Tablero `/lfg`:
  - Filtros "Tu rango" (select) y "Karma del creador" (Cualquiera / 3+ / 4+ / 4,5+), sincronizados con la URL (`?rank=` y `?karma=`).
  - "Limpiar filtros (n)".
- `lfg-card`:
  - La fila "Creador" muestra rango, karma (sm) y región juntos.
  - Los requisitos van aparte: "Exige Bronce o más · karma 3+".
  - El karma sale del pie.
  - Nuevo `@Input() showStatus`: el badge "Abierto" se oculta cuando el contexto ya lo dice (filtro "Abiertos" y portada).
- `player-card`: rango y karma en la misma fila (`__standing`). El karma grande de la derecha desaparece.
- `lfg-detail`:
  - Rango y karma del creador juntos en la cabecera.
  - Cada miembro aceptado muestra su karma.
  - Fuera el bloque "Rango" suelto, que no decía de quién era.
- `karma-badge`: en tamaño sm, una cuenta sin valoraciones muestra "Nuevo" (antes un guion).
- `/players`: "4.5+" pasa a "4,5+".

**Verificación:**
- Migración aplicada y `npm run db:test` en verde (16/16).
- RPC: con "Tu rango Plata" salen 5 de 10 grupos (los que exigen Hierro, Bronce o Plata); con karma ≥ 4, 5.
- Navegador:
  - `/lfg?rank=Silver&karma=3` recupera los filtros de la URL, muestra 4 grupos, "Limpiar filtros (2)" y ningún badge "Abierto".
  - Detalle: "Radiante · Karma 4,5 · 2 valoraciones" en el creador y karma en los miembros.
  - En `/players`, rango y karma en la misma fila.
  - Sin desbordamiento a 375px.
- Build sin errores.

**Pendiente:** en móvil el panel de filtros de `/lfg` es más alto (termina en y=673); los filtros plegables del paso 3 lo resuelven.

---

## 2026-10-25 · Karma con pruebas (segunda ronda, paso 1)

**Commit:** `8195eee` (solo frontend; las migraciones SQL van con el commit de la migración a Supabase)

**Qué y por qué:** la segunda crítica (26/40) detectó que el karma no demostraba nada. Todas las cuentas empiezan con 5,0, así que "Top jugadores" eran en realidad jugadores sin valorar, y las valoraciones usaban otro lenguaje visual (estrellas).

**Cambios:**
- `supabase/migrations/20261025000001_review_count.sql` (nueva):
  - Columna `profiles.review_count`, rellenada con las valoraciones existentes.
  - `recalculate_karma()` mantiene karma y recuento juntos.
  - `user_json` expone `reviewCount`.
  - `get_users` gana el filtro opcional `p_min_reviews` (mismo orden y cursor).
  - Es una migración aparte para aplicarla con `migration up` sin borrar la base local.
- `karma-badge`:
  - Nuevo `@Input() count`.
  - Con 0 valoraciones muestra "Nuevo" / "Sin valoraciones": sin número, segmentos vacíos y color neutro.
  - Con alguna valoración añade "N valoraciones" en los tamaños md y lg.
  - El `aria-label` incluye el recuento.
  - Los segmentos vacíos llevan un contorno de 1px en `$color-text-subtle` (antes 1,4:1).
- `[count]` se pasa en la tarjeta de jugador, el perfil, la tarjeta LFG y los miembros del detalle LFG. `User.reviewCount` es opcional en el modelo.
- `api.service`: `getUsers({ minReviews })`. Solo envía `p_min_reviews` si se usa.
- Portada:
  - "Top jugadores" pide solo jugadores con al menos una valoración y desempata por número de valoraciones.
  - El total del hero sale de otra petición.
  - Textos más claros: "Tus compañeros te puntúan de 1 a 5 y tu karma es la media…", "Mejor karma con al menos una valoración".
  - Nuevo estado vacío para cuando nadie tiene valoraciones.
- Perfil:
  - Las estrellas pasan a segmentos (`.c-rating`) con los colores del karma y `aria-label` "Puntuación N de 5".
  - El formulario usa 5 botones numerados (`.c-rating-input`) con `aria-pressed` y 44px en táctil.
  - "Eliminar mi review" pasa a "Eliminar mi valoración".

**Verificación:**
- Migración aplicada con `npx supabase migration up`.
- `npm run db:test`: 16/16 en verde.
- `review_count` cuadra con las 50 valoraciones: 0 descuadres en 23 jugadores, 19 con alguna valoración.
- Trigger probado en una transacción con rollback: karma 5,0 y 0 valoraciones → 2,0 y 1 tras insertar una de 2 → 5,0 y 0 tras borrarla.
- Navegador:
  - "Top jugadores" muestra solo jugadores valorados, con "1 valoración" / "3 valoraciones"; el hero sigue en 23 jugadores.
  - En `/players` las cuentas sin valoraciones salen como "Nuevo" con segmentos huecos.
  - El perfil muestra las valoraciones como segmentos con `aria-label` "Puntuación N de 5".
- Build sin errores.

**Pendiente:** el selector de puntuación del formulario necesita sesión iniciada; solo está comprobado compilando.

---

## 2026-10-24 · Repaso final (paso 7 de la revisión de diseño)

**Commit:** `bdaa01c`

**Qué y por qué:** cerrar las observaciones menores de la revisión de diseño.

**Cambios:**
- **Fuentes:** el `@import` de Google Fonts sale de `_typography.scss` (bloqueaba el render) y pasa a `<link>` con `preconnect` en `index.html`.
- **Títulos de página:**
  - Cada ruta tiene el suyo en `app.routes.ts` ("Grupos LFG · PremadeGG", "Perfil · PremadeGG"…).
  - El título por defecto pasa a "PremadeGG · Grupos de Valorant con reputación".
- **Etiquetas sobre los títulos:**
  - Fuera las que solo repetían el título: "Busca grupo", "Comunidad", "Competitivo", "En directo" y "Fichajes".
  - "Mejor karma" pasa a descripción bajo "Top jugadores" ("Ordenados por karma").
  - Se mantiene la del hero, que da contexto ("Valorant · Busca grupo" / "Hola, …").
- **`transition: all`:** se sustituye por las propiedades concretas en los inputs de las páginas de acceso, perfil, editar perfil, team-detail, `.c-badge` y las líneas del menú.
- **Tarjetas LFG llenas o cerradas:**
  - Dejan de usar `opacity`, que bajaba el contraste de todo el texto.
  - La cerrada usa un fondo más apagado y el título atenuado.
- **Badge de región en `lfg-detail`:** fuera su versión morada local; usa el badge neutro del sistema.
- **Registro y onboarding:** los `style="flex: 2"` en línea pasan al modificador `.c-auth-card__field--wide`.
- **Footer:** "Conecta. Juega. Gana." pasa a "Grupos de Valorant con reputación real.".

**Verificación:**
- Navegador: `document.title` cambia por ruta.
- `document.fonts.check` confirma que Anton y Barlow Condensed cargan desde el `<link>`.
- Solo queda la etiqueta del hero.
- Sin errores en consola.
- Detector: solo falsos positivos.
- Build sin errores.

**Pendiente:**
- No hay grupos cerrados en los datos de prueba, así que el nuevo estilo de tarjeta cerrada no se ha visto en pantalla.
- El estado vacío del filtro "Cerrados" invita a crear un grupo, cosa que no encaja con ese filtro.

---

## 2026-10-24 · Textos e idioma (paso 6 de la revisión de diseño)

**Commit:** `2fd7f48`

**Qué y por qué:** la UI mezclaba inglés y español: rangos ("Platinum"), roles ("Duelist"), horarios ("Evenings"), meses ("October 2026"), "Reviews", "Lv.", "LFT", "Looking for group"… y un texto de desarrollo en un estado vacío.

**Cambios:**
- `shared/pipes/label.pipe.ts` (nuevo): el pipe `label` traduce rango, rol y horario solo al mostrarlos. Los valores de la base de datos y de los filtros siguen en inglés, así que el backend no cambia.
  - Ejemplos: "Gold 2" → "Oro 2"; "Duelist" → "Duelista"; "Late Night" → "Noches".
  - Los valores desconocidos se muestran tal cual.
- Se aplica en: `rank-badge`, tarjetas de jugador y LFG, perfil, editar perfil, registro, onboarding, team-detail, `user-picker` y los selectores y chips de filtro de portada, LFG, jugadores y equipos.
- `app.config.ts`: `LOCALE_ID 'es'` con `registerLocaleData`. Las fechas salen en español ("octubre 2026") y los decimales con coma (karma "4,7").
- Textos:
  - "Reviews" pasa a "Valoraciones" en el título, los botones, los avisos y los mensajes de éxito y error.
  - "Lv." pasa a "Nv." y "Min:" a "Mín.".
  - El badge "LFT" pasa a "Busca equipo", en la tarjeta y en el perfil.
  - "Looking For Team (LFT)" pasa a "Busco equipo" en editar perfil.
  - El eyebrow "Looking for group" pasa a "Busca grupo".
  - El estado vacío de jugadores ya no dice "ejecuta el seed…".

**Verificación:**
- Navegador: chips "Duelista, Controlador, Iniciador, Centinela, Flex"; opciones de rango "Hierro…" con `value` en inglés; rango "Platino"/"Radiante"; "Busca equipo"; "Nv. 80".
- Perfil: "Miembro desde octubre 2026", "Valoraciones (1)", karma "2,0" con `aria-label` "Karma 2,0 de 5".
- Build sin errores.

**Pendiente:** los nombres de los agentes y "Duo/Trio/5-Stack" se dejan como en el juego.

---

## 2026-10-24 · Invitados y primer uso (paso 5 de la revisión de diseño)

**Commit:** `7ad796d`

**Qué y por qué:** quien entraba sin cuenta se encontraba con varios tropiezos:
- El detalle de un grupo LFG era un callejón sin salida, sin ningún botón.
- Las páginas nuevas se abrían con el scroll de la anterior.
- "Cómo funciona" estaba al final de la portada.
- El registro pedía 8 campos.

**Cambios:**
- `lfg-detail`: bloque para invitados cuando el grupo está abierto.
  - Explica que hace falta una cuenta y el karma mínimo del grupo, y que todas las cuentas empiezan con 5.
  - Botones "Inicia sesión para unirte" (principal) y "Crear cuenta", los dos con `returnUrl` al mismo grupo.
- `app.ts`: al cambiar de ruta se vuelve arriba al instante. Solo si cambia la ruta: los filtros cambian los query params y no mueven el scroll.
  - Se descartó `withInMemoryScrolling`, porque también subía la página con cada clic en un filtro.
- `home`:
  - "Cómo funciona" pasa justo detrás del hero, con un título visible.
  - Su botón "Crear cuenta gratis" pasa a secundario, para no competir con "Buscar grupos".
- `register`:
  - Fuera el campo "Horario de juego": por defecto es "Flexible" y se cambia en el perfil.
  - Se mantiene "Rol principal": no se puede editar después (el RPC `update_profile` no acepta `role`).
  - Tras registrarse se respeta `returnUrl` (solo rutas internas, contra redirecciones abiertas), también cuando termina en `/onboarding`.
- `login` ↔ `register`: los enlaces entre ambas páginas conservan `returnUrl` (`queryParamsHandling="preserve"`).

**Verificación:**
- Navegador: un invitado en `/lfg/:id` ve el bloque y los enlaces llevan a `/login?returnUrl=%2Flfg%2F…` y `/register?returnUrl=…`.
- Scroll medido: al abrir un perfil desde y=400 se pasa a y=0; un filtro de jugadores mantiene y=400.
- Portada: "Cómo funciona" está a 683px (antes, unos 1900).
- Registro: 7 campos y el enlace a login conserva `returnUrl`.
- Build sin errores.

**Pendiente:** no se ha probado un registro real de principio a fin (crea una cuenta en Supabase local); se ha revisado el código y la compilación.

---

## 2026-10-24 · Accesibilidad (paso 4 de la revisión de diseño)

**Commit:** `e48f476`

**Qué y por qué:** las tarjetas no se podían abrir con el teclado y no había forma de saltarse el navbar. Además, nada respetaba `prefers-reduced-motion`, los filtros no anunciaban su estado y los menús y modales no se cerraban con Esc.

**Cambios:**
- Tarjetas LFG, de jugador y de equipo:
  - El `routerLink` sale del `<article>` y pasa a un `<a class="c-card__link">` en el título. Su `::after` cubre toda la tarjeta (`_cards.scss`).
  - Ahora funcionan Enter, el clic central y "abrir en pestaña nueva".
  - La tarjeta muestra el anillo de foco cuando su enlace lo recibe.
  - Los enlaces y botones internos quedan por encima.
- `app.html` / `app.ts`: enlace "Saltar al contenido", visible solo con foco. Mueve el foco con JS porque `<base href>` haría que `#contenido` navegase a la portada.
- `_reset.scss`:
  - `prefers-reduced-motion: reduce` desactiva animaciones, transiciones y el scroll suave.
  - Nueva utilidad `.u-sr-only`.
- `aria-pressed` en todos los chips, segmentos y pestañas de filtro (portada, LFG, jugadores, equipos). El buscador de la portada deja de usar `role="tab"` sin paneles.
- Navbar:
  - Esc cierra el menú de usuario o el cajón móvil y devuelve el foco a su botón.
  - La etiqueta del botón alterna entre "Abrir menú" y "Cerrar menú".
- `shared/dialog/dialog.directive.ts` (nuevo, `appDialog`): al abrir un modal mete el foco dentro y lo atrapa con Tab. Esc lo cierra y, al cerrarse, el foco vuelve a donde estaba.
  - Se aplica a los modales de crear grupo, crear equipo, unirse a un equipo y eliminar equipo.
  - Los dos de team-detail ganan `role="dialog"` / `alertdialog` y `aria-modal`.
- `h2` solo para lectores de pantalla en las listas de LFG, jugadores y equipos, para no saltar del h1 al h3.
- Fuera las curvas con rebote: `$transition-spring` y el modal de team-detail usan `$ease-out-expo`.
- El título "Eliminar equipo" deja el `style` en línea y usa `.c-modal__title--danger`.

**Verificación:**
- Navegador, con el teclado:
  - El primer Tab muestra "Saltar al contenido". Enter lo activa sin cambiar de ruta y el siguiente Tab cae en "Crear grupo".
  - Tab llega al enlace de la tarjeta, la tarjeta muestra el anillo y Enter abre `/lfg/:id`.
  - Con `elementFromPoint` se comprobó que un clic en zonas vacías de la tarjeta va al enlace principal, y que el creador y los avatares siguen siendo enlaces propios.
  - Esc en el cajón móvil lo cierra y devuelve el foco.
- Detector: solo quedan falsos positivos (los `[src]` de Angular y la animación de "escribiendo…").
- Build sin errores.

**Pendiente:** los modales y el menú de usuario necesitan sesión iniciada; están comprobados compilando, no en pantalla. Tampoco se ha probado con un lector de pantalla real (NVDA o VoiceOver).

---

## 2026-10-24 · Móvil y tablet (paso 3 de la revisión de diseño)

**Commit:** `e48f476`

**Qué y por qué:** a 375px la página se desbordaba y se recortaba por la derecha. Además, la pestaña 5-STACK quedaba oculta, el CTA de la portada salía de la pantalla y había 29 áreas táctiles por debajo de 44px.

**Cambios:**
- `scss/global/_grid.scss`: las columnas usan `minmax(0, 1fr)`, así que un título largo ya no ensancha la columna (era la causa del desbordamiento). El margen lateral mínimo pasa de 8px a 16px.
- `scss/utilities/_mixins.scss`: nuevos mixins `touch` (`@media (pointer: coarse)`) y `touch-hit` (amplía la zona pulsable de un enlace sin mover el layout).
- En pantallas táctiles (`pointer: coarse`), 44px como mínimo en:
  - botones, chips y segmentos;
  - el botón de menú (antes 28×28) y el logo;
  - el botón de mensaje de la tarjeta de jugador;
  - los enlaces "por X" de las tarjetas, los del footer y "o publica tu propio grupo".
- En escritorio no cambia nada.
- `lfg-board`: por debajo de 576px las 4 pestañas (Todos/Duo/Trio/5-Stack) van en una rejilla de 4 columnas y siempre se ven.
- `home`:
  - En móvil, las tres cifras del hero van en una fila y los chips de tamaño en una rejilla de 4.
  - El hero tiene menos padding.
  - El botón "Buscar grupos" pasa de y=831 (fuera de pantalla) a y=706 en 375×812.
- `_navbar.scss`: entre 768 y 1023px los enlaces no se parten ("GRUPOS LFG" ya no salta de línea) y tienen menos aire.

**Verificación:**
- Navegador a 375×812 (móvil emulado con `pointer: coarse`): sin desbordamiento horizontal en `/`, `/lfg`, `/players`, `/teams`, `/login`, `/register` ni un perfil.
- Áreas táctiles medidas con JavaScript.
- Navbar comprobado a 800px.
- Escritorio a 1280px sin cambios (chips 35px, botones 33px).
- Build sin errores.

**Pendiente:**
- Los mini-avatares de 28px de la tarjeta LFG siguen por debajo de 44px. Se solapan entre sí y la tarjeta entera ya es pulsable.
- Falta probar en un móvil real (iOS/Android): esto es emulación de Chromium.

---

## 2026-10-24 · Reglas para Claude y registro de cambios

**Commit:** el mismo que añade este archivo.

**Qué y por qué:** dejar por escrito las convenciones del proyecto y obligar a documentar cada cambio en un solo sitio.

**Cambios:**
- `CLAUDE.md`: contexto del proyecto, la regla de mantener este registro, los roles de color y las normas de contraste, y la forma de trabajar (CRLF, commits limpios).
- `CAMBIOS.md`: este archivo, con las entradas del rediseño de color e identidad.

---

## 2026-10-24 · Identidad visual: karma y rangos (paso 2 de la revisión de diseño)

**Commit:** `ffdfd2c`

**Qué y por qué:** la revisión de diseño concluyó que la web parecía un kit genérico de Valorant y que el karma, que es la razón de ser del producto, era lo menos visible de cada tarjeta. Se convierte el karma en la firma visual de PremadeGG.

**Cambios:**
- `shared/karma-badge`: nuevo medidor con la etiqueta "KARMA", el valor en Anton y 5 segmentos inclinados que se rellenan en proporción (escala 0–5).
  - Colores por nivel: cian ≥3,5, oro ≥2,5 y rojo por debajo.
  - Tamaños `sm`, `md` y `lg`.
  - Lleva `aria-label` ("Karma 4,6 de 5") y un tooltip explicativo.
- `shared/rank-badge`: un color por tier (`$rank-colors`, de Hierro a Radiante, todos ≥4,4:1) con un rombo. Los valores desconocidos se muestran como "unranked".
- Tarjeta de jugador:
  - El karma pasa arriba a la derecha.
  - Rol, región y nivel quedan en una sola línea de datos.
  - Solo "LFT" se mantiene como etiqueta, ahora en cian.
- Tarjeta LFG: muestra el karma del creador en el pie.
- Perfil:
  - El karma va en un bloque grande aparte.
  - Los agentes favoritos muestran su retrato (`services/agent-icons.service.ts`, desde valorant-api.com, con caché en localStorage y vuelta al texto si falla).
- Las etiquetas de rol y región pasan a ser neutras en toda la app.

**Verificación:**
- Navegador: `/players`, `/lfg` y un perfil con karma 2.0.
- Los niveles oro y rojo y el relleno parcial se comprobaron con datos reales y simulados en el DOM.
- Build sin errores.

**Pendiente:** los nombres de rango y rol siguen en inglés (se traducen en el paso de textos).

---

## 2026-10-24 · Color y contraste (paso 1 de la revisión de diseño)

**Commit:** `ffdfd2c`

**Qué y por qué:**
- La revisión con `/impeccable critique` dio 24/40.
- El rojo `#ff4655` significaba marca, CTA, seleccionado, abierto, foco y error a la vez.
- El texto blanco sobre rojo (3,4:1) y `$color-text-subtle` (2,6–3,1:1) no pasaban AA.

**Cambios:**
- `_variables.scss`: roles semánticos `$color-brand`, `$color-on-brand`, `$color-selected`, `$color-on-selected`, `$color-focus`, `$color-positive`, `$color-danger` y `$color-hover-border`.
- Rojo reservado para el logo, el CTA principal, los errores, el peligro y los contadores de avisos.
- Botón primario con texto navy: 5,29:1.
- Selección (chips, segmentos, pestañas, enlace activo del navbar) y foco en hueso `#ece8e1`: 14,5:1.
- Estado "abierto" y barras de progreso en cian.
- `$color-text-subtle` de `#56646f` a `#7d8a96` (4,5–5,3:1 sobre los fondos oscuros).
- Fuera los elementos decorativos en rojo:
  - la franja bajo los títulos y el borde izquierdo de los filtros;
  - la barra superior de login, registro, recuperar contraseña y modales;
  - las franjas laterales de mensajes y notificaciones;
  - el brillo rojo al pasar el ratón por las tarjetas;
  - el "GG" con degradado;
  - los avatares de inicial en rojo.
- Tarjetas de auth con esquinas cortadas, como el resto del sistema.
- En el navbar, "Registrarse" y "Crear grupo" pasan a botón secundario para no competir con el CTA de cada página.
- La franja roja final de la portada pasa a ser neutra con un botón primario dentro.

**Verificación:**
- Contrastes medidos en el navegador con JavaScript.
- Foco visible comprobado con el teclado.
- Detector de impeccable: de 24 a 18 hallazgos (los restantes son falsos positivos o animaciones).
- Build sin errores.

**Pendiente:** mensajes, editar perfil y los modales solo se comprobaron compilando, porque necesitan sesión iniciada.
