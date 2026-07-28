# Sesión 2026-07-28 — C25: biblioteca + menú lateral (sidebar)

- **Rama:** `claude/c25-biblioteca-sidebar-hzrmsf` · **PR:** #_ (base `main`)
- **Objetivo pedido por Lautaro:** ejecutar el prompt autocontenido de
  [`PLAN_SIDEBAR.md`](../PLAN_SIDEBAR.md) §5 — sacar la nav de arriba y pasar a un menú lateral
  fijo (biblioteca real: grupos desplegables, cada reporte con su propia página).

## Hecho

- **`src/lib/biblioteca.ts`** (nuevo): registro único del árbol — 1:1 con las 8 claves de
  `SECCIONES_META` (que no se toca), reusa `CALCULADORAS` para no duplicar esas 9. Expone
  `BIBLIOTECA`, `BIBLIOTECA_ADMIN` y `labelDeHref()` (breadcrumbs).
- **15 páginas nuevas** (cáscaras finas: `requireSeccion` + `PageHead` + el componente existente,
  cero fórmula/dato tocado): `granos/{arbitrajes,pases,caja,capacidad,monitor}`,
  `dolar/{futuro,oficial,linked,implicitas,sinteticos,cambiario}`, `comercio/djve`,
  `produccion/{calendario,estimaciones}`.
- **4 índices reformados a hub-grid** (generado del registro, patrón de `/calculadoras`):
  `/granos`, `/dolar`, `/produccion` (antes componían todos los paneles); `/comercio` sumó la
  tarjeta DJVE a su `PUBLICO` y perdió el `<DjvePanel/>` embebido. Componente
  `produccion-tabs.tsx` (E3 H8, ya no usado) borrado.
- **`src/components/sidebar.tsx` + `sidebar-provider.tsx` + `sidebar-toggle.tsx`** (nuevos):
  sidebar = biblioteca real (pedido literal: varios grupos abiertos a la vez, sin acordeón
  excluyente), fija en desktop (`position:sticky`), drawer en mobile (`≤880px`, foco atrapado,
  Escape/backdrop/botón × cierran, body-scroll lock). Grupo de la ruta activa siempre expandido
  (derivado en el render de `pathname`, no sincronizado con un efecto) + lo que el usuario dejó
  abierto a mano persiste en `localStorage`. Ítems `soloMesa` con 🔒 (mismo criterio que el hub de
  `/comercio` hoy — visibles con candado, la protección real la hace cada página con
  `requireAdmin()`).
- **`SiteHeader` mínimo**: perdió `<NavLinks/>` (murió, borrado — sin más importadores). Ahora:
  hamburguesa (mobile-only) + logo + rueda + tema + sesión.
- **`Breadcrumbs` reescrito** para leer del registro (`labelDeHref()`) en vez de 3 mapas a mano
  (`LABELS`/`COMERCIO_LABELS`/`getCalc`) — de paso corrige un caso que ya estaba roto (`/granos/view`
  mostraba el slug crudo "view" en la miga, ahora "View de mesa").
- **CSS nuevo** en `globals.css`: `.site-shell` (grid 2 columnas) + `.sidebar`/`.sb-*` (biblioteca,
  drawer, motion gated en `prefers-reduced-motion`, mismo patrón `@media (prefers-reduced-motion:
  no-preference)` que ya usa el resto del sitio) + `.hub-card-lock`. `.crumbs`/`.wrap` ajustados
  para vivir dentro del nuevo shell sin doble padding. Limpiado el `.nav`/`.prod-tabs` muerto.

## Decisiones tomadas (y por qué)

- **La cinta NO se movió al layout compartido** — el árbol del plan (§4) la nombraba junto al
  masthead ("arriba quedan solo logo, cinta…"), pero medido con un **build real** (comparado
  archivo por archivo contra un build de `main`), meter `getCintaData()` en el layout arrastraba
  **todas** las páginas a revalidar cada ~30-60s — incluidas las de mesa que hoy son 100%
  estáticas sin ISR (`/comercio/puertos`, `/granos/view`, etc.), violando la guarda dura explícita
  del prompt ("con el flag apagado, cero cambios de render, solo de navegación"). Se descubrió
  primero (build con la cinta movida, tabla de revalidate con "1m" en páginas que antes no tenían
  ninguna), se revirtió, y se volvió a buildear para confirmar que **cada ruta existente** queda
  con el mismo revalidate que en `main` (verificado línea por línea). La cinta se queda donde ya
  estaba (dentro de `(site)/page.tsx`, la home) — la sidebar cubre la navegación, que era el pedido
  real de Lautaro.
- **Sidebar admin-gating usa el `esAdmin` del layout (atado a `AUTH_ENFORCED`), no un chequeo
  dinámico por request.** `/comercio/page.tsx` ya hace `authConfigured() ? await getPerfil() : null`
  para sus tarjetas de mesa — pero eso lee cookies y hace DINÁMICA esa página en cuanto el login
  esté configurado (hoy ya lo está). Copiar ese patrón a la sidebar (que vive en el layout de TODAS
  las páginas) hubiera hecho dinámico el sitio entero. Se usa el `esAdmin` ya calculado por el
  layout (gratis, gated tras `AUTH_ENFORCED`) — hoy (flag apagado) los ítems 🔒 quedan ocultos en la
  sidebar para todos (mismo criterio que el link "Admin" de la nav vieja, que tampoco se veía hoy);
  en cuanto Lautaro prenda el login, se resuelve solo. Verificado con un bypass temporal
  (`esAdmin = true` a mano en el layout, revertido antes de cerrar) que la sidebar SÍ muestra los 6
  ítems de comercio + "View de mesa" + el grupo Admin completo cuando corresponde.
- **`marcarActivos()` sin `useSearchParams()`**: Gráficos tiene 2 modos al mismo pathname
  (`/graficos` y `/graficos?mc=periodo`) — usar `useSearchParams()` en la sidebar (compartida por
  TODO el sitio) hubiera exigido un `<Suspense>` en el layout, con el riesgo de un flash del
  fallback en cada carga de página. Se aceptó una simplificación: la sidebar resalta "Campañas"
  como el ítem del grupo (representa la página) sin distinguir el submodo por query — ni peor ni
  mejor que la nav vieja, que tampoco distinguía. Sí se corrigió un bug real que esto destapó: el
  breadcrumb SÍ pisaba mal la etiqueta ("Período" ganaba sobre "Gráficos" al armar el mapa
  href→label porque ambos ítems comparten el mismo pathname sin query) — arreglado con un guard en
  `biblioteca.ts` (mismo guard aplicado a "Pendientes" de Admin, que comparte href con el grupo).
- **`/produccion/calendario` sin el `<h2>` "Calendario cronológico"** que tenía como sub-tab: ya no
  hace falta, el título de la página (PageHead) ya lo dice.

## Verificado

- `npm run lint` / `npx tsc --noEmit` / `npx vitest run` (224/224, sin tests nuevos — cero lib
  tocada) / `npm run build` (60 rutas, todas 200) ✅.
- **Comparación de revalidate contra `main`** (build real de los dos, línea por línea): todas las
  rutas preexistentes que no cambié de composición mantienen el mismo revalidate/expire que en
  `main`; las únicas diferencias son las esperadas por partir páginas compuestas en índice+detalle
  (`/granos`, `/dolar`, `/produccion`, `/comercio` pasan a hub-grid puro → su revalidate ya no lo
  capea el panel que tenían embebido, sube a su propio valor declarado — menos regeneración, no
  más).
- **Playwright real** (`npm run start`, credenciales reales de Supabase del entorno), claro/oscuro
  (toggle real, no `colorScheme` de contexto — el tema es explícito vía `next-themes`, no sigue
  `prefers-color-scheme`), desktop 1280 + mobile 390: las 24 rutas públicas cargan 200 con datos
  reales (no placeholders); sidebar (expandir/colapsar grupos con persistencia, ítem activo,
  drawer mobile con foco atrapado, cierre por Escape/backdrop/botón/navegación); breadcrumbs
  correctos en cada nivel; cero scroll horizontal en mobile; cero errores de consola nuevos (el
  único error visto, `/informes` con un `ERR_CONNECTION_RESET` de la imagen firmada de Storage, es
  una limitación de red del sandbox — no toqué ese archivo).
- **Bypass temporal** (`esAdmin = true` a mano en `(site)/layout.tsx`, con `npm run dev` en otro
  puerto) para confirmar los ítems 🔒 (6 de Comercio + View de mesa de Granos) y el grupo Admin
  completo — revertido antes de cerrar, `git diff` de ese archivo limpio (confirmado).
- **`/granos/view`** (gateada con `requireAdmin`, sin tocar) sigue redirigiendo a
  `/ingresar?next=/admin` sin sesión — confirma que el bypass de la sidebar es solo cosmético
  (qué se lista), la protección real de cada página sigue intacta.

## Quedó pendiente / en vuelo

- Feedback de Lautaro sobre la sidebar en el Preview (primera vez que ve el menú lateral andando).
- Colapso de la sidebar a riel de íconos en desktop: quedó explícitamente fuera de v1 (plan §1).
- La grilla "Explorá el sitio" del home no se tocó (linkea a los mismos 8 índices, sigue vigente).

## Trampas descubiertas (para la próxima sesión)

- **Meter una fuente de datos en el layout compartido cambia el revalidate efectivo de TODAS las
  páginas**, no solo agrega un fetch redundante — Next.js reporta (y aplica) el MÍNIMO revalidate
  entre el `export const revalidate` de la página y cualquier `next:{revalidate}` de fetch
  encontrado durante esa render, en TODA la cadena de layouts. Antes de sumar algo "liviano y
  cacheado" al layout compartido, comparar el build contra el baseline (no alcanza con confiar en
  que `React.cache()` dedupea el costo — el problema no es el costo, es el cambio de cadencia).
- `next-themes` acá NO sigue `prefers-color-scheme` (`enableSystem={false}`, `defaultTheme="light"`)
  — para testear el tema oscuro con Playwright hay que clickear `.toggle`, no alcanza con
  `colorScheme: "dark"` en el contexto del browser.
- `useSearchParams()` en un componente que vive en el layout compartido de TODO el sitio exige
  `<Suspense>` ahí mismo — evitarlo cuando el dato es puramente cosmético (ver el caso de
  Gráficos arriba).
