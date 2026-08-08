# Sesión 2026-08-08 — C32/F1: base histórica del FAS teórico

- **Rama:** `claude/plan-calor-mercaderia-f1-yy7buy` · **PR:** #_ (base `main`)
- **Objetivo pedido por Lautaro:** ejecutar el PROMPT F1 de `docs/PLAN_CALOR_MERCADERIA.md` §5
  ("Comenza… hace todo lo que puedas sin el CSV") — adjuntar el CSV del FAS oficial de Agrochat
  quedó pendiente de su parte; se avanzó con TODO lo demás del prompt.

## Hecho
- **Punto 1 — parser BCR**: expuesto `fasSagyp` en `CapGrano` (`src/lib/capacidad.ts`), la
  columna "SAGyP" del bloque de GRANO (`filaBcr.fas`, sin tocar `parseBcr`/`parseBcrIndustria`
  ni ninguna fórmula existente).
- **Punto 2 — migración** `supabase/migrations/20260808120000_c32_f1_fas_historico.sql`:
  tabla `fas_historico` (fecha, producto, fuente, fas_usd/ars/tc) + RLS solo-admin (patrón
  `views_mercado`/`pas_zonas`) + revoke reforzado de default privileges (lección de C31). **Sin
  aplicar** — falta el OK de Lautaro.
- **Punto 3 — cron**: `scripts/ingest-fas.mjs` (3 de las 4 fuentes: sagyp/bcr_upriver/nuestro
  para los 5 granos + bcr_industria para soja) + `.github/workflows/ingest-fas.yml` (20:26 ART
  L-V, minuto ≠ :00) + alta en `healthcheck-frescura.mjs`/`catalogo.ts` (CHECKS + WORKFLOWS).
  Guard anti-0-filas. Probado en vivo con `--dry-run` contra BCR + FOB oficial reales (ver abajo).
- **Punto 4 — backfill**: **el CSV no llegó en esta sesión** (se pidió explícitamente arrancar
  sin él) → `scripts/cargar-fas.mjs` escrito y probado con una fixture sintética (`--check`),
  listo para correr en cuanto Lautaro lo suba. `src/lib/parse-fas.ts` (parser + checklist §4.3
  puntos 1-3, puro, 10 tests con fixture sintética — los números NO son reales, solo imitan el
  formato). Workflow dispatch-only `cargar-fas.yml` (mismo patrón que `cargar-compras.yml`).
- **Punto 5 — mapeo de productos**: `src/lib/fas-catalogo.ts` (CSV → catálogo interno: Soja→SBS,
  Maíz→MAIZE, Trigo Pan→WHEAT, Girasol→SFSEED, Sorgo→SORGHUM, Aceite de Soja→SBO, Aceite de
  Girasol→SFO, Cebada F→BARLEY, Cebada C→CEBADA_C sin código propio — documentado, no implícito).

## Hallazgo real: el punto 1 del prompt describía mal el código actual — corregido con evidencia
El prompt F1 decía "hoy se toma el 2º valor = Up River; el 1º es SAGyP" (implicando que
`fasBcr` de hoy es "Up River"). **Verificado contra el HTML real de BCR en vivo** (fetch real,
08/08/2026, columna por columna de las 3 filas "Puerto/Port"): el 1er y el último valor no-blanco
de cada fila "FAS Teórico" están BAJO la columna literalmente rotulada "SAGyP" (para ambos granos
del bloque) — el propio `capacidad.ts` ya lo documentaba así ("1. BCR: columna SAGyP de su
planilla") y la UI también ("FAS teórico que publica BCR, columna SAGyP"). Las columnas "Up River
25/26"/"Up River 26/27" del medio son FORWARDS a varios meses (nunca un spot único) y YA se
descartan hoy, sin cambios. Conclusión: `fasBcr` de hoy YA ES la columna SAGyP para 4 de los 5
granos — la única distinción real está en **girasol** (su `fasBcr` toma la sección Industria, no
el bloque de grano). `fasSagyp` se implementó para exponer siempre el valor de GRANO (incluido
girasol), que es lo que hace falta para cruzar contra la serie de Agrochat. Verificado en vivo
con `--dry-run`: soja `sagyp`==`bcr_upriver`==322,94 (misma columna) pero girasol `sagyp`=371,21
≠ `bcr_upriver`=479,60 (industria) — la distinción existe donde tenía que existir.

**Consecuencia importante para F2/F3**: el "sagyp" que este cron trae de BCR NO es un proxy
perfecto del verdadero FAS Teórico Oficial (el de la serie de Agrochat) — para SOJA en particular
ya se sabe que difiere ~17 USD (§4.2 del plan: 322,94 en BCR vs 339,98 en el CSV el 05/08), la
misma brecha que motivó la decisión "SOJA = VARA INDUSTRIA". Documentado en el docstring del cron.

## Trampa real encontrada (afecta también código YA mergeado) — import extensionless en scripts .mjs
Al intentar correr `ingest-fas.mjs` con Node plano (`node scripts/ingest-fas.mjs`, sin bundler),
`capacidad-bcr-parse.ts` rompía con `ERR_MODULE_NOT_FOUND` porque importa `./env-utils` SIN
extensión — Node exige extensión explícita en imports relativos, a diferencia de Next/webpack.
**Reproducido también contra `cargar-compras.mjs` (ya en producción)**: `parse-agrochat.ts`
importa `@/lib/xlsx-lite` (alias de TS) — Node lo intenta resolver como paquete npm `@/lib` y
tira `Cannot find package '@/lib'`. Esto significa que **`cargar-compras.mjs`, tal como está hoy
en `main`, fallaría si alguien lo vuelve a correr** (se extrajo `xlsx-lite.ts` a un módulo
compartido el 29/07 sin volver a probar este script dispatch-only). **No se tocó** (fuera del
alcance de F1, `parse-agrochat.ts` tiene blast radius amplio — lo usa también el uploader web) —
queda anotado acá para que alguien lo arregle antes de la próxima vez que haga falta recargar
compras desde cero.

**Fix aplicado, acotado a lo que este prompt tocaba**: `tsconfig.json` suma
`"allowImportingTsExtensions": true` (seguro con `noEmit: true`, que ya estaba) +
`capacidad-bcr-parse.ts`/`parse-fas.ts` importan sus dependencias locales con `.ts` explícito
(comentado el motivo en cada línea). `fob-oficial.ts` tenía el mismo problema en potencia
(`POSICIONES_FOB`/`POSICIONES_FOB_INDUSTRIA` vivían en el archivo con `import "server-only"`) —
se movieron a `fob-oficial-parse.ts` (ya puro, sin imports) y se re-exportan desde
`fob-oficial.ts` para no romper a nadie que ya las importaba de ahí.

## Verificado
- lint / `tsc --noEmit` / `npx vitest run` (660/660, 10 nuevos) / `npm run build` — todo ✅.
- `node scripts/ingest-fas.mjs --dry-run` corrido en vivo contra BCR + FOB oficial reales
  (`NODE_USE_ENV_PROXY=1`): 16 filas armadas para fecha=2026-08-06, valores plausibles y
  coherentes con los citados en el plan (soja sagyp/bcr_upriver=322,94/nuestro=322,96; girasol
  sagyp=371,21 vs bcr_upriver(industria)=479,60).
- `node scripts/cargar-fas.mjs --in <csv sintético> --check` corrido en vivo: parsea, mapea
  productos, corre el checklist §4.3 (puntos 1-3) y lo imprime — sin CSV real, no se subió nada.

## Quedó pendiente / en vuelo
- **El CSV real de Agrochat** (Lautaro lo re-sube) — recién ahí correr
  `node scripts/cargar-fas.mjs --in <csv> --check` de punta a punta con datos reales, completar
  los puntos 4-6 del checklist §4.3 (manuales: TC de 3 fechas conocidas · cotejo vivo contra BCR/
  Nuestro del día · spot-check contra la publicación oficial), y recién con el OK explícito
  correr la carga real + verificar por SQL.
- **Migración `20260808120000_c32_f1_fas_historico.sql` sin aplicar** — pide el OK de Lautaro
  (protocolo de siempre). El cron `ingest-fas.mjs`/`cargar-fas.mjs` no pueden escribir nada hasta
  que exista la tabla.
- 'nuestro' de la industria de soja (necesita la pizarra de soja como base de gastos
  comerciales) queda SIN cargar por el cron — `pizarra.ts` no está partido en un módulo puro
  como `capacidad-bcr-parse.ts`/`fob-oficial-parse.ts`; extraer `pizarra-parse.ts` con el mismo
  molde es el camino cuando haga falta de verdad (no se hizo acá: fuera del alcance pedido).
- El import extensionless roto de `cargar-compras.mjs`/`parse-agrochat.ts` (arriba) — no
  arreglado, señalado para una sesión futura.
- **F2 (fusión de la página) y F3 (backtest)** siguen esperando su turno — prompts ya escritos
  en `PLAN_CALOR_MERCADERIA.md` §5, F2 puede arrancar con F1 mergeada (la capa de precio con
  percentil, sin embargo, necesita `fas_historico` aplicada Y con algo de historia real — sin
  eso degrada a "—" con nota, como prevé el propio plan).

## Trampas descubiertas (para la próxima sesión)
- Los scripts `.mjs` de ingesta corren con **Node plano, sin bundler** — cualquier `.ts` que
  importen (directa o transitivamente) tiene que resolver en Node puro: sin imports relativos
  sin extensión y sin alias `@/...`. Antes de escribir un script nuevo, verificar la cadena de
  imports del módulo que se va a importar (o correrlo una vez con `node script.mjs --dry-run`
  antes de darlo por bueno) — no alcanza con que compile con `tsc`.
- `server-only` (el paquete) tira SIEMPRE que se lo importa fuera de Next/webpack — cualquier lib
  que un script `.mjs` necesite tiene que vivir en un módulo separado sin ese import (patrón ya
  usado por `capacidad-bcr-parse.ts` vs `capacidad.ts`; ahora también por
  `fob-oficial-parse.ts` vs `fob-oficial.ts`).
