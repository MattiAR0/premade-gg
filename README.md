# PremadeGG - Valorant LFG Platform

**PremadeGG** es el proyecto final de grado diseñado para conectar jugadores de Valorant basándose no solo en su rango, sino en su reputación (Karma) y compatibilidad de roles.

## Visión del Proyecto
Una plataforma "Looking For Group" (LFG) que penaliza la toxicidad. Los usuarios con Karma < 3 son filtrados del matchmaking principal.

## 🎬 Video Explicativo
[![Ver Video](https://img.shields.io/badge/Ver%20Video%20Explicativo-Google%20Drive-blue?style=for-the-badge&logo=googledrive)](https://drive.google.com/file/d/1ghoKyXdTBNtKZwR7niyRDcn0XRcBcAn9/view?usp=sharing)

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

## Endpoints de la API

### Autenticación (`/api/auth`)
| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| POST | `/api/auth/register` | — | Registrar nuevo usuario |
| POST | `/api/auth/login` | — | Iniciar sesión (devuelve JWT) |
| GET | `/api/auth/me` | 🔒 | Obtener usuario autenticado |
| PUT | `/api/auth/profile` | 🔒 | Actualizar perfil propio |
| POST | `/api/auth/forgot-password` | — | Solicitar restablecimiento de contraseña |
| POST | `/api/auth/reset-password` | — | Restablecer contraseña con token |

### Usuarios (`/api/users`)
| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| GET | `/api/users` | — | Listar usuarios (paginado con cursor) |
| GET | `/api/users/search?q=...` | — | Buscar usuarios por Riot ID |
| GET | `/api/users/:id` | — | Obtener usuario por ID |
| GET | `/api/users/:id/karma` | — | Recalcular karma de un usuario |
| POST | `/api/users` | 🔒 | Crear usuario (valida Riot ID) |
| PUT | `/api/users/:id` | 🔒 | Actualizar usuario |
| DELETE | `/api/users/:id` | 🔒 | Eliminar usuario y datos asociados |

### LFG Posts (`/api/lfg`)
| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| GET | `/api/lfg` | — | Listar posts LFG (paginado) |
| GET | `/api/lfg/:id` | — | Obtener post por ID |
| POST | `/api/lfg` | 🔒 | Crear post LFG |
| PUT | `/api/lfg/:id` | 🔒 | Actualizar post |
| DELETE | `/api/lfg/:id` | 🔒 | Eliminar post |
| POST | `/api/lfg/:id/join` | 🔒 | Solicitar unirse a un post |
| PUT | `/api/lfg/:id/members/:userId` | 🔒 | Aceptar/rechazar solicitud |
| DELETE | `/api/lfg/:id/members/:userId` | 🔒 | Abandonar/expulsar de un post |

### Equipos (`/api/teams`)
| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| GET | `/api/teams` | — | Listar equipos |
| GET | `/api/teams/:id` | — | Obtener equipo por ID |
| POST | `/api/teams` | 🔒 | Crear equipo |
| PUT | `/api/teams/:id` | 🔒 | Actualizar equipo |
| DELETE | `/api/teams/:id` | 🔒 | Eliminar equipo (cascada) |
| PUT | `/api/teams/:id/coach` | 🔒 | Asignar coach |
| POST | `/api/teams/:id/players` | 🔒 | Añadir jugador |
| DELETE | `/api/teams/:id/players/:userId` | 🔒 | Eliminar jugador |
| POST | `/api/teams/:id/staff` | 🔒 | Añadir staff |
| DELETE | `/api/teams/:id/staff/:userId` | 🔒 | Eliminar staff |
| POST | `/api/teams/:id/requests` | 🔒 | Solicitar unirse al equipo |
| PUT | `/api/teams/:id/requests/:userId` | 🔒 | Aceptar/rechazar solicitud |

### Reviews (`/api/reviews`)
| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| GET | `/api/reviews` | — | Listar reviews |
| GET | `/api/reviews/eligibility/:targetId` | 🔒 | Verificar si puedes dejar review |
| GET | `/api/reviews/:id` | — | Obtener review por ID |
| POST | `/api/reviews` | 🔒 | Crear review |
| DELETE | `/api/reviews/:id` | 🔒 | Eliminar review propia |

### Notificaciones (`/api/notifications`)
| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| GET | `/api/notifications` | 🔒 | Listar notificaciones |
| GET | `/api/notifications/unread-count` | 🔒 | Obtener nº de no leídas |
| PUT | `/api/notifications/read-all` | 🔒 | Marcar todas como leídas |
| PUT | `/api/notifications/:id/read` | 🔒 | Marcar una como leída |
| DELETE | `/api/notifications/:id` | 🔒 | Eliminar notificación |

### Mensajes (`/api/messages`)
| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| GET | `/api/messages/conversations` | 🔒 | Listar conversaciones |
| POST | `/api/messages/conversations/direct` | 🔒 | Crear/obtener chat directo |
| POST | `/api/messages/conversations/group` | 🔒 | Crear conversación grupal |
| GET | `/api/messages/conversations/:id/messages` | 🔒 | Obtener mensajes de conversación |
| POST | `/api/messages/conversations/:id/messages` | 🔒 | Enviar mensaje |
| PUT | `/api/messages/conversations/:id/read` | 🔒 | Marcar conversación como leída |
| GET | `/api/messages/unread-count` | 🔒 | Obtener total de mensajes no leídos |

### Riot API (`/api/riot`)
| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| GET | `/api/riot/validate/:gameName/:tagLine` | — | Validar cuenta de Riot |
| GET | `/api/riot/rank/:region/:gameName/:tagLine` | — | Obtener rango real del jugador |

### Upload (`/api/upload`)
| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| POST | `/api/upload/avatar` | 🔒 | Subir imagen de avatar |

> 🔒 = Requiere token JWT en header `Authorization: Bearer <token>`

## Reglas de Desarrollo (Rúbricas)
Este proyecto sigue rúbricas académicas estrictas:
1. **Sin "divitis"**: HTML semántico obligatorio.
2. **SASS Modular**: Uso exclusivo de `@use` y `@forward`.
3. **Clean Code**: Zero warnings en linter.
