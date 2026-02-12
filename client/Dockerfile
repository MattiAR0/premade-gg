# ── PremadeGG Client (Angular) ─────────────────────────
FROM node:20-alpine

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar código fuente
COPY . .

# Puerto de Angular dev server
EXPOSE 4200

# Arrancar con poll para hot-reload en Docker (Windows bind-mount)
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--poll", "2000"]
