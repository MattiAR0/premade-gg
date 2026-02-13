# ── PremadeGG Client (Angular) ─────────────────────────
# Multi-stage build: compila Angular y sirve con nginx.
# Resultado: imagen ligera (~30MB) que sirve archivos estáticos.

# ── Stage 1: Build ─────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Instalar dependencias (cacheadas si package*.json no cambian)
COPY package*.json ./
RUN npm ci

# Copiar código fuente y compilar
COPY . .
RUN npm run build -- --configuration=production

# ── Stage 2: Serve ─────────────────────────────────────
FROM nginx:alpine

# Copiar config de nginx personalizada
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar build de Angular al directorio de nginx
COPY --from=build /app/dist/premadegg/browser /usr/share/nginx/html

EXPOSE 4200

CMD ["nginx", "-g", "daemon off;"]
