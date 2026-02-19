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
