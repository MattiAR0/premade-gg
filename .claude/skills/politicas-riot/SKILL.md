---
name: politicas-riot
description: Políticas de Riot Games para productos de terceros (políticas generales del Developer Portal, específicas de Valorant, RSO, claves de API, marcas y el aviso "Legal Jibber Jabber") y cómo preparar el registro del producto para la clave de producción. Usar cuando se toque la integración con la API de Riot (supabase/functions/riot-*), se revise si PremadeGG cumple las normas de Riot o se redacte material para presentarlo a Riot.
---

# Políticas de Riot para PremadeGG

PremadeGG quiere registrarse en el Developer Portal de Riot y conseguir una clave de producción. Para eso Riot revisa el producto y su cumplimiento de las políticas.

**Las políticas de Riot cambian.** Esta skill es un punto de partida. Antes de afirmar que algo cumple o no, lee la versión vigente con WebFetch:

- Políticas generales: https://developer.riotgames.com/policies/general
- Documentación y requisitos de Valorant: https://developer.riotgames.com/docs/valorant
- Términos de la API: https://developer.riotgames.com/terms
- Riot Sign On (RSO): https://developer.riotgames.com/docs/portal (apartado RSO)
- Uso de contenido de Riot ("Legal Jibber Jabber"): https://www.riotgames.com/en/legal

Si la fuente no carga o no lo aclara, dilo como "sin verificar" y no lo des por hecho.

## Checklist

### Claves y acceso
- [ ] La clave de la API de Riot vive solo en los secretos de las Edge Functions (`riot-link`, `riot-refresh`, `riot-validate`). Nunca en `client/`, en `environments/` ni en el historial de git.
- [ ] Se respetan los límites de peticiones (rate limits), con caché y reintentos con espera en las respuestas 429.
- [ ] El producto está registrado en el Developer Portal con la descripción, las URLs y las capturas al día.
- [ ] Datos de Valorant: comprobar en la documentación vigente qué endpoints exigen clave de producción y vinculación por RSO con consentimiento del jugador.

### Datos de jugadores
- [ ] Solo se muestran datos de un jugador que ha vinculado su cuenta (RSO u opt-in), según lo que pida Riot para Valorant.
- [ ] No se calculan ni se muestran datos ocultos (MMR oculto, por ejemplo) ni se desanonimiza a nadie (identificar jugadores anónimos o con perfil oculto).
- [ ] El jugador puede desvincular su cuenta y se borran los datos de Riot que se guardaron.
- [ ] Los datos de Riot se guardan solo el tiempo necesario y se refrescan desde la API.

### Juego limpio y comunidad
- [ ] El producto no da ventaja injusta dentro de la partida.
- [ ] **Riesgo propio de PremadeGG:** el karma y las reseñas entre jugadores pueden usarse para acosar o humillar. Revisar qué dicen las políticas vigentes sobre productos que puntúan a jugadores y documentar las salvaguardas: moderación, denuncias, filtro de palabras, límites a reseñas repetidas, apelación y que el karma no sea un ranking público para humillar.
- [ ] Si hay monetización, comprobar en las políticas vigentes qué se permite (por ejemplo, que el acceso a datos de Riot no quede tras un muro de pago).

### Marca y aviso legal
- [ ] Nombre, logo y dominio no dan a entender que el producto es oficial. No se usan logos de Riot ni de Valorant como marca propia.
- [ ] El pie muestra el aviso de Riot. Texto de referencia (comprobar el vigente en la página legal):

  > PremadeGG isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

  En la UI puede ir traducido al español, pero conviene mantener también el texto original en inglés.
- [ ] Los recursos del juego (iconos de agentes, emblemas de rango) se usan como permite la política de contenido de Riot.

### Privacidad (relación con `cumplimiento-legal`)
- [ ] La política de privacidad nombra a Riot Games como origen de los datos de la cuenta vinculada y explica qué se recoge por RSO.
- [ ] Hay URL pública de política de privacidad y de términos: Riot suele pedirlas en el registro del producto.

## Material para el registro del producto

Lo que Riot suele valorar (contrasta con el formulario actual del portal):

1. **Qué hace el producto** en dos o tres frases, centrado en el beneficio para el jugador: encontrar grupo con gente fiable y reducir la toxicidad.
2. **Qué datos y endpoints usa**, para qué y cada cuánto.
3. **Cómo usa RSO** y qué ve el jugador al vincular la cuenta.
4. **Cómo protege a los jugadores**: moderación, denuncias, borrado de datos, seguridad de la clave.
5. **Estado actual**: URL de producción, capturas, número de usuarios si hay datos reales. No inventes cifras.
6. **Contacto** y URLs de privacidad y términos.

El material de cara a Riot va en **inglés**. La documentación interna, en español.

## Cómo informar

Tabla **Política · Estado (cumple / no cumple / sin verificar) · Evidencia (archivo:línea o URL) · Acción**, con lo que bloquea la clave de producción primero.
