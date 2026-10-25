# 🚀 Guía de Deploy Gratuito - PremadeGG

Despliega PremadeGG en la nube de forma **100% gratuita** usando:
- **Supabase** → Base de datos, Auth, Storage, Realtime y Edge Functions
- **Vercel** → Frontend (Angular)

Ya no hay servidor propio que se duerma: no hay *cold start*.

---

## Requisito previo: código en GitHub

Asegúrate de que ningún `.env` está en el repositorio (ya están en `.gitignore`). Nunca subas credenciales.

---

## Paso 1: Crear el proyecto de Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta (con GitHub)
2. **New project** → elige nombre, contraseña de la base de datos y la región más cercana (p. ej. *West EU*)
3. Cuando termine de crearse, apunta el **Project Ref** (está en la URL: `supabase.com/dashboard/project/<ref>`)

### Subir el esquema (migraciones)

Desde la raíz del repo:
```bash
npx supabase login
npx supabase link --project-ref <tu-ref>
npm run db:push
```
Esto crea las tablas, las funciones RPC, las políticas RLS, los triggers, el cron de limpieza y el bucket `avatars`.

> ⚠️ `seed.sql` **no** se sube a producción: solo se usa en local.

---

## Paso 2: Edge Functions (Riot API)

```bash
npx supabase secrets set RIOT_API_KEY=RGAPI-xxxx HENRIK_API_KEY=HDEV-xxxx
npx supabase functions deploy riot-validate --no-verify-jwt
npx supabase functions deploy riot-link --no-verify-jwt
npx supabase functions deploy riot-refresh --no-verify-jwt
```
(`--no-verify-jwt` porque cada función valida la sesión por dentro; ya está así en `supabase/config.toml`).

---

## Paso 3: Auth

En **Dashboard → Authentication**:

### URL Configuration
| Campo | Valor |
|---|---|
| Site URL | `https://premadegg.vercel.app` |
| Redirect URLs | `https://premadegg.vercel.app/**` y `http://localhost:4200/**` |

### SMTP propio (obligatorio)
El SMTP por defecto de Supabase **solo envía emails a los miembros de tu equipo** del proyecto. Para que los usuarios reales reciban la recuperación de contraseña, configura Brevo (300 emails/día gratis):

**Authentication → Emails → SMTP Settings → Enable custom SMTP**

| Campo | Valor |
|---|---|
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | Tu login SMTP de Brevo |
| Password | Tu SMTP key de Brevo |
| Sender email | Un remitente verificado en Brevo |
| Sender name | `PremadeGG` |

En **Emails → Templates** pega el contenido de `supabase/templates/recovery.html` y `confirmation.html` (en español).

> Recomendado: activa **Confirm email** en *Providers → Email*. El registro ya lo soporta: el usuario
> confirma el email y termina de vincular su Riot ID en `/onboarding`.

### Login con Google
1. [Google Cloud Console](https://console.cloud.google.com/) → *APIs & Services → Credentials → Create OAuth client ID* (tipo *Web application*)
2. **Authorized redirect URI**: `https://<tu-ref>.supabase.co/auth/v1/callback`
3. Copia el Client ID y el Secret en **Supabase → Authentication → Providers → Google**

### Login con Discord
1. [Discord Developer Portal](https://discord.com/developers/applications) → *New Application → OAuth2*
2. **Redirects**: `https://<tu-ref>.supabase.co/auth/v1/callback`
3. Copia el Client ID y el Client Secret en **Supabase → Authentication → Providers → Discord**

Los usuarios que entran con Google/Discord pasan por `/onboarding` para vincular su Riot ID. Si su email coincide con una cuenta existente, Supabase las enlaza automáticamente.

---

## Paso 4: Migrar los datos de MongoDB (una sola vez)

Con los usuarios reales de la versión anterior:

```bash
cp scripts/.env.example scripts/.env
# rellena MONGO_URI (Atlas), SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
```

```bash
node --env-file=scripts/.env scripts/migrate-mongo-to-supabase.mjs --dry-run
```

Revisa el resumen y, si cuadra, lanza la migración real:

```bash
node --env-file=scripts/.env scripts/migrate-mongo-to-supabase.mjs
```

- Las contraseñas se migran con su hash bcrypt: **todos entran con su contraseña de siempre**.
- Es idempotente: si falla a medias, se puede relanzar sin duplicar datos.
- Los posts LFG ya caducados no se migran.
- Los avatares subidos a Render casi seguro se perdieron (disco efímero). Si `OLD_UPLOADS_URL` aún los sirve, se copian a Storage; si no, ese usuario pasa a mostrar su card de Riot.

Prueba a iniciar sesión con un usuario antiguo antes de apagar Atlas/Render.

---

## Paso 5: Vercel (Frontend Angular)

### 5a. Configurar Supabase en el frontend
Edita `client/src/environments/environment.prod.ts` con los valores de **Project Settings → API Keys**:

```typescript
export const environment = {
  production: true,
  supabaseUrl: 'https://<tu-ref>.supabase.co',
  supabaseKey: 'sb_publishable_xxx', // Publishable key: es pública por diseño (la protege RLS)
};
```

Haz commit y push.

### 5b. Deploy
1. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio
2. **Root Directory**: `client` (el resto lo lee de `client/vercel.json`)
3. **Deploy**

---

## Paso 6: Evitar la pausa por inactividad

Los proyectos gratuitos de Supabase **se pausan tras 7 días sin actividad**. El workflow
`.github/workflows/supabase-keepalive.yml` hace una consulta cada 3 días para evitarlo.

En GitHub → **Settings → Secrets and variables → Actions** crea:
| Secret | Valor |
|---|---|
| `SUPABASE_URL` | `https://<tu-ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | La publishable key |

---

## Paso 7: Apagar la infraestructura antigua

Cuando hayas verificado la migración:
1. Borra el servicio de Render
2. Haz un último export de Atlas (por si acaso) y elimina el cluster

---

## ⚠️ Límites del plan gratuito

| Servicio | Límite | Impacto |
|---|---|---|
| **Supabase DB** | 500 MB | Miles de usuarios; mensajes > 90 días y notificaciones > 30 días se borran solos |
| **Supabase Storage** | 1 GB | Avatares de 2 MB máximo |
| **Supabase Auth** | 50.000 usuarios activos/mes | Sobrado |
| **Supabase Realtime** | 200 conexiones simultáneas | Usuarios conectados a la vez |
| **Supabase** | Pausa tras 7 días sin uso | Lo evita el workflow de keepalive |
| **Vercel** | 100 GB de bandwidth/mes | Más que suficiente |

---

## Problemas comunes

### No llega el email de recuperación
→ Falta el SMTP propio (Paso 3) o el remitente no está verificado en Brevo.

### "Error al vincular Riot" / 502 en `riot-link`
→ La development key de Riot caduca cada 24 h. Renueva `RIOT_API_KEY` con `npx supabase secrets set`.

### El login con Google/Discord vuelve a la home sin sesión
→ Revisa que la URL de Vercel está en **Redirect URLs** y que el callback de Google/Discord es `https://<tu-ref>.supabase.co/auth/v1/callback`.

### El chat no se actualiza en tiempo real
→ Los canales son privados: el usuario debe tener sesión. Busca `CHANNEL_ERROR` en la consola del navegador y comprueba que las migraciones están aplicadas (incluyen las políticas de `realtime.messages`).
