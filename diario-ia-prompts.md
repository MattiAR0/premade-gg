# Diario de la IA — Prompts y Cambios

## 1. Solicitud inicial

**Prompt:**
> Me gustaria agregar un sistema de notificaciones, este serviria para cuando piden unirse a tu grupo que salte las notificaciones

**Acciones:**
- Analicé el backend y frontend para entender la arquitectura y puntos de integración.
- Planifiqué los pasos en una lista de TODOs.

---

## 2. Implementación Backend

- **Modelo Notification.js**: Mongoose schema con recipient, sender, type, lfgPost, message, read, expiresAt (TTL 30 días).
- **Controller notificationController.js**: Endpoints para listar, contar, marcar como leídas, eliminar notificaciones.
- **Rutas notificationRoutes.js**: Todas protegidas con requireAuth.
- **Integración en lfgPostController.js**: Se crean notificaciones automáticamente al pedir unirse, aceptar/rechazar solicitud, expulsar miembro.
- **Registro en app.js**: Se añade la ruta /api/notifications.

---

## 3. Implementación Frontend

- **Modelo notification.model.ts**: Interfaz AppNotification.
- **API methods en api.service.ts**: Métodos para consumir el backend de notificaciones.
- **NotificationService**: Servicio Angular reactivo con signals y polling.
- **NotificationBellComponent**: Campana con badge, panel desplegable, iconos por tipo, enlaces a grupos.
- **Integración en Navbar**: Se añade la campana junto al avatar.
- **Estilos SCSS**: Animación pulse, panel, badge, estados leído/no-leído.

---

## 4. Pruebas y Build

- Se corrigieron detalles de ESLint en el modelo.
- Se reconstruyeron los contenedores Docker para reflejar los cambios.
- Se verificó el registro de la ruta /api/notifications y la carga del modelo.

---

## 5. Resumen Final

Sistema de notificaciones funcional para solicitudes de grupo, integrado en backend y frontend, con UI moderna y polling reactivo.

---

## 6. Chat sobre reviews, karma y persistencia de sesión (feb 2026)

**Prompts clave:**
- "Me faltaría la opción de agregar una reseña a un jugador o dar su respectivo karma, no sé si puede comprobar de alguna manera que hayan jugado juntos antes"
- "Cuando se hace F5 se cierra la sesión, ¿se puede hacer algo tipo sessions o cookies para guardar la sesión de una manera segura y no tenga que iniciar sesión cada vez que se hace F5?"

**Acciones:**
- Analicé el sistema de reviews y reputación existente (modelos, controladores, rutas, frontend).
- Añadí campo `playedTogether` a las reviews y lógica para marcar como verificada si ambos usuarios coincidieron en LFG o equipo.
- Nuevo endpoint `/api/reviews/eligibility/:targetId` para que el frontend sepa si puede dejar review y si hay verificación.
- Mejoré el formulario de review en el perfil: estrellas, comentario, badge "verificado", borrado de review propia.
- Detecté y solucioné el problema de pérdida de sesión tras F5:
  - Añadí un signal y una Promise en `AuthService` para saber cuándo se restauró la sesión.
  - Modifiqué el `authGuard` para esperar a la restauración antes de decidir si redirigir.
  - Finalmente, usé `APP_INITIALIZER` para bloquear el arranque de Angular hasta que la sesión esté restaurada, evitando flicker y race conditions.
- Se forzó rebuild de Docker sin cache para asegurar que los cambios se reflejen en producción.

**Resultado:**
- El sistema de reviews ahora permite dejar reseñas solo si no existe una previa, muestra si jugaron juntos, y recalcula el karma.
- La sesión de usuario persiste correctamente tras F5, sin redirecciones erróneas ni pérdida de estado.

7. Chat sobre creación de LFG, equipos, selección de miembros y fixes de build (feb 2026)
Prompts clave:

"falta que el usuario cuando este con la sesion iniciada pueda crear posts de LFG y que el usuario pueda crear equipo"
"cuando creas un post que puedas seleccionar gente que ya esta contigo en el grupo y me gustaria que los grupos no tengan un horario porque serian posts temporales de 24 horas como mucho"
"tengo una serie de fallos en el tsconfig.json y no se porque, puedes decirme el porque y arreglarlo"
"Application bundle generation failed. ... exceeded maximum budget ..."
Acciones:

Se implementó la creación de posts de LFG y equipos solo para usuarios autenticados (backend y frontend, modales, integración completa).
Se añadió picker de miembros al crear LFG, con búsqueda de usuarios del grupo y chips UI.
Se eliminó el campo de horario en LFG, usando expiración automática a las 24h (TTL en MongoDB).
Se creó endpoint de búsqueda de usuarios en el backend y se integró en el modal de LFG.
Se ajustó el modelo y controlador de LFG para soportar miembros iniciales y expiración.
Se aumentó el presupuesto de estilos SCSS en angular.json para evitar errores de build por tamaño.
Se limpiaron todos los warnings de templates Angular (opcional chaining, imports, etc) para builds limpios.
Se verificó el build de producción y se corrigieron todos los errores y advertencias.
Resultado:

El usuario puede crear posts de LFG y equipos desde la UI, seleccionar miembros del grupo, y los posts expiran automáticamente a las 24h.
El build de producción es exitoso, sin errores ni advertencias, y la base de código está limpia y mantenible.

---

## 8. Chat sobre perfiles/login + rediseño de LFG (feb 2026)

**Prompts clave:**
- "tengo un problema, tengo que salir y volver a entrear al mismo jugador para que me cargue su perfil"
- "con que usuario puedo iniciar sesion"
- "En los apartados de LFG me gustaria que haya division entre gente que busca duo, trio o 5stack... que salga cuanta gente se ha unido... ver perfiles... y que la publicacion solo muestre el rango y la region y un titulo"

**Acciones:**
- Se corrigió un problema de render/estado en Angular zoneless agregando `ChangeDetectorRef.markForCheck()` en componentes que dependían de HTTP/async (perfil, login, registro, edición de perfil).
- Se re-seedeó la base de datos y se listaron usuarios para login (todos con contraseña `password123`).
- Se rediseñó el sistema LFG para soportar **Duo/Trio/5-Stack**:
  - Backend: nuevo `teamSize` y `members[]` con estados `pending/accepted`, endpoints para solicitar unirse, aceptar/rechazar, expulsar/abandonar, y filtros por `teamSize`.
  - Frontend: tabs en `/lfg`, cards simplificadas (título + rango + región + miembros + horario), y nueva página `/lfg/:id` con detalle completo y panel de gestión para el creador.
- Se actualizó el seed para crear posts LFG con miembros aceptados y pendientes.
- Se ajustó el Docker build del client para evitar fallos de red eliminando el paso de `npm install -g npm@...` (innecesario) y se reconstruyó/redeployó.

**Resultado:**
- Los perfiles cargan sin necesidad de “salir y volver a entrar”.
- Login funcional con usuarios seed.
- LFG ahora está dividido por tamaño de equipo, muestra miembros y permite solicitudes/gestión con vistas y rutas nuevas.

---

## 9. Chat sobre integración Riot API, rendimiento y Docker (feb 2026)

**Prompts clave:**
- "Empieza con el plan de implementación" (`.cursor/plans/integrar_riot_api_61efb79e.plan.md`).
- "La aplicación tarda bastante en cargar que ideas propones para solucionar este problema".
- "sigue tardando mucho en cargar jugadores".

**Acciones:**
- Implementé el plan de integración de Riot/HenrikDev:
  - Servicio `riotService.js` (proxy a Riot account-v1 y HenrikDev MMR con `axios`).
  - Controlador y rutas `/api/riot/...` y actualización de `createUser` para validar Riot ID y obtener rango real, avatar, nivel, región y `puuid`.
  - Nuevos campos en `User` (backend y frontend) y actualización de `player-card` para mostrar avatar, región y nivel.
  - Nuevas variables de entorno (`RIOT_API_KEY`, `HENRIK_API_KEY`) y wiring en Docker.
- Optimicé rendimiento de carga:
  - Lazy loading de rutas Angular con `loadComponent`.
  - Paginación en `/api/users` y `/api/lfg` y adaptación de `players` y `lfg-board` para consumir `{ data, total, page, totalPages }`.
  - Home ahora hace una sola llamada paginada (top 3 jugadores + total) en vez de traer todos los usuarios.
- Mejoré el despliegue del frontend:
  - Reescritura del `client/Dockerfile` a un build multi-stage (Angular build de producción + nginx estático).
  - Eliminación de `ng serve` dentro de Docker (evita bucles de compilación lentos y errores de SASS).
  - Actualización de `docker-compose.yml` para usar el nuevo contenedor de nginx sin bind-mount.

**Resultado:**
- Creación de usuarios ahora valida Riot ID contra la API oficial y obtiene el rango real de HenrikDev, guardando `puuid`, región, nivel y avatar.
- Listas de jugadores y LFG ahora son paginadas, reduciendo datos transferidos y tiempo de render.
- El frontend se sirve como build de producción estático con nginx, eliminando los problemas de `ng serve` en Docker y mejorando tiempos de carga percibidos.

---

## 10. Chat sobre errores de `docker build`, lentitud de carga y fixes de entorno (feb 2026)

**Prompts clave:**
- "me da error el docker build"
- "sigue tardando mucho en cargar los jugadores y cargando los posts en LFG Board"
- "puede ser que este fallando porque no tengo ninguna APIKEY puesta"
- "deberia de estar funcionando todo correctamente? … puedes comprobar si estan todas estas mejoras aplicadas"
- "He intentado hacer un docker compose up --build y me ha fallado…"

**Errores encontrados:**
- Client build: `./node_modules/.bin/ng: not found` → dependencias no instaladas correctamente.
- `npm error Exit handler never called!` dentro del contenedor (fallo interno de npm).
- Angular build: fallo al inlinear Google Fonts: `getaddrinfo EAI_AGAIN fonts.googleapis.com`.
- Mongo healthcheck: `mongosh` en modo interactivo colgaba y marcaba el contenedor como `unhealthy`.
- API: `nodemon: not found` y más tarde `Cannot find module 'express'` por `node_modules` vacío al recrear volúmenes.
- Build API: `npm error ECONNRESET`/`EAI_AGAIN registry.npmjs.org` (conectividad/DNS durante build).

**Acciones / fixes aplicados:**
- **Client (Angular)**
  - Se cambió el build stage a `node:22-alpine` y se fijó `npm@11.6.2` (según `packageManager` del proyecto) para estabilizar `npm ci`.
  - Se desactivó el inlining de fuentes en producción en `angular.json` (`optimization.fonts.inline: false`) para no depender de acceso a Google Fonts durante el build.
  - Se corrigió la configuración de **file replacements** en `angular.json` (faltaba), para que producción use `environment.prod.ts`.
    - Se verificó que el bundle final ya contiene `apiUrl: "/api"` (antes estaba hardcodeado a `http://localhost:4000/api`).
- **Server (Express + Mongo)**
  - Se corrigió el **healthcheck** de Mongo en `docker-compose.yml` para usar `mongosh --eval` no interactivo.
  - Se añadieron **índices de MongoDB**:
    - `User`: `{ rank: 1, role: 1, karma: -1 }` y `{ karma: -1 }`.
    - `LFGPost`: `{ status: 1, createdAt: -1 }` y `{ author: 1 }`.
    - Se verificó en Mongo que los índices existen (`getIndexes()`).
  - Se optimizaron lecturas con `.lean()` en `getUsers` y `getPosts`.
  - Se limitó el endpoint de matchmaking a 50 resultados para evitar respuestas enormes.
  - Se añadió `compression` en Express (y se verificó `Content-Encoding: gzip` en respuestas grandes).
- **Diagnóstico de lentitud**
  - Medición desde dentro del contenedor: `/api/users` y `/api/lfg` ~160–200ms.
  - Se identificó que la lentitud real venía del frontend apuntando a `localhost:4000` (port mapping de Docker Desktop en Windows) en vez del proxy nginx `/api`.
  - Se reconstruyó el client y se confirmó el uso de `/api` vía nginx (red interna Docker) para reducir latencia.

**Resultado:**
- `docker compose up --build` vuelve a ser estable (cuando la red/DNS de Docker Desktop no falla).
- Client en producción usa `/api` (nginx proxy), con lazy loading, build multi-stage y sin dependencia de Google Fonts en build.
- API con compresión, paginación y consultas indexadas/optimizadas; Mongo con healthcheck correcto.

---

## 11. Chat sobre carga de jugadores, LFG e infinite scroll (feb 2026)

**Prompts clave:**
- "Estoy teniendo problemas con la carga de jugadores y de post LFG que no cargan, explora los posibles problemas y propon distintas soluciones."
- "sigue tardando en cargar los jugadores"
- "sigo teniendo problemas con el tiempo de carga, no se si algun tipo de lazy loading o infinite scroll podria ayudar al tiempo de carga"
- "quizas que carguen 3 tarjetas y hacerlas mas grandes, asi tiene que cargar menos pero no se ve tan vacio, y que vaya cargando de una en una"

**Diagnóstico inicial:**
- Revisé backend (`getUsers`, `getPosts`, modelos `User` y `LFGPost`) y frontend (`players`, `lfg-board`, `api.service`, `home`).
- Detecté múltiples problemas:
  - El contenedor de la API estaba en bucle de crash porque `nodemon` no se encontraba dentro del contenedor (volumen anónimo sobreescribiendo `node_modules`).
  - `curl` a `localhost:4000/api/users` se quedaba colgado porque la API no arrancaba.
  - La base de datos estaba vacía (sin ejecutar `npm run seed`).
  - El frontend tragaba los errores (solo `loading=false`) y mostraba mensajes de "sin resultados" como si todo fuera correcto.
  - LFG filtraba por `status='open'` por defecto, lo que podía ocultar posts si todos estaban `full/closed`.
  - Posible crash en `lfg-card` cuando el autor de un post había sido eliminado (acceso a `post.author.riotId` sin null-check).

**Acciones y fixes aplicados:**
- **1. Manejo de errores en frontend**
  - Añadí `errorMessage` en `players`, `lfg-board` y `home`, y bloques `@if (errorMessage)` en los templates.
  - Mostré mensajes rojos claros cuando la API falla y mantuve mensajes diferenciados para "no hay datos" vs "error de carga".
- **2. Proxy y environments en desarrollo**
  - Creé `client/proxy.conf.json` para redirigir `/api` a `http://localhost:4000`.
  - Cambié `environment.ts` para usar `apiUrl: '/api'` (igual que producción).
  - Configuré `angular.json` para que `ng serve` use el proxy por defecto.
- **3. Mejora UX de estados vacíos**
  - En `players` y `lfg-board` mejoré mensajes de lista vacía, añadiendo hints sobre ejecutar el seed si no hay filtros activos.
- **4. Filtros avanzados en LFG**
  - Añadí filtros de `status` y `role` en `LfgBoardComponent` y su template, con un panel de filtros estilo `players`.
- **5. Limpieza de posts huérfanos y null-safety**
  - Añadí guardas en `lfg-card` (`@if (post.author)`) para mostrar "[Usuario eliminado]" cuando el autor no existe.
  - En `userController.deleteUser`, añadí `LFGPost.deleteMany({ author: req.params.id })` para borrar también sus posts LFG.
- **6. Arreglo definitivo del contenedor de API**
  - En `server/Dockerfile` instalé `nodemon` globalmente (`npm install -g nodemon`) y cambié el `CMD` a `["nodemon", "app.js"]`.
  - Hice `docker compose down -v` y `docker compose up --build` para recrear contenedores y volúmenes.
  - Verifiqué que la API respondiera a `/` y `/api/users`, y ejecuté `npm run seed` dentro del contenedor para poblar la base de datos.

**Mejoras de rendimiento percibido (infinite scroll + skeletons):**
- **Infinite scroll en `players` y `lfg-board`:**
  - Reemplacé la paginación manual por **IntersectionObserver** con un sentinel al final de la lista.
  - Cambié el `pageSize` primero a 6 y luego a **3** para reducir la carga por petición.
  - Las nuevas páginas se añaden al array existente (`this.players = [...this.players, ...res.data]`) en vez de reemplazarlo.
  - Exposición de `hasMore` para saber cuando mostrar mensajes de "fin de lista".
- **Skeleton loading:**
  - Sustituí el simple "Cargando..." por tarjetas skeleton (`c-skeleton-card`) con animación de shimmer (`skeleton-pulse`).
  - Skeletons adaptados a la estructura real de las cards (avatar, título, texto, badges).
- **Tarjetas más grandes y layout más lleno con menos datos:**
  - Jugadores:
    - Grid de `l-grid--3col` a `l-grid--2col`.
    - Player-card con avatar más grande (56px), tipografía más grande, y más padding general de las cards.
  - LFG:
    - Grid de `l-grid--2col` a `l-grid--1col` con `max-width: 800px` (cards tipo “panel” ancho).
    - LFG-card con títulos y descripciones más grandes y mayor espacio vertical.
- **Animación escalonada (staggered):**
  - Agregué clase `c-fade-in` con animación `fade-in-up` y delay dinámico por índice (`[style.animation-delay]`).
  - Cada tarjeta (y skeleton) aparece una a una, mejorando la sensación de fluidez aunque lleguen menos elementos por petición.

**Resultado:**
- Los jugadores y posts LFG ya cargan de forma fiable (API estable, DB con seed, errores visibles si algo falla).
- La carga inicial es más ligera (3 ítems por petición) y el scroll infinito evita paginación manual.
- La UI se ve llena aunque haya menos elementos: tarjetas más grandes, grid ajustado y animación suave “de una en una”.
- El usuario percibe una aplicación más rápida y pulida, tanto en desktop como en pantallas pequeñas.

---

## 12. Chat sobre errores de red en Docker y build del client (feb 2026)

**Prompts clave:**
- "Property 'nextCursor' does not exist on type 'PaginatedResponse<LfgPost>'."
- Errores en `docker build` del client: `npm error code EAI_AGAIN`, `Exit handler never called!`, problemas con `npm ci` dentro de Docker.
- "pero yo queria que estuviera todo en docker para facilitar la ejecucion el PC nuevos"

**Diagnóstico y acciones:**
- Verifiqué que la interfaz `PaginatedResponse<T>` en `api.service.ts` sí define `nextCursor`, por lo que el error de TypeScript era un falso positivo del language server (cache desincronizada).
- Analicé los Dockerfiles de `client` y `server` y detecté que el paso `npm install -g npm@...` en el client fallaba por `EAI_AGAIN` (DNS de Docker).
- Confirmé que los contenedores Docker no tenían conectividad de red (ni ping a `8.8.8.8` ni `wget` a `registry.npmjs.org`), mientras que el host Windows sí podía hacer peticiones HTTP.
- Revisé la configuración de Docker Desktop y descubrí que el daemon estaba usando un proxy interno (`http.docker.internal:3128`), pero el DNS interno (127.0.0.11) en los contenedores estaba roto.
- Como workaround práctico para poder seguir trabajando, reescribí el `client/Dockerfile` para que no hiciera `npm ci` ni `ng build` dentro del contenedor:
  - Ahora se compila Angular localmente (`npm ci` + `npm run build --configuration=production` en `client/`).
  - El Dockerfile del client solo usa `nginx:alpine` y copia el build ya generado (`dist/premadegg/browser`) al contenedor.
- Actualicé `.dockerignore` del client para que no ignore el directorio `dist`, permitiendo copiar el build dentro de la imagen.
- Reconstruí todo con `docker compose up --build -d`, verificando que `api`, `client`, `mongo` y `mongo-express` quedaran levantados y accesibles.
- Dejé documentado que, para recuperar un Docker multi-stage totalmente autocontenido en el futuro, será necesario primero arreglar la red/DNS de Docker Desktop (por ejemplo, con un "Reset to factory defaults" y comprobando que `docker run alpine wget https://registry.npmjs.org` funcione).

**Resultado:**
- El proyecto vuelve a levantarse íntegramente con `docker compose up --build`, usando una imagen ligera de nginx para el frontend y Node para la API, aunque la compilación de Angular se hace fuera de Docker como paso previo.
- El error de `nextCursor` en el frontend no afecta al runtime; el tipado y la paginación con cursor funcionan correctamente.
- Queda un plan claro para volver al build multi-stage dentro de Docker cuando se solucione el problema de red del entorno.

---

## 13. Chat sobre Setup Inicial y Arquitectura (feb 2026)

**Prompts clave:**
- "Actúa como un Senior Tech Lead y Arquitecto de Software experto en el stack MEAN..."
- "puedes seguir tu el instructions.md para probar el proyecto"
- "no funciona"
- "no tengo mongoDB instalado, como lo podria instalar, y porque mongoDB y no otro tipo de BBDD"

**Acciones / fixes aplicados:**
- Creación de la estructura base del Monorepo (`client/` y `server/`) siguiendo rúbricas estrictas.
- Configuración del servidor con Express, Morgan (logging por entorno) y configuración `package.json` estricta (`dev`, `start`, `lint`).
- Implementación de `seed.js` con `@faker-js/faker` para poblar usuarios y reviews cruzadas asegurando integridad de datos.
- Creación de modelos Mongoose (`User` y `Reputation`) e instanciación del backend.
- Inicialización del frontend con Angular (standalone components) e integración de arquitectura SCSS (`_variables`, `_reset`, `_mixins`, `main.scss`).
- Elaboración de un componente BEM demostrativo `player-card` con lógica TS e interpolación.
- Corrección de errores en la compilación SASS de Angular ajustando rutas relativas (`@use`) y corrigiendo la exportación de estilos.
- Elaboración de documentación de despliegue local (`INSTRUCTIONS.md`) detallando la instalación y configuración de MongoDB.
- Se brindó soporte arquitectónico justificando MongoDB vs SQL por la naturaleza JSON del Stack MEAN y la flexibilidad ante esquemas como `schedule` u otras propiedades dinámicas.

**Resultado:**
- Repositorio inicializado y funcional. Frontend (Angular + SCSS) compila y se sirve correctamente.
- Backend en Node.js configurado, poblado con faker y listo para el desarrollo de rutas.
- Decisiones arquitectónicas (SASS utils separation, Faker Logic, Semantic HTML / BEM y DB engine NoSQL) documentadas para el proyecto de grado.

---

## 14. Chat sobre problemas SMTP en despliegue (Render) y migración a API (feb 2026)

**Prompts clave:**
- "tengo un problema, cuando despliego la app, la parte backend, en render, el sistema de correos no funciona"
- "lo tengo de esta manera, asi estaria bien?" (mostrando variables de entorno)
- "SMTP connection failed: connect ENETUNREACH 2a00:1450..."
- "SMTP connection failed: Connection timeout"
- "quiero que los correos se pueda enviar a cualquier correo, no solo al mio"
- "pero si no puedo comprar dominios"
- "TypeError: brevo.TransactionalEmailsApi is not a constructor"

**Diagnóstico y acciones:**
- Detecté que la conexión original de `nodemailer` con Gmail fallaba en Render inicialmente por intentar usar IPv6 (`ENETUNREACH`). Se forzó a IPv4 (`family: 4`).
- Tras forzar IPv4, Render devolvió un `Connection timeout`, lo cual confirmó que la capa gratuita de Render bloquea activamente los puertos SMTP salientes (587, 465, 25) para prevenir spam.
- Propuse migrar a **Resend** (API HTTP por el puerto 443, libre de bloqueos). Implementé el código, pero el usuario no tenía un dominio propio comprado para verificarlo, por lo que Resend solo le permitía enviar correos a su propia dirección.
- Propuse una solución final sin dominio propio: usar el plan gratuito de **Brevo (antes Sendinblue)** mediante su cliente de API oficial para Node.js (`@getbrevo/brevo`).
- Implementé el SDK de Brevo en `emailService.js`.
- Detecté un error crítico (`TypeError`) al arrancar el contenedor: la sintaxis del SDK v3 de Brevo ya no era compatible con la versión v4 instalada vía npm.
- Investigué dentro del contenedor (`node -e`, leyendo el `README.md` del paquete) y adapté el código a la nueva sintaxis (`const { BrevoClient } = require('@getbrevo/brevo'); new BrevoClient(...)`).

**Resultado:**
- El sistema de correos transaccionales (como "Recuperar contraseña") ahora funciona perfectamente en el entorno de producción de Render.
- Al usar llamadas HTTP directas (Brevo API) en lugar de transporte SMTP clásico, se evitan por completo los bloqueos de firewall de Render y se permite el envío a cualquier destinatario global sin requerir validación de dominio personalizado.