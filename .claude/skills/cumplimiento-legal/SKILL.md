---
name: cumplimiento-legal
description: Checklist legal para una web española con cuentas de usuario y contenido generado por usuarios (RGPD, LOPDGDD, LSSI-CE, cookies según la guía de la AEPD, DSA, menores, marcas de terceros). Usar cuando se revise o se redacte la política de privacidad, el aviso legal, los términos de uso, el banner de cookies, el registro de usuarios, las reseñas o la moderación de PremadeGG.
---

# Cumplimiento legal (España y UE)

PremadeGG es una plataforma con cuentas, perfiles públicos, reseñas entre jugadores (karma), mensajes y grupos. Lo operan personas físicas desde España y se aloja en Vercel (frontend) y Supabase (base de datos, auth, Edge Functions).

**Esto no es asesoramiento jurídico.** Sirve para detectar huecos y preparar borradores. Antes de presentar el producto a Riot o de monetizarlo, un abogado debería revisar los textos finales.

Antes de dar algo por bueno, contrasta la norma con la fuente oficial (BOE, EUR-Lex o la AEPD). Las guías cambian: si algo de esta lista no coincide con la fuente, manda la fuente.

## 1. Protección de datos (RGPD + LOPDGDD)

- [ ] **Política de privacidad** accesible desde el registro y el pie (arts. 13 y 14 RGPD). Debe incluir:
  - responsable del tratamiento y contacto;
  - qué datos se tratan: email, Riot ID, PUUID, rango, reseñas, mensajes, IP o logs;
  - finalidad y base jurídica de cada uno (contrato, consentimiento, interés legítimo);
  - plazos de conservación;
  - destinatarios y encargados: Supabase, Vercel, el proveedor de email y Riot Games si se usa RSO;
  - transferencias internacionales y su garantía (EU-US Data Privacy Framework o cláusulas contractuales tipo);
  - derechos (acceso, rectificación, supresión, oposición, limitación, portabilidad) y derecho a reclamar ante la AEPD.
- [ ] **Edad mínima.** En España, un menor puede consentir por sí mismo el tratamiento de sus datos a partir de los 14 años (art. 7 LOPDGDD). Hay que fijar la edad mínima en los términos y pedirla o declararla en el registro.
- [ ] **Encargados del tratamiento**: firmar o aceptar el DPA de Supabase y Vercel (art. 28). Elegir región UE en Supabase si es posible.
- [ ] **Supresión real**: el usuario puede borrar su cuenta y sus datos. Decidir qué pasa con las reseñas que escribió y con las que recibió, y documentarlo.
- [ ] **Datos sobre terceros**: las reseñas describen a otra persona. Ella tiene derecho a oponerse, a pedir rectificación y a denunciar la reseña. El karma es un perfil: comprobar que no produce decisiones automatizadas con efectos significativos (art. 22), por ejemplo bloqueos automáticos solo por karma.
- [ ] **Minimización**: no guardar más datos de la API de Riot de los que se muestran o usan.
- [ ] **Seguridad (art. 32)** y **brechas**: notificar a la AEPD en 72 horas. Tener un procedimiento escrito, aunque sea corto.
- [ ] **Registro de actividades del tratamiento (art. 30)**: recomendable mantenerlo aunque el proyecto sea pequeño, porque el tratamiento no es ocasional.

## 2. LSSI-CE (Ley 34/2002) y cookies

- [ ] **Aviso legal (art. 10)**: nombre o razón social, NIF, domicilio y email de contacto. Es obligatorio si hay actividad económica (publicidad, donaciones, suscripciones). Sin ella sigue siendo recomendable.
- [ ] **Cookies y almacenamiento local (art. 22.2)**: las técnicas o necesarias, como la sesión de Supabase en `localStorage` o la preferencia de tema, no necesitan consentimiento, pero se informan. Analítica, publicidad o vídeos embebidos de terceros sí lo necesitan, y antes de cargarse.
- [ ] Si hace falta banner (guía de cookies de la AEPD): botón "Rechazar" en la primera capa, igual de visible que "Aceptar"; nada de casillas premarcadas; poder retirar el consentimiento después; política de cookies con la lista de cookies, su finalidad, su duración y si son propias o de terceros.
- [ ] **Emails**: solo transaccionales (verificación, recuperación) sin consentimiento. Para newsletters o novedades, consentimiento aparte (art. 21).

## 3. Contenido de usuarios: DSA (Reglamento (UE) 2022/2065)

PremadeGG aloja contenido de usuarios (reseñas, mensajes de grupos, perfiles), así que es un servicio de alojamiento y probablemente una plataforma en línea. Las micro y pequeñas empresas están exentas de parte de las obligaciones de plataforma, no de las de alojamiento.

- [ ] **Punto de contacto** electrónico para autoridades y usuarios (arts. 11 y 12).
- [ ] **Términos de uso** con las normas de contenido, cómo se modera y qué sanciones hay (art. 14), en lenguaje claro.
- [ ] **Mecanismo de denuncia** de contenido ilegal, fácil de usar (art. 16): botón "Denunciar" en reseñas, perfiles y mensajes.
- [ ] **Motivar las decisiones** de moderación al afectado: qué se quitó, por qué y cómo recurrir (art. 17).
- [ ] Prohibir y vigilar el acoso y las reseñas falsas; tener medidas contra cuentas falsas que inflan o hunden el karma.

## 4. Marcas y propiedad intelectual

- [ ] No dar a entender que el producto es oficial o está avalado por Riot. Aviso de Riot en el pie (texto en la skill `politicas-riot`).
- [ ] Iconos de agentes, emblemas de rango y otros recursos de Valorant: solo dentro de lo que permite la política de Riot. Nada de logos de Riot como marca propia.
- [ ] Licencias de fuentes, iconos y librerías compatibles con el uso que se les da.

## 5. Otros

- [ ] **Accesibilidad**: la Ley 11/2023 (Acta Europea de Accesibilidad) obliga a ciertos servicios, sobre todo comercio electrónico, y exime a las microempresas. Aunque no aplique, se mantiene WCAG AA, como ya pide `CLAUDE.md`.
- [ ] **Consumidores**: si algún día hay pagos, harán falta condiciones de contratación, desistimiento y factura. Hoy no aplica si todo es gratis.
- [ ] **Coherencia de textos**: el pie, la landing y la documentación no deben decir cosas falsas. Por ejemplo, hoy el pie dice "Proyecto Final de Grado" y ya no lo es.

## Cómo informar

Devuelve una tabla con las columnas **Punto · Estado (cumple / no cumple / parcial / no aplica) · Evidencia (archivo:línea o URL) · Qué falta**. Ordena por riesgo, primero lo que bloquea presentar el producto a Riot. Cuando falte un texto legal, ofrece un borrador en español marcado como borrador.
