---
name: informe-semanal
description: >-
  Procedimiento del informe semanal de ROFO AGRO (MP2 de docs/PLAN_INFORMES.md):
  generar el PDF A4 de 5 páginas tipo research de ALyC (la semana en números +
  gráficos + interpretación larga con la voz de Lautaro), guardarlo, mandarlo
  por mail y dejarlo en /informes. Usar cuando se pida "generá el informe
  semanal" o la Routine semanal (viernes post-cierre) lo dispare.
# El informe sale con la firma de Lautaro: la prosa la tiene que escribir el
# modelo grande, con tiempo para pensar el criterio de qué destacar (Paso 2).
# Esto pisa el modelo de la sesión (y el del selector de la Routine) solo para
# este turno.
model: claude-opus-5
effort: high
---

# Informe semanal — procedimiento

Sos quien redacta y arma el informe semanal de la mesa de ROFO AGRO. Todos los
viernes, post-cierre, generás UN PDF A4 de 5 páginas (base + gráficos ya están
construidos — ver `src/app/informes/plantilla/semanal/page.tsx`) con la semana
en números y una interpretación larga con la voz de Lautaro, lo mandás por
mail y queda en `/informes`. A diferencia del diario (mecánico, 30-60
segundos), acá el valor es el CRITERIO: qué de todo lo que pasó en la semana
merece estar en el resumen ejecutivo.

## Requisitos (env vars del entorno)

| Var | Para qué |
|---|---|
| `INFORME_BASE_URL` | Base de la web (producción; `http://localhost:3000` en pruebas locales) |
| `INFORME_TOKEN` | Token del endpoint de datos y de la plantilla |
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | Guardar el registro, leer el borrador, subir el PDF (Storage) |
| `RESEND_API_KEY` + `RESEND_FROM` + `ADMIN_EMAILS` | Mandar el mail con el PDF adjunto |

Si falta alguna, avisá el faltante en el resumen final y hacé lo que se pueda
(nunca inventes datos ni mandes el mail sin la key).

## Paso 0 — Voz (siempre antes de redactar)

Leé la skill `voz-lautaro` (`SKILL.md` + `references/ejemplos.md`). Acá el
registro es **"informe largo"**: voseo, rigor de datos + framing didáctico
("Recordemos que…", "Dato no menor…"), humildad marca registrada ("a mi
óptica", "esto es simplemente mi visión") en el cierre, emojis muy puntuales
(uno por sección como mucho, no en cada línea — esto se imprime en PDF, no va
a X ni a WhatsApp).

## Paso 1 — Insumos (todos de la web/base; cero número inventado)

```
GET {INFORME_BASE_URL}/api/informes/datos?tipo=semanal&fecha=YYYY-MM-DD
    Authorization: Bearer {INFORME_TOKEN}
```

Sin `?fecha=` toma hoy (Córdoba); usá el viernes de cierre de semana. El JSON
trae `desdeSemana` (el inicio real de la ventana — nunca asume "viernes
calendario", usa la fecha real más cercana a 7 días antes) y:

| Campo | Qué es | Página que lo origina |
|---|---|---|
| `variacionGranos` | Δ% semanal de A3 (SOJ/MAI/TRI), 3 posiciones más cercanas por grano, con `fechaActual`/`fechaPrevia` reales | `/granos` |
| `variacionChicago` | Δ% semanal de CBOT (USD/tn), 2 posiciones por grano | `/granos` (monitor) |
| `variacionPizarra` | Δ% semanal de la pizarra CAC-BCR (USD/tn) por grano | `/granos` |
| `variacionDolarOficial` | Δ% semanal del oficial **BCRA A3500** (no el spot UST$T de MAE — ese no tiene historial) + `serie` para el gráfico | `/dolar` |
| `viewsMercado` | El view vigente por grano (MP3, si ya corrió esta semana): dirección/confianza/tesis | `/granos/view` |
| `negociado` | Venta semanal SIO por producto/campaña/sector, Δ vs semana previa, acumulado, % priceado | `/comercio/negociado` |
| `embarques` | Cumplimiento del mes en curso (declarado DJVE vs embarcado line-up) por producto | `/comercio/embarques` |
| `empresas` | Gap de cobertura foto-forward 60d por producto (declarado vs originado) | `/comercio/empresas` |
| `pizarra` / `dolarFuturo` / `chicago` | Foto de HOY (no variación) — contexto de nivel, no de cambio | `/granos` / `/dolar` |
| `noticias.destacados` | Top 8 titulares de la semana | `/noticias` |
| `informesSemana` | Informes de organismos (USDA/CONAB/GEA/DEA) publicados EN la semana, con `cambios` exactos (grano/país/campaña, antes→ahora, unidad) | `/produccion` |
| `agenda` | Informes de organismos agendados para la semana PRÓXIMA | `/produccion` |

Cada bloque de variación trae `actual`/`previa`/`deltaPct`/`fechaActual`/
`fechaPrevia` — si `deltaPct` es `null` es porque no había 2 fechas reales
para comparar (nunca se inventa). Si la URL de producción no responde,
levantá la web local: `NODE_USE_ENV_PROXY=1 npm run build && npm run start` y
usá `http://localhost:3000`.

Síntoma a reconocer: si en vez del JSON (o del PDF, en el paso 5) te vuelve
el HTML de `/ingresar`, es el gate de auth de `src/proxy.ts` comiéndose la
ruta — tiene que estar en la lista de excepciones junto a `/api/informes/` y
`/informes/plantilla/`. Es bug de código, no falta de permisos: avisalo en el
cierre además de usar la web local para destrabar el informe de la semana.

## Paso 2 — Qué destacar cada semana (el criterio)

Esto es lo que Lautaro pidió pensar con calma; acá va una primera versión
razonada — **tratala como borrador de criterio**: la primera vez que generes
un informe real con ella, mostrale el resultado y ajustá esta sección con su
feedback (es la misma lógica de `aprendizajes.md` de `view-mercado`, pero
todavía no existe el archivo — si Lautaro corrige algo, anotalo acá mismo al
cierre de esa sesión).

Reglas de prioridad, en este orden:

1. **Los informes de organismos ganan siempre un lugar** (`informesSemana`):
   son eventos infrecuentes (semanal o menos) y por eso son noticia aunque el
   ajuste sea chico — igual criterio que ya usa `informe-diario` Paso 9. Si
   hubo uno o más esta semana, van primero en el resumen ejecutivo y se
   nombran con sus números exactos de `cambios`.
2. **El mayor movimiento de precio de la semana** (mayor `|deltaPct|` entre
   `variacionGranos` + `variacionChicago` + `variacionPizarra` +
   `variacionDolarOficial`, TODOS juntos en un solo ranking) — se explica el
   número y, si se puede, el porqué (cruzando con noticias/informesSemana de
   esa misma semana).
3. **Cambios de régimen, no solo de nivel**: si `viewsMercado` cambió de
   dirección respecto al que se citó la semana pasada (comparalo si tenés el
   informe anterior a mano; si no, mencioná la dirección vigente igual), o si
   `negociado`/`embarques`/`empresas` muestran un salto grande (ej. % priceado
   se movió fuerte, el ratio de cobertura cruzó de <1 a >1 o viceversa) — eso
   pesa MÁS que un movimiento de precio grande sin cambio de fondo.
4. **Todo lo demás es contexto**, no protagonista: se menciona en el cuerpo de
   cada página (granos/dólar/comex) aunque no haya sido lo más grande, porque
   la plantilla ya muestra la tabla/gráfico completo — la prosa no repite
   números que el lector ya ve en la tabla, los interpreta.

Con eso arma el **resumen ejecutivo** (`prosa.resumen_ejecutivo`, 4-6 bullets
cortos para la tapa, en orden de prioridad 1→4 de arriba) y los textos de cada
página (`granos_texto`/`dolar_texto`/`comex_texto`), que van DEBAJO de la
tabla/gráfico de esa página y por eso no repiten el número — lo leen, ej. "la
soja lideró la suba semanal (+X%, ver arriba), empujada por…" en vez de
"la soja subió X%".

**Regla dura de `voz-lautaro`**: ni un número inventado. Todo dato citado sale
del JSON del Paso 1.

## Paso 3 — Redactar la prosa

Con el JSON y el criterio del Paso 2, armá el objeto `prosa`:

- **titulo**: título de la semana con personalidad (ej. "Semana de definiciones
  en el maíz", "La exportación aprieta el gap") — refleja el punto 1-3 del
  Paso 2, no un genérico "Informe semanal".
- **resumen_ejecutivo**: array de 4-6 strings (bullets de la tapa).
- **granos_texto**: 1 párrafo, granos A3 + pizarra + negociado de la semana.
- **dolar_texto**: 1 párrafo, dólar oficial (aclarando que es BCRA A3500, no
  el spot que usa el resto de la web, SOLO la primera vez que la aclaración no
  esté ya impresa en la plantilla — si la plantilla ya lo dice, no lo repitas)
  + Chicago.
- **comex_texto**: 1 párrafo, cumplimiento de embarques + gap de cobertura +
  qué dice sobre el apetito de la exportación esta semana.
- **cierre**: párrafo final con la nota humilde característica + qué mirar la
  semana próxima (cruzá con `agenda` — si hay un informe agendado que puede
  mover el precio, nombralo).

Si `viewsMercado` trae algo, la plantilla YA lo muestra íntegro en la página
5 (dirección + tesis completa) — no lo repitas en `cierre`, como mucho
referencialo ("el view de la mesa sigue [dirección] en [grano], ver detalle").

## Paso 4 — Guardar el borrador

```
POST {SUPABASE_URL}/rest/v1/informes_generados
headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY},
         content-type: application/json, prefer: return=representation,resolution=merge-duplicates
body: [{ "tipo": "semanal", "fecha": "YYYY-MM-DD", "titulo": "<titulo>",
         "prosa": { "titulo": "<titulo>", "resumen_ejecutivo": [...],
                     "granos_texto": "...", "dolar_texto": "...",
                     "comex_texto": "...", "cierre": "..." },
         "estado": "borrador" }]
```

`fecha` = el viernes de cierre de semana (mismo `fecha` que usaste en el Paso
1). El UNIQUE `(tipo, fecha)` + `resolution=merge-duplicates` hace idempotente
un re-run de la misma semana (pisa el borrador si volvés a correr antes de
mandarlo). Guardá el `id` que devuelve la respuesta.

## Paso 5 — Generar el PDF

La plantilla (`/informes/plantilla/semanal?fecha=YYYY-MM-DD&token={INFORME_TOKEN}`)
lee el borrador recién guardado y arma las 5 páginas A4 con CSS de impresión
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

Confirmá que el PDF tenga **al menos 5** páginas (`/Count`) antes de seguir — si tiene menos,
algo se cortó mal en el CSS de impresión, no sigas sin revisar. Si tiene MÁS de 5 no es un error:
la página 5 (view de mercado) muestra las 3 tesis completas de `viewsMercado`, y cuando son
largas se derraman a una 6ª+ hoja a propósito (decisión de Lautoro, 27/07/2026) — el pie de esa
página fluye después del contenido en vez de quedar anclado, así que no queda flotando a mitad de
hoja. Revisá igual el PDF a ojo si el conteo es MUY alto (7+) — ahí sí puede ser una señal real de
que algo no está renderizando bien.

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

```
POST https://api.resend.com/emails
headers: authorization Bearer {RESEND_API_KEY}, content-type: application/json
body: { "from": "{RESEND_FROM}", "to": [...ADMIN_EMAILS separados por coma],
        "subject": "Informe semanal ROFO AGRO — semana {desdeSemana DD/MM}–{fecha DD/MM}",
        "html": "<breve, 2-3 líneas + 'ver en /informes'>",
        "attachments": [{ "filename": "informe-semanal-{fecha}.pdf", "content": "<PDF en base64>" }] }
```

Si `RESEND_API_KEY` falta, saltealo y decilo en el resumen — no es motivo
para no completar el resto.

## Paso 8 — Marcar enviado

```
PATCH {SUPABASE_URL}/rest/v1/informes_generados?id=eq.{id}
headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY}, content-type: application/json
body: { "estado": "enviado" }
```

Recién ahí la fila aparece en `/informes` (RLS: anon solo ve
`estado=enviado`, sección "Informe semanal" de la página).

## Paso 9 — Cierre

Resumen final: título de la semana, los 4-6 bullets del resumen ejecutivo,
qué insumo degradó (si alguno — ej. "sin view de mercado esta semana, MP3 no
corrió"), y si el mail salió. Si algo falló a mitad de camino, decilo fuerte
— nunca en silencio. Si en esta corrida ajustaste el criterio del Paso 2 por
feedback de Lautaro, dejalo escrito en el resumen para que quede como
histórico de la decisión (y considerá editar esta misma sección del SKILL con
su corrección).

## Modo de prueba

Con `--fecha` (o pedido "en seco"): corré los pasos 1-5 y mostrá el PDF SIN
guardar en Supabase ni mandar mail — marcá "PRUEBA — no persistido".
