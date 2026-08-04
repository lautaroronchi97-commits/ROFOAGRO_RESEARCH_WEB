# PLAN INFORMES V3 — los 4 productos de research, integrando el Word de Lautaro (04/08/2026)

> **Qué es esto.** Tercera vuelta del sistema de informes: `PLAN_INFORMES.md` construyó los 4
> productos (MP1 diario · MP2 semanal · MP3 view · MP4 interpretaciones); `PLAN_INFORMES_V2.md`
> les puso el research multi-agente, el blind-first y el scorecard. **V3 integra el documento de
> requisitos que Lautaro entregó el 04/08/2026** (Word "INFORMES", extraído completo en §1.1)
> **sobre lo ya construido, sin tirar nada**: cada requisito del Word se mapeó contra el estado
> real del código (relevamiento profundo de esta sesión, 7 agentes en paralelo) y las decisiones
> vigentes de V1/V2. Donde el Word contradice una decisión previa, la revocación queda explícita
> (§3).
>
> **Cómo se ejecuta**: 6 etapas E1→E6 (§10), cada una con prompt autocontenido para una sesión de
> **build con Sonnet** (regla de `PLAN_BACKLOG.md`). Registrado como **C30** en el backlog maestro
> (`auditoria/E7-sintesis.md` §4).
>
> **Regla de esta vuelta (pedido explícito de Lautaro)**: los DATOS de cada informe quedan
> explícitos campo por campo (§5-§8) porque la parte visual la va a trabajar él por separado —
> las plantillas de las builds ordenan bloques y muestran todo el dato con un layout funcional;
> el diseño fino es iteración posterior de Lautaro.

---

## 1. El pedido

### 1.1 El Word, tal cual (requisitos por producto)

**INFORME DIARIO** — debe incluir:
- Precios del día + volúmenes operados **físico (clearing)** y **pizarras estimadas** (datos del
  físico provenientes del color del día).
- Pizarras estimadas: **variación vs el día anterior en pesos y en USD**.
- Variación de las posiciones de A3 operadas en el día (**máx 3, las más operadas**) + su
  variación de precio + **volumen total del producto** (incluye el resto de posiciones).
  Ej.: maíz JUL26/DIC26/ABR27 + total de todas las posiciones de maíz.
- Variación del **TC oficial** del día + **volumen operado en MAE de las especies US** + las
  **compras del BCRA**.
- El **contexto de la rueda de Chicago del día** "que te voy a adjuntar, proveniente de la Bolsa
  de Comercio de Rosario".
- **Interpretación de los informes del día**: se genera en OTRA rutina; el diario la lee y la agrega.
- **Noticias de las últimas 24 hs**: anexar solo lo realmente relevante.
- Otros mercados/commodities **solo si es realmente relevante** (ej.: baja 5% el petróleo).
- **1 página, a lo sumo 2**.
- Lectura diaria: refleja lo que pasó en la rueda (precios y volúmenes) + un poco del contexto.
- **Separar SIEMPRE contexto local de contexto internacional**.
- **Separado por productos** (principalmente precios y volúmenes); hay contextos que aplican a un
  grano y a otro no. **Orden SOJA, MAÍZ y luego TRIGO.**
- Cualquier otro dato de la web **solo si es realmente necesario** para la diaria (ej.: 2 Mt de
  DJVE de maíz).
- Camiones en puerto **solo si son relevantes** (ej.: alta congestión).
- **Próximos informes** que se acercan (no más de una semana).

**INFORME SEMANAL** — debe incluir:
- Lectura de **todas las noticias de la última semana**.
- Lectura de **todos los informes diarios desde la última publicación**.
- Lectura del **view semanal**.
- Lectura de los **informes/interpretaciones** de la última semana.
- **Variación del USD y compras del BCRA de la última semana** — usar los paneles ya armados;
  mostrar cómo viene la **volatilidad**.
- **Tasas implícitas de dólar linked y de granos** — para granos: la tabla de arbitraje
  reemplazando la pizarra por la **pizarra estimada de ese viernes** (por default trae la del
  jueves). **Aclarar que el cálculo está hecho con pizarra estimada.**
- Del módulo **comercio exterior**, lo relevante de la semana: DJVE, camiones en puerto de la
  semana, la **tabla de 60 días**, y cómo viene la **negociación por producto** (acumulados y
  porcentajes de cada producto).
- De los reportes de **estimaciones, producción por zona y condición de cultivos**: todo lo
  relevante, principalmente cambios significativos.
- Más amplio que el diario; **también separado por producto** (SOJA, MAÍZ, TRIGO) en todo lo que
  corresponda.
- Sección de **contexto local** y de **contexto internacional**.
- MUY importante: **variaciones de precios (Chicago y local) desde el informe anterior** — local
  al menos 3 posiciones, internacional 1 posición.
- **Volúmenes operados del físico y de A3** en cada producto (total semanal).
- Prosa más amplia que el diario. **Sin límite de páginas**: "escribir lo necesario, sin
  extenderse pero sin restringir".
- Otros commodities si influyeron en la semana.
- **No mencionar explícitamente percentiles** y demás internals de análisis: **solo tendencias**,
  para los datos que provienen de análisis (no crudos).

**VIEW** — debe incluir:
- Lectura e interpretación de **todas las noticias de la última semana**.
- El análisis por producto: SOJA, MAÍZ y TRIGO.
- Este reporte es **más amplio que el resto**: los otros informan datos; este **interpreta y saca
  conclusiones** — libre de adquirir contexto y buscar más cosas para cumplir el fin.
- Debe leer: volúmenes de físico y futuros por producto · todas las noticias (commodities +
  contexto) · **todos los movimientos de camiones** · **todas las DJVE** · **todos los análisis
  propios** · **tasas implícitas de granos** · **el precio y en qué zona se encuentra** · **cómo
  se viene priceando y cuánto hay comercializado** · **cada reporte que haya salido** ·
  **estimaciones de producción, cosecha, avances** · **el clima** en regiones productoras (local
  e internacional, más en momentos críticos) · todo lo que considere para tener visión de cada grano.
- Conclusiones **objetivas, no delirio**.
- Estados: **ALCISTA, LEVEMENTE ALCISTA, NEUTRAL, LEVEMENTE BAJISTA, BAJISTA** (5 estados).
- Importante la **variación de los precios**; detectar si el precio **local y el internacional van
  de la mano o se están desprendiendo**.
- **Buscar patrones** en los datos, si los hay.
- **Pensar como trader**, con visión de mercado. **No limitarse en las explicaciones.**

**INTERPRETACIONES** — debe incluir:
- **Verificar todos los días** los reportes que han salido.
- Si salió un informe: interpretarlo — **qué esperaba el mercado y qué sucedió realmente**.
- Contar **qué impacto** tiene el reporte que salió.
- Puede tener un **calendario** para estar informado de los reportes que debe interpretar.
- Puede ir **reprogramando su rutina en horarios** para acercarse a la hora de publicación.
- Debe **comparar contra el último dato del mismo reporte** si existiese.
- **Segmentado por grano**; foco principal SOJA, MAÍZ y TRIGO.
- Mencionar si el reporte tiene **impacto alcista/neutral/bajista en cada grano**.

### 1.2 Pedidos transversales del chat (04/08)

1. Una **Routine** programada para cada uno de los 4 (hoy existen 3; interpretaciones no tiene).
2. Un **skill** para cada uno (hoy existen 3; interpretaciones vive como Paso 9 del diario).
3. **Todos leen `voz-lautaro`** (ya lo hacen los 3; el 4º también lo hará).
4. **Retroalimentación** donde se pueda (hoy solo el view la tiene, y sin usar — §9).
5. **No repetir** entre informes lo que no haga falta (§4, roles y nutrición).
6. Datos **explícitos** por informe (§5-§8) — lo visual lo trabaja Lautaro por separado.

---

## 2. Qué hay hoy (síntesis del relevamiento 04/08)

Relevado a fondo en esta sesión (skills completos + libs + endpoints + migraciones + Routines
reales por MCP). Lo esencial:

- **Pipelines sólidos y en producción**: diario (placa PNG "Research" 816×1056, Routine 18:30 ART
  L-V) · semanal (PDF A4 5 páginas, viernes 19:00 ART) · view (pipeline F0→F6 blind-first con 5
  subagentes, viernes 9:00 ART). Interpretaciones corre como **Paso 9 del diario** (una vez por
  día, a las 18:30, solo si el diario corrió).
- **Los datos para casi todo lo nuevo YA existen** en la base/libs: volumen por posición A3
  (`futuros_cierres.volume`), pizarra en $ y USD por día (`pizarra_historico`), Δ del oficial
  (`getMaeOficial().varPct`), volumen MAE por especie (`getVolumenCambiario()`), compras BCRA,
  camiones diarios (`camiones_plantas`), DJVE 7d/60d, negociado con priceado, PAS
  zonas/condición, volatilidad del dólar, calendario con horas ART. Lo que NO existe: físico
  diario estructurado, comentario Chicago-BCR, clima ingestado, y varios agregados semanales
  (volumen A3 semanal, Δ anclado al informe anterior).
- **Deudas de estructura**: la dirección del view tiene CHECK de 3 estados en SQL + 5 réplicas en
  TS · `interpretaciones` no tiene campo de impacto por grano · el semanal no lee ni los diarios
  ni las interpretaciones ni las noticias de la semana completa · la detección de interpretaciones
  depende de que la ingesta haya corrido antes de las 18:30 (GEA/DEA ingestan 22:16 → su
  interpretación sale un día tarde) · el calendario (`calendario.ts`) tiene horas ART pero el
  Paso 9 no lo consulta · `calendario_informes` (tabla) existe y está muerta.
- **Routines reales** (auditadas por MCP): las 3 siguen con nombre "RF AGRO", sus prompts citan el
  repo con el nombre viejo (`RFAGRO_RESEARCH_WEB` — el clone real sale del job_config y funciona,
  pero el texto está desactualizado), la del view NO avisa por mail ante falla (las otras 2 sí), y
  la 4ª (interpretaciones) no existe.
- **Feedback**: solo el view lo tiene (nota 1-5 + texto + scorecard hit-rate/Brier + protocolo de
  aprendizajes) y **nunca se usó** (0 notas, 0 feedbacks, `aprendizajes.md` sin reglas). Diario,
  semanal e interpretaciones no tienen mecanismo propio (interpretaciones tiene el gate humano de
  publicación, que es otra cosa).

---

## 3. Decisiones de esta ronda (04/08) — y qué revocan

Contestadas por Lautaro en el chat de esta sesión:

| # | Decisión nueva | Revoca / modifica |
|---|---|---|
| N1 | **Semanal SIN límite de páginas** ("escribir lo necesario, sin extenderse pero sin restringir") | Revoca "5 páginas duras, lo nuevo entra recortando" (V2 §10.3, 24/07). El check `/Count ≥5` del skill se reemplaza por un sanity check de contenido. |
| N2 | **View con 5 estados**: alcista · levemente alcista · neutral · levemente bajista · bajista | Modifica el CHECK de `views_mercado.direccion` (3 estados) + réplicas TS + semántica del scorecard (§7.2). |
| N3 | **Interpretaciones = rutina y skill PROPIOS**, con verificación diaria, calendario y reprogramación horaria | El Paso 9 del diario SE MUDA a la skill nueva. El diario pasa a solo LEER interpretaciones. |
| N4 | **Interpretaciones se AUTO-PUBLICAN** si Lautaro no las tocó "tras unas horas" | Revoca parcialmente "su firma nunca sale sin su OK" (V2 R7) **solo para interpretaciones**. Propuesta concreta: deadline 18:00 ART del día en que se generó el borrador (30 min antes del diario); el mail de aviso al generarse sigue, y se marca `auto_publicado` para distinguirlas. El view sigue interno-mesa; diario y semanal siguen saliendo sin gate como siempre. |
| N5 | **La carga diaria sigue TEXTO LIBRE** (sin form estructurado): la pizarra estimada y el volumen del físico entran a mano dentro del color del día; la variación de la pizarra estimada se calcula **contra el último valor que trae el cron** (`pizarra_historico`); **si falta el dato del cron actualizado o no se cargó la pizarra estimada, NO se calcula la variación** (degradación honesta, nunca se inventa). | Mantiene `mesa_color` texto libre. La extracción del número la hace la skill al leer el color. |
| N6 | **Diario: PNG sigue + versión WEB con link** ("que entren los clientes o el público con un link, indaguémoslo") | Etapa E3: página web del informe diario por fecha; el acceso (permiso de sección vs link público firmado) se resuelve en esa etapa con recomendación (§5.4). |
| N7 | **Alcance de interpretaciones ampliado**: los 5 organismos de estimaciones + **PAS zonas/condición** + **CFTC COT** + **USDA Export Sales** | COT y Export Sales entran por **fetch-en-vivo dentro de la rutina** (con pasaporte), SIN ingesta/cron/tabla nueva — coherente con la decisión vigente "fetch-en-vivo, no ingesta nueva". |

Decisiones del Word que también son cambios (implícitos en §1.1): **N8** el layout del diario se
reorganiza **por producto (SOJA→MAÍZ→TRIGO) con local/internacional separados** — reemplaza la
organización por métrica de la plantilla research actual, **conservando el 100% de la información
de hoy** (condición vigente del 30/07: "debe seguir teniendo la información de hoy, solo cambia el
formato"); **N9** regla de estilo "**sin internals**": percentiles, índices y umbrales internos no
se nombran en los informes que salen (diario/semanal) — se traducen a tendencia ("la posición de
fondos viene creciendo hace 4 semanas", no "percentil 88"); en el view (interno mesa) los internals
sí se pueden citar; **N10** el view **afloja "salida de tamaño fijo" solo en `tesis_md`** ("no debe
limitarse en las explicaciones" + el semanal ya no tiene tope de páginas, así que el derrame de la
pág. 5 deja de ser problema) — los argumentos siguen siendo 3-5 (el research sigue compitiendo por
slots), y los invalidadores siguen inmutables.

**Decisiones previas que SIGUEN vigentes** (verificadas contra el Word — no chocan): motor =
Routines con la suscripción (nunca API paga) · entrega = mail + `/informes`, Lautaro reenvía por
WhatsApp a mano · el diario sale SIEMPRE y sin multi-agente · COT nunca en el diario · "ni un
número inventado" + anillo 1/anillo 2 + pasaportes verificados · números siempre del dato crudo
(nunca resumir el resumen) · blind-first + invalidadores inmutables + scorecard fijado en t0 ·
research externo nunca en camino crítico · destilación de aprendizajes manual y gateada (cap 200
líneas) · pins de modelo/effort actuales (view opus/high · diario opus/medium · semanal opus/high)
· endpoints se extienden aditivamente, auth Bearer timing-safe · orden de granos SOJ→MAI→TRI.

---

## 4. Los 4 productos: roles y nutrición (anti-duplicación)

Regla madre: **cada análisis tiene UNA fuente canónica; los demás lo CITAN, no lo re-derivan.**

| Producto | Rol | Cadencia | Formato | Se nutre de | NO hace |
|---|---|---|---|---|---|
| **Interpretaciones** | "El evento": qué esperaba el mercado, qué salió, qué impacto por grano | Cada vez que sale un reporte (rutina diaria auto-reprogramable) | Texto en la web (+ badge de impacto) | Dato crudo del reporte + expectativas externas con pasaporte + último dato del mismo reporte | No recapitula la rueda; no opina de dirección general (eso es el view) |
| **Informe diario** | "La rueda de hoy": precios y volúmenes por producto + contexto mínimo | L-V 18:30 ART | PNG 1-2 páginas + página web | Datos propios del día + color de la mesa + interpretaciones PUBLICADAS del día + noticias 24 hs | No interpreta reportes (cita la interpretación); no hace research externo; no proyecta dirección |
| **View de mercado** | "La dirección": tesis por grano, 5 estados, la bola de nieve | Viernes 9:00 ART | Registro interno (`/granos/view`) | TODO: insumos ampliados + noticias 7d + interpretaciones + análisis propios + research externo (clima, COT, wire) | No es un recap de datos; no sale a clientes |
| **Informe semanal** | "La síntesis": la semana en datos + prosa amplia por producto | Viernes 19:00 ART | PDF A4 sin límite de páginas | Los DIARIOS de la semana + las INTERPRETACIONES de la semana + el VIEW del día + noticias 7d + agregados semanales propios | No re-deriva la dirección (cita el view); no re-interpreta reportes (cita interpretaciones); no repite el research del view (usa su `evidencia_externa`) |

Flujo de nutrición (el orden del viernes importa): interpretaciones (todo el día) → view (9:00)
→ semanal (19:00, lee a los otros dos y a los diarios L-J). El diario de cada día lee las
interpretaciones ya publicadas. Todos leen `voz-lautaro` en su Paso 0.

Dos aclaraciones anti-repetición concretas:
- El **research externo pesado vive en el view** (5 subagentes). El semanal NO repite ese research:
  su Paso 1b (acotado) se mantiene para lo que el view no cubre (mercados de la semana), y además
  ahora puede citar la `evidencia_externa` del view del mismo día (ya verificada) sin re-fetchear.
- La **narrativa de un reporte** (WASDE, PAS, etc.) vive en su interpretación. El diario y el
  semanal la citan/resumen con crédito ("la lectura de la mesa"), jamás la reescriben desde cero.

---

## 5. INFORME DIARIO v3

### 5.1 Estructura y datos, campo por campo

La placa se reorganiza en bloques **por producto** con **local/internacional separados** (N8).
Todo lo de la placa actual sigue presente (condición del 30/07). `[E]`=existe hoy en el JSON/libs
· `[N]`=hay que construirlo (todo `[N]` tiene la materia prima identificada) · `[M]`=manual, del
color del día.

**A. Cabecera**: fecha · "Research diario de mercado" · logo. `[E]`

**B. Tesis del día** (prosa): `tesisTitulo` + `tesisParrafo` — redactados por la skill citando
solo números del JSON/color. `[E]`

**C. Bloque LOCAL — por producto, orden SOJA → MAÍZ → TRIGO.** Para cada grano:
- Pizarra oficial CAC del día: $ y USD + **Δ vs día anterior en ambas monedas** `[N: lib
  `variacionDiariaPizarra()` sobre `pizarra_historico` (trae `precio_ars`+`precio_usd` por día);
  1 query]`.
- **Pizarra estimada de la mesa** (si Lautaro la cargó en el color): valor + **Δ vs la última
  pizarra oficial del cron**, en $ y USD según qué haya cargado. Si falta el estimado o el cron
  está desactualizado → no se muestra variación (N5). `[M + N: la skill extrae el número del texto
  libre y calcula contra el JSON]`
- **Top 3 posiciones A3 más operadas del día**: posición, precio de ajuste, Δ% del día, volumen —
  + **volumen total del producto** (todas las posiciones). `[N: builder `top3PorVolumen()` sobre
  `cierres.granos[].posiciones` que ya traen `volume`/`change`/`changePercent`; aritmética pura]`
- Volumen del **físico** del día (si la mesa lo cargó en el color). `[M]`
- TNA implícita de referencia (posición de mayor open interest — regla vigente). `[E]`

**D. Bloque LOCAL — transversal**:
- TC oficial mayorista: nivel + **Δ% del día** `[N: exponer `getMaeOficial().varPct` en
  `DolarFuturoData` — el dato ya existe, no llega al JSON]`.
- **Volumen MAE de especies USD** `[N: sumar `getVolumenCambiario()` a `datosDiario` — lib existe]`.
- **Compras BCRA**: dato del día si está (manual o API), si no el último disponible CON su fecha
  visible. `[E]`
- Carry en dólar futuro (2 posiciones, como hoy). `[E]`
- **Condicionales** (solo si superan umbral de relevancia — la regla vive en la skill, §5.3):
  DJVE del día/semana si es un volumen fuera de lo común `[N: sumar `getDjveResumen()` (`ton_7d`)
  a `datosDiario`]` · camiones si hay congestión/salto `[N: sumar `getCamionesPlantas()`
  (`totalDia`, `deltaDiaAnterior`, `deltaInteranual`) a `datosDiario`]`.

**E. Bloque INTERNACIONAL**:
- Chicago por producto: cierre USD/tn + Δ% del día (soja, maíz, trigo + complejo soja
  aceite/harina). `[E: monitor]`
- **Contexto de la rueda de Chicago (BCR)**: el texto que Lautaro adjunta, citado como "según
  BCR". `[M: campo nuevo de carga — ver §5.2]`
- Otros mercados **solo si |Δ| supera umbral** (propuesta: ≥3% WTI/oro/plata/DXY/BRL — hoy WTI
  sale siempre; pasa a condicional). `[E: dato; N: regla]`

**F. La lectura de la mesa**: interpretaciones del día **publicadas** (con la auto-publicación de
N4 a las 18:00, a las 18:30 casi siempre van a estar). Título + síntesis + badge de impacto por
grano. `[E + N: badge de impacto, §8]`

**G. Noticias últimas 24 hs**: 0 a 3 titulares — **puede ser cero** ("solo lo realmente
relevante"; hoy la ventana es de 3 días hábiles y siempre llena). `[N: parámetro de ventana 24 hs
en `getNoticias()` + regla de la skill de omitir si no hay nada]`

**H. Agenda**: próximos informes de los **próximos 7 días** (hoy la placa muestra solo los de
hoy). `[N: `getEventos(hoy, hoy+7)` — cambio trivial, la home ya lo hace]`

**I. Prosa "lo que se lee acá"** (`lectura[]`): pasa a ser **estructural por producto** — un
párrafo por grano (hoy es opcional) + uno de riesgo/contexto; granos sin nada distintivo pueden
decir una línea. `[E: campo; N: regla]`

**J. Pie**: fuentes + disclaimer + "datos al HH:MM". `[E]`

### 5.2 Carga manual diaria (mínimo cambio, decisión N5)

- `mesa_color.texto` sigue siendo **UN texto libre** con todo el color (incluida pizarra estimada
  y volumen físico si los quiere dar). Sin campos numéricos nuevos.
- Se agrega **un segundo texto libre opcional**: `mesa_color.chicago_bcr text null` (migración
  chica) + segundo textarea en `/admin/datos/mesa-color` ("Contexto Chicago — pegá el comentario
  de BCR"). Motivo: citarlo como "según BCR" exige no mezclarlo con el color propio de la mesa.
  *Si Lautaro prefiere un único campo, se pega todo junto y la skill lo separa igual — micro
  decisión de la build E1, no bloquea.*
- El candado 🔒 post-informe sigue igual y cubre ambos campos.

### 5.3 Skill `informe-diario` v3 (cambios)

- Pipeline 1-8 igual (fuente de datos → prosa → borrador → screenshot → Storage → mail → enviado
  → resumen). **El Paso 9 (interpretaciones) SE ELIMINA de esta skill** — se muda a la skill nueva
  (§8). Sigue **mono-hilo, sin multi-agente, cero fetch externo** (decisión vigente).
- Paso 2 (prosa) reescrito para la estructura por producto: reglas de extracción del color
  (pizarra estimada/volumen físico: si el texto trae un número, citarlo y calcular la variación
  contra el JSON; si no, omitir el renglón — NUNCA estimarlo el modelo), reglas de los
  condicionales (umbral DJVE: propuesta ≥1,5× la mediana de `ton_7d`/7 del producto; camiones:
  propuesta |Δ día| ≥30% o total ≥1,5× interanual — números a calibrar en la primera semana,
  documentados en la skill como perillas), regla del bloque internacional (otros mercados ≥3%),
  regla de noticias ("si nada es de mercado de granos/macro que afecte precios: cero titulares").
- Regla N9 (sin internals) aplicada: el diario ya casi no los usa; queda explícita.
- Documentar el par PNG + página web (§5.4) en los pasos de entrega.

### 5.4 Versión web con link (N6 — "indaguémoslo", etapa E3)

- Página nueva `/informes/diario/[fecha]`: renderiza el mismo contenido de la placa como página
  web responsive (misma data, componentes reusados), para `estado=enviado`.
- **Acceso — recomendación**: gateada como la sección Informes (con `AUTH_ENFORCED` prendido, la
  ven los clientes con permiso `informes`; los admins siempre). Además, **link público firmado
  opcional** por informe (`?t=<token-por-informe>`, generable desde `/admin`) para compartir a no
  clientes puntuales sin abrir toda la web. La build E3 presenta ambas puertas funcionando y
  Lautaro decide cuál activa (o las dos).
- El PNG sigue siendo el vehículo de WhatsApp; la página es el mismo informe con link.

---

## 6. INFORME SEMANAL v3

### 6.1 Estructura y datos (sin límite de páginas — N1)

**Pág. tapa**: título con personalidad · rango de la semana (desde el ÚLTIMO semanal ENVIADO —
ver ancla abajo) · resumen ejecutivo 4-6 bullets · disclaimer. `[E]`

**Sección "La semana en números" (transversal, corta)**: tabla por grano con Δ semanal A3 (3
posiciones), Δ pizarra ($ y USD), Δ Chicago (1+ posición), volumen A3 semanal, volumen físico
semanal. `[E: Δ precios ya existen · N: **ancla al informe anterior** — hoy la ventana es "último
dato vs −7d"; pasa a "vs la fecha del último `informes_generados` tipo=semanal estado=enviado"
(si un viernes no salió, la variación cubre el hueco) · N: **volumen A3 semanal** — suma de
`futuros_cierres.volume` de las 5 ruedas por underlying, query nueva]`

**UNA SECCIÓN POR PRODUCTO — SOJA → MAÍZ → TRIGO** (el corazón del informe, N8). Cada una:
- Precios: las 3 posiciones locales con Δ desde el informe anterior + pizarra + Chicago del
  producto. `[E+N ancla]`
- Volúmenes: físico semanal (negociado SIO) + A3 semanal. `[E/N]`
- **Comercial**: negociado del producto — semanal, Δ vs semana previa, acumulado campaña, **% del
  total negociado**, **% priceado** y saldo a fijar `[E: `getNegociado()` trae todo; el % del
  total y el priceado son aritmética en el caller]` · DJVE de la semana (`ton_7d`) `[N: sumar
  `getDjveResumen()` al JSON semanal]` · gap de cobertura 60d del producto (tabla de 60 días)
  `[E: pág. 4 actual, se reparte por producto]`.
- **Tasas implícitas del producto**: tabla de arbitraje (posiciones, TNA) — **con la pizarra
  estimada de ESE viernes si Lautaro la cargó en el color** (recalculada con
  `tasaDirecta/tnaUSD` de `src/lib/arbitraje.ts`, que ya aceptan pizarra como parámetro), con el
  rótulo obligatorio "**cálculo con pizarra estimada del viernes**"; si no hay estimada → pizarra
  oficial del jueves con rótulo "pizarra del jueves". `[E: libs puras + N: wiring]` + pases del
  producto. `[E]`
- **Producción**: cambios de estimaciones del producto en la semana (`informesSemana`) + PAS
  zonas/condición **si hubo cambios significativos** `[N: sumar `getPasZonas()`/`getPasCondicion()`
  al JSON semanal + Δ de condición vs semana previa (las series ya lo traen punto a punto)]`.
- **La semana según la mesa**: síntesis de las interpretaciones de la semana que tocan al producto
  `[N: `getInterpretaciones` con rango semanal]` + **el view del producto** (dirección 5 estados +
  confianza + síntesis de la tesis) `[E]`.
- Prosa del producto (más amplia que el diario — sin restricción de largo).

**Sección "Dólar y macro local"**: variación semanal del oficial + gráfico `[E]` · **volatilidad**
(el panel ya armado: `volatilidadSemanal`/`volatilidadDiaria` de `src/lib/dolar-historico.ts` +
su chart) `[N: wiring al informe]` · **compras BCRA de la semana** (acumulado semanal derivado de
la `serie` de `getComprasBcra()`) + gráfico de barras del panel `[N: wiring]` · **implícitas de
dólar linked** (tabla `getDolarLinked()`: TNA/TEA por especie) `[N: wiring]` · carry dólar futuro. `[E]`

**Sección "Contexto internacional"**: Chicago de la semana (chart/tabla) `[E]` · "El mundo esta
semana" (research 1b — COT como **tendencia**, no percentil — N9) `[E+ajuste]` · otros commodities
solo si influyeron (Δ semanal de WTI/oro/DXY/BRL — hoy solo hay foto del día) `[N: Δ semanal de
macro — spark de Yahoo ya trae la serie; helper chico]`.

**Sección "Comercio exterior transversal"**: cumplimiento del mes `[E]` · camiones de la semana
(suma semanal Agroentregas + Williams con Δ) `[N: agregación sobre libs existentes]` · lo
relevante de line-up/embarques. `[E]`

**Cierre**: qué mirar la semana que viene (agenda 7 días) + expectativas pre-informe si el 1b las
trajo + scorecard 1 vez/mes (regla vigente) + nota humilde. `[E]`

**Noticias**: no son sección propia — alimentan la prosa (la skill las lee TODAS: query de rango
7 días sin cap sobre la tabla `noticias` `[N]`), y las 2-3 más relevantes pueden citarse dentro
de la sección del producto al que pegan.

**Lectura de los diarios**: el JSON semanal suma `diariosSemana` = título+prosa de los
`informes_generados` tipo=diario enviados desde el último semanal `[N: query de rango]` — la skill
los usa para armar el hilo narrativo de la semana ("el martes el mercado se dio vuelta cuando…"),
no para copiar números (los números salen de las libs).

### 6.2 Skill `informe-semanal` v3 (cambios)

- Paso 1: JSON ampliado (todo lo `[N]` de arriba — el endpoint se extiende aditivamente).
- Paso 2 (criterio): se mantiene la jerarquía vigente (organismos > mayor movimiento > cambios de
  régimen > SWITCH del view > scorecard mensual) + regla nueva: **la estructura es por producto**;
  lo transversal va a sus secciones.
- Paso 3 (prosa): campos nuevos por producto (`soja_texto`/`maiz_texto`/`trigo_texto` +
  `local_texto`/`internacional_texto`/`cierre`) reemplazan el único `granos_texto`. Sin límite de
  largo (N1) pero con la regla de siempre: la prosa interpreta, no repite números que la tabla ya
  muestra.
- **Regla N9 explícita** (sin internals): prohibido "percentil", "índice MESA", "z-score",
  umbrales internos en el texto; se traducen a tendencia/comparación temporal. Las tablas
  impresas tampoco muestran columnas de percentil (ratios de cobertura se muestran como "cubierto
  vs falta cubrir").
- Paso 5: cae el check `/Count ≥5`; lo reemplaza un sanity check de secciones presentes.
- El 1b se mantiene acotado (el research pesado es del view — §4): puede además citar
  `evidencia_externa` del view del mismo día sin re-fetchear.

---

## 7. VIEW v3

### 7.1 Los 5 estados (N2)

- **Migración**: `ALTER TABLE views_mercado DROP CONSTRAINT views_mercado_direccion_check; ADD
  CHECK (direccion IN ('alcista','levemente_alcista','neutral','levemente_bajista','bajista'))`.
- **Réplicas TS a tocar** (relevadas): `DireccionView` + `DIRECCION_VIEW_LABEL`
  (`views-mercado.ts`) · `DIR_COLOR/DIR_GLIFO/DIR_COLOR_VAR` (`/granos/view/page.tsx`) ·
  `esAcierto()`/`confianzaAProbabilidad()` (`views-scorecard.ts`) · salida F6 del SKILL ·
  la pág. 5 del semanal (labels).
- **Semántica** ("levemente X" = misma dirección, menor convicción): para el **scorecard**,
  acierto de `levemente_alcista` = retorno > 0 (igual que alcista; ídem bajista); neutral sigue
  con banda ±1%. Para el **Brier**, la probabilidad de las direcciones "leve" se acota: propuesta
  `p = 0.55 + 0.05×(confianza−1)` (rango 0.55-0.75) vs la lineal actual de las plenas (0.55-0.95)
  — marcada **provisoria, a calibrar** como la banda neutral. Los views históricos (3 estados) no
  se migran: quedan válidos tal cual.
- Guía de uso en la skill: "levemente" NO es el default tibio — es para cuando la dirección es
  clara pero el driver es débil/agotable; si no hay dirección, es neutral.

### 7.2 Insumos ampliados (todo lo que el Word manda a "leer")

Se extiende `/api/views/insumos` aditivamente con: **noticiasSemana** (rango 7 días sin cap,
query directa a la tabla) · **camiones completos** (`getCamiones()` series Williams +
`getCamionesPlantas()` Agroentregas — hoy solo viaja la señal destilada) · **djve_resumen** (por
familia, `ton_7d/30d/anio`) · **análisis propios**: interpretaciones publicadas de los últimos 7
días + prosa de los diarios de la semana + views vigentes de los otros granos ·
**pas_zonas/pas_condicion** (condición de cultivos con Δ semanal) · **"zona del precio"**:
percentil histórico 5 años del nivel (pizarra y 1ª posición A3, vía la infraestructura de
`/api/series` + `percentil()`) · **desacople local-internacional**: premio/descuento A3 vs CBOT
por grano (misma unidad USD/tn) hoy y hace 1/4 semanas, para responder "¿van de la mano o se
desprenden?" con números · **Δ semanal de precios** precomputado (A3/Chicago/pizarra).

### 7.3 Pipeline (cambios menores — la filosofía ya es la del Word)

- F2 suma preguntas explícitas: ¿en qué zona histórica está el precio? · ¿local e internacional
  van de la mano o se desprenden (premio vs CBOT, tendencia)? · ¿hay algún patrón en los datos
  (estacionalidad rota, divergencia precio-físico, volumen anómalo)?
- **Clima**: sigue como research externo en runtime del agente 2 (SMN/NOAA CPC/Drought Monitor,
  con pasaporte) — sin ingesta (decisión vigente). Se agrega a la skill un **calendario de
  ventanas críticas por cultivo** (fijo, en el SKILL: trigo siembra may-jul / espigazón sep-oct ·
  maíz siembra sep-nov / floración dic-ene · soja siembra oct-dic / llenado ene-mar · EEUU:
  siembra abr-may / polinización jul) para que el agente sepa cuándo el clima es crítico y suba
  la prioridad.
- F6: `tesis_md` sin tope de largo (N10); argumentos siguen 3-5; template estable.
- El loop de calibración (Paso 0) ahora también lee las **interpretaciones** de la semana (son
  análisis de la casa) — como contexto, nunca como fuente de números.

---

## 8. INTERPRETACIONES v3 — skill y rutina propias (N3)

### 8.1 Skill nueva `.claude/skills/interpretaciones/`

Extrae el Paso 9 del diario y lo amplía. Frontmatter propio (propuesta: `model: claude-opus-5`,
`effort: medium` — mismo tier que el diario; se sube si la calidad no alcanza).

**Alcance (N7)** — reportes que interpreta:
1. **Estimaciones** (como hoy): USDA (WASDE/Crop Production/Grain Stocks), CONAB, BCR-GEA,
   DEA-SAGyP, BCBA-PAS producción — detección por `estimaciones_produccion` (cursor
   `actualizado_en`, corre N veces/día seguro: el candado UNIQUE + chequeo de existencia ya lo
   permiten).
2. **PAS zonas + condición**: cuando entra la carga semanal de `pas_zonas`/`pas_condicion`, la
   interpretación del PAS del jueves los incluye (qué zona explica el cambio, cómo viene la
   condición vs semana previa/campañas pasadas). Detección por `actualizado_en` de esas tablas.
3. **CFTC COT** (viernes ~17:30 ART): fetch-en-vivo Socrata (endpoint ya documentado en la skill
   del view) — posición neta managed money por grano + Δ semanal; comparación "vs último dato del
   mismo reporte" = la semana anterior del mismo endpoint. En el texto: tendencia, no percentil (N9).
4. **USDA Export Sales** (jueves ~9:30 ET): fetch-en-vivo API FAS (la key `USDA_FAS_API_KEY` ya
   está cargada) — ventas semanales por grano vs semana previa y vs promedio 4 semanas.

**"Qué esperaba el mercado"** por reporte: USDA → tabla de expectativas DTN (pasaporte verificado,
fallback Pro Farmer), como hoy · COT/Export Sales → vs dato anterior + promedio (no hay encuesta;
si DTN publica expectativa de Export Sales, se usa con pasaporte) · CONAB/GEA/DEA/PAS → "consenso
implícito" (vintage previo + qué decían los otros organismos), como hoy.

**Estructura del borrador** (igual + 2 agregados): qué se esperaba → qué salió (números del dato
crudo) → sorpresa → cuánto estaba en el precio → reacción del precio → qué implica — **segmentado
por grano** (subsección por grano tocado, foco SOJA/MAÍZ/TRIGO) y con **impacto estructurado por
grano** (campo nuevo, abajo). Voz `voz-lautaro` registro "Informe largo". Comparación contra el
último dato del mismo reporte: ya la hace `construirCambios` (mejora opcional de la build:
extenderla a área/rinde además de producción — hoy solo producción genera "cambios").

**Migración `interpretaciones`**: `+ impacto jsonb NOT NULL DEFAULT '{}'` — forma
`{"soja":"alcista"|"neutral"|"bajista", "maiz":..., "trigo":...}` (solo los granos tocados;
3 estados, como pide el Word) · `+ auto_publicado boolean NOT NULL DEFAULT false`.
UI: badge de impacto por grano en las 4 superficies donde se muestra (admin, `/produccion`,
`/informes`, placa del diario).

**Auto-publicación (N4)**: la corrida de cierre del día (18:00 ART) publica todo borrador del día
que siga sin tocar (`publicado_md = borrador_md`, `estado='publicado'`, `auto_publicado=true`) y
avisa por mail "se publicó sola". Lo que Lautaro editó/descartó antes, manda. Las auto-publicadas
se distinguen en la UI (rótulo discreto "publicada automáticamente").

### 8.2 Rutina propia con calendario y reprogramación

- **Detección**: cada corrida lee `getEventos(hoy)` (el calendario ya tiene horas ART) + chequea
  las tablas por `actualizado_en` del día. Si el calendario dice que un informe YA debió salir y
  la base no lo tiene, lo reporta (hoy un WASDE que la ingesta pierde pasa en silencio) — y si el
  entorno lo permite, **dispara el `workflow_dispatch` de la ingesta correspondiente** por la API
  de GitHub y reintenta (los scripts son idempotentes; verificar en E2 que el entorno headless
  tenga token con permiso de Actions — si no, se espera al cron normal y se avisa).
- **Cadencia — diseño preferido (auto-reprogramable, como pide el Word)**: cron base
  `0 12 * * 1-5` (9:00 ART). Al arrancar, mira los eventos del día y se agenda despertadores
  (`send_later`) ~45 min después de la hora de publicación de cada uno (WASDE 13:00/14:00 ART →
  ~14:45; PAS 15:00 → 15:45; GEA/DEA 17:00-17:30 → 18:00; COT vie 17:30 → 18:15) + SIEMPRE un
  cierre 18:00 ART (auto-publicación + última pasada antes del diario). **Verificación previa en
  E2**: confirmar que el entorno headless de Routines expone las tools de scheduling
  (`send_later`/`create_trigger` del MCP CCR — los building blocks existen en sesiones normales,
  nunca se probó en Routine). **Fallback si no**: DOS crons fijos — `0 12 * * 1-5` (9:00 ART,
  procesa lo de la noche/mañana: CONAB progresso del lunes 19:00 queda para la mañana siguiente)
  y `0 21 * * 1-5` (18:00 ART, cierre + auto-pub + GEA/DEA/PAS/COT del día).
- **Calendario — huecos a cerrar en la build**: evento USDA Export Sales (jueves 9:30 ET) ·
  NOPA está declarado en el type pero nunca genera eventos (decidir: sumarlo o sacarlo del type) ·
  nota de vencimiento del array CONAB 2026 (el healthcheck de seed ya vigila NASS; sumar CONAB).
- **El diario deja de correr el Paso 9.** Transitorio seguro: primero se crea y prueba la rutina
  nueva (E2), después se borra el Paso 9 del diario (E3) — nunca quedan las dos activas más de
  los días de la transición (el candado de existencia hace inocuo el solapamiento).

---

## 9. Retroalimentación (pedido: "en caso de que cada uno se pueda retroalimentar, lo hacemos")

| Producto | Mecanismo hoy | Qué se agrega en V3 |
|---|---|---|
| View | Nota 1-5 + texto (`admin_feedback_view`) + scorecard hit-rate/Brier + `aprendizajes.md` gateado — **sin usar (0 notas)** | Nada nuevo que construir: **usarlo**. La adaptación a 5 estados toca el scorecard (§7.1). El plan lo deja anotado como hábito de Lautaro (1 min por semana en `/granos/view`). |
| Informe diario | Nada | Migración `informes_generados`: `+ nota smallint CHECK 1-5 NULL`, `+ feedback text NULL` + RPC `admin_feedback_informe(p_id, p_feedback, p_nota)` (patrón del view) + mini-form en `/informes` visible solo admin (una línea por informe). La skill lee las últimas ~8 notas/feedback en su Paso 0 y ajusta (patrón calibración del view). |
| Informe semanal | Nada | Mismo mecanismo (misma tabla/RPC/UI — cero costo marginal). |
| Interpretaciones | Gate humano (editar antes de publicar) | El **diff borrador→publicado ES el feedback**: la skill, en su Paso 0, lee las últimas interpretaciones donde `publicado_md ≠ borrador_md` y aprende del delta (qué recorta Lautaro, qué agrega, qué tono corrige). Con la auto-publicación, las que él NO tocó (auto_publicado=true, sin diff) también informan: silencio = aceptable. Se agrega además la nota 1-5 opcional reutilizando el patrón (`+ nota smallint` en `interpretaciones`). |
| Todos | `aprendizajes.md` solo en view | `references/aprendizajes.md` en las 4 skills, con el MISMO protocolo gateado del view (cap 200 líneas, promoción por ≥2 episodios o marca explícita de Lautaro, la Routine NUNCA destila — destilación manual en sesiones). |

---

## 10. Etapas de ejecución (builds con Sonnet, un PR por etapa)

Orden y dependencias: **E1 → E2 → E3 → E4 → E5 → E6** (E3/E4/E5 son independientes entre sí una
vez mergeada E1; E2 conviene antes de E3 porque el diario v3 asume que las interpretaciones llegan
publicadas). Toda migración se versiona y se aplica por MCP con OK de Lautaro (protocolo de
siempre). Cada etapa: lint + tsc + vitest + build + verificación con datos reales + bitácora de
sesión + PR base `main`.

### PROMPT E1 — Datos e infraestructura compartida

> Leé `docs/PLAN_INFORMES_V3.md` (§3, §5, §6, §7.2, §8.1) y ejecutá la etapa E1: SOLO datos,
> migraciones y endpoints — cero cambios de skills/plantillas (eso es E2-E5).
> 1. **Migraciones** (versionadas; se aplican por MCP con OK explícito): (a) `views_mercado`:
>    CHECK de `direccion` a 5 estados (§7.1); (b) `interpretaciones`: `+ impacto jsonb default
>    '{}'` + `+ auto_publicado boolean default false` + `+ nota smallint CHECK 1-5 NULL`;
>    (c) `informes_generados`: `+ nota smallint CHECK 1-5 NULL` + `+ feedback text NULL` + RPC
>    `admin_feedback_informe` (patrón exacto de `admin_feedback_view`); (d) `mesa_color`:
>    `+ chicago_bcr text NULL`.
> 2. **Libs nuevas** (puras, con tests): `variacionDiariaPizarra()` ($ y USD, sobre
>    `pizarra_historico`, null-safe si falta el día previo) · `top3PorVolumen()` (sobre
>    `CierrePos[]`, top 3 + total del producto) · volumen A3 semanal por underlying (suma de
>    `futuros_cierres.volume`, 5 ruedas) · Δ semanal de macro (WTI/oro/DXY/BRL sobre la serie
>    spark) · acumulado semanal de compras BCRA (derivado de `serie`) · premio/descuento A3 vs
>    CBOT por grano (USD/tn, hoy y −7/−28 días) · percentil histórico 5 años del nivel (pizarra +
>    1ª posición A3, reusando `/api/series` + `percentil()`).
> 3. **`/api/informes/datos` (aditivo)**: `datosDiario` suma `oficialVarPct`, `volumenCambiario`,
>    `djveResumen`, `camionesPlantas`, `variacionPizarra`, `top3PorGrano`, `chicagoBcr` (de
>    `mesa_color.chicago_bcr`), agenda a 7 días, noticias con ventana 24 hs (parámetro nuevo de
>    `getNoticias`, sin tocar el default del panel público). `datosSemanal` suma:
>    `diariosSemana` (título+prosa de tipo=diario enviados desde el último semanal enviado),
>    `interpretacionesSemana`, `noticiasSemana` (rango 7d sin cap), `djveResumen`,
>    `camionesSemana` (agregación Williams+Agroentregas), `dolarLinked`, `arbitrajes`,
>    `volatilidadDolar`, `comprasBcraSemana`, `pasZonas`/`pasCondicion` (con Δ semanal de
>    condición), `volumenA3Semanal`, y el **ancla** de variaciones al último semanal enviado.
> 4. **`/api/views/insumos` (aditivo)**: §7.2 completo (noticiasSemana, camiones completos,
>    djve_resumen, interpretaciones+diarios+views de otros granos, pas_zonas/pas_condicion,
>    zona del precio, desacople vs CBOT, Δ semanal precios).
> 5. **Admin**: segundo textarea "Contexto Chicago (BCR)" en `/admin/datos/mesa-color` (mismo
>    candado 🔒); mini-form de nota/feedback por informe en `/informes` visible solo admin;
>    badge de impacto por grano en las superficies de interpretaciones (leyendo `impacto`, que
>    E2 empezará a escribir — vacío hasta entonces).
> 6. **Unificar** el criterio "informe de hoy": `getInformesHoy` de `informe-diario-datos.ts`
>    debe usar también `actualizado_en` (hoy la plantilla y el route divergen).
> 7. Verificación: tests de las libs nuevas con fixtures reales · `curl` de ambos endpoints
>    con token y campos nuevos presentes · RLS de las columnas nuevas por SQL · Playwright del
>    admin y el badge. Protocolo completo (lint/tsc/vitest/build) + bitácora + PR.

### PROMPT E2 — Skill + Rutina de interpretaciones

> Leé `docs/PLAN_INFORMES_V3.md` (§8 completo, §3 N3/N4/N7) y ejecutá la etapa E2 (requiere E1
> mergeada):
> 1. **Skill nueva** `.claude/skills/interpretaciones/SKILL.md`: extraer el Paso 9 de
>    `informe-diario` como base (NO borrarlo todavía de allá — eso es E3) y ampliarlo según §8.1:
>    alcance (estimaciones + PAS zonas/condición + COT Socrata + Export Sales FAS), "qué esperaba
>    el mercado" por reporte, estructura segmentada por grano, campo `impacto` por grano,
>    auto-publicación de cierre 18:00 ART, `references/aprendizajes.md` (protocolo gateado del
>    view) + Paso 0 con voz-lautaro + lectura del diff borrador→publicado de las últimas
>    interpretaciones. Reglas duras que se conservan: ni un número inventado, pasaportes
>    verificados, candado de existencia (no pisar ediciones), mail de aviso.
> 2. **Detección**: cursor por `actualizado_en` (estimaciones_produccion, pas_zonas,
>    pas_condicion) + `getEventos(hoy)` para saber qué esperar; si un informe debió salir y no
>    está en la base, avisar — y probar el disparo del `workflow_dispatch` de la ingesta por API
>    de GitHub desde el entorno (si no hay permiso, documentar el fallback "esperar al cron").
> 3. **Calendario**: evento USDA Export Sales + resolver NOPA (sumar evento o sacar del type) +
>    centinela del array CONAB (§8.2).
> 4. **Rutina**: crearla por MCP (`create_trigger`) con nombre "ROFO AGRO — Interpretaciones",
>    cron base `0 12 * * 1-5`, prompt estándar (repo NUEVO `ROFOAGRO_RESEARCH_WEB`, aviso por
>    mail ante falla). Probar en la primera corrida si el entorno headless tiene `send_later`
>    para la auto-reprogramación (§8.2); si no, crear el segundo cron fijo `0 21 * * 1-5` (18:00
>    ART, cierre + auto-publicación).
> 5. Verificación: corrida en seco contra un informe real ya ingestado (patrón MP4: generar
>    borrador de un WASDE/PAS real SIN publicar, cotejar números por SQL) + probar la
>    auto-publicación con una fila de prueba (borrada al final) + badge de impacto visible.
>    Protocolo completo + bitácora + PR.

### PROMPT E3 — Informe diario v3 (placa + web)

> Leé `docs/PLAN_INFORMES_V3.md` (§5 completo, §3 N5/N6/N8/N9, §4) y ejecutá la etapa E3
> (requiere E1 y E2 mergeadas):
> 1. **Plantilla** `/informes/plantilla/research`: reorganizar por producto SOJA→MAÍZ→TRIGO con
>    local/internacional separados según §5.1 (bloques A-J), conservando TODO el dato actual.
>    La plantilla debe dejar de duplicar queries: que consuma los mismos getters que el API
>    (patrón `informe-diario-datos.ts`). Layout funcional — el diseño fino lo itera Lautaro.
> 2. **Skill `informe-diario` v3** (§5.3): Paso 2 por producto + reglas de extracción del color
>    (pizarra estimada/físico: N5 — sin número cargado o sin cron actualizado, NO se calcula
>    variación) + condicionales (DJVE/camiones/otros mercados con sus umbrales-perilla) +
>    noticias 24 hs "puede ser cero" + agenda 7 días. **Eliminar el Paso 9** (ya vive en la
>    skill de interpretaciones desde E2). Sigue mono-hilo, cero fetch externo.
> 3. **Página web** `/informes/diario/[fecha]` (§5.4): mismo contenido como página responsive
>    para estado=enviado; DOS puertas construidas — gate por sección informes Y link público
>    firmado por informe (generable en admin) — para que Lautaro elija cuál activa.
> 4. Verificación: placa en seco con datos reales (fila de prueba borrada al final, patrón del
>    30/07) + screenshot claro/oscuro + página web con Playwright (gate y link firmado probados
>    con bypass temporal revertido). Protocolo completo + bitácora + PR.

### PROMPT E4 — Informe semanal v3

> Leé `docs/PLAN_INFORMES_V3.md` (§6 completo, §3 N1/N8/N9, §4) y ejecutá la etapa E4 (requiere
> E1 mergeada; ideal post-E2 para leer interpretaciones reales):
> 1. **Plantilla** `/informes/plantilla/semanal`: reestructurar según §6.1 — tapa + "la semana
>    en números" + UNA SECCIÓN POR PRODUCTO + dólar/macro local + internacional + comex
>    transversal + cierre. Sin límite de páginas (flujo libre A4). Tabla de arbitraje con
>    pizarra estimada del viernes si está (rótulo obligatorio) o la del jueves (rótulo).
>    Volatilidad + compras BCRA + linked con los charts de los paneles existentes. Sin columnas
>    de percentil a la vista (N9).
> 2. **Skill `informe-semanal` v3** (§6.2): prosa por producto, ancla al último semanal enviado,
>    lectura de diarios/interpretaciones/view sin re-derivar (§4), regla N9, cae `/Count ≥5`.
> 3. Verificación: PDF en seco con datos reales de una semana completa (patrón V3 del 28/07,
>    borrador de prueba borrado), cotejo de cada tabla contra su panel de la web. Protocolo
>    completo + bitácora + PR.

### PROMPT E5 — View v3

> Leé `docs/PLAN_INFORMES_V3.md` (§7 completo, §3 N2/N10) y ejecutá la etapa E5 (requiere E1
> mergeada — la migración de 5 estados ya está aplicada):
> 1. **Réplicas TS de los 5 estados** (§7.1: views-mercado.ts, page.tsx del view, scorecard con
>    la semántica "leve", labels del semanal) + tests del scorecard actualizados (fixtures con
>    direcciones leves; los views históricos de 3 estados siguen midiendo igual).
> 2. **Skill `view-mercado` v3** (§7.3): F2 con zona del precio/desacople/patrones, calendario
>    de ventanas críticas de clima, guía de uso de los 5 estados, tesis_md sin tope (N10),
>    Paso 0 leyendo interpretaciones de la semana.
> 3. Verificación: corrida en seco de un grano con los insumos ampliados reales (sin persistir),
>    scorecard verificado con fixture de dirección leve, UI del view con los 5 colores/glifos
>    en claro/oscuro. Protocolo completo + bitácora + PR.

### PROMPT E6 — Routines finales + cierre

> Leé `docs/PLAN_INFORMES_V3.md` (§8.2, §9, §11) y ejecutá la etapa E6 (última; requiere todo
> mergeado):
> 1. **Routines por MCP**: renombrar las 3 existentes a "ROFO AGRO — …" · corregir los 3 prompts
>    (repo `ROFOAGRO_RESEARCH_WEB`, quitar referencias viejas) · sumar la cláusula de aviso por
>    mail ante falla a la del view (hoy no la tiene) · verificar que la de interpretaciones (E2)
>    quedó con su cadencia definitiva. Cadencias sin cambios: diario 18:30 ART L-V · view vie
>    9:00 · semanal vie 19:00 · interpretaciones 9:00 L-V (+cierre 18:00).
> 2. **Feedback end-to-end**: probar nota+feedback de un informe real desde `/informes` (admin) y
>    que las skills lo lean (corrida en seco del Paso 0 de cada una).
> 3. **Monitoreo**: dar de alta la Routine de interpretaciones en `src/lib/monitoreo/catalogo.ts`
>    (checklist/conexiones) con su ventana esperada.
> 4. Cierre: actualizar `PLAN_INFORMES_V3.md` (tablero §11), `ESTADO.md`, backlog maestro (C30) y
>    verificar la primera corrida real de cada Routine en la semana siguiente (consumo/duración —
>    la línea base R5 que sigue pendiente de V2). Protocolo completo + bitácora + PR.

---

## 11. Tablero de la ejecución

| Etapa | Contenido | Estado |
|---|---|---|
| E1 | Migraciones + libs + endpoints ampliados + admin (Chicago BCR, feedback, badge) | ☐ |
| E2 | Skill + Rutina de interpretaciones (calendario, reprogramación, auto-pub) | ☐ |
| E3 | Diario v3 (placa por producto + skill + página web con link) | ☐ |
| E4 | Semanal v3 (por producto, sin límite, skill) | ☐ |
| E5 | View v3 (5 estados + insumos ampliados + skill) | ☐ |
| E6 | Routines finales + feedback end-to-end + monitoreo + cierre | ☐ |

## 12. Criterios de éxito

1. **Los 4 productos tienen skill + Routine propios**, todos leen `voz-lautaro`, y las Routines
   se llaman ROFO AGRO con prompts correctos y aviso por mail ante falla.
2. **Cada requisito del Word de §1.1 tiene su dato en el informe correspondiente** (o su
   degradación honesta documentada: pizarra estimada sin cargar → sin variación; noticias sin
   nada relevante → cero titulares; clima sin verificación → no se cita).
3. **Cero duplicación**: el semanal cita diarios/view/interpretaciones (se verifica leyendo un
   semanal real: ningún número re-derivado de un análisis que ya existía).
4. **Feedback operativo en los 4**: nota/feedback guardables y leídos por las skills en su Paso 0.
5. **Interpretaciones llegan a tiempo**: un reporte que sale a las 13:00 tiene borrador el mismo
   día y está publicado (manual o auto) antes del diario de las 18:30.
6. Ningún principio vigente roto: ni un número inventado, pasaportes, blind-first, gates del
   view, motor Routines, entrega por mail + `/informes`.
