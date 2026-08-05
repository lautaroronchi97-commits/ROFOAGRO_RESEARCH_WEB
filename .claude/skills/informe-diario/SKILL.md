---
name: informe-diario
description: >-
  Procedimiento del informe diario de ROFO AGRO (MP1 de docs/PLAN_INFORMES.md,
  formato "Research" desde el 30/07/2026, reorganizado por producto
  SOJA→MAÍZ→TRIGO con local/internacional separados desde el 04/08/2026 —
  E3 de docs/PLAN_INFORMES_V3.md): generar la placa PNG one-pager de research
  diario (datos automáticos + color de la rueda de Lautaro + prosa con su
  voz), guardarla, mandarla por mail (con links de nota 1-tap) y dejarla en
  /informes Y en /informes/diario/[fecha] (versión web completa). Usar
  cuando se pida "generá el informe diario" o la Routine diaria (post-cierre,
  días hábiles) lo dispare. Sigue sin multi-agente a propósito (V4 de
  docs/PLAN_INFORMES_V2.md §6.4): su valor es salir siempre, rápido. Ya NO
  interpreta informes de organismos — eso vive en la skill `interpretaciones`
  desde el 04/08/2026 (E2); este informe solo LEE lo que esa skill ya publicó.
# El informe sale con la firma de Lautaro: la prosa la tiene que escribir el
# modelo grande, con tiempo para pensar el título y el color del día. Esto pisa
# el modelo de la sesión (y el del selector de la Routine) solo para este turno.
model: claude-opus-5
effort: medium
---

# Informe diario — procedimiento

Sos quien redacta y arma el informe diario de la mesa de ROFO AGRO. Todos los días
hábiles, post-cierre, generás UNA placa PNG one-pager (~816×1056, tope 2 páginas,
formato "Research" reorganizado por producto SOJA→MAÍZ→TRIGO con local e
internacional SIEMPRE separados — N8 de `docs/PLAN_INFORMES_V3.md` §3, ver Paso 2)
con los datos del día + prosa con la voz de Lautaro, la mandás por mail (con links
de nota 1-tap) y queda en `/informes` (la placa) Y en `/informes/diario/[fecha]`
(la versión web completa, con TODO lo que la placa haya recortado — N17). Es
DIARIO: no debe abrumar — se lee en 30-60 segundos.

## Requisitos (env vars del entorno)

| Var | Para qué |
|---|---|
| `INFORME_BASE_URL` | Base de la web (producción; `http://localhost:3000` en pruebas locales) |
| `INFORME_TOKEN` | Token del endpoint de datos y de la plantilla |
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | Guardar el registro, leer el color de la rueda, subir el PNG (Storage) |
| `RESEND_API_KEY` + `RESEND_FROM` + `ADMIN_EMAILS` | Mandar el mail con la placa adjunta |

Si falta alguna, avisá el faltante en el resumen final y hacé lo que se pueda
(nunca inventes datos ni mandes el mail sin la key).

## Paso 0 — Voz y calibración (siempre antes de redactar)

Leé, en este orden:

1. La skill `voz-lautaro` (`SKILL.md` + `references/ejemplos.md`). Para este
   formato ("Research", one-pager) el registro es más cercano al **"Informe
   largo"** que a la "placa" — rigor de datos + framing analítico, sin el
   recap en bullets de antes ni emojis (el diseño no los usa; el molde
   "Mesa de operaciones" de `ejemplos.md` sigue siendo la referencia de TONO —
   voseo, humildad, datos exactos — pero la prosa ahora va en título + 2
   párrafos, no en una lista de bullets).
2. `references/banco-de-oro.md` (propio de esta skill) — 3-5 informes reales
   que Lautoro marcó como "así quiero sonar". Vara de ESTILO, nunca fuente de
   números de un día viejo.
3. `references/aprendizajes.md` (propio, protocolo gateado — cap 200 líneas,
   la Routine nunca lo edita, solo lo lee).
4. Las últimas ~8 filas con nota/feedback de `informes_generados` (tipo=diario):
   ```
   GET {SUPABASE_URL}/rest/v1/informes_generados?tipo=eq.diario&nota=not.is.null&order=fecha.desc&limit=8&select=fecha,titulo,nota,feedback
   headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY}
   ```
   Si un feedback contradice un hábito de `aprendizajes.md`, el feedback manda
   (es más reciente y más específico). Sin notas todavía (loop recién arranca,
   N15) → seguí igual, no hay nada que calibrar aún.

## Paso 1 — Insumos (todos de la web; cero número inventado)

```
GET {INFORME_BASE_URL}/api/informes/datos?fecha=YYYY-MM-DD
    Authorization: Bearer {INFORME_TOKEN}
```

Sin `?fecha=` toma hoy (Córdoba). Devuelve (todo lo consume `datosDiario()` en
`src/lib/informe-diario-datos.ts` — la MISMA función que arma la plantilla y la
página web, cero duplicación): `cierres` (futuros por grano y posición con
`settlement` + `changePercent` vs la rueda anterior), `arbitrajes` (spread/TNA
disponible vs futuro), `pizarra` (CAC $ y USD por grano), `variacionPizarra`
(Δ de la pizarra oficial vs el día hábil anterior, en $ y en USD, por grano —
`ars`/`usd` cada uno `{actual,previo,deltaPct,fechaActual,fechaPrevia}`, `null`
si el cron todavía no cargó hoy), `top3PorGrano` (top 3 posiciones más
operadas del día por grano + volumen total del producto — `ajusteFuente:
"vivo"` si viene del WS de A3 en vivo, `"cierre_anterior"` como fallback
rotulado), `volumenPorGrano` (total operado en A3 del día, sumando TODAS las
posiciones vivas de cada grano — `null` si no hubo dato, `0` si hubo dato y no
se operó nada), `dolarFuturo` (mayorista + curva DDF con TNA),
`volumenCambiario` (`oficial`/`oficialVarPct` = TC oficial + su Δ del día,
`cats` = categorías de volumen MAE en USD), `djveResumen` (DJVE por producto,
`ton7d` es el dato de la ventana corta), `camionesPlantas` (`totalDia`,
`deltaDiaAnterior`, `deltaInteranual` — feed de Agroentregas), `chicago`
(`.agro`: los 5 de Chicago en USD/tn + Δ; `.macro`: WTI/oro/plata/DXY/Merval/
S&P/etc. con su Δ), `noticias.destacados` (top 4, YA acotado a las últimas 24
hs — puede venir vacío, es una respuesta válida), `agenda` (próximos 7 días,
no solo hoy/mañana), `color` (`{texto, chicago_bcr}` — los 2 textos libres que
Lautaro cargó en `/admin/datos/mesa-color`, o `null` si no cargó nada ese día
— el informe sale igual), `informesHoy` (informes de organismos —USDA/CONAB/
GEA/DEA/PAS— publicados JUSTO ese día, con sus `cambios` exactos: grano/país/
campaña, antes→ahora, unidad), `interpretaciones` (la lectura YA PUBLICADA de
esos informes por la skill `interpretaciones` — con su campo `impacto`
`{grano: "alcista"|"neutral"|"bajista"}` — vos NUNCA la redactás ni la
reinterpretás, solo la citás), `bcra` (compras netas del BCRA del día en M
USD; `null` si no cargó nada ese día) y `viewsMercado` (el view direccional
vigente por grano — viernes — con su `evidencia_externa` YA verificada en esa
corrida; ver Paso 2).

La plantilla (paso 4) YA renderiza, por bloque LOCAL/INTERNACIONAL separados,
TODO lo de arriba (pizarra + Δ, top3 + volumen, TNA implícita, TC oficial +
volumen MAE, BCRA, Chicago por producto, "la lectura de la mesa" con
`informesHoy`/`interpretaciones` + badge de `impacto`, y "en la noticia") — no
hace falta que repitas esos números en la prosa (Paso 2 te dice exactamente
qué SÍ escribir), pero si `informesHoy`/`interpretaciones` trae algo grande o
`bcra` fue un día fuerte, está bien mencionarlo en `tesisParrafo` (ej. "BCRA
siguió acumulando firme", tal como en los ejemplos de `voz-lautaro`).

Si la URL de producción no responde (la ruta recién deployada), levantá la web
local: `NODE_USE_ENV_PROXY=1 npm run build && npm run start` y usá
`http://localhost:3000`.

Síntoma a reconocer: si en vez del JSON (o de la placa, en el paso 4) te vuelve
el HTML de `/ingresar`, es el gate de auth de `src/proxy.ts` comiéndose la ruta
— tiene que estar en la lista de excepciones junto a `/api/informes/` y
`/informes/plantilla/`. Es bug de código, no falta de permisos: avisalo en el
cierre además de usar la web local para destrabar el informe del día.

## Paso 2 — Redactar la prosa

La plantilla (Paso 4) calcula EN VIVO los gráficos, la franja de referencia y
los bloques por producto directo de los libs de mercado
(`src/lib/informe-research.ts` + `src/lib/informe-v3-calc.ts` — cero prosa
necesaria ahí). Lo que escribís vos son `tesisTitulo`/`tesisParrafo`/`lectura`
(texto) +, solo cuando el color de la mesa los trae, los 4 campos
estructurados opcionales de más abajo (`pizarraEstimada`/`volumenFisico`/
`condicionalDjve`/`condicionalCamiones`). Para que tu prosa cite EXACTAMENTE
los mismos números que el lector va a ver en los gráficos, usá estas reglas —
son las mismas que usa `informe-research.ts`:

- **El desfasaje** (grano por grano, soja/maíz/trigo): A3 = `changePercent`
  de la PRIMERA posición viva de `cierres.granos[u].posiciones` (vienen
  ordenadas por vencimiento ascendente) · Chicago = `deltaPct` de la fila de
  `chicago.agro` con `nombre` "Soja"/"Maíz"/"Trigo".
- **Dónde rinde el tiempo (TNA implícita)**: por grano, la fila de
  `arbitrajes.granos[u].rows` con `tna` no nulo y MAYOR `openInterest` —
  **no** la de mayor TNA (un contrato cercano y poco operado anualiza el
  mismo spread en pocos días y da una tasa inflada, no representativa; hubo
  un caso real el 30/07 con trigo). En dólares: las 2 primeras posiciones de
  `dolarFuturo.posiciones` con `dias > 5` (se salta la casi-spot, que da
  ~0% y no aporta nada a "dónde rinde el tiempo").
- **Las tres cifras**: la MAYOR variación absoluta entre soja/maíz/trigo de
  `chicago.agro` · `chicago.macro` "Petróleo WTI" · la MAYOR `tnaPct` entre
  `dolarFuturo.posiciones` ("mejor carry").

Con esos números ya identificados, armá:

- **tesisTitulo**: el titular del día — 1 oración con personalidad, la idea
  central que cruza el desfasaje y/o el carry (ej. "El carry sigue perdiendo
  contra el dólar, pero el desfasaje de hoy no tiene un solo sentido"). Va
  también en el campo `titulo` de nivel superior (es lo que se lista en
  `/informes`).
- **tesisParrafo**: 2-4 oraciones desarrollando ese titular, citando los
  números reales del desfasaje/TNA/carry (los de arriba). Si `color` tiene
  texto, es tu insumo más rico para el tono del día.
- **lectura**: 2-4 párrafos `{titulo, texto}` (el `titulo` es una palabra o
  frase corta en versalitas, ej. "Soja y maíz.", "Trigo.", "Riesgo.", seguida
  del desarrollo) — normalmente uno por grano que tenga algo distintivo para
  decir + un párrafo de riesgo/contexto (WTI, biocombustibles, lo que venga
  de `viewsMercado`/`noticias` si aporta). No hace falta una por cada grano
  todos los días — si dos granos cuentan la misma historia, van juntos en un
  solo párrafo (como "Soja y maíz" en el ejemplo del 30/07).

**Sobre el `color` — de acá salen 4 campos nuevos de `prosa` (N5/§5.2 de
PLAN_INFORMES_V3.md, "la carga diaria sigue TEXTO LIBRE, la skill extrae")**.
Leé `references/ejemplo-color-operador.md`: `color.texto` casi siempre trae
precios/volúmenes/pizarra estimada REALES de un operador de la mesa (no solo
una sensación) y `color.chicago_bcr` es el comentario de Chicago que Lautoro
pega aparte (la plantilla lo cita solo, no hace falta repetirlo en la prosa).
Con eso armá, SOLO si el texto trae el dato — nunca lo estimes vos:
- **`pizarraEstimada`** `{SOJ?/MAI?/TRI?: {usd, ars, deltaUsdPct, deltaArsPct}}`:
  si el color da un precio estimado de mesa para un grano, calculá el Δ contra
  el ÚLTIMO valor de `variacionPizarra` (o contra `pizarra.granos[u]` si
  `variacionPizarra` no tiene el día de hoy) — mismo criterio act/365 que el
  resto del sitio, redondeo a 1-2 decimales. Si el color no da un estimado
  para un grano, DEJÁ ESA CLAVE AFUERA del objeto (no pongas `null` a mano; la
  plantilla ya muestra "—" cuando falta).
- **`volumenFisico`** `{SOJ?/MAI?/TRI?: number}`: volumen del físico que el
  color menciona, por grano. Mismo criterio: solo si está, sin inventar.
- **`condicionalDjve`** (string corto, 1 frase, o AUSENTE): solo si el
  volumen de DJVE de algún producto en `djveResumen` es realmente inusual —
  perilla calibrada por backtest (N16): **`ton7d`/7 ≥ 1,5× lo que ese producto
  viene promediando** (no hay un promedio histórico en el JSON: usalo con
  criterio — si `ton7d` de un producto se ve claramente arriba de lo normal
  para su tamaño, o el color lo menciona como "fuerte"/"apretando", contalo;
  si es un día común, DEJÁ EL CAMPO AFUERA del objeto).
- **`condicionalCamiones`** (string corto, o AUSENTE): solo si
  `camionesPlantas.deltaDiaAnterior` es grande (perilla: **|Δ| ≥30%**) o
  `camionesPlantas.deltaInteranual.pct` es grande (**≥1,5× interanual**, ej.
  +50% o más) — mismo patrón, ausente si es un día normal.

Si el color y el dato automático difieren (pizarra estimada de la mesa vs
cierre oficial CAC), mostrá los dos — no "corrijas" uno con el otro, son
lecturas distintas del mismo día. Si el color trae un precio/volumen de un
producto que `cierres`/`pizarra` no cubre (ej. sorgo, "contractual"), citalo
en `tesisParrafo`/`lectura` en vez de forzarlo en los campos estructurados
de arriba (esos son SOLO soja/maíz/trigo).

**Regla "sin internals" (N9)**: nunca nombres percentiles, índices o
umbrales internos en la prosa — traducí a tendencia. "La posición de fondos
viene creciendo hace 4 semanas", no "percentil 88". Esto vale para lo que
citás de `viewsMercado`/análisis propios; los datos crudos (precios,
volúmenes, Δ%) sí van con su número exacto siempre.

**"Otros mercados" (WTI/oro/plata/DXY/real) es 100% de la plantilla, no
tuyo**: se calcula solo con la regla `|Δ| ≥3%` (`otrosMercadosRelevantes()`
en `informe-v3-calc.ts`) — no hace falta que lo menciones en la prosa salvo
que quieras conectarlo con el resto del día (ej. "la caída del petróleo
achica el margen de..." si aporta).

**Contexto del view vigente (V4, opcional — NO es una sección fija)**: si
`viewsMercado` trae, para algún grano, un dato de `evidencia_externa` que
siga siendo relevante HOY (ej. "fondos vendidos récord" de la corrida del
viernes), podés citarlo en `tesisParrafo` o en `lectura` como contexto — es un
dato ya verificado en F5 de `view-mercado` (cero fetch nuevo, cero research
propio del diario). Nunca reinterpretes el view ni le sumes una lectura
nueva: solo citás lo que ya está guardado, y solo si aporta al día de hoy —
la mayoría de los días no hay nada que agregar acá, y está bien que no lo
haya (R4/R5 de `PLAN_INFORMES_V2.md`: el diario NO se sofistica, su valor es
salir siempre, en minutos).

**`noticias`/`bcra`/`informesHoy`/`interpretaciones` ya los renderiza la
plantilla sola**, por bloque local/internacional separado (franja "Dólar"
para BCRA, "La lectura de la mesa" para informesHoy/interpretaciones con su
badge de impacto, "En la noticia" para noticias) — no hace falta repetirlos
en la prosa, pero si `bcra` fue un día fuerte o `informesHoy`/
`interpretaciones` trae algo grande, está bien mencionarlo en `tesisParrafo`.

Regla dura de `voz-lautaro`: **ni un número inventado**. Todo dato sale del
JSON del paso 1 (con las reglas de selección de arriba) o del `color` cargado
por Lautaro.

## Paso 3 — Guardar el borrador

```
POST {SUPABASE_URL}/rest/v1/informes_generados
headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY},
         content-type: application/json, prefer: return=representation,resolution=merge-duplicates
body: [{ "tipo": "diario", "fecha": "YYYY-MM-DD", "titulo": "<tesisTitulo>",
         "prosa": { "tesisTitulo": "<tesisTitulo>", "tesisParrafo": "<tesisParrafo>",
                    "lectura": [{ "titulo": "...", "texto": "..." }, ...],
                    "pizarraEstimada": { "SOJ": { "usd": 345.5, "ars": 512000, "deltaUsdPct": 1.47, "deltaArsPct": 1.19 } },
                    "volumenFisico": { "SOJ": 12500 },
                    "condicionalDjve": "...", "condicionalCamiones": "..." },
         "estado": "borrador" }]
```

`pizarraEstimada`/`volumenFisico`/`condicionalDjve`/`condicionalCamiones` son
TODOS opcionales — mandá solo las claves que el color realmente trajo (Paso 2).
El UNIQUE `(tipo, fecha)` + `resolution=merge-duplicates` hace idempotente un
re-run del mismo día (pisa el borrador anterior si volvés a correr antes de
mandarlo). Guardá el `id` que devuelve la respuesta.

## Paso 4 — Screenshotear la placa

La plantilla (`/informes/plantilla/research?fecha=YYYY-MM-DD&token={INFORME_TOKEN}`)
lee el borrador recién guardado y arma el layout — formato "Research" (one-pager
oscuro, reemplazo de la placa vertical desde el 30/07/2026; `/informes/plantilla/diario`
sigue en el repo pero YA NO se usa en este pipeline). Con Playwright:

```bash
npm install playwright-core --no-save   # no está en package.json a propósito
```

```js
import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  // NO correr "playwright install": el chromium ya está en esa ruta.
  args: ["--no-sandbox"],
});
// 816×1056 = carta a 96dpi (el tamaño real del diseño), @2x para que el PNG
// salga nítido — la página crece en alto sola si hay agenda/noticias/informe
// del día, `fullPage` la captura completa igual.
const page = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2 });
await page.goto(`${INFORME_BASE_URL}/informes/plantilla/research?fecha=${fecha}&token=${INFORME_TOKEN}`, { waitUntil: "networkidle" });
await page.screenshot({ path: `informe-${fecha}.png`, fullPage: true });
await browser.close();
```

**Si corrés detrás del proxy del sandbox** (Claude Code on the web: hay `HTTPS_PROXY`
seteado): Chromium NO lo toma solo, y con TLS 1.3 el handshake muere contra el
proxy que re-termina TLS (`ERR_CONNECTION_RESET`, siempre, no es intermitente).
Hace falta pasarle el proxy Y bajar el máximo de TLS:

```js
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  proxy: { server: process.env.HTTPS_PROXY },        // ej. http://127.0.0.1:43009
  args: ["--no-sandbox", "--ssl-version-max=tls1.2"],
});
```

Contra `http://localhost:3000` (la web local del fallback del Paso 1) no hace
falta nada de esto: es loopback, no pasa por el proxy.

**Chequeo de altura (N17)**: el objetivo es **1 página** (1056 px CSS, no de
device — sacá el screenshot con `deviceScaleFactor:2` pero medí con
`page.evaluate(() => document.body.scrollHeight)`, que da CSS px). Tope duro
**2×1056 = 2112**. Si se pasa, NO recortes vos a mano la placa — el layout ya
está armado por bloques fijos; si un día viene con mucho contenido (agenda
llena + varios `informesHoy` + noticias), 1,5-2 páginas es aceptable (queda
dentro del tope). Si algún día supera el tope duro, decilo en el resumen del
Paso 8 en vez de inventar un recorte — la versión web (Paso 6) siempre
muestra todo igual, así que no se pierde información.

## Paso 5 — Subir el PNG al bucket privado

```
POST {SUPABASE_URL}/storage/v1/object/informes/diario/{fecha}.png
headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY}, content-type: image/png
body: <bytes del PNG>
```

Guardá el path (`diario/{fecha}.png`) — es lo que va en `path_png` del registro
(`PATCH informes_generados?id=eq.{id}` con `{"path_png": "diario/{fecha}.png"}`,
mismos headers + `content-type: application/json`).

## Paso 6 — Mandar el mail

El HTML del mail (N15/N6 de PLAN_INFORMES_V3.md §9/§5.4) suma, sobre el mail
simple de antes: (a) el **eco de lo entendido del color** — 1-2 líneas que
repiten en criollo lo que extrajiste de `color.texto` en el Paso 2 (ej.
"Entendí: pizarra estimada soja US$345,5, exportación floja") para que una
mala lectura se note en segundos, solo si `color` tenía texto; (b) el **link
a la versión web completa** (`{INFORME_BASE_URL}/informes/diario/{fecha}`);
(c) **3 links de nota 1-tap** (👍/😐/👎 → gradan la nota sin login):

```
GET {INFORME_BASE_URL}/api/informes/nota?id={id}&n={1|3|5}&t={firma}
```

`{firma}` = HMAC-SHA256 hex de `"{id}:{n}"` con el secret
`INFORME_SHARE_SECRET` (mismo mecanismo del link público de la placa — Paso
4 no lo necesita, pero acá sí). Si no tenés forma de calcular HMAC-SHA256 en
el entorno de la Routine, generá los 3 links igual (Node trae `crypto`
built-in — `createHmac("sha256", secret).update(payload).digest("hex")`).

```
POST https://api.resend.com/emails
headers: authorization Bearer {RESEND_API_KEY}, content-type: application/json
body: { "from": "{RESEND_FROM}", "to": [...ADMIN_EMAILS separados por coma],
        "subject": "Informe diario ROFO AGRO — {fecha DD/MM}",
        "html": "<eco del color (si hay) + breve 2-3 líneas + link a /informes/diario/{fecha} + 3 links de nota 1-tap>",
        "attachments": [{ "filename": "informe-{fecha}.png", "content": "<PNG en base64>" }] }
```

Si `RESEND_API_KEY` o `INFORME_SHARE_SECRET` faltan, saltealos y decilo en el
resumen (los links de nota degradan solos: sin secret, el endpoint los
rechaza con 400 en vez de romper) — no es motivo para no completar el resto.

## Paso 7 — Marcar enviado

```
PATCH {SUPABASE_URL}/rest/v1/informes_generados?id=eq.{id}
headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY}, content-type: application/json
body: { "estado": "enviado" }
```

Recién ahí la fila aparece en `/informes` (RLS: anon solo ve `estado=enviado`).

## Paso 8 — Telemetría + cierre

**Telemetría (N13)**: insertá una fila en `routine_runs` antes del resumen —
así `/admin/checklist` sabe que el informe corrió aunque no haya nada más
visible que lo confirme:
```
POST {SUPABASE_URL}/rest/v1/routine_runs
headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY}, content-type: application/json
body: [{ "tipo": "diario", "fecha": "YYYY-MM-DD",
         "iniciado_en": "<ISO de cuando arrancó el Paso 1>",
         "terminado_en": "<ISO de ahora>",
         "degradaciones": { "color": <bool: sin cargar>, "resend": <bool: sin key>, ... },
         "mail_enviado": <bool> }]
```
Si la tabla/columnas todavía no existen (antes de que E1 mergee en el entorno
que estés corriendo), saltealo sin romper el resto.

Resumen final: título del día, si el color de Lautaro estaba cargado o no, qué
insumo degradó (si alguno), y si el mail salió. Si algo falló a mitad de
camino, decilo fuerte — nunca en silencio (ej. "se generó el PNG pero no se
pudo mandar el mail: falta RESEND_API_KEY").

## Modo de prueba

Con `--fecha` (o pedido "en seco"): corré los pasos 1-4 y mostrá el PNG SIN
guardar en Supabase ni mandar mail — marcá "PRUEBA — no persistido".
