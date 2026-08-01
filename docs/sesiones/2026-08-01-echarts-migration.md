# Sesión 2026-08-01 — migración de gráficos a ECharts (parcial)

- **Rama:** `claude/echarts-migration-rofo-n7xvi9` · **PR:** #115 (base `main`)
- **Objetivo pedido por Lautaro:** migrar TODOS los gráficos del sitio (motor SVG a mano +
  Recharts) a Apache ECharts, con un estándar visual único, sin tocar ninguna lógica de datos/
  fórmulas — solo presentación. Migración incremental, chart por chart, con pausa para validar
  cada uno antes de seguir.

## Hecho

**Fase 0-2 (antes de esta sesión, en la misma rama):** inventario de los ~17 charts del sitio,
infraestructura base (`src/charts/RfChart.tsx` componente único + `src/charts/rofoTheme.ts` con
los temas claro/oscuro copiados de los tokens reales de `globals.css`), reglas de Fase 2 (paleta
categórica validada, degradé de área solo en serie única, leyenda obligatoria 2+ series, etc.).
Migrados: `EvolucionChart`, `DolarFuturoChart`.

**Esta sesión (2026-08-01):**
- **Fix real: artefacto de la marca de agua en tema oscuro.** La "A" (y letras con hueco similar)
  de "ROFO AGRO" en la marca de agua salía con un relleno gris sólido en vez de hueco transparente,
  intermitente. Aislado con un `echarts.init()` mínimo sin React: reproducía igual, no
  determinístico, y desaparecía a `opacity:1` — es un bug real del decodificador SVG-a-canvas de
  Chromium con paths compuestos + alpha. Fix: PNG pre-rasterizado offline con `sharp`/librsvg (no
  Chromium) en vez del `.svg` directo — `public/rofoagro-logo-marca-{claro,oscuro}.png` nuevos.
- **Fix real: locale es-AR para ECharts.** Sin locale, los ejes de tiempo mostraban meses en
  inglés ("Jul/Oct/Apr" en vez de "JUL/OCT/ABR") y el toolbox decía "Save as Image". Nuevo
  `src/charts/rofoLocale.ts`, registrado una sola vez, heredado por todos los charts de tiempo.
- **Charts migrados:** `WilliamsChart` (camiones, 2 modos: calendario + por campaña),
  `NegociadoChart` (comercio), `EvolucionParticipacionChart` (zonas-panel, % por zona),
  `OverlayChart` + `FenologiaChart` (condicion-panel), `CamionesChart` (Agroentregas, "Pulso
  diario Up River" — encontrado durante la sesión, no estaba en el inventario original),
  `DolarOficialChart` (mini-serie, ídem), `DolarOficialSemanalChart` (combo línea+barra doble
  eje), `DolarOficialVolatilidadChart`, `VolumenPanel` (subpanel de `/graficos`).
- **Fix de infra en `RfChart.tsx`:** soporte real de doble eje Y. `deepMerge` reemplazaba arrays
  enteros (no los mergeaba elemento a elemento) — un `yAxis` de 2 elementos perdía los defaults
  compartidos (fuente mono, hideOverlap, scale) enteros. Ahora se inyectan a mano antes del merge
  final; beneficia a cualquier chart de doble eje futuro, no solo a los de esta sesión.
- **Colores corregidos (violaciones reales de la regla "oro solo como acento"):** `NegociadoChart`
  pintaba Industria en dorado como color de serie completa; `WilliamsChart`/zonas-panel reusaban
  hex viejos que ya habían fallado el validador de la skill `dataviz` en `EvolucionChart`. Las 4
  zonas de camiones y el bolsón "Resto" de zonas-panel/condicion-panel quedaron sin CSS a mano —
  paleta categórica de RfChart o gris (`p.ink3`) para bolsones agregados, según el caso.
- **Bug real encontrado y arreglado en `VolumenPanel`:** el tooltip mostraba "NaN" — los datos
  van como tupla `[x,y]` en un eje de valor, y el formatter custom no la desempaquetaba (mismo
  criterio que ya usa el formatter default de RfChart para series con arrays).

## Decisiones tomadas (y por qué)

- **CamionesChart (Agroentregas, "por grano") se mantiene como LÍNEA, no barra agrupada** —
  Lautaro preguntó por qué no un histograma; se evaluó (los datos de hoy son muy esparcidos,
  arrancó hace días) pero se decidió línea porque estructuralmente son 3 series año-a-año
  (hoy/hace 1 año/hace 2 años) que la ingesta diaria va a densificar con el tiempo — mismo caso
  que "por campaña" de Williams, que también quedó en línea.
- **Legend siempre visible en `OverlayChart`** (condicion-panel), aunque tenga muchas campañas
  históricas en gris idéntico entre sí — se prefirió no pelear la regla no-negociable de RfChart
  ("legend para 2+ series") con un pseudo-legend de 2 buckets; el resultado real (nombrar cada
  campaña, aunque redundante visualmente) es más informativo que menos, no una regresión.
- **Paleta categórica de RfChart en vez de los hex a mano** en zonas/camiones donde no había otro
  consumidor de esos colores en el sitio (verificado con grep antes de tocar cada uno) — se
  preservó el color a mano SOLO donde había una convención cruzada real (ej. `--camp-{año}` en
  Williams "por campaña", que Lautaro ya usa en `/graficos`).

## Verificado

- lint / typecheck / build / **426 tests** — verde en cada commit de esta sesión.
- Playwright real contra `npm run start`/`npm run dev`, claro y oscuro, mobile 390px sin scroll
  horizontal, en cada chart migrado.
- Páginas solo-mesa (`/produccion/zonas`, `/produccion/condicion`, `/comercio/negociado`) con
  bypass temporal de `requireAdmin()` + datos sintéticos en memoria (el sandbox de esta sesión no
  tenía credenciales reales de Supabase) — revertido en cada caso, `git diff` limpio antes de
  commitear.
- `VolumenPanel`: el preset real de `/graficos` no tenía volumen/OI cargado en los datos de este
  sandbox para ningún combo probado (dato del entorno, no del código) — verificado con un demo
  temporal (`src/app/(site)/rfdemo-vol`, creado y borrado en la misma sesión).

## Quedó pendiente / en vuelo

**Charts sin migrar (quedan en SVG a mano o Recharts):**
- `src/components/spread-chart.tsx` — **el más grande e importante**: motor principal de
  `/graficos` (2 modos Campañas/Período, presets, banda histórica min-máx-mediana, percentil,
  media móvil). Recharts. No se llegó a tocar esta sesión.
- `src/components/bcra-mulc-chart.tsx` — compras netas BCRA (MULC), `/dolar/cambiario`.
- `src/components/implicitas-chart.tsx` — implícitas combinadas, `/dolar/implicitas`.
- `src/components/calc-fijar.tsx` — gráfico inline de la calculadora "A fijar" (doble eje TNA/Δ).
- `src/components/calc-estrategias.tsx` — payoff de estrategias combinadas.
- `src/components/camiones/empresas-histograma.tsx` — histograma horizontal "quién recibe"
  (`/comercio/camiones`), barras a mano sin ChartMarca.

**Limpieza final (recién cuando lo de arriba esté migrado, no antes — así lo pidió el prompt
original):**
- Borrar `src/components/chart-svg-base.tsx` (el motor SVG compartido — ya sin consumidores del
  grupo original, pero se dejó vivo por si algo de la lista de arriba lo termina necesitando).
- Sacar la dependencia `recharts` de `package.json` (solo queda `spread-chart.tsx` usándola).
- Revisar `.cam-*`/`.org-*` y otras clases CSS que quedaron huérfanas en `globals.css` al migrar
  cada chart (no se tocó CSS esta sesión a propósito, siguiendo el mismo criterio "limpiar recién
  al final").
- **Fase 4** (coherencia tipográfica en `ChartTabla`, aplicar la misma tipografía mono de los ejes
  a las celdas de tabla) — no arrancada, es la última fase del prompt original, después de que
  todos los charts estén en RfChart.

## Trampas descubiertas (para la próxima sesión)

- **El artefacto de marca de agua NO era de React/timing — era Chromium.** Antes de asumir que es
  un problema de efectos/lifecycle, aislar con un `echarts.init()` sin React (ver el commit del
  fix): ahorra mucho tiempo de debugging en la dirección equivocada.
- **`deepMerge` de RfChart reemplaza arrays enteros** — cualquier chart nuevo con `yAxis`/`xAxis`
  como array (doble eje) necesita que los defaults se inyecten a mano ANTES de pasarlos a
  `option` (ya resuelto en `RfChart.tsx`, pero tenerlo en cuenta si se toca esa lógica de nuevo).
- **`value` en los params del tooltip es la tupla `[x,y]` entera**, no solo `y`, cuando la serie
  usa datos `[x,y]` (eje de valor, no categórico) — desempaquetar siempre `value[1]` en
  formatters custom, mismo criterio que ya usa el default de RfChart.
- **Playwright + `fullPage:true` + el masthead sticky/translúcido produce una imagen "fantasma"**
  (contenido de más arriba en la página se ve mezclado/traslapado con el header) — no es un bug
  de la web, es el propio masthead con transparencia mostrando lo que quedó atrás al hacer scroll;
  confirmado reproduciéndolo también en páginas no tocadas esta sesión. Para verificar un chart
  puntual, mejor un screenshot NO-fullPage con `scrollIntoView` antes.
- Para páginas solo-mesa sin credenciales reales de Supabase en el sandbox: bypass de
  `requireAdmin()` + datos sintéticos armados a mano en el propio `page.tsx` (nunca tocar la lib
  de datos real) — más rápido que perseguir credenciales, y el `git diff` queda limpio con
  cuidado de revertir ambos archivos.

## Próximo paso

Ejecutar el mismo prompt de migración, retomando por `spread-chart.tsx` (el más grande) y después
los 5 charts chicos que quedan. Recién con TODO migrado: borrar `chart-svg-base.tsx`, la
dependencia `recharts`, y arrancar la Fase 4 (tipografía de `ChartTabla`).
