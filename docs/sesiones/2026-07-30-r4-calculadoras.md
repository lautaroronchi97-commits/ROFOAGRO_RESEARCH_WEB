# Sesión 2026-07-30 — R4: calculadoras — patrón + 7 calcs (relevamiento web, lote 4)

- **Rama:** `claude/website-changes-review-ttqsq4` (continuación del PR #112 de R3, sin mergear
  todavía al momento de arrancar R4 — mismo branch designado de la sesión, ver nota abajo) · **PR:**
  #112 (ampliado con este commit).
- **Objetivo pedido por Lautaro:** ejecutar el lote **R4** de `PLAN_RELEVAMIENTO_WEB.md` §3 (puntos
  38–44, las 7 calculadoras de negocios + el patrón compartido `precio-dual`), con las 2 preguntas
  que lo gateaban (§5.4 trigo a-fijar, §5.6 costos oculta) contestadas por Lautaro antes de arrancar:
  trigo = **DIC/ENE/MAR/JUL/SEP** (el último "diciembre" de la nota era repetido sin querer) · costos
  = **sí, alcanza** con no aparecer en sidebar/índice + "sin acceso" en la URL directa.

## Nota de proceso: PR #112 (R3) seguía sin mergear al arrancar R4

El protocolo del repo pide reiniciar la rama desde `main` después de mergear el PR del lote anterior
(mismo patrón que usaron R1→R3). Acá el PR #112 de R3 todavía no había mergeado cuando Lautaro pidió
seguir con R4 — como la rama designada de esta sesión es una sola (`claude/website-changes-review-
ttqsq4`) y no corresponde abrir una segunda rama en paralelo, R4 se construyó **encima** de los
commits de R3 en la misma rama: el PR #112 termina incluyendo R3+R4 en vez de uno por lote. Sin
impacto en el contenido (cada lote es un commit propio, revisable por separado en el diff).

## Hecho

### Patrón compartido `precio-dual` (base de los 5 puntos siguientes)

- **`src/lib/precio-dual.ts`** (nuevo, puro + 5 tests): `tcImplicito(ars,usd)` (mismo criterio que
  el cross-cálculo de Arbitrajes en R3 — el TC implícito de la propia pizarra del grano, no uno
  genérico) + `arsDesdeUsd`/`usdDesdeArs`.
- **`src/components/precio-dual.tsx`** (nuevo): selector de grano → pizarra sugerida + dos inputs
  ($ y USD) con recálculo cruzado (TC implícito del grano, con `tcBna` como respaldo) + botón ↺ +
  clase `.manual` (azul) en el campo editado — reusa las clases CSS `.pz-input`/`.pz-dual`/
  `.pz-reset`/`.curva-pick` que R3 ya dejó genéricas (sin duplicar estilos). `onGranoChange` y
  `onArs` opcionales para que el padre sincronice datos dependientes (la curva canónica en "A
  fijar", o el ARS espejado en calcs 100% pesos como "Pago diferido").
- Cableado en las **5** calcs que el plan pedía (a-fijar, por-porcentaje, negocios-con-pagos vía TC,
  pago-diferido, carry) — negocios-de-planta queda para R5.

### 38 — A fijar

- **Posiciones canónicas por grano** (`src/lib/fijar-canon.ts`, nuevo + 7 tests): reemplaza el
  `CURVA_INI` hardcodeado (fechas/precios inventados) — Soja JUL/SEP/NOV/ENE/MAY · Maíz ABR/JUL/
  SEP/DIC/ENE/MAR · Trigo **DIC/ENE/MAR/JUL/SEP** (respuesta 4). `posicionesCanonicasVivas()` filtra
  la curva REAL de A3 a esas etiquetas, nunca vencidas, máx. 1 año hacia adelante, una posición por
  etiqueta (la más próxima si hay dos campañas vivas).
- **Precio con vivo del WebSocket + fallback "estimado"** (`precioFuturoConVivo()`): último operado
  del WS (real) → promedio bid/ask del WS si no operó todavía (badge `estimado`, reusa `.pz-estim`)
  → cierre de `futuros_cierres_ultimo` si no hay nada del WS. Elegir un grano en el picker carga de
  una sola vez la curva canónica CON estos precios y el "Disponible (USD)" con la pizarra del grano.
- **Gráfico de TNA implícita por posición, SEPARADO del delta** (decisión documentada en el código:
  combinar USD y % en un solo eje con datos reales resultaba ilegible — el propio plan dejaba esa
  puerta abierta "sino separados").

### 39 — Por porcentaje

- `PrecioDual` cableado a "Precio posición vendida" (pizarra) — la "posición de fijación" sigue
  desde la curva A3 (`CurvaPicker`, sin cambios, son fuentes distintas: lo vendido es un precio de
  pizarra, la fijación es el futuro de referencia).
- "A cliente (−aforo)" ahora en **rojo** (antes verde), al lado del lleno.
- "Plazo estimado"/"Vencimiento del período de fijación" (antes "Vence") más grandes, uno abajo del
  otro (clase nueva `.calc-meta-hl`). Sub del panel sin el paréntesis "(ej. 114% maíz julio) · aforo
  a cliente".

### 40 — Negocios con pagos

- TC precargado = **`tcBna`** (BNA confirmado de CAC) si está publicado ese día, si no **BNA online**
  (`oficial − 9`) — sigue 100% editable.
- "Precio en pesos" en rojo (mismo tratamiento que el disponible). "Pago" resaltado en dorado
  (`.calc-hi`). "Días" → **"Pago (días de anticipo)"**.

### 41 — Pago diferido

- Sumado el patrón (antes esta calc no recibía NINGÚN dato de la web, 100% a mano): `PrecioDual`
  sugiere el disponible en ARS directo (vía el nuevo callback `onArs`, ya que este calc es
  nativamente en pesos, no en USD) cuando el campo "Precio con pago" está visible en el modo activo.
  "Pago estándar" resaltado en dorado.

### 42 — Pases (cambio de fórmula visible)

- **Relabel**: "corta"/"larga" → **"Posición vendida (cercana)"**/**"Posición comprada (lejana)"**
  en los 4 campos + los 2 pickers ("Venta desde A3"/"Compra desde A3").
- **Signo corregido** (`src/lib/pases.ts::pase()`): pasa de `larga − corta` a **`cercana − larga`**
  — el pase se arma cuando la cercana vale MÁS que la lejana. Verificado con el ejemplo exacto del
  relevamiento: cercana=100/lejana=110 → **−10** (antes daba +10). `tasaDirectaPase`/`tnaPase`
  quedan iguales (tasa del carry, no cambia de signo). `pases.test.ts` actualizado (los 3 fixtures
  reales de la ficha E2 1.6 con el signo flippeado + un test nuevo del ejemplo ±10).
  **Alcance verificado antes de tocar la fórmula**: `lib/pases.ts` la usa SOLO esta calculadora — el
  panel real `/granos/pases` corre sobre `lib/pases-cierres.ts`, una lib totalmente independiente
  que no comparte código; el cambio de signo no toca ningún dato que Lautaro ya usa a diario.
- **"A cliente" → "A fijar (resultado − quita)"**, promovido a resultado principal (antes vivía
  chico en `.calc-meta`) junto a un nuevo **"Plazo hasta la compra"** (fecha + días), ambos
  destacados. Spread lleno/tasa directa/TNA/días demotados a `.calc-meta` (informativos).
- **Cartel de advertencia** (`.calc-warn`, nueva clase) cuando el spread lleno da negativo: "⚠️
  Cuidado: el pase es negativo, la posición está en carry."

### 43 — Carry entre posiciones

- `PrecioDual` cableado a "Posición cercana / disponible" (pizarra) — la lejana sigue desde A3
  (`CurvaPicker`, sin cambios).
- **Selector "Medir spread en" USD/ARS**: en ARS multiplica el spread por el TC implícito del grano
  elegido (o `tcBna` de respaldo) — la tasa directa/TNA/TEA quedan siempre en %, no cambian con la
  moneda (son tasas, no montos).

### 44 — Costos (oculta solo-admin)

- `biblioteca.ts`: `soloMesa: c.slug === "costos"` en el registro de calculadoras — la sidebar YA
  filtraba `soloMesa` a `!it.soloMesa || esAdmin` (patrón existente de `/comercio/*`), así que costos
  queda automáticamente invisible en el menú para no-admins sin tocar `sidebar.tsx`.
- Índice `/calculadoras`: filtro `c.slug !== "costos" || esAdmin` antes de mapear las tarjetas.
- `/calculadoras/[slug]`: si `slug==="costos"` y no es admin → `redirect("/sin-acceso")` (gateado por
  `AUTH_ENFORCED`, mismo criterio que `requireSeccion`) — a diferencia del patrón `requireAdmin()`
  de `/comercio/*` (que manda a `/` a los no-admin), acá se usa `/sin-acceso` porque es lo que
  Lautaro confirmó explícitamente en la pregunta.

## Decisiones tomadas (y por qué)

- El TC de "carry"/"por-porcentaje"/"a fijar" es el implícito de la pizarra del GRANO ELEGIDO, con
  `tcBna` como respaldo — mismo criterio que R3 en Arbitrajes, no se inventa un tercer criterio.
- `PrecioDual` expone `onArs` además de `onValorUsd` para que calcs 100%-ARS (pago diferido) puedan
  consumir el valor sugerido en SU propia moneda sin forzarlas a pensar en USD primero.
- El signo de `pase()` se cambió solo después de confirmar que ningún panel de producción real
  depende de esa función (grep de importadores antes de tocar la fórmula) — evita repetir el tipo de
  bug de "espejo duplicado" que ya documentó la auditoría E4.
- Costos usa `/sin-acceso` en vez de `requireAdmin()` (que redirige a `/`) porque es literalmente lo
  que Lautaro confirmó en la pregunta — aunque diverge del patrón `requireAdmin()` de `/comercio/*`,
  se prioriza la respuesta explícita sobre la consistencia de patrón.

## Verificado

- `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npx vitest run` **397/397** (12 nuevos: 5 de
  `precio-dual.test.ts`, 7 de `fijar-canon.test.ts`; los 3 fixtures de `pases.test.ts` actualizados
  al signo nuevo + 1 test del ejemplo ±10) ✅ · `npm run build` ✅ (9 calculadoras prerenderizadas).
- **Playwright real contra `npm run start`** (datos de Supabase/A3 del entorno, claro/oscuro, cero
  errores de consola/scroll horizontal):
  - A fijar: elegir "Soja" cargó 4 posiciones canónicas reales (JUL26/SEP26/NOV26/MAY27 — ENE27 no
    apareció por no tener curva viva ese día, comportamiento esperado) con precios de cierre reales,
    "Disponible" autocompletado en 339,49, los dos gráficos (delta + TNA) renderizando separados y
    legibles en los 2 temas.
  - Por porcentaje: "A cliente" en rojo (111,6%), "Vencimiento del período de fijación" con el label
    completo, plazo/vencimiento grandes y apilados.
  - Negocios con pagos: TC precargado en 1489 (BNA confirmado de CAC ese día), "Precio en pesos" en
    rojo, "Pago" resaltado en dorado, label "Pago (días de anticipo)".
  - Pago diferido: picker de pizarra presente y funcional, "Pago estándar" resaltado.
  - Pases: con cercana=100/lejana=110 el spread lleno dio exactamente **−10,00** (antes hubiera dado
    +10) y "A fijar" −10,00 en rojo, cartel de carry visible, labels "Posición comprada" correctos —
    verificado en claro y oscuro.
  - Carry: picker de pizarra + selector "Medir spread en" cambiando a ARS con el TC real (14.890 =
    10 USD × ~1489).
  - Costos: **verificado con bypass temporal** (forzando el camino no-admin en `[slug]/page.tsx` y
    en el índice, revertido y `git diff` limpio antes de commitear) — desaparece de la sidebar
    (ya lo hacía sin bypass, por default `esAdmin=false` sin sesión), desaparece del índice, y la
    URL directa `/calculadoras/costos` redirige a `/sin-acceso`.

## Quedó pendiente / en vuelo

- Nada de R4 quedó pendiente: los 7 puntos del lote (38–44) + el patrón compartido están hechos y
  verificados.
- El PR #112 sigue acumulando R3+R4 (ver nota de proceso arriba) — se actualiza título/body al
  cerrar esta sesión para reflejar ambos lotes.

## Trampas descubiertas (para la próxima sesión)

- `noUncheckedIndexedAccess` atrapó `GRANO_EMOJI[v.grano]` en R3 y no volvió a aparecer en R4 — pero
  ojo con cualquier indexado nuevo de `Record<string,X>` sin key literal.
- El script de verificación con `waitUntil:"networkidle"` colgó 2 minutos en las capturas de modo
  oscuro sin ninguna causa de la app (el server respondía 200 normal) — cambiar a `waitUntil:"load"`
  lo resolvió al toque. Anotado para no perder tiempo la próxima vez que pase.
- `lib/pases.ts` (usado solo por la calculadora) y `lib/pases-cierres.ts` (el panel real de
  `/granos/pases`) son libs completamente independientes pese al nombre parecido — antes de tocar
  una fórmula con "pase" en el nombre, confirmar CUÁL de las dos con un grep de importadores.
