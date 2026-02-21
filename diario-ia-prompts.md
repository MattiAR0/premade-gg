# Diario de la IA — Evolución y Arquitectura de preMadeGG

## Fase 1: Arquitectura Base y Configuración Inicial


**Prompts del desarrollador:**
* "Actúa como un Tech Lead experto en el stack MEAN y ayúdame a crear la estructura base del monorepo."
* "No tengo MongoDB instalado, ¿cómo lo podría instalar en local y por qué recomiendas MongoDB y no una BBDD SQL para este proyecto?"
* "Me gustaría que haya usuarios, equipos y posts de prueba por defecto en la aplicación, tanto para el sistema en local con Docker como en la nube."

**Acciones y Soluciones:**
* **Monorepo:** Creación de la estructura base (`client/` y `server/`) con configuraciones estrictas de linters y scripts npm unificados.
* **Backend:** Configuración de Express, Morgan para logging y Mongoose para modelado de datos.
* **Frontend:** Inicialización de Angular con componentes standalone y arquitectura SCSS escalable (variables, resets, mixins).
* **Seeding Automático:** Implementación de `seedDefaults.js` ejecutado en el arranque de la app (`app.js`) para inyectar datos falsos con `@faker-js/faker` de forma segura (usando `findOne` para evitar duplicados).
* **Documentación:** Redacción de `INSTRUCTIONS.md` detallando el despliegue local y la justificación de usar NoSQL por su naturaleza JSON fluida.

**Resultados:**
Un entorno base sólido, documentado y funcional, capaz de auto-poblarse con datos de prueba tanto en local (Docker) como en producción.

---

## Fase 2: Integración de APIs Externas y Autenticación

**Prompts del desarrollador:**
* "Empieza con el plan de implementación para integrar la API de Riot y validar los rangos."
* "Tengo un problema: cuando despliego la app en Render, el sistema de correos no funciona. Me da `SMTP connection failed: Connection timeout`."
* "Quiero que los correos se puedan enviar a cualquier dirección, no solo a la mía, pero no puedo comprar dominios."

**Acciones y Soluciones:**
* **Servicio Riot:** Creación de `riotService.js` como proxy hacia `account-v1` y HenrikDev MMR, ocultando las API keys en el backend.
* **Validación de Usuarios:** Actualización del registro para validar el Riot ID en tiempo real y extraer `puuid`, rango real, avatar, nivel y región.
* **Migración de Correo:** Se detectó que la capa gratuita de Render bloquea puertos SMTP (587, 465). Se eliminó `nodemailer` y se implementó el SDK oficial de Brevo (`@getbrevo/brevo`) para realizar envíos transaccionales seguros vía HTTP (puerto 443), evitando la necesidad de un dominio propio.

**Resultados:**
Validación estricta de cuentas de Riot en el registro y un sistema de recuperación de contraseñas 100% funcional en producción saltando las restricciones del hosting.

---

## Fase 3: Core del Sistema (LFG, Equipos, Perfiles y Reseñas)

**Prompts del desarrollador:**
* "Me faltaría la opción de agregar una reseña a un jugador o dar su respectivo karma, no sé si se puede comprobar de alguna manera que hayan jugado juntos antes."
* "Cuando se hace F5 se cierra la sesión, ¿se puede hacer algo tipo sessions o cookies para guardar la sesión de manera segura y no tener que loguearme todo el rato?"
* "Falta que el usuario logueado pueda crear posts de LFG y seleccionar gente que ya está en su grupo. Además, que los posts expiren a las 24 horas."

**Acciones y Soluciones:**
* **Sistema LFG:** Eliminación de horarios manuales en favor de un TTL de MongoDB de 24h. División de la UI en pestañas según el tamaño del equipo.
* **Picker de Miembros:** Inclusión de un buscador modal al crear LFG para invitar a miembros de tu grupo actual.
* **Sistema de Reviews:** Lógica cruzada para habilitar reseñas solo si existe historial de juego (campo `playedTogether`). Recálculo dinámico de karma y diseño de medallas de "jugador verificado".
* **Persistencia de Sesión:** Modificación del `authGuard` y uso de `APP_INITIALIZER` en Angular para bloquear el renderizado inicial hasta que la promesa del `AuthService` confirme la validez de la sesión, eliminando el parpadeo de la UI.

**Resultados:**
Flujos de usuario complejos (matching, reputación y gestión de perfiles) operando de forma intuitiva, con sesiones estables tras recargar la página.

---

## Fase 4: Comunicación y Notificaciones

**Prompts del desarrollador:**
* "Me gustaría agregar un sistema de notificaciones, esto serviría para cuando piden unirse a tu grupo que salte la campana."
* "Me gustaría que agregues chats grupales en la parte de mensajes, pudiendo buscar desde ahí a jugadores para añadirlos."
* "La función de aceptar a alguien en el equipo no funciona, y al borrar el equipo me gustaría que la notificación sea un modal de la web y no un alert cutre del navegador."

**Acciones y Soluciones:**
* **Backend Notificaciones:** Nuevo modelo Mongoose con expiración de 30 días, enlazado a controladores que disparan alertas automáticamente ante solicitudes, aceptaciones o expulsiones.
* **Frontend Reactivo:** Servicio de polling con Signals en Angular, sumado a una campana de notificaciones con panel desplegable.
* **Chats de Equipo:** Expansión del esquema `Conversation.js` para soportar metadatos de grupo (admin, imagen, teamId). Creación automática de salas al formar equipos.
* **Fixes y UI:** Corrección del populate en el endpoint de equipos que impedía aceptar miembros, y creación de un modal rojo preventivo personalizado para el borrado de equipos.

**Resultados:**
Una experiencia de comunicación integral, separando DMs de canales de equipo, todo respaldado por notificaciones en tiempo real.

---

## Fase 5: Rediseño, UI/UX y Estética

**Prompts del desarrollador:**
* "Puedes cambiar la estética de la app. No me gusta que sea tan colorida, prefiero una estética más seria pero que mantenga el rollo gamer."
* "Siento que en las pestañas de jugadores y LFG hay mucho espacio sin usar."
* "Dale un toque más de red social o de feed. El efecto de hover es un poco exagerado y no me gusta la distribución."

**Acciones y Soluciones:**
* **Design Tokens:** Redefinición de `_variables.scss` hacia tonos neutros oscuros (estética "Dark Esports"), con un único rojo refinado (`#dc3545`) como acento principal.
* **Efectos Suavizados:** Eliminación de transformaciones agresivas (saltos en el eje Y) en favor de transiciones sutiles de borde y brillo (`filter: brightness`).
* **Layout tipo Feed:** Transición de grids multi-columna a un diseño `l-grid--feed` de columna única centrada (720px), emulando el comportamiento de un timeline.
* **Mejora UX en Perfil:** Auto-scroll y cambio de estado visual (botón verde de confirmación) al guardar ajustes del perfil.

**Resultados:**
Una interfaz pulida y profesional que retiene la identidad "gamer" mientras ofrece la usabilidad de una red social moderna.

---

## Fase 6: Optimización, Docker y Resolución de Bugs

**Prompts del desarrollador:**
* "Tengo un problema raro: tengo que cambiar de pestaña y volver a entrar para que carguen los jugadores."
* "Sigue tardando mucho en cargar los posts en LFG Board. ¿Algún tipo de lazy loading o infinite scroll podría ayudar?"
* "Me da error el `docker build` en el client: `npm error code EAI_AGAIN`. Pero yo quería que estuviera todo en Docker para facilitar la ejecución en PCs nuevos."

**Acciones y Soluciones:**
* **Fix Angular Zoneless:** Se inyectó `ChangeDetectorRef.markForCheck()` en los callbacks asíncronos (HTTP y Observadores) para forzar el ciclo de renderizado, resolviendo el bug de tener que "cambiar de pestaña" para ver datos.
* **Scroll Infinito y Skeletons:** Implementación de `IntersectionObserver` paginando de 3 en 3 elementos. Agregado de tarjetas *skeleton* con animaciones y aparición escalonada para dar sensación de rapidez.
* **Optimización DB:** Inclusión de índices en MongoDB y uso de consultas `.lean()` para mejorar tiempos de respuesta.
* **Resolución de Red Docker:** Diagnóstico de fallos DNS en el daemon local. Refactorización del Dockerfile del frontend para compilar en el host y servir los estáticos mediante una imagen ligera de Nginx como workaround funcional.
* **Limpieza de Código:** Ejecución de Prettier y ESLint en el backend, dejando el código a 0 errores y 0 warnings.

**Resultados:**
Una aplicación optimizada, con tiempos de respuesta ágiles, animaciones fluidas, código limpio y contenedores estables listos para defender el proyecto.

---

## Reflexión Técnica: Errores de la IA, Refactorizaciones y Decisiones del Desarrollador

### Errores que cometió la IA

1. **Interfaz demasiado colorida y exagerada.** La IA generó una primera versión de la UI con colores vibrantes, transformaciones agresivas en hover (saltos en el eje Y) y gradientes llamativos que no encajaban con la identidad "esports" del proyecto. El resultado era visualmente recargado y poco profesional. Tuve que pedir explícitamente un rediseño hacia una estética más seria y oscura, guiando yo la dirección de diseño.

2. **Problemas con el renderizado en Angular (Zoneless).** La IA no tuvo en cuenta que al usar callbacks asíncronos (HTTP, observadores) Angular no detectaba los cambios automáticamente. La pantalla de jugadores y LFG no se actualizaba hasta que cambiabas de pestaña y volvías. Tras reportar el bug, la solución fue inyectar `ChangeDetectorRef.markForCheck()`, pero yo tuve que identificar y describir el comportamiento erróneo para que se pudiera diagnosticar.

3. **Sistema de correo con Nodemailer fallaba en producción.** La IA configuró inicialmente `nodemailer` con SMTP directo, que funcionaba en local pero fallaba en Render (la capa gratuita bloquea los puertos SMTP 587 y 465). El error `SMTP connection failed: Connection timeout` obligó a migrar completamente el servicio a la API HTTP de Brevo. La IA no previó esta limitación del hosting.

4. **Dockerfile del frontend no compilaba en Docker.** La IA generó un Dockerfile que ejecutaba `npm install` y `ng build` dentro del contenedor, pero fallaba con `npm error code EAI_AGAIN` por problemas DNS del daemon de Docker en local. La solución final fue compilar en el host y servir los estáticos con Nginx, un workaround que yo validé como funcional.

### Código de la IA que tuve que refactorizar

1. **Estilos de hover y efectos visuales.** Las tarjetas de jugadores tenían un `transform: translateY(-8px)` en hover que era visualmente agresivo. Lo sustituí por transiciones sutiles de `border-color` y `filter: brightness()`, mucho más elegantes y coherentes con la estética "Dark Esports" que yo buscaba.

2. **Layout de grids multi-columna.** La IA propuso inicialmente grids de 3-4 columnas para las secciones de jugadores y LFG, pero dejaban mucho espacio vacío y no daban sensación de red social. Pedí cambiar a un diseño tipo "feed" de columna única centrada (720px), similar a un timeline, que mejoró enormemente la experiencia de usuario.

3. **Navbar con espaciado excesivo.** La barra de navegación que generó la IA tenía demasiado espacio entre la marca y los enlaces, y el avatar de perfil era demasiado pequeño. Tuve que ajustar manualmente los estilos para que el layout fuera compacto y el avatar fuera visible a primera vista.

### Decisiones arquitectónicas que tomé yo frente a las sugerencias de la IA

1. **MongoDB en vez de SQL.** La IA me presentó ambas opciones y yo decidí MongoDB porque los datos de jugadores (agentes favoritos, disponibilidad por día, enlaces sociales) son documentos JSON naturales que encajan mejor en un esquema flexible de NoSQL que en tablas SQL rígidas.

2. **TTL de 24 horas en posts LFG en vez de horarios manuales.** La IA inicialmente planteó un sistema donde el usuario introducía horarios de inicio y fin para los posts. Yo propuse eliminar eso y usar un TTL de MongoDB de 24 horas: el post se publica, dura un día, y caduca automáticamente. Esto simplificó tanto el backend como la UI.

3. **Migración de Nodemailer a Brevo SDK (decisión forzada por Render).** Ante la limitación de SMTP en Render, yo investigué alternativas y decidí usar la API HTTP de Brevo (`@getbrevo/brevo`) porque permite enviar correos a cualquier dirección sin necesidad de un dominio propio y sin depender de puertos SMTP.

4. **Diseño visual "Dark Esports" frente al propuesto por la IA.** La IA propuso paletas coloridas y llamativas. Yo decidí que la identidad del proyecto debía ser oscura, profesional y mínima, con un único color de acento rojo (`#dc3545`) y tonos neutros. Esta dirección artística fue 100% mía y la mantuve a lo largo de todas las fases del proyecto.

5. **Polling con Signals en vez de WebSockets para notificaciones.** Aunque el proyecto ya usa Socket.IO para los chats, yo decidí que las notificaciones usaran un sistema de polling con Angular Signals por simplicidad y para evitar complejidad innecesaria en un componente que no requiere latencia en tiempo real estricta.