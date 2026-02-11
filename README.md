# PremadeGG - Valorant LFG Platform

**PremadeGG** es el proyecto final de grado diseñado para conectar jugadores de Valorant basándose no solo en su rango, sino en su reputación (Karma) y compatibilidad de roles.

## 🚀 Visión del Proyecto
Una plataforma "Looking For Group" (LFG) que penaliza la toxicidad. Los usuarios con Karma < 3 son filtrados del matchmaking principal.

## 🛠️ Stack Tecnológico (MEAN)
- **MongoDB**: Base de datos NoSQL con Mongoose.
- **Express**: Framework backend con arquitectura MVC estricta.
- **Angular**: Frontend con Standalone Components y arquitectura SASS 7-1.
- **Node.js**: Entorno de ejecución.

## 📂 Estructura del Monorepo

### `/server` (Backend)
- **Arquitectura**: MVC (Model-View-Controller).
- **Tooling**: ESLint, Prettier, Nodemon.
- **Seguridad**: Validación de datos y logs condicionales (Morgan/Winston).

### `/client` (Frontend)
- **Framework**: Angular (Latest).
- **Estilos**: SASS con metodología BEM y arquitectura por capas (`_utilities`, `_global`, `_components`).
- **Diseño**: "Final Boss" aesthetics, modo oscuro, glassmorphism.

## 📜 Reglas de Desarrollo (Rúbricas)
Este proyecto sigue rúbricas académicas estrictas:
1. **Sin "divitis"**: HTML semántico obligatorio.
2. **SASS Modular**: Uso exclusivo de `@use` y `@forward`.
3. **Clean Code**: Zero warnings en linter.
