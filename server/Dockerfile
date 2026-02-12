# ── PremadeGG API ──────────────────────────────────────
# Imagen base ligera
FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# 1. Copiar solo los manifiestos de dependencias primero
#    (aprovecha la cache de Docker: si no cambian, no reinstala)
COPY package*.json ./

# 2. Instalar dependencias
RUN npm install

# 3. Instalar nodemon globalmente para que siempre esté en PATH
#    (el volumen anónimo de docker-compose puede sobreescribir node_modules)
RUN npm install -g nodemon

# 4. Copiar el resto del código fuente
COPY . .

# Puerto que expone la API
EXPOSE 4000

# Comando por defecto: arrancar con nodemon (hot-reload en desarrollo)
CMD ["nodemon", "app.js"]
