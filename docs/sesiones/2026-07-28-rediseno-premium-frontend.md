# Sesión 2026-07-28 — Rediseño premium front/UI/UX

- **Rama:** `claude/premium-frontend-design-s3wmcs` · **PR:** #88 (base `main`)
- **Objetivo pedido por Lautaro:** llevar el front/UI/UX a un nivel "premium, >10K USD" —
  manteniendo la paleta de colores y los logos actuales, con tipografías propias (nada de
  Inter/Roboto genérico), transiciones/motion cuidadas y gráficos mejorados. Pedido explícito:
  "que no parezca IA genérica" y "trabajo 10/10, sin código redundante".

## Hecho

**Fase de diseño (maquetas, sin código)**: 3 direcciones completas maquetadas con datos reales
del proyecto y screenshoteadas (A «Sala de operaciones» dark/serif financiera Fraunces · B
«Research de banca privada» claro/editorial Newsreader · C «Panel de vidrio» glass moderno) +
specimen tipográfico de 4 sistemas (T1 «Argentina» Piazzolla+Rosario+Plex Mono · T2 «Sala»
Fraunces+Schibsted · T3 «Imprenta» Alegreya+Archivo · T4 «Carácter» Bricolage+Instrument) +
preview del híbrido A+B confirmado por Lautaro antes de tocar código real. Se instaló la skill
`ui-ux-pro-max` (de las 7 del bundle `nextlevelbuilder/ui-ux-pro-max-skill`, se conservó solo
esa — descartadas banner-design/brand/design/design-system/slides/ui-styling, generación de
banners/logos con IA externa, no aplican). Decisiones de Lautaro: híbrido A+B confirmado ·
tipografía **T1 «Argentina»** (Piazzolla, Huerta Tipográfica BA + Rosario, Omnibus-Type + IBM
Plex Mono) · alcance = todo el sitio en este PR · motion medio.

**Build (código real, 5 archivos tocados — el sistema por variables CSS pagó: todo el resto del
sitio, 70+ componentes, heredó el rediseño SIN tocarlos):**
- `src/app/layout.tsx`: Piazzolla + Rosario + IBM Plex Mono vía `next/font/google`
  (autohospedadas, cero red en runtime), reemplazando Inter + JetBrains Mono.
- `src/app/globals.css`:
  - Nueva variable `--font-display` (Piazzolla) sumada a `--font-ui`/`--font-mono` (mismos
    nombres que antes, solo cambia la fuente detrás — cero romper 70+ componentes).
  - `--font-display` aplicado quirúrgicamente donde es un titular editorial de verdad: wordmark
    del masthead/footer, `.panel-hd h2` (título de TODOS los paneles del sitio — el lever de
    mayor alcance), `.ht-feature-titulo` (hero de "Novedades del día"), `.hub-card-name`
    (tarjetas del tablero), `.prod-h1`, `.auth-title`, `.aviso-title`, `.lp-h1`/`.lp-h2`/
    `.lp-quote` (landing). Los NÚMEROS de mercado siguen SIEMPRE en mono (nunca display) —
    restricción deliberada, terminal financiera de verdad, ninguna tabla/KPI tocada.
  - Masthead: piel clara suma una regla doble editorial (`::before` nuevo, aditivo) bajo el
    filo dorado que ya existía (sin tocar la piel oscura, que ya tenía su firma).
  - Motion medio (todo gated en `@media (prefers-reduced-motion: no-preference)`, cae 100% al
    comportamiento de siempre si el usuario pidió menos movimiento): cinta con **marquee
    continuo** (pausa en hover/foco), entrada en cascada fade+rise para paneles/tarjetas
    (`:where()` de especificidad cero, no pisa estilos propios), transición de color suave al
    cambiar de tema en los elementos sin transition propia.
  - Ningún color/token de marca tocado (verdes ROFO/AGRO, oro, pos/neg — intactos).
- `src/components/cinta.tsx`: tanda duplicada (la 2ª `aria-hidden`, envuelta en `.ribbon-dup`
  con `display:none` por defecto y `display:contents` solo cuando el motion corre) para que el
  marquee loopee sin costura sin duplicar contenido visible con `reduced-motion`.
- `src/lib/chart-export.ts`: el nombre de fuente literal del watermark del export PNG
  actualizado a IBM Plex Mono (mismo patrón de fallback que ya tenía).

**Bug real encontrado y arreglado (no introducido por este rediseño, verificado contra el
código sin tocar antes de arreglarlo — ver «Trampas» abajo):** `DeltaChart` en
`calc-fijar.tsx` (calculadora "A fijar") usaba un viewBox chico (280×150) que al estirarse a
100% del ancho real del panel (~1300px) volvía gigantes los textos de 11/10px (factor de
escala ~4,4x). Fix: viewBox llevado a la misma convención que el resto de los charts del sitio
(640×240, como `dolar-futuro-chart`/`evolucion-chart`/`negociado-chart`) + `padB` 24→34 para
que la etiqueta de la barra de mayor magnitud no quede pegada al mes del eje.

## Decisiones tomadas (y por qué)

- **Híbrido A+B, un solo sistema de tokens con dos pieles** (no colores nuevos, misma variable
  `--bg`/`--ink`/`--gold` etc. con valores YA aprobados) — confirmado por Lautaro viendo el
  preview renderizado, no a ciegas.
- **Tipografía T1 «Argentina»** por sobre las otras 3 — elegida por Lautaro tras ver las 4 en
  specimen lado a lado.
- **Números SIEMPRE en mono, nunca en display** — decisión de diseño propia (no de Lautaro)
  para mantener la "terminal financiera de verdad" que ya documentaba CONTEXTO.md; el checklist
  del 10K pide restricción, no decoración por decoración.
- **`.panel-hd h2` en display** en vez de dejarlo en UI sans — es el lever de mayor alcance (todo
  panel del sitio) y es exactamente lo que Lautaro vio y confirmó en el preview del híbrido.
- **`.admin-h1` y los sub-headings de dashboard (`.sec-title`, `.estim-h3`, `.lu-h3`) se
  dejaron en UI sans** — registro utilitario, restricción deliberada (no todo título necesita
  ser serif).
- **Sin numeración `§01/§02` sitio-wide** (sí apareció en una de las maquetas) — sacada de la
  versión final: docenas de paneles independientes no son una secuencia real, la skill
  `frontend-design` advierte explícitamente contra numeración decorativa sin orden real.
- **`.plc-*`/`.sem-*` (placas de informe diario/PDF semanal) NO tocados estructuralmente** —
  son artefactos automatizados (Playwright los screenshotea/genera PDF para las Routines
  MP1/MP2); heredan la tipografía nueva vía las mismas variables `--font-mono`/`--font-ui` sin
  ningún cambio de código, cero riesgo de romper esas skills.
- **Colores de campaña (`--camp-*`, validados con el dataviz validator) y colores por
  organismo/zona (`--org-c`) NO tocados** — son un sistema aparte ya aprobado, fuera de alcance.

## Verificado

- `npx tsc --noEmit` ✅ · `npm run lint` ✅ · `npx vitest run` **205/205** ✅ (sin tocar ningún
  expect) · `npm run build` ✅ (46 páginas, Piazzolla/Rosario/Plex Mono resueltas en build).
- Navegador real (Playwright, Chromium headless, `NODE_USE_ENV_PROXY=1`, datos reales de
  Supabase): **home, granos, dólar, producción, gráficos, calculadoras, noticias, informes,
  bienvenida (landing), ingresar, comercio (hub), sin-acceso** — claro **y** oscuro, sin
  errores de consola en ninguna. Mobile 390px: home, granos, bienvenida, calculadoras, dólar,
  producción, noticias, calc-a-fijar — **cero scroll horizontal** en ninguna.
- Marquee de la cinta verificado en movimiento real (2 capturas con delay, el contenido se
  desplaza) + verificado que con `reducedMotion:'reduce'` (emulado por Playwright)
  `.ribbon-dup` da `display:none` y el track vuelve a su ancho de una sola tanda (sin
  duplicado visible al hacer scroll manual).
- El fix de `calc-fijar.tsx` verificado con el viewBox real inspeccionado en el DOM (640×240,
  antes 296×150) y las coordenadas Y de las etiquetas (218 vs 233, sin superposición real —
  confirmado con un recorte a resolución nativa, la superposición que parecía verse en la
  captura completa era un artefacto de la miniatura).
- **Páginas de mesa (`/comercio/*`, `/granos/view`, `/admin`) NO verificadas visualmente** —
  gatean con `requireAdmin()` siempre (independiente de `AUTH_ENFORCED`), sin sesión real en
  este sandbox no se puede entrar. Comparten los mismos componentes (`Panel`/`PanelHead`/
  `.tbl`/`.admin-*`) ya verificados en el resto del sitio — riesgo bajo, pero no confirmado con
  los ojos. Recomendado que Lautaro haga un vistazo logueado.

## Quedó pendiente / en vuelo

- Confirmar visualmente `/comercio/*`, `/granos/view`, `/admin` logueado (ver arriba).
- Feedback de Lautaro sobre el resultado final antes de sacar el PR de draft — el PR queda
  **draft** al cerrar esta sesión hasta que él lo revise, aunque todo lo verificable desde acá
  ya pasó.
- Si en una próxima vuelta se quiere ir más lejos: número protagonista con "cuenta hasta su
  valor" (requeriría un client component por número, invasivo en 70+ RSC — evaluado y
  descartado esta vez por el costo/beneficio) · transición de tema con View Transitions API
  (evaluado, se prefirió el fade de color CSS por menor riesgo en verificación headless).

## Trampas descubiertas (para la próxima sesión)

- **`npm run build` interrumpido a mitad (timeout del sandbox) puede corromper `.next`** de un
  modo que NO se nota en `next build` (sale "✓ Compiled successfully") pero sí al servir en
  producción: un chunk específico devuelve 500 con `Content-Type: text/plain` en vez del JS,
  y Chromium lo bloquea por MIME sniffing (`Refused to execute script ... strict MIME type
  checking`) — se manifestaba como "This page couldn't load" SOLO en algunas rutas/viewports
  (parecía un bug de la app, no lo era). Fix: `rm -rf .next` y rebuild limpio. Moraleja: si un
  build se cortó por timeout, no confiar en el próximo `npm run build` sin borrar `.next` antes.
- **Antes de reportar un bug visual como propio, comparar contra el código sin tocar** (`git
  stash` + rebuild + mismo request) — el bug de `calc-fijar.tsx` resultó preexistente
  (reproducible 1:1 en el código original), no introducido por este rediseño; verificarlo así
  evitó atribuirse (o negar) algo sin evidencia.
- Los thumbnails PNG a resolución reducida pueden hacer parecer que dos líneas de texto se
  solapan cuando en realidad hay un gap real de varios px — antes de reportar un "overlap"
  como bug, recortar la zona a resolución nativa (`page.locator(...).screenshot({clip})`) para
  confirmar.
