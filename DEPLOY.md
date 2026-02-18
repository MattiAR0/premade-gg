# 🚀 Guía de Deploy Gratuito - PremadeGG

Despliega PremadeGG en la nube de forma **100% gratuita** usando:
- **MongoDB Atlas** → Base de datos
- **Render.com** → Backend (Node.js + Socket.IO)
- **Vercel** → Frontend (Angular)

---

## Requisito previo: Subir a GitHub

1. Crea un repositorio en [github.com/new](https://github.com/new)
2. Sube el código:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/premade-gg.git
git push -u origin main
```

> ⚠️ **IMPORTANTE**: Asegúrate de que `.env` está en `.gitignore` (ya lo está). Nunca subas credenciales.

---

## Paso 1: MongoDB Atlas (Base de datos)

1. Ve a [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas/register) y crea una cuenta
2. Crea un cluster **gratuito M0** (elige la región más cercana)
3. En **Database Access** → Crea un usuario con contraseña
4. En **Network Access** → Añade `0.0.0.0/0` (permite conexión desde cualquier IP)
5. En **Database** → Click en **Connect** → **Drivers** → Copia la URI

Tu URI será algo como:
```
mongodb+srv://tu-usuario:tu-password@cluster0.xxxxx.mongodb.net/premade-gg?retryWrites=true&w=majority
```

---

## Paso 2: Render.com (Backend API)

1. Ve a [render.com](https://render.com) y crea una cuenta (conecta con GitHub)
2. Click en **New** → **Web Service**
3. Conecta tu repositorio de GitHub
4. Configura:
   - **Name**: `premadegg-api`
   - **Region**: Frankfurt (o la más cercana)
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. En **Environment Variables**, añade:

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `MONGO_URI` | `mongodb+srv://...` (la URI de Atlas del paso 1) |
| `JWT_SECRET` | Un string aleatorio largo (genera uno en random.org) |
| `RIOT_API_KEY` | Tu clave de Riot Games |
| `HENRIK_API_KEY` | Tu clave de HenrikDev |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | Tu email de Gmail |
| `SMTP_PASS` | Tu contraseña de aplicación de Gmail |
| `SMTP_FROM` | `PremadeGG <tu-email@gmail.com>` |
| `CLIENT_URL` | `https://premadegg.vercel.app` (se actualiza en el paso 3) |

6. Click en **Create Web Service** → Espera a que haga build y deploy (~3 min)
7. Render te dará una URL tipo: `https://premadegg-api.onrender.com`

### Hacer el seed de datos iniciales

Desde la pestaña **Shell** en Render (o conectando via SSH):
```bash
npm run seed
```

---

## Paso 3: Vercel (Frontend Angular)

### 3a. Actualizar la URL del backend

Antes de hacer deploy, edita `client/src/environments/environment.prod.ts` con la URL real de Render:

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://premadegg-api.onrender.com/api',   // ← Tu URL de Render
  socketUrl: 'https://premadegg-api.onrender.com',     // ← Tu URL de Render
};
```

Haz commit y push de estos cambios.

### 3b. Deploy en Vercel

1. Ve a [vercel.com](https://vercel.com) y crea una cuenta (conecta con GitHub)
2. Click en **Add New** → **Project**
3. Importa tu repositorio de GitHub
4. Configura:
   - **Root Directory**: `client`
   - **Framework Preset**: Angular (se detecta automáticamente)
   - **Build Command**: `npm run build -- --configuration=production`
   - **Output Directory**: `dist/premadegg/browser`
5. Click en **Deploy** → Espera ~2 min

Vercel te dará una URL tipo: `https://premadegg.vercel.app`

### 3c. Actualizar CLIENT_URL en Render

Vuelve al dashboard de Render y actualiza la variable:
- `CLIENT_URL` = `https://premadegg.vercel.app` (la URL que te dio Vercel)

---

## Paso 4: Verificar que todo funciona

1. Abre `https://premadegg.vercel.app` en tu navegador
2. Verifica que la página carga correctamente
3. Registra una cuenta nueva
4. Prueba las funcionalidades: LFG, equipos, mensajes, etc.

### Comparte con tus amigos 🎮

Simplemente envía el enlace de Vercel:
```
https://premadegg.vercel.app
```

Cualquier persona con ese enlace puede acceder desde cualquier lugar del mundo.

---

## ⚠️ Limitaciones del tier gratuito

| Servicio | Limitación | Impacto |
|---|---|---|
| **Render Free** | Se duerme tras 15 min de inactividad | Primera carga tarda ~30s (cold start) |
| **Render Free** | 750 horas/mes | Suficiente para 1 servicio 24/7 |
| **MongoDB Atlas M0** | 512 MB de almacenamiento | Suficiente para miles de usuarios |
| **Vercel Free** | 100 GB de bandwidth/mes | Más que suficiente |

### Solucionar el cold start de Render

El backend se duerme si nadie lo usa durante 15 minutos. Para reducir el impacto:
- Puedes usar un servicio como [UptimeRobot](https://uptimerobot.com/) (gratis) para hacer ping a tu API cada 14 minutos
- Configura un monitor HTTP que haga GET a `https://premadegg-api.onrender.com/`

---

## Problemas comunes

### "CORS error" en la consola del navegador
→ Verifica que `CLIENT_URL` en Render coincide exactamente con la URL de Vercel (sin `/` al final)

### "MongoDB connection error"
→ Verifica que añadiste `0.0.0.0/0` en Network Access de Atlas y que la URI es correcta

### La app carga pero no hay datos
→ Ejecuta `npm run seed` en la shell de Render

### Las imágenes de avatares no cargan
→ Los uploads locales no persisten en Render Free (el disco es efímero). Considera usar Cloudinary (tiene tier gratuito) para almacenar imágenes. Esto requiría un cambio adicional en el código.
