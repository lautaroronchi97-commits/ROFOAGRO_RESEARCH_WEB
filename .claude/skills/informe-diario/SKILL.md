---
name: informe-diario
description: >-
  Procedimiento del informe diario de ROFO AGRO (MP1 de docs/PLAN_INFORMES.md):
  generar la placa PNG vertical de research diario (datos automáticos + color
  de la rueda de Lautaro + prosa con su voz), guardarla, mandarla por mail y
  dejarla en /informes. Usar cuando se pida "generá el informe diario" o la
  Routine diaria (post-cierre, días hábiles) lo dispare. Sigue sin
  multi-agente a propósito (V4 de docs/PLAN_INFORMES_V2.md §6.4): su valor es
  salir siempre, rápido.
# El informe sale con la firma de Lautaro: la prosa la tiene que escribir el
# modelo grande, con tiempo para pensar el título y el color del día. Esto pisa
# el modelo de la sesión (y el del selector de la Routine) solo para este turno.
model: claude-opus-5
effort: medium
---

# Informe diario — procedimiento

Sos quien redacta y arma el informe diario de la mesa de ROFO AGRO. Todos los días
hábiles, post-cierre, generás UNA placa PNG (~1080×1600) con los datos del día +
prosa con la voz de Lautaro, la mandás por mail y queda en `/informes`. Es
DIARIO: no debe abrumar — una placa que se lee en 30-60 segundos.

## Requisitos (env vars del entorno)

| Var | Para qué |
|---|---|
| `INFORME_BASE_URL` | Base de la web (producción; `http://localhost:3000` en pruebas locales) |
| `INFORME_TOKEN` | Token del endpoint de datos y de la plantilla |
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | Guardar el registro, leer el color de la rueda, subir el PNG (Storage) |
| `RESEND_API_KEY` + `RESEND_FROM` + `ADMIN_EMAILS` | Mandar el mail con la placa adjunta |

Si falta alguna, avisá el faltante en el resumen final y hacé lo que se pueda
(nunca inventes datos ni mandes el mail sin la key).

## Paso 0 — Voz (siempre antes de redactar)

Leé la skill `voz-lautaro` (`SKILL.md` + `references/ejemplos.md`). El molde es
el reporte **"Mesa de operaciones"** (recap diario): título de la jornada con
personalidad, comentario general en bullets, bloques por producto con precio +
variación + color, cierre con datos extras. Registro "placa": emojis
funcionales sí, hashtags no (esto no va a X, va por mail/WhatsApp).

## Paso 1 — Insumos (todos de la web; cero número inventado)

```
GET {INFORME_BASE_URL}/api/informes/datos?fecha=YYYY-MM-DD
    Authorization: Bearer {INFORME_TOKEN}
```

Sin `?fecha=` toma hoy (Córdoba). Devuelve: `cierres` (futuros por grano y
posición con `settlement` + `changePercent` vs la rueda anterior), `arbitrajes`
(spread/TNA disponible vs futuro), `pizarra` (CAC $ y USD por grano),
`volumenPorGrano` (total operado en A3 del día, sumando TODAS las posiciones
vivas de cada grano — `null` si no hubo dato, `0` si hubo dato y no se operó
nada), `dolarFuturo` (mayorista + curva DDF con TNA), `chicago` (los 5 de
Chicago en USD/tn + Δ), `noticias.destacados` (top 4 del día), `agenda`
(informes de hoy/mañana), `color` (el texto que Lautaro cargó en
`/admin/datos`, o `null` si no cargó nada ese día — el informe sale igual),
`informesHoy` (informes de organismos —USDA/CONAB/GEA/DEA— publicados JUSTO
ese día, con sus `cambios` exactos: grano/país/campaña, antes→ahora, unidad),
`interpretaciones` (si el mini-proyecto MP4 ya publicó su lectura de alguno de
esos informes — normalmente vacío hasta que MP4 exista, no es un error) y
`bcra` (compras netas del BCRA del día en M USD — carga MANUAL de Lautaro en
`/admin/datos`; `null` si no cargó nada ese día. P3 de `PLAN_BACKLOG.md` va a
sumar la ingesta automática a la misma tabla más adelante — hasta entonces,
solo hay dato si Lautaro lo cargó) y `viewsMercado` (V4: el view direccional
vigente por grano — V1, viernes — con su `evidencia_externa` YA verificada en
esa corrida; ver Paso 2).

La plantilla (paso 4) YA renderiza el volumen por grano, el `bcra` del día y
una sección "Informe del día" con `informesHoy`/`interpretaciones` solas — no
hace falta que los repitas en la prosa, pero si `informesHoy` trae algo
relevante (una revisión grande) o `bcra` fue un día fuerte, está bien
mencionarlo en el `comentario` general (ej. "BCRA siguió acumulando firme",
tal como en los ejemplos de `voz-lautaro`).

Si la URL de producción no responde (la ruta recién deployada), levantá la web
local: `NODE_USE_ENV_PROXY=1 npm run build && npm run start` y usá
`http://localhost:3000`.

Síntoma a reconocer: si en vez del JSON (o de la placa, en el paso 4) te vuelve
el HTML de `/ingresar`, es el gate de auth de `src/proxy.ts` comiéndose la ruta
— tiene que estar en la lista de excepciones junto a `/api/informes/` y
`/informes/plantilla/`. Es bug de código, no falta de permisos: avisalo en el
cierre además de usar la web local para destrabar el informe del día.

## Paso 2 — Redactar la prosa

Con el JSON del paso 1, armá:

- **titulo**: el título de la jornada, con personalidad según cómo estuvo el
  día ("DIA HISTORICO", "Que semanita…", "¡Volatilidad, al palo!" — ver
  `ejemplos.md`). Si `color` tiene texto, es tu insumo más rico para definirlo.
- **comentario**: 2-4 bullets (color de mercado del día). Integrá el `color`
  de Lautaro si existe; si no, describí el día con lo que dice `cierres` /
  `arbitrajes` / `noticias` (nunca inventes un negocio o sensación que no está
  en los datos ni en el color cargado).
- **lineas_por_grano**: un objeto `{ soj: "...", mai: "...", tri: "..." }` con
  UNA línea por grano (comentario breve del producto, en el tono del molde:
  "Al inicio de la rueda… los precios mejoraron…"). Basate en `changePercent`
  de `cierres` y el nivel de `pizarra`/`arbitrajes` de ese grano. Si un grano
  no tuvo cierres, decilo cualitativamente ("sin cierres hoy") en vez de
  inventar un movimiento.

**Sobre el `color`**: leé `references/ejemplo-color-operador.md` — casi
siempre trae precios/volúmenes/pizarra estimada REALES de un operador de la
mesa (no solo una sensación), incluyendo si hubo negocios a fijar y si la
exportación está "apretando" o floja. Son tan citables como el JSON: si el
color trae un precio o volumen que `cierres`/`pizarra` no tiene (ej. sorgo,
"contractual"), usalo igual. Si el color y el dato automático difieren (pizarra
estimada de la mesa vs cierre oficial CAC), mostrá los dos — no "corrijas" uno
con el otro, son lecturas distintas del mismo día.

**Contexto del view vigente (V4, opcional — NO es una sección fija)**: si
`viewsMercado` trae, para algún grano, un dato de `evidencia_externa` que
siga siendo relevante HOY (ej. "fondos vendidos récord" de la corrida del
viernes), podés citarlo en el `comentario` como contexto — es un dato ya
verificado en F5 de `view-mercado` (cero fetch nuevo, cero research propio
del diario). Nunca reinterpretes el view ni le sumes una lectura nueva: solo
citás lo que ya está guardado, y solo si aporta al día de hoy — la mayoría de
los días no hay nada que agregar acá, y está bien que no lo haya (R4/R5 de
`PLAN_INFORMES_V2.md`: el diario NO se sofistica, su valor es salir siempre,
en minutos).

Regla dura de `voz-lautaro`: **ni un número inventado**. Todo dato sale del
JSON del paso 1 o del `color` cargado por Lautaro.

## Paso 3 — Guardar el borrador

```
POST {SUPABASE_URL}/rest/v1/informes_generados
headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY},
         content-type: application/json, prefer: return=representation,resolution=merge-duplicates
body: [{ "tipo": "diario", "fecha": "YYYY-MM-DD", "titulo": "<titulo>",
         "prosa": { "titulo": "<titulo>", "comentario": [...], "lineas_por_grano": {...} },
         "estado": "borrador" }]
```

El UNIQUE `(tipo, fecha)` + `resolution=merge-duplicates` hace idempotente un
re-run del mismo día (pisa el borrador anterior si volvés a correr antes de
mandarlo). Guardá el `id` que devuelve la respuesta.

## Paso 4 — Screenshotear la placa

La plantilla (`/informes/plantilla/diario?fecha=YYYY-MM-DD&token={INFORME_TOKEN}`)
lee el borrador recién guardado y arma el layout con la marca de la web (tema
claro, decidido con Lautaro el 22/07). Con Playwright:

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
const page = await browser.newPage({ viewport: { width: 1080, height: 1000 } });
await page.goto(`${INFORME_BASE_URL}/informes/plantilla/diario?fecha=${fecha}&token=${INFORME_TOKEN}`, { waitUntil: "networkidle" });
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

```
POST https://api.resend.com/emails
headers: authorization Bearer {RESEND_API_KEY}, content-type: application/json
body: { "from": "{RESEND_FROM}", "to": [...ADMIN_EMAILS separados por coma],
        "subject": "Informe diario ROFO AGRO — {fecha DD/MM}",
        "html": "<breve, 2-3 líneas + 'ver en /informes'>",
        "attachments": [{ "filename": "informe-{fecha}.png", "content": "<PNG en base64>" }] }
```

Si `RESEND_API_KEY` falta, saltealo y decilo en el resumen — no es motivo para
no completar el resto.

## Paso 7 — Marcar enviado

```
PATCH {SUPABASE_URL}/rest/v1/informes_generados?id=eq.{id}
headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY}, content-type: application/json
body: { "estado": "enviado" }
```

Recién ahí la fila aparece en `/informes` (RLS: anon solo ve `estado=enviado`).

## Paso 8 — Cierre

Resumen final: título del día, si el color de Lautaro estaba cargado o no, qué
insumo degradó (si alguno), y si el mail salió. Si algo falló a mitad de
camino, decilo fuerte — nunca en silencio (ej. "se generó el PNG pero no se
pudo mandar el mail: falta RESEND_API_KEY").

## Paso 9 — Interpretación de informes de organismos (V2 de PLAN_INFORMES_V2.md §6.2, después del Paso 7)

Con el mismo JSON del Paso 1 ya tenés `informesHoy`: los informes de
organismos (USDA/CONAB/BCR-GEA/DEA-SAGyP/BCBA-PAS) que se publicaron **hoy O
se cargaron a la base hoy** (`actualizadoEn`, fix de auditoría V2 — BCBA-PAS
se sube con la fecha REAL del informe, que puede ser de días atrás; el
disparo ya contempla las dos fechas, no hace falta que vos lo chequees a
mano), cada uno con `organismo`, `informe` y `cambios` (grano/país/campaña,
antes→ahora, delta, unidad — números exactos, ya calculados por
`estimaciones.ts`). Si `informesHoy` viene vacío, no hay nada que hacer en
este paso — seguí directo al cierre (Paso 8).

Para cada entrada de `informesHoy` con `cambios.length > 0`:

1. **Chequeá si ya existe** una interpretación para esa combinación exacta:
   ```
   GET {SUPABASE_URL}/rest/v1/interpretaciones?organismo=eq.{organismo}&informe=eq.{informe}&fecha_publicacion=eq.{fecha}&select=id
   headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY}
   ```
   Si devuelve una fila, **saltealo** (ya se generó — no lo pises: puede tener
   ediciones de Lautaro encima).

2. **Research acotado — SOLO para informes USDA** (presupuesto fijo, ≤10 tool
   calls; GEA/DEA/CONAB/PAS no tienen encuesta de expectativas pública, van
   directo al paso 3): buscá la tabla de expectativas pre-report para ESTE
   informe (WASDE/Crop Production/Grain Stocks/Acreage).
   - **Fuente primaria: DTN** (`dtnpf.com`, buscar con Google News RSS o
     WebSearch el artículo de esa semana — verificado el 28/07/2026 con un
     fetch real: la tabla completa `Avg/High/Low` por grano queda visible SIN
     login en el artículo, no solo en la portada). Si el artículo específico
     de esta corrida SÍ pide login/paywall (puede pasar con formatos nuevos),
     caé a **Pro Farmer** como respaldo y anotalo en el resumen.
   - Extraé, para cada grano de `cambios`: el promedio esperado por el
     mercado (`Avg`) y el rango (`High`/`Low`) de la variable que cambió
     (ending stocks, producción, etc.), con **pasaporte**: `{dato, url,
     fecha_pub, cita}` — la cita textual exacta de la tabla, y verificá antes
     de usarla que la URL responde y la cita aparece (mismo criterio F5 de
     `view-mercado`: lo que no verifica, se cae).
   - Si no conseguís una expectativa confiable (gate, artículo no encontrado,
     cita no verifica), **NO inventes una — seguí sin ella** y decilo en la
     interpretación ("sin encuesta de expectativas a mano esta vez").
   - Devolvé vacío es una respuesta válida — no fuerces una tabla que no
     verifica.

3. **Redactá el borrador** (3-6 párrafos, voz `voz-lautaro` registro
   **"Informe largo"** — rigor de datos + framing didáctico ["Recordemos
   que…", "Dato no menor…"], emojis muy puntuales o ninguno) con esta
   estructura (siempre, GEA/DEA/CONAB/PAS incluidos):
   - **Qué se esperaba**: para USDA con expectativa verificada (paso 2),
     el `Avg`/rango del mercado, citado con su pasaporte. Para
     GEA/DEA/CONAB/PAS (sin encuesta pública) o si el paso 2 no consiguió
     nada: "consenso implícito" — la estimación PREVIA de ese mismo
     organismo (vintage anterior, ya en `cambios`) + qué venían diciendo los
     otros organismos si hay un dato comparable en el JSON del Paso 1 (todo
     en casa, sin research nuevo).
   - **Qué salió**: cada número de `cambios` tal cual (antes → ahora, delta,
     unidad) — el dato duro, siempre presente.
   - **Sorpresa**: comparar qué salió vs qué se esperaba → alcista/bajista/
     neutral y por qué. Si no hay expectativa (ni encuesta ni consenso
     implícito claro), decilo y quedate solo con la descripción del cambio.
   - **Cuánto ya estaba en el precio** (SIEMPRE, no solo con expectativa
     verificada): qué venía haciendo Chicago (`chicago` del JSON, o
     `cbot_cierres` si hace falta más historia) en los días previos a este
     informe — si el movimiento ya se veía venir, decilo ("el mercado lo
     venía descontando: Chicago ya había caído X% en la semana previa") en
     vez de presentar como sorpresa algo que ya estaba en el precio.
   - **Reacción del precio**: qué hizo Chicago EL DÍA del informe
     (`chicago`/`cierres` del JSON — dato propio, cero fetch nuevo), citado
     junto a la sorpresa.
   - **Qué implica y qué mirar**: para precios/mesa (a qué grano/plaza pega,
     si es alcista/bajista/neutral y por qué) y qué evento mirar ahora
     (`agenda` del JSON).
   - Si `color` (el texto que Lautaro cargó ese día) o una lectura propia
     que haya compartido tocan este mismo informe, citalos como el color de
     la rueda — **citables, nunca fuente de números ni algo que "corregís"**;
     si su lectura y el dato difieren, mostrá las dos.
   - Antes de escribir, leé las interpretaciones YA PUBLICADAS de este mismo
     organismo (`GET .../interpretaciones?organismo=eq.{organismo}&estado=eq.publicado&order=fecha_publicacion.desc&limit=3`)
     como calibración de CRITERIO (qué priorizó/descartó Lautaro, qué tono) —
     **nunca como fuente de números**, los números siempre salen de cero del
     dato crudo (`cambios`).
   - **Regla dura: solo números que están en `cambios`, en el resto del JSON
     del Paso 1, o en un pasaporte verificado del paso 2 — nada inventado.**
     Si un cambio es chico o dudoso, decilo con la humildad característica
     ("a mi óptica, no es un cambio que mueva el amperímetro") en vez de
     forzarle relevancia.

4. **Guardá el borrador** (con la evidencia externa del paso 2, si hubo):
   ```
   POST {SUPABASE_URL}/rest/v1/interpretaciones
   headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY},
            content-type: application/json, prefer: return=representation,resolution=merge-duplicates
   body: [{ "organismo": "{organismo}", "informe": "{informe}",
            "fecha_publicacion": "{fecha}",
            "granos": [...granos únicos de cambios],
            "borrador_md": "<el texto en markdown simple: párrafos separados
              por línea en blanco, **negrita** con doble asterisco>",
            "evidencia_externa": [{"dato":"...", "url":"...", "fecha_pub":"...", "cita":"..."}, …],
            "estado": "borrador" }]
   ```
   `evidencia_externa` queda `[]` si el paso 2 no aplicó o no consiguió nada
   verificable — nunca inventes un pasaporte para llenarlo. El UNIQUE
   `(organismo, informe, fecha_publicacion)` + `resolution=merge-duplicates`
   lo hace idempotente (por eso el chequeo del paso 1 ya evita pisar una
   edición — este POST solo corre si no existía fila).

5. **Avisá por mail** (mismo `RESEND_API_KEY`/`RESEND_FROM`/`ADMIN_EMAILS`
   del Paso 6, sin adjunto):
   ```
   POST https://api.resend.com/emails
   body: { "from": "{RESEND_FROM}", "to": [...ADMIN_EMAILS],
           "subject": "Nueva interpretación para revisar — {organismo} {informe}",
           "html": "<el borrador_md convertido a HTML simple (párrafos) +
             link a {INFORME_BASE_URL}/admin/interpretaciones>" }
   ```
   Su firma nunca sale sin su OK: el borrador queda en `/admin/interpretaciones`
   hasta que Lautaro lo edite/publique/descarte a mano — este paso NUNCA
   publica.

Si falta `SUPABASE_SERVICE_KEY` o `RESEND_API_KEY`, saltealo y decilo en el
resumen del Paso 8 (no es motivo para no completar el resto del informe
diario, que ya corrió antes en los Pasos 1-7).

## Modo de prueba

Con `--fecha` (o pedido "en seco"): corré los pasos 1-4 y mostrá el PNG SIN
guardar en Supabase ni mandar mail — marcá "PRUEBA — no persistido". El Paso
9 (interpretaciones) también se salta en modo prueba.
