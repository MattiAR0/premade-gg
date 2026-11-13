---
tags: [premadegg, privacidad, rgpd, procedimiento, seguridad]
actualizado: 2026-11-13
---

# Procedimiento: brechas de datos personales

Documento interno. Vuelta al [[INDICE]]. Relacionado: [[REGISTRO-ACTIVIDADES]] (qué datos hay y dónde) y [[PROCEDIMIENTO-BORRADO-RIOT]].

## Qué es una brecha

Cualquier incidente que haga que datos personales se **pierdan, se destruyan, se cambien, se divulguen o los vea alguien que no debe**, por accidente o a propósito (art. 4.12 RGPD). Ejemplos para PremadeGG:

- Se filtra un secreto: `SUPABASE_SERVICE_ROLE_KEY` (da acceso a toda la base), `RIOT_API_KEY`, `HENRIK_API_KEY` o `RATE_LIMIT_SECRET`. Por ejemplo, se sube al repositorio, que es público.
- Alguien entra en las cuentas de Supabase, Vercel, GitHub o el Gmail de contacto.
- Un fallo de RLS o de una función deja leer datos privados: emails, mensajes, denuncias, PUUID.
- Se borran datos por error sin forma de recuperarlos (brecha de disponibilidad). El plan gratuito de Supabase no tiene copias de seguridad y no se guardan volcados propios, así que este riesgo se acepta a cambio de no conservar datos borrados. Si se perdieran datos, se evalúa y se anota como cualquier otra brecha.
- Se envía un email con datos de un usuario a quien no es.
- Un proveedor (Supabase, Vercel, Google) comunica una brecha propia que afecta a nuestros datos.

Las tres preguntas que importan: **qué datos, de cuántas personas y quién los ha podido ver o usar.**

## Plazos

- **En cuanto se sabe:** contener (paso 1).
- **72 horas desde que se tiene constancia:** notificar a la AEPD, salvo que sea improbable que suponga un riesgo para las personas (art. 33). Si no se tiene toda la información, se notifica lo que hay y se completa después.
- **Sin dilación indebida:** avisar a los afectados si el riesgo es alto (art. 34).
- **Siempre:** anotarla en el registro de brechas, aunque no se notifique (art. 33.5).

## Pasos

### 1. Contener (primeras horas)

Según lo que haya pasado:

- **Secreto filtrado:** cambiarlo ya.
  - `SUPABASE_SERVICE_ROLE_KEY` y claves de API de Supabase: rotarlas en el panel (Project Settings → API Keys) y volver a desplegar las Edge Functions. La web usa la clave publicable, que habrá que cambiar en el entorno de Vercel si también se rota.
  - `RIOT_API_KEY`: regenerarla en el Riot Developer Portal y actualizar el secreto (`npx supabase secrets set RIOT_API_KEY=...`).
  - `HENRIK_API_KEY`: regenerarla en HenrikDev y actualizar el secreto.
  - `RATE_LIMIT_SECRET`: cambiarlo con `supabase secrets set`. Solo afecta a los contadores de 2 días.
  - Si el secreto llegó al repositorio, quitarlo no basta: el historial de Git es público y puede estar copiado. Lo que vale es rotarlo.
- **Cuenta de administración comprometida** (Supabase, Vercel, GitHub, Gmail o la cuenta del Riot Developer Portal): cambiar la contraseña, cerrar las sesiones abiertas, revisar la verificación en dos pasos y revocar los tokens de acceso (Supabase Access Tokens, tokens de Vercel y GitHub) y, si es la del portal de Riot, regenerar la clave de la API.
- **Si el comprometido es el Gmail de contacto:** recuperar la cuenta antes de nada y avisar a los afectados y a la AEPD desde otro correo propio, indicando que el buzón habitual estuvo comprometido. Si el comprometido es Supabase Auth, los emails siguen en Supabase: recuperar el acceso al panel (o pedir ayuda al soporte de Supabase) y sacarlos de Authentication → Users. Si no se puede, aviso público en la web.
- **Fallo de RLS o de una función:** quitar el permiso o la función que falla (una migración que revoque el `grant`, o `supabase functions delete <nombre>`) aunque se rompa una parte de la web. Arreglarlo bien después.
- **Sesiones de usuarios en riesgo:** se pueden cerrar todas desde la base de datos (`delete from auth.sessions;`) y obligar a cambiar contraseñas desde Authentication → Users. Los tokens de acceso ya emitidos siguen valiendo hasta que caducan (1 hora por defecto); para cortarlos al momento hay que rotar las claves de firma de JWT en el panel.
- **Clave del HMAC del PUUID** (`app_secrets.puuid_hash_key`): si se filtra, quien tenga un PUUID podría comprobar si hay historial guardado. Cambiarla invalida los hashes de los últimos 90 días (`riot_account_history` y `riot_identity_hashes`): se pierde la protección contra la evasión del karma de esas cuentas, que es el mal menor.

### 2. Guardar las pruebas

Antes de que caduquen: el plan gratuito de Supabase guarda poco tiempo los registros. Exportar o capturar los logs relevantes (Supabase → Logs; Vercel → Logs), los commits y las fechas. Guardarlos **fuera del repositorio**.

### 3. Evaluar el riesgo

Responder por escrito:

1. ¿Qué datos? Usa [[REGISTRO-ACTIVIDADES]]. Más graves: email con contraseña, mensajes privados, denuncias (quién denunció a quién), suspensiones. Menos graves: datos que ya eran públicos (Riot ID, rango, karma, valoraciones).
2. ¿De cuántas personas? Contar en la base (`select count(*) from auth.users`, o las filas afectadas).
3. ¿Quién los ha podido ver o usar, y se puede saber si los usó?
4. ¿Hay menores? La edad mínima es 16 años.
5. ¿Qué les puede pasar? Suplantación, acoso (si se sabe quién denunció a quién), phishing con su email, pérdida de su cuenta.

Herramienta de ayuda: la AEPD tiene "Asesora Brecha" para decidir si hay que notificar y "Comunica-Brecha RGPD" para decidir si hay que avisar a los afectados. [PENDIENTE: comprobar que siguen disponibles en aepd.es.]

**Regla práctica:** si solo afecta a datos que ya se veían en la web (Riot ID, rango, karma, valoraciones), o a datos que nadie puede leer ni revertir (por ejemplo, las contraseñas, que Supabase Auth guarda con hash), probablemente no hay que notificar; se anota igualmente. Un dato que solo se podía sacar llamando a la API, como el PUUID, **no** cuenta como público. Si hay emails, contraseñas, mensajes o denuncias de por medio, notificar. En caso de duda, notificar.

### 4. Notificar a la AEPD (si hay riesgo)

Por la sede electrónica de la AEPD (sede.aepd.gob.es), formulario de notificación de brechas de datos personales. Hace falta identificarse (certificado digital, DNIe o Cl@ve). Lo que piden (art. 33.3):

- qué ha pasado y cuándo, y cuándo te enteraste;
- categorías y número aproximado de personas y de registros afectados;
- consecuencias probables;
- medidas tomadas y previstas;
- contacto: el email de PremadeGG.

Si se pasan las 72 horas, notificar igualmente y explicar el motivo del retraso.

### 5. Avisar a los afectados (si el riesgo es alto)

Por email a cada afectado (desde Authentication → Users) y con un aviso en la web. En lenguaje claro: qué ha pasado, qué datos, qué hemos hecho y qué pueden hacer ellos (por ejemplo, cambiar la contraseña si la usan en otros sitios). Plantilla:

> Hola. El [fecha] tuvimos un incidente de seguridad en PremadeGG que ha afectado a [datos]. [Qué pasó, en una frase.] Esto puede tener estas consecuencias para ti: [por ejemplo, recibir correos falsos que se hagan pasar por PremadeGG]. Ya hemos [medidas]. Te recomendamos [acción concreta]. Para cualquier duda, escribe a Matti Johannes Ahola Rivas, responsable de PremadeGG, en premagegg.app@gmail.com. También puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).

No hace falta avisar uno a uno (art. 34.3) si los datos afectados son ininteligibles para quien accedió (por ejemplo, contraseñas con hash; el cifrado en reposo del proveedor **no** sirve si el atacante entró con la clave `service_role`), si las medidas tomadas eliminan el riesgo alto o si supondría un esfuerzo desproporcionado (en ese caso, aviso público). Con pocos usuarios, avisar por email siempre es lo razonable.

### 6. Avisar a otros

- **Riot Games:** si afecta a datos de Riot (PUUID, Riot ID) o a la clave de la API. [PENDIENTE: comprobar en los términos de la API de Riot si hay obligación y plazo de avisarles.]
- **El proveedor afectado** (Supabase, Vercel, Google), si el fallo es suyo o hace falta su ayuda. Si la brecha es de un encargado, él debe avisarnos sin dilación (art. 33.2) y nuestras 72 horas empiezan cuando nos llega su aviso.
- **Policía** si hay un delito (acceso no autorizado, extorsión).

### 7. Registrar y aprender

Anotar cada brecha **fuera del repositorio** (por ejemplo, en una hoja privada), aunque no se haya notificado:

- fecha y hora del incidente y de cuando se supo;
- qué pasó y qué datos;
- número de afectados;
- evaluación del riesgo y decisión (notificar o no, y por qué);
- fecha de la notificación a la AEPD y a los afectados, si se hizo;
- medidas tomadas.

No apuntar en ese registro los datos filtrados en sí. Después, añadir una entrada en `CAMBIOS.md` con el arreglo técnico, sin datos personales.

## Incidentes ya conocidos

- **PUUID legible por la API hasta el 2026-11-09.** Hasta esa fecha, `profiles.puuid` se podía leer con la clave publicable (también sin sesión). Se corrigió moviéndolo a la tabla privada `riot_identities` (CAMBIOS, 2026-11-09) y la política de privacidad lo reconoce. [PENDIENTE: anotarlo en el registro de brechas privado con la evaluación: dato seudónimo de 3 cuentas de amigos de la titular, que no permite acceder a la cuenta de Riot ni a datos que no fueran ya públicos (rango, nivel y tarjeta se veían en la web); sin indicios de que alguien lo leyera; riesgo improbable, por lo que no se notifica a la AEPD. Revisar la evaluación antes de darla por buena.]

## Prevención

- Verificación en dos pasos en Supabase, Vercel, GitHub, Gmail y el Riot Developer Portal.
- No se guarda una copia aparte de los emails de los usuarios: contradiría la política de privacidad, que dice que lo borrado no queda en copias. Si hiciera falta para avisar, primero se actualiza la política.
- Ningún secreto en el código ni en `.env` versionados; antes de cada commit, mirar el diff.
- Revisar los cambios de RLS y funciones con `revisor-supabase` y `auditor-seguridad` antes de publicar.
- No guardar volcados de la base de producción en el ordenador ni en el repositorio.
- Repasar este procedimiento una vez al año o cuando cambie un proveedor.
