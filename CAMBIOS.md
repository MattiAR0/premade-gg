# Registro de cambios

Cambios del proyecto, del más reciente al más antiguo. Las normas para mantener este archivo están en [`CLAUDE.md`](CLAUDE.md). Los registros anteriores están en `REDISENO-VALORANT.md` y `MIGRACION-SUPABASE.md`.

---

## 2026-10-25 · Escala tipográfica y roles de color (segunda ronda, paso 5)

**Commit:** este commit

**Qué y por qué:** había unos 38 tamaños de letra distintos (22 solo en la portada, alguno de 9,6 a 11,5px) y 39 colores hex sueltos fuera de `_variables.scss`. Además, los Riot ID y los nombres de equipo salían en mayúsculas y se perdía cómo se escriben.

**Cambios:**
- `_variables.scss`:
  - Escala `$font-size-2xs` … `$font-size-6xl`: 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36 y 52px. Para el hero, `$font-size-display` (72px) y `$font-size-display-lg` (96px).
  - El mínimo es 12px.
  - Roles nuevos: `$color-danger-text` (#ff6b76), `$color-warning`, `$color-info`, `$color-team` y `$color-text-bright`.
- 268 `font-size` en rem pasan al paso más cercano de la escala, en 28 SCSS (componentes, páginas, `_mixins` y `_typography`). Todo lo que bajaba de 12px sube a 12px. `ui-label` pasa de 0,78 a 0,8125rem.
- 39 hex sueltos pasan a roles: #ff6b76, #9a8cff, #2fd8b0, #f5c451, #5aa9ff, #8a96a3 y los `#fff` de hover. El fondo de `styles.scss` usa `$color-bg-dark`.
- `text-transform: none` en los nombres propios: `.c-player-card__name`, `.c-team-card__name`, `.c-profile__name`, `.c-team-detail__name` y los títulos de grupo (`.c-lfg-card__title`, `.c-detail__title`).
- `.c-detail__title`: con la escala, móvil y escritorio quedaban iguales; en escritorio sube a 28px para mantener la jerarquía.

**Verificación:**
- Portada: de 22 tamaños distintos (mínimo 10,88px) a 12 (mínimo 12px).
- A 375px, en 10 páginas (portada, listados, perfil, detalle LFG, detalle de equipo y acceso): sin scroll horizontal y ningún texto por debajo de 12px.
- "Player10#EUW", "Test Team Alpha" y "Busco trío chill" conservan sus mayúsculas y minúsculas.
- Contraste medido sobre `bg-card` (#16232f):
  - `danger-text` 5,79:1 (6,11:1 sobre el fondo de `.c-error`)
  - `team` 5,75:1
  - `warning` 9,8:1
  - `info` 6,5:1
- Build sin errores y consola limpia.

**Pendiente:**
- Quedan sin tocar los archivos nuevos de la migración (`oauth-buttons`, que tiene los colores de marca de Discord) y el `#fff` de la máscara de `gradient-border` (`_mixins.scss`), que es funcional.
- `_navbar.scss` y `_typography.scss` también tienen cambios de la migración: al commitear, preparar solo los bloques de este paso.

---

## 2026-10-25 · Lectores de pantalla y teclado (segunda ronda, paso 4)

**Commit:** `3129148`

**Qué y por qué:** al cambiar de página el foco se quedaba en el enlace pulsado, los títulos eran genéricos ("Perfil · PremadeGG"), los mini-avatares de las tarjetas LFG se anunciaban como "T", las pestañas de tamaño medían 9,6px en móvil y los errores no se anunciaban.

**Cambios:**
- `app.ts` y `app.scss`: al cambiar de ruta (no al cambiar filtros), el foco pasa al `h1` de `main` con `tabindex="-1"`. Si la página aún carga datos, espera en `#contenido` y pasa al `h1` cuando aparece, salvo que el usuario ya haya movido el foco. Sin anillo en ese `h1`, que no es un control.
- Títulos con nombre (`Title`): "Busco trío chill · PremadeGG", "Player1#KR1 · Jugadores · PremadeGG", "Test Team Alpha · Equipos · PremadeGG" (`lfg-detail`, `profile`, `team-detail`).
- `lfg-card`:
  - Los mini-avatares llevan `tabindex="-1"` y `aria-hidden="true"`; siguen siendo clicables con ratón.
  - El recuento se lee "1/5 jugadores" (texto `u-sr-only`).
- `lfg-board`:
  - Las pestañas de tamaño pasan de `<nav>` a `<div role="group" aria-label="Tamaño de grupo">`, porque filtran y no navegan.
  - `.c-tabs__size` sube a 0,75rem (12px) también en móvil.
- `role="alert"` en `.c-auth-card__error`, `.c-error`, `.c-detail__feedback--err` y `.c-modal__error` (login, registro, recuperar y nueva contraseña, portada, listados, detalle LFG, perfil y modales de equipos). Se deja fuera el aviso fijo de "Enlace inválido".

**Verificación:**
- Navegador a 375px:
  - Tarjeta → detalle, detalle → perfil y listado → equipo: el foco acaba en el `h1` con el nombre y el título de la pestaña cambia.
  - Del pie a `/lfg`: el foco va al `h1` "Grupos LFG". Al pulsar una pestaña de tamaño el foco se queda en ella.
  - Las 4 pestañas caben a 12px (86px cada una, sin desbordar). Contraste del texto de tamaño: 5,03:1.
  - Avatares con `tabIndex` -1 y `aria-hidden`.
- Build sin errores y consola limpia.

**Pendiente:** los `role="alert"` no se han visto disparar: los errores necesitan forzar un fallo del servidor o iniciar sesión.

---

## 2026-10-25 · Móvil: filtros plegables y cabecera compacta (segunda ronda, paso 3)

**Commit:** `8195eee` (solo frontend; las migraciones SQL van con el commit de la migración a Supabase)

**Qué y por qué:** a 375px los filtros y la cabecera ocupaban casi toda la primera pantalla: la primera tarjeta de `/players` empezaba en y≈712 y el panel de filtros de `/lfg` terminaba en y=673.

**Cambios:**
- `scss/components/_page.scss`, por debajo de `sm` (576px):
  - `.c-page-header`: título y acción ("Crear grupo", "Crear equipo") en la misma fila; se oculta `__desc`.
  - `.c-filters`: el contenido va en `__body` y se pliega. El pie (recuento) pasa arriba con el botón `__toggle` "Filtros (n)", con `aria-expanded` y `aria-controls`.
  - Plegado se oculta "Limpiar filtros" (el botón ya dice cuántos hay); abierto baja a su propia línea.
  - `.c-filters .c-chips`: una sola fila con scroll horizontal que llega al borde del panel, con 4px de relleno vertical para no recortar el anillo de foco. Los chips de la portada no cambian.
- `lfg-board`, `players` y `teams`: `<div class="c-filters__body">` alrededor de las filas, botón en el pie y propiedad `filtersOpen`.
- En escritorio no cambia nada: el botón no se muestra y el cuerpo siempre está abierto.

**Verificación:**
- Navegador a 375px, sin scroll horizontal:
  - `/players`: la primera tarjeta empieza en y=252 (antes ≈712); el panel plegado mide 71px. Abierto, los roles van en una fila con scroll.
  - `/lfg?rank=Silver&karma=3`: "Filtros (2)" y la primera tarjeta en y=305 (antes el panel acababa en y=673).
  - `/teams?region=eu&recruiting=1`: "Filtros (2)" en la misma fila que el recuento.
- A 1024px el panel se ve como antes, con la descripción de la cabecera.
- Build sin errores y consola limpia.
- Para probar `/lfg` se reinsertaron en la base local los 10 grupos del seed: el cron `delete … where expires_at < now()` los había borrado al caducar (24 h).

**Pendiente:** el panel se pliega de nuevo al cambiar de página; no se guarda el estado.

---

## 2026-10-25 · Documento de traspaso

**Commit:** no se commitea (documento de trabajo local)

**Qué y por qué:** pasar la segunda ronda de la revisión de diseño a otro agente.

**Cambios:**
- `TRASPASO.md` (nuevo) recoge:
  - El estado de git y cómo no mezclar la migración a Supabase.
  - El trabajo sin commitear de los pasos 1 y 2.
  - Los pasos 3 a 6 pendientes.
  - Cómo verificar y las trampas conocidas (CRLF, archivos mezclados, Docker).

---

## 2026-10-25 · Karma donde se decide (segunda ronda, paso 2)

**Commit:** `8195eee` (solo frontend; las migraciones SQL van con el commit de la migración a Supabase)

**Qué y por qué:** el karma no aparecía en los momentos de decidir. Faltaba en el detalle LFG, el tablero no filtraba por él y en la tarjeta LFG iba en el pie. Además, el rango del creador salía junto a "Mín. Oro" y no se sabía de quién era cada dato. Se pidió karma y rango al mismo nivel.

**Cambios:**
- `supabase/migrations/20261025000002_lfg_filters.sql` (nueva): `get_lfg_posts` gana dos filtros, con el mismo orden y cursor.
  - `p_my_rank`: grupos sin rango mínimo o con un mínimo igual o inferior a ese rango (el enum está ordenado).
  - `p_min_author_karma`: karma mínimo del creador.
  - Se mantiene `p_min_rank` (igualdad) por compatibilidad.
- Tablero `/lfg`:
  - Filtros "Tu rango" (select) y "Karma del creador" (Cualquiera / 3+ / 4+ / 4,5+), sincronizados con la URL (`?rank=` y `?karma=`).
  - "Limpiar filtros (n)".
- `lfg-card`:
  - La fila "Creador" muestra rango, karma (sm) y región juntos.
  - Los requisitos van aparte: "Exige Bronce o más · karma 3+".
  - El karma sale del pie.
  - Nuevo `@Input() showStatus`: el badge "Abierto" se oculta cuando el contexto ya lo dice (filtro "Abiertos" y portada).
- `player-card`: rango y karma en la misma fila (`__standing`). El karma grande de la derecha desaparece.
- `lfg-detail`:
  - Rango y karma del creador juntos en la cabecera.
  - Cada miembro aceptado muestra su karma.
  - Fuera el bloque "Rango" suelto, que no decía de quién era.
- `karma-badge`: en tamaño sm, una cuenta sin valoraciones muestra "Nuevo" (antes un guion).
- `/players`: "4.5+" pasa a "4,5+".

**Verificación:**
- Migración aplicada y `npm run db:test` en verde (16/16).
- RPC: con "Tu rango Plata" salen 5 de 10 grupos (los que exigen Hierro, Bronce o Plata); con karma ≥ 4, 5.
- Navegador:
  - `/lfg?rank=Silver&karma=3` recupera los filtros de la URL, muestra 4 grupos, "Limpiar filtros (2)" y ningún badge "Abierto".
  - Detalle: "Radiante · Karma 4,5 · 2 valoraciones" en el creador y karma en los miembros.
  - En `/players`, rango y karma en la misma fila.
  - Sin desbordamiento a 375px.
- Build sin errores.

**Pendiente:** en móvil el panel de filtros de `/lfg` es más alto (termina en y=673); los filtros plegables del paso 3 lo resuelven.

---

## 2026-10-25 · Karma con pruebas (segunda ronda, paso 1)

**Commit:** `8195eee` (solo frontend; las migraciones SQL van con el commit de la migración a Supabase)

**Qué y por qué:** la segunda crítica (26/40) detectó que el karma no demostraba nada. Todas las cuentas empiezan con 5,0, así que "Top jugadores" eran en realidad jugadores sin valorar, y las valoraciones usaban otro lenguaje visual (estrellas).

**Cambios:**
- `supabase/migrations/20261025000001_review_count.sql` (nueva):
  - Columna `profiles.review_count`, rellenada con las valoraciones existentes.
  - `recalculate_karma()` mantiene karma y recuento juntos.
  - `user_json` expone `reviewCount`.
  - `get_users` gana el filtro opcional `p_min_reviews` (mismo orden y cursor).
  - Es una migración aparte para aplicarla con `migration up` sin borrar la base local.
- `karma-badge`:
  - Nuevo `@Input() count`.
  - Con 0 valoraciones muestra "Nuevo" / "Sin valoraciones": sin número, segmentos vacíos y color neutro.
  - Con alguna valoración añade "N valoraciones" en los tamaños md y lg.
  - El `aria-label` incluye el recuento.
  - Los segmentos vacíos llevan un contorno de 1px en `$color-text-subtle` (antes 1,4:1).
- `[count]` se pasa en la tarjeta de jugador, el perfil, la tarjeta LFG y los miembros del detalle LFG. `User.reviewCount` es opcional en el modelo.
- `api.service`: `getUsers({ minReviews })`. Solo envía `p_min_reviews` si se usa.
- Portada:
  - "Top jugadores" pide solo jugadores con al menos una valoración y desempata por número de valoraciones.
  - El total del hero sale de otra petición.
  - Textos más claros: "Tus compañeros te puntúan de 1 a 5 y tu karma es la media…", "Mejor karma con al menos una valoración".
  - Nuevo estado vacío para cuando nadie tiene valoraciones.
- Perfil:
  - Las estrellas pasan a segmentos (`.c-rating`) con los colores del karma y `aria-label` "Puntuación N de 5".
  - El formulario usa 5 botones numerados (`.c-rating-input`) con `aria-pressed` y 44px en táctil.
  - "Eliminar mi review" pasa a "Eliminar mi valoración".

**Verificación:**
- Migración aplicada con `npx supabase migration up`.
- `npm run db:test`: 16/16 en verde.
- `review_count` cuadra con las 50 valoraciones: 0 descuadres en 23 jugadores, 19 con alguna valoración.
- Trigger probado en una transacción con rollback: karma 5,0 y 0 valoraciones → 2,0 y 1 tras insertar una de 2 → 5,0 y 0 tras borrarla.
- Navegador:
  - "Top jugadores" muestra solo jugadores valorados, con "1 valoración" / "3 valoraciones"; el hero sigue en 23 jugadores.
  - En `/players` las cuentas sin valoraciones salen como "Nuevo" con segmentos huecos.
  - El perfil muestra las valoraciones como segmentos con `aria-label` "Puntuación N de 5".
- Build sin errores.

**Pendiente:** el selector de puntuación del formulario necesita sesión iniciada; solo está comprobado compilando.

---

## 2026-10-24 · Repaso final (paso 7 de la revisión de diseño)

**Commit:** `bdaa01c`

**Qué y por qué:** cerrar las observaciones menores de la revisión de diseño.

**Cambios:**
- **Fuentes:** el `@import` de Google Fonts sale de `_typography.scss` (bloqueaba el render) y pasa a `<link>` con `preconnect` en `index.html`.
- **Títulos de página:**
  - Cada ruta tiene el suyo en `app.routes.ts` ("Grupos LFG · PremadeGG", "Perfil · PremadeGG"…).
  - El título por defecto pasa a "PremadeGG · Grupos de Valorant con reputación".
- **Etiquetas sobre los títulos:**
  - Fuera las que solo repetían el título: "Busca grupo", "Comunidad", "Competitivo", "En directo" y "Fichajes".
  - "Mejor karma" pasa a descripción bajo "Top jugadores" ("Ordenados por karma").
  - Se mantiene la del hero, que da contexto ("Valorant · Busca grupo" / "Hola, …").
- **`transition: all`:** se sustituye por las propiedades concretas en los inputs de las páginas de acceso, perfil, editar perfil, team-detail, `.c-badge` y las líneas del menú.
- **Tarjetas LFG llenas o cerradas:**
  - Dejan de usar `opacity`, que bajaba el contraste de todo el texto.
  - La cerrada usa un fondo más apagado y el título atenuado.
- **Badge de región en `lfg-detail`:** fuera su versión morada local; usa el badge neutro del sistema.
- **Registro y onboarding:** los `style="flex: 2"` en línea pasan al modificador `.c-auth-card__field--wide`.
- **Footer:** "Conecta. Juega. Gana." pasa a "Grupos de Valorant con reputación real.".

**Verificación:**
- Navegador: `document.title` cambia por ruta.
- `document.fonts.check` confirma que Anton y Barlow Condensed cargan desde el `<link>`.
- Solo queda la etiqueta del hero.
- Sin errores en consola.
- Detector: solo falsos positivos.
- Build sin errores.

**Pendiente:**
- No hay grupos cerrados en los datos de prueba, así que el nuevo estilo de tarjeta cerrada no se ha visto en pantalla.
- El estado vacío del filtro "Cerrados" invita a crear un grupo, cosa que no encaja con ese filtro.

---

## 2026-10-24 · Textos e idioma (paso 6 de la revisión de diseño)

**Commit:** `2fd7f48`

**Qué y por qué:** la UI mezclaba inglés y español: rangos ("Platinum"), roles ("Duelist"), horarios ("Evenings"), meses ("October 2026"), "Reviews", "Lv.", "LFT", "Looking for group"… y un texto de desarrollo en un estado vacío.

**Cambios:**
- `shared/pipes/label.pipe.ts` (nuevo): el pipe `label` traduce rango, rol y horario solo al mostrarlos. Los valores de la base de datos y de los filtros siguen en inglés, así que el backend no cambia.
  - Ejemplos: "Gold 2" → "Oro 2"; "Duelist" → "Duelista"; "Late Night" → "Noches".
  - Los valores desconocidos se muestran tal cual.
- Se aplica en: `rank-badge`, tarjetas de jugador y LFG, perfil, editar perfil, registro, onboarding, team-detail, `user-picker` y los selectores y chips de filtro de portada, LFG, jugadores y equipos.
- `app.config.ts`: `LOCALE_ID 'es'` con `registerLocaleData`. Las fechas salen en español ("octubre 2026") y los decimales con coma (karma "4,7").
- Textos:
  - "Reviews" pasa a "Valoraciones" en el título, los botones, los avisos y los mensajes de éxito y error.
  - "Lv." pasa a "Nv." y "Min:" a "Mín.".
  - El badge "LFT" pasa a "Busca equipo", en la tarjeta y en el perfil.
  - "Looking For Team (LFT)" pasa a "Busco equipo" en editar perfil.
  - El eyebrow "Looking for group" pasa a "Busca grupo".
  - El estado vacío de jugadores ya no dice "ejecuta el seed…".

**Verificación:**
- Navegador: chips "Duelista, Controlador, Iniciador, Centinela, Flex"; opciones de rango "Hierro…" con `value` en inglés; rango "Platino"/"Radiante"; "Busca equipo"; "Nv. 80".
- Perfil: "Miembro desde octubre 2026", "Valoraciones (1)", karma "2,0" con `aria-label` "Karma 2,0 de 5".
- Build sin errores.

**Pendiente:** los nombres de los agentes y "Duo/Trio/5-Stack" se dejan como en el juego.

---

## 2026-10-24 · Invitados y primer uso (paso 5 de la revisión de diseño)

**Commit:** `7ad796d`

**Qué y por qué:** quien entraba sin cuenta se encontraba con varios tropiezos:
- El detalle de un grupo LFG era un callejón sin salida, sin ningún botón.
- Las páginas nuevas se abrían con el scroll de la anterior.
- "Cómo funciona" estaba al final de la portada.
- El registro pedía 8 campos.

**Cambios:**
- `lfg-detail`: bloque para invitados cuando el grupo está abierto.
  - Explica que hace falta una cuenta y el karma mínimo del grupo, y que todas las cuentas empiezan con 5.
  - Botones "Inicia sesión para unirte" (principal) y "Crear cuenta", los dos con `returnUrl` al mismo grupo.
- `app.ts`: al cambiar de ruta se vuelve arriba al instante. Solo si cambia la ruta: los filtros cambian los query params y no mueven el scroll.
  - Se descartó `withInMemoryScrolling`, porque también subía la página con cada clic en un filtro.
- `home`:
  - "Cómo funciona" pasa justo detrás del hero, con un título visible.
  - Su botón "Crear cuenta gratis" pasa a secundario, para no competir con "Buscar grupos".
- `register`:
  - Fuera el campo "Horario de juego": por defecto es "Flexible" y se cambia en el perfil.
  - Se mantiene "Rol principal": no se puede editar después (el RPC `update_profile` no acepta `role`).
  - Tras registrarse se respeta `returnUrl` (solo rutas internas, contra redirecciones abiertas), también cuando termina en `/onboarding`.
- `login` ↔ `register`: los enlaces entre ambas páginas conservan `returnUrl` (`queryParamsHandling="preserve"`).

**Verificación:**
- Navegador: un invitado en `/lfg/:id` ve el bloque y los enlaces llevan a `/login?returnUrl=%2Flfg%2F…` y `/register?returnUrl=…`.
- Scroll medido: al abrir un perfil desde y=400 se pasa a y=0; un filtro de jugadores mantiene y=400.
- Portada: "Cómo funciona" está a 683px (antes, unos 1900).
- Registro: 7 campos y el enlace a login conserva `returnUrl`.
- Build sin errores.

**Pendiente:** no se ha probado un registro real de principio a fin (crea una cuenta en Supabase local); se ha revisado el código y la compilación.

---

## 2026-10-24 · Accesibilidad (paso 4 de la revisión de diseño)

**Commit:** `e48f476`

**Qué y por qué:** las tarjetas no se podían abrir con el teclado y no había forma de saltarse el navbar. Además, nada respetaba `prefers-reduced-motion`, los filtros no anunciaban su estado y los menús y modales no se cerraban con Esc.

**Cambios:**
- Tarjetas LFG, de jugador y de equipo:
  - El `routerLink` sale del `<article>` y pasa a un `<a class="c-card__link">` en el título. Su `::after` cubre toda la tarjeta (`_cards.scss`).
  - Ahora funcionan Enter, el clic central y "abrir en pestaña nueva".
  - La tarjeta muestra el anillo de foco cuando su enlace lo recibe.
  - Los enlaces y botones internos quedan por encima.
- `app.html` / `app.ts`: enlace "Saltar al contenido", visible solo con foco. Mueve el foco con JS porque `<base href>` haría que `#contenido` navegase a la portada.
- `_reset.scss`:
  - `prefers-reduced-motion: reduce` desactiva animaciones, transiciones y el scroll suave.
  - Nueva utilidad `.u-sr-only`.
- `aria-pressed` en todos los chips, segmentos y pestañas de filtro (portada, LFG, jugadores, equipos). El buscador de la portada deja de usar `role="tab"` sin paneles.
- Navbar:
  - Esc cierra el menú de usuario o el cajón móvil y devuelve el foco a su botón.
  - La etiqueta del botón alterna entre "Abrir menú" y "Cerrar menú".
- `shared/dialog/dialog.directive.ts` (nuevo, `appDialog`): al abrir un modal mete el foco dentro y lo atrapa con Tab. Esc lo cierra y, al cerrarse, el foco vuelve a donde estaba.
  - Se aplica a los modales de crear grupo, crear equipo, unirse a un equipo y eliminar equipo.
  - Los dos de team-detail ganan `role="dialog"` / `alertdialog` y `aria-modal`.
- `h2` solo para lectores de pantalla en las listas de LFG, jugadores y equipos, para no saltar del h1 al h3.
- Fuera las curvas con rebote: `$transition-spring` y el modal de team-detail usan `$ease-out-expo`.
- El título "Eliminar equipo" deja el `style` en línea y usa `.c-modal__title--danger`.

**Verificación:**
- Navegador, con el teclado:
  - El primer Tab muestra "Saltar al contenido". Enter lo activa sin cambiar de ruta y el siguiente Tab cae en "Crear grupo".
  - Tab llega al enlace de la tarjeta, la tarjeta muestra el anillo y Enter abre `/lfg/:id`.
  - Con `elementFromPoint` se comprobó que un clic en zonas vacías de la tarjeta va al enlace principal, y que el creador y los avatares siguen siendo enlaces propios.
  - Esc en el cajón móvil lo cierra y devuelve el foco.
- Detector: solo quedan falsos positivos (los `[src]` de Angular y la animación de "escribiendo…").
- Build sin errores.

**Pendiente:** los modales y el menú de usuario necesitan sesión iniciada; están comprobados compilando, no en pantalla. Tampoco se ha probado con un lector de pantalla real (NVDA o VoiceOver).

---

## 2026-10-24 · Móvil y tablet (paso 3 de la revisión de diseño)

**Commit:** `e48f476`

**Qué y por qué:** a 375px la página se desbordaba y se recortaba por la derecha. Además, la pestaña 5-STACK quedaba oculta, el CTA de la portada salía de la pantalla y había 29 áreas táctiles por debajo de 44px.

**Cambios:**
- `scss/global/_grid.scss`: las columnas usan `minmax(0, 1fr)`, así que un título largo ya no ensancha la columna (era la causa del desbordamiento). El margen lateral mínimo pasa de 8px a 16px.
- `scss/utilities/_mixins.scss`: nuevos mixins `touch` (`@media (pointer: coarse)`) y `touch-hit` (amplía la zona pulsable de un enlace sin mover el layout).
- En pantallas táctiles (`pointer: coarse`), 44px como mínimo en:
  - botones, chips y segmentos;
  - el botón de menú (antes 28×28) y el logo;
  - el botón de mensaje de la tarjeta de jugador;
  - los enlaces "por X" de las tarjetas, los del footer y "o publica tu propio grupo".
- En escritorio no cambia nada.
- `lfg-board`: por debajo de 576px las 4 pestañas (Todos/Duo/Trio/5-Stack) van en una rejilla de 4 columnas y siempre se ven.
- `home`:
  - En móvil, las tres cifras del hero van en una fila y los chips de tamaño en una rejilla de 4.
  - El hero tiene menos padding.
  - El botón "Buscar grupos" pasa de y=831 (fuera de pantalla) a y=706 en 375×812.
- `_navbar.scss`: entre 768 y 1023px los enlaces no se parten ("GRUPOS LFG" ya no salta de línea) y tienen menos aire.

**Verificación:**
- Navegador a 375×812 (móvil emulado con `pointer: coarse`): sin desbordamiento horizontal en `/`, `/lfg`, `/players`, `/teams`, `/login`, `/register` ni un perfil.
- Áreas táctiles medidas con JavaScript.
- Navbar comprobado a 800px.
- Escritorio a 1280px sin cambios (chips 35px, botones 33px).
- Build sin errores.

**Pendiente:**
- Los mini-avatares de 28px de la tarjeta LFG siguen por debajo de 44px. Se solapan entre sí y la tarjeta entera ya es pulsable.
- Falta probar en un móvil real (iOS/Android): esto es emulación de Chromium.

---

## 2026-10-24 · Reglas para Claude y registro de cambios

**Commit:** el mismo que añade este archivo.

**Qué y por qué:** dejar por escrito las convenciones del proyecto y obligar a documentar cada cambio en un solo sitio.

**Cambios:**
- `CLAUDE.md`: contexto del proyecto, la regla de mantener este registro, los roles de color y las normas de contraste, y la forma de trabajar (CRLF, commits limpios).
- `CAMBIOS.md`: este archivo, con las entradas del rediseño de color e identidad.

---

## 2026-10-24 · Identidad visual: karma y rangos (paso 2 de la revisión de diseño)

**Commit:** `ffdfd2c`

**Qué y por qué:** la revisión de diseño concluyó que la web parecía un kit genérico de Valorant y que el karma, que es la razón de ser del producto, era lo menos visible de cada tarjeta. Se convierte el karma en la firma visual de PremadeGG.

**Cambios:**
- `shared/karma-badge`: nuevo medidor con la etiqueta "KARMA", el valor en Anton y 5 segmentos inclinados que se rellenan en proporción (escala 0–5).
  - Colores por nivel: cian ≥3,5, oro ≥2,5 y rojo por debajo.
  - Tamaños `sm`, `md` y `lg`.
  - Lleva `aria-label` ("Karma 4,6 de 5") y un tooltip explicativo.
- `shared/rank-badge`: un color por tier (`$rank-colors`, de Hierro a Radiante, todos ≥4,4:1) con un rombo. Los valores desconocidos se muestran como "unranked".
- Tarjeta de jugador:
  - El karma pasa arriba a la derecha.
  - Rol, región y nivel quedan en una sola línea de datos.
  - Solo "LFT" se mantiene como etiqueta, ahora en cian.
- Tarjeta LFG: muestra el karma del creador en el pie.
- Perfil:
  - El karma va en un bloque grande aparte.
  - Los agentes favoritos muestran su retrato (`services/agent-icons.service.ts`, desde valorant-api.com, con caché en localStorage y vuelta al texto si falla).
- Las etiquetas de rol y región pasan a ser neutras en toda la app.

**Verificación:**
- Navegador: `/players`, `/lfg` y un perfil con karma 2.0.
- Los niveles oro y rojo y el relleno parcial se comprobaron con datos reales y simulados en el DOM.
- Build sin errores.

**Pendiente:** los nombres de rango y rol siguen en inglés (se traducen en el paso de textos).

---

## 2026-10-24 · Color y contraste (paso 1 de la revisión de diseño)

**Commit:** `ffdfd2c`

**Qué y por qué:**
- La revisión con `/impeccable critique` dio 24/40.
- El rojo `#ff4655` significaba marca, CTA, seleccionado, abierto, foco y error a la vez.
- El texto blanco sobre rojo (3,4:1) y `$color-text-subtle` (2,6–3,1:1) no pasaban AA.

**Cambios:**
- `_variables.scss`: roles semánticos `$color-brand`, `$color-on-brand`, `$color-selected`, `$color-on-selected`, `$color-focus`, `$color-positive`, `$color-danger` y `$color-hover-border`.
- Rojo reservado para el logo, el CTA principal, los errores, el peligro y los contadores de avisos.
- Botón primario con texto navy: 5,29:1.
- Selección (chips, segmentos, pestañas, enlace activo del navbar) y foco en hueso `#ece8e1`: 14,5:1.
- Estado "abierto" y barras de progreso en cian.
- `$color-text-subtle` de `#56646f` a `#7d8a96` (4,5–5,3:1 sobre los fondos oscuros).
- Fuera los elementos decorativos en rojo:
  - la franja bajo los títulos y el borde izquierdo de los filtros;
  - la barra superior de login, registro, recuperar contraseña y modales;
  - las franjas laterales de mensajes y notificaciones;
  - el brillo rojo al pasar el ratón por las tarjetas;
  - el "GG" con degradado;
  - los avatares de inicial en rojo.
- Tarjetas de auth con esquinas cortadas, como el resto del sistema.
- En el navbar, "Registrarse" y "Crear grupo" pasan a botón secundario para no competir con el CTA de cada página.
- La franja roja final de la portada pasa a ser neutra con un botón primario dentro.

**Verificación:**
- Contrastes medidos en el navegador con JavaScript.
- Foco visible comprobado con el teclado.
- Detector de impeccable: de 24 a 18 hallazgos (los restantes son falsos positivos o animaciones).
- Build sin errores.

**Pendiente:** mensajes, editar perfil y los modales solo se comprobaron compilando, porque necesitan sesión iniciada.
