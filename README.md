# PremadeGG - Valorant LFG Platform

**PremadeGG** es el proyecto final de grado diseñado para conectar jugadores de Valorant basándose no solo en su rango, sino en su reputación (Karma) y compatibilidad de roles.

## Visión del Proyecto
Una plataforma "Looking For Group" (LFG) que penaliza la toxicidad. Los usuarios con Karma < 3 son filtrados del matchmaking principal.

## Stack Tecnológico (MEAN)
- **MongoDB**: Base de datos NoSQL con Mongoose.
- **Express**: Framework backend con arquitectura MVC estricta.
- **Angular**: Frontend con Standalone Components y arquitectura SASS 7-1.
- **Node.js**: Entorno de ejecución.

## Estructura del Monorepo

### `/server` (Backend)
- **Arquitectura**: MVC (Model-View-Controller).
- **Tooling**: ESLint, Prettier, Nodemon.
- **Seguridad**: Validación de datos y logs condicionales (Morgan/Winston).

### `/client` (Frontend)
- **Framework**: Angular (Latest).
- **Estilos**: SASS con metodología BEM y arquitectura por capas (`_utilities`, `_global`, `_components`).
- **Diseño**: Modo oscuro, glassmorphism.

## Requisitos Previos
- [Docker](https://www.docker.com/products/docker-desktop/) instalado y en ejecución.
- [Node.js >= 18](https://nodejs.org/) (solo si quieres ejecutar scripts fuera de Docker).

## Cómo Arrancar (Docker)

### 1. Clonar y configurar variables de entorno
```bash
git clone <tu-repo-url>
cd premade-gg
cp .env.example .env
```

### 2. Levantar todos los servicios
```bash
docker-compose up --build
```
Esto arranca:
| Servicio       | URL                        | Descripción                   |
|----------------|----------------------------|-------------------------------|
| API            | http://localhost:4000       | Backend Express               |
| Mongo Express  | http://localhost:8082       | UI para inspeccionar MongoDB  |
| MongoDB        | localhost:27017             | Base de datos                 |

### 3. Poblar la base de datos (seed)
En otra terminal, ejecuta:
```bash
docker-compose exec api npm run seed
```
Esto genera 20 usuarios con rangos de Valorant y 50 reviews cruzadas.

### 4. Parar los servicios
```bash
docker-compose down
```
Para eliminar también los datos de MongoDB:
```bash
docker-compose down -v
```

### 5. Cuentas de Prueba por Defecto
El servidor inyecta automáticamente cuentas y datos (equipos, posts LFG) de prueba en la base de datos cada vez que arranca. Puedes probar la aplicación interactuando con los siguientes usuarios (todos tienen la contraseña **`password123`**):
- **Duelist**: `test1@premade.gg` (Dueño del "Test Team Alpha")
- **Controller**: `test2@premade.gg` (Dueño del "Test Team Beta")
- **Initiator**: `test3@premade.gg` (Autor de publicaciones LFG)

## Scripts Disponibles (Server)

| Script          | Comando                    | Descripción                          |
|-----------------|----------------------------|--------------------------------------|
| `npm run dev`   | `nodemon app.js`           | Desarrollo con hot-reload            |
| `npm start`     | `node app.js`              | Producción                           |
| `npm run seed`  | `node seed.js`             | Poblar la BBDD con datos de prueba   |
| `npm run lint`  | `eslint .`                 | Ejecutar linter                      |

## Reglas de Desarrollo (Rúbricas)
Este proyecto sigue rúbricas académicas estrictas:
1. **Sin "divitis"**: HTML semántico obligatorio.
2. **SASS Modular**: Uso exclusivo de `@use` y `@forward`.
3. **Clean Code**: Zero warnings en linter.
