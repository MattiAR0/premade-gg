# Registro de cambios

Cambios del proyecto, del más reciente al más antiguo. Las normas para mantener este archivo están en [`CLAUDE.md`](CLAUDE.md). Los registros anteriores están en `REDISENO-VALORANT.md` y `MIGRACION-SUPABASE.md`.

---

## 2026-10-24 · Invitados y primer uso (paso 5 de la revisión de diseño)

**Commit:** sin commitear

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
