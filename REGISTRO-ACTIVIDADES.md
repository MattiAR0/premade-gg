---
tags: [premadegg, privacidad, rgpd]
actualizado: 2026-11-13
---

# Registro de actividades de tratamiento (art. 30 RGPD)

Documento interno. Vuelta al [[INDICE]]. Relacionado: [[PROCEDIMIENTO-BRECHAS]], [[PROCEDIMIENTO-BORRADO-RIOT]] y la política de privacidad (`client/src/app/pages/legal/privacy.component.html`).

**Por qué existe.** El artículo 30 obliga a llevar este registro. La excepción para organizaciones de menos de 250 personas no se aplica porque el tratamiento de PremadeGG no es ocasional. La AEPD puede pedirlo; no se publica.

**Cómo mantenerlo.** Cada vez que cambie la política de privacidad, una tabla de la base de datos con datos personales o un proveedor, revisar este documento y cambiar la fecha de arriba. Si algo de aquí no coincide con la política de privacidad, manda lo que se hace de verdad: corregir el que esté mal.

## Responsable

- **Responsable:** Matti Johannes Ahola Rivas, particular, en España. Proyecto personal sin ánimo de lucro.
- **Contacto:** `premagegg.app@gmail.com` (la doble g es intencionada).
- **Delegado de protección de datos:** no hay. No es obligatorio: no hay tratamiento a gran escala ni de categorías especiales.
- **Corresponsables y representante en la UE:** no hay.

## Destinatarios y transferencias internacionales

Cada actividad cita estos destinatarios por su letra. "Transferencia" significa que los datos salen del Espacio Económico Europeo o los trata una empresa de fuera.

**Encargados del tratamiento** (tratan los datos por cuenta de PremadeGG):

| | Proveedor | Para qué | País | Garantía de la transferencia |
|---|---|---|---|---|
| S | Supabase Inc. | Base de datos, autenticación, archivos (fotos), tiempo real, Edge Functions | Datos alojados en la UE (París, `eu-west-3`); empresa de EE. UU. con posible acceso de soporte | DPA de Supabase con cláusulas contractuales tipo. [PENDIENTE: comprobar que el DPA está aceptado en el panel de la organización y si Supabase está certificada en el Marco de Privacidad (lista de dataprivacyframework.gov).] |
| V | Vercel Inc. | Alojamiento de la web y registros de peticiones (IP, fecha, ruta) | EE. UU. y red global | DPA de Vercel. [PENDIENTE: comprobar si Vercel está en el Marco de Privacidad o si la garantía son las cláusulas tipo.] |
| E | Proveedor de email de Supabase Auth | Emails de la cuenta (confirmar email, recuperar contraseña, cambiar email) | [PENDIENTE: confirmar en el panel de Supabase si se usa el SMTP por defecto o uno propio.] | La del proveedor |
| G | Google (Gmail) | Buzón de contacto: peticiones de derechos, denuncias por email, avisos de Riot | EE. UU. | [PENDIENTE: comprobar la certificación de Google en el Marco de Privacidad y valorar si una cuenta gratuita de Gmail basta o hace falta un buzón con DPA.] |

**Terceros** (reciben datos para que el servicio funcione y los usan con sus propias condiciones):

| | Destinatario | Qué recibe | País | Garantía |
|---|---|---|---|---|
| R | Riot Games, Inc. | El Riot ID, para comprobar que la cuenta existe (`account-v1`, región `europe`) | EE. UU. (empresa); servidor regional europeo | [PENDIENTE: comprobar si Riot Games está en el Marco de Privacidad. Si no, la transferencia la pide el propio usuario al vincular (art. 49.1.b).] |
| H | HenrikDev API (no oficial) | Riot ID y región (rango, nivel, tarjeta); PUUID durante la verificación | Desconocido | Sin DPA ni garantía conocida. [PENDIENTE: averiguar dónde está alojada. Si es fuera del EEE y no hay garantía, decidir entre basarlo en el art. 49.1.b (necesaria para lo que pide el usuario) y reflejarlo en la política, o dejar de usarla cuando haya clave de producción.] |
| I | valorant-api.com y sitios donde están las fotos y logos que enlazan los usuarios | La IP del navegador al cargar las imágenes | Varios | Ninguna; lo avisa la política (apartado 8). |
| P | El público | Lo que es visible en la web sin cuenta (perfiles, valoraciones, grupos, equipos) | Mundial | No aplica: el usuario lo publica sabiendo que es público (aviso en el onboarding). |

**Inicio de sesión con Google y Discord:** no está activo (comprobado el 2026-11-13: producción solo tiene email). Los botones están ocultos (`environment.oauthEnabled = false`) y la política no lo menciona. Si se activa, Google y Discord pasan a ser destinatarios de la actividad 1 y hay que actualizar la política antes.

## Actividades

### 1. Cuentas y perfiles

- **Finalidad:** crear y mantener la cuenta y el perfil público, y prestar el servicio.
- **Base legal:** ejecución del contrato (art. 6.1.b), con los términos de uso.
- **Interesados:** usuarios registrados (16 años o más, declarado al registrarse).
- **Datos:** email y contraseña (la guarda Supabase Auth con hash), emails de la cuenta enviados (confirmación, recuperación de contraseña, cambio de email), Riot ID, región, roles, horario, biografía, foto, agentes favoritos, redes sociales, disponibilidad, si busca equipo o es coach. Públicos, también para quien no tiene cuenta, salvo el email.
- **Destinatarios y transferencias:** S, V, E y P (ver las tablas de arriba).
- **Plazo:** hasta que el usuario borra la cuenta (Ajustes de cuenta → Borrar cuenta, Edge Function `delete-account`).
- **Tablas:** `auth.users`, `profiles`, bucket de Storage de avatares.

### 2. Vinculación y verificación del Riot ID

- **Finalidad:** comprobar que el Riot ID existe, mostrar el rango, nivel y tarjeta, verificar que el Riot ID es de quien lo vincula y evitar suplantaciones.
- **Base legal:** ejecución del contrato (art. 6.1.b). Quitar un Riot ID sin verificar a otra cuenta que demuestra que es suyo: interés legítimo en evitar la suplantación (art. 6.1.f).
- **Interesados:** usuarios que vinculan un Riot ID y, si alguien vincula un Riot ID ajeno, el jugador dueño de ese Riot ID aunque no tenga cuenta.
- **Datos:** Riot ID, PUUID (tabla privada), rango, nivel, tarjeta, fecha de verificación; durante el reto, la tarjeta de las últimas partidas y cuándo empezaron.
- **Destinatarios y transferencias:** S, R, H y P (rango, nivel, tarjeta y Riot ID son públicos; el PUUID no).
- **Plazo:** hasta que se desvincula el Riot ID o se borra la cuenta. El reto, 2 días como máximo.
- **Tablas:** `profiles`, `riot_identities`, `riot_challenges`.
- **Solicitudes de Riot:** [[PROCEDIMIENTO-BORRADO-RIOT]].

### 3. Valoraciones, karma y conservación contra la evasión

- **Finalidad:** calcular la reputación, decidir quién puede valorar a quién y aplicar los requisitos de karma (no crear grupos con karma ajustado menor de 3; karma mínimo para unirse a un grupo). Conservar el karma y la suspensión de una cuenta borrada para que no se puedan limpiar.
- **Base legal:** ejecución del contrato para mostrar las valoraciones; interés legítimo (art. 6.1.f) en un sistema de reputación fiable y en prevenir el acoso y el fraude para el resto. [PENDIENTE: ponderación del interés legítimo por escrito (BACKLOG).]
- **Decisiones automatizadas (art. 22):** las dos basadas en el karma, más quitar un Riot ID sin verificar y heredar el karma de una cuenta borrada. Efectos limitados al servicio. Revisión humana a petición por email.
- **Interesados:** usuarios que valoran y que reciben valoraciones.
- **Datos:** valoración de 1 a 5, comentario, autor, destinatario, fecha; con quién coincidió cada usuario y cuándo; tras borrar una cuenta, suma y número de valoraciones, fin de la suspensión y un HMAC del PUUID.
- **Destinatarios y transferencias:** S y P (las valoraciones recibidas son públicas, con el Riot ID de quien las escribe; el historial de cuentas borradas y los hashes no).
- **Plazo:** las valoraciones, hasta que se borra la cuenta de quien las escribió o las recibió. Registro de coincidencias, 12 meses desde la última. Historial de cuenta borrada y hashes de Riot ID anteriores, 90 días.
- **Tablas:** `reputations`, `played_pairs`, `riot_account_history`, `riot_identity_hashes`.

### 4. Grupos, equipos, mensajes y notificaciones

- **Finalidad:** publicar grupos LFG y equipos, pedir y aceptar uniones, chatear y avisar de lo que pasa.
- **Base legal:** ejecución del contrato (art. 6.1.b).
- **Interesados:** usuarios.
- **Datos:** grupos y equipos (públicos), solicitudes e invitaciones, mensajes (solo los ven los participantes), notificaciones.
- **Destinatarios y transferencias:** S y P (grupos y equipos; los mensajes y las notificaciones no son públicos).
- **Tablas:** `lfg_posts`, `lfg_members`, `teams`, `team_players`, `team_staff`, `team_invites`, `team_join_requests`, `conversations`, `conversation_participants`, `messages`, `notifications`.
- **Plazo:** grupos LFG, 24 horas; mensajes, 90 días; notificaciones, 30 días (resultado de una denuncia, 90 días; decisiones de moderación y recursos, 7 meses).

### 5. Denuncias, moderación, bloqueos y suspensiones

- **Finalidad:** atender denuncias, moderar contenidos, motivar las decisiones, resolver recursos, bloquear entre usuarios y suspender cuentas.
- **Base legal:** obligación legal del Reglamento de Servicios Digitales (art. 6.1.c) e interés legítimo en un entorno seguro y en defenderse de reclamaciones (art. 6.1.f).
- **Interesados:** quien denuncia, la persona denunciada y, por la copia del contenido, terceros que aparezcan en él.
- **Datos:** motivo, texto, copia del contenido denunciado, autor de la denuncia, decisión y motivo, recurso, bloqueos, fechas de suspensión. Puede haber datos de terceros dentro de las copias.
- **Destinatarios y transferencias:** S. Dentro de PremadeGG, solo los moderadores (tabla `moderators`). La identidad de quien denuncia no se comunica a la persona denunciada.
- **Plazo:** mientras estén abiertas y 12 meses desde que se resuelven (o se resuelve el recurso), aunque se borre la cuenta. Al borrar una cuenta, `reports.reporter_id` y `reports.target_user_id` pasan a `null` (`on delete set null`): la denuncia queda sin vínculo con la cuenta, pero la copia del contenido puede seguir identificando a personas. Bloqueos, mientras exista la cuenta. Suspensiones, hasta que terminan.
- **Tablas:** `reports` (con el recurso en la misma fila), `moderators`, `blocks`, `suspensions`.

### 6. Seguridad y prevención de abusos

- **Finalidad:** limitar la frecuencia de las acciones, detectar abusos y mantener los registros técnicos.
- **Base legal:** interés legítimo en la seguridad de la plataforma (art. 6.1.f).
- **Interesados:** usuarios y visitantes sin cuenta.
- **Datos:** contadores por usuario o por un código derivado de la IP que cambia cada día (`RATE_LIMIT_SECRET`); registros de peticiones de Supabase y Vercel (IP, fecha, ruta).
- **Destinatarios y transferencias:** S y V.
- **Plazo:** contadores, 2 días; registros técnicos, los plazos de cada proveedor (el plan gratuito de Supabase los guarda poco tiempo) [PENDIENTE: anotar los plazos exactos de Supabase y Vercel].
- **Tablas:** `rate_counters`.

### 7. Prueba de la aceptación de los términos

- **Finalidad:** poder demostrar que el usuario aceptó los términos y la privacidad, con la versión y la fecha, y que declaró tener 16 años o más.
- **Base legal:** interés legítimo (art. 6.1.f).
- **Interesados:** usuarios registrados.
- **Datos:** usuario, versión de los términos y la privacidad, fecha de aceptación y declaración de edad.
- **Destinatarios y transferencias:** S.
- **Plazo:** mientras exista la cuenta.
- **Tablas:** `consents`.

### 8. Contacto y ejercicio de derechos

- **Finalidad:** responder a usuarios, a personas sin cuenta (por ejemplo, alguien cuyo Riot ID vinculó otra persona), a peticiones de derechos y a Riot.
- **Base legal:** obligación legal (arts. 12 a 22 RGPD) y, para el resto de consultas, interés legítimo en atenderlas.
- **Interesados:** usuarios, personas sin cuenta que escriben (por ejemplo, el dueño de un Riot ID vinculado por otro) y el personal de Riot que envía solicitudes.
- **Datos:** email, nombre si lo da, contenido del mensaje, Riot ID si lo menciona.
- **Destinatarios y transferencias:** G (EE. UU.). La política de privacidad lo recoge desde el 2026-11-13.
- **Plazo:** hasta resolver la petición y, después, como máximo 3 años (lo dice la política). Borrar del buzón el correo más antiguo una vez al año.
- **Plazo de respuesta:** un mes (art. 12.3).

## Medidas de seguridad (art. 32)

- **Acceso a datos:** Row Level Security en todas las tablas. Las tablas privadas (PUUID, hashes, denuncias, suspensiones, retos, `app_secrets`) no se leen desde la API pública. Las escrituras sensibles pasan por funciones del servidor que comprueban la sesión y las reglas.
- **Secretos:** `SUPABASE_SERVICE_ROLE_KEY`, `RIOT_API_KEY`, `HENRIK_API_KEY` y `RATE_LIMIT_SECRET` solo como secretos de las Edge Functions; la clave del HMAC del PUUID (`app_secrets.puuid_hash_key`) se genera dentro de la base de datos. Nada de esto está en el repositorio, que es público.
- **Transporte y navegador:** HTTPS; HSTS lo aplica Vercel en su dominio; cabeceras CSP, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` y `X-Content-Type-Options` (`client/vercel.json`); CORS limitado a los orígenes permitidos (`ALLOWED_ORIGINS`).
- **Abuso:** límites de frecuencia en las escrituras y en las Edge Functions; filtro de palabras.
- **Seudonimización:** HMAC con clave secreta para los PUUID que se guardan tras desvincular o borrar.
- **Minimización:** no se guarda el historial de partidas; la IP solo como código diario no reversible en los contadores.
- **Copias de seguridad:** el plan gratuito de Supabase no tiene copias automáticas; no se guardan volcados propios de producción.
- **Cuentas de administración:** Supabase, Vercel, GitHub y Gmail. [PENDIENTE: confirmar que las cuatro tienen verificación en dos pasos.]
- **Brechas:** [[PROCEDIMIENTO-BRECHAS]].
