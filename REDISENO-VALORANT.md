# Rediseño estilo Valorant: registro de cambios

**Fecha:** 24/10/2026
**Rama:** `redesign-valorant` (commit `5d203a2`, "redesign: estilo Valorant en páginas, componentes y SCSS")
**Alcance:** solo frontend (`client/`). No se ha tocado el backend.

## Objetivo

Se pidieron tres cosas:

1. Quitar los apartados de "Coming soon".
2. Cambiar la estética de la web.
3. Cambiar cómo funciona la web.

Decisiones tomadas al empezar:

| Pregunta | Respuesta |
|---|---|
| Qué hacer con el selector de juegos | Quitarlo entero |
| Dirección estética | Más Valorant / agresivo |
| Qué cambiar del funcionamiento | Flujo de la home, navegación, búsqueda y filtros, crear LFG y equipos |

---

## 1. "Coming soon"

- Los únicos "Coming soon" eran los botones de **League of Legends** y **Counter Strike** del navbar, tanto en escritorio como en el menú móvil.
- Se ha quitado el selector de juegos entero, incluido el botón de Valorant, porque la web ya es solo de Valorant.
- Se han borrado los iconos, que ya no se usaban: `client/public/assets/images/games/{valorant,lol,cs2}-icon.png`.

## 2. Estética

### Tokens de diseño (`client/src/scss/utilities/_variables.scss`)

| Token | Antes | Ahora |
|---|---|---|
| Fondo | `#0b0f14` | `#0f1923` (azul marino de Valorant) |
| Acento | `#dc3545` | `#ff4655` (rojo de Valorant) |
| Texto de títulos | `#ecf0f4` | `#ece8e1` (blanco roto) |
| Turquesa / karma alto | `#5a9e90` | `#2fd8b0` |
| Dorado | `#c49a44` | `#f5c451` |
| Radios de borde | 6–24px | 2–6px (esquinas rectas) |

Tokens nuevos:

- Tipografías: `$font-display`, `$font-heading` y `$font-body`.
- Tamaños de corte de esquina: `$cut-sm`, `$cut-md` y `$cut-lg`.

### Tipografía (`scss/global/_typography.scss`)

- **Anton:** títulos grandes (`h1`, hero, títulos de modal).
- **Barlow Condensed:** títulos, botones, etiquetas y navbar, en mayúsculas.
- **Barlow:** texto normal.
- Se ha quitado Inter. El `'Inter', sans-serif` que había en los componentes se ha cambiado por `v.$font-heading`.
- `font-synthesis: none` en `body`: Anton solo tiene un peso y algunas páginas le pedían 800, lo que generaba una negrita "falsa".
- Se han quitado los `letter-spacing` negativos de los títulos, porque en mayúsculas quedaban mal.
- Nueva clase `.c-eyebrow`: una etiqueta pequeña en rojo con una raya delante, que va sobre los títulos.

### Mixins nuevos (`scss/utilities/_mixins.scss`)

- `cut-corners($size)`: corta en diagonal dos esquinas opuestas.
- `cut-corner-br($size)`: corta solo la esquina inferior derecha (botones y avatares).
- `form-control`: estilo común de inputs, selects y textareas.
- `ui-label`: etiqueta en mayúsculas con espaciado entre letras.

### Componentes globales

- **Botones** (`_buttons.scss`):
  - Rectos, en mayúsculas.
  - El primario es rojo plano con la esquina cortada.
  - Variantes nuevas: `--light` (blanco roto) y `--block` (ancho completo).
- **Badges** (`_badges.scss`): rectangulares, en mayúsculas, con los colores nuevos.
- **Fondo** (`styles.scss`): azul marino con una cuadrícula sutil de 48px.
- **`_page.scss`** (nuevo): cabecera de página, barra de filtros, chips, control segmentado, cabecera de sección, estado vacío, error, skeletons, scroll infinito y animación de entrada.
- **`_modal.scss`** (nuevo): modal con borde superior rojo, campos de formulario y el bloque plegable "Más opciones" (`<details>`).
- Los estilos de `players`, `lfg-board` y `teams` estaban copiados en cada página. Ahora se usan los globales y sus `.scss` han quedado casi vacíos.

### Navbar (`navbar.component.html` + `scss/components/_navbar.scss`)

- Logo nuevo: un icono SVG y "PREMADEGG" en Anton.
- Enlaces en mayúsculas con un subrayado rojo animado en el activo.
- En móvil, el cajón lateral se abre con `transform` en lugar de `right: -100%`. Antes ensanchaba la página hacia los lados. Además, en móvil se quita el `backdrop-filter`, porque rompía el `position: fixed`.

### Tarjetas

- **Jugador:**
  - Al pasar el ratón aparece un acento rojo en el lateral.
  - El avatar tiene la esquina cortada y el nombre es más grande.
  - Se ha quitado el punto verde de "en línea": salía siempre y no significaba nada.
- **Grupo LFG:**
  - El título va en mayúsculas.
  - La barra de progreso y los avatares son rectos.
  - Colores de estado: abierto en turquesa, lleno en dorado y cerrado en gris.
- **Equipo:**
  - Al pasar el ratón se resalta en rojo (antes en turquesa).
  - El logo tiene la esquina cortada y el tag va en rojo.

### Resto de páginas

- Los colores que estaban puestos a mano (verde, índigo, ámbar, morado…) se han cambiado por los de la paleta nueva en perfil, detalle de equipo, detalle de LFG, mensajes, editar perfil y autenticación.
- Las tarjetas de login, registro y recuperar o restablecer contraseña tienen ahora un borde superior rojo.
- Footer: aparece el enlace a Equipos y se ordena en fila en escritorio.

## 3. Funcionamiento

### Home (`pages/home`)

- **Hero con buscador rápido.** Pregunta "¿Qué buscas?":
  - Si buscas **un grupo**, eliges el tamaño (Cualquiera, Duo, Trio o 5-Stack) y te lleva a `/lfg?size=…`.
  - Si buscas **jugadores**, eliges rol y rango y te lleva a `/players?role=…&rank=…`.
  - Debajo hay un enlace "o publica tu propio grupo".
- **Contadores:** grupos abiertos, jugadores y equipos reclutando. Mientras cargan se ve "–".
- **Secciones:**
  - "Grupos abiertos ahora": los 4 últimos.
  - "Top jugadores": los 3 con más karma.
  - "Equipos reclutando": 3.
- **Con sesión iniciada** el saludo es "Hola, {riotId}" y el título "¿A qué jugamos hoy?".
- **Sin sesión** aparecen los 3 pasos (vincular Riot ID, unirte o crear un grupo, valorar compañeros) y un botón de registro.

### Navegación

- Enlaces: **Grupos LFG**, **Jugadores** y **Equipos**. Se ha quitado "Home", porque el logo ya lleva al inicio.
- Botón **"Crear grupo"** siempre visible con sesión iniciada. Lleva a `/lfg?create=1`, que abre el formulario directamente. En móvil sale el primero del cajón.
- Mensajes se ha añadido al menú del usuario.
- **Volver tras el login:**
  - `login` lee `?returnUrl=` y vuelve ahí tras iniciar sesión. Solo acepta rutas internas que empiecen por `/` (y no por `//`), para evitar redirecciones a otras webs.
  - `authGuard` manda `returnUrl` con la ruta a la que se intentaba entrar.
  - Si intentas crear un grupo o un equipo sin sesión, pasas por el login y vuelves al formulario.

### Filtros (jugadores, LFG y equipos)

- **Se aplican al momento.** Ya no hay botón "Buscar".
- **Se guardan en la URL**, así que se pueden compartir y el botón atrás funciona:
  - Jugadores: `?role=&rank=&karma=&lft=1`
  - LFG: `?size=2|3|5&status=full|closed` (abiertos es la opción por defecto)
  - Equipos: `?q=&region=&rank=&recruiting=1`
- **Controles:**
  - Rol y región se eligen con chips.
  - Karma mínimo y estado se eligen con un control segmentado.
  - "Buscando equipo" y "Solo reclutando" son chips que se activan y desactivan.
- **LFG:** nueva pestaña **"Todos"**, para ver grupos de cualquier tamaño.
- **Búsqueda de equipos:** se lanza 350 ms después de dejar de escribir. No borra los espacios que estás tecleando.
- **Pie de filtros:** muestra el número de resultados y "Limpiar filtros (n)" cuando hay alguno activo.
- **Respuestas antiguas:** un contador (`requestId`) descarta lo que llega de peticiones viejas cuando cambias los filtros muy rápido.
- **Estado vacío:** tiene acciones (limpiar filtros, crear grupo o crear equipo).

### Crear grupo LFG (`lfg-board`)

- Solo el **tamaño** es obligatorio.
- **Título opcional:** si se deja vacío se usa uno generado, como «Busco Duo · Gold · Duelist».
- El rango mínimo es un select y el karma mínimo se elige entre Sin mínimo, 3+ y 4+.
- **"Más opciones"** (plegado): la descripción y los compañeros que ya juegan contigo.
- Al publicar te lleva al detalle del grupo nuevo.
- **Bug corregido:** "Sin mínimo" de karma no enviaba nada y el backend aplicaba su valor por defecto, 3. Ahora siempre se envía `minKarma`.
- Si el formulario se abre con `?create=1`, espera a que se restaure la sesión antes de decidir. Después quita `create` de la URL.

### Crear equipo (`teams`)

- Se puede crear solo con **nombre y tag**.
- El **tag se genera solo** con las iniciales del nombre ("Phantom Esports" → "PE") hasta que lo escribes a mano.
- La región y el rango objetivo vienen de tu perfil.
- "Reclutando" viene marcado por defecto.
- **"Más opciones"** (plegado): la descripción y los jugadores iniciales.

### Componente nuevo: `shared/user-picker`

- Buscador de jugadores con autocompletado. Espera 300 ms tras dejar de escribir y necesita al menos 2 caracteres.
- Los elegidos aparecen como chips que se pueden quitar.
- Tiene un límite configurable (`[max]`).
- Se usa con `[(selected)]` en los formularios de grupo y equipo. Sustituye a las dos implementaciones distintas que había.
- En `models/user.model.ts` se ha añadido `VALORANT_RANKS`, que sustituye a las 3 listas de rangos repetidas.

## 4. Verificación

- `ng build` (desarrollo y producción) compila sin errores.
- Revisado en el navegador, en escritorio y en móvil (375px):
  - home (con y sin sesión), jugadores, LFG, equipos y login;
  - el formulario de crear grupo con el buscador de compañeros;
  - el menú móvil.
- **Limitación:** la API desplegada en Render no respondía (se agotaba a los 60 s). Por eso la interfaz se probó con una **API falsa local**, con datos inventados, que quedó en el scratchpad y no en el repo. **No se ha probado contra el backend real.**

### Pendiente de comprobar con el backend real

- Crear un grupo con karma "Sin mínimo" y confirmar que se guarda como 0.
- Crear un equipo con jugadores iniciales.
- Volver a la página correcta tras el login (`returnUrl`) desde una ruta protegida.

## 5. Estado en git

- El trabajo principal está en el commit `5d203a2` de la rama `redesign-valorant`. La rama `migrate-supabase` sale de ese mismo commit.
- Tres arreglos posteriores se hicieron **después** de ese commit y se quedaron sin commit en la carpeta de trabajo:
  - `client/src/scss/components/_navbar.scss`: cajón móvil con `transform`, sin `backdrop-filter` en móvil y CTA primero.
  - `client/src/scss/global/_typography.scss`: `font-synthesis: none`.
  - `README.md`: la línea de "Diseño" ahora describe el estilo Valorant.
