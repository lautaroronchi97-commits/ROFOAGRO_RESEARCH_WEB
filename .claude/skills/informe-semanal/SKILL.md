---
name: informe-semanal
description: >-
  Procedimiento del informe semanal de ROFO AGRO (MP2 de docs/PLAN_INFORMES.md,
  ampliado por V3 de docs/PLAN_INFORMES_V2.md §6.3, REESTRUCTURADO por producto
  en E4 de docs/PLAN_INFORMES_V3.md §6): generar el PDF A4 de research tipo
  ALyC — tapa + "la semana en números" + UNA SECCIÓN POR PRODUCTO (soja→maíz→
  trigo, local/internacional siempre separados) + dólar/macro local +
  contexto internacional + comercio exterior transversal + cierre, con la
  voz de Lautaro — guardarlo, mandarlo por mail (con links de nota 1-tap) y
  dejarlo en /informes. Usar cuando se pida "generá el informe semanal" o la
  Routine semanal (viernes post-cierre) lo dispare.
# El informe sale con la firma de Lautaro: la prosa la tiene que escribir el
# modelo grande, con tiempo para pensar el criterio de qué destacar (Paso 2).
# Esto pisa el modelo de la sesión (y el del selector de la Routine) solo para
# este turno.
model: claude-opus-5
effort: high
---

# Informe semanal — procedimiento

Sos quien redacta y arma el informe semanal de la mesa de ROFO AGRO. Todos los
viernes, post-cierre, generás UN PDF A4 (base + gráficos ya están construidos
— ver `src/app/informes/plantilla/semanal/page.tsx`) con la semana en números
y una interpretación larga con la voz de Lautaro, lo mandás por mail y queda
en `/informes`. A diferencia del diario (mecánico, 30-60 segundos), acá el
valor es el CRITERIO: qué de todo lo que pasó en la semana merece estar en el
resumen ejecutivo.

**Estructura (E4, §6.1 — sin límite de páginas, N1)**: tapa → "la semana en
números" (transversal, corta) → UNA SECCIÓN POR PRODUCTO (SOJA→MAÍZ→TRIGO,
local/internacional siempre separados dentro de cada una — N8, el requisito
central del Word de Lautaro) → "Dólar y macro local" → "Contexto
internacional" → "Comercio exterior transversal" → "Cierre". La plantilla
arma todo esto solo a partir del borrador que guardás en el Paso 4 — vos no
tocás layout, solo redactás la prosa y (para un producto puntual) la pizarra
estimada del viernes.

**Rol de este informe frente a los otros 3** (§4 de PLAN_INFORMES_V3.md, anti-
duplicación): el diario ya contó la rueda día por día; las interpretaciones ya
leyeron cada informe de organismo cuando salió; el view ya armó la tesis
direccional de la semana. Este informe **LEE a los otros tres** (`diariosSemana`/
`interpretacionesSemana`/`viewsMercado` del Paso 1) para armar el hilo narrativo
y la síntesis — nunca re-deriva un número que esas superficies ya calcularon,
y nunca reinterpreta un `impacto`/`tesis_md` ya publicado, solo los cita.

## Requisitos (env vars del entorno)

| Var | Para qué |
|---|---|
| `INFORME_BASE_URL` | Base de la web (producción; `http://localhost:3000` en pruebas locales) |
| `INFORME_TOKEN` | Token del endpoint de datos y de la plantilla |
| `INFORME_SHARE_SECRET` | Firma HMAC de los links de nota 1-tap del mail (N15) |
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | Guardar el registro, leer el borrador, subir el PDF (Storage), telemetría |
| `RESEND_API_KEY` + `RESEND_FROM` + `ADMIN_EMAILS` | Mandar el mail con el PDF adjunto |

Si falta alguna, avisá el faltante en el resumen final y hacé lo que se pueda
(nunca inventes datos ni mandes el mail sin la key).

## Paso 0 — Voz y calibración (siempre antes de redactar, patrón E3/view-mercado)

Leé, en este orden:

1. La skill `voz-lautaro` (`SKILL.md` + `references/ejemplos.md`). Acá el
   registro es **"informe largo"**: voseo, rigor de datos + framing
   didáctico ("Recordemos que…", "Dato no menor…"), humildad marca registrada
   ("a mi óptica", "esto es simplemente mi visión") en el cierre, emojis muy
   puntuales (uno por sección como mucho — esto se imprime en PDF).
2. `references/banco-de-oro.md` (propio de esta skill, N18) — 3-5 informes
   reales que Lautoro marcó como "así quiero sonar". Vara de ESTILO, nunca
   fuente de números de una semana vieja.
3. `references/aprendizajes.md` (propio, protocolo gateado — cap 200 líneas,
   la Routine nunca lo edita, solo lo lee).
4. Las últimas ~8 filas con nota/feedback de `informes_generados` (tipo=semanal):
   ```
   GET {SUPABASE_URL}/rest/v1/informes_generados?tipo=eq.semanal&nota=not.is.null&order=fecha.desc&limit=8&select=fecha,titulo,nota,feedback
   headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY}
   ```
   Si un feedback contradice un hábito de `aprendizajes.md`, el feedback manda
   (es más reciente y más específico). Sin notas todavía → seguí igual, no
   hay nada que calibrar aún.

## Paso 1 — Insumos (todos de la web; cero número inventado)

```
GET {INFORME_BASE_URL}/api/informes/datos?tipo=semanal&fecha=YYYY-MM-DD
    Authorization: Bearer {INFORME_TOKEN}
```

Sin `?fecha=` toma hoy (Córdoba); usá el viernes de cierre de semana. Todo lo
arma `datosSemanal()` en `src/lib/informe-semanal-datos.ts` — la MISMA
función que consume la plantilla, cero query duplicada. El JSON trae
`desdeSemana` (el **ancla al último semanal ENVIADO**, no un fijo −7d: si un
viernes no salió, la ventana se ensancha sola y cubre el hueco) y:

| Campo | Qué es | Para qué producto/sección |
|---|---|---|
| `variacionGranos` | Δ% semanal de A3 (SOJ/MAI/TRI), 3 posiciones por grano | Precios de cada producto + "la semana en números" |
| `variacionChicago` | Δ% semanal de CBOT (USD/tn), 2 posiciones por grano (`grano` en minúscula: soja/maiz/trigo) | idem |
| `variacionPizarra` | Δ% semanal de la pizarra CAC-BCR (USD/tn) por grano | idem |
| `variacionDolarOficial` | Δ% semanal del oficial BCRA A3500 (no el spot UST$T de MAE — sin historial) + `serie` para el gráfico | Dólar y macro local |
| `variacionMacro` | Δ% semanal de WTI/oro/DXY/BRL/etc. (spark de Yahoo) | Contexto internacional, "otros mercados" — perilla ≥5% (calibrada por el backtest de E1, §5.3 del plan) |
| `volumenA3Semanal` | Volumen A3 semanal por underlying (5 ruedas) | Volúmenes de cada producto + "la semana en números" |
| `negociado` | `filas` (SIO Granos, activas por producto/sector) + `totalSemanal` | Comercial de cada producto (semanal/Δ/acumulado/%del total/%priceado/saldo a fijar — aritmética en el caller, ya la hace la plantilla) |
| `djveResumen` | `productos[].ton7d` por familia (Maíz/Soja/Trigo/…) | DJVE últimos 7d de cada producto |
| `empresas` | `productos[].{declarado60d,originado60d,familia}` | Gap de cobertura 60d de cada producto |
| `embarques` | `cumplimiento` (declarado vs line-up del mes) + `pico` | Comercio exterior transversal |
| `camionesSemana` | `{williams, agroentregas}` (`VentanaSuma` cada uno) | Comercio exterior transversal (se suman los 2 orígenes) |
| `arbitrajes` | `granos[].rows` (ajuste/TNA por posición) + `pizarraFecha` | Tasas implícitas de cada producto — la plantilla recalcula con `pizarra_estimada` si la persististe (ver Paso 3) |
| `pases` | `granos[].spreads` | Pases de cada producto |
| `informesSemana` | Informes de organismos publicados EN la semana, `cambios[].grano` en minúscula | Producción de cada producto |
| `pasCondicion` / `pasZonas` | Filas crudas de BCBA-PAS | Producción de cada producto (Δ de condición semana a semana, calculado por la plantilla) |
| `viewsMercado` | View vigente por grano, con `relacion_previa` | "La semana según la mesa" de cada producto |
| `interpretacionesSemana` | Interpretaciones publicadas ESTA semana, con `impacto` | idem |
| `scorecard` | Hit-rate/racha a 14 días por grano (horizonte del view desde el 07/08/2026) | Cierre, 1 vez por mes (regla 5 del Paso 2) |
| `diariosSemana` | Título+prosa de los diarios enviados desde el último semanal | Hilo narrativo de la semana (no números) |
| `dolarLinked` / `volatilidadDolar` / `comprasBcraSemana` | Tabla TNA/TEA por especie / vol. semanal+diaria / acumulado semanal BCRA | Dólar y macro local |
| `pizarra` / `dolarFuturo` / `chicago` | Foto de HOY (no variación) | Contexto de nivel para tu prosa, no de cambio |
| `noticias.destacados` / `noticiasSemana` | Top 8 de hoy / TODAS las de 7 días sin cap | Prosa (nunca sección propia) |
| `agenda` | Informes agendados para la semana PRÓXIMA | Cierre |

Si la URL de producción no responde, levantá la web local:
`NODE_USE_ENV_PROXY=1 npm run build && npm run start` y usá
`http://localhost:3000`. Síntoma a reconocer: si te vuelve el HTML de
`/ingresar` en vez del JSON, es el gate de auth de `src/proxy.ts` comiéndose
la ruta — avisalo en el cierre.

## Paso 1b — "El mundo esta semana" (research acotado, V3)

Sección que suma contexto externo a la semana, con las MISMAS reglas de
disciplina que `view-mercado` (F1/F5 de esa skill — no las reinventes):
presupuesto fijo, pasaporte obligatorio, degradación honesta si no hay nada
verificable. **Nunca camino crítico**: si esta sección sale vacía, el PDF
sale igual (P7).

Lanzá **1-2 subagentes de solo lectura** (tool Agent/Task), con presupuesto
~10-15 tool calls cada uno, salida JSON por hallazgo `{tema, dato, fuente_url,
fecha_pub, cita_textual}`:

1. **Chicago/fondos**: posicionamiento de fondos (CFTC COT desagregado —
   Socrata `publicreporting.cftc.gov/resource/72hh-3qpy.json`, managed money
   neto + Δ semanal + percentil histórico, sin key) y, si estamos en
   temporada, USDA Crop Progress (ESMIS
   `usda.library.cornell.edu/api/v1/...CropProg?latest=true`) — mismas
   fuentes que la lente 1 de `view-mercado`, no las reinventes. Podés citar
   `evidencia_externa` de `viewsMercado` (Paso 1) si ya trae algo fresco de
   la misma corrida semanal, sin refetchear.
2. **Sudamérica/clima**: Brasil en UNA línea (Canal Rural RSS, complementa
   CONAB propio — los números de producción siempre de `informesSemana`,
   esto es solo color) + clima **SOLO si movió precio** esta semana
   (SMN/NOAA CPC).

Verificá cada pasaporte antes de usarlo (la URL responde, la cita aparece —
mismo criterio F5 de `view-mercado`): lo que no verifica, se cae. Con los
hallazgos que sobrevivieron, armá **3-4 bullets máximo** (`prosa.mundo_bullets`,
Paso 3) — la salida NO crece con el research (R3/P4 de PLAN_INFORMES_V2.md):
mejor 2 bullets con dato firme que 4 flojos. Si ningún hallazgo verifica,
`mundo_bullets` queda vacío y la plantilla ya sabe mostrar "sin lectura
externa esta semana" — no fuerces contenido.

## Paso 2 — Qué destacar cada semana (el criterio)

Reglas de prioridad, en este orden (**la estructura de la placa ya es por
producto — esto ordena qué entra en el resumen ejecutivo de tapa y en el
párrafo largo de cada producto/sección, no dónde va cada dato**):

1. **Los informes de organismos ganan siempre un lugar** (`informesSemana`):
   son eventos infrecuentes y por eso son noticia aunque el ajuste sea chico.
   Si hubo uno o más esta semana, van primero en el resumen ejecutivo,
   nombrados con sus números exactos de `cambios`, y en la prosa del
   producto que tocan.
2. **El mayor movimiento de precio de la semana** (mayor `|deltaPct|` entre
   `variacionGranos` + `variacionChicago` + `variacionPizarra` +
   `variacionDolarOficial`, TODOS juntos en un solo ranking) — se explica el
   número y, si se puede, el porqué (cruzando con noticias/informesSemana).
3. **Cambios de régimen, no solo de nivel**: si `negociado`/`embarques`/
   `empresas` muestran un salto grande (% priceado se movió fuerte, el gap
   de cobertura cruzó de <1 a >1 o viceversa) — pesa MÁS que un movimiento
   de precio grande sin cambio de fondo.
4. **SWITCH del view = candidato automático**: si algún grano de
   `viewsMercado` trae `relacion_previa === "switch"` esta semana, ES bullet
   del resumen ejecutivo SIEMPRE. Citá el gatillo que `view-mercado` dejó en
   `tesis_md`/`invalidacion`, no lo reinterpretes. `ajusta`/`confirma`/
   `cumplida` no fuerzan bullet — entran por el ranking normal si pesan.
5. **Scorecard, 1 vez por mes**: si `fecha` cae en los primeros 7 días del
   mes calendario, sumá al `cierre` una mención del scorecard del mes
   anterior — hit-rate y racha de `scorecard`, citados literal (nunca
   redondeados a "casi siempre acertamos"), grano por grano si
   `nMedidos > 0`. Transparencia estilo "what we got wrong", no
   autopromoción. El resto del mes no se menciona.
6. **Todo lo demás es contexto**: se menciona en la prosa de cada
   producto/sección aunque no haya sido lo más grande, porque la plantilla
   ya muestra la tabla/gráfico completo — la prosa no repite números que el
   lector ya ve arriba, los interpreta.

**Regla N9 — sin internals (obligatoria)**: prohibido escribir "percentil",
"índice MESA", "z-score" o cualquier umbral interno en la prosa — se traduce
a tendencia/comparación temporal ("la fijación de precio viene floja frente
al promedio de la campaña", nunca "percentil 12"). Los ratios de cobertura
se narran como "cubierto vs. falta cubrir", nunca como el número de gap
crudo sin contexto. Esto es MÁS relevante en el semanal que en el diario: la
plantilla ya oculta cualquier columna de percentil, así que la prosa tampoco
puede reintroducirlo.

**Regla dura de `voz-lautaro`**: ni un número inventado. Todo dato citado
sale del JSON del Paso 1.

## Paso 3 — Redactar la prosa

Con el JSON y el criterio del Paso 2, armá el objeto `prosa`:

- **titulo**: título de la semana con personalidad (ej. "Semana de
  definiciones en el maíz", "La exportación aprieta el gap") — refleja los
  puntos 1-4 del Paso 2, no un genérico "Informe semanal".
- **resumen_ejecutivo**: array de 4-6 strings (bullets de la tapa).
- **soja_texto / maiz_texto / trigo_texto**: 1-2 párrafos por producto —
  precios + comercial + producción + "la semana según la mesa" de ESE grano,
  sin repetir los números que la tabla de su sección ya muestra (interpretalos:
  "la soja lideró la suba semanal, ver arriba, empujada por…" en vez de "la
  soja subió X%"). Reemplazan el único `granos_texto` de V2/V3.
- **local_texto**: 1 párrafo, dólar oficial (aclarando BCRA A3500 si la
  plantilla todavía no lo dice) + volatilidad + compras BCRA + linked.
- **internacional_texto**: 1 párrafo, Chicago de la semana + qué implica
  para el desacople local/internacional.
- **mundo_bullets** (array de 0-4 strings, Paso 1b): uno por hallazgo
  verificado, CON la fuente citada dentro del mismo string. Array vacío si
  el research no verificó nada.
- **comex_texto**: 1 párrafo, cumplimiento de embarques + camiones + qué
  dice sobre el apetito de la exportación esta semana.
- **cierre**: párrafo final con la nota humilde característica + qué mirar
  la semana próxima (cruzá con `agenda`; si el Paso 1b encontró una
  expectativa pre-report verificada para un informe agendado, sumala acá con
  pasaporte) + la mención de scorecard de la regla 5 del Paso 2 cuando
  corresponda.
- **pizarra_estimada** (canal N5/§6.1, opcional — solo si Lautaro cargó una
  pizarra estimada del VIERNES en el color de la mesa, `/admin/datos/mesa-color`,
  y vos la leíste de ahí): objeto `{"SOJ": {"usd": <número>}, "MAI": {...},
  "TRI": {...}}` (keys = underlying A3, mismo criterio que `pizarraEstimada`
  del informe diario). Solo el grano(s) que Lautaro haya dado — nunca
  estimes uno que no cargó. La plantilla usa este campo para recalcular la
  tabla de tasas implícitas de ESE producto con el rótulo "cálculo con
  pizarra estimada"; sin el campo, usa la pizarra OFICIAL que ya trae
  `arbitrajes` (rótulo dinámico con la fecha real de esa pizarra).

Si `viewsMercado`/`interpretacionesSemana` traen algo, la plantilla YA lo
muestra íntegro en la sección de ese producto (dirección + tesis completa +
badge de impacto) — no lo repitas en el texto del producto, como mucho
referencialo ("el view de la mesa sigue [dirección] en [grano], ver arriba").

## Paso 4 — Guardar el borrador

```
POST {SUPABASE_URL}/rest/v1/informes_generados
headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY},
         content-type: application/json, prefer: return=representation,resolution=merge-duplicates
body: [{ "tipo": "semanal", "fecha": "YYYY-MM-DD", "titulo": "<titulo>",
         "prosa": { "titulo": "<titulo>", "resumen_ejecutivo": [...],
                     "soja_texto": "...", "maiz_texto": "...", "trigo_texto": "...",
                     "local_texto": "...", "internacional_texto": "...",
                     "mundo_bullets": [...], "comex_texto": "...", "cierre": "...",
                     "pizarra_estimada": { "SOJ": { "usd": 350.5 } } },
         "estado": "borrador" }]
```

`fecha` = el viernes de cierre de semana (mismo `fecha` que usaste en el Paso
1). El UNIQUE `(tipo, fecha)` + `resolution=merge-duplicates` hace idempotente
un re-run de la misma semana. Guardá el `id` que devuelve la respuesta.

## Paso 5 — Generar el PDF

La plantilla (`/informes/plantilla/semanal?fecha=YYYY-MM-DD&token={INFORME_TOKEN}`)
lee el borrador recién guardado y arma las páginas A4 con CSS de impresión
(tema SIEMPRE claro, a diferencia de la placa diaria). Con Playwright:

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
const page = await browser.newPage();
await page.goto(`${INFORME_BASE_URL}/informes/plantilla/semanal?fecha=${fecha}&token=${INFORME_TOKEN}`, { waitUntil: "networkidle" });
await page.pdf({ path: `informe-semanal-${fecha}.pdf`, format: "A4", printBackground: true });
await browser.close();
```

**Si corrés detrás del proxy del sandbox** (Claude Code on the web: hay
`HTTPS_PROXY` seteado): Chromium NO lo toma solo, y con TLS 1.3 el handshake
muere contra el proxy (`ERR_CONNECTION_RESET`, siempre). Hace falta pasarle
el proxy Y bajar el máximo de TLS:

```js
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  proxy: { server: process.env.HTTPS_PROXY },        // ej. http://127.0.0.1:43009
  args: ["--no-sandbox", "--ssl-version-max=tls1.2"],
});
```

Contra `http://localhost:3000` (la web local del fallback del Paso 1) no
hace falta nada de esto: es loopback, no pasa por el proxy.

**Sin límite de páginas (N1, cae el `/Count ≥5` de V2/V3)**: contá
`document.querySelectorAll(".sem-hoja").length` (secciones lógicas — tapa +
"la semana en números" + 3 productos + 3 transversales + cierre = 9 hojas
fijas) y confirmá que el PDF tenga **al menos ese número** de páginas físicas
(una sección puede derramarse a 2+ páginas si su contenido es largo esa
semana — eso es correcto, no un bug). Si el PDF tiene MENOS páginas que
hojas lógicas, algo se cortó mal en el CSS de impresión — no sigas sin
revisar. No hay techo: una semana con mucho para contar simplemente imprime
más hojas.

## Paso 6 — Subir el PDF al bucket privado

```
POST {SUPABASE_URL}/storage/v1/object/informes/semanal/{fecha}.pdf
headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY}, content-type: application/pdf
body: <bytes del PDF>
```

Guardá el path (`semanal/{fecha}.pdf`) — va en `path_pdf` del registro
(`PATCH informes_generados?id=eq.{id}` con `{"path_pdf": "semanal/{fecha}.pdf"}`,
mismos headers + `content-type: application/json`).

## Paso 7 — Mandar el mail

El HTML del mail suma, sobre el mail simple de antes, **3 links de nota
1-tap** (N15, mismo mecanismo que el informe diario — 👍/😐/👎 gradan la nota
sin login):

```
GET {INFORME_BASE_URL}/api/informes/nota?id={id}&n={1|3|5}&t={firma}
```

`{firma}` = HMAC-SHA256 hex de `"{id}:{n}"` con el secret
`INFORME_SHARE_SECRET`. Si no tenés forma de calcular HMAC-SHA256 en el
entorno de la Routine, Node trae `crypto` built-in
(`createHmac("sha256", secret).update(payload).digest("hex")`).

```
POST https://api.resend.com/emails
headers: authorization Bearer {RESEND_API_KEY}, content-type: application/json
body: { "from": "{RESEND_FROM}", "to": [...ADMIN_EMAILS separados por coma],
        "subject": "Informe semanal ROFO AGRO — semana {desdeSemana DD/MM}–{fecha DD/MM}",
        "html": "<breve, 2-3 líneas + 'ver en /informes' + 3 links de nota 1-tap>",
        "attachments": [{ "filename": "informe-semanal-{fecha}.pdf", "content": "<PDF en base64>" }] }
```

Si `RESEND_API_KEY` o `INFORME_SHARE_SECRET` faltan, saltealos y decilo en el
resumen (los links de nota degradan solos: sin secret, el endpoint los
rechaza con 400 en vez de romper) — no es motivo para no completar el resto.

## Paso 8 — Marcar enviado

```
PATCH {SUPABASE_URL}/rest/v1/informes_generados?id=eq.{id}
headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY}, content-type: application/json
body: { "estado": "enviado" }
```

Recién ahí la fila aparece en `/informes` (RLS: anon solo ve
`estado=enviado`, sección "Informe semanal" de la página).

## Paso 9 — Telemetría + cierre

**Telemetría (N13)**: insertá una fila en `routine_runs` antes del resumen:

```
POST {SUPABASE_URL}/rest/v1/routine_runs
headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY}, content-type: application/json
body: [{ "tipo": "semanal", "fecha": "YYYY-MM-DD",
         "iniciado_en": "<ISO de cuando arrancó el Paso 1>",
         "terminado_en": "<ISO de ahora>",
         "degradaciones": { "mundo_bullets": <bool: vacío>, "pizarra_estimada": <bool: sin cargar>, "resend": <bool: sin key>, ... },
         "mail_enviado": <bool> }]
```

Resumen final: título de la semana, los 4-6 bullets del resumen ejecutivo,
qué insumo degradó (si alguno — ej. "sin view de mercado esta semana", "sin
lectura externa esta semana, Paso 1b no verificó nada", "sin pizarra
estimada, se usó la oficial en tasas implícitas"), cuántos tool calls usó el
research del Paso 1b (línea de base de consumo, R5) y si el mail salió. Si
algo falló a mitad de camino, decilo fuerte — nunca en silencio. Si en esta
corrida ajustaste el criterio del Paso 2 por feedback de Lautaro, dejalo
escrito en el resumen (y considerá editar esta misma sección del SKILL).

## Modo de prueba

Con `--fecha` (o pedido "en seco"): corré los pasos 1-6 y mostrá el PDF SIN
guardar en Supabase ni mandar mail — marcá "PRUEBA — no persistido". Si
necesitás probar la prosa/borrador en sí (no solo los datos automáticos),
insertá una fila real de `informes_generados` con `estado=borrador` y
BORRALA al terminar (mismo patrón ya usado en E1/E3 — nunca dejar un
residuo de prueba en producción).
