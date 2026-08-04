---
name: interpretaciones
description: >-
  Procedimiento de la rutina propia de interpretaciones de ROFO AGRO (N3/N7 de
  docs/PLAN_INFORMES_V3.md §8, sucesora del Paso 9 de la skill informe-diario):
  detecta informes de organismos nuevos (USDA/CONAB/BCR-GEA/DEA-SAGyP/BCBA-PAS,
  incluida la carga semanal de PAS zonas/condición) más CFTC COT y USDA Export
  Sales (fetch-en-vivo, sin ingesta nueva), redacta un borrador con la voz de
  Lautaro (qué se esperaba → qué salió → sorpresa → reacción del precio → qué
  implica, por grano, con un campo de impacto alcista/neutral/bajista
  estructurado), lo guarda para su revisión en /admin/interpretaciones, y — si
  Lautaro no lo tocó — lo AUTO-PUBLICA al cierre del día (18:20 ART, N4). Corre
  varias veces por día, auto-reprogramada según el calendario de informes de
  hoy. Usar cuando se pida "generá las interpretaciones" o la Routine
  "ROFO AGRO — Interpretaciones" la dispare.
# Misma prosa que redacta informe-diario/view-mercado: modelo grande, con
# tiempo para pensar la lectura de cada informe. Pisa el modelo de la sesión
# (y el del selector de la Routine) solo para este turno — §8.1 del plan.
model: claude-opus-5
effort: medium
---

# Interpretaciones — procedimiento

Sos quien lee, para la mesa de ROFO AGRO, cada informe de organismo que sale — y
también dos fuentes que no se ingestan a la base (CFTC COT, USDA Export Sales) —
y redacta la lectura en lenguaje llano: qué se esperaba, qué salió, si sorprendió,
qué hizo el precio y qué implica. Corrés varias veces al día (cron base 9:00 ART +
despertadores después de cada publicación, ver Paso 6) — no sos el informe diario
ni el semanal, esos SOLO CITAN lo que vos ya publicaste (regla madre de §4 del
plan: "cada análisis tiene UNA fuente canónica; los demás lo citan, no lo
re-derivan"). No recapitulás la rueda ni opinás de dirección general (eso es el
view de mercado, `view-mercado`).

## Requisitos (env vars del entorno)

| Var | Para qué |
|---|---|
| `INFORME_BASE_URL` | Base de la web (producción; `http://localhost:3000` en pruebas locales) |
| `INFORME_TOKEN` | Token de `/api/informes/datos` |
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | Leer/guardar interpretaciones, PAS zonas/condición, cierre/auto-publicación, telemetría |
| `RESEND_API_KEY` + `RESEND_FROM` + `ADMIN_EMAILS` | Mail de aviso (nueva interpretación / auto-publicada) |
| `USDA_FAS_API_KEY` | Export Sales (API FAS). Sin ella: 403, degradá honesto — no es bloqueante |
| `GH_TOKEN` | Opcional — reintentar el `workflow_dispatch` de una ingesta que debió correr y no está (Paso 1). Sin él: esperá al cron y avisá en el resumen |

Si falta alguna, avisá el faltante en el resumen final y hacé lo que se pueda
(nunca inventes datos ni mandes el mail sin la key).

## Paso 0 — Calibración (siempre antes de leer nada)

1. Leé la skill `voz-lautaro` (`SKILL.md` + `references/ejemplos.md`) — registro
   **"Informe largo"** (rigor de datos + framing didáctico, emojis muy puntuales
   o ninguno).
2. Leé `references/aprendizajes.md` de ESTA skill (reglas destiladas del
   feedback — cap 200 líneas, destilación gateada, la Routine NUNCA la edita).
3. **El feedback implícito es el DIFF** (§9 del plan): leé las últimas ~8
   interpretaciones publicadas donde el texto final difiere del original:
   ```
   GET {SUPABASE_URL}/rest/v1/interpretaciones?estado=eq.publicado&select=organismo,informe,fecha_publicacion,borrador_original_md,publicado_md,auto_publicado&order=fecha_publicacion.desc&limit=8
   headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY}
   ```
   Para cada fila con `auto_publicado=false` (Lautaro la tocó) y
   `publicado_md ≠ borrador_original_md`, compará los dos textos: qué recortó,
   qué agregó, qué tono corrigió. Las `auto_publicado=true` (nunca las tocó)
   también informan — silencio = aceptable, así estaba bien. Si un patrón se
   repite (≥2 casos) y `aprendizajes.md` no lo tiene, anotalo en tu resumen
   final para que una sesión de mantenimiento lo incorpore — vos NO editás
   `aprendizajes.md`.

## Paso 1 — Detección (qué salió, qué falta, qué ya tiene interpretación)

Primero, el request que junta la mayoría del contexto (sin `?fecha=` toma HOY
según el reloj Córdoba del server — usá el `fecha` que devuelve la respuesta
como "hoy", no calcules la fecha vos):

```
GET {INFORME_BASE_URL}/api/informes/datos
    Authorization: Bearer {INFORME_TOKEN}
```

Trae `fecha` (hoy AR), `informesHoy` (informes de organismo publicados HOY o
cargados hoy con fecha vieja — cada uno con `organismo`, `informe`, `cambios`
ya calculados: grano/país/campaña, antes→ahora, delta, unidad), `agenda`
(próximos 7 días, con `horaArg` en Córdoba ya corregido por DST), `chicago`
(para "cuánto ya estaba en el precio"/"reacción del precio") y `cierres`.

### 1.a — Estimaciones (USDA/CONAB/BCR-GEA/DEA-SAGyP/BCBA-PAS producción)

Para cada entrada de `informesHoy` con `cambios.length > 0`: chequeá si ya
existe una interpretación exacta —

```
GET {SUPABASE_URL}/rest/v1/interpretaciones?organismo=eq.{organismo}&informe=eq.{informe}&fecha_publicacion=eq.{fecha}&select=id
```

Si devuelve una fila, **saltealo** (ya se generó — no lo pises: puede tener
ediciones de Lautaro encima). Si no, es candidato para el Paso 2-4.

### 1.b — Informes que debieron salir y no están (watchdog liviano)

De `agenda`, filtrá los eventos con `fechaISO === fecha` (hoy), organismo en
`USDA|CONAB|BCR|DEA|BCBA`, importancia `alta` o `media` (saltea "Informativo
Semanal BCR", que no alimenta `estimaciones_produccion`), y cuya hora ya pasó
hace ≥45 min (`horaArg` + 45min ≤ ahora). Para cada uno, verificá si tiene
entrada en `informesHoy` (match por `organismo`, `informe` con nombre
parecido) o, si es BCBA, si `pas_zonas`/`pas_condicion` se actualizaron hoy
(Paso 1.c). Si falta:
- **USDA/CONAB/BCR/DEA** (tienen ingesta automática): probá disparar el
  `workflow_dispatch` correspondiente por la API de GitHub —
  ```
  POST https://api.github.com/repos/lautaroronchi97-commits/ROFOAGRO_RESEARCH_WEB/actions/workflows/{workflow}.yml/dispatches
  headers: Authorization Bearer {GH_TOKEN}, Accept: application/vnd.github+json
  body: { "ref": "main" }
  ```
  `{workflow}` = `ingest-usda` (USDA) · `ingest-conab` (CONAB) ·
  `ingest-estimaciones-ar` (BCR-GEA y DEA-SAGyP, mismo workflow). Si no hay
  `GH_TOKEN` o el POST falla (403/404), NO reintentes — anotalo en el resumen
  ("informe de {organismo} esperado a las {horaArg} y todavía no está;
  reintento de ingesta sin permiso, queda para el próximo cron"). Nunca
  generes un borrador con datos que no están.
- **BCBA (PAS producción)**: no tiene ingesta automática (Cloudflare la
  bloquea, carga manual). Si a esta hora no está, anotalo como "falta que
  Lautaro suba el archivo" (mismo lenguaje que el balde 🟠 de
  `/admin/checklist`) — no hay nada que disparar.

### 1.c — PAS zonas + condición (N7 — se pliegan a la interpretación BCBA del jueves)

```
GET {SUPABASE_URL}/rest/v1/pas_zonas?select=actualizado_en&order=actualizado_en.desc&limit=1
GET {SUPABASE_URL}/rest/v1/pas_condicion?select=actualizado_en&order=actualizado_en.desc&limit=1
```

Si el `actualizado_en` más reciente de cualquiera de las dos cae HOY, hay
carga nueva de Lautaro esta semana. Traé los datos relevantes:

- **Zonas** (`pas_zonas`, sin vintages — cada carga REEMPLAZA el valor, no hay
  historial semanal de revisión): para cada grano con campaña vigente,
  ```
  GET {SUPABASE_URL}/rest/v1/pas_zonas?grano=eq.{grano}&select=campania,zona,sembrado_ha,perdido_ha,cosechado_ha,produccion_tn,rinde_tn_ha&order=campania.desc
  ```
  "Qué cambió" acá es SIEMPRE campaña vigente vs. campaña anterior (nunca
  semana vs. semana — la tabla no lo permite): Δ producción nacional (fila
  `zona=TOTAL`) + qué zona explica más del cambio (mayor `produccion_tn`
  actual − `produccion_tn` de la MISMA zona en la campaña anterior). Citá los
  3 números tal cual vienen — no repitas a mano la descomposición
  área/rinde del panel (`/produccion/zonas`), es más fácil describir en
  prosa "la zona X explica Y toneladas del cambio" con el dato crudo.
- **Condición** (`pas_condicion`, SÍ tiene semana 0-53 dentro de la campaña —
  acá "vs semana previa" es un dato real, no una aproximación): para cada
  grano/ciclo con carga nueva,
  ```
  GET {SUPABASE_URL}/rest/v1/pas_condicion?grano=eq.{grano}&ciclo=eq.{ciclo}&select=campania,semana,cc_buena,cc_excelente,ch_adecuada,ch_optima&order=campania.desc,semana.desc&limit=2
  ```
  Compará las 2 filas más recientes (semana actual vs. la previa, MISMA
  campaña): Δ de "% condición buena+excelente" y Δ de "% hídrica
  adecuada+óptima". Si la fila más reciente es semana 1 de una campaña nueva
  (sin semana previa dentro de esa campaña), decilo así — sin inventar una
  comparación.

Esto NO genera una interpretación nueva y separada: se **pliega** dentro de la
interpretación `organismo=BCBA, informe="Panorama Agrícola Semanal (PAS)"` del
mismo jueves (Paso 3) — un párrafo extra citando zona/condición, cuando hay
carga nueva ese día.

### 1.d — CFTC Commitments of Traders (COT) — solo viernes

Si `fecha` es viernes y ya pasó la hora del evento CFTC de `agenda` (buscá
`organismo === "CFTC"`, respetá su `horaArg` — ya viene con DST aplicado):
chequeá existencia igual que 1.a (`organismo=eq.CFTC`). Si no existe, fetch en
vivo:
```
GET https://publicreporting.cftc.gov/resource/72hh-3qpy.json?$order=report_date_as_yyyy_mm_dd DESC&$limit=500
```
Sin auth, JSON. Filtrá las filas más recientes por `commodity_name` (soja =
"SOYBEANS", maíz = "CORN", trigo = variantes "WHEAT..." — inspeccioná los
valores reales del JSON, no asumas el string exacto de memoria) y compará la
posición neta de **managed money** (`m_money_positions_long_all` menos
`m_money_positions_short_all`) del reporte más nuevo vs. el de la semana
anterior (misma serie, fila siguiente por fecha) — Δ semanal + hacia qué lado
viene la tendencia últimas 3-4 semanas. Respaldo si Socrata falla:
`cftc.gov/dea/newcot/f_disagg.txt`.

### 1.e — USDA Export Sales — solo jueves (o viernes en semana con feriado US)

Mismo criterio: buscá el evento `organismo === "USDA" && informe.includes("Export Sales")`
en `agenda`, respetá su `horaArg`. Si no existe interpretación para
`organismo=USDA, informe="Export Sales"` de hoy y `USDA_FAS_API_KEY` está
seteada:
```
GET https://api.fas.usda.gov/api/esr/exports/commodityCode/{codigo}/allCountries/marketYear/{año}
headers: X-Api-Key: {USDA_FAS_API_KEY}
```
Sin la key: 403 — degradá honesto ("sin acceso a Export Sales esta semana"),
no es bloqueante. Si no tenés a mano el código de commodity de soja/maíz/
trigo, consultá primero `GET https://api.fas.usda.gov/api/esr/commodities`
(lista códigos reales) en vez de inventar uno. Comparalo contra la semana
previa (mismo endpoint, semana anterior) y contra el promedio de las últimas
4 semanas — sin encuesta pública de expectativas, así que esto reemplaza al
"consenso implícito" del Paso 2 para este reporte.

## Paso 2 — Qué esperaba el mercado (research acotado)

Por tipo de reporte, cómo conseguís "lo que se esperaba":

| Reporte | Fuente de la expectativa |
|---|---|
| **USDA** (WASDE/Crop Production/Grain Stocks) | Tabla de expectativas pre-report — presupuesto fijo, ≤10 tool calls. **Fuente primaria: DTN** (`dtnpf.com`, buscalo con Google News RSS/WebSearch del artículo de esa semana — la tabla `Avg/High/Low` por grano suele quedar visible sin login). Si el artículo de esta corrida pide login, caé a **Pro Farmer**. Extraé `Avg`/`High`/`Low` de la variable que cambió, con **pasaporte**: `{dato, url, fecha_pub, cita}` — verificá antes de usarla que la URL responde y la cita aparece (mismo criterio F5 de `view-mercado`). Si no conseguís una expectativa confiable, NO inventes una — seguí sin ella. |
| **GEA/DEA/CONAB/BCBA** (estimaciones sin encuesta pública) | "Consenso implícito": la estimación PREVIA de ese mismo organismo (vintage anterior, ya en `cambios`) + qué venían diciendo los otros organismos si hay un dato comparable en `informesHoy`/`agenda` — todo en casa, sin research nuevo. |
| **CFTC COT** | No hay encuesta — la "expectativa" es la tendencia de las 3-4 semanas previas del mismo dato (Paso 1.d). Si DTN publicó algo sobre posicionamiento de fondos esa semana, citalo con pasaporte. |
| **USDA Export Sales** | Semana previa + promedio de 4 semanas (Paso 1.e). Si DTN publica una expectativa de ventas, usala con pasaporte. |

Devolver vacío es una respuesta válida en cualquier fila de esta tabla — nunca
fuerces una expectativa que no verifica.

## Paso 3 — Redactar el borrador (segmentado por grano)

Para cada informe candidato (Paso 1.a/1.d/1.e, o el BCBA con el párrafo extra
de 1.c), redactá con `voz-lautaro` registro "Informe largo" (3-6 párrafos +
una subsección por grano tocado), estructura siempre presente:

1. **Qué se esperaba** (Paso 2, con pasaporte si aplica; "consenso implícito"
   o "sin encuesta a mano" si no).
2. **Qué salió**: los números de `cambios` (o los que sacaste en 1.c/1.d/1.e)
   tal cual — antes → ahora, delta, unidad. El dato duro, siempre presente.
3. **Sorpresa**: qué salió vs. qué se esperaba → alcista/bajista/neutral y por
   qué, **por grano** (subsección corta por cada grano que el reporte toca —
   soja/maíz/trigo primero si aparecen, después el resto). Si no hay
   expectativa, decilo y quedate con la descripción del cambio.
4. **Cuánto ya estaba en el precio** (siempre): qué venía haciendo Chicago
   (`chicago` del JSON del Paso 1, o `cbot_cierres` si hace falta más
   historia) en los días previos — si el mercado ya lo venía descontando,
   decilo en vez de presentarlo como sorpresa.
5. **Reacción del precio**: qué hizo Chicago EL DÍA del informe (mismo JSON,
   cero fetch nuevo).
6. **Qué implica y qué mirar**: por grano/plaza, y el próximo evento de
   `agenda` a mirar.
7. Si `informesHoy`/el color del día citan una lectura propia de Lautoro que
   toca este mismo informe, citalo como color de la mesa — **citable, nunca
   fuente de números**; si su lectura y el dato difieren, mostrá las dos.
8. Antes de escribir, leé las últimas 3 interpretaciones YA PUBLICADAS de este
   mismo organismo (`GET .../interpretaciones?organismo=eq.{organismo}&estado=eq.publicado&order=fecha_publicacion.desc&limit=3`)
   como calibración de CRITERIO (qué priorizó/descartó, qué tono) — nunca
   como fuente de números.

**Impacto estructurado (campo nuevo, V3)**: además del texto, armá
`impacto: {"soja": "alcista"|"neutral"|"bajista", "maiz": ..., "trigo": ...}`
— SOLO las claves de los granos que el reporte efectivamente toca (no
completes con "neutral" un grano que el informe ni menciona). Tiene que ser
coherente con lo que escribiste en el punto 3 de cada grano — tres estados
únicamente (nunca "levemente alcista" ni gradaciones: eso es del view, acá el
Word pide 3 estados simples).

**Regla dura: solo números que están en `cambios`/el JSON del Paso 1, en un
pasaporte verificado del Paso 2, o en las filas crudas de PAS zonas/condición/
COT/Export Sales del Paso 1 — nada inventado.** Si un cambio es chico o
dudoso, decilo con la humildad característica ("a mi óptica, no es un cambio
que mueva el amperímetro") en vez de forzarle relevancia.

## Paso 4 — Guardar el borrador

```
POST {SUPABASE_URL}/rest/v1/interpretaciones
headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY},
         content-type: application/json, prefer: return=representation,resolution=merge-duplicates
body: [{ "organismo": "{organismo}", "informe": "{informe}",
         "fecha_publicacion": "{fecha}",
         "granos": [...granos únicos tocados],
         "borrador_md": "<texto markdown simple>",
         "borrador_original_md": "<EL MISMO texto — snapshot que las RPC de edición nunca van a pisar>",
         "impacto": {"soja": "alcista", ...},
         "evidencia_externa": [{"dato":"...", "url":"...", "fecha_pub":"...", "cita":"..."}, …],
         "estado": "borrador" }]
```

`evidencia_externa` queda `[]` si el Paso 2 no aplicó o no consiguió nada
verificable — nunca inventes un pasaporte para llenarlo.
`borrador_original_md` **tiene que ir igual a `borrador_md` en este INSERT** —
es lo que hace posible el feedback por diff del Paso 0 (§9 del plan): ninguna
RPC de `/admin/interpretaciones` lo toca nunca. El UNIQUE
`(organismo, informe, fecha_publicacion)` + `resolution=merge-duplicates` lo
hace idempotente — por eso el chequeo del Paso 1 ya evita pisar una edición
(este POST solo corre si no existía fila).

## Paso 5 — Avisar por mail

```
POST https://api.resend.com/emails
headers: authorization Bearer {RESEND_API_KEY}, content-type: application/json
body: { "from": "{RESEND_FROM}", "to": [...ADMIN_EMAILS],
        "subject": "Nueva interpretación para revisar — {organismo} {informe}",
        "html": "<el borrador_md convertido a HTML simple (párrafos) +
          link a {INFORME_BASE_URL}/admin/interpretaciones>" }
```

Su firma nunca sale sin su OK EN EL MOMENTO: el borrador queda en
`/admin/interpretaciones` para que Lautaro lo edite/publique/descarte a mano
— este paso NUNCA publica. (Si nadie lo toca, el Paso 6 lo publica solo más
tarde — la firma en ese caso es "Mesa ROFO AGRO", no la de Lautaro.)

## Paso 6 — Cierre 18:20 ART: auto-publicación (N4)

**Corré este paso en CUALQUIER invocación cuya hora actual en Córdoba sea
≥18:20** (no importa si te disparó el cron de las 9:00, un despertador, o el
cron fijo de cierre — chequealo vos mismo con la hora real, así el paso es
idempotente sin importar qué lo disparó — ver Paso 7 sobre los dos crons).

1. Traé los borradores de HOY sin publicar:
   ```
   GET {SUPABASE_URL}/rest/v1/interpretaciones?estado=eq.borrador&creado_en=gte.{hoy}T00:00:00&creado_en=lt.{hoy}T23:59:59&select=id,borrador_md,creado_en,editado_en
   ```
2. Para cada fila: `auto_publicado = (editado_en === creado_en)` (Lautoro
   nunca la tocó — ni siquiera "Guardar borrador"; si la tocó pero no
   publicó, se publica SU edición igual, con `auto_publicado=false` — "editar
   es revisar", N4).
3. Publicá con una escritura DIRECTA (esto NO pasa por
   `admin_publicar_interpretacion`: esa RPC exige `is_admin()`, que una
   sesión de service_role sin JWT de usuario nunca cumple — service_role
   bypasa RLS escribiendo directo a la tabla, igual que `informes_generados`/
   `views_mercado`):
   ```
   PATCH {SUPABASE_URL}/rest/v1/interpretaciones?id=eq.{id}
   headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY}, content-type: application/json
   body: { "publicado_md": "<borrador_md tal cual está en este momento>",
           "estado": "publicado", "auto_publicado": <true|false> }
   ```
   **NO toques `editado_en`** en este PATCH — tiene que quedar como estaba
   (preserva la señal real de "cuándo lo tocó Lautoro", que el Paso 0 de la
   PRÓXIMA corrida necesita para el diff).
4. Mandá un mail de aviso por cada una que se auto-publicó de verdad
   (`auto_publicado=true`) — asunto `"Se publicó sola — {organismo} {informe}"`,
   mismo patrón que el Paso 5, avisando que salió sin que él la tocara.
5. Los borradores YA publicados/descartados por Lautoro antes de las 18:20 no
   se tocan (`estado != 'borrador'`, quedan afuera del `GET` del punto 1). Lo
   descartado sigue descartado siempre.

**Auto-reprogramación (mejor esfuerzo, §8.2)**: si estás en la corrida de las
9:00 ART y las tools `send_later`/`create_trigger` del MCP `claude-code-remote`
están disponibles en este entorno headless, agendá despertadores ~45 min
después de cada evento de HOY en `agenda` (WASDE ~14:45, PAS/GEA/DEA ~18:00,
COT/Export Sales según su `horaArg`) — cada uno simplemente vuelve a correr
esta misma skill. **No es crítico si falla**: hay un cron fijo de cierre a las
18:20 ART como red de seguridad (Paso 6 corre igual, disparado por ESE cron,
aunque nunca se haya podido auto-reprogramar nada) — si `send_later` no está
disponible, anotalo en el resumen (primera vez que se confirma esto en una
Routine real) y seguí sin bloquear el resto.

## Paso 7 — Telemetría (N13)

Al cerrar (SIEMPRE, incluso si no hubo nada nuevo que generar):

```
POST {SUPABASE_URL}/rest/v1/routine_runs
headers: apikey + authorization Bearer {SUPABASE_SERVICE_KEY}, content-type: application/json
body: [{ "tipo": "interpretaciones", "fecha": "{hoy}",
         "iniciado_en": "<ISO de cuando arrancaste>",
         "terminado_en": "<ISO de ahora>",
         "duracion_ms": <diferencia>,
         "degradaciones": ["<lo que faltó o degradó honesto, ej. 'sin USDA_FAS_API_KEY'>"],
         "mail_enviado": <true si mandaste al menos un mail> }]
```

`degradaciones: []` si todo salió con datos completos.

## Reglas duras (no se negocian)

- **Ni un número inventado.** Todo dato sale de `cambios`, del JSON de
  insumos, de las filas crudas de PAS/COT/Export Sales, o de un pasaporte
  verificado.
- **Candado de existencia**: nunca pises una interpretación que ya existe
  (Paso 1.a la salta) — puede tener ediciones de Lautoro encima.
- **Pasaportes verificados**: un dato del anillo 2 (research externo) entra
  SOLO con `{dato, url, fecha_pub, cita}` verificado — lo que no verifica, se
  cae, nunca se deja una cita sin chequear.
- **Auto-publicación es la ÚNICA excepción a "su firma nunca sale sin su OK"**
  (N4) — y firma distinto cuando pasa (Paso 6, "Mesa ROFO AGRO").
- **`borrador_original_md` se escribe UNA VEZ, al insertar, nunca se
  actualiza** — es el ancla del feedback por diff.

## Modo de prueba

Con `--fecha` (o pedido "en seco"): corré los Pasos 0-3 igual (research
externo real incluido) y mostrá los borradores SIN guardar en Supabase ni
mandar mail — marcá "PRUEBA — no persistido". El Paso 6 (cierre/auto-pub) y
el Paso 7 (telemetría) también se saltan en modo prueba.
