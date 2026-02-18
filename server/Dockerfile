# ── PremadeGG API ──────────────────────────────────────
# Imagen base ligera
FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# 1. Copiar solo los manifiestos de dependencias primero
#    (aprovecha la cache de Docker: si no cambian, no reinstala)
COPY package*.json ./

# 2. Instalar dependencias (producción o todas según NODE_ENV)
ARG NODE_ENV=development
RUN if [ "$NODE_ENV" = "production" ]; then \
      npm ci --omit=dev; \
    else \
      npm install && npm install -g nodemon; \
    fi

# 3. Copiar el resto del código fuente
COPY . .

# Puerto que expone la API
EXPOSE 4000

# Comando por defecto: node en producción, nodemon en desarrollo
CMD if [ "$NODE_ENV" = "production" ]; then node app.js; else nodemon app.js; fi
