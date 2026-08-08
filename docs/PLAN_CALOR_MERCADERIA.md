# PLAN — Fusión de las dos capas de síntesis del comercio exterior (C32)

> **Qué es esto.** Plan cerrado el 08/08/2026 (sesión de análisis, rama
> `claude/signal-temperature-synthesis-isja3g`, cero código) para fusionar
> **`/comercio/senal`** (señal física → precio) y **`/comercio/temperatura`** (calor de
> mercadería / índice MESA) en **una sola página de síntesis con un solo motor físico**, sumar la
> **base histórica del FAS** que faltaba, y **backtestear** el veredicto contra el premio local.
> Cierra los puntos **16 y 18** del Word de 32 puntos de Lautaro (07/08, agendados "para revisar
> juntos" con sugerencia explícita de fusión) — el punto 17 (mesa de embarque) queda AFUERA a
> propósito (contesta otra pregunta: programa y cumplimiento por mes, no veredicto de precio).
>
> **Ejecución: 3 fases = 3 sesiones de build (Sonnet), prompts autocontenidos en §5.**
> Orden: **F1 (base FAS) → F2 (fusión) → F3 (backtest)**. Registrado como **C32** en el backlog
> maestro (`auditoria/E7-sintesis.md` §4).

---

## §1 · Diagnóstico (por qué se fusionan)

Las dos páginas destilan la MISMA base (DJVE declarada × line-up originado) en un veredicto de
precio, con recetas distintas:

| Pieza | Señal física (`lineup/semaforo.ts`) | Calor (`lineup/temperatura.ts` + `mesa_calor.ts`) |
|---|---|---|
| Gap declarado vs originado | ratio 60d vs P25/P75 **sin estación** (`cobertura.ts:50-61`) | percentil **estacional** del gap 30d (`estacional.ts:71`) |
| Densidad line-up / farmer / momentum | ✖ | ✔ (patas C2/C3 + Δgap 10d) |
| FAS vs pizarra (precio) | ✔ (`semaforo.ts:47-61`) | ✖ |
| Acción final | ✔ 7 lecturas | ✔ matriz 3×3 (`mesa_calor.ts:78-88`) |

Evidencia que cerró la decisión (sesión 08/08, datos reales al 05/08 vía `/api/views/insumos`):

1. **Se contradicen en vivo**: trigo = "NEUTRO · Equilibrado" en señal vs "FIRME 79,9 →
   DIFERIR" en calor; soja = "Equilibrado" vs crush "FIRME 77,7 → VENDER YA". Dos veredictos
   para la misma pregunta, y el view semanal come los dos (doble conteo del mismo driver).
2. **Mismatch metodológico latente**: la señal juzga el ratio de ventana **60d** de hoy contra
   percentiles armados con la distribución histórica de ratios **30d** (`empresas.ts:119-136`
   sobre `lineup_gap_hist`, que es 30d — `20260719223000_mesa_gap_hist.sql:5-9`). Misma clase de
   bug que L4 ya tuvo que arreglar una vez (el corte fijo disparaba el 74-95% de los días).
3. **No son "dos opiniones independientes"**: misma base de datos → es el mismo termómetro con
   dos escalas. La capa de precio de la señal además duplica parcialmente `/granos/capacidad`.

Lo que cada una aporta de único **se conserva**: del calor, el motor estacional + densidad +
farmer + momentum; de la señal, el cruce a precio (FAS vs pizarra) y su prosa clara de una frase.

## §2 · Decisiones cerradas (con origen)

1. **Fusión en UNA página**: "Calor de mercadería" en `/comercio/temperatura`;
   `/comercio/senal` redirige (301) y sale de `biblioteca.ts`. [sesión 08/08, delegado por
   Lautaro: "deja todo listo para construir"]
2. **Motor físico único = percentil estacional** (`estacional.ts`, el del calor — filosofía que
   L4 ya bendijo al copiarla para los umbrales de la señal). `senalDe`/P25-P75 se retira de la
   síntesis; **sigue viva en los chips por empresa** de `/comercio/empresas` (contestan otra
   pregunta: ranking de empresas hoy), con el fix de ventana del punto 3.
3. **Ventana de la síntesis = 30 días** (lo que el line-up físicamente "ve" — `negocio/05`:
   ~10-14 días de buques nominados). El 60d queda como **programa forward** en empresas/embarques.
   Fix de consistencia: `lineup_gap_hist` v2 suma columnas 60d (§3.1) para que los umbrales de
   empresas midan 60d-contra-60d.
4. **Veredicto en capas** (nada nuevo sin validar en el titular): acción física = la matriz 3×3
   VIGENTE sin tocar + línea de contexto de precio con 3 estados. Sin matrices de 27 celdas.
5. **Eje precio anclado al FAS TEÓRICO OFICIAL (SAGyP)** — la única serie con historia (19 años,
   CSV de Agrochat verificado en §4). Ajusta la decisión C16 ("señal anclada a fasBcr"): la regla
   que manda es *lo que se valida = lo que se muestra*. BCR Up River / BCR industria / "Nuestro"
   quedan como contraste vivo del día. El estado del spread sale del **percentil del spread
   (FAS oficial − pizarra) contra su propia historia por producto** — nunca se mezclan niveles
   entre fuentes (brecha medida el 05/08: soja +17 · maíz −2 · trigo −5,5 · girasol −70 USD, no
   uniforme).
6. **SOJA = VARA INDUSTRIA.** [LAUTARO, 08/08: *"Tene en cuenta siempre que hablemos de soja
   industria. Rara vez el poroto valió más."*] La capa de precio de la soja se lee contra la
   capacidad de pago de la INDUSTRIA: el FAS oficial ya corre a esa vara (05/08: oficial 339,98
   vs BCR export 322,94 — la pizarra 340,83 paga exacto la capacidad industrial) y
   `capacidad.industriaSoja` (BCR industria, C16) es el contraste vivo. La card de soja poroto
   muestra el FAS export como dato secundario. Coherente con el aprendizaje ya asentado del view
   ("soja con FAS de la INDUSTRIA, no poroto", `view-mercado/references/aprendizajes.md`).
7. **Productos de la página fusionada (F2)**: los 4 actuales (MAIZE, WHEAT, SOJA_CRUSH, SBS) +
   **SORGHUM y GIRASOL (SFSEED)** — sus series físicas ya están en las matviews
   (`mesa_gap_hist.sql:35`) y ahora tienen pata de precio (FAS oficial + pizarra CAC de B3).
   Cebadas C/F y aceites → F4 (backlog §6).
8. **`fas_historico`**: tabla nueva formato largo (§3.3). Migración escrita en la sesión F1 y
   aplicada SOLO con OK de Lautaro (protocolo); todo el código degrada con gracia si falta.
9. **El CSV de Agrochat lo re-sube Lautaro en F1** (quedó verificado en la sesión de plan, §4;
   el archivo del análisis vivía en un contenedor efímero). Se re-verifica con el checklist §4.3
   y se versiona en `data/fas/` (dato oficial, sin nada sensible — mismo criterio que `data/pas/`).
10. **Backtest (F3) contra el PREMIO local, no el precio pleno** — las acciones de la matriz
    hablan del premio textualmente ("el premio va a mejorar", `mesa_calor.ts:79`). Tres motores
    en duelo + walk-forward + hipótesis gruesas pre-registradas (§5-F3). La página lleva etiqueta
    **"índice en validación"** hasta F3.
11. **Endpoint/skill**: `/api/views/insumos` suma el objeto `sintesis`; `temperatura` y
    `semaforo` quedan como alias DEPRECADOS una semana; `view-mercado/SKILL.md` se actualiza en
    el MISMO PR de F2 (repo único → cambio atómico).
12. **Degradación**: se conserva la escalera actual — matview caída → fallback → "sin señal"
    visible (`cobertura.ts:56`, `empresas.ts:323`) — nunca una página rota. `fas_historico`
    ausente/vieja → capa de precio "—" con nota, el eje físico sigue solo.

## §3 · Diseño

### 3.1 Motor físico único + matview v2

- `getSintesis()` (sucesora de `getTemperatura()`, misma lib `lineup/temperatura.ts` renombrada o
  extendida): índice 0-100 = percentil estacional de gap 30d (C1) + densidad 30d (C2) + farmer
  calendario (C3), pesos `W_GAP/W_LINEUP/W_FARMER` actuales (se recalibran recién con F3), +
  momentum + banda + acción de la matriz vigente. **Cero fórmula nueva en F2.**
- **Migración matview**: `lineup_gap_hist` v2 con columnas nuevas `declarado_60d_tn` /
  `originado_60d_tn` (mismas CTEs con ventana 60; el originado 60d se computa del `lineup` con
  ETB en `[fecha, fecha+60]`). OJO: es `DROP ... CASCADE` + recreate — revisar dependientes antes
  (hoy la leen `temperatura.ts` y `empresas.ts` vía PostgREST, sin vistas SQL encima; confirmar
  con `pg_depend` en la sesión). Los umbrales P25/P75 de empresas pasan a calcularse sobre los
  ratios 60d históricos.

### 3.2 Página fusionada (`/comercio/temperatura`)

Por producto, una card (evolución de la `CalorCard` actual, `temperatura-grid.tsx`):

1. **Titular**: índice 0-100 grande + banda (colores actuales) + glifo de momentum. El número
   continuo manda; la banda es rótulo (trigo 79,9 es "FIRME por 0,1" — no esconderlo).
2. **Acción física** (matriz 3×3 vigente) + su explicación de una frase.
3. **Línea de precio** (nueva): `FAS oficial <valor> vs pizarra <valor> · spread <±X> (percentil
   <P> de su historia)` → 3 estados: *el precio ya lo paga* (spread bajo/percentil bajo) ·
   *en línea* · *el premio todavía no lo paga* (spread alto). Redactada para no pisarse con la
   explicación física (pasada de copy sobre las 9 celdas: cada capa habla de lo suyo).
4. **Drivers colapsables** (patrón `ChartTabla`/tablas colapsables del sitio): pctl gap/densidad/
   farmer, declarado/originado 30d, FAS oficial + BCR (Up River e industria donde aplique) +
   Nuestro + pizarra, fechas por driver (el "hoy" es un mosaico de frescuras — mostrarlas).
5. `¿Qué es esto?` reescrito: fusiona los dos textos actuales + estado de validación.

`/comercio/senal` → `redirect()` permanente a `/comercio/temperatura`. Barrido de links
(`/comercio` hub, biblioteca, breadcrumbs, SKILL.md tabla de insumos línea 164).

### 3.3 Tabla `fas_historico` + cron

```sql
create table fas_historico (
  fecha    date not null,
  producto text not null,          -- catálogo §4.2 (Soja, Maíz, Trigo Pan, Girasol, Sorgo, ...)
  fuente   text not null,          -- 'sagyp' | 'bcr_upriver' | 'bcr_industria' | 'nuestro'
  fas_usd  double precision not null,
  fas_ars  double precision,
  tc       double precision,
  primary key (fecha, producto, fuente)
);
```

- **Backfill** `fuente='sagyp'`: el CSV de Agrochat (2007→hoy, 9 productos) tras el checklist
  §4.3. RLS: lectura anon como las demás series de mercado (no hay nada sensible) o solo-mesa —
  decidir en F1 con el criterio de siempre (la página que la consume es solo-mesa → alcanza
  revoke a anon, patrón matviews de mesa).
- **Cron diario** `scripts/ingest-fas.mjs` + workflow (minuto ≠ :00, post-cierre): guarda las 4
  fuentes reusando las libs reales por import directo (patrón E4): `capacidad.ts` (BCR Up River +
  industria + Nuestro + el **1er valor de la fila FAS que el parser hoy descarta** — exponerlo
  como `fasSagyp` en `capacidad-bcr-parse.ts`, es la columna SAGyP de la propia planilla BCR) y
  `fob-oficial.ts`. Guard anti-0-filas + alta en `healthcheck-frescura.mjs` (umbral ~4 días
  hábiles) + catálogo de monitoreo.
- Nota: el FAS oficial diario que publica la planilla de BCR (columna SAGyP) debe cotejarse
  contra la serie de Agrochat en el arranque — si difieren, gana la publicación oficial y se
  documenta.

### 3.4 Insumos del view

`sintesis` = array por producto `{cod, display, indice, banda, direccion, accion, explicacion,
precio: {fasOficial, fasBcr, fasIndustria?, fasNuestro, pizarra, spread, pctlSpread, estado},
drivers: {pctlGap, pctlDensidad, pctlFarmer, gapHoy, densidadHoy, deltaGap}, fechas}`.
`temperatura`/`semaforo` siguen emitiéndose (alias) hasta el PR de limpieza post-F2.
La regla dura del view ("coherencia con el semáforo MESA", `view-mercado/SKILL.md:430`) pasa a
apuntar a `sintesis`.

## §4 · El CSV de FAS oficial (Agrochat) — verificación de la sesión de plan

### 4.1 Qué es
"Serie histórica FAS Teórico Oficial SAGyP por Producto" — export de Agrochat. Columnas:
`Date, Product, FAS_ARS, FAS_USD, TC_Mayorista`. CSV coma, decimales con punto, fechas ISO, CRLF.

### 4.2 Perfil verificado (08/08/2026)
- **32.076 filas · 4.748 fechas hábiles · 0 duplicados (fecha+producto) · 0 valores ≤ 0.**
- Cobertura: **Soja, Maíz, Trigo Pan, Girasol: 2007-01-16 → hoy** · Aceite de Soja y Aceite de
  Girasol: 2007-05-09 → hoy · **Sorgo: 2021-06-22 →** · **Cebada C y Cebada F: 2021-06-18 →**.
- `FAS_USD = FAS_ARS ÷ TC_Mayorista` (verificado) y el TC es el **A3500 oficial** incluso en la
  ventana dólar-soja (15/09/2022 → 143,18, no el especial de 200) — serie seria.
- **Cotejo triple mismo-día (05/08/2026)** contra el FAS BCR vivo y el "Nuestro" (FOB oficial −
  DEX − gastos): soja 339,98 vs 322,94/322,96 · maíz 173,87 vs 175,87/175,91 · trigo 205,01 vs
  210,49/210,45 · sorgo 183,47 vs 188,67/188,70 · girasol 409,80 vs 479,60/371,28. Lecturas:
  BCR≈Nuestro al centavo (C16 confirmado) · brecha oficial↔BCR chica y por-grano salvo soja
  (+17, vara industria — ver decisión 6) y girasol (producto flojo de papeles en TODAS las
  fuentes). La API de FOB oficial responde fechas históricas (probado 2026/2024/2021 con
  requests reales) → el "Nuestro" es reconstruible por fecha como control cruzado del backtest.

### 4.3 Checklist de re-verificación (obligatorio antes de cargar, sesión F1)
1. Cabecera exacta + formato (4.1). 2. Duplicados = 0, valores ≤ 0 = 0, solo días hábiles.
3. `FAS_USD ≈ FAS_ARS/TC` (tolerancia redondeo) en una muestra ≥ 100 filas al azar.
4. TC de 3 fechas conocidas (ej. 15/09/2022 ≈ 143,2 · fecha reciente vs A3500 real).
5. Cotejo vivo: último día del CSV vs la columna SAGyP de la planilla BCR del día (parser F1) y
   vs el Nuestro reconstruido con `fob-oficial.ts`. 6. Spot-check de 2-3 fechas históricas
   contra la publicación oficial SAGyP si es alcanzable. 7. Recién ahí: cargar + versionar en
   `data/fas/` + verificar por SQL `count` y bordes (min/max fecha por producto vs 4.2).

## §5 · Prompts de ejecución (uno por sesión de build, Sonnet)

> Regla general de los 3 prompts: leé `docs/ESTADO.md` + la última bitácora ANTES de arrancar ·
> rama nueva `claude/*` desde `main` · migraciones se ESCRIBEN pero NO se aplican sin OK
> explícito de Lautaro en el chat (y si el código mergeado las necesita en runtime, aplicarlas
> en el momento del merge — trampa documentada del 06/08) · `npm run lint` + `npx tsc --noEmit`
> + `npx vitest run` + `npm run build` en verde antes de pushear · verificación visual con
> Playwright real si se tocó UI · cerrar con bitácora en `docs/sesiones/` + actualizar
> `ESTADO.md` «Ahora» en el mismo PR.

### PROMPT F1 — Base histórica del FAS (`fas_historico` + cron + backfill)

Ejecutá la fase F1 de `docs/PLAN_CALOR_MERCADERIA.md` (leelo entero primero, §3.3 y §4 son tuyos).
Alcance:
1. **Parser BCR**: exponé la columna SAGyP de la fila "FAS Teórico en u$s" que
   `src/lib/capacidad-bcr-parse.ts` ya lee posicionalmente y descarta (hoy se toma el 2º valor =
   Up River; el 1º es SAGyP). Sumá `fasSagyp` al tipo de `getCapacidad()` (`src/lib/capacidad.ts`)
   sin tocar ninguna fórmula existente. Tests con el fixture HTML real ya versionado.
2. **Migración** `fas_historico` según §3.3 (escribila en `supabase/migrations/`, NO la apliques;
   pedí el OK en el chat — si llega, aplicala por MCP y verificá RLS en los dos sentidos).
3. **Cron** `scripts/ingest-fas.mjs` + workflow diario post-cierre (minuto ≠ :00): una fila por
   (fecha, producto, fuente) para sagyp/bcr_upriver/bcr_industria/nuestro, importando las libs
   reales (patrón E4, nada re-implementado). Guard anti-0-filas. Alta en
   `scripts/healthcheck-frescura.mjs` + `src/lib/monitoreo/catalogo.ts`.
4. **Backfill**: Lautaro adjunta el CSV de Agrochat en el chat (si no lo adjuntó, pedíselo:
   serie FAS Teórico Oficial SAGyP por producto). Corré el checklist §4.3 COMPLETO y mostrá los
   resultados antes de cargar. Cargá por script con la service key (patrón `cargar-compras.mjs`),
   versioná el CSV en `data/fas/` y verificá por SQL.
5. Mapeo de productos del CSV → catálogo interno (Soja→SBS/vara industria per §2.6, Maíz→MAIZE,
   Trigo Pan→WHEAT, Girasol→SFSEED, Sorgo→SORGHUM, cebadas/aceites se cargan igual — consumidor
   F4): documentalo en el código, no lo dejes implícito.
No toques las páginas ni el endpoint (eso es F2). Verificación: además del protocolo, un
`curl`/SQL real mostrando la última fila diaria de las 4 fuentes tras una corrida del cron.

### PROMPT F2 — Fusión de la página (motor único + capa precio + redirect)

Ejecutá la fase F2 de `docs/PLAN_CALOR_MERCADERIA.md` (leelo entero; §1-§3 son el contrato;
requiere F1 mergeada — y para la capa de precio con percentil, `fas_historico` aplicada y
backfilleada; si no está, la capa degrada a "—" con nota, no bloquees la fusión).
Alcance:
1. **Matview v2** `lineup_gap_hist` con columnas 60d (§3.1) — migración escrita, chequeo de
   dependientes con `pg_depend`, NO aplicar sin OK. Umbrales de `empresas.ts` a ratios 60d.
2. **Motor único**: `getSintesis()` per §3.1/§3.4 — extensión de `lineup/temperatura.ts`, suma
   SORGHUM y SFSEED a los productos, cero fórmula nueva (pesos/bandas/matriz intactos, se
   recalibran en F3). La capa de precio per §3.2-3 y decisión §2.5-6 (soja = FAS oficial a vara
   industria + `capacidad.industriaSoja` de contraste; poroto muestra export como secundario;
   percentil del spread contra su propia historia POR PRODUCTO desde `fas_historico`).
3. **Página** `/comercio/temperatura` per §3.2 (cards en capas + drivers colapsables + fechas
   por driver + ¿Qué es esto? nuevo + etiqueta "índice en validación"). Pasada de copy sobre las
   9 explicaciones de `MATRIZ_ACCION` para que no se pisen con la línea de precio.
4. **Retiro de la señal**: `/comercio/senal` → redirect permanente; fuera de `biblioteca.ts`;
   barrido de links (hub `/comercio`, breadcrumbs, docs de skills). `semaforo.ts` se borra si
   queda sin importadores (el endpoint emite el alias `semaforo` DERIVADO de `sintesis` mientras
   dure la transición, o directamente se actualiza la skill en este PR y se retira el alias en el
   siguiente — decidilo y documentalo).
5. **Endpoint + skill**: `/api/views/insumos` suma `sintesis` (§3.4), mantiene
   `temperatura`/`semaforo` como alias deprecados; `view-mercado/SKILL.md` actualizado (tabla de
   insumos, regla de coherencia línea ~430, nota de aceite `temperatura.SOJA_CRUSH` → `sintesis`).
Verificación: protocolo + Playwright real claro/oscuro/mobile (bypass temporal de `requireAdmin`
revertido, `git diff` limpio) + cotejo a mano de al menos un producto: índice y acción idénticos
a los que daba `getTemperatura()` con los mismos datos (la fusión NO cambia el número físico).

### PROMPT F3 — Backtest del veredicto (motor y eje precio contra el premio)

Ejecutá la fase F3 de `docs/PLAN_CALOR_MERCADERIA.md` (leelo entero; requiere F1; ideal post-F2).
Es una sesión de ANÁLISIS con script versionado, sin UI nueva salvo la etiqueta de validación.
1. **Reconstrucción diaria del índice** 2022→hoy por producto (script `scripts/backtest-sintesis.mjs`
   o lib+test, importando `estacional.ts`/`mesa_calor.ts` reales) desde `lineup_gap_hist`/
   `lineup_densidad_hist`/`compras_avance_hist`. Tres motores en duelo: (a) pctl estacional del
   gap [actual] · (b) pctl estacional del RATIO originado/declarado [híbrido, candidato fuerte:
   adimensional] · (c) P25/P75 plano [control, la ex-señal].
2. **Target = el PREMIO, no el precio pleno**: soja/maíz contra el equivalente CBOT
   (`pizarra_historico` − `cbot_cierres` × factor, reusá `calcularDesacople` de
   `informe-v3-calc.ts`); trigo contra el basis A3 local o el FOB oficial (CBOT es SRW, correlación
   floja — documentá la elección). Ventanas 7 y 14 días (las del view), reusando
   `medirVentana`/`esAcierto` de `views-scorecard.ts`.
3. **Método**: hipótesis gruesas PRE-REGISTRADAS en el propio informe antes de mirar resultados
   (ej.: "tercil CALIENTE → premio sube más que tercil PESADO a 14d"), terciles (no 5 bandas),
   walk-forward, test de permutación o IC bootstrap, resultados por sub-período (regímenes:
   dólar-soja 2022, sequía 2023, cambios de DEX 2023-26). PROHIBIDO calibrar celda por celda.
4. **Eje precio**: mismo esquema con el percentil del spread (FAS oficial − pizarra) desde
   `fas_historico` (19 años). Control cruzado: reconstruí el "Nuestro" por fecha con la API de
   FOB (responde históricos, verificado 2021/2024/2026) para 20-30 fechas al azar y compará.
5. **Fugas conocidas a declarar en el informe** (§6): denominador de `compras_avance_hist` con
   vintage último (look-ahead parcial), clamp monótono de compras, agujero del line-up jun-jul/26,
   evaluable recién desde ~2022 (mín. 2 campañas previas).
6. **Salida**: `docs/auditoria/` o `docs/negocio/` con el informe (hit-rate por tercil/producto/
   ventana, motor ganador, veredicto sobre pesos/bandas) + los cambios de código que salgan (si
   gana otro motor: ~20 líneas en la lib; wording de acciones según evidencia; etiqueta de la
   página pasa de "en validación" a lo que corresponda — incluso "lectura descriptiva, sin edge
   demostrado" es un resultado válido y publicable). Con esto se cierra también la DUDA ABIERTA
   de `view-mercado/references/aprendizajes.md` sobre el índice (anotá el resultado ahí NO — eso
   lo hace una sesión de mantenimiento del loop; dejalo señalado en tu resumen final).

## §6 · Backlog derivado (F4, opcionales — cada uno con OK previo) y límites

- **F4a**: cards de cebada C/F y aceites (soja/girasol) en la síntesis — series físicas y FAS
  oficial ya cargados; el aceite de soja le daría al view de aceite una pata de precio local
  propia (hoy usa el crush mezclado).
- **F4b**: señal barcos-vs-camiones (`camiones/senal.ts`) como 4º driver del índice (ya es un
  diferencial de percentiles estacionales — mismo motor). Empalma con el punto 13 del Word
  (agendado aparte).
- **F4c**: histéresis en banda/acción si el flapping diario molesta en el uso real.
- **F4d**: chart histórico del FAS en `/granos/capacidad` (la tabla ya lo permite — revierte
  formalmente el "sin históricos" del 08/07, revertido de hecho por Lautaro al pedir la base).
- **Límites asumidos**: la brecha oficial↔BCR se midió UN día (su estabilidad la mide F3) · el
  backtest tiene poder para hipótesis gruesas, no para calibración fina · girasol sigue flojo de
  papeles en todas las fuentes (pendiente C16 de rindes/DEX propios sigue abierto).
