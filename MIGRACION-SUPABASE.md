# Migración de PremadeGG a Supabase

Registro de todo lo hecho en la sesión del **24/10/2026**: por qué se cambió el stack, qué se construyó, cómo se validó y qué queda pendiente.

- **Rama:** `migrate-supabase` (creada desde `redesign-valorant`)
- **Estado:** validada en local, sin commitear y pendiente de desplegar

---

## 1. Punto de partida

### Stack anterior (MEAN)
| Pieza | Tecnología | Hosting |
|---|---|---|
| Frontend | Angular 21 | Vercel |
| API | Express + Socket.IO | Render (free) |
| Base de datos | MongoDB + Mongoose | Atlas M0 |
| Auth | JWT + bcrypt hechos a mano | — |
| Email | Brevo / Nodemailer | — |
| Avatares | `multer` → `server/uploads` | Disco de Render |

### Problemas detectados
1. **Cold start:** Render free se duerme tras 15 min sin uso y tarda unos 50 s en despertar.
2. **Avatares perdidos:** el disco de Render es efímero, así que cada redeploy o reinicio borraba `server/uploads`.
3. **Mucho código propio que mantener:** registro, login, JWT, reset de contraseña y emails.
4. **Datos relacionales en NoSQL:** usuarios, equipos con miembros, posts con miembros, reputación entre usuarios y conversaciones encajan mejor en SQL.
5. **Agujeros de seguridad en la API:**
   - `PUT /api/users/:id` dejaba editar **cualquier** usuario, sin comprobar el dueño.
   - `DELETE /api/reviews/:id` dejaba borrar **cualquier** review.
   - `seedDefaults` creaba usuarios de prueba también en producción, en cada arranque.

---

## 2. Decisión

Se valoraron tres opciones:

| Opción | Descripción | Resultado |
|---|---|---|
| **Full Supabase** | Eliminar Express. Angular habla directamente con Supabase | ✅ **Elegida** |
| Híbrido | Mantener Express en Render con Postgres, Auth y Storage de Supabase | Descartada: sigue el cold start |
| Mínimo | Solo mover los avatares a Storage | Descartada: no resuelve el resto |

Requisitos que se fijaron:
- **Hay usuarios reales en producción**, así que hay que migrarlos sin que pierdan su contraseña.
- **Login social con Discord y Google**, además de email y contraseña.
- **Todo gratis.**

### Stack nuevo
| Pieza | Tecnología |
|---|---|
| Frontend | Angular 21 (Vercel) + `@supabase/supabase-js` |
| Base de datos | Supabase Postgres + Row Level Security |
| API | Funciones RPC de Postgres |
| Auth | Supabase Auth (email, Google, Discord) |
| Tiempo real | Supabase Realtime (broadcast privado) |
| Archivos | Supabase Storage (bucket `avatars`) |
| Riot / HenrikDev | Supabase Edge Functions (Deno) |
| Limpieza programada | `pg_cron` |

### Límites del plan gratuito de Supabase
500 MB de base de datos · 1 GB de Storage · 50.000 usuarios activos al mes · 200 conexiones Realtime simultáneas · **el proyecto se pausa tras 7 días sin actividad** (lo evita un workflow de GitHub Actions).

---

## 3. Qué se construyó

### 3.1 Base de datos (`supabase/migrations/`)

| Migración | Contenido |
|---|---|
| `…01_schema.sql` | Enums, tablas e índices: port de los 7 modelos Mongoose |
| `…02_helpers_rls.sql` | Helpers, serializadores JSON, políticas RLS, permisos y RLS de Realtime |
| `…03_api_read.sql` | RPC de lectura con paginación por cursor |
| `…04_api_write.sql` | RPC de escritura con todas las reglas de negocio |
| `…05_triggers_cron.sql` | Perfil automático al registrarse, recálculo de karma, notificaciones en tiempo real y cron de limpieza |
| `…06_storage.sql` | Bucket `avatars` (2 MB, solo imágenes) y sus políticas |

**De Mongo a Postgres:**
- Los subdocumentos pasan a tablas propias: `team_players`, `team_staff`, `team_join_requests`, `lfg_members` y `conversation_participants`.
- El array `readBy[]` de cada mensaje se sustituye por `conversation_participants.last_read_at`, una sola fecha por participante. Es más simple y más eficiente.
- Los logros de un equipo se guardan en un campo `jsonb`, porque el formulario los edita como un bloque.
- El enum de rangos está ordenado, así que la comprobación de "rango mínimo" es un simple `<`.
- `profiles.onboarded` indica si el usuario ya vinculó su Riot ID. Los usuarios que entran con Google o Discord empiezan sin él.

**Modelo de seguridad:**
- **Lectura:** RLS en todas las tablas.
  - Perfiles, equipos, posts y reviews son públicos.
  - Conversaciones y mensajes solo los ven sus participantes.
  - Las notificaciones solo las ve su destinatario.
- **Escritura:** el cliente **no tiene ningún permiso** de `INSERT`, `UPDATE` o `DELETE`. Todo pasa por funciones RPC `security definer` que validan `auth.uid()` y las reglas de negocio.
- **Datos de Riot** (`rank`, `puuid`, `riot_id`, `karma`): no se pueden editar desde el cliente. Solo los escriben las Edge Functions y los triggers.
- **Realtime:** canales privados `user:<id>` y `typing:<conversación>`, protegidos con RLS sobre `realtime.messages`.
- Los dos agujeros de la API anterior quedan cerrados.

**Lógica portada desde los controllers:**
- Karma < 3 no puede crear posts. Para unirse a un post hay que cumplir el karma y el rango mínimos.
- Aceptar miembros respeta el tamaño del grupo y lo marca como lleno. Si alguien sale, el grupo vuelve a abrirse.
- Al crear un equipo se crea su chat de grupo. Añadir o quitar jugadores y staff sincroniza ese chat.
- `played_together` detecta si dos usuarios coincidieron en un LFG o en un equipo.
- El karma es la media de las reviews redondeada a 1 decimal, y 5 si no tiene ninguna. Ahora lo recalcula un trigger.
- `pg_cron` cada 15 min borra los posts caducados (24 h), las notificaciones de más de 30 días y los mensajes de más de 90 días. Sustituye a los índices TTL de Mongo.

**API (funciones RPC):** devuelven JSON con **la misma forma que la API Express** (`_id`, camelCase, objetos poblados), para que las páginas de Angular no cambien.

| Área | Lectura | Escritura |
|---|---|---|
| Perfil | `get_me`, `get_user`, `get_users`, `search_users` | `update_my_profile` |
| Reviews | `get_reviews`, `get_review_eligibility` | `create_review`, `delete_review` |
| LFG | `get_lfg_posts`, `get_lfg_post` | `create_lfg_post`, `update_lfg_post`, `delete_lfg_post`, `join_lfg_post`, `handle_lfg_member`, `leave_lfg_post` |
| Equipos | `get_teams`, `get_team` | `create_team`, `update_team`, `delete_team`, `set_team_coach`, `add_team_player`, `remove_team_player`, `add_team_staff`, `remove_team_staff`, `request_join_team`, `review_team_join_request` |
| Notificaciones | `get_notifications`, `get_unread_notification_count` | `mark_notification_read`, `mark_all_notifications_read`, `delete_notification` |
| Mensajes | `get_conversations`, `get_conversation`, `get_messages`, `get_unread_message_count` | `get_or_create_direct_conversation`, `create_group_conversation`, `send_message`, `mark_conversation_read` |

**Eventos en tiempo real:** la base de datos emite los **mismos eventos que antes enviaba Socket.IO**:
- Canal `user:<id>`: `message:new`, `message:read`, `conversation:new`, `conversation:updated`, `conversation:removed` (este es nuevo) y `notification:new`.
- Canal `typing:<id>`: `message:typing` y `message:stop-typing`.

### 3.2 Edge Functions (`supabase/functions/`)
Port de `server/services/riotService.js`. Las API keys siguen sin llegar al navegador.

| Función | Auth | Qué hace |
|---|---|---|
| `riot-validate` | Pública | Valida un Riot ID, opcionalmente obtiene su rango y avisa si ya está registrado |
| `riot-link` | Requiere sesión | Onboarding: verifica la cuenta con Riot y guarda rango, card y nivel |
| `riot-refresh` | Requiere sesión | Actualiza rango y card (cooldown de 1 h). Sustituye al auto-populate de `GET /auth/me` |

### 3.3 Auth
- Email + contraseña, **Google** y **Discord**.
- Nueva página **`/onboarding`** para vincular el Riot ID. Se rellena sola con los datos que el usuario dio al registrarse.
- El `authGuard` lleva a `/onboarding` a quien no lo haya completado. El nuevo `onboardingGuard` protege esa página.
- El registro guarda los datos de Riot en los metadatos del usuario y funciona tanto con confirmación de email activada como desactivada.
- La recuperación de contraseña la gestiona Supabase: el enlace del email abre `/reset-password` con una sesión temporal.
- Plantillas de email en español, con el estilo Valorant, en `supabase/templates/`.
- Los errores de Supabase Auth se traducen al español.

### 3.4 Frontend Angular
| Archivo | Cambio |
|---|---|
| `services/supabase.client.ts` | **Nuevo.** Cliente único y helpers `rpc()` / `invokeFunction()`. Son perezosos, como `HttpClient`, y devuelven errores con la forma `{ status, error: { message } }` |
| `services/api.service.ts` | Mismas firmas públicas, pero por dentro llama a RPC y Edge Functions. Conserva la caché con TTL |
| `services/auth.service.ts` | Reescrito sobre Supabase Auth: OAuth, onboarding, reset de contraseña y subida de avatar a Storage |
| `services/realtime.service.ts` | **Nuevo.** Sustituye a `socket.service.ts` con la misma API (`on()`, `emit()`, `connected`) |
| `services/message.service.ts`, `notification.service.ts` | De HTTP a RPC y de Socket.IO a Realtime |
| `guards/auth.guard.ts` | Comprueba el onboarding. Añade `onboardingGuard` |
| `pages/onboarding/` | **Nueva** página |
| `shared/oauth-buttons/` | **Nuevo.** Botones de Discord y Google en el login y el registro |
| `pages/login`, `register`, `forgot-password`, `reset-password` | Adaptadas a Supabase Auth |
| `environments/*.ts` | `supabaseUrl` + `supabaseKey` (en lugar de `apiUrl` y `socketUrl`) |
| Eliminados | `interceptors/auth.interceptor.ts`, `socket.service.ts`, `environment.docker.ts`, `socket.io-client`, `provideHttpClient` |

### 3.5 Migración de datos (`scripts/migrate-mongo-to-supabase.mjs`)
- Crea cada usuario con `auth.admin.createUser({ password_hash })` usando el **hash bcrypt original**, así que todos entran con su contraseña de siempre.
- **Es idempotente:** los UUID se derivan del ObjectId de Mongo y se usa upsert, así que se puede relanzar sin duplicar nada.
- Tiene modo `--dry-run` y compara los conteos al terminar.
- Descarta lo que Mongo ya habría borrado (posts caducados) y las solicitudes de equipo ya procesadas.
- Convierte `readBy[]` en `last_read_at`, conservando qué mensajes estaban sin leer.
- Intenta rescatar los avatares de `/uploads` a Storage. Si se perdieron, el usuario pasa a mostrar su card de Riot.
- Limpia los datos inválidos: agentes que ya no existen y tags de equipo en minúsculas.

### 3.6 Otros archivos
- `supabase/seed.sql`: 3 usuarios de prueba y 20 aleatorios, 50 reviews, 2 equipos con su chat, 10 posts LFG y un chat directo.
- `supabase/tests/database/security.test.sql`: 16 tests pgTAP.
- `.github/workflows/supabase-keepalive.yml`: hace una consulta cada 3 días para que el proyecto no se pause.
- `package.json` en la raíz, con los scripts `db:*`, `functions:serve` y `migrate:mongo`.
- Ejemplos de variables de entorno: `.env.example`, `supabase/.env.example`, `supabase/functions/.env.example` y `scripts/.env.example`.
- `README.md` y `DEPLOY.md` reescritos para el nuevo stack.
- **Eliminados:** `server/` completo, `docker-compose.yml`, los Dockerfiles, `nginx.conf` y `proxy.conf.json`. El código anterior sigue en el historial de git.

---

## 4. Validación

Todo se probó en local con Supabase en Docker.

| Prueba | Resultado |
|---|---|
| Migraciones y seed aplicados desde cero (`db reset`) | ✅ |
| Tests de seguridad pgTAP | ✅ 16/16 |
| Prueba de extremo a extremo con supabase-js | ✅ 30/30 |
| App en el navegador (login, LFG, jugadores, equipos, chat, perfil, notificaciones) | ✅ sin errores en consola |
| Chat en tiempo real entre dos usuarios | ✅ |
| Recuperación de contraseña (email → enlace → contraseña nueva) | ✅ |
| Onboarding (redirección, datos rellenados, rutas bloqueadas) | ✅ |
| Edge Functions (validaciones, auth, errores) | ✅ |
| Migración desde un Mongo temporal con datos reales de ejemplo | ✅ login con la contraseña antigua, sin duplicados al relanzar |
| Caso de éxito de `riot-link` | ⚠️ sin probar: la `RIOT_API_KEY` del `.env` está caducada |

**La prueba de extremo a extremo cubrió:**
- Paginación y orden por karma.
- Bloqueo de escrituras directas.
- Canal privado ajeno bloqueado (`CHANNEL_ERROR`).
- Notificaciones `join_request` y `request_accepted` en tiempo real.
- Detección de "habéis jugado juntos".
- Typing, `message:new`, `message:read` y contadores de no leídos.
- `update_my_profile` ignora el karma y el rango.
- Avatar: subida a la carpeta propia, URL pública accesible, subida a carpeta ajena bloqueada.
- Un usuario sin onboarding no puede crear posts.

---

## 5. Problemas encontrados y soluciones

| Problema | Causa | Solución |
|---|---|---|
| Docker Desktop se cerraba al arrancar | Bug de la 4.41: no podía borrar el socket `%LOCALAPPDATA%\Docker\run\dockerInference` | Lo arregló el usuario |
| `toomanyrequests: Rate exceeded` al descargar las imágenes | Límite de peticiones de `public.ecr.aws` | El CLI reintenta solo; no hizo falta hacer nada |
| Postgres no arrancaba en el puerto 54322 | Windows (Hyper-V/WinNAT) reserva los puertos **54038–54437** | Puertos locales movidos a **443xx** en `config.toml` |
| La subida de avatar con `upsert` fallaba por RLS | El upsert de Storage también necesita permiso de lectura | Política `SELECT` sobre la carpeta propia |
| `riot-validate` y `riot-link` devuelven 502 | La development key de Riot dura 24 h | Generar una nueva (pendiente) |
| Aviso del build: bundle inicial de 538 kB (presupuesto de aviso: 500 kB) | supabase-js se carga al arrancar | Es solo un aviso; el límite de error es 1 MB |

---

## 6. Cómo probarla en local

Requiere Docker Desktop abierto. Desde la raíz del repo:

```bash
npm run db:start
npm run functions:serve -- --env-file .env
npm --prefix client start
```

| Servicio | URL |
|---|---|
| App | http://localhost:4200 |
| API de Supabase | http://127.0.0.1:44321 |
| Supabase Studio (ver las tablas) | http://127.0.0.1:44323 |
| Mailpit (emails de prueba) | http://127.0.0.1:44324 |

**Cuentas de prueba** (contraseña `password123` en todas):
- `test1@premade.gg`: dueño de Test Team Alpha
- `test2@premade.gg`: coach, dueño de Test Team Beta
- `test3@premade.gg`: autor de un post LFG
- `player1@premade.gg` … `player20@premade.gg`

Otros comandos: `npm run db:reset` deja los datos como al principio y `npm run db:test` pasa los tests de seguridad.

---

## 7. Pendiente

- [ ] Revisar los cambios y commitear la rama `migrate-supabase`
- [ ] Generar una `RIOT_API_KEY` nueva y probar `riot-link` con una cuenta real
- [ ] Crear el proyecto de Supabase en la nube y subir las migraciones (`npm run db:push`)
- [ ] Subir las Edge Functions y sus secrets
- [ ] Configurar el **SMTP de Brevo** en Supabase. Es obligatorio: el SMTP por defecto solo envía a los miembros de tu equipo
- [ ] Crear las apps OAuth de **Google** y **Discord**
- [ ] Poner la URL y la publishable key en `environment.prod.ts` y desplegar en Vercel
- [ ] Añadir los secrets del keepalive en GitHub (`SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`)
- [ ] Ejecutar la migración desde Atlas (primero con `--dry-run`) y probar el login de un usuario real
- [ ] Apagar Render y Atlas cuando todo esté verificado

Los pasos detallados están en [`DEPLOY.md`](DEPLOY.md).
