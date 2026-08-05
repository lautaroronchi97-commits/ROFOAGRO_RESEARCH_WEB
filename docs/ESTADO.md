# ESTADO — tablero vivo del repo (leer SIEMPRE antes de trabajar)

> Este archivo es cómo se comunican las sesiones de trabajo entre sí. Cada sesión lo lee al arrancar
> (entra automáticamente vía `CLAUDE.md`) y lo actualiza al cerrar. Es CORTO a propósito: la foto de
> **ahora**. El manual estable del proyecto es [`CONTEXTO.md`](CONTEXTO.md); el detalle de cada sesión
> vive en [`sesiones/`](sesiones/).

## Protocolo de sesiones (obligatorio)
1. **Al arrancar**: leer este archivo + la última entrada de `docs/sesiones/`. Trabajar en una rama
   `claude/*` creada **desde `main`**. Si la rama de la sesión no sale de `main` actualizado, rebasear
   primero (`git fetch origin main && git rebase origin/main`).
2. **Durante**: commits chicos y frecuentes. `npm run lint` + `npx tsc --noEmit` + `npx vitest run` +
   `npm run build` antes de pushear (el CI corre eso mismo).
3. **Al cerrar**: en el MISMO PR de la sesión —
   - crear `docs/sesiones/AAAA-MM-DD-tema.md` (copiar [`sesiones/_TEMPLATE.md`](sesiones/_TEMPLATE.md));
   - actualizar la sección **«Ahora»** de este archivo (qué quedó hecho, qué quedó en vuelo);
   - tocar `CONTEXTO.md` SOLO si cambió algo estable (stack, fuentes, fórmulas, reglas).
4. **PRs**: un PR por sesión, **base `main`**, draft hasta que esté verificado. NUNCA contra otra rama.
5. **Prohibido**: pushear a `main` directo · abrir PRs contra ramas `claude/*` · duplicar apuntes de
   sesión en `CONTEXTO.md` (van en `sesiones/`).

## Ahora (última actualización: 05/08/2026 — 🏁 E6 de PLAN INFORMES V3 CERRADO: PLAN_INFORMES_V3
completo E1→E6, las 4 Routines renombradas/corregidas + la de interpretaciones creada)

**🏁 E6 — ÚLTIMA ETAPA DE PLAN INFORMES V3 — HECHA DE PUNTA A PUNTA, cierra el plan completo
(C30) — rama `claude/hito-e6-plan-informe-3svmrm`, PR #139.** Ejecuta el PROMPT E6 de
`PLAN_INFORMES_V3.md` §10 (requiere E1→E5, las 5 ya mergeadas). Los 4 ítems del prompt cerrados
de punta a punta. El MCP de Routines devolvió `requires approval` sin resolver al principio de la
sesión (3 intentos) — se avanzó con el resto del prompt mientras tanto y, al reintentarlo más
tarde en la misma sesión (a pedido explícito de Lautaro: "proba para volver a modificar las
rutinas o crearlas"), **el canal ya estaba destrabado** y se aplicaron los 4 cambios sin
problema.

**Monitoreo N13 — `routine_runs` cableado al catálogo único.** `src/lib/monitoreo/catalogo.ts`
suma un 4º `RoutineDef` (`interpretaciones`) + actualiza el texto de `informe-semanal` a "viernes
20:30" (N12). `routines-logica.ts` suma una función nueva, `evaluarPorTelemetria` — a diferencia
de diario/semanal/view (detectables por lo que ESCRIBEN, con un output fijo esperado), un día sin
ningún reporte de organismo es un día LEGÍTIMO con cero interpretaciones nuevas, así que esa
Routine se detecta por telemetría pura (¿hay ≥1 fila de `routine_runs` hoy?), no por filas
producidas. `routines.ts` suma el fetch + el case nuevo — `/admin/checklist` (balde 🟣) y
`/admin/conexiones` heredan el 4º ítem gratis (ya iteraban genérico). **Bug real encontrado**: las
skills documentaban `tipo: "informe_diario"`/`"informe_semanal"` para su fila de telemetría, pero
la ÚNICA fila real en producción (el informe diario de HOY) usa `"diario"` — corregidos los 2
`SKILL.md` para que digan lo que la Routine real ya escribe.

**Watchdog del informe diario (N13)**: chequeo nuevo en `scripts/healthcheck-frescura.mjs` — si
hoy es hábil y a las 20:45 ART (cuando corre este cron) no hay un informe diario `enviado` de
hoy, cuenta como falla real (dispara el mail de alerta ya existente, sin cron/lógica de mail
nuevos). **Corrido contra producción real**: `✓ watchdog informe diario: 2026-08-04: enviado`
(coincide con el informe real de hoy).

**Feedback end-to-end, verificado contra producción real con reversión inmediata en cada caso**
(los 4 productos): informe diario/semanal (`admin_feedback_informe`, contra el informe real de
hoy, revertido) · view de mercado (`admin_feedback_view`, contra un view real del 31/07,
revertido) · nota 1-tap (`/api/informes/nota` contra `rofoagro.com.ar` real: firma inválida →
400 honesto, como se esperaba sin `INFORME_SHARE_SECRET` cargado; el PATCH subyacente probado por
SQL y revertido) · interpretaciones (feedback por diff): **no hizo falta simular nada** — hay un
caso real (la interpretación del DEA del 27/07, que Lautaro editó de verdad) que confirma que el
`SELECT` del Paso 0 de la skill trae los dos textos completos, listo para el diff.

**Verificado**: lint/tsc/**488 tests** (4 nuevos)/build ✅ · healthcheck corrido en vivo contra
producción (credenciales reales del entorno) · feedback de los 4 productos probado contra datos
reales de producción y revertido sin dejar residuo (confirmado por SQL en cada caso).

**Routines por MCP (ítem 1 del prompt E6) — RESUELTO en la misma sesión.** Las 3 Routines
existentes renombradas de "RF AGRO" a "**ROFO AGRO**" + fix del repo viejo
`RFAGRO_RESEARCH_WEB`→`ROFOAGRO_RESEARCH_WEB` en sus 3 prompts: **Informe diario (MP1)** (sin
cambio de cron, 18:30 ART L-V, ya tenía la cláusula de mail) · **Informe semanal (MP2)** (cron
`0 22 * * 5`→`30 23 * * 5`, **19:00→20:30 ART/N12**, ya tenía la cláusula de mail) · **View de
mercado (MP3)** (sin cambio de cron, 9:00 ART viernes, **sumada la cláusula de aviso por mail que
le faltaba**). **Routine nueva creada**: "ROFO AGRO — Interpretaciones" (`0 12 * * 1-5` = 9:00 ART
L-V, no existía — confirmado paginando el historial completo de Routines de la cuenta, sin
ninguna coincidencia previa). Las 4 verificadas por `list_triggers` tras el cambio: nombres,
crons y `next_run_at` correctos.

**Follow-up mismo día/PR: se saca la puerta pública del informe diario.** Lautaro: *"No va a hacer
falta el link solo nos quedamos con el pdf o png"* — precisado con `AskUserQuestion`: es el link
público sin login de `/informes/diario/[fecha]` (no los 3 links de nota 1-tap del mail, que no
exponen el informe y siguen vigentes); la página web queda, pero solo para gente logueada.
`/informes/diario/[fecha]` pasa de "dos puertas" a **una sola** (`requireSeccion("informes")`
siempre) — se saca el chequeo de firma + el banner de admin con el link + `payloadInformeCompartido`
(0 callers) de `informe-auth.ts` · `src/proxy.ts` saca esa ruta de las que saltean el gate
optimista (ya no tiene puerta propia sin cookies). lint/tsc/**488 tests**/build ✅.

**Pendiente (no nuevo, ya documentado)**: `INFORME_SHARE_SECRET` sigue sirviendo solo para la
nota 1-tap (no para ningún link de contenido) y real sigue sin confirmarse en
Vercel/Routines (mismo pendiente de E1) · la Routine de interpretaciones quedó creada sin
conectores MCP adjuntos (aviso del propio `create_trigger`: la sesión que la creó no tenía
conectores propios para heredar) — no debería importarle, la skill usa `fetch`/`git`/`curl` con
env vars, nunca tools `mcp__*`; confirmar en su primera corrida real. **Con esto
`PLAN_INFORMES_V3.md` queda con E1→E6 completos — el plan (C30 del backlog maestro) cierra.**
Detalle: [`sesiones/2026-08-04-e6-routines-cierre.md`](sesiones/2026-08-04-e6-routines-cierre.md).

## Anterior (04/08/2026 — 🎯 E5 de PLAN INFORMES V3: view de mercado a 5 estados)

**🎯 E5 — VIEW V3 (5 ESTADOS) — HECHO Y VERIFICADO — rama `claude/plan-informe-e5-owgf06`,
PR #_.** Ejecuta el PROMPT E5 de `PLAN_INFORMES_V3.md` §10 (requiere E1, ya mergeada, con la
migración de 5 estados aplicada). El view direccional pasa de 3 a **5 estados** — alcista ·
levemente alcista · neutral · levemente bajista · bajista — con la guía dura de que "levemente"
NO es el default tibio: es para cuando la dirección es clara pero el driver es débil o agotable.

**Réplicas TS**: `DireccionView` (`views-mercado.ts`) con los 5 valores + labels · `/granos/view`
con colores/glifos nuevos (`levemente_*` comparte color con su extremo — misma dirección, menor
convicción — y se distingue con un glifo hueco △/▽ contra los llenos ▲/▼, decisión propia sin
sumar una paleta nueva) · la plantilla del informe semanal **ya toleraba los 5 estados de forma
genérica** desde E4 (sin mapa fijo de 3 valores), confirmado sin cambios. **Scorecard**
(`views-scorecard.ts`): `esAcierto` cuenta "levemente_X" como X para el hit-rate; `confianzaAProbabilidad`
ahora recibe la dirección — las plenas mantienen el mapeo lineal 0,55-0,95, las "leves" usan un
mapeo más chato 0,55-0,75 (provisorio, a calibrar cuando haya masa de datos, mismo criterio que
la banda neutral).

**Skill `view-mercado` v3**: F1 suma los 14 campos aditivos que E1 había dejado en
`/api/views/insumos` sin consumir (noticiasSemana, camiones completos, djveResumen, pasZonas/
pasCondicion, diariosSemana/interpretacionesSemana, viewsVigentes, variaciones semanales
precomputadas, volumenA3Semanal, desacopleLocal, zonaPrecio) · F2 suma las 3 preguntas explícitas
del plan (zona histórica del precio, desacople local-internacional, patrones que rompen lo
esperado) + un calendario fijo de ventanas críticas de clima por cultivo · F6 con la guía de uso
de los 5 estados y `tesis_md` sin tope de largo (N10, único campo del template sin techo) · Paso 0
suma la lectura de `interpretacionesSemana` como contexto de calibración (nunca fuente de
números) · telemetría N13 (`routine_runs`, `tipo:"view"`, `mail_enviado` siempre `false` — el view
nunca manda mail).

**Verificado**: lint/tsc/**484 tests** (5 nuevos)/build ✅ · `/api/views/insumos` probado en vivo
contra producción real (los 14 campos aditivos de E1 responden con datos reales y plausibles —
zonaPrecio con percentiles, desacopleLocal con premio real vs CBOT, viewsVigentes con los 3 views
reales del 31/07) · **UI de `/granos/view` con los 5 colores/glifos verificada con Playwright real
en claro y oscuro** (3 filas de prueba reales insertadas por SQL —fecha `2099-01-01`— con bypass
temporal de sesión/lectura, revertido íntegramente al terminar —`git diff` limpio— y las 3 filas
**borradas**, confirmado `count=0`): △ LEVEMENTE ALCISTA verde, ▽ LEVEMENTE BAJISTA rojo, ▼
BAJISTA rojo, ◆ NEUTRAL y ▲ ALCISTA en el historial, cero errores de consola.

**Pendiente (no bloquea)**: el rango 0,55-0,75 de Brier para direcciones "leve" sigue sin
calibrar contra scorecards reales (todavía no hay ningún view real con esa dirección). **Próximo
paso: E6** (Routines finales + cierre — renombrar Routines, cadencias definitivas incl. semanal
20:30 ART/N12, feedback end-to-end, monitoreo N13 con watchdog, cierre del plan V3). Detalle:
[`sesiones/2026-08-04-e5-view-mercado-5-estados.md`](sesiones/2026-08-04-e5-view-mercado-5-estados.md).

## Anterior (04/08/2026 — 📊 E4 de PLAN INFORMES V3: informe semanal reorganizado por producto)

**📊 E4 — INFORME SEMANAL V3 (UNA SECCIÓN POR PRODUCTO) — HECHO Y VERIFICADO — rama
`claude/plan-informes-e4-w6ao57`, PR #_.** Ejecuta el PROMPT E4 de `PLAN_INFORMES_V3.md` §10
(requiere E1, mergeada el mismo día; ideal post-E2, también mergeada). Reestructura la placa
semanal (MP2/V2) por producto **SOJA→MAÍZ→TRIGO con local/internacional SIEMPRE separados**
(N8) y le sacó el tope de 5 páginas (N1) — flujo libre A4, cada sección lógica imprime tantas
hojas físicas como necesite.

**`datosSemanal()` se mudó** de `/api/informes/datos/route.ts` a
`src/lib/informe-semanal-datos.ts` (mismo patrón que `informe-diario-datos.ts` de E3) — ahora
es la ÚNICA función que arma los insumos del semanal, consumida por el route (Routine externa
por token) Y por la plantilla nueva, cero query duplicada. Sumó 2 campos aditivos que el JSON
no necesitaba pero la plantilla sí: `comprasBcra` completo (con `serie`, para el gráfico de
barras) y `pases` (tasas implícitas por producto).

**Plantilla `/informes/plantilla/semanal` reescrita por producto**: tapa → "la semana en
números" (transversal) → una sección por SOJA/MAÍZ/TRIGO (precios · volúmenes · comercial
—negociado/DJVE/gap de cobertura 60d, agregados por familia de producto— · tasas implícitas
—arbitrajes+pases, con canal de **pizarra estimada del viernes** vía `prosa.pizarra_estimada`,
recalculando `tasaDirecta`/`tnaUSD` de `src/lib/arbitraje.ts`— · producción —cambios de
organismos + Δ de condición BCBA-PAS semana a semana, `deltaCondicionReciente()` nueva en
`pas-condicion-calc.ts`, 3 tests— · "la semana según la mesa" —view + interpretaciones del
producto—) → "Dólar y macro local" (oficial + volatilidad + compras BCRA + linked + carry) →
"Contexto internacional" (Chicago + "el mundo esta semana" + otros mercados ≥5%) → "Comercio
exterior transversal" (cumplimiento + camiones Williams+Agroentregas) → "Cierre" (agenda +
scorecard mensual). Reusa `VariacionBarras`/`DolarOficialChart`/`DolarOficialVolatilidadChart`/
`BcraMulcChart`/`ImpactoBadges`, todos ya construidos por sesiones previas.

**Skill `informe-semanal` v3**: Paso 0 de calibración nuevo (banco de oro + aprendizajes
propios + últimas notas/feedback, mismo patrón que E3) · Paso 1 documenta los ~25 campos del
JSON ampliado por E1 · Paso 2 (criterio) reescrito para la estructura por producto + regla N9
explícita (sin internals) · Paso 3 con los campos de prosa nuevos por producto (`soja_texto`/
`maiz_texto`/`trigo_texto` + `local_texto`/`internacional_texto` + `pizarra_estimada`) ·
Paso 5 sin el check `/Count ≥5` (ya no hay techo de páginas) · Paso 7 (mail) suma los 3 links
de nota 1-tap (N15) · Paso 9 suma telemetría (`routine_runs`, N13). `references/aprendizajes.md`
y `references/banco-de-oro.md` propios, vacíos.

**Bug real encontrado y arreglado en la propia verificación**: `BcraMulcChart` (chart+tabla
pensado para un panel de ancho completo, con `RangoChips`) metido en una columna de grid de
~334px se cortaba silenciosamente contra el borde de la hoja A4 — sin error, sin overflow
visible en el propio elemento (Playwright solo lo detectó al mirar la captura). Fix: cada chart
de "Dólar y macro local" pasó a su propia fila a ancho completo; el grid de 2 columnas queda
reservado para pares de texto plano. **Decisión propia** (el plan usaba "pizarra del jueves"
como ejemplo): el rótulo de la pizarra oficial en la tabla de tasas implícitas quedó dinámico
(`Pizarra oficial del DD/MM/AAAA`, leyendo `arbitrajes.pizarraFecha` real) en vez de fijo a
"jueves" — generaliza correctamente sin perder el requisito de rótulo obligatorio.

**Verificado**: lint/tsc/**479 tests** (3 nuevos)/build ✅ · `npm run start` con datos reales de
producción (`curl` a `/api/informes/datos?tipo=semanal` con los ~32 campos esperados) ·
Playwright real (9 hojas lógicas confirmadas, capturas por sección con datos 100% reales: soja
ALCISTA/NEUTRAL con tesis completa, DJVE/gap de cobertura reales, agenda real) · **canal de
pizarra estimada probado de punta a punta** (fila de prueba real insertada y BORRADA al
terminar, patrón ya usado en sesiones anteriores — confirmado por SQL que no queda residuo).

**Pendiente (no bloquea)**: primera corrida real de la Routine semanal con este formato (el
viernes que viene, post-merge) · `references/aprendizajes.md`/`banco-de-oro.md` arrancan
vacíos. **Próximo paso: E5 (view v3, 5 estados) y E6 (Routines finales + cierre)** — E5 ya no
debería requerir tocar esta plantilla (el badge de dirección tolera los 5 estados de forma
genérica, sin mapa fijo de 3 valores). Detalle:
[`sesiones/2026-08-04-e4-informe-semanal.md`](sesiones/2026-08-04-e4-informe-semanal.md).

## Anterior (04/08/2026 — 📰 E3 de PLAN INFORMES V3: informe diario reorganizado por producto + página web con link)

**📰 E3 — INFORME DIARIO V3 (PLACA POR PRODUCTO + SKILL + PÁGINA WEB) — HECHO Y VERIFICADO —
rama `claude/e3-plan-informes-dk3qgq`, PR #_.** Ejecuta el PROMPT E3 de `PLAN_INFORMES_V3.md`
§10 (requiere E1+E2, ambas mergeadas). Reorganiza la placa "Research" por producto
**SOJA→MAÍZ→TRIGO con local/internacional SIEMPRE separados** (N8, el requisito central del
Word de Lautaro) — nada de lo que ya mostraba se pierde, y de paso se cierra un gap real: E1
(04/08, mismo día) ya había sumado 5 campos nuevos a `/api/informes/datos` (`volumenCambiario`,
`djveResumen`, `camionesPlantas`, `top3PorGrano`, `variacionPizarra`, agenda a 7 días, noticias
24hs) pero la plantilla nunca los consumía — confirmado por research antes de escribir código.

**`datosDiario()` se mudó** de `/api/informes/datos/route.ts` a
`src/lib/informe-diario-datos.ts` — ahora es la ÚNICA función que arma los insumos del diario,
llamada por el route (Routines externas por token), la plantilla PNG y la página web nueva:
cero query duplicada entre las 3 superficies (pedido explícito del prompt E3). `ProsaDiaria`
suma 4 campos opcionales que la skill escribe extrayendo del texto libre de la mesa:
`pizarraEstimada`/`volumenFisico` (por grano) y `condicionalDjve`/`condicionalCamiones` (ausentes
si el día es normal — perillas calibradas por el backtest de E1: DJVE ≥1,5× mediana, camiones
|Δ|≥30% o ≥1,5× interanual).

**Página nueva `/informes/diario/[fecha]`**: el informe completo como página del sitio
(responsive, sigue el tema — no la paleta fija de la plantilla), con TODO lo que la placa
muestre. **Dos puertas (N6)**: link público firmado `?t=` (HMAC-SHA256 sin estado, mismo
`INFORME_SHARE_SECRET` de la nota 1-tap de E1) O `requireSeccion("informes")` (sesión con
permiso, o admin) — admin ve el link firmado directo en la página. Linkeada desde `/informes`
("Ver informe completo →"). `src/proxy.ts` suma `/informes/diario/` a las rutas que saltean el
gate optimista (mismo motivo ya documentado ahí para `/informes/plantilla/`).

**Skill `informe-diario` v3**: Paso 0 suma banco de oro + aprendizajes propios + últimas 8
notas/feedback; Paso 2 suma las reglas de extracción del color para los 4 campos nuevos +
regla "sin internals" (N9); Paso 4 suma el chequeo de altura (N17, tope 2×1056, SIN recorte
automático — decisión de esta sesión, ver abajo); Paso 6 (mail) suma eco del color + link a la
página web + 3 links de nota 1-tap; Paso 8 suma telemetría (`routine_runs`, N13). **Paso 9
(interpretación de informes) ELIMINADO** — vive en la skill `interpretaciones` desde E2, el
diario ahora solo LEE lo que esa skill ya publicó.

**Bug real encontrado y arreglado en la propia verificación**: la primera versión de la página
web usaba `<table className="tbl">` (clase con `min-width:640px`, pensada para tablas de mercado
a todo el ancho del panel) DENTRO de tarjetas angostas (~230px) — el contenido desbordaba y se
solapaba visualmente con la tarjeta vecina, confirmado con Playwright (capturas antes/después).
Reemplazado por filas flex propias (`StatLine`) + un mini-grid para el Top 3, mismo patrón sin
`<table>` que ya usaba la plantilla PNG (que nunca tuvo el bug). **Hallazgo de paso, sin tocar**
(fuera de alcance): `tbl-wrap` (usado en 3 páginas del sitio) es una clase FANTASMA — no está
definida en `globals.css`, esas tablas nunca tuvieron scroll horizontal real en mobile pese al
nombre; esta sesión usó la clase que sí existe (`.table-scroll`) en la página nueva.

**Decisión: sin recorte automático de contenido si la placa supera 1 página.** El prompt preveía
un "orden de recorte" (condicionales → noticias → agenda) pero implementarlo requeriría lógica
condicional de renderizado por altura estimada, con riesgo real de dejar la placa con huecos. Con
datos reales de hoy (sin color cargado) la placa mide ~1,7 páginas — dentro del tope duro de 2.
Documentado en la skill en vez de construir algo sin un caso real que lo dispare para validar.

**Verificado**: lint/tsc/**476 tests** (5 nuevos)/build ✅ · `npm run start` con datos reales de
producción (`/api/informes/datos`, la plantilla y la página web, los 3 con 200 y datos reales:
pizarra real de soja, top3 con posiciones reales, TNA implícita real) · Playwright real (capturas
antes/después del fix de overlap, mobile 390px sin scroll horizontal) · **fila de prueba real
insertada y BORRADA al terminar** (fecha `2099-01-01`, patrón ya usado en sesiones anteriores):
confirmado que los 4 campos nuevos de prosa (`pizarraEstimada`/`volumenFisico`/
`condicionalDjve`/`condicionalCamiones`) renderizan correctamente en la placa Y en la página web,
sin residuo en producción.

**Pendiente (no bloquea)**: `INFORME_SHARE_SECRET` real sigue sin cargarse en Vercel/Routines
(mismo pendiente de E1) — sin él la nota 1-tap y el link público quedan honestamente cerrados,
no rotos · el `tbl-wrap` fantasma (3 páginas) queda para una sesión de limpieza chica · primera
corrida real de la Routine diaria con el formato nuevo, el próximo día hábil post-merge.
**Próximo paso: E4 (semanal v3) y E5 (view v3), paralelizables** (ya no dependen de nada más).
Detalle: [`sesiones/2026-08-04-e3-informe-diario.md`](sesiones/2026-08-04-e3-informe-diario.md).

## Anterior (04/08/2026 — 📰 E2 de PLAN INFORMES V3: skill + calendario + scorecard de interpretaciones — falta confirmar la Routine)

**📰 E2 — SKILL + CALENDARIO + SCORECARD DE INTERPRETACIONES — CÓDIGO HECHO Y VERIFICADO, falta
confirmar la Routine — rama `claude/plan-informes-v3-migrations-wql0sz`, PR #134 (mergeado).**
Ejecuta el PROMPT E2 de `PLAN_INFORMES_V3.md` §10 (requiere E1, mergeada el mismo día en el
PR #133). **Nota de proceso**: la conversación de esta sesión se perdió por un `/clear` a mitad
de trabajo — la sesión que retomó E1 volvió a arrancar con el contexto viejo, encontró el código
de E2 ya escrito en el disco (sin memoria de haberlo hecho), lo verificó desde cero (tsc/lint/
vitest/build) antes de commitear, y reconstruyó la bitácora leyendo el prompt + el diff en vez de
la conversación real (Lautoro confirmó que esa sesión perdida fue "solo construcción", sin
decisiones de negocio nuevas en el medio).

**Skill nueva `.claude/skills/interpretaciones/`** (procedimiento de 7 pasos, sucesora del Paso 9
de `informe-diario`): detección de informes de organismo nuevos + PAS zonas/condición + CFTC COT
+ USDA Export Sales (fetch-en-vivo) · redacción segmentada por grano con voz-lautaro + campo
`impacto` estructurado (3 estados) · auto-publicación al cierre 18:20 ART si Lautoro no la tocó
(N4, firma "Mesa ROFO AGRO" — escritura directa por service_role, no por la RPC que exige
`is_admin()`) · telemetría en `routine_runs` (N13) · `references/aprendizajes.md` propio para el
loop de calibración por diff (§9 del plan).

**`calendario.ts`**: evento USDA Export Sales nuevo (jueves 8:30 ET) · NOPA Crush Report por fin
genera eventos (estaba declarado en el tipo `Organismo` pero nunca disparaba) · `CONAB_2026` pasa
a `CONAB_FECHAS` por año con un centinela en tests (mismo patrón que `FERIADOS_AR`).

**`interpretaciones-scorecard.ts`** (N14, puro, 7 tests): mide `impacto` por grano contra
`futuros_cierres` a 7/14 días, reusando `elegirPosicionT0`/`medirVentana`/`esAcierto` de
`views-scorecard.ts`. `/admin/interpretaciones` suma la tarjeta de scorecard + columna Firma
(N19, personal vs. "Mesa ROFO AGRO (automática)").

**Verificado**: lint/tsc/**471 tests** (11 nuevos)/build ✅ (re-corrido desde cero antes de
commitear, no se confió en el estado de la sesión perdida).

**Quedó pendiente**: confirmar que la Routine "ROFO AGRO — Interpretaciones" existe de verdad
(`list_triggers` por MCP no se pudo correr — gate de permisos) — si no existe, el código está
listo pero no dispara solo. Primera corrida real contra un informe verdadero, para terminar la
verificación que el propio prompt E2 pedía. **Próximo paso: confirmar/crear la Routine → E3/E4/E5
en paralelo** (informe diario/semanal/view v3, prompts en `PLAN_INFORMES_V3.md` §10). Detalle:
[`sesiones/2026-08-04-e2-interpretaciones.md`](sesiones/2026-08-04-e2-interpretaciones.md).

## Anterior (04/08/2026 — 🧱 E1 de PLAN INFORMES V3 CERRADO: migraciones + libs + endpoints ampliados, migraciones APLICADAS y verificadas)

**🧱 E1 — DATOS E INFRAESTRUCTURA COMPARTIDA — HECHO DE PUNTA A PUNTA, migraciones
aplicadas — rama `claude/plan-informes-v3-migrations-wql0sz`, PR #133.** Ejecuta el
PROMPT E1 de `PLAN_INFORMES_V3.md` §10 (primera etapa de C30, el plan cerrado el mismo día):
migraciones + libs puras + endpoints ampliados + admin — CERO cambios de skills/plantillas
(eso es E2-E5).

**Migraciones (5, versionadas, escritas — ver "Quedó pendiente" abajo)**:
`20260804120000_e1_views_mercado_5_estados` (CHECK de `direccion` resuelto por catálogo, no
hardcodeado, pasa de 3 a 5 estados) · `20260804120100_e1_interpretaciones_v3` (`+impacto` jsonb ·
`+auto_publicado` · `+nota` · `+borrador_original_md` con backfill de las filas existentes) ·
`20260804120200_e1_informes_generados_feedback` (`+nota` · `+feedback` + RPC
`admin_feedback_informe`, mismo patrón que `admin_feedback_view`) ·
`20260804120300_e1_mesa_color_chicago_bcr` (`+chicago_bcr` + RPC `admin_upsert_mesa_color`
extendida con el 3er parámetro opcional) · `20260804120400_e1_routine_runs` (tabla nueva,
RLS solo-admin, escritura service_role).

**Libs nuevas**: `src/lib/informe-v3-calc.ts` (PURO, 22 tests) — `calcularDeltaSerie` (Δ vs N
días atrás por fecha-más-cercana, generaliza "Δ diario" y "Δ semanal") · `elegirTop3PorVolumen` ·
`sumaVentana` (ventana semanal genérica, reusada por BCRA y camiones) · `volumenPorUnderlying`
(últimas 5 ruedas POR GRANO, no global — bug real encontrado y corregido en el primer intento,
con test que lo prueba) · `calcularDesacople` (premio/descuento A3 vs CBOT). Wrappers
`server-only`: `variacionDiariaPizarra()` (`informe-diario-datos.ts`) ·
`top3PorVolumenDelDia()` (`a3-live.ts` — **decisión de diseño**: reusa el `LA`/`TV` YA
VERIFICADOS del WS de A3 en vez de sumar una entrada `SE` nueva sin probar, que el propio plan
marcaba como "a verificar"; post-rueda el último operado ES el cierre del día, y
`futuros_cierres` a esa hora todavía tiene el cierre de AYER — exactamente la línea de base que
hace falta para el Δ%, per N11) · `getVolumenA3Semanal`/`getDesacopleLocal`/`getZonaPrecio`
(`informe-semanal.ts`) · `getVariacionSemanalMacro` (`monitor-mercados.ts`, serie histórica
nueva del spark de Yahoo, separada del snapshot que ya usaba `/granos`) ·
`acumuladoSemanalBcra` (`bcra-mulc.ts`) · `getCamionesSemana` (`camiones/semanal.ts`, agrega
Williams+Agroentregas SIN mezclarlos) · `getPasZonasInforme`/`getPasCondicionInforme`
(**bug evitado, no solo corregido**: `getPasZonas()`/`getPasCondicion()` existentes usan el
cliente SSR con sesión — en una ruta autenticada por token, sin cookies, hubieran devuelto
vacío en silencio; las nuevas usan `sbSelect`/`sbSelectAll` con la service key, mismo criterio
que `getViewMercadoVigentePorGrano`) · `getNoticiasSemana` (`noticias.ts`, TODAS las noticias
de 7 días sin cap, separado del resumen curado del panel público) · `getNoticias(horasVentana)`
(parámetro nuevo opcional, default intacto).

**Endpoints (aditivos, cero campo removido)**: `/api/informes/datos` diario suma
`volumenCambiario`/`djveResumen`/`camionesPlantas`/`variacionPizarra`/`top3PorGrano`/
`chicagoBcr` (de `mesa_color`)/agenda a 7 días/noticias con ventana 24hs; semanal suma
`diariosSemana`/`interpretacionesSemana`/`noticiasSemana`/`djveResumen`/`camionesSemana`/
`dolarLinked`/`arbitrajes`/`volatilidadDolar`/`comprasBcraSemana`/`pasZonas`/`pasCondicion`/
`volumenA3Semanal`/`variacionMacro` + **ancla al último semanal ENVIADO** (reemplaza el fijo
−7d: si un viernes no salió, la ventana se ensancha sola). `/api/views/insumos` suma
`camiones`/`camionesPlantas` completos (antes solo la señal destilada), `djveResumen`,
`pasZonas`/`pasCondicion`, `noticiasSemana`, `diariosSemana`/`interpretacionesSemana`,
`viewsVigentes` (de los otros granos), `variacionGranos`/`variacionChicago`/
`variacionPizarraSemanal`, `volumenA3Semanal`, `desacopleLocal`, `zonaPrecio`.

**Admin/web**: segundo textarea "Contexto Chicago (BCR)" en `/admin/datos/mesa-color` (mismo
candado 🔒) · mini-form de nota 1-5 + feedback por informe en `/informes`, **visible solo
admin** (`getAcceso()` sin gatear por `AUTH_ENFORCED` — el login de Lautoro ya funciona siempre,
igual que `requireAdmin()`; la página ya era 100% dinámica por sus queries `revalidate=0`, así
que leer la sesión acá no le resta nada de ISR que no tuviera) · componente compartido
`ImpactoBadges` (`src/components/impacto-badges.tsx`) cableado en admin/interpretaciones,
`/produccion` y `/informes` (la 4ª superficie, la placa del diario, la cablea E3).

**Unificación + nota 1-tap + backtest**: `getInformesHoy` de `informe-diario-datos.ts` (usada
por las plantillas) ahora también mira `actualizado_en`, igualando el criterio que
`/api/informes/datos` ya tenía desde V2 (las dos habían divergido) · endpoint nuevo
`GET /api/informes/nota?id=&n=&t=` (HMAC `INFORME_SHARE_SECRET`, timing-safe, escribe con la
service key directo — no por RPC, no hay sesión en un click de mail; filtra `estado=eq.enviado`)
· `scripts/backtest-umbrales-informes.mjs` corrido de verdad contra 90 días reales de
producción: **las 4 reglas propuestas en el plan (§5.3/§6.2) caen dentro de la banda 1-3
disparos/semana en el primer intento** — DJVE 1,62/sem · camiones (solo la pata día-a-día)
2,04/sem · otros mercados diario 0,84/sem · commodities semanal 1,41/sem. Sin cambios a los
valores del plan: quedan validados tal cual.

**Verificado**: lint/tsc/**460 tests** (22 nuevos)/build ✅ · **los 2 endpoints probados en vivo
con `curl` contra la base de PRODUCCIÓN real** (`INFORME_TOKEN` del entorno) — los 30 campos
nuevos entre los 2 endpoints responden con datos reales y plausibles (`pasZonas` 1837 filas/
`pasCondicion` 1872 — coincide exacto con el historial documentado de C23/C27; `desacopleLocal`
con premios/descuentos con signo correcto por grano; `zonaPrecio` con percentiles 20-85%) ·
degradación honesta confirmada EN VIVO mientras las migraciones no estaban aplicadas (los
endpoints devolvían 200 igual, con los campos nuevos en `null`/`[]`/vacío, `42703 column does
not exist` confirmado por `curl` directo a PostgREST, nunca un 500) · endpoint de nota 1-tap
probado en sus 2 caminos de rechazo (firma inválida → 400; columna inexistente → 502 honesto) ·
bypass temporal de `requireAdmin()`/`esAdminUser` para confirmar que `/admin/*` en este sandbox
falla por una causa **ajena a esta sesión** (falta `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY` en el
entorno) — revertido, `git diff` limpio.

**Las 5 migraciones — APLICADAS (mismo día, con Lautoro).** `apply_migration`/`get_advisors`
del MCP de Supabase devolvieron `requires approval` en todos los intentos (gate del lado del
cliente, nunca se destrabó) → **Lautoro las corrió a mano, una por una, guiado paso a paso en
el chat, en el SQL Editor de Supabase** — las 5 dieron "Success". Verificado después por
`execute_sql` (esa sí funcionó): las 4 columnas de `interpretaciones` + las 2 de
`informes_generados` + `chicago_bcr` de `mesa_color` existen, el CHECK de
`views_mercado.direccion` tiene los 5 estados, `admin_upsert_mesa_color` quedó con una sola
versión limpia (3 parámetros), `routine_runs` existe con RLS activa y su policy de solo-admin.
**RLS confirmada por SQL**: `admin_feedback_informe`/`admin_upsert_mesa_color` con
`security definer`+`search_path` fijo, EXECUTE solo `authenticated`/`service_role` (nunca
`anon`); los grants "de más" a nivel tabla en `routine_runs` (`authenticated` con INSERT/
UPDATE/DELETE) son el MISMO patrón preexistente de default privileges que ya tienen
`views_mercado`/`mesa_color`/`informes_generados` — RLS sin policy de escritura es lo que
bloquea de verdad, confirmado comparando las 4 tablas. **Link de nota 1-tap probado de punta a
punta**: contra un informe real (`estado=enviado`), con secret de prueba, dio "¡Gracias!" 200 y
grabó `nota=5` en la fila real — verificado por SQL y limpiado al toque (no queda dato falso en
producción).

**Sigue pendiente (menor, no bloquea)**: cargar `INFORME_SHARE_SECRET` real en Vercel + el
entorno de las Routines (hoy nadie lo configuró, solo se usó un valor de prueba local nunca
guardado) · ver `/admin/datos/mesa-color`/`/admin/interpretaciones` renderizados con datos
reales en un navegador (este sandbox no tiene `NEXT_PUBLIC_SUPABASE_*`). **Próximo paso: E2**
(skill + Routine de interpretaciones, prompt en `PLAN_INFORMES_V3.md` §10) — depende de que
este PR mergee. Detalle:
[`sesiones/2026-08-04-e1-datos-infraestructura.md`](sesiones/2026-08-04-e1-datos-infraestructura.md).

## Anterior (04/08/2026 — 📐 PLAN INFORMES V3 cerrado: el Word de Lautaro sobre los 4 productos de research)

**📐 C30 — PLAN INFORMES V3 — PLAN CERRADO, SOLO DOCS — rama `claude/reportes-skills-voz-i71jlw`,
PR #_.** Lautaro entregó un Word ("INFORMES") con los requisitos de los 4 productos —
informe diario · informe semanal · view · interpretaciones — y pidió: relevar lo ya hecho sin
tirar nada, sumar lo del Word, un skill + una Routine por producto (todos con `voz-lautaro`),
retroalimentación donde se pueda, no repetir entre informes, y los DATOS explícitos por informe
(lo visual lo trabaja él aparte). **Relevamiento profundo con 7 agentes en paralelo** (los 4
pipelines con gap-analysis contra el Word · mapa de datos con ruta exacta de cada lib · decisiones
vigentes de V1/V2 · auditoría de las 3 Routines REALES por MCP). **Entregable:
[`PLAN_INFORMES_V3.md`](PLAN_INFORMES_V3.md)** — Word transcripto fiel (§1.1) · roles y nutrición
anti-duplicación (§4: interpretaciones=el evento · diario=la rueda · view=la dirección ·
semanal=la síntesis que LEE a los otros tres) · decisiones N1-N10 (§3) · datos campo por campo
por informe (§5-§8) · feedback para los 4 (§9) · **6 prompts autocontenidos E1→E6 para builds con
Sonnet** (§10). Auditado adversarialmente antes de commitear.

**Las 4 decisiones que contestó Lautaro en la sesión**: carga diaria sigue TEXTO LIBRE (la
variación de la pizarra estimada se calcula contra el último valor del cron; falta alguno → no se
calcula) · interpretaciones se **AUTO-PUBLICAN** tras unas horas sin tocar (revoca "firma nunca
sin OK" SOLO para interpretaciones; propuesta: cierre 18:20 ART) · diario = PNG + **versión web
con link** (E3 construye gate por sección Y link firmado, él elige) · alcance de interpretaciones
ampliado a PAS zonas/condición + CFTC COT + USDA Export Sales (fetch-en-vivo, sin ingesta nueva).
**Del Word además**: semanal SIN límite de páginas (revoca las 5 duras de V2 §10.3) · view con
**5 estados** (± levemente) · diario/semanal por producto SOJA→MAÍZ→TRIGO con local/internacional
separados · regla "sin internals" (percentiles → tendencias en lo que sale a clientes) ·
interpretaciones pasa de Paso 9 del diario a **rutina propia** diaria con calendario y
auto-reprogramación horaria.

**Hallazgos del relevamiento que las builds tienen que saber**: las 3 Routines siguen con nombre
"RF AGRO" y prompt citando el repo viejo (funcionan por el `job_config`) · la del view no avisa
por mail ante falla · no existe Routine de interpretaciones · el feedback del view (nota 1-5 +
scorecard + aprendizajes) está construido y **nunca usado** (0 notas) · la plantilla del diario
duplica queries del API con un criterio distinto de "informe de hoy" (fix en E1) · GEA/DEA
ingestan 22:16 → su interpretación hoy sale un día tarde (lo ataca la rutina propia de E2).

**Revisión objetiva post-plan (misma sesión, pedida por Lautaro) — TODA APROBADA E INTEGRADA
al plan como N11-N20.** Hallazgo mayor verificado contra los workflows: `ingest-cierres` corre
20:08 ART y el diario 18:30 → los bloques A3 EOD se armaban con la rueda de AYER. **N11 (definida
por Lautaro): los futuros locales diarios salen del WEBSOCKET de A3** (volúmenes + ajuste; CEM
como histórico, chequear su timing como secundario). El resto lo aprobó en bloque: **N12** semanal
19:00→**20:30 ART** (la semana incluye el viernes) · **N13** telemetría de Routines
(`routine_runs`) + watchdog "no salió el informe" · **N14** scorecard de interpretaciones
(impacto vs precio a 7/14d) · **N15** nota 1-tap desde el mail + eco de lo entendido del color ·
**N16** backtest de umbrales contra 90 días reales · **N17** PNG 1 página + web completa ·
**N18** banco de oro de prosa · **N19** firma "Mesa ROFO AGRO" en auto-publicadas · **N20**
spikes de datos al backlog derivado (§13 del plan) · E3/E4/E5 paralelizables.

**Verificado**: lint/tsc/**445 tests**/build ✅ (diff solo docs). **Próximo paso: ejecutar
E1→E6 con Sonnet** (prompts en `PLAN_INFORMES_V3.md` §10; E1 = migraciones+libs+endpoints, con
OK de Lautaro para aplicar las migraciones). Registrado como **C30** en el backlog maestro.
Detalle: [`sesiones/2026-08-04-plan-informes-v3.md`](sesiones/2026-08-04-plan-informes-v3.md).

## Anterior (03/08/2026 — 🚨 diagnóstico de ingestas/checks + 🗒️ /admin/checklist nuevo: "qué tengo que hacer hoy")

**🚨 DIAGNÓSTICO DE INGESTAS Y CHECKS — HECHO — rama `claude/ingestas-checks-diagnostico-zzk9es`,
PR #_.** Lautaro pidió revisar de punta a punta qué ingestas/checks están corriendo bien, cuáles no,
cuáles atrasadas — disparado por 2 mails reales de alerta en vivo durante la sesión ("Ingesta
line-up buques en ROJO" y "Healthcheck de frescura en ROJO"). 3 hallazgos, cada uno tratado distinto
según si era un bug real o una señal correcta:

1. **Bug real de producción, arreglado y desplegado en caliente**: la migración de esta misma mañana
   a las keys nuevas de Supabase (`sb_publishable_`/`sb_secret_`, `PRELAUNCH_CHECKLIST.md`) se había
   verificado contra PostgREST directo pero no contra los 2 Edge Functions con auth casero
   (`lineup-ingest`/`dea-fetch`, decodifican el bearer como JWT y exigen `role=service_role`) — la key
   nueva no es un JWT → 403 `forbidden` con la key real. Fix: aceptar el secret key nuevo por prefijo
   ANTES del decode JWT (que sigue sirviendo para la key legacy). **Desplegado por MCP** (`lineup-ingest`
   v8, `dea-fetch` v4) y **verificado en producción**: reintento del run que había fallado → `success`.
2. **Bug real recurrente, arreglado (cron)**: `ingest-camiones-agroentregas` fallaba TODAS las noches
   — su 2º cron, agendado en punto (":00", el minuto más congestionado de GitHub Actions, medido con
   hasta 3,5h de atraso real), cruzaba la medianoche ART y pegaba contra la colección "de hoy" de
   Agroentregas todavía vacía. Sin pérdida de datos (la corrida de las 18:00 ya guardaba un valor
   razonable, por diseño) pero con mail de alerta falso cada noche. Fix: 2º cron adelantado a 20:18
   ART + **los 16 workflows del repo sacados del minuto ":00"** (mismo criterio que ya usaba
   `ingest-noticias.yml`, generalizado).
3. **CONAB atrasado en el healthcheck — confirmado NO ES un bug**: bajado el TXT real de CONAB en
   vivo, la campaña 2025/26 sigue clavada en el 9º levantamento (verificado a mano) — atraso genuino
   de la fuente, el healthcheck está midiendo bien. Sin cambios de código ni de umbral.

**Verificado**: lint/tsc/**434 tests**/build ✅ (16 YAML de workflows + 2 Edge Functions tocados) ·
fix de los Edge Functions confirmado en producción real (rerun del run fallido → success) · contenido
desplegado releído con `get_edge_function` y comparado byte a byte contra el repo (el primer intento
de deploy mandó placeholder por error propio, corregido 1 min después) · CONAB verificado bajando la
fuente real en la sesión.

**🗒️ Follow-up mismo PR: `/admin/checklist` nuevo — "qué tengo que hacer hoy".** Lautaro pidió que
el admin muestre bien separado y visual qué se rompió/atrasó/falta cargar, con un checklist diario
propio (ejemplo suyo: *"vengo mañana martes y tengo un checklist: hoy tengo que cargar tal y
tal"*). Página nueva `/admin/checklist` (tab nuevo en `AdminTabs`, sin badge — calcularlo pegaría
contra Supabase/GitHub en cada página del panel), reusa 100% el motor de `/admin/conexiones`
(`getCargasManuales`/`getFrescura`/`getGithubRuns`/`getRoutines`) reagrupado por urgencia: 🔴 Se
rompió · 🟣 No se generó (Routine) · 🟠 Tenés que cargar algo (con botón directo) · 🟡 Atrasado por
la fuente (informativo, el caso CONAB) · banner verde si no hay nada. `/admin/conexiones` sigue
siendo el inventario completo, ahora cruza-linkeado con el checklist. Refactor de paso:
`estadoWorkflow()`/`chip()`/`fmtFecha` salieron de `conexiones/page.tsx` a
`src/lib/monitoreo/workflow-estado.ts` (+11 tests nuevos) + `fmt.ts` + `components/admin-chip.tsx`,
para que las dos páginas los reusen. **Bug real encontrado por la propia verificación visual**: el
mapa `RESOLVERS` de `manual.ts` nunca tuvo entradas para `pas-zonas`/`pas-condicion` (agregadas en
C23/C27, 29/07) → mostraban siempre "atrasado" pese a estar frescas — mismo bug ya escondido en la
tabla larga de `/admin/conexiones`, invisible hasta que el checklist lo puso arriba de todo.
Arreglado con 2 resolvers nuevos. **Verificado con Playwright real** (datos de Supabase del
entorno, claro/oscuro con el toggle real, bypass temporal de `requireAdmin()`/el proxy revertido,
`git diff` limpio): capturas antes/después del fix de `manual.ts` (bajó de 7 a 5 ítems pendientes),
el balde "Se rompió" con exactamente 1 ítem (CONAB, coincide con el healthcheck real de la sesión).
lint/tsc/**445 tests**/build ✅. Detalle completo (los 2 hallazgos, en un solo archivo):
[`sesiones/2026-08-03-diagnostico-ingestas-checks.md`](sesiones/2026-08-03-diagnostico-ingestas-checks.md).

**🎉 Follow-up post-cierre: `dea-fetch` confirmado con un run real — y la fuente DEA volvió a
responder.** El fix del punto 1 quedó sin un caller real que lo probara (su único disparo es
`dea_probe`, manual). Disparado por MCP (`workflow_dispatch`, sin pedirle nada a Lautaro — no
corre procesos a mano) para no dejarlo sin confirmar: **corrió en éxito, de punta a punta** — no
solo pasó el auth (sin 403), sino que **la fuente `datosestimaciones.magyp.gob.ar` respondió de
verdad** (bloqueada por IP desde el 22/07, ver lote L5 más abajo) y se subieron **24 filas reales**
(soja/maíz/cebada/girasol, campañas 2024/25 y 2025/26) a `estimaciones_produccion`, verificadas
por SQL. No se sabe si el bloqueo se levantó de forma permanente o fue una ventana — pero el
healthcheck de DEA debería salir en verde en la próxima corrida por esto solo, sin que Lautaro
tenga que cargar nada.

**Cron de DEA reactivado (mismo día, con OK explícito de Lautaro).** Preguntado si convenía
esperar más corridas de prueba o reactivar ya el cron semanal — eligió reactivar. DEA vuelve a
correr junto con GEA los miércoles (antes solo dispatch-only desde el 22/07); si el bloqueo
vuelve, el guard anti-0-filas + el mail de alerta avisan, y la carga manual en `/admin/datos/dea`
sigue como respaldo (marcada como tal en el catálogo de monitoreo, ya no como vía primaria).
lint/tsc/**445 tests**/build ✅.

## Anterior (03/08/2026 — 🗂️ /admin/datos: una página por carga manual)

**🗂️ /ADMIN/DATOS — UNA PÁGINA POR CARGA MANUAL — HECHO — rama
`claude/admin-datos-vistas-separadas-ydr35o`, PR #_.** Lautaro pidió separar `/admin/datos` (un solo
`page.tsx` largo con las 9 cargas manuales apiladas por anclas — Agrochat, camiones, "datos del
día", compras BCRA manual, DEA, PAS, PAS-zonas, PAS-condición, LECAP) en **vistas propias, una por
carga**. Partido en 9 páginas (`src/app/admin/datos/<slug>/page.tsx`) + un **índice** con tarjetas
que linkean a cada una + **sub-pestañas** en píldora (`datos-nav.tsx`, nuevo, mismo patrón que
`AdminTabs` de `/admin`) para moverse entre ellas sin volver al índice. `secciones.ts` (metadata
compartida por el índice y la nav) y `data.ts` (`server-only`, las 3 queries de Supabase que antes
vivían todas juntas — historial de "Datos del día", huecos de compras BCRA, LECAP actuales — ahora
una función por página, sin duplicar). Actualizados los 3 lugares que apuntaban a las anclas viejas
(`src/lib/monitoreo/catalogo.ts` → `/admin/conexiones`, y los 2 paneles de `/produccion/{zonas,
condicion}` que linkeaban a `#pas-zonas`/`#pas-condicion`) + 3 `revalidatePath` apuntados a su
página nueva en vez de a toda `/admin/datos`.

**Verificado**: lint/tsc/**434 tests**/build ✅ · `npm run start` + `curl` real contra las 10 rutas
(bypass temporal de `requireAdmin()` + el gate de sesión del proxy, revertido con `git checkout --`
al terminar — `git diff` limpio): las 9 subpáginas + el índice devuelven 200 con el título
correcto, la sub-nav marca el activo bien en ambos niveles, y las 3 páginas con datos reales
(mesa-color/bcra-manual/lecap) renderizan desde Supabase. Detalle:
[`sesiones/2026-08-03-admin-datos-vistas-separadas.md`](sesiones/2026-08-03-admin-datos-vistas-separadas.md).

## Anterior (03/08/2026 — 🔒 C29 CERRADO de punta a punta: los 5 últimos ítems opcionales del checklist de pre-lanzamiento)

**🔒 C29 — CIERRE DE LOS 5 ÍTIMOS ÍTEMS OPCIONALES DEL CHECKLIST DE PRE-LANZAMIENTO — HECHO —
rama `claude/backlog-pendiente-x81f9p` (reiniciada desde `main` — el corte anterior de esta misma
rama, PR #122, ya estaba mergeado por squash), PR #_.** Lautaro pidió "resolvamos esto" sobre los
5 ítems que quedaban sin tildar en [`PRELAUNCH_CHECKLIST.md`](PRELAUNCH_CHECKLIST.md) — todos
opcionales/bajo impacto, sin ninguna decisión suya pendiente.
**Fase 0 — hook de lint**: `.claude/settings.json` nuevo (no existía ningún hook en el repo),
`PostToolUse` en `Edit|Write` que corre `eslint` solo sobre el archivo `.ts`/`.tsx` tocado, **no
bloqueante** a propósito (el CI sigue siendo el único gate real; esto da feedback más rápido
dentro de la sesión). **Fase S — `/security-review`**: corrido de verdad por primera vez contra
un diff real (el de esta misma sesión) — sin hallazgos. **Fase 1 — property-based tests**:
`fast-check` (única dependencia nueva, solo test) + `src/lib/invariantes.property.test.ts` — TEA≥
TNA (Bernoulli, días≤365) y spread/pase antisimétrico (protege el bug de signo de `pases.ts` del
29/07). **Fase 2 — semáforo de antigüedad**: `FrescuraDot` (`src/components/frescura-dot.tsx`,
client, tick cada 15s) + prop opcional `revalidateSeg` en `SourceStamp` — verde/ámbar/rojo según
el reloj del navegador, umbral relativo al ISR de cada página (2x/6x), cableado en granos (30s) y
dólar (60s), cero cambio donde no se pasa la prop. **Fase 5 — smoke test k6**: `scripts/k6-smoke.js`
(5 VUs×1min, p95<500ms, error<1%, solo rutas públicas de verdad) — no entra a CI (decisión ya
tomada: load testing formal descartado para esta escala), queda disponible para correr a mano.

**Verificado**: lint/tsc/**434 tests** (426+4 property+4 frescura-dot)/build ✅ en cada commit ·
Playwright real (claro/oscuro, sin errores de consola/hidratación) — el punto de frescura salió
rojo en la primera prueba porque el dato real de mercado llevaba >6× el revalidate sin moverse,
confirmando que mide lo que dice medir · k6 real (binario `v0.54.0` descargado ad-hoc) corrido
contra el server local: 100% de los checks. **Con esto `PRELAUNCH_CHECKLIST.md` queda sin ningún
ítem `[ ]` real** (los `~~tachados~~` son decisiones explícitas de Lautaro de no hacer algo, no
pendientes). Detalle:
[`sesiones/2026-08-03-c29-cierre-fases-0-1-2-5.md`](sesiones/2026-08-03-c29-cierre-fases-0-1-2-5.md).

## Anterior (30/07/2026 — 📰 plantilla "Research" del informe diario — MERGEADA, PR #114)

**📰 PLANTILLA "RESEARCH" DEL INFORME DIARIO — reemplaza la placa vertical, wireada al skill
`informe-diario` — rama `claude/informe-research-p2-ynnz07`, PR #114 (mergeado — esta entrada
decía "SIN MERGEAR, falta el OK final" y quedó desactualizada desde que Lautaro lo mergeó;
corregido acá el 03/08 al pasar esta entrada a "Anterior").** Lautaro importó desde Claude Design un
mockup ("Informe Research P2" — one-pager tipo research de ALyC, paleta oscura, tesis del día + KPIs + 2
gráficos + franja de referencia + agenda), lo probó con el informe de un día real y confirmó: **reemplaza**
la placa vertical (no conviven las dos) — con una condición explícita: *"el informe debe seguir teniendo
la información de hoy, solo quiero que se modifique el formato"* → el layout nuevo suma TODO lo que la
placa vertical ya traía (noticias, BCRA, informe de organismos), no solo lo que el mockup original
mostraba.

**Build (2 vueltas, mismo PR)**: página **`/informes/plantilla/research`** (gate por `INFORME_TOKEN`,
igual que `/informes/plantilla/diario` — que queda en el repo SIN USARSE en el pipeline, no se borró) +
`src/lib/informe-research.ts` (desfasaje A3 vs Chicago, TNA implícita, "las tres cifras", franja de
referencia — aritmética pura, cero número inventado) + `src/components/informe-research-charts.tsx` (2
gráficos SVG genéricos) + **`src/lib/informe-diario-datos.ts` nueva** (extrae `getBorrador`/
`getInformesHoy`/`getInterpretaciones`/`getBcra`, que vivían duplicadas dentro de la placa vieja — ahora
las importan las DOS plantillas del mismo lugar) — la prosa (tesis + "lo que se lee acá") **sale del
borrador real de `informes_generados`** (ya no de un módulo estático, que se borró) + 3 secciones nuevas
para no perder nada de la placa actual (columna "Dólar" con spot MAE + BCRA en la franja de referencia,
que pasó a 4 columnas; "En la noticia"; "Informe del día"). **`.claude/skills/informe-diario/SKILL.md`
reescrito**: Paso 2 pide `tesisTitulo`/`tesisParrafo`/`lectura` (antes `titulo`/`comentario`/
`lineas_por_grano`) con las reglas de selección EXACTAS de `informe-research.ts` documentadas ahí (para
que la prosa cite los mismos números que van a salir en los gráficos); Paso 4 apunta a la plantilla nueva
(816×1056 @2x). Pasos 1 y 5-9 (fuente de datos, Storage, mail, marcar enviado) **sin tocar** — mismo
pipeline, misma cadencia, tal como pidió Lautaro.

**Corrección real encontrada verificando con datos en vivo**: la TNA implícita "de referencia" por grano
se había armado tomando la posición de MAYOR TNA — con el trigo real del 30/07 eso elegía SEP26 (55 días,
solo 11 lotes operados) con 41,74% TNA anualizando el mismo spread que DIC26 (144 días, 4.567 de interés
abierto) anualiza a 17,16% — un contrato ilíquido, no una tasa representativa. Se cambió el criterio a
**mayor interés abierto** (convención de mercado) antes de generar la placa final; documentado también en
el skill para que la prosa nunca la contradiga.

**Verificado con datos reales** (lint/tsc/build ✅ en las 2 vueltas): `npm run build && npm run start` con
las credenciales reales del entorno, `/informes/plantilla/research` sirviendo 200 con los datos en vivo,
cotejados contra `/api/informes/datos`. **Que la prosa realmente sale de la base**: insertada una fila de
prueba en `informes_generados` (fecha `2099-01-01`, claramente ajena a cualquier fecha real,
`estado=borrador`), screenshoteada con `?fecha=2099-01-01` — la prosa de prueba + las 3 secciones nuevas
salieron en el render, fila **borrada** al terminar. **Confirmado que la fila real de HOY (30/07,
`estado=enviado`, ya mandada por la Routine con el formato viejo) no se tocó** en ningún momento.
Screenshots reales enviados a Lautaro en las 2 vueltas.

**Próximo paso: el OK final de Lautaro para mergear el PR #114** — con el skill ya wireado, lo único que
falta es su confirmación de que el contenido/formato le sirve. Detalle:
[`sesiones/2026-07-30-plantilla-research-informe-diario.md`](sesiones/2026-07-30-plantilla-research-informe-diario.md).

## Anterior (última actualización: 01/08/2026 — 📊 migración de gráficos a ECharts, CERRADA — los 6 charts que faltaban + limpieza + Fase 4 verificada)

**📊 MIGRACIÓN DE GRÁFICOS A ECHARTS — CERRADA COMPLETA — rama `claude/echarts-migration-parte2`,
PR #_ (retoma el corte de Lautaro en PR #115, mergeado).** Pedido de Lautaro: "Continúa con los
que faltan con todos" — terminar el checklist que había quedado anotado la sesión anterior.
**Migrados los 6 charts restantes**: `empresas-histograma.tsx` (barra horizontal, antes CSS a
mano con `--gold` como fill) · `implicitas-chart.tsx` (line value/value, 4 series, antes 2 con hex
fijo incl. `--gold-text` como fill completo) · `bcra-mulc-chart.tsx` (barras `itemStyle` por punto
pos/neg) · `DeltaTnaChart` de `calc-fijar.tsx` (combo doble eje, patrón "1 acento + contexto") ·
`PayoffChart` de `calc-estrategias.tsx` (línea única + `markLine` precio base + `markPoint`
breakeven dorado) · **`spread-chart.tsx`** (el motor de `/graficos`, el más grande — 2 modos,
banda histórica con el truco ECharts de 2 series apiladas + relleno, tick de 2 líneas vía
`axisLabel.formatter` con `\n`, `endLabel` nativo reemplazando `LabelList`, tooltip 100% custom
con fecha por punto + resumen de banda, sin legend a propósito —nunca la tuvo, ni en la versión
Recharts—, `labelLayout:{hideOverlap,moveOverlap:'shiftY'}` agregado al ver en pantalla que el
modo Período con 14 líneas amontonaba los `endLabel`).
**2 bugs reales encontrados en charts YA migrados** (sesión anterior, antes de tocar nada nuevo):
`bcra-mulc-chart.tsx` pasaba el STRING literal `"var(--pos)"`/`"var(--neg)"` a `itemStyle.color`
— ECharts pinta en `<canvas>`, no resuelve custom properties de CSS ahí (por eso existe
`rofoTheme.ts` con hex copiados a mano) — bug silencioso, sin error visible, encontrado por
inspección de código; mismo problema con `fontFamily:"var(--font-mono)"` en un label de
`calc-estrategias.tsx`. Los dos arreglados.
**Limpieza final**: borrados `chart-svg-base.tsx` (motor SVG compartido, 0 importadores) y
`chart-marca.tsx` (watermark viejo, reemplazado por el `graphic` nativo de RfChart, 0
importadores) · `npm uninstall recharts` (0 imports en todo `src/`) · CSS huérfano de
`globals.css` limpiado clase por clase (`.cv-*`/`.ic-*`/`.evo-serie .evo-*`/`.dt-*`/
`.emp-histo*`/`.cm-marca*`/`.gx-tip*`), verificado 1 por 1 con grep antes de tocar — `.chart-wrap`/
`.chart-empty`/`.cv-legend` se dejaron (consumidores reales confirmados: RfChart mismo y la
leyenda manual de `dolar-futuro-panel.tsx`). **Fase 4 (tipografía mono en `ChartTabla`) verificada
SIN cambios de código**: la CSS de `.tbl`/`ChartTabla` (de la sesión del 20/07, previa a esta
migración) ya aplicaba mono a las celdas y UI/sans a los headers — exactamente el mismo criterio
que `RfChart` usa para `axisLabel` (mono) vs. `nameTextStyle` (UI) — confirmado con Playwright
comparando un chart y su tabla lado a lado.
**Verificado**: lint/tsc/build/**426 tests** verde en cada commit (3 commits) · Playwright real
claro/oscuro/mobile — incluye **hover real sobre el tooltip de `spread-chart.tsx`** (modo banda,
confirma header + fecha por punto + fila de banda) y el **antes/después de `labelLayout`** en modo
Período · bypass temporal de `esAdmin` en `/comercio/camiones` (revertido, `git diff` limpio).
**Con esto la migración de gráficos a ECharts pedida por Lautaro queda terminada de punta a
punta** — nada pendiente. Detalle completo:
[`sesiones/2026-08-01-echarts-migration-parte2.md`](sesiones/2026-08-01-echarts-migration-parte2.md)
(parte 1, el corte original: [`sesiones/2026-08-01-echarts-migration.md`](sesiones/2026-08-01-echarts-migration.md)).

## Anterior (31/07/2026 — 🔒 C29: auditoría de pre-lanzamiento, parte SEGURIDAD — hecha; 3 migraciones versionadas esperando el OK)

**🔒 C29 — AUDITORÍA DE PRE-LANZAMIENTO (PARTE 1: SEGURIDAD) — HECHA — rama
`claude/development-guidelines-k9firc`, PR #_.** Lautaro trajo **3 informes de research de
pre-lanzamiento** (metodología Claude Code · "cómo ejecutar sin romper nada" · 8 puntos
técnicos/legales) + sus 5 reglas duras de trabajo, y pidió auditar el proyecto contra ese
checklist **por partes, en Plan Mode**, empezando por seguridad (RLS · service key ·
`/security-review`), con hallazgo/gravedad/fix/riesgo por punto. **Auditado contra la base real
por SQL + advisors + grep de callers.** Resultado: **RLS activo en 24/24 tablas con policies
correctas** y **service key jamás en el cliente** (`server-only`, sin `NEXT_PUBLIC_`, sin `.env`
commiteado) — y 4 hallazgos: **S1 (importante-alto)** `lineup` + 5 vistas + 2 matviews de
densidad seguían legibles por anon (el remanente del cierre que E1 difirió "al prender el
login") · **S2 (importante)** `refresh_compras_avance()` ejecutable por anon (EXECUTE default a
PUBLIC sin revocar, misma clase que `ingest_cierres_cem` de E5) · **S3 (puede esperar)** EXECUTE
de anon sobrante en 10 RPC con guard · **S4** leaked password protection (ya diferida; la
resuelve Supabase Pro, que además destraba el crítico de la parte "backups": plan Free = sin
backup automático). **Entregables**: las 5 reglas duras persistidas en `CONTEXTO.md` § "Cómo
trabajar" + vitest sumado al protocolo pre-push de este archivo ·
**[`PRELAUNCH_CHECKLIST.md`](PRELAUNCH_CHECKLIST.md)** (checklist maestro de los 3 informes con
estado real, fases 0–7 — registrado como C29 en el backlog maestro) · **3 migraciones
versionadas SIN aplicar** (`20260731170000_s1` · `_170500_s2` · `_171000_s3`, con `is_admin()`
conservando authenticated y las trigger functions excluidas a propósito). `/security-review` no
corrió (revisa diffs de rama y la rama estaba limpia; queda para los PRs de fixes).

**Verificado**: lint/tsc/**426 tests**/build ✅ (diff docs+SQL, protocolo igual). **Próximo
paso**: OK de Lautaro → aplicar las 3 migraciones por MCP → verificar (advisors sin los WARN,
REST anon → denied, `/comercio/*` con datos en prod, login+/admin en Preview) → seguir con las
próximas partes del checklist (backups es el crítico abierto). Detalle:
[`sesiones/2026-07-31-auditoria-prelanzamiento.md`](sesiones/2026-07-31-auditoria-prelanzamiento.md).

## Anterior (30/07/2026 — ✅ C28 CERRADO: sintéticos (p34) + empresas 0 buques (p55) — el relevamiento web de 56 puntos queda completo)

**✅ C28 — CIERRE FINAL (sintéticos p34 + empresas 0 buques p55) — HECHO — rama
`claude/plan-desarrollo-auditoria-ka5hyk`, PR #_.** Lautaro terminó mergeando el PR #112 (los 10
lotes R1→R10) a `main` el mismo 30/07 — y contestó, en el mismo mensaje, las 2 preguntas de §5 de
`PLAN_RELEVAMIENTO_WEB.md` que seguían abiertas y gateaban los últimos 2 puntos del relevamiento.
**Sintéticos (p34, pregunta 3)**: Lautaro pasó las fórmulas exactas de su Excel — las 2 centrales
(sintético = spot×pagoFinal/px · directa = sintético/futuro−1) YA coincidían con lo implementado;
el fix real es la **anualización**: TNA por los días al vencimiento del **futuro** (no de la
letra — eran fechas distintas dentro del mismo mes, esa era la fuente del reclamo "está mal
calculada") + fecha de referencia que **no avanza sábado/domingo** (queda en viernes hasta el
lunes, `hoyOperativoMs()` nueva en `dates.ts`) + **una sola letra por mes** (la más cercana a fin
de mes, cuando 2+ empatan con la misma posición) + panel simplificado (sacadas TNA del futuro/
ventaja/mejor sintético, pedido explícito "solo la tasa del sintético"). Lo de "cotizaciones
congeladas al cierre, sin base de datos" ya estaba cumplido por diseño (sin tabla, últimos
valores de data912/MAE), sin cambios. **Empresas 0 buques (p55, pregunta 9)**: se sacan las que
no tienen NI buques NI declarado significativo — reusando `DECLARADO_MIN_SIGNIFICATIVO` (5.000 t,
constante ya existente en `cobertura.ts`, sin inventar un segundo umbral) — `src/lib/lineup/
empresas.ts`. **De paso**: `/produccion/zonas` (C23) confirmado por Lautaro ("ya están todas las
campañas") — verificado por SQL, `pas_zonas` 1.837 filas/27 campañas — y housekeeping de este
mismo archivo (la entrada de abajo seguía diciendo "Lautaro confirmó que NO va a mergear
todavía", desactualizada desde que mergeó).

**Verificado con datos reales** (lint/tsc/**426 tests**/build ✅ — 3 nuevos de `hoyOperativoMs` +
reescritos los de `emparejarSinteticos` — `npm run start` con `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`
reales del entorno): `/dolar/sinteticos` con 4 filas (una por mes), TNA descendente por plazo
(5,4%→3,6%, curva con forma sensata) · `/comercio/empresas` con **bypass temporal** de
`requireAdmin()` (revertido, `git diff` limpio): 15 empresas con 0 buques sobreviviendo el filtro,
todas con declarado ≥5.406 t (arriba del piso de 5.000 t), cero por debajo colándose.

**C14 (estrategias avanzadas) sigue explícitamente en pausa** — Lautaro: "la seguimos dejando
pendiente". **Con esto el relevamiento web de 56 puntos (C28) queda completo de punta a punta.**
Detalle: [`sesiones/2026-07-30-c28-cierre-sinteticos-empresas.md`](sesiones/2026-07-30-c28-cierre-sinteticos-empresas.md).

## Anterior (30/07/2026 — 🚢 C28/R10: comercio (puertos), HECHO — cierra el relevamiento web completo R1→R10)

**🚢 C28 — LOTE R10 (COMERCIO: PUERTOS) — HECHO, propuesta+capturas posteadas en el PR para el
OK de Lautoro — misma rama `claude/website-changes-review-ttqsq4`, PR #112 (sigue ampliándose —
R3/R4/R6/R2/R5/R7/R8/R9 seguían sin mergear al arrancar R10, ver bitácora; Lautaro confirmó otra
vez explícitamente que NO va a mergear todavía).** Ejecuta el prompt R10 de
`PLAN_RELEVAMIENTO_WEB.md` §3 (punto 54), rediseño de `/comercio/puertos` — **último lote del
orden del plan (R1→R3→R4→R6→R2→R5→R7→R8→R9→R10): el relevamiento de 56 puntos queda completo**,
salvo lo explícitamente gateado por preguntas de §5 sin contestar (sintéticos Q3/R6, empresas 0
buques Q9/R8).
**Este prompt pedía más que una maqueta**: *"Lautaro pidió explícito chequear redundancias y
preguntar ante dudas: antes de codear, armá la propuesta de layout... y pasásela por el PR"* —
se hizo el chequeo de redundancias POR ESCRITO antes de tocar código (¿`/comercio/empresas` de R8
se pisa con esto? No: una es cobertura estratégica acumulada vía DJVE, la otra es la foto
operativa de la última rueda — no se fusionaron entre sí) y luego se construyó + verificó,
documentando cada decisión con su razón. Detalle completo en la bitácora.
**Build**: tabla "Por producto" fusiona el bloque separado "Vs hace 7 días" (2 KPIs + lista aparte)
como una 2ª columna Δ semana — nada se pierde, mismo número, una tabla menos · **drill-down por
empresa** en "Por producto" Y "Por zona" (click en una fila → qué empresas la componen, máx un
desglose abierto a la vez) — resultó NO necesitar tocar `foto.ts`: `buques` ya traía producto+
zona+empresa+toneladas por fila, la agregación es aritmética de UI (`foto-empresas.ts` nuevo,
puro, 5 tests) · tabla de buques con **orden por defecto a ETB ascendente** (antes toneladas
desc) · **total por zona sobre el resultado filtrado** cuando el buscador (sin cambios) devuelve
algo — verificado con "CARGILL": 29 operaciones repartidas Up River Norte/Sur/Bahía Blanca con
sus propios totales, suma exacta.

**Verificado de punta a punta** (lint/tsc/**423 tests**/build ✅ — 5 nuevos de
`foto-empresas.test.ts` + Playwright real, claro/oscuro/desktop/mobile, bypass temporal de
`requireAdmin()` revertido — `git diff` limpio): drill-down de Soja suma exacto los 403.754 t de
la fila entre sus empresas · tabla de buques ETB 24/07→31/07 ascendente confirmado a ojo · cero
errores de consola/scroll horizontal en las 3 combinaciones.

**Próximo paso**: **el OK de Lautoro sobre R9 y R10** (ambos con maqueta/propuesta en el PR) —
con eso el relevamiento web completo queda cerrado de punta a punta. Detalle:
[`sesiones/2026-07-30-r10-puertos.md`](sesiones/2026-07-30-r10-puertos.md).

## Anterior (30/07/2026 — 🚚 C28/R9: comercio (camiones), HECHO — maqueta en el PR para el OK de Lautoro)

**🚚 C28 — LOTE R9 (COMERCIO: CAMIONES) — HECHO, capturas posteadas en el PR para el OK de
Lautoro — misma rama `claude/website-changes-review-ttqsq4`, PR #112 (sigue ampliándose —
R3/R4/R6/R2/R5/R7/R8 seguían sin mergear al arrancar R9, ver bitácora; Lautaro confirmó otra vez
explícitamente que NO va a mergear todavía, que siga avanzando con el plan).** Ejecuta el prompt
R9 de `PLAN_RELEVAMIENTO_WEB.md` §3 (punto 53), rediseño completo de `/comercio/camiones`.
**El propio prompt pide maqueta+OK de Lautoro ANTES de codear el layout final** (y la pregunta 10
de §5 sobre si ese esquema sirve sigue sin contestar) — se resolvió construyendo el rediseño
completo (la especificación del punto 53 ya describe el layout con precisión) y posteando las
capturas de la verificación como comentario en el PR #112, en vez de frenar a esperar una
aprobación síncrona que hoy no iba a llegar (Lautoro ya dijo varias veces que recién revisa mañana
desde la PC). Detalle completo de esa decisión en la bitácora.
**Build**: filtro de grano **transversal a toda la página** (chip bar nueva arriba de los 2
paneles) controla a la vez el chart "Por grano" de Agroentregas, sus KPIs, la tabla+histograma de
empresas, Y el chart de Williams · **Williams pasa de 2 charts a UNO solo** (`williams-chart.tsx`
nuevo): zonas todas/elegidas + **modo campaña** (reagrupa 2018→hoy por campaña del producto vía
`lineup/campanas.ts`, sin duplicar la regla de mes de arranque por grano — X = día de campaña,
líneas agregables/quitables, mismo lenguaje visual `--camp-{año}` que `/graficos`) · **5-6 KPIs
mantenidos** (total/día anterior/Δ día anterior/Δ semana/Δ interanual%/producto líder) recalculados
en vivo sobre la serie filtrada (`src/lib/camiones/matriz.ts` nuevo, puro, 10 tests) · **histograma
por empresa receptora** (`empresas-histograma.tsx`, barras a mano) + tabla de empresas filtrable
por grano y búsqueda (`empresas-tabla.tsx`) · **tablas colapsables, máx una abierta** (`ChartTabla`
sumó soporte opt-in `colapsable`/`abierta`/`onToggleAbierta`, sin tocar el default de los demás
consumidores) · sello "Agroentregas" fuera del panel (`SourceStamp` sumó `ocultarFuente` opt-in) ·
¿Qué es esto? de los 2 paneles + señal reescritos sin citar archivos del repo.
**Refactor de arquitectura**: `plantas-panel.tsx`/`camiones-panel.tsx` (2 Server Components async
independientes, no podían compartir estado de cliente) borrados — el fetch pasó a `page.tsx`,
`camiones-client.tsx` (nuevo) sostiene el filtro de grano + qué tabla está abierta para los 2
bloques a la vez.

**Verificado de punta a punta** (lint/tsc/**418 tests**/build ✅ — 10 nuevos de `matriz.test.ts` —
+ Playwright real contra `npm run start`, claro/oscuro/desktop/mobile con el toggle de tema real
clickeado, cero errores de consola/scroll horizontal): filtro de grano propagando a los 4 bloques
a la vez (Soja → Agroentregas 1.628, Williams 1.383, tabla "10 empresas con soja" 1:1 con el
histograma) · modo campaña con 3 líneas superpuestas (2026/27·2025/26·2024/25, eje MAR→FEB de la
campaña de maíz) · tabla colapsable abriendo/cerrando con el pivot correcto (90 filas, día de
campaña descendente) · **bypass temporal de `esAdmin`** (revertido, `git diff` limpio): empresa
por empresa igual en tabla e histograma, panel "Barcos vs camiones" sin regresión.

**Próximo paso**: **el OK de Lautoro sobre este layout** (capturas en el PR) → si aprueba, seguir
con **R10** (comercio: puertos, punto 54, último del orden R1→R3→R4→R6→R2→R5→R7→R8→R9→R10) — mismo
patrón de maqueta-primero, con el pedido explícito de Lautoro de chequear redundancias antes de
codear. Detalle: [`sesiones/2026-07-30-r9-camiones.md`](sesiones/2026-07-30-r9-camiones.md).

## Anterior (30/07/2026 — 🚢 C28/R8: comercio (DJVE+empresas), HECHO salvo 0-buques)

**🚢 C28 — LOTE R8 (COMERCIO: DJVE + EMPRESAS) — HECHO salvo un punto explícitamente pendiente —
misma rama `claude/website-changes-review-ttqsq4`, PR #112 (sigue ampliándose — R3/R4/R6/R2/R5/R7
seguían sin mergear al arrancar R8, ver bitácora; Lautaro confirmó otra vez explícitamente que NO
va a mergear todavía, que siga avanzando con el plan).** Ejecuta el prompt R8 de
`PLAN_RELEVAMIENTO_WEB.md` §3 (puntos 52 y 55).
**Build**: DJVE (`djve-panel.tsx`) reescrito para agrupar por **familia** (Maíz/Soja/Trigo/
Girasol/Cebada y malta/Otros — mapeo nuevo `src/lib/djve-familias.ts`, por palabra clave,
**verificado contra los 88 productos reales de `djve_resumen`** por SQL antes de codear), familias
**ordenadas por volumen** (Maíz 29,18 Mt → … → Otros 0,82 Mt, sorgo) · **fecha completa de última
actualización arriba** (helper nuevo `fechaHoraCordoba()`) · sacada la línea "N productos
ocultos". Empresas: **"Originado"→"Embarcado"** y **"Cobertura"→"Cumplimiento"** de punta a punta
(tabla de empresas, tabla por producto, KPI, headers del CSV) · **`ratioFmt` a % es-AR** (antes
ratio crudo `0.87`, ahora `87%` — función compartida, también mejora `/comercio/senal` sin tocar
sus etiquetas). **"Quitar empresas con 0 buques" queda EXPLÍCITAMENTE sin tocar**: gateado por la
pregunta 9 de §5, que sigue sin contestar — el resto del lote no dependía de esa respuesta.

**Verificado de punta a punta** (lint/tsc/**408 tests**/build ✅ — 6 nuevos de
`djve-familias.test.ts` + Playwright real, claro/oscuro/desktop/mobile, cero errores de
consola/scroll horizontal): DJVE con las 6 familias en el orden correcto por volumen (coincide
exacto con la consulta SQL directa) · Empresas con **bypass temporal** de `requireAdmin()`
(revertido, `git diff` limpio) mostrando "30% · cumplimiento global 60d" y los headers "Emb.
60d"/"Cump." — confirmado que las empresas con 0 buques siguen apareciendo (filtro gateado
intacto).

**Próximo paso**: seguir con **R9** (comercio: camiones) según el orden del plan
(R1→R3→R4→R6→R2→R5→R7→R8→R9→R10) — el prompt pide maqueta en el PR para el OK de Lautoro ANTES
de codear el layout final. Detalle:
[`sesiones/2026-07-30-r8-djve-empresas.md`](sesiones/2026-07-30-r8-djve-empresas.md).

## Anterior (30/07/2026 — 📊 C28/R7: gráficos + producción, HECHO)

**📊 C28 — LOTE R7 (GRÁFICOS + PRODUCCIÓN) — HECHO — misma rama `claude/website-changes-review-
ttqsq4`, PR #112 (sigue ampliándose — R3/R4/R6/R2/R5 seguían sin mergear al arrancar R7, ver
bitácora; Lautaro confirmó otra vez explícitamente que NO va a mergear todavía, que siga
avanzando con el plan).** Ejecuta el prompt R7 de `PLAN_RELEVAMIENTO_WEB.md` §3 (puntos 48–50).
**Build — Calendario (p49) y Estimaciones (p50)**: semántica de filtro invertida en los chips de
organismo/grano (antes click = EXCLUÍA; ahora click = deja SOLO ese, re-click = todos) ·
calendario acotado a **60 días** (antes fijo hasta fin de 2026) · estimaciones sumó **3 grupos de
chips nuevos** (organismo, país, campaña) con el mismo componente visual del grano, combinando
por AND.
**Build — `/graficos` (p48)**: default de campañas = **solo la última disponible** (antes `[]` ⇒
todas, compatibilidad con links viejos verificada) · **"Todas"/"Últ. 3" con toggle** (re-click
vuelve a dejar solo la última) · labels de `PRESETS_PIZARRA` corregidos a mayúscula ("Pizarra
Maíz/Soja/Trigo") · tabla de `spread-chart.tsx` **siempre descendente**, y en eje días-al-vto la
fila de **"hoy" recuadrada primera** (nueva prop opt-in `destacada` en `ChartTabla`) · **KPIs más
grandes y reubicados** entre el chart y su tabla (`SpreadChart` suma prop `kpis`) · **etiqueta de
campaña en el extremo de cada línea** (`LabelList`).
**2 bugs reales encontrados y arreglados en la propia verificación**: la etiqueta de campaña
quedaba cortada contra el borde del SVG (margen derecho insuficiente) · los botones nuevos
"Todas"/"Últ. 3" solo tenían `aria-pressed` sin la clase `.on` que el sitio usa para pintar el
estado activo — el toggle funcionaba pero era invisible.

**Verificado de punta a punta** (lint/tsc/**402 tests**/build ✅ + Playwright real contra
`npm run start`, claro/oscuro/desktop/mobile, cero errores de consola/scroll horizontal):
`/graficos` con el default nuevo (solo 2027 tildado), fila "hoy" recuadrada en dorado primera en
la tabla, etiqueta "2027" visible completa, toggle Todas/Últ.3 con estado visual correcto en
ambos sentidos · calendario con click-filtra-uno funcionando · estimaciones con 2 filtros
combinados (Soja+Argentina → 4 filas exactas).

**Próximo paso**: seguir con **R8** (comercio: DJVE + empresas) según el orden del plan
(R1→R3→R4→R6→R2→R5→R7→R8→R9→R10) — parcialmente gateado por la pregunta 9 de §5 (empresas con 0
buques), revisar si Lautoro la contestó. Detalle:
[`sesiones/2026-07-30-r7-graficos-produccion.md`](sesiones/2026-07-30-r7-graficos-produccion.md).

## Anterior (30/07/2026 — 📐 C28/R5: estrategias + planta, HECHO)

**📐 C28 — LOTE R5 (ESTRATEGIAS + PLANTA) — HECHO — misma rama `claude/website-changes-review-
ttqsq4`, PR #112 (sigue ampliándose — R3/R4/R6/R2 seguían sin mergear al arrancar R5, ver
bitácora; Lautaro confirmó otra vez explícitamente que NO va a mergear todavía, que siga
avanzando con el plan y que mañana desde la PC revisa todo junto).** Ejecuta el prompt R5 de
`PLAN_RELEVAMIENTO_WEB.md` §3 (puntos 45 y 47).
**Build — Planta (p47)**: patrón `precio-dual` (reusa R4) para el arranque · **secada no-fijo
real** (antes aplicaba UN valor a todos los puntos por igual; ahora un valor propio por cada
punto, desplegable dinámico según cuántos puntos se carguen) · **"otros conceptos" repetible con
+** (antes un solo campo fijo) · desglose de gastos en **tarjetas visuales** (`.plt-breakdown`,
antes lista de texto chico a la derecha) · **resultado en la moneda elegida** (toggle USD/$,
pesificando SIEMPRE con `tcBna`, no con el TC implícito del arranque).
**Build — Estrategias (p45)**: **glosario previo** colapsable (31 estrategias, nombre +
explicación) · **categorización propia de los 31 presets** (Alcistas/Bajistas/Techo
asegurado/Piso asegurado/Rango/Volatilidad, mapeo documentado en `estrategias.ts`) + selector
segmentado (reusa `RangoChips` de R6) · **`describirPata()` nueva** — "qué implica" cada pata
(comprás/vendés, futuro u opción, derecho vs. obligación) derivado de la pata real, no de texto
fijo → también funciona para **"estrategia personalizada"** (detectada comparando las patas
actuales contra las que generaría el preset) · explicación destacada (badge dorado) · resumen
**en línea y grande** (antes lista mono chica) · **precio base sugerido de A3** (`CurvaPicker`
nuevo, rearma las patas del preset sobre el precio real elegido) · **ejes del payoff con ticks y
valores** (antes el SVG no tenía ningún tick).
**Bug real encontrado y arreglado, no pedido explícitamente**: el `className="manual"` (azul =
editado a mano) se aplicaba en 4 calculadoras (`por-porcentaje`/`diferido`/`carry` de R4 +
`planta` ahora) sobre `.calc-field input`, pero la única regla CSS existente era
`.pz-input.manual` (scope de R3/arbitrajes) — nunca pintaba nada ahí. Una regla CSS nueva
(`.calc-field input.manual`) lo arregla en las 4 de una sola vez.

**Verificado de punta a punta** (lint/tsc/**402 tests**/build ✅ — 5 nuevos de `planta.test.ts` +
Playwright real contra `npm run start`, claro/oscuro/desktop/mobile, cero errores de
consola/scroll horizontal): Estrategias con el glosario expandido legible, chips de categoría
filtrando el select, editar una pata dispara "Estrategia personalizada" correctamente. Planta con
aritmética cruzada verificada a mano (secada no-fijo 6+5+4=15,00 exacto, no 3×algo único · otros
2+1,5=3,50 · arranque 300 − 23,90 gastos = 276,10 USD exacto · toggle a $ = 276,10×1.489,00 =
411.112,90 exacto, BNA real del entorno).

**Próximo paso**: seguir con **R7** según el orden del plan (R1→R3→R4→R6→R2→R5→R7→R8→R9→R10).
La aclaración de estética de R4 sigue sin llegar. Detalle:
[`sesiones/2026-07-30-r5-estrategias-planta.md`](sesiones/2026-07-30-r5-estrategias-planta.md).

## Anterior (30/07/2026 — 🏛️ C28/R2: landing, HECHO)

**🏛️ C28 — LOTE R2 (LANDING) — HECHO — misma rama `claude/website-changes-review-ttqsq4`,
PR #112 (sigue ampliándose — R3/R4/R6 seguían sin mergear al arrancar R2, ver bitácora; Lautaro
confirmó explícitamente que NO va a mergear todavía, que siga avanzando con el plan y que mañana
desde la PC revisa todo junto).** Ejecuta el prompt R2 de `PLAN_RELEVAMIENTO_WEB.md` §3 (puntos
1–12, todos en `/bienvenida`), con `ui-ux-pro-max` y `voz-lautaro` cargadas, copy **redactado**
(no copiado textual) donde Lautaro dio letra.
**Build**: hero con "comprar o vender" (antes solo "vender") + "Servicio a medida para
productores y acopios" pasó de texto apagado a **badge destacado** (píldora dorada) · las 6
tarjetas de Servicios reescritas para dar **indicios** en vez de listar funciones internas
literales · frase de cierre de Servicios ("no solo datos") destacada visualmente (bold, tamaño
grande) · Teaser sumó un **5º mock "Comercio exterior · Line-up de puertos"** (buques ficticios,
sin datos reales) · "Por qué ROFO AGRO" → **"¿Por qué ROFO AGRO?"** + diferencial de foco
redactado · Acopios sin "correacopio", nuevo heading **"Profesionalizá tu mesa de negocios"** +
copy con las 4 ideas dadas · FAQ corredor ampliada a **acopio/cooperativa/exportador/corredor** +
FAQ tiempo real con **"conectada a mercado real time" + "interpretada por nuestros
especialistas"** · contacto con heading **"Sumá toda nuestra experiencia a tu equipo"** + las 2
menciones de "tablero" DE ESA SECCIÓN (nota + link) pasadas a **"web"** (acotado a ese anclaje, sin
tocar el resto de las menciones de "tablero" de la landing) · cierre con **"equipo de
profesionales"** en vez de "mesa de granos".

**Verificado de punta a punta** (lint/tsc/**397 tests**/build ✅ + Playwright real contra
`npm run start`, claro/oscuro/desktop/mobile, `reducedMotion:"reduce"`, cero errores de
consola/scroll horizontal, capturas dirigidas del hero/teaser/servicios confirmando el badge, la
frase destacada y el mock nuevo). **Sin verificar**: a qué mail llega hoy el formulario de
contacto (`ADMIN_EMAILS` en Vercel) — el MCP de Vercel de este entorno no expone ningún tool para
leer env vars, y `get_runtime_logs` devolvió `ExceedsBillingLimitError` (logs gateados por el plan
del equipo); el código confirma que el destino es 100% esa env var y que degrada en silencio si
falta, pero el valor real solo lo puede confirmar Lautoro a mano en el dashboard de Vercel.

**Próximo paso**: seguir con **R5** según el orden del plan (R1→R3→R4→R6→R2→R5→R7→R8→R9→R10); las
preguntas 3/9/10 de §5 siguen abiertas y gatean partes de R5/R8. Detalle:
[`sesiones/2026-07-30-r2-landing.md`](sesiones/2026-07-30-r2-landing.md).

## Anterior (30/07/2026 — 💵 C28/R6: dólar, HECHO salvo p34)

**💵 C28 — LOTE R6 (DÓLAR) — HECHO salvo un punto explícitamente pendiente — misma rama
`claude/website-changes-review-ttqsq4`, PR #112 (sigue ampliándose — R3/R4 seguían sin mergear al
arrancar R6, ver bitácora).** Ejecuta el prompt R6 de `PLAN_RELEVAMIENTO_WEB.md` §3 (puntos 31–36,
todos en `/dolar/*`), arrancado directo tras el mensaje de Lautaro de seguir con lo que sigue
mientras él prepara la aclaración de estética de R4 desde la PC.
**Build**: `/dolar/futuro` sin la `ChartTabla` duplicada, tabla de posiciones primero y gráfico
más grande abajo (`.df-stack`) · **patrón 5-descendente + selector de rango** en los 5 charts del
punto 32 (`ChartTabla` sumó props opcionales `maxFilas`/`orden`, sin tocar los ~11 consumidores
que no los usan; `RangoChips` nuevo y genérico, cableado en oficial-semanal 12/26 sem. y BCRA
30/60/90 días) · "data912" fuera de los kickers de linked/implícitas (→ "Mercado de deuda local")
· **Implícitas con 4 series** (dólar futuro + linked + **sintéticos + granos**, ninguna
reemplazada; tabla se oculta sola si supera 30 filas) · **Cambiario**: `GRUPOS` a solo "Monedas"
(fuera Contado/Tasas) + **"Volumen dólar linked"** nuevo (suma del nominal `v` de TODOS los D* del
feed de notas, etiquetado honesto como "nominal" — NO es USD, verificado con `curl` real que su
magnitud es comparable a `q_bid`/`q_ask`, no a los USD de la tabla MAE) + texto técnico "BCRA API
v4 (variable 78…)" fuera del ¿Qué es esto? Y TAMBIÉN de la nota de la tabla del chart de BCRA
(mismo texto exacto, pero ahí estaba siempre visible sin colapsar — peor que el caso pedido).
**p34 (sintéticos) queda EXPLÍCITAMENTE sin tocar**: el propio prompt trae la regla dura de
validar la fórmula contra un ejemplo numérico del Excel de Lautaro ANTES de codear (pregunta 3 de
§5), que sigue sin contestar — el resto del lote no dependía de esa respuesta y se hizo completo.

**Verificado de punta a punta** (lint/tsc/**397 tests**/build ✅ + Playwright real contra
`npm run start`, claro/oscuro/desktop/mobile, `reducedMotion:"reduce"` para evitar falsos
positivos de la animación de entrada en cascada del rediseño premium, cero errores de
consola/scroll horizontal): futuro sin tabla duplicada · los 5 charts con 5 filas descendentes y
selector de rango funcionando (BCRA 179 M nominal de dólar linked coincide exacto con la suma
verificada por `curl` independiente al feed de data912) · implícitas con las 4 series en gráfico y
leyenda · cambiario con un solo grupo "Monedas" y ambos textos técnicos limpios (nota + ¿Qué es
esto?) · grep confirma cero "data912" visible en las páginas tocadas.

**Próximo paso**: seguir con **R2 (landing)** según el orden del plan (R1→R3→R4→R6→R2→R5→R7→R8→
R9→R10); p34 queda pendiente hasta que Lautaro conteste la pregunta 3 de §5 (ejemplo del Excel);
las preguntas 9/10 siguen abiertas y gatean partes de R2/R5/R8. La aclaración de estética de R4
que Lautaro prometió mandar desde la PC no llegó todavía durante esta sesión. Detalle:
[`sesiones/2026-07-30-r6-dolar.md`](sesiones/2026-07-30-r6-dolar.md).

## Anterior (30/07/2026 — 🧮 C28/R4: calculadoras, HECHO)

**🧮 C28 — LOTE R4 (CALCULADORAS: PATRÓN + 7) — HECHO — misma rama `claude/website-changes-
review-ttqsq4`, PR #112 (ampliado — R3 seguía sin mergear al arrancar R4, ver bitácora).**
Ejecuta el prompt R4 de `PLAN_RELEVAMIENTO_WEB.md` §3 (puntos 38–44), con las 2 preguntas que lo
gateaban contestadas por Lautaro: trigo a-fijar = **DIC/ENE/MAR/JUL/SEP** · costos oculta =
**sí, alcanza** (sin sidebar/índice + "sin acceso" en URL directa).
**Build**: patrón compartido **`precio-dual`** (`src/lib/precio-dual.ts` + `src/components/
precio-dual.tsx` — grano→pizarra, cross-cálculo $/USD, azul-manual, mismo criterio de TC que
Arbitrajes de R3) cableado en 5 calcs · **A fijar** con **posiciones canónicas por grano**
(`fijar-canon.ts`: nunca vencidas, máx. 1 año, Soja JUL/SEP/NOV/ENE/MAY · Maíz ABR/JUL/SEP/DIC/
ENE/MAR · Trigo DIC/ENE/MAR/JUL/SEP) + precio en vivo del WS con fallback "estimado" (promedio
bid/ask) + gráfico de TNA implícita separado del delta · **Por porcentaje** con "A cliente" en
rojo + labels/tamaños del plan · **Negocios con pagos** con TC = `tcBna` confirmado o BNA online
de respaldo, "Precio en pesos" en rojo, "Pago" resaltado · **Pago diferido** sumó el patrón (antes
100% a mano) · **Pases** con el **signo de la fórmula corregido** (`cercana − larga`, verificado
con el ejemplo ±10 del relevamiento — confirmado por grep que solo la calculadora usa esa función,
el panel real de `/granos/pases` es código independiente) + "A fijar" promovido a resultado
principal + cartel de advertencia si el pase da negativo · **Carry** con selector "Medir spread en
USD/ARS" · **Costos** oculta con `soloMesa` en `biblioteca.ts` (la sidebar ya filtraba ese flag) +
filtro en el índice + `redirect("/sin-acceso")` en la página.

**Verificado de punta a punta** (lint/tsc/**397 tests**/build ✅ + Playwright real contra
`npm run start` con datos de Supabase/A3 del entorno, claro/oscuro, cero errores de consola/scroll
horizontal): A fijar cargó 4 posiciones canónicas reales de soja con precios de cierre y los 2
gráficos separados y legibles · Pases con cercana=100/lejana=110 dio exactamente −10,00 (antes
+10) con el cartel de carry visible · Carry con el selector ARS mostrando 14.890 (10 USD × TC real
~1489) · Costos verificado con **bypass temporal** (forzando el camino no-admin, revertido y `git
diff` limpio): desaparece de sidebar/índice, la URL directa redirige a `/sin-acceso`.

**Próximo paso**: seguir con **R6 (dólar)** según el orden del plan (R1→R3→R4→R6→R2→R5→R7→R8→
R9→R10); las preguntas 3/9/10 de §5 siguen abiertas y gatean partes de R2/R5/R8. Detalle:
[`sesiones/2026-07-30-r4-calculadoras.md`](sesiones/2026-07-30-r4-calculadoras.md).

**Corrección post-feedback, misma sesión, mismo día**: al ver el Preview, Lautaro rechazó de plano
la estética de este lote ("Los cambio es estéticos que hiciste son malísimos... No lograste lo que
te pedí en absoluto") y señaló 3 problemas puntuales en las calculadoras — el logo mal integrado en
las imágenes, los 2 gráficos de "A fijar" mal combinados, y los campos $/USD que pidió separar
quedaron mal (una re-lectura del docx original mostró que el widget compacto de la primera vuelta
duplicaba el mismo estado en dos lugares que parecían distintos, en vez de dar dos campos
genuinamente separados). Reescrito en la misma sesión: `usePrecioDual` (hook, sin layout) +
`PickerPizarra` (picker simple) reemplazan el widget compacto — cada calc arma su propio par de
`.calc-field` USD/ARS reales · `DeltaTnaChart` (gráfico combinado de a de verdad, doble eje, barras
+ línea, con un bug real de colisión de etiquetas encontrado y arreglado con datos de maíz) ·
marca de agua de `ChartMarca` con variante opcional `tamano="chico"` para gráficos con pocas
columnas (sin tocar el tamaño/opacidad global, que Lautaro había calibrado a propósito en otra
sesión). Detalle completo con las 3 citas exactas del docx: sección "Corrección post-feedback" al
final de [`sesiones/2026-07-30-r4-calculadoras.md`](sesiones/2026-07-30-r4-calculadoras.md).

## Anterior (30/07/2026 — 🌾 C28/R3: granos, HECHO)

**🌾 C28 — LOTE R3 (GRANOS) — HECHO — rama `claude/website-changes-review-ttqsq4` (reiniciada
desde `main` tras mergear el PR #111 de R1), PR #112.** Ejecuta el prompt R3 de
`PLAN_RELEVAMIENTO_WEB.md` §3 (puntos 25–30, todos en `/granos/*`), con la única pregunta que lo
gateaba (§5.7, formato del export del view) contestada por Lautaro: **PNG simple**.
**Build**: Arbitrajes con **edición dual $/USD** (cross-cálculo con el TC implícito de la propia
pizarra CAC del grano, fallback `tcBna`; campo editado en azul —token nuevo `--manual`—) + bloque
**Oficial (MAE) / BNA online** (`oficial−9`, `src/lib/bna-online.ts` nuevo, reusable por R4) + vol/
OI del grupo pegado a la derecha · Pases con el **mismo filtro de liquidez** que Arbitrajes
(extraído a `src/lib/liquidez-posicion.ts`, antes vivía solo ahí) · Caja comparando **posiciones
fijas** (SOJ/NOV·MAI/DIC·TRI/DIC) + columna Spread + ganador resaltado · Capacidad con **"Soja
(industria)" pegada debajo de Soja** + emojis 🌾/🌻 para sorgo/girasol · Monitor con **14 emojis
únicos** por instrumento + alineación de "Referencias" corregida · View con el bloque de feedback
gateado por `esAdmin` (ready para cuando se abra a clientes) + **botón "↓ PNG"** por card.

**El export PNG del view cambió de técnica en la propia verificación** (2 fallas reales
encontradas, no hipotéticas): la primera versión (rasterizar el DOM real vía
`<svg><foreignObject>`, como ya hace `exportarSvgComoPng` con los charts) falló el 100% de las
veces — primero por XML roto (el CSS de Tailwind v4 trae `@property { syntax: "<color>" }`, el `<`
literal rompe el `<style>` sin CDATA) y, ya arreglado eso, por **canvas "tainted"** (limitación de
Chrome con CUALQUIER `foreignObject` con HTML adentro, confirmado que no depende de fuentes/
imágenes externas). Se abandonó la técnica y se reescribió como **dibujo a mano en canvas**
(`exportarViewComoPng`, `chart-export.ts`) con los colores reales del tema — cero riesgo de taint,
probado y funcionando en claro y oscuro.

**Verificado de punta a punta** (lint/tsc/**384 tests**/build ✅ + Playwright real contra
`npm run start` con datos de Supabase del entorno, claro/oscuro, cero errores de consola/scroll
horizontal): Arbitrajes con cross-cálculo exacto (999 USD → 1.487.509,2 ARS) y clase `.manual`
confirmada · Pases cruzado contra Arbitrajes (todas sus patas dentro del set visible de
Arbitrajes) · Caja con Soja/NOV26 resaltado y spread visible · Capacidad con el orden Soja→Soja
(industria)→Maíz→Trigo→Sorgo→Girasol en los 2 temas · Monitor con los 14 emojis distintos
(`Set().size` verificado) · View con **bypass temporal** (`requireAdmin()` + datos sintéticos,
revertido y `git diff` limpio): feedback visible, PNG descargado y comparado contra la card en
pantalla en claro y oscuro — y con el código real, `/granos/view` sin sesión sigue redirigiendo a
`/ingresar`.

**Próximo paso**: seguir con **R4 (calculadoras: patrón + 7)** según el orden del plan
(R1→R3→R4→R6→R2→R5→R7→R8→R9→R10); las preguntas 3/4/6/9/10 de §5 siguen abiertas y gatean partes
de R4/R2/R5/R8. Detalle: [`sesiones/2026-07-30-r3-granos.md`](sesiones/2026-07-30-r3-granos.md).

## Anterior (29/07/2026 — 🎛️ C28/R1: shell + home + cinta, HECHO)

**🎛️ C28 — LOTE R1 (SHELL + HOME + CINTA) — HECHO — rama `claude/website-changes-review-ttqsq4`
(reiniciada desde `main` tras mergear el PR #109 del plan), PR #_.** Ejecuta el prompt R1 de
`PLAN_RELEVAMIENTO_WEB.md` §3 (puntos 13–24 + 15 + 37 + 46), con las 4 preguntas que lo gateaban
contestadas por Lautaro el mismo día (registradas en §5 del plan): soja de la home = NOV26+MAY27 ·
watermark = "ROFO AGRO · email" para clientes y NADA para admins · cinta con UNA entrada de
oficial = spot mayorista · BNA −9 constante en código (con `tcBna` de CAC como confirmado).
**Build**: strings (badge V0, brand-sub, minutos de rueda, toggle "Modo claro/oscuro", noticias
sin "30 fuentes"/"categorización propia") · "(vía BCR)" eliminado del código (2 lugares espejo) Y
de la base (UPDATE por MCP, corrido dos veces porque el cron sumó filas nuevas en el medio → 0
filas al cierre) · watermark nueva gateada por `!esAdmin` · sidebar
**acordeón excluyente** (un grupo abierto a mano, persistencia compatible; el grupo activo sigue
siempre expandido — excepción documentada) · **cinta a lo ancho completo** del shell sin mover
`getCintaData()` (breakout CSS + `:has()`, guarda de revalidate de C25 intacta) ·
`rofoagro-logo-marca.svg` limpiado DE VERDAD (era copia byte a byte del logo; filtro saturación
<18 + luminancia >180 saca los halos y conserva los amarillos del trigo — fin del blanco en modo
oscuro en TODOS los charts) · cinta nueva (Oficial=mayorista MAE · MEP · CCL · Fut + Petróleo/
Oro/Plata/Real/S&P/Merval con variación, reusa `getMonitorMercados()` cacheado) · home:
`mercado-hoy` partido **Argentina (A3: Maíz JUL26 · Soja NOV26 · Soja MAY27 · Trigo DIC26) |
Chicago**, con la regla operado/ajuste extraída a **`src/lib/referencia-futuro.ts`** (lib pura +
tests, ahora compartida con Arbitrajes) · **placa hero rotativa** (`hero-placa.tsx`: SOJ→MAI→TRI
con fade cada 6s, pausa en hover, puntos manuales, USD grande + pesos destacados + fecha de
pizarra, reduced-motion=estática) · Próximos informes a **7 días** con "JUE 30 JUL" en una línea ·
`EstimacionesMini` fuera de la home y borrada (sin importadores).

**Verificado de punta a punta** (lint/tsc/374 tests/build ✅ + Playwright real contra
`npm run start` con datos de Supabase del entorno, claro/oscuro/mobile 390px, cero errores de
consola/scroll horizontal): geometría cinta/sidebar medida con `getBoundingClientRect()` (el
primer ítem de la cinta queda exacto bajo el logo, con `prefers-reduced-motion` para descartar el
marquee en curso) · acordeón de sidebar con interacción real (abrir un grupo cierra el otro,
persiste tras reload) · watermark con bypass temporal (revertido, `git diff` limpio): cliente ve
"ROFO AGRO · email", admin ve 0 marcas · logo limpio comparado lado a lado con el original sobre
oscuro (el bug exacto —"ROFO" en blanco— desaparece) y en un chart real (`/dolar/oficial`).

**Próximo paso**: seguir con **R3 (granos)** según el orden del plan
(R1→R3→R4→R6→R2→R5→R7→R8→R9→R10); las preguntas 3/4/6/7/9/10 de §5 siguen abiertas y gatean
partes de R3/R4/R6. Detalle:
[`sesiones/2026-07-29-r1-shell-home-cinta.md`](sesiones/2026-07-29-r1-shell-home-cinta.md).

## Anterior (29/07/2026 — 📝 C28: PLAN del relevamiento web de Lautaro (56 puntos), CERRADO)

**📝 C28 — RELEVAMIENTO WEB DE LAUTARO (56 PUNTOS) → PLAN CERRADO, SOLO DOCS — rama
`claude/website-changes-review-ttqsq4`, PR #_.** Lautaro relevó a mano TODA la web (docx con 56
puntos + 73 capturas) y pidió los pasos para implementar todo, con las preguntas juntas al final
y el backlog de lo que no llegó a ver. Se extrajo el docx completo, **cada captura quedó mapeada
a su punto** (imprescindible: varios puntos eran solo "eliminalo" + imagen), y 3 agentes de
exploración anclaron los 56 puntos a archivo:línea real. **Entregable:
[`PLAN_RELEVAMIENTO_WEB.md`](PLAN_RELEVAMIENTO_WEB.md)** — §2 los 56 puntos interpretados y
mapeados · §3 **10 lotes con prompt autocontenido** (R1 shell+home+cinta · R2 landing · R3 granos
· R4 calculadoras patrón+7 · R5 estrategias+planta · R6 dólar · R7 gráficos+producción · R8
DJVE+empresas · R9 camiones · R10 puertos; orden sugerido R1→R3→R4→R6→R2→R5→R7→R8→R9→R10, builds
con Sonnet + `ui-ux-pro-max`, copy con `voz-lautaro`) · §4 respuestas directas (3 pedidos ya
funcionan así o tienen respuesta: Admin ya solo-admin, dólar linked ya dinámico, el spread de
gráficos usa la pizarra histórica de cada momento) · **§5 las 10 preguntas para Lautaro, todas
juntas** (varias gatean lotes: ejemplo numérico del Excel para sintéticos, el −9 del BNA,
watermark, cinta, posiciones ambiguas) · §6 backlog. Hallazgos de exploración que achican el
trabajo: `rofoagro-logo-marca.svg` es copia idéntica del logo con ~20 fills casi-blancos (el
punto 46 se arregla limpiando UN svg), `pizarraArs` y `tcBna` ya se parsean y están sin usar
(los puntos 25/40 tienen el dato servido), "(vía BCR)" vive en 2 lugares espejo + filas ya
guardadas. Registrado como **C28** en el backlog maestro (`auditoria/E7-sintesis.md` §4), con el
backlog derivado (mail de la empresa para el form de contacto, tanda 2 del relevamiento —
páginas de mesa 🔒/Informes//admin —, verificación visual de zonas, aviso DL opcional).

**Próximo paso: Lautaro contesta las 10 preguntas de §5 → ejecutar los lotes R1→R10** (un PR por
sesión, prompts en §3). Detalle:
[`sesiones/2026-07-29-plan-relevamiento-web.md`](sesiones/2026-07-29-plan-relevamiento-web.md).

## Anterior (29/07/2026 — 🌱 C27 FASE 2: condición de cultivos BCBA-PAS, HECHA Y DE PUNTA A PUNTA CON DATOS REALES)

**🌱 C27 FASE 2 — CONDICIÓN DE CULTIVOS SEMANAL BCBA-PAS — HECHA, migración aplicada y los 4
archivos reales cargados por Lautaro — rama `claude/determined-ptolemy-47adgf`, PR #107
(mergeado).** Ejecuta el prompt de §9 de
`PLAN_PAS_ZONAS.md` (C27 del backlog maestro), cierra el plan completo (Fases 1+2, C23+C27).
`src/lib/parse-pas-condicion.ts` (15 columnas fijas normalizadas + **fenología leída DINÁMICAMENTE
del header** — girasol/soja/maíz/trigo traen 4 vocabularios agronómicos distintos, nunca
hardcodeada — mapa Soja/Soja1/Soja2/Maiz/Maiz1/Maiz2/Trigo/Girasol acotado a esos 4 cultivos, sin
hueco para cebada/sorgo, semana 0-53 sin fecha, PK duplicada con "gana la última") ·
`pas-condicion-calc.ts`/`pas-condicion.ts` (ciclos/campañas derivados de los datos reales, overlay
de campañas para condición de cultivo/hídrica + series de fenología) · migración
`20260729130000_c27_pas_condicion.sql` (tabla `pas_condicion` con fenología en **jsonb array
ordenado** + RPC `admin_upsert_pas_condicion`, misma RLS que `pas_zonas`) · uploader en
`/admin/datos#pas-condicion` (un archivo por cultivo) · panel `/produccion/condicion` (selector
cultivo+ciclo+campaña, 3 charts con eje "semana de campaña", la campaña elegida en color pleno
sobre las previas en gris) · registro en `biblioteca.ts` y en el catálogo de monitoreo.

**Hallazgo real de esta sesión que cambió el código respecto al plan**: la tolerancia `[98,102]`
que proponía el plan para los bloques CC/CH de origen (deben sumar ~100%) descartaba **~20-25% de
las filas de soja/maíz** al verificarla contra los 4 archivos reales — BCBA redondea cada categoría
a un entero independiente y la suma cae rutinariamente en 96-99% por puro redondeo (122/499 filas
de soja exactas en 97%), no por datos malos. Recalibrada empíricamente a **`[90,110]`** tras
confirmar un salto limpio entre esa masa y los outliers genuinos (54%, 76-84%), documentado en el
código y en los tests.

**Verificado primero con Playwright/bypass** (subida real de los 4 `.xlsx` de `data/pas/` por el
uploader — girasol 250 filas/4 descartes de bloque, soja 560/7 descartes —incl. 6 PK duplicadas—,
maíz 727/4 descartes, trigo 335/0 descartes — los 4 coinciden 1:1 con los tests; confirmación
fallaba PROLIJO por falta de la RPC, como se esperaba antes de aplicar la migración; panel probado
con los 4 archivos parseados en memoria, bypass temporal de 3 puntos —DAL, proxy y datos de la
página— revertido, `git status` limpio): selector de ciclo correctamente oculto para girasol/trigo
(sin ciclos) y visible para soja/maíz (1ra/2da), trigo con la campaña **2026/27 en curso** dibujada
parcial sin romper el resto del historial, crosshair con tooltip exacto. 44 tests nuevos (369/369
total) · lint/tsc/build ✅ · claro/oscuro/mobile sin errores de consola ni scroll horizontal.

**Migración APLICADA por el orquestador (mismo día) + los 4 archivos reales cargados por Lautaro
desde `/admin/datos#pas-condicion`.** Verificado por SQL contra la base real: `pas_condicion` con
**1.872 filas** — exacto girasol 250 (total) + maíz 727 (243/1ra + 242/2da + 242/total) + soja 560
(186/1ra + 186/2da + 188/total) + trigo 335 (total), sin ninguna fila de más ni de menos respecto a
lo que había mostrado la previsualización del uploader. RLS confirmada en los dos sentidos: `anon`
da `permission denied` (revoke total, ni siquiera 0 filas silenciosas) y `authenticated`+`is_admin()`
ve las 1.872. Valor de control cotejado byte a byte contra el fixture (girasol semana 7 de 2025/26:
`cc_buena=37,29308468`, `ch_regular=41,73906156`, fenología `Cosecha=29,8647211`) — coincide exacto.
`actualizado_en` de hoy → el healthcheck de `/admin/conexiones` debería levantar
`pas_condicion (BCBA condición)` en verde. Con esto **`PLAN_PAS_ZONAS.md` queda completo de punta a
punta** (Fases 1 y 2 — `pas_zonas` de C23 sigue con 0 filas, carga pendiente aparte, no forma parte
de esta sesión). Detalle:
[`sesiones/2026-07-29-c27-fase2-pas-condicion.md`](sesiones/2026-07-29-c27-fase2-pas-condicion.md).

## Anterior (29/07/2026 — 🗺️ C23 FASE 1: BCBA-PAS por zona agroecológica, HECHA)

**🗺️ C23 FASE 1 — PRODUCCIÓN BCBA-PAS POR ZONA AGROECOLÓGICA — HECHA (código completo, migración
sin aplicar) — rama `claude/fase1-bcba-pas-zonas-7lwyom`, PR #_.** Ejecuta el prompt de §8 del plan
cerrado el mismo día (entrada de abajo): `src/lib/xlsx-lite.ts` extraído byte-a-byte de
`parse-agrochat.ts` (parser XLSX compartido, cero cambio de comportamiento, tests de agrochat
intactos como red) · `src/lib/parse-pas-zonas.ts` (headers normalizados — tolera el typo real
"Perdído" — 16 zonas canónicas, rinde SIEMPRE recalculado, guard de escala + duplicado de grupo,
identidad suma-zonas=TOTAL ±0,5% solo desde 2008/09) · migración `20260729120000_c23_pas_zonas.sql`
(tabla `pas_zonas` + RPC `admin_upsert_pas_zonas`, RLS `authenticated`+`is_admin()` patrón
`views_mercado`) · uploader en `/admin/datos#pas-zonas` (guard de identidad con "forzar" + cruce vs.
el comparador nacional como warning) · `pas-zonas-calc.ts`/`pas-zonas.ts` (foto de campaña con Δ
descompuesto en efecto área/efecto rinde + evolución de participación top-6+Resto) · panel
`/produccion/zonas` (solo mesa) reusando el motor de charts + la paleta de 7 colores ya existente ·
registro en el catálogo de monitoreo (PR #104).

**Migración escrita, SIN APLICAR a propósito** (instrucción explícita del prompt de ejecución: la
aplica el orquestador por MCP con el OK de Lautaro). Verificado igual con Playwright: subida real
del `.xlsx` de `data/pas/` por el uploader (1.837 filas, 6 granos, 27 campañas, sin fallas de
identidad — coincide con el análisis del plan), confirmación falla PROLIJO por falta de la RPC
(esperado), y el panel probado con el histórico completo parseado en memoria (bypass temporal
revertido, `git diff` limpio): soja 2025/26 TOTAL 50,1 Mt/−0,4%, maíz 2024/25 = 49,0 Mt (1:1 con el
plan), % del total sumando exacto 100%, identidad del shift-share exacta. **2 bugs reales
encontrados y arreglados en la propia verificación**: una campaña "solo TOTAL" (maíz/sorgo 2025/26,
sin cosecha) dibujaba una caída falsa a 0% en el gráfico de evolución → excluida del eje; las
etiquetas del eje X podían pegarse en los últimos 2 puntos → 9 ticks evenly-spaced. 329/329 tests
(51 nuevos) · lint/tsc/build ✅ · claro/oscuro/mobile sin errores de consola ni scroll horizontal
(se encontró y documentó, sin tocar, un scroll horizontal mobile PRE-EXISTENTE y ajeno a este PR en
`/admin/datos`, causado por un `<code>` largo de la sección de Agrochat).

**Pendiente para la próxima sesión**: que el orquestador aplique
`supabase/migrations/20260729120000_c23_pas_zonas.sql` por MCP → recién ahí Lautaro puede subir el
archivo real desde `/admin/datos` y ver el panel con datos de Postgres de verdad (hoy solo se probó
parseando el .xlsx en memoria) · confirmar `/admin/conexiones` levanta el check `pas_zonas (BCBA
zonal)` · **Fase 2 (C27, condición de cultivos)** — prompt en `PLAN_PAS_ZONAS.md` §9, depende de
esta Fase 1 mergeada. Detalle:
[`sesiones/2026-07-29-c23-fase1-pas-zonas.md`](sesiones/2026-07-29-c23-fase1-pas-zonas.md).

## Anterior (29/07/2026 — 📋 PLAN C23/C27: PAS por zona + condición de cultivos, CERRADO)

**📋 C23/C27 — PLAN BCBA-PAS POR ZONA + CONDICIÓN DE CULTIVOS — PLAN CERRADO, SOLO DOCS +
FIXTURES (cero código de producto) — rama `claude/plan-desarrollo-auditoria-yccgvw`, PR #105
(mergeado).**
C23 era el único ítem del backlog maestro sin prompt escrito (`auditoria/E7-sintesis.md` §4).
Lautaro adjuntó los 5 exports reales de BCBA-PAS y el alcance quedó cerrado por `AskUserQuestion`
(2 rondas, con los archivos llegando en el medio): **un plan, dos entregas** — Fase 1 = producción
por zona agroecológica (C23 original) · Fase 2 = condición de cultivos semanal (**C27 nuevo**,
salió de un archivo que Lautaro pasó "de paso" al probar C23). Los 2 paneles **solo-mesa** con RLS
cerrada de verdad (patrón `views_mercado`, no solo gate de página); carga manual (Cloudflare
bloquea bots, confirmado de nuevo) con cadencia semanal (PAS del jueves); las 2 cargas quedan
registradas en el **monitoreo de ingestas** (PR #104, `/admin/conexiones`, mergeado en paralelo).

**Los 5 archivos reales fueron parseados a fondo en esta sesión** (regex sobre el XML crudo del
XLSX, sin depender de ninguna librería — el sandbox no tenía `openpyxl`) y quedaron **versionados
en `data/pas/`** (fixtures del build, no hace falta volver a pedírselos a Lautaro):
`reporte_zonas_2026-07-29.xlsx` (producción, 1.900 filas) y 4 de condición —
`reporte_condicion_{girasol,soja,maiz,trigo}_2026-07-29.xlsx`. Hallazgos que definieron el
diseño: la identidad "suma de zonas = TOTAL" en producción **cierra ≤0,5% solo desde 2008/09**
(antes las zonas cubren ~50% del total, BCBA no zonificaba todo al principio) → constante de era
en vez de inventar dato; "Producción(MTn)" son toneladas CRUDAS pese al rótulo "M" (verificado:
soja 24/25 = 50,3 Mt); las columnas de **fenología cambian de nombre por cultivo** en los 4
exports de condición (girasol/soja/maíz/trigo, los 4 con vocabulario agronómico propio) → parser
con headers dinámicos, nunca hardcodeados; soja Y maíz se desdoblan en total/1ra/2da, trigo y
girasol no; `Semana` es 0-53 dentro de la campaña sin fecha real (eje "semana de campaña"); la
cobertura de condición es **solo 4 cultivos** (sin cebada/sorgo, confirmado por Lautaro — no hay
que dejarles un hueco en el selector).

**Entregable: [`docs/PLAN_PAS_ZONAS.md`](../PLAN_PAS_ZONAS.md)** (mismo formato que
`PLAN_SIDEBAR.md`): DDL de las 2 tablas nuevas (`pas_zonas` ancha sin vintages, `pas_condicion`
con fenología en jsonb array ordenado) + RPCs + parsers con su tabla completa de defensas
(error/descarte/warning) + extracción de `xlsx-lite.ts` compartido desde `parse-agrochat.ts` (move
byte-a-byte, sus tests quedan de red) + diseño de los 2 paneles (`/produccion/zonas`: foto de
campaña con Δ descompuesto en efecto área/efecto rinde + evolución top-6 zonas+Resto desde
2008/09; `/produccion/condicion`: overlay semanal de condición/hídrica/fenología) + **2 prompts de
ejecución autocontenidos** (§8 Fase 1, §9 Fase 2) para sesiones de build futuras (Sonnet, regla de
`PLAN_BACKLOG.md`). `E7-sintesis.md` §4 actualizado (C23 con el plan cerrado, C27 nuevo).

**Pendiente para las próximas sesiones**: ejecutar el prompt de Fase 1 (§8) y, una vez mergeada,
el de Fase 2 (§9) — que depende de `xlsx-lite.ts` de la Fase 1. El catálogo de monitoreo del
PR #104 ya mergeó (los checks nuevos van en `src/lib/monitoreo/catalogo.ts`). Detalle:
[`sesiones/2026-07-29-c23-plan-pas-zonas.md`](sesiones/2026-07-29-c23-plan-pas-zonas.md).

## Anterior (29/07/2026 — 🖥️ panel /admin/conexiones, HECHO)

**🖥️ PANEL /admin/conexiones (monitoreo de crons, Routines y cargas manuales) — HECHO — rama
`claude/admin-crons-panel-9p8f62`, PR #104 (mergeado).** Pedido directo de Lautaro: un lugar dentro de `/admin`
para ver de un vistazo qué carga manual falta (y desde cuándo), qué cron corrió o no, si las 3
Routines produjeron lo suyo, y si el WebSocket de A3 está trayendo datos — hoy esa información
vivía repartida (frescura solo en el mail de las 20:45, "¿corrió?" solo en la API de GitHub sin
acceso desde la web, Routines detectables solo leyendo tablas a mano). **Confirmado por research:
no existe ningún `ingest_log`** en el repo (solo mencionado como pendiente en `INFRAESTRUCTURA.md`)
→ el panel combina 3 fuentes reales en vez de leer un registro de corridas: la API de GitHub
Actions (run real, opcional vía `GH_MONITOR_TOKEN`), la frescura de Supabase (reusa el mismo
catálogo que `healthcheck-frescura.mjs`, ahora extraído a **`src/lib/monitoreo/catalogo.ts`** para
no duplicar) y `informes_generados`/`views_mercado` (qué produjeron las Routines).

**Build**: catálogo único (`CHECKS`/`MATVIEWS`/`FUTURO` movidos desde el script + `WORKFLOWS`/
`CARGAS_MANUALES`/`ROUTINES` nuevos) + libs en `src/lib/monitoreo/` separadas en pares lógica-pura
(testeable) / wrapper-de-I/O (`server-only` — confirmado que el paquete `server-only` rompe Vitest
apenas se lo importa, incluso bajo Node puro) + `a3Ping()` nuevo en `a3-live.ts` (ping barato a 1
símbolo real, sin exponer `fetchPuntas`) + página `/admin/conexiones` (3 KPIs + 4 bloques: cargas
manuales con link directo a cada sección de `/admin/datos` —que ahora tiene anclas `id=`—, crons
con semáforo verde/dorado/rojo reusando `.estado-aprobado/.estado-pendiente/.estado-bloqueado`,
Routines en cards `.sf-card`, y A3/Supabase/matviews/vencimientos/seed-calendario). **Solo lectura +
links** (sin botón "correr ahora" — decisión de Lautaro por `AskUserQuestion`, menos superficie de
riesgo). **Reglas de "última carga" por tabla** verificadas migración por migración: `compras`/
`camiones` no refrescan su columna de auditoría al re-subir (se usa `fecha` del dato); DEA/PAS/BCRA-
manual/LECAP sí (se usa `actualizado_en`/`actualizado`, porque `fecha_publicacion` puede ser de
días atrás — ver `PLAN_INFORMES_V2.md`). `esHabil`/`isoMenosDias`/`huecosHabiles` de `/admin/datos`
(antes duplicadas ahí) pasaron a ser la única definición, importada por ambos.

**Verificado**: lint/tsc/build ✅ · **288/288 tests** (40 nuevos: lógica de huecos hábiles, ventana
esperada de cada Routine, consistencia del catálogo) · `healthcheck-frescura.mjs` corrido real
post-refactor, mismo output exacto que antes · Playwright real (claro/oscuro/mobile, con las
credenciales públicas de Supabase — `NEXT_PUBLIC_*` pedidas por MCP para el sandbox): cero errores
de consola, cero scroll horizontal, cruce independiente exacto entre el cálculo de huecos de BCRA
del panel nuevo y el de `/admin/datos` (mismo resultado, confirma que el refactor no cambió
comportamiento). **Hallazgo real durante la verificación** (no un bug): el panel marcó "View de
mercado: ATRASADO" porque las 2 corridas reales en `views_mercado` (21/07 y 27/07) fueron ambas
disparos manuales de sesiones de build/diagnóstico, ninguna cayó en viernes — el cron semanal real
(creado 23/07) todavía no produjo una corrida propia; se confirma el 31/07 si corre sola.

**Pendiente**: cargar `GH_MONITOR_TOKEN` en Vercel (fine-grained, Actions read-only — instrucciones
en `.env.local.example`; sin él el panel degrada solo a frescura, no rompe nada) · primer vistazo
real de Lautaro logueado (todo se verificó con bypass temporal, revertido antes de cerrar). Detalle:
[`sesiones/2026-07-29-panel-conexiones.md`](sesiones/2026-07-29-panel-conexiones.md).

## Anterior (29/07/2026 — 💱 BONCAPs en vivo + girasol industria descartado)

**💱 BONCAPs (T) EN VIVO en `/dolar/sinteticos` + 🌻 GIRASOL (INDUSTRIA) DESCARTADO — HECHO —
rama `claude/modelo-flujo-trabajo-r1111q`, PR #_.** Cierra 2 follow-ups chicos que habían
quedado del C16/C13 (24/07). Pista clave de Lautaro: los BONCAPs cotizan en data912 como
**"título" (`/live/arg_bonds`)**, no como "letra" (`/live/arg_notes`, donde están las LECAP) —
por eso el filtro `T` que se había anotado como pendiente sobre `getLecaps` nunca iba a
funcionar (esa función solo leía `arg_notes`). `src/lib/market/fuentes.ts` suma `getBonds()`
(mismo patrón que `getNotes()`, contra `arg_bonds`); `tickers.ts` suma el prefijo `T` a
`vencFromTicker` (mismo formato de ticker día+mes-letra+año que LECAP/dólar linked, solo cambia
el prefijo); `lecaps.ts` junta ambas fuentes en el mismo array — `sinteticos.ts` (el único
consumidor) no necesitó cambios, ya trataba la lista como "letras a emparejar con DLR" genérico.
Panel con copy actualizado (título, columna, tooltips). Test nuevo `tickers.test.ts` (D/S/T +
rechazos). **Girasol (industria)**: Lautaro contestó "descartalo, no me interesa" — cero código
que tocar (nunca se había construido una fila visible para girasol industria; el valor que
`parseBcrIndustria` parsea internamente sigue haciendo falta para el chequeo de columnas que
blinda el parseo de soja contra el typo real de BCR de esa misma fila — no se tocó). Cerrado
como decisión de alcance, no como deuda técnica.

**Verificado**: lint/tsc/build ✅ · 261/261 tests (4 nuevos) ✅ · `npm run start` real con las
env vars de Supabase del entorno: `/dolar/sinteticos` muestra las 12 filas (8 LECAP + 4 BONCAP),
los 4 BONCAP emparejados 1:1 con su DLR del mismo mes (T15E7→ENE27 · T30A7→ABR27 · T31Y7→MAY27 ·
T30J7→JUN27) con TNA sintético/futuro/ventaja calculados (ya no "—"). Detalle:
[`sesiones/2026-07-29-boncaps-live.md`](sesiones/2026-07-29-boncaps-live.md).

## Anterior (28/07/2026 — 🗂️ C25: biblioteca + menú lateral (sidebar), HECHO)

**🗂️ C25 — BIBLIOTECA + MENÚ LATERAL (SIDEBAR) — HECHO, ejecutando el prompt de
`PLAN_SIDEBAR.md` §5 — rama `claude/c25-biblioteca-sidebar-hzrmsf`, PR #_.** La nav superior de 8
links se fue; toda la navegación vive ahora en un **menú lateral fijo** (desktop) / **drawer**
(mobile) — biblioteca real: varios grupos pueden estar abiertos a la vez (sin acordeón
excluyente), el de la ruta activa siempre expandido, lo que el usuario abrió a mano persiste en
`localStorage`. **Registro único `src/lib/biblioteca.ts`** (espejo 1:1 de `SECCIONES_META`, que
no se tocó) alimenta la sidebar, los índices de grupo y los breadcrumbs — nada duplicado a mano.
**15 páginas nuevas** (cáscaras finas: `requireSeccion` + `PageHead` + el componente existente
tal cual, cero fórmula/dato tocado): `/granos/{arbitrajes,pases,caja,capacidad,monitor}` ·
`/dolar/{futuro,oficial,linked,implicitas,sinteticos,cambiario}` · `/comercio/djve` ·
`/produccion/{calendario,estimaciones}` (reemplaza las pestañas de `ProduccionTabs`, borrado).
**4 índices a hub-grid** (`/granos`, `/dolar`, `/produccion` — antes componían todos los paneles;
`/comercio` suma la tarjeta DJVE). `NavLinks` murió (sin más importadores, borrado);
`SiteHeader` quedó mínimo (logo · hamburguesa mobile · rueda · tema · sesión).

**Hallazgo real durante la verificación (no en el plan original)**: meter la cinta en el layout
compartido — como sugería el árbol del plan ("arriba quedan solo logo, cinta…") — arrastraba
**todas** las páginas a revalidar cada ~30-60s, incluidas las de mesa 100% estáticas hoy
(`/comercio/puertos`, `/granos/view`), medido comparando un build real contra `main` línea por
línea. Violaba la guarda dura "con el flag apagado, cero cambios de render, solo de navegación" →
la cinta se dejó donde ya estaba (la home), la sidebar cubre la navegación que era el pedido real.
De paso se encontró y arregló un bug real de breadcrumbs (Gráficos: "Período" pisaba la etiqueta
"Gráficos" en el mapa href→label, por compartir pathname con "Campañas" sin query).

**Verificado**: lint/tsc/vitest (224/224, sin libs tocadas) ✅ · build (60 rutas, todas 200) ✅ ·
**revalidate comparado contra `main` build a build** — toda ruta preexistente sin recomponer
mantiene idéntico revalidate/expire; las únicas diferencias son las esperadas de partir páginas
compuestas en índice+detalle (menos regeneración, no más) · Playwright real (datos de Supabase del
entorno, claro/oscuro con el toggle real —`next-themes` acá no sigue `prefers-color-scheme`—,
desktop 1280 + mobile 390): 24 rutas públicas 200 con datos reales, sidebar (expandir/colapsar con
persistencia, activo, drawer con foco atrapado), breadcrumbs, cero scroll horizontal, cero
errores de consola nuevos · bypass temporal (`esAdmin=true` a mano, revertido) confirmó los 6
ítems 🔒 de Comercio + View de mesa + el grupo Admin completo, y que `/granos/view` sigue
redirigiendo sin sesión (la protección real no cambió, solo qué se lista). Detalle:
[`sesiones/2026-07-28-c25-biblioteca-sidebar.md`](sesiones/2026-07-28-c25-biblioteca-sidebar.md).

## Anterior (28/07/2026 — 🔍 D7 = L7 detector de anomalías en ingestas HECHO)

**🔍 D7 = L7 — DETECTOR DE ANOMALÍAS EN INGESTAS — HECHO — rama `claude/d7-development-t7alj4`,
PR #_.** Único ítem del backlog maestro sin dependencias que quedaba pendiente
(`docs/auditoria/E7-sintesis.md` §4 D7, prompt en §6 L7). Hasta ahora se chequeaba **frescura**
(healthcheck, 17 checks) y **0 filas** (guard anti falso-verde), pero nadie validaba que los
VALORES que entran fueran plausibles contra la historia de su propia serie.

**`src/lib/anomalias.ts`** (motor puro, testeado): mediana + MAD normalizado (nunca promedio/
desvío — un solo outlier de 15 órdenes de magnitud los destruye) con 6 chequeos — salto vs
historia (z-score robusto, con piso absoluto `minDelta` por serie), orden de magnitud (×1000/÷1000,
agarra el bug de Agrochat en miles de toneladas), monotonía con alerta (un acumulado no puede
bajar — rompe el silencio del clamp de `compras_avance_hist`), identidades contables (total = suma
de partes / partes ≤ total), duplicado exacto (fila idéntica a otro período) y rango físicamente
imposible. **`src/lib/anomalias-series.ts`**: catálogo de 9 series calibradas contra la base real
(no a ojo). **`scripts/chequeo-anomalias.mjs`** + **`.github/workflows/chequeo-anomalias.yml`**:
barrido diario (20:50 ART, después del healthcheck), avisa por mail sin bloquear (`alerta-mail.mjs`
extendido con `--detalle-archivo`). **Uploaders manuales** (`/admin/datos`): compras/Agrochat
BLOQUEA en la previsualización si una fila no cierra su identidad contable o supera un máximo
físico (extiende el guard de unidades ya existente, mismo checkbox "forzar"); camiones avisa
(rango físico — la identidad cruzada zona=producto=total la corre el barrido diario, no el
uploader, porque Lautaro sube un grano a la vez).

**Calibración retroactiva real** (todo el histórico, 2015-2026): 208 anomalías / ~100 meses =
2,08/mes — cada categoría auditada a mano: son los 2 bugs reales ya conocidos (spike 49,9 Mt en
compras, girasol 1,38 Mt), 3 bugs de origen de BCR ya documentados en otras sesiones (área ×100,
2 rindes fuera de rango), desvíos estructurales de DEA-sorgo (área sembrada≠cosechada, no bug) y
**un hallazgo nuevo para mostrarle a Lautoro**: cebada cervecera 2025/26 viene con +13-14% de
brecha sostenida entre el acumulado y la suma de sus partes desde abril 2026. Los 5 bugs reales
del prompt verificados uno por uno (4/5 con test y fixture real; el typo de BCR en pellets de
girasol pertenece a `capacidad-bcr-parse.ts`, que ya tiene su propia defensa dedicada —
`contarColumnas()`, PR #76 — fuera del alcance de este detector que opera sobre tablas con
historia). **Trampa real encontrada**: la paginación de PostgREST con `order=fecha.asc` solo
repite/saltea filas cuando hay muchas filas por fecha (medido: 42.636 "puntos" sobre una tabla de
10.668 filas) — el `order` necesita desempatar con TODAS las columnas de la clave.

**Verificado**: lint/tsc/build ✅ · 246/246 tests (22 nuevos, con fixtures reales sacadas de la
base por SQL, no sintéticas) · dry-run de los 2 cableados (barrido + uploader) forzando el fallo.
**Sin verificar**: el primer disparo real del cron (post-merge) y el uploader en navegador real
(sin sesión admin en este sandbox). Detalle completo:
[`sesiones/2026-07-28-d7-detector-anomalias.md`](sesiones/2026-07-28-d7-detector-anomalias.md).

## Anterior (28/07/2026 — 🚚 C24: camiones de Agroentregas, AUTOMÁTICO)

**🚚 C24 — CAMIONES DE AGROENTREGAS (por planta y EMPRESA) — HECHO — rama
`claude/plan-desarrollo-auditoria-matsqn`, PR #_.** Lautaro lo eligió tras descartar C14
(estrategias avanzadas, sigue en pausa) y dejar C23 en pausa. Pasó la captura de la placa diaria
que publica Agroentregas y dijo *"si se puede pegar esa imagen genial, sino cargo los totales"*.

**No hizo falta ninguna de las dos: la fuente resultó automatizable.** El research (requests
reales, 28/07) encontró que `agroentregas.com.ar/total-de-camiones.html` se alimenta de un
**endpoint JSON público sin auth ni key** (`RestServiceImpl.svc/camiones`) que devuelve exactamente
esa placa **y con más detalle: por planta, por EMPRESA y por grano**. C24 dejó de ser "carga manual
diaria" (como estaba escrito en el backlog) y pasó a ser una **ingesta automática, 2 corridas por
día**, sin formulario nuevo en `/admin/datos`.

**El caveat que definió el diseño**: los 28 destinos son Up River + Paraná bonaerense — **no hay
Bahía Blanca ni Necochea**, y solo las plantas que Agroentregas atiende. Su total **NO es
comparable** con el nacional de Williams, así que va en **tabla propia** (`camiones_plantas`,
migración `20260728150000` aplicada) y nunca se mezcla con `camiones`: mezclarlos contaminaría el
percentil estacional de la señal barcos-vs-camiones, cuyas 2 patas son Gran Rosario **y Bahía
Blanca**. **Complementa, no reemplaza** (Lautaro preguntó explícitamente): le saca la *urgencia* a
la carga manual —el día a día ya lo cubre el cron— pero Williams queda como respaldo **nacional e
histórico** (42.624 filas desde 2018, es lo que la señal necesita).

**Sin backfill posible** (el endpoint ignora cualquier parámetro de fecha, probado), **pero** cada
respuesta trae el mismo día de la semana de hace 1 y 2 años y la ingesta los guarda → corriendo el
cron a diario, al año hay **3 años de estacionalidad de Up River construidos solos**.

**Build**: `agroentregas.ts` (parser puro, con control de consistencia que exige que el detalle por
planta cierre exacto contra los totales que publica la propia fuente — si no, falla en vez de
guardar un día a medias) · `ingest-camiones-agroentregas.mjs` (importa ese parser, no lo
reimplementa) · workflow 2×/día todos los días (los puertos reciben los sábados) · `plantas.ts` +
`plantas-panel.tsx` = panel **"Pulso diario Up River"** arriba del de Williams, con serie por grano
pública y tabla **"quién recibió camiones hoy" por empresa (solo mesa)** · healthcheck con umbral
**3 días** (corto a propósito: acá sí hay cron y un atraso son días perdidos para siempre).

**Verificado**: lint/tsc/build ✅ · **235/235 tests** (11 nuevos, fixture = respuesta real sin
retocar) · **1:1 contra la placa de Lautaro**, las 3 filas del encabezado incluidas (28/07/2026
4.560 camiones/145.920 tn · 29/07/2025 2.846 · 30/07/2024 3.325) · corrida real de la ingesta
contra la base (233 filas) cotejada por SQL · RLS por SQL (anon lee, no escribe) · `get_advisors`
sin hallazgos nuevos · navegador con Playwright claro/oscuro/mobile: **+60,2% vs el mismo día de
2025** (exacto), los 17 exportadores suman exacto 4.560, cero errores de consola, cero scroll
horizontal (bypass temporal de `esAdmin` revertido, git limpio).

**Pendiente**: el primer disparo real del cron post-merge. Detalle:
[`sesiones/2026-07-28-c24-camiones-agroentregas.md`](sesiones/2026-07-28-c24-camiones-agroentregas.md)
· fuente: [`negocio/10_fuente_camiones_agroentregas.md`](negocio/10_fuente_camiones_agroentregas.md).

## Anterior (28/07/2026 — 🗂️ PLAN C25: biblioteca + menú lateral, CERRADO)

**🗂️ C25 — BIBLIOTECA + MENÚ LATERAL (SIDEBAR) — PLAN CERRADO, SOLO DOCS — rama
`claude/sidebar-menu-web-architecture-ychqgb`, PR #_.** Pedido de Lautaro: sacar la nav de la
parte superior y pasar a un **menú desplegable fijo al costado izquierdo**, con la web como
**biblioteca** (grupos desplegables → cada reporte con su ítem). Sesión de craneo pura, cero
código. Relevadas las 38 rutas / ~35 reportes; hallazgo clave: las 8 claves de `SECCIONES_META`
son también el **modelo de permisos** (reagrupar tenía costo real, se decidió con eso sobre la
mesa). **4 decisiones cerradas por AskUserQuestion** (eligió la recomendada en las 4): página
propia por reporte (`/granos/arbitrajes`, `/dolar/futuro`, …, componentes reusados tal cual, las
páginas de grupo quedan como índices) · se mantienen los 8 grupos/claves de permisos · header
mínimo + cinta (toda la nav a la sidebar) · solo-mesa mezclados en su grupo con 🔒. Excepciones
deliberadas: Informes queda como feed con anclas; Gráficos linkea sus 2 modos por el `?mc=` ya
persistido. Todo en **[`PLAN_SIDEBAR.md`](PLAN_SIDEBAR.md)** (árbol final + arquitectura +
**prompt de ejecución autocontenido en §5**); registrado como **C25** en el backlog maestro.
**Próximo paso: ejecutar ese prompt en una sesión nueva** — build con Sonnet (regla de
PLAN_BACKLOG) y **cargando la skill `ui-ux-pro-max` antes de tocar UI** (pedido explícito).
Detalle: [`sesiones/2026-07-28-plan-sidebar-biblioteca.md`](sesiones/2026-07-28-plan-sidebar-biblioteca.md).

## Anterior (28/07/2026 — 📐 V3 (semanal v2) + V4 (diario, retoque) HECHOS)

**📐 V3/V4 de `PLAN_INFORMES_V2.md` §9 (C21/C22 del backlog maestro) — HECHOS — rama
`claude/v3-v4-informes-e7sfwf`, PR #91.** Cierra el plan de informes v2 (V0→V4 completo) tras
V1/V2 (C19/C20, PR #89) mergeados el mismo día.

**V3 — informe semanal v2**: sección nueva **"El mundo esta semana"** en la página 3 del PDF
(dólar/Chicago) — Paso 1b nuevo de la skill: research acotado (1-2 subagentes, mismas fuentes/
disciplina que la lente 1/2 de `view-mercado` — CFTC COT, Crop Progress, Brasil, clima solo si
movió precio — con pasaporte verificado, degrada honesto a "sin lectura externa esta semana"
si nada verifica). `getViewMercadoVigentePorGrano()` ahora trae `relacion_previa` (dispara
bullet automático del resumen ejecutivo si algún grano hizo SWITCH esta semana) y
`evidencia_externa`. `getScorecardResumen()` nueva (reusa 1:1 `calcularScorecard` de
`views-scorecard.ts`, cero fórmula nueva) para la regla "scorecard mencionado 1 vez por mes".
**Recorte de layout para no pasar de la página 3**: prop `sinTabla` en `DolarOficialChart`
(omite el `ChartTabla` redundante bajo el gráfico, dato completo sigue en `/dolar`) — medido
con datos reales, la página 3 con la sección nueva quedó exacta en 297mm, ni un pixel de
sobra. **Hallazgo al verificar**: el PDF semanal da `/Count 7`, no 5 — pero medido con
Playwright (altura real de cada hoja) y comparado contra el informe YA ENVIADO el 24/07
(mismo código de esta sesión, datos de antes de V3), el excedente es 100% de la página 5
(tesis largas de V1, `white-space:pre-wrap` sin límite) — **preexistente, no una regresión de
V3** (la página 3 quedó exacta en 1122px en los dos casos). Documentado como posible
calibración futura de `view-mercado`, fuera del alcance del prompt V3.

**V4 — informe diario (retoque)**: el diario ahora recibe `viewsMercado` (con su
`evidencia_externa` ya verificada) en el JSON de insumos — la skill dice explícito que puede
citarla en el `comentario` si es relevante al día, cero fetch nuevo, sigue sin multi-agente
(su valor es salir siempre, rápido). **Medición de consumo real de las 4 Routines (2do punto
de V4): no se pudo completar** — esa telemetría no es visible desde este entorno de código
(vive del lado de la cuenta de Lautoro); queda pendiente real para la próxima vez que él
tenga esos números a mano, o para una sesión que corra como la propia Routine.

**Verificado**: lint/tsc/vitest (224/224, sin tests nuevos — se reusan libs ya testeadas) ✅ ·
build ✅ · corrida en seco real del PDF semanal con Playwright (borrador de prueba insertado y
BORRADO al terminar, cero residuo en `informes_generados`) · `scorecard`/`viewsMercado` con
datos reales de Supabase cotejados a mano (los 3 granos en `nMedidos:0`, correcto — ningún
view real tiene todavía 28 días de historia) · diario y semanal responden 200 sin romper nada.

**Pendiente para la próxima sesión**: mostrarle a Lautoro la primera corrida real del semanal
(recorte del `ChartTabla` + sección nueva) y la medición de consumo de V4 cuando esté
disponible. El resto de los pendientes menores de C18-C20 sigue igual (ver la entrada de abajo).
Detalle completo: [`sesiones/2026-07-28-v3-v4-informes.md`](sesiones/2026-07-28-v3-v4-informes.md).

## Anterior (28/07/2026 — 🎨 REDISEÑO PREMIUM FRONT/UI/UX, mergeado)

**🎨 REDISEÑO PREMIUM FRONT/UI/UX — rama `claude/premium-frontend-design-s3wmcs`, PR #88
(mergeado).** Pedido explícito de Lautaro: llevar el front a nivel "premium, >10K USD" — misma
paleta y logos, tipografías propias (nada de Inter/Roboto), motion medio, "que no parezca IA
genérica". **Fase de diseño primero, sin código**: 3 direcciones maquetadas con datos reales
(A «Sala de operaciones» dark/Fraunces · B «Research de banca privada» claro/Newsreader · C
«Panel de vidrio» glass) + specimen de 4 sistemas tipográficos, todo mostrado y confirmado por
Lautaro ANTES de tocar el código real. Elegido: **híbrido A+B** (un solo sistema de tokens, dos
pieles) + tipografía **T1 «Argentina»** (Piazzolla, Huerta Tipográfica BA + Rosario,
Omnibus-Type + IBM Plex Mono). Skill `ui-ux-pro-max` instalada (de las 7 del bundle
`nextlevelbuilder/ui-ux-pro-max-skill` se conservó solo esa, las otras 6 generan banners/logos
con IA externa, no aplican).

**Build: solo 5 archivos tocados** (`layout.tsx` fuentes · `globals.css` tokens+motion ·
`cinta.tsx` marquee · `chart-export.ts` nombre de fuente) — el sistema de variables CSS pagó:
los otros 70+ componentes heredaron el rediseño completo SIN tocarlos (`--font-ui`/
`--font-mono` mismos nombres, nueva `--font-display` sumada y aplicada quirúrgicamente en
`.panel-hd h2` —todo panel del sitio— + titulares editoriales; los NÚMEROS siguen siempre en
mono, nunca display, restricción deliberada). Motion medio (marquee continuo de la cinta,
entrada en cascada, transición de tema) — todo gated en `prefers-reduced-motion`, cae al
comportamiento de siempre si el usuario lo pidió. **Bug real preexistente encontrado y
arreglado de paso** (verificado contra el código sin tocar antes de atribuírselo): el gráfico
de la calculadora "A fijar" (`calc-fijar.tsx`) tenía un viewBox desproporcionado que volvía
gigantes sus textos — llevado a la misma convención que el resto de los charts del sitio.

**Verificado**: lint/tsc/build ✅ · **205/205 tests** ✅ (sin tocar expects) · Playwright real
con datos de Supabase en claro+oscuro+mobile en home/granos/dólar/producción/gráficos/
calculadoras/noticias/informes/landing/ingresar/comercio(hub)/sin-acceso, cero errores de
consola, cero scroll horizontal en mobile. **Sin verificar**: páginas de mesa gateadas
(`/comercio/*` subpáginas admin, `/granos/view`, `/admin`) — requieren sesión real, comparten
los mismos componentes ya verificados en el resto del sitio (riesgo bajo, no confirmado a
ojo). **Trampa real encontrada**: un `npm run build` cortado por timeout del sandbox puede
corromper `.next` de un modo que NO se nota en el build pero sí sirviendo (chunk 500 con MIME
`text/plain`) — `rm -rf .next` + rebuild limpio lo resuelve; casi se atribuye por error a un
bug de la app. Detalle completo:
[`sesiones/2026-07-28-rediseno-premium-frontend.md`](sesiones/2026-07-28-rediseno-premium-frontend.md).

**Vuelta 2 (misma sesión)**: Lautaro vio el Preview y dijo *"siento que la web prácticamente no
cambió"* — tenía razón: la 1ª pasada fue demasiado conservadora (sin momento fuerte, tipografía
imperceptible). Se le mostró un **antes/después renderizado** y aprobó ("Pushealo y seguí"):
**hero del día en la home** (titular display grande + placa con la pizarra de soja como número
protagonista ~88px serif que cuenta hasta su valor — misma `getPizarra()` cacheada, cero fetch
nuevo, gate `puedeGranos`) + **cabeceras editoriales en las 8 páginas de sección**
(`page-head.tsx`: kicker con fuentes de la sección + título display + lede, reemplaza el h1
invisible + label chiquito) + oscuro más profundo + cascada al doble. Verificado igual que la
vuelta 1 (Playwright claro/oscuro/mobile, 205/205 tests, lint/tsc/build). PR #88 **ready for
review** — Lautaro lo sacó de draft él mismo.

**Vuelta 3 (misma sesión)**: Lautaro dijo "está mejor pero quiero que cambiemos la fuente" +
"que termines con el resto de la web". **Tipografía nueva — sistema «Fundación»** (reemplaza
«Argentina»): Source Serif 4 + Source Sans 3 + Source Code Pro, elegida entre 3 candidatos
clásicos/sobrios renderizados en vivo sobre el sitio real (no specimen abstracto). **Cabeceras
editoriales completadas** en las 8 subpáginas de `/comercio/*` + `/granos/view` que faltaban de
la vuelta 2, y `/produccion` migrada a las mismas clases compartidas. Landing con el eyebrow y
el filo de nav unificados al lenguaje dorado del resto del sitio. Verificado igual que siempre
(205/205 tests, lint/tsc/build, Playwright real). PR #88 al día.

**Pendiente**: feedback de Lautaro sobre la vuelta 3 en el Preview · vistazo logueado a las
páginas de mesa (`/admin`, ahora también con cabecera en sus subpáginas públicas).

## Anterior (28/07/2026 — 📐 V1 (view-mercado v2) + V2 (interpretaciones v2) HECHOS, mergeados)

**📐 V1/V2 de `PLAN_INFORMES_V2.md` §9 (C19/C20 del backlog maestro) — HECHOS — rama
`claude/plan-desarrollo-auditoria-mkdvam`, PR #89 (mergeado).** Retomado el plan de informes
v2 (research multi-agente + aprendizaje continuo) donde había quedado el 24/07 tras C18/V0.

**Antes de arrancar**: repasado un reporte de Lautaro de que el historial editable de "Datos
del día" (A6) no bloqueaba una edición vieja — verificado por SQL que NO es un bug:
`informes_generados` solo tiene una fila real (27/07, la única corrida exitosa post-C18); el
día reportado (24/07) nunca tuvo un informe real que lo tomara. Pendiente real sigue siendo
probar el candado con un caso genuino. De paso, cerrados 2 pendientes menores de V0: la key de
USDA FAS (Lautaro la registró y cargó como env var del entorno de Claude) y la confirmación de
que las Routines headless tienen el tool `Task` disponible (confirmado por config del
`job_config`, no hacía falta un test en vivo — el fan-out de V1 es viable).

**V1 — view-mercado v2**: la skill pasa de un prompt lineal a un pipeline **F0→F6**
(invalidadores mecánicos → fan-out de 4 subagentes de solo lectura → view **blind-first** →
reconciliación CONFIRMA/AJUSTA/SWITCH/CUMPLIDA con "recorrido de la tesis" → abogado del diablo
→ verificación mecánica de pasaportes → salida). `getSenalCamiones()` sumado a los insumos
(`/api/views/insumos`) — respondía "quién pone el precio" y estaba ausente. **`src/lib/views-
scorecard.ts`** (lib pura, 17 tests): hit-rate 1/2/4 semanas + Brier contra `futuros_cierres`,
con la posición fijada UNA VEZ en t0 (nunca re-elegida — así un rolleo de contrato en medio de
la ventana degrada a `null` en vez de contaminar la medición). Migración aditiva sobre
`views_mercado` (relacion_previa, view_previo_id, invalidadores, evidencia_externa,
nota_lautaro) + `admin_feedback_view` extendida con el parámetro de nota (dropeando la firma
vieja de 2 argumentos para no dejar overloads ambiguos en PostgREST). UI de `/granos/view`:
badges de relación con la tesis previa, fila de scorecard, invalidadores 🟢/🔴 (sin fabricar un
🟡 "cerca" que el plan pedía — no hay umbral machine-checkable sin inventar un parser de texto
libre, documentado como limitación explícita) y selector de nota 1-5.

**V2 — interpretaciones v2**: verificado con un fetch real (28/07) que un artículo pre/post-
WASDE completo de **DTN** muestra la tabla de expectativas (Avg/High/Low) sin paywall — queda
como fuente primaria. El Paso 9 de `informe-diario` suma, solo para USDA, un research acotado
(≤10 tool calls) con la estructura *qué se esperaba → qué salió → sorpresa → reacción del
precio → qué implica*, pasaporte verificado guardado en `evidencia_externa` (columna nueva en
`interpretaciones`). GEA/DEA/CONAB/PAS degradan a "consenso implícito" (sin encuesta pública).
**Fix crítico encontrado y arreglado**: el disparo del Paso 9 filtraba solo por
`fecha_publicacion === hoy`, que nunca matcheaba el día real en que Lautaro sube el BCBA-PAS
(fecha real del informe, de días atrás) — `construirCambios` ahora expone `actualizadoEn` y el
filtro dispara con cualquiera de las dos fechas, probado con un test unitario real.

**Cambios de modelo pedidos por Lautaro en el camino**: `view-mercado` quedó en `effort: high`
(probó `medium`, volvió a `high`); `informe-diario` quedó en `effort: medium` (antes `high`);
`informe-semanal` sin tocar.

**Verificado**: lint/tsc/vitest (224/224, 19 nuevos) ✅ · build ✅ (`next build --webpack`, el
sandbox de esta sesión no tenía los bindings nativos de Turbopack — no es regresión de código,
CI real sí los tiene y pasó verde) · V1 cotejado contra datos reales de Supabase (scorecard del
view real del 21/07) · V2 regenerado en seco el WASDE #673 contra la interpretación publicada
(mismos números duros, capa de expectativa nueva donde DTN la tiene — soja EEUU, coincide con
nuestro dato real — y degradación honesta donde no) · migraciones aplicadas + verificadas por
SQL + `get_advisors` sin hallazgos nuevos · PR #89 con CI verde, mergeado.

**Pendiente para la próxima sesión**: **V3** (informe semanal — depende de V1, ya mergeado) y
**V4** (diario, retoque + medición) — prompts ya escritos en `PLAN_INFORMES_V2.md` §9.
Confirmar en la primera corrida real de cada Routine el consumo/duración del pipeline nuevo
(línea de base para R5 del plan). El candado de "Datos del día" (A6) sigue sin un caso real
confirmado end-to-end. Detalle completo:
[`sesiones/2026-07-28-c19-c20-view-mercado-interpretaciones.md`](sesiones/2026-07-28-c19-c20-view-mercado-interpretaciones.md).

## Anterior (27/07/2026 — 🔐 LOGIN ENCENDIDO (A1) + 🚨 C18/V0 CERRADO: las 3 Routines de informes funcionando de punta a punta)

**🔐 A1 — TERMINAR EL LOGIN — ✅ CERRADO — sesión conversacional, sin rama de código.** Lautaro
confirmó que el **Centro de verificación de Google** ya mostraba "Se verificó la información de
tu marca" (efecto del rebranding + dominio del 24/07) → publicó la app de Google a producción
(*Publish App*, sin necesitar revisión manual — scopes básicos email/perfil) → prendió
**`AUTH_ENFORCED=true`** en Vercel (scope Production) + Redeploy. **Chequeo por SQL antes de
prender** (`profiles`): solo su cuenta existía (`admin`/`aprobado`), 0 empresas, 0 pendientes →
sin riesgo de bloquear a nadie. **Verificado**: incógnito a `rofoagro.com.ar` → aparece
`/bienvenida` (login cerrado, como se esperaba).

**🐛 Bug real encontrado y arreglado en el mismo momento (sin código, config de Supabase):** el
login con Google devolvía a `http://localhost:3000/?code=...` (`ERR_CONNECTION_REFUSED`) — NO era
el navegador esta vez (a diferencia del incidente del 24/07 en `sesiones/2026-07-24-a6-prueba-en-
vivo-dea-fix.md`). Causa raíz: `google-button.tsx` pide volver a `<dominio-real>/auth/callback`,
pero Supabase valida ese destino contra su lista blanca de **Redirect URLs**, que seguía con las
URLs viejas (`rofoagro-research-web.vercel.app` + `localhost:3000`) — nunca se agregó
`rofoagro.com.ar` al conectar el dominio el 24/07. Al no matchear, Supabase descarta el
`redirectTo` pedido y cae al **Site URL** por defecto, que había quedado en `http://localhost:3000`
desde el setup inicial (de ahí el `/?code=...` en la raíz, sin `/auth/callback`). **Fix**: Supabase
→ *Authentication → URL Configuration* → Site URL a `https://rofoagro.com.ar` + agregado
`https://rofoagro.com.ar/auth/callback` y `https://rofoagro.com.ar/**` a Redirect URLs (sin borrar
las viejas). Confirmado por Lautaro: login con Google funciona de punta a punta con el dominio
real.

**Pendiente para consolidar (no bloquea, próxima sesión con tiempo):**
- ~~Que Mauro se registre y se lo promueva a admin~~ → **✅ HECHO (27/07)**: verificado por SQL,
  `f.maurotam@gmail.com` ya está `rol=admin`/`estado=aprobado` en `profiles`.
- **A6** casi cerrado, gran avance 27/07 (rama `claude/plan-desarrollo-auditoria-ybjj6k`, PR #86
  mergeado):
  - ~~DEA-SAGyP~~ → **✅ HECHO**, con Lautaro en vivo. Subió el CSV real (~11 MB) desde
    `datosestimaciones.magyp.gob.ar`, previsualizó y confirmó — 24 filas cargadas/actualizadas,
    vintage `2026-07-27` (antes clavado en `2026-07-13`, 14 días viejo). El fix del
    parseo-en-el-navegador (24/07) funciona de punta a punta — **healthcheck de DEA debería
    volver a verde**.
  - ~~Comercialización (Agrochat)~~ y ~~Camiones (Williams)~~ → **✅ HECHAS, con un bug real de
    origen encontrado y arreglado** (no de la web): en los dos casos, lo que Agrochat devuelve ya
    transformado al formato que pedíamos sale como texto de una celda de dataframe (sin salto de
    línea real, no descargable) — Lautaro no podía subirlo. Fix: los dos parsers
    (`parse-agrochat.ts`/`williams.ts`) ahora aceptan directo el dataset **crudo** de origen (SÍ es
    un archivo real) y replican en TypeScript la misma transformación (filtra filas "Total", ×1000
    a toneladas enteras con truncado — reproduce bit a bit los artefactos de Python). Verificado
    90/90 y 80/80 filas contra los datos reales de Lautoro, cargado en producción.
  - ~~BCBA-PAS~~ → **✅ HECHO**, con el `historico_pas_datasets.csv` correcto (400 filas
    cargadas/actualizadas, 1 campaña descartada por venir idéntica a la anterior — comportamiento
    esperado). De paso, Lautaro pasó un export alternativo con desglose por zona agroecológica →
    anotado como ítem nuevo del backlog (**C23**, `auditoria/E7-sintesis.md` §4).
  - ~~Compras BCRA (carga manual)~~ → **✅ HECHO**: Lautaro cargó 22/23/24-07 (345/45/25 M USD)
    desde la web, verificado por SQL.
  - ~~Pago final LECAP~~ → **✅ HECHO**: 12 especies cargadas (8 letras S + 4 BONCAPs T) desde la
    tabla de BYMA, verificado por SQL contra `lecap_pago_final`. Los BONCAPs quedan guardados pero
    sin efecto visible en `/dolar` todavía (`getLecaps` solo lee precio en vivo de las letras S —
    pendiente menor, no bloquea).
  - **A6 QUEDA CERRADO** salvo un ítem chico sin probar: el historial editable de "Datos del día"
    (editar un día viejo + confirmar el bloqueo 🔒) — nunca llegó a probarse en esta sesión ni en
    la del 24/07, pero es el único de los 7 sin confirmar.
  - Pedido nuevo de Lautoro al cerrar: **C24** anotado en el backlog (`auditoria/E7-sintesis.md`
    §4) — carga diaria manual de camiones vía la cuenta de X de Agroentregas, mismo patrón que la
    carga manual de compras BCRA, para tapar el hueco hasta que llegue el archivo real de Williams
    (que la pisa sola, mismo upsert de siempre).
- Login prendido = **C18/V0 pasa a ser lo más urgente del backlog** (las 3 Routines de informes
  siguen sin producir nada — ver la entrada de abajo del 24/07).
- ~~Renames de plataforma~~ → **✅ HECHOS (27/07), a mano por Lautaro, sin acción de código
  (verificado sin referencias funcionales al nombre viejo — ni en `src/`, ni en workflows)**:
  repo de GitHub → `ROFOAGRO_RESEARCH_WEB` · proyecto Vercel → `rofo-agro-web` · proyecto Supabase
  → `ROFO_AGRO_BASES_DE_DATOS` (mismo `ref` `gbpfgfeksqmzmsxnxiwg`, sin impacto en la conexión).
  Pendiente menor sin urgencia: si hay un remitente propio de Resend con el nombre viejo cargado
  como env var en Vercel, actualizarlo a mano (el default del código ya dice ROFO AGRO).

Detalle: [`sesiones/2026-07-27-a1-login-encendido.md`](sesiones/2026-07-27-a1-login-encendido.md).

**🚨 C18/V0 — LAS 3 ROUTINES DE INFORMES, DIAGNOSTICADAS Y ARREGLADAS (misma sesión, mismo PR
#83).** Lautaro pasó las alertas reales de Gmail (healthcheck en rojo, "FALLÓ el informe diario —
401", ingesta line-up en rojo) → destapó el hallazgo del 24/07 ("las 3 Routines disparan y no
producen nada"). Cadena de 3 causas reales, todas encontradas y arregladas:
1. **`INFORME_TOKEN` desincronizado** entre el entorno de Claude Code y Vercel Producción → 401 en
   `/api/informes/datos` y `/api/views/insumos`. Token nuevo generado y cargado en los dos lados,
   verificado con `curl` real → 200.
2. **`ingest-lineup` — falso positivo de lunes**: la ventana diaria (hoy+2 días) caía enteramente en
   fin de semana (Lun+Dom+Sáb) si corría antes de que ISA publicara el lunes. Ventana ampliada a 4
   días.
3. **Bug real de producción, regresión del mismo A1**: `/informes/plantilla/{diario,semanal}` (las
   páginas que Playwright screenshotea) quedaron atrás del gate de `AUTH_ENFORCED` — `src/proxy.ts`
   solo exceptuaba `/api/informes/` y `/api/views/`. La Routine se llevaba el HTML de `/ingresar` en
   vez de la placa. Fix en `proxy.ts` (verificado seguro: las plantillas ya validan su propio
   `INFORME_TOKEN` internamente) + documentado en las skills `informe-diario`/`informe-semanal` el
   workaround de Playwright detrás del proxy del sandbox (TLS 1.3 rompe con `ERR_CONNECTION_RESET`,
   hace falta `proxy.server` + forzar TLS 1.2) + pin de `model: claude-opus-5`/`effort: high` (la
   prosa con la voz de Lautaro la escribe el modelo grande). `view-mercado` no lo necesitaba (sin
   Playwright, modelo ya fijado a nivel de Routine). **El informe diario del 27/07 se generó y mandó
   completo, de punta a punta**, como prueba en vivo. Detalle completo (incluida la pista falsa de
   `add_repo`, que no existe en el entorno headless de las Routines — el acceso real es `git clone`
   directo por el proxy):
   [`sesiones/2026-07-27-c18-routines-diagnostico.md`](sesiones/2026-07-27-c18-routines-diagnostico.md).

**Las 3 Routines verificadas de punta a punta en el mismo día, post-fix**: informe diario
(enviado, 27/07) · informe semanal (enviado, semana 18/07–24/07, "El trigo se lleva la semana") ·
view de mercado (3 granos guardados, 27/07 — soja bajó de alcista a NEUTRAL por el crush
cerrándose + Chicago -3% en el día; maíz ALCISTA por gap de cobertura abriéndose; trigo NEUTRAL,
corto firme pero exportación ya cubrió lo declarado). Confirmado dos veces, en sesiones
independientes, que **`add_repo`/`register_repo_root` no existen en el entorno headless de las
Routines** — el camino real es `git clone` directo (hay `GH_TOKEN`/proxy configurado, sin pasos
extra); los 3 prompts se limpiaron de esa instrucción falsa.

**Pendiente de V0 (no bloquea, menor)**: feedback real de Lautaro sobre el contenido/formato del
informe del 27/07 · cargar la key gratuita de USDA FAS · confirmar si una Routine invoca
subagentes (precondición de V1) · evaluar en una sesión de calibración el aprendizaje que propuso
la sesión del view ("índice MESA caliente + dirección cerrándose + Chicago corrigiendo en el día →
leer neutral, no alcista" — una sola observación, no aplicar todavía a `references/aprendizajes.md`
sin más casos).

## Anterior (27/07/2026 — 🧰 13 skills técnicas nuevas de skills.sh)

**🧰 SKILLS TÉCNICAS DE SKILLS.SH — HECHO — rama `claude/project-skills-analysis-r0o67y`,
PR #84.** Lautaro pasó 16 skills candidatas de [skills.sh](https://www.skills.sh/) para
evaluar; se analizaron a fondo (2 agentes en paralelo: contenido real de cada `SKILL.md` +
research propio del directorio buscando qué más sirve para este proyecto puntual) y se
instalaron **13** vía `npx skills add` (quedan en `.agents/skills/<nombre>/` con symlink en
`.claude/skills/<nombre>` + `skills-lock.json` en la raíz — mismo mecanismo que las 4 skills
propias del proyecto, sin colisión de nombres): `supabase` + `supabase-postgres-best-practices`
(oficiales de Supabase) · `vercel-react-best-practices` + `vercel-composition-patterns` +
`web-design-guidelines` (vercel-labs) · `frontend-design` + `webapp-testing` (anthropics) ·
`grill-with-docs` (mattpocock — elegida sobre `grill-me` del mismo autor por anclar en docs
existentes, que es la cultura de este repo) · `find-skills` (vercel-labs) ·
`verification-before-completion` + `systematic-debugging` (obra/superpowers) ·
`data-quality-frameworks` + `backtesting-frameworks` (wshobson). **Descartadas** (de las 16):
`vercel-react-native-skills` (mobile, no aplica) · `css-animations` de heygen-com (específica
de otro producto) · `nextjs-supabase-auth` (repo chico, nuestro login ya está construido a
medida) · `vercel-react-view-transitions` (requiere React Canary) · `deploy-to-vercel`
(contradice el protocolo de deploy por PR) · `agent-browser` (redundante con Playwright, que
ya usamos) · `typescript-advanced-types` (valor marginal, ya en strict) ·
`improve-codebase-architecture` (se solaparía con la auditoría E1→E7 recién cerrada — queda
para más adelante si hace falta). **Verificado**: revisado el contenido completo de las 2
skills con Snyk "Med Risk" (`find-skills`, `web-design-guidelines`) antes de commitear —
ambas son solo markdown, nada ejecutable · `npm install` (el sandbox no tenía `node_modules`)
· lint/tsc/build ✅ · 201/201 tests ✅ (sin tocar código, solo se agregan archivos de skills).
Detalle completo con el veredicto skill por skill:
[`sesiones/2026-07-27-skills-tecnicas.md`](sesiones/2026-07-27-skills-tecnicas.md).

## Anterior (24/07/2026 — 📐 PLAN INFORMES V2 mergeado + 🚨 las 3 Routines NO producen nada + 🔍 detector de anomalías al backlog)

**🚨 HALLAZGO AL CERRAR EL PLAN — LAS 3 ROUTINES DISPARAN Y NO PRODUCEN NADA.** Verificado por
SQL contra la base real el 24/07: **`informes_generados` está VACÍA** (el informe diario viene
disparando desde el 23/07 y nunca generó una sola placa) y la Routine del view **disparó hoy a
las 9:07 ART sin dejar fila en `views_mercado`** (los únicos 3 views son los del 21/07, hechos a
mano en la sesión de MP3). Fallan **en silencio**: no hay error visible ni mail de aviso, por eso
nadie lo notó en 2 días. Esto convierte a **V0 (verificar el piso) en urgente y bloqueante** —
no tiene sentido construir el pipeline de research encima de un motor que no arranca. Registrado
como **C18** en el backlog maestro. *(Nota menor: las 3 Routines todavía se llaman "RF AGRO" en
su nombre — renombrar a ROFO AGRO cuando se toquen.)*

**🔍 DETECTOR DE ANOMALÍAS EN INGESTAS — AL BACKLOG (D7 = L7, prompt completo en E7 §6).** Salió
de una pregunta de Lautaro ("¿se le puede agregar machine learning? ¿tiene sentido?"). Respuesta
razonada: para **generar el view NO** (hoy 3 filas en `views_mercado` y cero feedback; aun con un
año entero serían ~156 observaciones muy correlacionadas — no alcanza para entrenar nada), y el
enfoque LLM+estructura es el correcto para eso. Sí tiene sentido, **más adelante y con el
scorecard como prerrequisito**, para problemas puntuales sobre los datos de mercado que ya
existen (relación físico→precio con 6 años de line-up/DJVE; sesgo sistemático de organismos). Y
lo que **sí conviene ya** es un detector estadístico (no ML) sobre los valores que entran: hoy se
chequea **frescura** (healthcheck) y **0 filas** (guard anti falso-verde), pero nadie valida que
un valor sea plausible contra la historia de su propia serie — por eso pasaron sin detección la
semana del 08/07 ÷1000, los 529 valores en 6.4e15, el spike de 49,9 Mt, el typo de BCR en pellets
de girasol y la fila del PAS duplicada byte-a-byte. Seis chequeos (MAD, orden de magnitud,
monotonía CON alerta en vez de clamp silencioso, identidades contables, duplicado exacto, rangos
imposibles), umbrales **por tipo de dato** (precios volátiles ≠ acumulados ≠ conteos estacionales)
y **calibración retroactiva contra los bugs conocidos** antes de instalarlo. Independiente de
todo lo demás.

**📐 PLAN INFORMES V2 — HECHO Y MERGEADO (solo docs, cero código) — rama
`claude/informes-skills-alternativas-9fvo9f`, PR #81.** Lautaro pidió llevar los informes
(diario/semanal/view/interpretaciones) "a otro nivel": Fable orquestando agentes de research
(web propia + fuentes externas) y un view de mercado **acumulativo** ("bola de nieve": tesis
previa + lo nuevo de cada semana, con switches por eventos — como piensa un trader) — pero
ANTES cuestionarlo a fondo y hacer research real. Resultado:
**[`PLAN_INFORMES_V2.md`](PLAN_INFORMES_V2.md)** (crítica con evidencia → 9 riesgos con
mitigación estructural · 7 principios · fuentes externas VERIFICADAS con requests reales hoy
· pipeline F0-F6 del view v2 · migración mínima + scorecard · loop de aprendizaje
formalizado · 5 fases V0→V4 con prompts autocontenidos · criterios de éxito medibles).
**Research (3 agentes en paralelo)**: (1) el anclaje en LLMs NO se arregla con instrucciones
(medido) → **blind-first** (view provisorio sin ver la tesis previa, reconciliar después);
citas de deep-research 11-57% problemáticas → **pasaporte** URL+fecha+cita verificado;
consolidación automática de memoria medida como destructiva → destilación manual gateada +
cap. (2) Fuentes nuevas verificadas: **CFTC COT** (fondos, 200 sin key, Socrata con
histórico), **DTN** (tablas expectativa-vs-dato pre/post-WASDE sin paywall — el salto de
calidad de MP4), Crop Progress TXT, EIA etanol, SMN; bloqueados confirmados: AgWeb/
SuccessfulFarming/Agrolink/CME-FTP/INMET. (3) Inventario: `views_mercado` sin relación entre
views (la bola de nieve no tiene soporte en datos hoy), `aprendizajes.md` VACÍO, **0
disparos reales verificados de las 3 Routines** → por eso la fase **V0 es verificar el piso**
antes de sofisticar. Decisiones clave: el diario NO se sofistica (sale siempre, rápido);
interpretaciones previas = calibración de criterio, nunca fuente de números (números siempre
de cero del dato crudo); fetch-en-vivo sin ingesta nueva en v1. **Auditoría adversarial del
propio plan (mismo día)**: 3 hallazgos CRÍTICOS corregidos antes de mergear — (a) el disparo
de BCBA-PAS filtraba por `fecha_publicacion` y NUNCA hubiera matcheado el día real de carga
(fix: usar `actualizado_en`, que ya existe en `estimaciones_produccion`); (b) faltaba
`getSenalCamiones()` (C5, ya construida) en los insumos del view — justo el dato de "¿quién
pone el precio?"; (c) el scorecard no fijaba la posición del contrato en t0 → el hit-rate se
hubiera contaminado con el salto de rolleo. + 8 hallazgos menores, todos aplicados y marcados
`[fix auditoría]` en el texto. **Las 4 decisiones de §10 ya contestadas por Lautaro**: nota
1-5 en el feedback SÍ · semanal se queda en **5 páginas** (lo nuevo entra recortando) · COT
solo en semanal/view, no en el diario · key gratuita de USDA FAS la registra él antes de V0.
**V0→V4 ya registradas en el backlog maestro como C18-C22** (E7 §4), junto con el detector como
D7/L7. **Próximo paso: ejecutar C18/V0** — diagnosticar por qué las 3 Routines no producen nada
(ver el hallazgo de arriba), primer feedback real de Lautaro en `/granos/view`, cargar la key
FAS — **y después V1→V4** (prompts autocontenidos en §9 del plan). Detalle:
[`sesiones/2026-07-24-plan-informes-v2.md`](sesiones/2026-07-24-plan-informes-v2.md).
## Anterior (24/07/2026 — 🏷️ REBRANDING RF AGRO → ROFO AGRO, texto + logo real HECHO; solo renames de plataforma EN VUELO)

**🏷️ REBRANDING RF AGRO → ROFO AGRO — rama `claude/rf-agro-rofo-agro-rebrand-gb7syg`, PR #80.**
Retoma el pendiente anotado el 23/07 (dominio `rofoagro.com.ar` ya conectado y verificado ese día;
faltaba "el rebranding del sitio"). Lautaro pidió, explícitamente y varias veces, que no quede
"RF AGRO" en NINGÚN lugar bajo ningún punto de vista — código, docs, ni plataformas externas.
**Barrido de texto HECHO y verificado**: `grep -rli "rfagro|RF AGRO|RFAGRO" -i .` (fuera de
`node_modules`/`.git`/`.next`) encontró **127 archivos**; reemplazados por orden de variante
(mayúsculas/guiones/minúsculas) con un script `perl -pi -e` — cubre componentes/páginas
(`<title>`, wordmark de header/footer/auth/admin/landing/legal), emails (`auth/emails.ts`),
placas de informes, marca de agua de gráficos, user-agents de los scrapers, migraciones SQL,
Edge Function `dea-fetch`, scripts de ingesta, workflows, `package.json`, `.env.local.example` y
TODA `docs/` (incluidos los `sesiones/*` históricos — a propósito, por el pedido explícito de no
dejar ninguna mención vieja, apartándose del criterio habitual de "no reescribir bitácoras").
**2ª pasada** encontró texto partido que ese grep no veía: el wordmark del header/footer/auth/
admin/legal/landing/404 se arma con 2 `<span>` de color (`RF`+`AGRO` sin espacio entre tags) y el
email de Resend usaba `RF&nbsp;AGRO` (entidad HTML) — corregidos los 7 componentes + el email +
un comentario de `globals.css`; verificado con Chromium headless contra el server real (`npm run
start`) que el header ya dice "ROFO AGRO" de verdad, no solo en el `<title>`.
**Logo real HECHO**: Lautaro lo había subido por el chat pero nunca llegó al filesystem de la
sesión — resultó que lo subió directo por la web de GitHub ("Add files via upload" a `main`,
`public/ROFO SVG.svg` + un PNG de referencia, este último con "RF AGRO" en el nombre del archivo);
recuperado con `git show origin/main:"..."` y, al mergear `main`, ambos movidos de `public/`
(donde quedaban servidos como estáticos) a `docs/marca/rofoagro-{fuente.svg,referencia.png}`
(nombre limpio, ya no público).
Del SVG completo (2000×2000, auto-trace de 285 paths sin `<text>`, con los 3 íconos + wordmark +
bajada "Consultora de agronegocios") se extrajeron por bucketing de posición **los 3 assets reales**
(`rofoagro-isotipo.svg` solo íconos, `rofoagro-logo.svg`/`rofoagro-logo-marca.svg` logo completo,
ambos transparentes y recortados) y se optimizaron con `svgo` (-68% de peso). Verificado
renderizando sobre fondo claro/oscuro antes de reemplazar los archivos de producción.
Assets renombrados `public/rfagro-*.svg` → `public/rofoagro-*.svg`. Verificado: lint/tsc/
tests(201/201)/build ✅ · cero ocurrencias remanentes (incluidas las partidas) en el repo, en el
HTML compilado y en el server corriendo de verdad.

**Quedó pendiente (solo renames de plataforma, sin tool disponible para hacerlos desde acá, ver
detalle en la sesión)**: (1) **Nombre del repo en GitHub** — queda como paso manual de Lautaro
(Settings → Repository name) — ojo, hacerlo DESPUÉS de mergear este PR para no romper el remote de
la sesión en curso. (2) **Nombre del proyecto en Vercel** — no bloquea nada (el dominio productivo
ya es `rofoagro.com.ar`) pero el subdominio `*.vercel.app` de fallback seguirá diciendo
`rfagro-research-web` hasta que lo cambie a mano. (3) **Resend** — si hay un remitente propio
cargado como env var en Vercel con el nombre viejo, actualizarlo a mano (el default del código ya
dice ROFO AGRO). **Sin acción en Supabase** (el proyecto se llama `lineup-argentina`, nunca tuvo
el nombre de marca). Detalle completo:
[`sesiones/2026-07-24-rebrand-rofo-agro.md`](sesiones/2026-07-24-rebrand-rofo-agro.md).

## Anterior (24/07/2026 — 🧪 A6: probando el uploader real → 1 bug encontrado y arreglado + feature nueva, TRABADO en el login)

**🧪 A6 EN VIVO CON LAUTARO — historial editable de "Datos del día" + bug real de la DEA
encontrado y arreglado — PR #77 (mergeado).** Arrancó como el repaso conversacional del bloque A
(abajo, en «Anterior») pero Lautaro pidió ir probando el uploader de `/admin/datos` **uno por uno,
en vivo**, guiado paso a paso con link + filtros exactos de cada fuente. Lo que pasó:

1. **"Datos del día" (color de la rueda) — PROBADO, funciona.** Lautaro cargó un texto real
   ("Rueda floja con pocos negocios de todo.") y confirmó el guardado.
2. **Pedido nuevo en el momento**: que el historial de "Datos del día" sea **visible y editable**
   hasta que el informe diario ya lo haya tomado, y de ahí en más quede fijo. Construido en la
   misma rama: `/admin/datos` ahora muestra los **últimos 14 días con dato**, cada uno con su
   propio "Editar"/"Cargar", y la fila pasa a solo-lectura (🔒) apenas existe un registro en
   `informes_generados` (tipo=diario) para esa fecha — guard también en la server action, no solo
   en la UI. Cero migración nueva.
3. **DEA-SAGyP — bug real encontrado y arreglado.** Al probar con el CSV real (~11,5 MB, descargado
   de `datosestimaciones.magyp.gob.ar`), "1 · Previsualizar" tiraba **"This page couldn't load"**
   en el navegador de Lautaro. Causa raíz confirmada por los logs de Supabase Auth + el código: las
   Server Actions de Next en Vercel tienen un límite de payload de **~4,5 MB por función** (no
   configurable vía `next.config`, distinto del `bodySizeLimit: 16mb` que ya estaba seteado ahí —
   ese es un límite de Next, no de la plataforma). **Fix**: `parseDea`/`resumenFilas`
   (`src/lib/parse-dea.ts`) son módulos puros sin `server-only` → el parseo/agregado a nacional
   ahora corre **en el navegador** al clickear "Previsualizar" (sin red); solo el resumen ya
   agregado (unas pocas decenas de filas) viaja al servidor en "Confirmar y cargar". Misma UI/UX de
   siempre. **Sin confirmar todavía que el fix funciona de punta a punta** (ver bloqueo abajo).
4. **BLOQUEADO en el login**: Lautaro pidió la contraseña de su cuenta (no existe — el sitio no
   guarda contraseñas propias, es Google OAuth + un form de email/contraseña separado que
   probablemente nunca tuvo contraseña seteada). Al reintentar con Google, el navegador tiraba
   `ERR_CONNECTION_REFUSED` en `localhost:3000/?code=...`. **Diagnosticado por los logs de Supabase
   Auth** (`referer: http://localhost:3000` en los eventos `/authorize` y `/callback`, login
   exitoso del lado de Google/Supabase): el navegador de Lautaro tiene `localhost:3000` en la barra
   de direcciones (probablemente autocompletado de una prueba vieja), que no es un sitio real —
   nada que ver con nuestro código ni con Supabase. Se le indicó escribir a mano
   `rfagro-research-web.vercel.app` en vez de `localhost:3000`. **Sesión cortada en este punto sin
   confirmar si pudo volver a entrar.**

**Verificado del lado del código**: lint/tsc ✅ · `npx vitest run` 201/201 (sin tocar expects) ·
`npm run build` ✅ (2 veces, antes y después del fix de DEA) · PR #77 con CI verde, mergeado.
**Verificado con Lautoro en vivo**: solo el punto 1 (Datos del día). El resto —el historial nuevo,
el fix de DEA, y las 5 secciones que nunca se probaron (comercialización Agrochat, camiones
Williams, BCBA-PAS, compras BCRA manual, pago final LECAP)— **sigue sin confirmar**.

### Qué falta probar de la parte de Datos (para la próxima vez que Lautoro tenga tiempo)

Con acceso real a `/admin/datos` (usando `rfagro-research-web.vercel.app`, no `localhost:3000`):

- [ ] **Historial de "Datos del día"** (nuevo): editar un día viejo del historial y guardar; y
  confirmar que un día que ya tiene informe diario generado aparece bloqueado (🔒).
- [ ] **DEA-SAGyP**: reintentar con el mismo CSV que falló — bajarlo de
  `datosestimaciones.magyp.gob.ar` (botón de descarga del reporte "Estimaciones", dataset completo
  sin filtrar) y subirlo. Es la más urgente: mientras no se cargue una vez real, el healthcheck de
  DEA sigue en rojo.
- [ ] **Comercialización (Agrochat)**: copiar el prompt de la tarjeta, pedírselo a Agrochat, subir
  el CSV/xlsx que devuelva.
- [ ] **Camiones en puerto (Williams)**: mismo patrón, prompt de camiones (elegir serie: total o un
  grano puntual).
- [ ] **BCBA-PAS**: bajar específicamente `historico_pas_datasets.csv` de
  `bolsadecereales.com/estimaciones-agricolas` (NO `reporte_1.xlsx`, formato distinto que el
  uploader rechaza a propósito) y subirlo.
- [ ] **Compras BCRA (carga manual)**: cargar el monto del día que él ya conoce de su fuente
  habitual (no hay un link fijo — está documentado como decisión, no como fuente automatizable).
- [ ] **Pago final de LECAP**: pegar `TICKER PAGO_FINAL VENCIMIENTO` (de su Excel, IAMC o BYMA).

Detalle completo con los links y filtros exactos de cada fuente: este mismo chat (o repetir el
pedido "guiame paso a paso" en la próxima sesión, que ahora ya tiene la info más precisa
registrada acá). Nada de este bloqueo es un problema de la web — es acceso (el tema del
`localhost:3000`) y disponibilidad de tiempo de Lautoro para bajar los archivos reales.

## Anterior (24/07/2026 — 🧹 repaso del bloque A de manuales del backlog maestro)

**🧹 REPASO DEL BLOQUE A (pasos manuales) — sesión conversacional, sin rama de código, solo
`docs/auditoria/E7-sintesis.md` §4/§7.** Lautaro contestó en bloque 4 pendientes del bloque A:
**A4** (borrar ramas remotas mergeadas) — verificado con `git ls-remote --heads origin` que no
queda ninguna rama remota salvo `main` (ya se habían limpiado solas con el flujo normal de PR) →
cerrado sin acción. **A1** (login/dominio) — Lautaro avisó que el dominio propio se está validando
por Vercel, un paso más cerca de retomar la verificación de marca de Google; sigue abierto, sin
cambio de código. **A6** (probar el uploader de `/admin/datos` logueado) — pidió más precisión:
se detalló que hoy son **7 secciones** (creció desde el PR #44 original: comercialización
Agrochat, camiones Williams, datos del día/color de la rueda, compras BCRA manual, DEA-SAGyP,
BCBA-PAS, pago final de LECAP), cada una con su propio paso a paso — sigue pendiente que Lautaro
las pruebe, con la DEA como la más urgente (mientras no se cargue una vez real, su healthcheck
sigue en rojo). **A8** (leaked password protection) — descartado por ahora a pedido explícito.
Sin cambios de código; el detalle completo queda en `E7-sintesis.md` §4 (bloque A) y §7 (Bloque 6).

## Anterior (24/07/2026 — 💰 C16/P11 (capacidad de pago: BCR vs Nuestro vs Pizarra) HECHO)

**💰 C16/P11 — CAPACIDAD DE PAGO: BCR vs NUESTRO vs PIZARRA, con research profundo (Fable) —
HECHO — rama `claude/c16-payment-capacity-formulas-0de77e`, PR #_.** Pedido explícito de Lautaro,
distinto al paso 1 original del prompt P11 (que esperaba SU fórmula a mano): investigar con
profundidad las metodologías de capacidad de pago/FAS teórico (tema que él mismo calificó de
"controversial"), qué otros organismos la calculan, y construir un modelo propio usando FOB de
MAGyP — con el tablero mostrando BCR / Nuestro / Pizarra y el diferencial de cada uno. Adjuntó el
PDF de metodología de BCR (26/10/2021) como insumo. **Research (agente Fable, WebSearch/WebFetch +
reconocimiento propio con requests reales)**: homologó una **API JSON pública de FOB oficial de
SAGyP/MAGyP** (`ws/ssma/precios_fob.php`, alcanzable desde el mismo dominio que ya usa
`ingest-compras.mjs` — no el subdominio bloqueado) — es la fuente independiente que alimenta
"Nuestro"; confirmó que SAGyP publica su propio FAS teórico (Res. 42/2007, sin API); relevó otros
organismos (Bahía Blanca, Cámara Arbitral Rosario, BCBA, Bolsa Córdoba, consultoras) sin hallar
ninguno con metodología propia distinta a BCR salvo el oficial; confirmó reintegro 0% vigente para
grano sin procesar; documentó la controversia real (expectativa de baja de retenciones adelantada
al precio — fyo/Infocampo oct-2025 — y que BCR excluye por diseño cualquier margen de riesgo del
exportador). **Homologación empírica de posiciones NCM** (sin nomenclador legible): cruce numérico
por fecha entre la API y el dataset con nombres de datos.gob.ar — desambiguó maíz estándar (no
pisingallo, pese a compartir prefijo NCM), trigo pan (no candeal/durum) y girasol aceitero (no
confitero), los 3 casos donde un mapeo ingenuo por texto hubiera fallado. **Build**:
`fob-oficial.ts` (FOB oficial diario, con reintento T-1 hasta 7 días) · `capacidad-modelo.ts`
(cálculo propio puro: misma estructura que BCR + margen de riesgo EXPLÍCITO default 0, la
controversia hecha perilla) · `capacidad-bcr-parse.ts` (parser de BCR REESCRITO — el viejo perdía
sorgo/girasol enteros al mezclar 2 granos por bloque HTML; regla nueva verificada por consistencia
aritmética real: impuestos÷FOB = alícuota DEX vigente, exacto) · panel extendido a los 5 granos
que BCR calcula (sumó sorgo y girasol) con tabla BCR|Nuestro|Pizarra|Dif.BCR|Dif.Nuestro coloreada
sobrepagado/subpagado + desplegable de supuestos editables (retenciones/reintegro/gastos
portuarios/gastos comerciales/margen de riesgo) que recalcula "Nuestro" en vivo en el navegador.
`semaforo.ts` (`/comercio/senal`) se dejó anclado a `fasBcr` a propósito (esa señal ya estaba
calibrada contra ese número; no se le cambia la fuente como efecto secundario). **Bug real
encontrado y corregido antes de mostrarlo**: la siembra de gastos comerciales desde BCR quedaba en
unidades de USD/tn en vez de convertir a fracción del FOB — el FAS "Nuestro" daba disparates
(−821 soja, −8.998 girasol) hasta que se probó con datos reales en el navegador; nunca lo hubiera
agarrado un test que arma el `cfg` a mano. **Verificado**: 181/181 tests (30 nuevos, 2 fixtures
reales — HTML de BCR del 22/07 + respuesta real de la API de FOB del 23/07, con checks de
consistencia aritmética) · lint/tsc/build ✅ · navegador con datos reales (Playwright, claro/oscuro,
desktop/mobile): BCR≈Nuestro el día 1 (misma fuente+gastos sembrados), diferenciales plausibles
(soja +3,1% sobrepagado, sorgo −7,0% subpagado, girasol +19,4%); edición en vivo probada a mano
(retenciones soja 24%→30% recalculó 337,10→308,90, exacto) + botón de reset. **PR #76.**

**Follow-up en el mismo PR (mismo día): FAS Teórico INDUSTRIA (soja), 4ª lectura.** Lautaro
compartió un Google Sheet de un tercero que entiende la materia ("parámetros vigente 04/2026")
pidiendo verificar su modelo. Verificado: internamente consistente, rindes de molienda coinciden
casi al decimal con el Anexo 2 del PDF de BCR 2021, retenciones aceite/harina 22,5% coinciden con
`docs/negocio/05`, y confirma independientemente la misma decisión de diseño ya tomada acá
(retenciones sobre FOB SAGyP, nunca sobre FOB mercado). **El hallazgo real**: ese documento
calcula el FAS Teórico INDUSTRIA de BCR (complejo aceite+harina que crushea la industria), NO el
de EXPORTACIÓN (poroto) que ya habíamos construido — en la práctica argentina el de industria
suele ser el que más mueve el precio al productor de soja. Por `AskUserQuestion`, Lautaro eligió
sumarlo como 4ª lectura sin tocar el cálculo de grano. Build: `parseBcrIndustria()` (nueva sección
de la misma planilla de BCR, con un chequeo de columnas nuevo — `contarColumnas()` — que evitó un
bug real: un typo de BCR en la celda de pellets de girasol corría el índice y le asignaba a
girasol un valor de soja) · `capacidad-industria-modelo.ts` (fórmula pura, reproduce exacto el
modelo de referencia salvo cáscara, omitida por no tener FOB oficial verificado) · 2 posiciones
NCM más homologadas (aceite/harina de soja) · fila nueva "Soja (industria)" en el panel con su
propio bloque editable. Verificado: 194/194 tests (20 nuevos, con el typo real de girasol en el
fixture) · lint/tsc/build ✅ · navegador con datos reales (BCR=340,40 / Nuestro=335,85 /
Pizarra=347,64, ambos modelos bien por debajo de la pizarra, consistente con la controversia
documentada) · edición en vivo verificada a mano. **Pendiente**: Lautaro confirma la homologación
de posiciones NCM; girasol (industria) queda sin "Nuestro" por falta de parámetros propios; FAS
teórico propio de SAGyP (Res. 42/2007) relevado pero no sumado (no hay API). Detalle completo
(research de las 5 preguntas, tabla de homologación con la evidencia numérica, y el follow-up de
industria):
[`sesiones/2026-07-24-c16-capacidad-pago.md`](sesiones/2026-07-24-c16-capacidad-pago.md).

## Anterior (24/07/2026 — 🧮 C13 (P9) sintéticos LECAP + dólar futuro con TIR HECHO)

**🧮 C13 / P9 — SINTÉTICOS LECAP + DÓLAR FUTURO CON TIR — HECHO — rama `claude/backlog-p9-sinteticos`,
PR #75 (mergeado).** Cierra el ítem del backlog maestro (`auditoria/E7-sintesis.md` §4 / PROMPT P9 de
`PLAN_BACKLOG.md`). La **fórmula ya estaba validada** por Lautaro (chat + su Excel "REAL_TIME v2.5",
hoja "DOLAR SINTETICO", reproducida 1:1): `sint = spot × (pagoFinal/px)` · `directa = sint/fut − 1` ·
`TNA = directa × 365/días` (act/365). Lo que faltaba era la fuente del **"pago final por letra"**.
**Investigado con requests reales:** BYMA es la fuente última (verificado: los "Pago Final" del Excel
coinciden 1:1 con lo que publica BYMA) pero su open-data es un feed de precios, no expone el importe al
vencimiento; IAMC (informeslecap) es un PDF diario frágil (SSL/502 en el sandbox); MECON es letra por
letra. Como el pago final **casi no cambia** (se fija en la emisión, se actualiza cada 1-2 meses cuando
el Tesoro licita) y el precio diario ya lo trae data912 → **carga semi-manual** (mismo patrón que
DEA-SAGyP y camiones/Williams). **Construido:** lib pura testeada `src/lib/sinteticos.ts`
(`calcularSintetico` + `emparejarSinteticos` por **mismo mes calendario**, criterio del Excel — S31L6↔JUL26,
S14G6/S31G6↔AGO26); fetcher `src/lib/market/sinteticos.ts` (junta data912 + MAE + Supabase, degrada
honesto); panel `/dolar` **Sintéticos** completo (sintético/TNA + comparación vs futuro directo + mejor
destacado, "—" si falta el pago final); tabla pública `lecap_pago_final` + RPC admin + uploader en
`/admin/datos` (pegar `TICKER PAGO_FINAL [VENC]`, preview/confirm). Migración
`20260724140000` **aplicada** por MCP (seed con los 3 valores del Excel; anon SELECT verificado).
**Verificado:** fixture del Excel EXACTO (sint 1.503,678626, TNA 5,4843%) · lint/tsc/**154 tests**/build ✅ ·
live end-to-end con datos reales en `/dolar` (spot 1491, S31L6→JUL26 TNA +16,6% vs futuro +8,2% =
ventaja +8,4%, emparejamiento 100% mismo-mes, degradación honesta donde falta el pago final) · backend
por SQL (guard rechaza no-admin, parseo jsonb OK). **Follow-up chico:** BONCAPs (T) — la tabla/uploader
los soportan, falta wirear su precio en vivo (`getLecaps` filtra solo S). Detalle:
[`sesiones/2026-07-24-c13-sinteticos-tir.md`](sesiones/2026-07-24-c13-sinteticos-tir.md).

## Anterior (24/07/2026 — 🔎 verificación panel Compras BCRA + primer cron real + carga manual por fecha)

**🔎 VERIFICACIÓN PANEL COMPRAS BCRA + PRIMER CRON REAL + CARGA MANUAL POR FECHA — HECHO — rama
`claude/pending-tasks-no-deps-ahvewt`, PR #74 (mergeado).** Lautaro pidió avanzar con algo que no
necesitara prender el login ni nada de su parte; repasado el backlog maestro (`auditoria/E7-sintesis.md`
§4) no quedaba ninguna feature nueva 100% autónoma (C11-C16 necesitan login o un insumo suyo) →
se eligió (por `AskUserQuestion`) verificar en navegador paneles recientes sin chequeo visual
real. Verificado el panel **"Compras netas BCRA (MULC)"** de `/dolar` (C4, 23/07) con datos reales
(este entorno sí tenía las claves de Supabase), claro/oscuro, con Playwright. **Hallazgo de
paso**: el cron `ingest-bcra-mulc.yml` (10:00 ART L-V) mergeó el 23/07 a la tarde → su primera
ventana programada recién caía hoy, nunca había corrido (0 runs) — no era bug, solo faltaba
tiempo. Se disparó el primer `workflow_dispatch` manual (`success`, 13s), cargó 2026-07-20 (+32,0
M USD), verificado 1:1 contra la API oficial del BCRA. Cierra el "falta el primer
`workflow_dispatch` real" que había quedado anotado en la sesión de C4.
**Pedido nuevo de Lautaro en el medio de la sesión**: botón de carga manual de compras BCRA para
tapar el hueco de rezago (hoy 24/07, sin dato hasta el 20/07) — ya existía carga manual en
"Datos del día" pero fija a la fecha de HOY. Separada en tarjeta propia **"Compras BCRA (MULC) —
carga manual"** (`bcra-manual.tsx` + `bcra-actions.ts`, misma RPC `admin_upsert_compras_bcra` sin
migración nueva) con fecha elegible (precargada en el hueco hábil más reciente, hoy 23/07) +
lista de últimos días cargados y huecos detectados. Aclarado que el cron diario (no semanal, más
seguido de lo que pensaba) ya pisa cualquier carga manual con el dato oficial en cuanto llega — no
hizo falta un cron nuevo. Verificado con bypass temporal (`LOCAL_AUDIT_BYPASS`, revertido, `git
diff` limpio) + backend por SQL con rollback + lint/tsc/build. Detalle:
[`sesiones/2026-07-24-verificacion-panel-bcra.md`](sesiones/2026-07-24-verificacion-panel-bcra.md).

## Anterior (24/07/2026 — 🔧 L6+L3+L2 (3 lotes técnicos del backlog maestro) HECHOS)

**🔧 L6 + L3 + L2 — 3 LOTES TÉCNICOS DEL BACKLOG MAESTRO, EN ORDEN, PR ACUMULADO — HECHOS — rama
`claude/pending-tasks-no-login-dawaha`, PR #_.** Los 3 refactors/robustez que quedaban de
`auditoria/E7-sintesis.md` §4 (D3/D5/D6), ejecutados en la misma sesión con un PR único.

**L6 (robustez de ingestas v2):** falso-verde restante en modos backfill/dispatch (Anexo A de
`E5-infra.md`, los caminos que la fase 2 de E5 del 22/07 NO había cubierto porque se enfocó en el
camino diario) — guard "0 filas = exit 1" extendido a `ingest-cierres --from`, `ingest-cbot
--backfill`, `ingest-pizarra --from`, `ingest-usda --backfill-wasde` (distingue "no existe esa
edición" de error real), `ingest-gea --backfill` (mismo patrón que `ingest-compras.mjs`) e
`ingest-lineup --from/--date` multi-fecha; el guard `daily` muerto de la Edge Function
`lineup-ingest` (nunca se activaba, el caller siempre manda `?date=`) se retiró y se redeployó.
**Calendario NASS generado desde el ICS oficial**: `calendario-nass.ts` (parser RFC 5545 puro) +
`generar-calendario-nass.mjs` → `calendario-seed-nass.json` versionado, reemplaza los arrays
`WASDE_2026`/`GRAIN_STOCKS_2026`/`CROP_PROGRESS_2026` hardcodeados — verificado 1:1 contra el ICS
real antes del cambio (además trae 3 fechas 2026 que el array a mano nunca tuvo, por escribirse a
mitad de año — documentado como mejora, no regresión); 2027 confirmado NO publicado todavía (404
real, esperable). Roster de exportadores ya lo había cerrado L4 el 23/07 (nada que hacer).

**L3 (`noUncheckedIndexedAccess`):** re-medido primero como pedía el prompt — dio **288 errores en
55 archivos** (no los ~152/32 de la medición de E4 del 21/07, por el trabajo nuevo del 23-24/07) —
documentado en vez de recortar el scope en silencio. **Saneados los 288/288** con guard explícito
por defecto (`?? fallback`) y `!` solo en invariantes de una línea arriba, comentados; patrón
repetido: `Record<string,X>` con claves fijas pasado a tipo literal (`as const`) para que el acceso
por punto deje de traer "| undefined". **4 bugs latentes reales encontrados y corregidos**: leyenda
de `evolucion-chart.tsx` crasheaba con un organismo sin puntos; `parse-agrochat.ts` y
`actions-camiones.ts` dejaban pasar un archivo de 0 filas hasta un `TypeError`/`undefined` sin
guard; `calendario.ts` silenciaba una fecha ISO inválida como `NaN` en vez de fallar claro. 147/147
tests sin tocar ningún expect.

**L2 (motor de gráfico SVG compartido):** `chart-svg-base.tsx` (`useCrosshair` + `SvgLineChartBase`)
extraído de `evolucion-chart.tsx`/`dolar-futuro-chart.tsx`/`compras/negociado-chart.tsx` — comparten
el envoltorio (`.chart-wrap`+`ChartMarca`+`<svg viewBox>`+grilla+`<rect>` interactivo) y el estado
del crosshair, pero **cada chart conserva su propio algoritmo de "punto más cercano"** (2D para
series superpuestas, 1D para una sola serie, índice directo para el histograma de barras — forzar
una sola métrica habría cambiado comportamiento real, documentado explícitamente en el código).
`spread-chart.tsx` (recharts) y `ChartMarca`/`ChartTabla` quedaron afuera, como pedía el prompt.
2 trampas reales resueltas: `.cv-tip` necesita seguir siendo hijo de `.chart-wrap` (slot `after`
nuevo) y `useCrosshair` no puede quedar detrás de un `return` condicional (rules-of-hooks).

**Verificado los 3 lotes**: lint/tsc/test(147/147)/build ✅ en el estado final · Edge Function
redeployada y verificada byte a byte · L2 verificado con Playwright real (Chromium headless, datos
reales de Supabase, claro/oscuro, desktop 1280px/mobile 390px, hover sobre cada chart) sin
diferencia visual — bypass temporal de `requireAdmin()` en `/comercio/negociado` para poder
screenshotearla, revertido antes de cerrar (`git diff` limpio). Detalle:
[`sesiones/2026-07-24-l6-l3-l2-lotes-tecnicos.md`](sesiones/2026-07-24-l6-l3-l2-lotes-tecnicos.md).

## Anterior (24/07/2026 — 🚢 C9 (extras de spec de puertos) HECHO)

**🚢 C9 — EXTRAS DE SPEC DE PUERTOS (matriz mes×zona + "qué cambió" ampliado) — HECHO — rama
`claude/c9-execution-models-2g48l6`, PR #_.** C9 (backlog maestro, `auditoria/E7-sintesis.md` §4)
estaba en la cola sin priorizar y **sin prompt escrito** (a diferencia de P1-P12 en
`PLAN_BACKLOG.md` o los lotes L1-L6 en `E7-sintesis.md` §6) — se le preguntó a Lautaro cómo
seguir y decidió **definir el alcance ahora, sin la spec original** de `LineUps_Code`
(`ESPECIFICACION_MESA_CALOR.md`, nunca versionada acá). **Alcance cerrado por
`AskUserQuestion`**: (1) matriz mes×zona en `/comercio/embarques` **solo en la fila de
embarcado** — hallazgo real: `djve` (declarado) no tiene puerto/muelle, la zona (Up River
Norte/Sur/Bahía) solo existe en el line-up físico, así que la matriz declarada sigue sin zona y
el desglose nuevo aplica al line-up del mes en curso (mismo alcance i≤1 de siempre); (2) "qué
cambió" ampliado en `/comercio/puertos` = buques que **salieron** (no solo los nuevos, mismo
umbral 30kt sin bajarlo — Lautaro descartó esa opción) + comparación contra una **rueda de
referencia ~1 semana atrás** (bloque nuevo, no solo la rueda inmediata anterior). **2 vistas SQL
nuevas** (`lineup_visitas_recientes` con port/berth para zona en TS, `lineup_fechas_recientes`
para ubicar la rueda de referencia), ambas **aditivas** — no tocan `lineup_visitas` (matview de
Fase 3 con 6+ dependientes) para evitar el riesgo de un DROP/CREATE en cascada. **Verificado 1:1
contra SQL real**: zona de Maíz (Norte+Sur+Bahía = 5,79 Mt/219 buques vs línea-up total 6,10
Mt/234 buques, la diferencia cae en "Otros" por diseño) · referencia semanal (16/07 187
buques/6,50 Mt vs 22/07 181/6,43 Mt reproducido exacto) · salidos (`ARUNA CIHAN` y `SELO`
confirmados presentes el 21/07 y ausentes el 22/07). lint/tsc/build ✅ · 140/140 tests sin
regresión · navegador claro/oscuro con datos reales (rutas de verificación temporales, borradas
antes de cerrar, git diff limpio). Detalle:
[`sesiones/2026-07-24-c9-puertos-extras.md`](sesiones/2026-07-24-c9-puertos-extras.md).

## Anterior (23/07/2026 — día grande de backlog maestro, 7 sesiones en paralelo:
📊 C10 (gráficos v2, P6) HECHO, paquete completo (URL Período, %, media móvil, volumen/OI, export
PNG/CSV, guard parcial) ·
📝 C3 (interpretación de informes de organismos) HECHO, migración aplicada y probada con un informe real ·
🧹 LOTE L1 (partir `market.ts`) HECHO · 📄 MP2 informe semanal HECHO (skill + Novedades del día con
interpretaciones + páginas legales, PR #68 en vuelo) · 🔓 A1 login Google: dominio `rofoagro.com.ar` conectado y verificado, marca pivotó a
"ROFO AGRO" — falta el rebranding del sitio (próxima sesión) ·
🔓 LOTE L5 (DEA-SAGyP) HECHO (carga semi-manual) · 📰 MP1 informe diario HECHO ·
🎯 L4 (calibración de cobertura/roster/comisiones) CERRADO · 🌻 B3 (girasol/sorgo) CERRADO ·
🚚 C5 (camiones en puerto + señal barcos-vs-camiones) CONSTRUIDO con pivote a Williams Entregas ·
💵 C4 (compras netas BCRA) HECHO, backfill real 2003→hoy cargado ·
⏰ A2 (Routines MP1/MP2/MP3) HECHO, las 3 creadas y activas ·
📈 A3 (BCBA-PAS) suscripción HECHA + producción histórica cargada (26 campañas), condición de
cultivos fasada para después ·
🎛️ C8 (filtro por grano) HECHO, pivote de "página nueva" a "filtro dentro de los paneles" a
pedido de Lautaro)

**🎛️ C8 — P5: FILTRO POR GRANO (no página nueva) — HECHO — misma rama
`claude/backlog-pending-tasks-cfcjy6`.** El prompt original de `PLAN_BACKLOG.md` proponía una
página nueva por grano (`/granos/soja`, etc.); Lautaro aclaró en el chat que NO la quería —
prefería que **los paneles transversales ya existentes** tuvieran un filtro por grano encima,
"para hacerlo más fácil", con el criterio de dónde vale la pena filtrar y dónde no. Componente
compartido `filtro-grano.tsx` (chips Todos/Soja/Maíz/Trigo, mismo lenguaje que el filtro de
Noticias) cableado con **estado independiente por panel** (sin sincronizar entre secciones) en
Arbitrajes/Pases/Monitor de mercados (`/granos`) y Temperatura-índice MESA
(`/comercio/temperatura`, mapeo cod→grano: crush+poroto bajo "Soja"); select "Producto" (ya
existía ese patrón) en Negociado y Empresas (`/comercio/*`). **Deliberadamente sin filtro**:
"Mejor para hacer caja" (el ranking de 3 filas ES la comparación entre granos) y "Capacidad de
pago" (3 filas, no aporta); Noticias quedó afuera (requeriría clasificación nueva por keyword,
fuera de "componer lo que ya existe"). De paso, **fix de un bug pre-existente no relacionado**:
un comentario mal cerrado en `globals.css` (`.evo-*/.vb-*` contenía un `*/` literal que cerraba
el comentario antes de tiempo) rompía el parseo de CSS en `npm run dev` (500 en TODAS las
páginas) — encontrado al intentar levantar el server para verificar este lote. **Verificado**:
lint/tsc/build/tests (137/137) ✅ · navegador con Playwright + datos reales (el entorno tenía
`SUPABASE_URL`/`SUPABASE_SERVICE_KEY` reales como env vars del proceso, no en `.env.local`):
`/granos` claro/oscuro con el filtro de Arbitrajes funcionando independiente de Pases/Monitor ·
`/comercio/temperatura` con bypass temporal de `requireAdmin()` (revertido, git diff limpio) ·
`/comercio/negociado` y `/comercio/empresas` con datos reales (el filtro de empresas bajó de
~209 a 12 al elegir "Maíz"). Detalle:
[`sesiones/2026-07-23-c8-filtro-por-grano.md`](sesiones/2026-07-23-c8-filtro-por-grano.md).

**📊 C10 — P6: GRÁFICOS V2 (paquete) — HECHO — rama `claude/c10-avance-33kwa5`, PR #_.** Ejecutado
el PROMPT P6 de `PLAN_BACKLOG.md` sobre el panel `/graficos` (PR #17 en producción). **Paso 1
(insumos de Lautaro) por `AskUserQuestion`**: P12 ("relación % contra referencia") resultó ser la
misma métrica ratio ya existente (maíz/soja) mostrada en % — Lautaro contestó "pizarra de maíz vs
soja"; P17 ("empalme front-month") quedó resuelto porque "son pizarras" — la pizarra ya es una
serie continua sin vencimiento de contrato, no hace falta construir el empalme. Alcance completo
en una sesión (pedido explícito). **Los 6 ítems**: (1) modo Período persistido en la URL (mismo
patrón merge que Campañas, claves propias `pf/pg/pm/pa/po` + `mc` del modo); (2) métrica en %
(`metricaDiaria(...,pct)` — ratio×100 y spread `(vb/va−1)×100`); (3) export PNG (serializa el SVG
de Recharts resolviendo las `var(--...)` del tema a valor concreto + pie de marca) y CSV (botón en
`ChartTabla`, opt-in); (4) media móvil (5 ruedas default, ventana elegible, overlay de la campaña
vigente en Campañas / de cada posición visible en Período); (5) subpanel de volumen/OI (`futuros_
cierres`/`cbot_cierres` ya traían las columnas, `series.ts` no las pedía — ahora sí; solo pata A,
solo A3/CBOT, la pizarra no tiene volumen); (6) guard "parcial" (círculo hueco + nota si el último
punto es HOY). **Bug real encontrado de paso** (bloqueaba `npm run dev` en TODAS las páginas, no
solo `/graficos`): un comentario de `globals.css` con `.evo-*/.vb-*` cerraba el bloque de comentario
antes de tiempo (la secuencia `*/` accidental) — toleraba en build de producción pero tiraba 500 en
Turbopack dev; fix de una línea. **Verificado**: 140/140 tests (33 nuevos) · lint/tsc/build ✅ ·
navegador real con datos de Supabase (claro/oscuro/mobile, los 6 ítems probados con screenshots,
export PNG/CSV descargados y verificados, URL persistente confirmada con reload real, números
cotejados 1:1 contra `/api/series`). Detalle:
[`sesiones/2026-07-23-c10-graficos-v2.md`](sesiones/2026-07-23-c10-graficos-v2.md).

**📝 C3 — MP4: INTERPRETACIÓN DE INFORMES DE ORGANISMOS (ítem 21) — HECHO, MIGRACIÓN APLICADA Y
PROBADA — rama `claude/avance-c3-1ra0au`, PR #67 (mergeado).** Ejecutado el PROMPT MP4 de
`PLAN_INFORMES.md`. Tabla `interpretaciones` (borrador/publicado/descartado) + 3 RPC admin
(`admin_actualizar/publicar/descartar_interpretacion`) en la migración `20260723170000`,
**APLICADA** por MCP con el OK de Lautaro. **Detección + generación**: paso nuevo (Paso 9) al
final de la skill `informe-diario` — reusa `informesHoy` que MP1 ya había dejado preparado como
"consulta adelantada" en `/api/informes/datos`; genera el borrador con `voz-lautaro` (registro
"Informe largo") y NUNCA publica sola. **Admin** `/admin/interpretaciones` (editor con vista
previa + Guardar/Publicar/Descartar, tab nueva con badge). **Web**: "La lectura de la mesa"
colapsable en `/produccion` (junto a la tarjeta de cambios del organismo, match por
organismo+fecha) + feed en `/informes`. **Probado con un informe viejo real** (pedido explícito de
Lautaro antes del merge): tomado el último WASDE ya ingestado (USDA #673, 10/07/2026), calculado
por SQL el mismo delta que arma `construirCambios` contra el vintage anterior (maíz mundial
2026/27 -3,29 Mt el más grande, + Argentina maíz 2025/26 y EEUU soja 2026/27), redactado el
borrador con la voz de Lautaro citando esos números exactos, e **insertado como `borrador` — sin
publicar** (publicarlo yo mismo por SQL hubiera saltado la regla dura "su firma nunca sale sin su
OK"; queda en `/admin/interpretaciones` para que Lautaro decida). RLS verificado por SQL en los
dos sentidos (`anon` no ve el borrador real; con una fila sintética de prueba, borrada al
terminar, se confirmó que sí ve un `publicado`). `get_advisors` sin hallazgos nuevos (las 3 RPC
comparten el mismo patrón ya aceptado de todas las `admin_*` del proyecto). **Verificado**:
lint/tsc/build/tests ✅ (137/137); verificación visual en navegador con sesión admin **no se
hizo** (preview de Vercel atrás de SSO sin credenciales en este sandbox) — queda para la primera
vez que alguien entre logueado a `/admin/interpretaciones`. Detalle:
[`sesiones/2026-07-23-mp4-interpretacion.md`](sesiones/2026-07-23-mp4-interpretacion.md).

**💵 C4 — COMPRAS NETAS BCRA (MULC) — HECHO, PR EN VUELO — rama `claude/avance-c4-rdz586`.**
Retomado tras el desbloqueo de A5 (22/07) y el merge de MP1 (que ya había creado `compras_bcra`
solo-admin como insumo del informe diario). **Ingesta automática** `scripts/ingest-bcra-mulc.mjs`
(API v4 de monetarias del BCRA, variable 78 "Variación de reservas internacionales por compra de
divisas" — la misma que eligió el research de `negocio/07`, verificada de nuevo en vivo) + workflow
`ingest-bcra-mulc.yml` (cron 10:00 ART L-V + dispatch con backfill) + check nuevo en
`healthcheck-frescura.mjs` (umbral 12 días, holgado por el rezago ~3-4 hábiles). **Panel** nuevo en
`panel-cambiario.tsx` ("Compras netas BCRA (MULC)": último dato + acumulado mes/año calendario +
gráfico de barras verde/rojo con `bcra-mulc-chart.tsx`, las cargas manuales más tenues para
distinguirlas). **`compras_bcra` pasó a pública** (migración `20260723160000`, RLS SELECT abierto a
anon — mismo criterio que camiones/DJVE, decidido junto con Lautaro tras una primera migración
rechazada por `AskUserQuestion`: la tabla queda pública, `mesa_color` sigue admin-only). **Backfill
real cargado**: 5.770 filas (2003-01-02→17/07/2026) insertadas por SQL vía MCP (el sandbox no tenía
`SUPABASE_SERVICE_KEY` para correr el script de backfill localmente) — **verificado 1:1 contra la
API real** (últimos valores de julio exactos: 13/07 +280 · 14/07 +532 · 15/07 +73 · 16/07 +230 ·
17/07 +39, coinciden con `negocio/07`) y contra `count()`/`min()`/`max()` de la tabla. RLS verificado
por SQL (`set local role anon` → 5.770 filas visibles). **Decisión propia (research P3 dejó
abierto)**: acumulado por mes/año CALENDARIO, no año agrícola (es un flujo monetario, no de cosecha).
**Falta**: verificación visual en navegador (no se pudo en este sandbox, sin claves) — revisar
`/dolar` en el Preview del PR; y el primer `workflow_dispatch` real del cron post-merge. Detalle:
[`sesiones/2026-07-23-c4-compras-bcra.md`](sesiones/2026-07-23-c4-compras-bcra.md).

**🚚 C5 — CAMIONES EN PUERTO + SEÑAL BARCOS-VS-CAMIONES — CONSTRUIDO, PR EN VUELO — rama
`claude/pendientes-restantes-n4x9b5`.** Arrancó como el P4 del backlog (research 21/07: SAGyP/MAGyP
automático) pero pivotó a mitad de camino: Lautaro aportó por chat 5 CSV reales de **Williams
Entregas** ("la fuente de camiones por excelencia", vía su export de Agrochat) — zona total + zona
por maíz/soja/trigo + localidades, 2018→2026. Investigado (`WebFetch`): Williams es un servicio B2B
**pago sin API pública** → la carga manual es la arquitectura correcta para siempre, no un parche.
**Decisión final: cero dependencia de SAGyP**, zona Y producto salen de Williams por carga manual
desde `/admin/datos` (pestaña nueva, con selector de serie + prompt tipo `prompt-agrochat.tsx` para
pedirle el export a Agrochat). Tabla `camiones` pública (como la DJVE) + panel `/comercio/camiones`;
el bloque "señal barcos-vs-camiones" (diferencial de percentiles estacionales pctlLineup−pctlCamiones,
NUNCA un ratio con umbral fijo — mismo hallazgo que L4) queda solo-mesa. Backfill completo 2018-2026
(42.624 filas) cargado a la base real. `src/lib/camiones/sagyp.ts` quedó escrito/testeado pero sin
wirear (referencia muerta a propósito). Verificado: 30 tests nuevos (122 total) + página corrida con
datos reales (KPI "5.069 camiones el 22/07" 1:1 contra el CSV) + señal reproduce exacto el ejemplo de
`negocio/09` (trigo +19 alcista, maíz+soja+Bahía neutro, Gran Rosario −12 bajista). **Diferido:** C4
(compras BCRA) — la sesión de MP1 ya creó en la base real la tabla `compras_bcra` pensada para esto,
mejor esperar a que esa rama mergee antes de escribir la ingesta encima. Detalle:
[`sesiones/2026-07-23-l4-c5-camiones.md`](sesiones/2026-07-23-l4-c5-camiones.md).

**🎯 L4 — CALIBRACIÓN DE COBERTURA/ROSTER/COMISIONES — CERRADO — misma rama.** Antes de calibrar
números a ciegas, auditoría real por SQL (pedido explícito de Lautoro: "¿esto tiene lógica?"): el
umbral fijo 0,7/1,3 de `cobertura.ts` disparaba señal el **74-95% de los días** históricos según el
producto (maíz 94,7%) — nunca se había validado contra la distribución argentina. Reemplazado por
**percentiles P25/P75 por producto** (mismo criterio que el índice MESA), con el mínimo de 5.000t
protegiendo AHORA ambos lados (antes solo el alcista). Índice MESA (pesos/bandas/rindes) auditado y
**dejado como está** (diseño ya sólido, sin evidencia de que esté mal). Sumado: chequeo de erosión
del roster de exportadores en el healthcheck (umbral 15%, hoy 2,6% real) + toggle "incluir costos"
en la calculadora de estrategias (tarifario A3/Cocos). Detalle en el mismo doc de sesión de arriba.

**🌻 B3 — GIRASOL Y SORGO EN LA PIZARRA — CERRADO — misma rama.** La pizarra CAC sí publica esos
2 boards (verificado con request real); sumados a la calc "Negocios de planta" únicamente (no tienen
futuro A3). De paso, el parser de `pizarra.ts` quedó acotado a su propio bloque HTML (bug latente
que podía leer el precio del board siguiente si el propio no matcheaba) + un formato de fallback
para "S/C" (girasol suele venir así). Detalle en el mismo doc de sesión.

**🧹 LOTE L1 — partir `market.ts` + util única de mes/posición — HECHO — rama `claude/l1-resolution-40gotx`,
PR #_.** Primer lote de refactor del backlog maestro (D4 de `auditoria/E7-sintesis.md` §4, hallazgos #10
+ #11 de E4-codigo.md). REFACTOR PURO: cero cambios de comportamiento. `market.ts` (546 líneas, 8
responsabilidades mezcladas) partido en `src/lib/market/{http,types,tickers,fuentes,cinta,dolar-futuro,
dolar-linked,volumen,lecaps}.ts` según el diseño §A de E4, con `market.ts` como fachada de re-export (los
13 importadores actuales — creció de 11 desde el audit del 21/07 por las páginas nuevas de MP1/MP2/MP3 —
no se tocaron; `getMaeOficial` sigue 100% interno). `src/lib/dates.ts` sumó la util única de mes/posición
(`MESES_ES`/`mesIndice`/`parsePosicion`/`vencKeyDePosicion`/`vtoDePosicion`/`posicionDeFecha`/
`hoyVencKey`), migrados los 9 call-sites duplicados (`curva.ts`, `futuros.ts`, `derivadas.ts`,
`market/tickers.ts`, `lineup/embarque.ts`, `graficos-client.tsx`, `periodo-panel.tsx`, `calc-fijar.tsx`,
`compras/negociado-chart.tsx`); se preservó a propósito el quirk heredado de "DIS24" (matchea el patrón
3 letras + 2 dígitos pero no es mes válido → `vencKeyDePosicion` da 202400 en vez de 0), documentado y
testeado. **Verificado**: 107/107 tests (16 nuevos de `dates.test.ts`) · lint/tsc/build ✅ · diff de HTML
real antes/después (`git stash` del código viejo, rebuild en la misma ventana) — `/` y `/granos` **byte a
byte idénticos**; `/dolar` estructuralmente idéntico, la única diferencia es qué bonos devuelve
`data912.com` en ese instante (confirmado: el código viejo solo, corrido dos veces con minutos de
diferencia, también varía en ese mismo campo). Habilita L3 (`noUncheckedIndexedAccess`, con menos
archivos para sanear) y despeja el camino de P2/P6 (que tocaban el mismo código). Detalle:
[`sesiones/2026-07-23-lote-l1-market.md`](sesiones/2026-07-23-lote-l1-market.md).

**📄 MP2 — INFORME SEMANAL (PDF research) — HECHO, PR EN VUELO — rama
`claude/pending-tasks-mp2-writing-6kfbrp`, PR #68.** La skill `.claude/skills/informe-semanal/`
se construyó en esta sesión (23/07, misma tarde): Lautaro contestó "definilo vos" cuando se le
preguntó si quería retomar el criterio de "qué destacar cada semana" que había pedido pensar con
calma — quedó como Paso 2 de la skill, marcado explícitamente como borrador a validar con el
primer envío real (prioridad: informes de organismos de la semana → mayor movimiento de precio →
cambios de régimen → resto como contexto). Se sumó también la sección "Informe semanal" a
`/informes` (antes solo listaba el diario). **De paso, en la misma sesión**: (1) Lautaro aprobó y
publicó el borrador de interpretación del WASDE #673 (MP4) y pidió que toda interpretación
publicada aparezca en la cabecera "Novedades del día" del home hasta el día siguiente — hecho,
con un bug real encontrado y corregido antes de pushear (el filtro comparaba la fecha del INFORME
original, no la fecha en que Lautaro la publicó — con el bug original, este caso real nunca
hubiera aparecido). (2) Páginas `/privacidad` y `/terminos` nuevas, a pedido de Lautaro mientras
intentaba publicar el consent screen de Google (pide URL de política de privacidad pública).
**Routine semanal creada** (23/07: `create_trigger` cron `0 22 * * 5` = 19:00 ART viernes) —
**falta**: el primer PDF real de punta a punta (primer disparo real recién el viernes que viene).
Detalle: [`sesiones/2026-07-23-mp2-skill-y-alta-srl.md`](sesiones/2026-07-23-mp2-skill-y-alta-srl.md).

**📈 A3 — SUSCRIPCIÓN PAS (BCBA) HECHA + producción histórica cargada a la base.** Lautaro se
suscribió al Panorama Agrícola Semanal por WhatsApp (la automatización sigue descartada,
Cloudflare 403 confirmado 2/2) y pasó el PDF del informe de hoy + 5 exports descargables de
`bolsadecereales.com/estimaciones-agricolas`. De esos 5, **`historico_pas_datasets.csv`** (26
campañas 2000/01→2025/26, los 6 granos) resultó ser el dato correcto — verificado 1:1 contra
cifras reales conocidas (soja 2024/25 = 50,3 Mt, maíz 2024/25 = 49,0 Mt) — mientras que
`reporte_1.xlsx` (solo la campaña en curso) quedó descartado por no poder confirmar si su columna
"Producción(**MTn**)" son millones o no (nunca trajo un valor >0 para verificar). Los otros 4
reportes (`reporte_2-5`: condición semanal + avance fenológico por grano, dato que la web no
modela en ningún lado hoy) quedan **fasados a propósito** — Lautaro eligió "los dos, pero fasado"
cuando se le preguntó el alcance: arrancar con lo chico (producción → comparador existente) y
diseñar con calma un panel de "condición de cultivos" más adelante. **Construido**: `src/lib/
parse-pas.ts` (reusa la RPC `admin_upsert_estimaciones` de L5, CERO migración nueva) con dos
defensas reales encontradas en los datos (fila de trigo 2025/26 duplicada byte-a-byte de 2024/25
→ descartada; rinde de girasol 2024/25 corrupto en el origen → recalculado siempre desde
producción/cosechado, nunca se confía en la columna del origen) + sección nueva en `/admin/datos`
(mismo patrón 2 pasos que DEA, descartes siempre visibles en la previsualización). **Backfill real
cargado**: 400 filas verificadas con Node pelado contra el CSV real antes de tocar la base, subidas
por REST con la service key (mismo patrón que los scripts de ingesta) — BCBA sumado al comparador
de `/produccion` junto a USDA/CONAB/BCR/DEA, 2000/01→2025/26. Detalle:
[`sesiones/2026-07-23-mp2-skill-y-alta-srl.md`](sesiones/2026-07-23-mp2-skill-y-alta-srl.md).

**🔓 A1 — LOGIN CON GOOGLE + REBRANDING A "ROFO AGRO" — DOMINIO CONECTADO Y VERIFICADO, FALTA EL
REBRANDING DEL SITIO (próxima sesión dedicada) — misma tarde del 23/07.** Retomado en la misma
sesión (Lautaro: "ya registré el dominio"). Research previo (research de nombre/SRL, ver detalle
abajo) llevó a la decisión de **pivotar la marca a "ROFO AGRO"** — esquiva del todo la duda legal
de **ROFO AGRO SRL** (CUIT 30712631208, activa desde 2013, transporte de granel) sin necesitar
consulta con gestor/abogado. **Dominio `rofoagro.com.ar` registrado y CONECTADO**: nameservers de
Vercel (`ns1`/`ns2.vercel-dns.com`) delegados desde nic.ar (Mis dominios → Delegar → Agregar nueva
delegación), propagado y en `Valid Configuration`. **Verificado LIVE desde el sandbox** (curl):
`rofoagro.com.ar`, `/bienvenida`, `/privacidad`, `/terminos` → los 4 responden HTTP 200.
**Search Console verificado** (propiedad de Dominio, TXT cargado en Vercel → DNS Records, ya no en
nic.ar una vez delegados los nameservers). **Google Auth Platform, Centro de verificación**: el
motivo "sitio no registrado a tu nombre" **ya desapareció** de la lista de problemas (el dominio
resolvió eso) — quedan 2, y los 2 son consecuencia directa de que **el código todavía dice "RF
AGRO" en todos lados** mientras el nombre cargado en el OAuth ya es "ROFO AGRO": (1) nombre de la
app no coincide con la marca de la página principal, (2) la página principal no explica el
propósito (puede resolverse solo o necesitar retoque una vez que el wordmark diga "ROFO AGRO").
**Pendiente concreto para la próxima sesión — REBRANDING "ROFO AGRO" → "ROFO AGRO" en TODO el
sitio**: wordmark/logo (`public/rofoagro-*.svg` y su uso en header/footer/auth/admin/landing),
`<title>`/metadata de cada página (la mayoría trae "· ROFO AGRO" en el título), textos de la landing
(`/bienvenida`), las placas de los informes diario/semanal (llevan el logo), favicon, y cualquier
otra mención de marca visible al cliente — auditar con un grep amplio antes de tocar nada. **NO
tocar**: nombres internos de tablas/repo/skills (son identificadores técnicos, no marca visible),
ni la cuestión de razón social/SRL (sigue sin resolverse, pero ya no es urgente si la marca
pública pasa a ser "ROFO AGRO"). Detalle completo (research de dominio/SRL previo a la decisión):
[`sesiones/2026-07-23-mp2-skill-y-alta-srl.md`](sesiones/2026-07-23-mp2-skill-y-alta-srl.md).

*(La base + gráfico de MP2 — `src/lib/informe-semanal.ts`, decisión de usar BCRA A3500 para el
oficial semanal, plantilla PDF A4 de 5 páginas — se construyeron antes en la rama
`claude/resolver-pendientes-qnts8j`, PR #63. Detalle completo:
[`sesiones/2026-07-23-informes-mp2-semanal.md`](sesiones/2026-07-23-informes-mp2-semanal.md). La
skill que faltaba se hizo en el bloque de arriba.)*

**🔓 LOTE L5 — DEA-SAGyP: destrabar la fuente — HECHO (carga semi-manual) — rama
`claude/resolver-pendientes-qnts8j`, PR #63.** Incidente abierto desde E5/E6: `datosestimaciones.
magyp.gob.ar` clavado en el snapshot del 13/07. **Research confirmado desde este sandbox**: el
bloqueo es a nivel **TLS** (`Connection reset by peer` apenas se manda el Client Hello, no un
timeout) — mismo patrón que ya habían visto GitHub Actions y la Edge Function `dea-fetch` en São
Paulo, 3 proveedores cloud distintos. **No es un bloqueo de todo MAGyP**: `www.magyp.gob.ar`
(compras) responde 200 OK. La copia CKAN (`datos.magyp.gob.ar`) es alcanzable pero **le falta toda
la campaña 2025/26** (un año de atraso, no meses) → descartada como reemplazo. **Decisión de
Lautaro (vía `AskUserQuestion`): carga semi-manual**, mismo patrón que el uploader de compras/
Agrochat — él baja el CSV de su navegador (no bloqueado) y lo sube por `/admin/datos`. **Código**:
`src/lib/parse-dea.ts` (parser extraído de `ingest-dea.mjs`, ahora importado por el script — cero
duplicación) · migración `20260722180000` (RPC `admin_upsert_estimaciones`, guard `is_admin()`,
**aplicada** por MCP con OK de Lautaro) · sección nueva "Estimaciones DEA-SAGyP (carga manual)" en
`/admin/datos` (preview/confirm) · `ingest-estimaciones-ar.yml`: DEA sale del schedule (generaría
solo rojo sin datos) y pasa a dispatch-only (`dea_probe`), mismo patrón que PAS. **Verificado**:
lint/tsc/build ✅ · parser con fixture sintético en el formato oficial exacto · backend por SQL
(guard rechaza sin sesión, RPC funciona con JWT admin simulado) · uploader en navegador (bypass
temporal revertido, git diff limpio) — la previsualización con un CSV de prueba funcionó; la
escritura real se prueba en la primera carga real de Lautaro. **Healthcheck sigue en rojo para DEA
hasta esa primera carga** (correcto: avisa que falta subir el CSV). Detalle:
[`sesiones/2026-07-23-lote-l5-dea-carga-manual.md`](sesiones/2026-07-23-lote-l5-dea-carga-manual.md).

**📰 MP1 — INFORME DIARIO (placa PNG para WhatsApp) — HECHO (falta la Routine) — rama
`claude/resolver-pendientes-qnts8j`, PR #63.** Primer ítem ejecutado del backlog maestro (C1 de
`auditoria/E7-sintesis.md` §4), siguiendo el prompt de `PLAN_INFORMES.md`. **Migración APLICADA**
(`20260722120000_mp1_informe_diario.sql`, por MCP con OK de Lautaro): tablas `mesa_color` (color de
la rueda) + `informes_generados` (registro de placas/PDFs, RLS anon solo `estado=enviado`) +
`compras_bcra` (compras BCRA de carga manual — P3 sumará la ingesta automática a la MISMA tabla) +
bucket privado `informes`. **Código**: `/api/informes/datos` (junta arbitrajes/pizarra/dólar/
Chicago/noticias/agenda/color/BCRA/volumen A3 por grano + informe de organismo del día con hook a
la interpretación de MP4, hoy vacío) · plantilla `/informes/plantilla/diario` (placa 1080px, **tema
claro** elegido por Lautaro tras comparar bocetos con datos reales) · sección "Datos del día" en
`/admin/datos` (color de la rueda + compras BCRA, un solo form) · skill
`.claude/skills/informe-diario/` (procedimiento paso a paso de la Routine, con un ejemplo real de
color de operador guardado como referencia) · página pública `/informes` (histórico, sección nueva
en `SECCIONES_META`). **Verificado**: lint/tsc/build ✅ · bocetos claro/oscuro mostrados y elegidos ·
backend por SQL (guard `is_admin()` rechaza sin sesión, RPC funcionan con JWT admin simulado, RLS de
`informes_generados` oculta borradores a anon y los muestra al pasar a enviado) · UI en navegador con
bypass temporal revertido (git diff limpio). **Routine diaria creada (23/07, A2 del backlog
maestro)**: `create_trigger` con cron `30 21 * * 1-5` (18:30 ART L-V), env vars cargadas por
Lautaro en el entorno de Claude Code — el primer disparo real (18:30 ART de hoy) es la primera
prueba de punta a punta de lo que el sandbox no pudo (RPC con sesión real, Storage, Resend), sin
verificar todavía al cierre de esta sesión. Detalle:
[`sesiones/2026-07-22-informes-mp1-diario.md`](sesiones/2026-07-22-informes-mp1-diario.md) (base) y
[`sesiones/2026-07-23-mp2-skill-y-alta-srl.md`](sesiones/2026-07-23-mp2-skill-y-alta-srl.md) (Routine).

## Anterior (22/07/2026 — 🏁 AUDITORÍA INTEGRAL COMPLETA: E7 síntesis CERRADA → BACKLOG MAESTRO ÚNICO en `auditoria/E7-sintesis.md` §4 · encendido del login Parte A/B HECHAS, Parte C EN CURSO · E1–E6 cerradas · MP3 view de mercado MERGEADO · research P3/P4 HECHO)

**🏁 AUDITORÍA E7 (síntesis y backlog maestro) — CERRADA, cierra la auditoría integral completa
(E1→E7) — rama `claude/auditoria-e7-sintesis-a919cq`, PR #61.** Etapa final: se fusionaron los 6
informes (deduplicando los hallazgos vistos por más de una etapa, con la decisión de Lautaro
arrastrada — nada aprobado se perdió, nada rechazado reaparece), se armó la **matriz impacto ×
esfuerzo** de todo lo aprobado-y-pendiente, y quedó el **BACKLOG MAESTRO ÚNICO** en
**[`auditoria/E7-sintesis.md`](auditoria/E7-sintesis.md) §4** — reemplaza a las 3 listas paralelas
(absorbe el checklist «Plan ROFO AGRO» de abajo, que queda como histórico, y el tablero de
`PLAN_BACKLOG.md`; los prompts P1–P12/MP1–MP4 siguen siendo los prompts de ejecución). El informe
abre con el **resumen ejecutivo de TODA la auditoría** (~71 hallazgos, ~30 decisiones, qué se
corrigió y qué queda) escrito para leerse de una sentada. Trae además **6 prompts de lote listos**
(§6): L1 partir `market.ts`+util mes/posición · L2 motor de gráfico SVG · L3
`noUncheckedIndexedAccess` · L4 calibración de parámetros de mesa (insumo de Lautaro) · L5 **DEA
destrabar la fuente** (único incidente abierto: MAGyP no acepta ni Actions ni São Paulo) · L6
robustez de ingestas v2 (falso-verde en backfills + calendario desde ICS NASS). **Orden sugerido:**
A1 terminar login + A2 Routine MP3 (manuales) → MP1 → L5 (DEA) → MP2 → respuestas P3/P4 → builds.
Tablero de `PLAN_AUDITORIA.md` marcado completo. **Regla desde hoy: todo pendiente nuevo se agrega
al backlog maestro (§4 de E7-sintesis), no acá ni en listas paralelas.** Detalle:
[`sesiones/2026-07-22-auditoria-e7-sintesis.md`](sesiones/2026-07-22-auditoria-e7-sintesis.md).

**🔐 ENCENDIDO DEL LOGIN — PARTE A (Vercel Pro) Y PARTE B (pre-encendido) HECHAS, PARTE C
(Google OAuth) EN CURSO — 22/07/2026.** Siguiendo la «Guía definitiva» de
[`GUIA_LOGIN_SETUP.md`](GUIA_LOGIN_SETUP.md): **Parte A** — Vercel Pro contratado ($20/mes + spend
limit $20 con pausa automática + functions en `gru1`). **Parte B** — al correr los dispatches de
prueba aparecieron 2 bugs reales en las Edge Functions de E5, arreglados en **PR #59 (mergeado)**:
el 403 de `lineup-ingest`/`dea-fetch` (comparaban el bearer contra un valor de Supabase que puede
no coincidir entre las keys legacy/nuevas del proyecto — fix: decodificar el JWT ya verificado por
el gateway y exigir `role=service_role`) y el timeout de `dea-fetch` (120s→240s, reveló que **DEA
sigue sin conectar ni desde São Paulo** — `tcp connect error`, mismo bloqueo que ya afecta a GitHub
Actions, **sin resolver**, cubierto por el healthcheck+alertas mientras tanto). Resto de Parte B
verificado: `RESEND_API_KEY` (3 alertas reales confirmadas), `SUPABASE_SERVICE_KEY` en Vercel
(el primer intento quedó sin valor, corregido), revoke de las 7 matviews de mesa aplicado y
verificado (anon 401, web sigue sirviendo con la service key), Edge Functions fantasma borradas,
healthcheck 17/17 verde. **Leaked password protection quedó diferido a propósito** (requiere
Supabase Pro $25/mes, plan Free confirmado por MCP; decisión de Lautaro: no por ahora). **Parte C**
arrancada: env vars básicas + Google OAuth configurado y **probado con éxito** (Lautoro logueado,
admin auto-aprobado), app name + logo cargados en el consent screen de Google. **Quedó pendiente:
publicar la app de Google a producción** (gratis, no confundir con el dominio custom de Supabase
que sí es pago y es solo estético) — chocó con el paso nuevo de "verificación de marca" de Google,
retomar con captura completa de esa pantalla. `AUTH_ENFORCED` sigue en `false` — la web sigue
100% pública. Detalle completo:
[`sesiones/2026-07-21-auditoria-e5-infra.md`](sesiones/2026-07-21-auditoria-e5-infra.md) § «Continuación».

**🏗️ AUDITORÍA E5 (infraestructura, ingestas y seguridad operativa) — CERRADA (fase 1 + fase 2,
TODO aprobado por Lautaro el 22/07) — rama `claude/auditoria-e5-infra`, PR #58.** Quinta etapa de la
auditoría integral: 14 ingestas × ~120 runs reales de Actions + monitoreo + crons + secretos + camino
del login + hosting. Informe: **[`auditoria/E5-infra.md`](auditoria/E5-infra.md)** (14 hallazgos + 22
caminos de falso-verde + salud por workflow + hosting con precios verificados). **Fase 1 — lo más
grave que apareció:** (1) la fase 2 de E1 **borró sin saberlo la semana real del 15/07 de `compras`**
(`delete where fuente='MAGYP'` sin filtro; el cron del lunes ya había cargado 23 filas reales + 7
basura de un 2º grupo de paneles viejo de la página MAGyP) — se auto-repara el jueves 23/07; (2)
`ingest-lineup` **rojo 6/6** (la RPC de refresh creció a 6 matviews y el `statement_timeout=8s` de
PostgREST la mataba); (3) el revoke de E1 sobre `ingest_cierres_cem` **neutralizado por el grant a
PUBLIC** (anon la ejecutaba — test empírico); (4) prender `AUTH_ENFORCED` **rompía la Routine MP3**
(el proxy bloqueaba `/api/views/insumos` antes del token); + DEA caída 4/4, alertas de un solo canal,
hardcodeos con vencimiento sin aviso, pizarra T-1, INFORME_TOKEN por query. **Verificado BIEN:** cero
secretos en 139 commits · crons sin líos de DST · cierres/cbot/conab/usda/noticias verdes de verdad ·
CONAB "vieja" es la fuente, no la ingesta · PAS ya cerrado por E6. **Fase 2 HECHA el 22/07 (todo
aprobado):** por MCP → `ALTER FUNCTION refresh_lineup_visitas SET statement_timeout='300s'` (refresh
medido 28,8 s, aplicado + refresh manual) · DROP `ingest_cierres_cem` · RLS initplan `(select
auth.uid())` · **Edge Function nueva `dea-fetch`** (sa-east-1, mismo remedio que ISA; `ingest-dea.mjs`
la invoca) · redeploy `lineup-ingest` v3 (auth por comparación de service key, adiós decode sin
firma). En el repo → **compras decisión (b)**: MAGyP sigue automática, parser descarta el grupo viejo
(verificado: 30→23 filas todas del 15/07), upsert `ignore-duplicates` (MAGyP solo inserta, Agrochat
manda) · **guards por componente** en GEA/pizarra/CBOT/cierres/noticias/USDA (los 22 caminos de
falso-verde del Anexo A) · **alertas Resend** en rojo (6 workflows críticos → lautaroronchi97@gmail.com)
· healthcheck ampliado (17 checks: +views_mercado, +vencimientos-futuro ≥180d, +seed-calendario ≥60d,
DEA 16d→9d) · `ingest-cierres.mjs` ahora **refresca `vencimientos` cada noche** desde CEM /symbols
(el CEM ya lista DIC27, el seed moría en SEP27) · test Vitest que exige `FERIADOS_AR` del año próximo
desde octubre · 4º cron de pizarra (18:00 ART, fin del T-1) · barrido de 13 workflows (permissions,
timeouts, concurrency —group `compras` compartido—, nvmrc, actions v5, `replace_legacy` default
false) · proxy deja pasar `/api/views|informes/*` (token es su auth) + cap 2 MB en POSTs públicos ·
`INFORME_TOKEN` por header Bearer + timingSafeEqual (skill MP3 y prompt MP1 actualizados) · CSP
Report-Only + HSTS · `src/lib/supabase.ts` prefiere `SUPABASE_SERVICE_KEY` (server-only) + migración
de **revoke de las 7 matviews de mesa versionada SIN aplicar** (se aplica en el encendido). **Hosting
DECIDIDO: Vercel Pro $20/mes 1 asiento + gru1 + spend limit, se contrata ANTES de clientes.**
**Próximo paso — pasos manuales de Lautaro, EN ORDEN, en la «Guía definitiva 22/07» al tope de
[`GUIA_LOGIN_SETUP.md`](GUIA_LOGIN_SETUP.md):** Parte A Vercel Pro → Parte B pre-encendido (mergear
PR #58 · `SUPABASE_SERVICE_KEY` en Vercel · secret `RESEND_API_KEY` en GitHub · dispatches de prueba
· aplicar revoke · leaked protection · borrar Edge Functions fantasma) → Parte C encendido del login.
Detalle: [`sesiones/2026-07-21-auditoria-e5-infra.md`](sesiones/2026-07-21-auditoria-e5-infra.md).

**🧑‍💻 AUDITORÍA E4 (código y arquitectura) — CERRADA (fase 1 + fase 2) — rama
`claude/auditoria-e4-codigo-p28mxd`, PR #55.** Cuarta etapa de la auditoría integral. **Fase 1**: 4
sub-auditorías en paralelo (duplicación · estructura/código muerto · tests/fixtures · calidad/perf) con
evidencia archivo:línea, 23 hallazgos. **Veredicto: código en buen estado general** (0 deps sin uso,
`server-only` bien aplicado, degradación uniforme con solo 2 `throw` sueltos en todo `src/lib/`, 0 casos
de N+1, `globals.css` bien organizado — 20 secciones, solo 3/500 clases muertas). Lo más grave: el
espejo `compras/parse-agrochat.ts` ↔ `scripts/cargar-compras.mjs` **ya había causado un bug real en
producción** (fix ÷1000 del 20/07 a mano en los dos lados) y tenía una divergencia nueva activa;
`lineup/campanas.ts` ↔ SQL `campana_ini_year` **ya divergían** (SOJA_CRUSH); un hallazgo de
**performance real**: todas las páginas públicas mandaban el SDK completo de Supabase (~235 KB) al
bundle del cliente por un import estático de `AuthMenu`. Lautaro contestó las dudas en el chat (sin
scrollear el informe) y aprobó todo salvo los refactors grandes → **fase 2 HECHA el mismo día**:
espejos con **import real** (`cargar-compras.mjs`/`ingest-noticias.mjs` ya no reimplementan, importan
`src/lib` directo — Node 22 puede importar `.ts` sin flags); **3 migraciones SQL** (SOJA_CRUSH en
`campana_ini_year` · función de chequeo de `ADMIN_SEED_EMAILS` · `compras.*` migrado a `numeric`, con
recreación de la matview `compras_avance_hist`); **`AuthMenu` con `next/dynamic({ssr:false})`** —
`/comercio` bajó de ~783 KB a **526 KB** First Load JS, `/graficos` de 1.150 KB a **911 KB**; los 11
quick wins restantes (dedup de helpers, `arNum` null-safe, try/catch en upload y proxy, `calc-planta.tsx`
extraído a lib, fallback de empresa unificado, código muerto borrado); y **Vitest completo**: 14
archivos, **91 tests verdes**, sobre las 12 libs puras aprobadas + `campanas.ts` + `dates.ts`, con los
fixtures exactos de `E2-formulas-fichas.md`, corriendo en CI. **Diferido a E7** (aprobado): partir
`market.ts` · unificar los 9 parsers de mes/posición A3 · motor de gráfico SVG compartido ·
`noUncheckedIndexedAccess`. **`sample.ts` (hallazgo #15) desbloqueado por la fase 2 de E3** (sacó la
serie de ejemplo de `implicitas-panel.tsx`, sample.ts quedó sin importadores) **→ borrado en esta misma
sesión**, al mergear ambas ramas. Informe: [`auditoria/E4-codigo.md`](auditoria/E4-codigo.md). Detalle:
[`sesiones/2026-07-21-auditoria-e4-codigo.md`](sesiones/2026-07-21-auditoria-e4-codigo.md).

**🖥️ AUDITORÍA E3 (UX / navegación) — FASE 1 (informe) + FASE 2 (fixes aprobados) HECHAS — rama
`claude/auditoria-e3-ux-auikht`, PR #57.** Recorrido de las ~38 rutas × 4 lentes (mesa · cliente · mobile
390px · tema claro/oscuro) con build local + datos reales + Playwright (152 capturas en
`auditoria/screenshots-e3/`; bypass local `E3_AUDIT_BYPASS` para las gateadas, revertido y git diff limpio).
**Veredicto: el sitio muy bien en lo grueso.** Informe con 11 hallazgos + 6 dudas:
**[`auditoria/E3-ux.md`](auditoria/E3-ux.md)**. **Lautaro aprobó y se implementó la FASE 2 en la misma rama:**
**H2** header mobile colapsa (fin del scroll horizontal ~95px en todas las `(site)`) · **H3** sacado "ISA
Agents" de los sellos de line-up (puertos → "Elaboración propia ROFO AGRO") · **H4** cinta con **pizarra real
de CAC** (soja 339,7, fin del ejemplo hardcodeado) · **H5** sacada la serie "Granos (ej.)" de Implícitas ·
**noindex global QUITADO** (ya no hay dato de ejemplo a la vista; las páginas de mesa mantienen el suyo) ·
**H7** DJVE oculta los ~70 productos sin actividad · **H8** `/produccion` en **pestañas Calendario/
Estimaciones** (fin del scroll de 20.000px) · **H9** **404 branded** (adiós al default de Next en inglés) ·
**H10** `granos/view` sin error crudo de Postgres · **H11** back-links redundantes fuera. Verificado en
navegador + lint/tsc/build ✅. **H1/H6** (`/comercio/embarques` vacía + RITMO de empresas en "—", por las
vistas `djve_embarques_mes`/`lineup_estacional` no materializadas que tiran **HTTP 500 bajo concurrencia**):
**migración `20260721180000` APLICADA por MCP (a pedido de Lautaro) y verificada** — las dos pasaron a
matview y ahora aguantan la concurrencia (0/12 fails, antes 12/12 y 10/10 en 500). Las páginas se pueblan
en la próxima regeneración ISR / al mergear a `main`. **Pendiente menor:** **H12** (`/graficos` overflow
mobile por su chart, no aprobado) · **D6** montos "VIEJA" de empresas → E1/E2. Detalle:
[`sesiones/2026-07-21-auditoria-e3-ux.md`](sesiones/2026-07-21-auditoria-e3-ux.md).

**🕰️ AUDITORÍA E6 (historia del repo) — CERRADA — rama `claude/auditoria-e6-historia-yk24fj`, PR
#56.** Recorridos los 54 PRs y las 29 bitácoras de `docs/sesiones/` en orden cronológico.
**Hallazgo operativo (no documental) más importante: la ingesta DEA-SAGyP viene fallando por timeout
de conexión** a `datosestimaciones.magyp.gob.ar` — nadie lo había notado en 5 días (ni la auditoría
E1 del mismo 21/07); el dato de DEA quedó parado en el snapshot del 13/07. Se re-corrió el dispatch
en esta sesión para descartar que fuera transitorio: **falló una 3ª vez con el mismo error**,
confirmado persistente → **diferido a E5** para la mitigación (reintentos/backoff o mover a Edge
Function, como ya se hizo con `lineup`/ISA). **Segundo hallazgo: el probe de PAS (BCBA) ya había
corrido el 12/07 y ya había contestado** (HTTP 403, Cloudflare bloquea también las IPs de GitHub
Actions) — nadie leyó el log en 9 días; **cerrado formalmente** (`ESTADO.md`/`CONTEXTO.md`/
`PLAN_CALENDARIO_PRODUCCION.md`/`PLAN_BACKLOG.md` actualizados, respaldo = mail de Lautaro). Además:
**`PLAN_PUERTOS.md` corregido** (quedó sin tocar desde el 18/07 pese a que sus Fases 2-4 se
completaron los días siguientes — banner y Fase 4 actualizados) · **lista única de pendientes**
(`CONTEXTO.md` retiró su propia sección «Pendientes», apunta a este archivo + `PLAN_BACKLOG.md`; la
lista v2 de gráficos de acá apunta a **P6**) · **7 ramas remotas con PR ya mergeado sin borrar**
(comandos en el informe, sin borrar ninguna) · tabla "Ramas vivas" vieja de este archivo marcada
obsoleta · 3 migraciones con version de Supabase distinto al nombre de archivo, comentadas. Lo bueno
verificado: 53/54 PRs mergearon limpio (el único cerrado sin merge, #2, tuvo su contenido rescatado
sin pérdida) y el protocolo de sesión se sostuvo con disciplina real. **Pendiente real que sigue
abierto**: si Lautaro ya probó el uploader de `/admin/datos` logueado (sin confirmar). Informe:
[`auditoria/E6-historia.md`](auditoria/E6-historia.md).

**🔮 MP3 — VIEW DE MERCADO POR GRANO (PLAN_INFORMES) — CÓDIGO EN `main`, ROUTINE CREADA (23/07).**
Lautaro validó el primer view en `/granos/view` y se mergeó el PR #53 (rama
`claude/mp3-lee-prompt-th37ix`). **Routine semanal creada** (cron `0 12 * * 5` = 9:00 ART viernes;
Lautaro le puso modelo Opus a mano desde la sección "Rutinas" de la app — `update_trigger` con
`model` lo rechazó desde este entorno, `model_update_disabled`) — detalle en
[`sesiones/2026-07-23-mp2-skill-y-alta-srl.md`](sesiones/2026-07-23-mp2-skill-y-alta-srl.md). El
primer disparo real es el viernes que viene, sin verificar todavía.

Se ejecutó el PROMPT MP3 **antes
que MP1** (pedido explícito; la dependencia era blanda — MP3 solo reusa el patrón). **Base**: tabla
`views_mercado` (migración `20260721150000`, APLICADA por `execute_sql` — el canal de aprobación del
MCP sigue caído) con RLS interno-mesa DE VERDAD (SELECT solo admin por `is_admin()`, anon revocado;
feedback por RPC `admin_feedback_view` con guard). **Código**: endpoint `/api/views/insumos?token=`
(env `INFORME_TOKEN`, patrón del `/api/informes/datos` de MP1) que junta TODOS los insumos reusando
las libs reales (temperatura/semaforo/empresas/embarques/negociado/estimaciones/curva/pases/
arbitrajes/capacidad/pizarra/chicago/dólar/noticias/agenda) · skill **`.claude/skills/view-mercado/`**
(procedimiento semanal + loop de calibración por feedback + regla dura "ni un número inventado") ·
página **`/granos/view`** (`requireAdmin` SIEMPRE): view vigente por grano + historial + **campo de
feedback de Lautaro** (server action → RPC), links desde `/granos` y `/comercio/temperatura`.
**Primer view REAL guardado (21/07)**: soja **ALCISTA 4/5** (crush MESA 85,1 CALIENTE · farmer pctl
0 · DJVE 60d ratio 0,08 · FAS +2,1 vs pizarra · Chicago 449,3) · maíz **NEUTRAL 3/5** (demanda corta
8,58 Mt declaradas vs 2,34 originadas PERO cosecha récord 68 Mt y Chicago flojo) · trigo **NEUTRAL
3/5** (line-up pctl 93 firme HOY pero gap cerrándose y programa AGO chico; "VENDER YA" compartido).
Verificado: lint/tsc/build ✅ · RLS por SQL (anon denied, no-admin 0 filas/"solo admin") · números
1:1 vs insumos/SQL · navegador claro/oscuro (bypass y policy temporales revertidos). **Próximos
pasos: (1) Lautaro lee `/granos/view` logueado y deja feedback → OK → merge; (2) post-merge crea la
Routine semanal** (cron `0 12 * * 5` = 9:00 ART viernes, modelo Opus/Fable, prompt en el doc de
sesión) con env vars `INFORME_BASE_URL`/`INFORME_TOKEN` (mismo valor en Vercel)/`SUPABASE_URL`/
`SUPABASE_SERVICE_KEY` en el entorno de Claude. La sección del semanal la integra MP2. Detalle:
[`sesiones/2026-07-21-informes-mp3-view-mercado.md`](sesiones/2026-07-21-informes-mp3-view-mercado.md).

**🔎 RESEARCH P3 (compras netas BCRA) + P4 (camiones en puerto) — HECHO, build espera OK de Lautaro —
rama `claude/research-p3-p4-phases-u4e8k3`, PR #52.** Solo docs (pedido explícito: fases de research de
`PLAN_BACKLOG.md`, cero código). **P3** → [`negocio/07_fuente_compras_netas_bcra.md`](negocio/07_fuente_compras_netas_bcra.md):
la **API v4 del BCRA ya tiene el dato oficial** — var 78 "Variación de reservas internacionales por
compra de divisas" (diaria, M USD, 2003→hoy = 5.768 filas, backfill en 2 requests, rezago ~3 hábiles).
Semántica verificada 1:1: es la compra neta al **sector privado** (el MULC), var 78 = var 47 ÷ TC
mayorista SIEMPRE, incluso los 14 días desde 2025 con operaciones al Tesoro (var 48) ≠ 0. X/medios
descartados para automatizar; volumen MAE queda como color del día. **P4** →
[`negocio/08_fuente_camiones_puerto.md`](negocio/08_fuente_camiones_puerto.md): **SAGyP/MAGyP publica
la entrada diaria de camiones** por zona portuaria (4) y producto (6) + vagones + camiones en playa
(página de logística, mismo dominio que `ingest-compras.mjs`), **rezago 1 día hábil** (al 21/07 llegaba
al 20/07) y con **historia diaria 2018→hoy en ~103 PDFs mensuales** (formato estable verificado en
ambas puntas; identidades zona=producto=total cierran; extractor de PDF sin dependencias probado).
BCR = solo prosa · dataPORTUARIA = noticias · CKAN MAGyP muerto → descartadas. Cada informe cierra con
comparativa + arquitectura del build + **preguntas abiertas para Lautaro** (P3: ¿alcanza rezago 3
hábiles o quiere carga manual del día? · P4: visibilidad solo-mesa vs pública, alcance del backfill).
**Próximo paso: Lautaro responde esas preguntas → recién ahí correr las fases build** (prompts P3/P4
de `PLAN_BACKLOG.md`, tablero actualizado). Detalle:
[`sesiones/2026-07-21-research-p3-p4.md`](sesiones/2026-07-21-research-p3-p4.md).

**🧮 AUDITORÍA E2 — CERRADA (fase 1 + fase 2) — rama `claude/e2-formulas-go9i9y`, PR #51.**
Lautaro contestó los 6 hallazgos y las 11 preguntas en bloque (21/07) y la FASE 2 quedó implementada:
**base** — `djve_cobertura` materializada (migración `20260721120000`, aplicada por MCP: anon pasó de
timeout 57014 a HTTP 200 en 2,5 s → `/comercio/empresas` y `/comercio/senal` vuelven) + refresh de las
matviews gap/densidad (al 20/07). **Código** — UST$T fijado a plazo `000` (T+0, su referencia) ·
picker de calculadoras con vencimiento REAL de `vencimientos` (TNA alineada con el panel) · pases:
se AGREGARON los consecutivos (SEP/NOV etc.) · aforo pasó a % RELATIVO (183,8% aforo 2 → 180,17%) ·
semáforo: soja en equivalente poroto (unificado con temperatura) · estrategias: 4 presets nuevos (31),
"Máx. pérdida/ganancia" con extremos REALES ("ilimitada" / payoff en P=0) + nota "primas estimativas".
**Docs** — plan calendario y FORMULAS_EXCEL corregidos (BCR ADELANTA por feriado — verificado con el
GEA real del 08/07; fórmula vigente de negocios-con-pagos), comentarios obsoletos limpiados.
**Diferido:** calibración de umbrales de cobertura y parámetros MESA (provisorios, marcados en código)
+ comisiones de estrategias → **E7** · tests con los fixtures de las 45 fichas → **E4** · causa raíz del
refresh que no corrió el 20/07 + `lineup_estacional` intermitente → **E5**. Planes Cocos Gold/Pro → no.
Detalle FASE 1 abajo; informe con decisiones: [`auditoria/E2-formulas.md`](auditoria/E2-formulas.md).

**🧮 AUDITORÍA E2 (fórmulas y lógica de negocio) — FASE 1 (el informe) — rama
`claude/e2-formulas-go9i9y`.** Se auditó TODO el inventario del PROMPT E2 con verificación adversarial
(derivar desde docs → comparar código → ejemplo numérico con datos reales → bordes). **Veredicto: cero
bugs de fórmula en 45 fichas** — INTRATE act/365 1:1 en todas las libs, base 365 consistente, guards
completos, paridad server/cliente exacta, controles históricos reproducidos (Excel 125,6 y 0,5796 ·
trigo 16.238.900 t · pctl 59/23 · cumplimiento 146% · `campanas.ts` 612/612 vs SQL · factores CBOT
idénticos). Lo que apareció: **1 bug de RUNTIME** (`djve_cobertura` timeout 57014 por anon desde el
backfill 2011-2025 → **`/comercio/empresas` y `/comercio/senal` degradan HOY**; fix = materializar
patrón `lineup_visitas`), matviews gap/densidad al 16/07 vs line-up 20/07 (refresh no corrió → E5),
2 desfasajes doc↔código (el corrimiento por feriado del calendario está BIEN en el código —
verificado contra el GEA real del 08/07 — y mal en el plan; FORMULAS_EXCEL r27-36 documenta la
fórmula vieja de negocios-con-pagos), y **11 PREGUNTAS de criterio** para Lautaro (las top: dos filas
`UST$T` T+0/T+1 en MAE que mueven la TNA corta ~3,7 pp · picker de curva fin-de-mes vs vto real
(−0,8 pp TNA) · umbrales/pesos/rindes heredados del Python sin validar · primas default de
estrategias). Informe: **[`auditoria/E2-formulas.md`](auditoria/E2-formulas.md)** + anexo
[`auditoria/E2-formulas-fichas.md`](auditoria/E2-formulas-fichas.md) (45 fichas con números exactos =
fixtures para los tests de E4). **Las decisiones ya están tomadas y aplicadas — ver el bloque de
cierre arriba.** Detalle:
[`sesiones/2026-07-21-auditoria-e2-formulas.md`](sesiones/2026-07-21-auditoria-e2-formulas.md).

**🗃️ AUDITORÍA E1 (datos y base de datos) — CERRADA — rama `claude/auditoria-e1-datos-vjmwzd`, PR #50.**
Primera etapa de la auditoría integral ejecutada. **Veredicto: los datos guardados son correctos y fieles a
la fuente** — cotejo 1:1 exacto con requests reales (futuros ↔ CEM 11/11 filas, pizarra ↔ CAC $495.000 soja
17/07, CBOT ↔ Barchart 1203 ¢/bu → 442,03 USD/tn, compras ↔ trigo 25/26 Export 16.238.900 t); matviews
frescas; la limpieza monótona de compras clampea los defectos viejos. Lo que fallaba era de **modelo,
gobierno y monitoreo**. Informe: **[`auditoria/E1-datos.md`](auditoria/E1-datos.md)** (9 hallazgos + Anexo A
DDL vivo de las 5 tablas heredadas + Anexo B frescura). **Fase 2 aplicada** (por MCP + versionada): revoke
`ingest_cierres_cem` a anon (era ejecutable sin guard + INSERT/HTTP → anon ahora 404); borradas 7 filas
huérfanas `fuente=MAGYP`; `campana_ini_year` con search_path; índice en `profiles.approved_by` + drop
`idx_lineup_port` muerto; clamp del único saldo negativo; **healthcheck** ahora cubre `djve`+`compras`+3
checks de matview-refrescada (15 verdes); **migración-baseline** del DDL heredado. **DIFERIDO a E5:** el
cierre RLS de `lineup`+matviews de mesa — las páginas `/comercio/*` las leen con la **anon key server-side**
(no con el JWT), así que revocar las rompería; se cierra al prender el login. **Para E4:** `compras` en
`double precision` vs `numeric`, `campana_ini_year` duplicada en `campanas.ts`. Detalle:
[`sesiones/2026-07-21-auditoria-e1-datos.md`](sesiones/2026-07-21-auditoria-e1-datos.md).

**🔍 PLAN DE AUDITORÍA INTEGRAL (solo docs, cero código) — rama `claude/trading-project-audit-37aiqr`.**
Lautaro pidió auditar TODO el proyecto (módulos, fórmulas, páginas navegadas, base de datos, infra,
historia) planificando primero, sin tocar una línea. Resultado: **[`PLAN_AUDITORIA.md`](PLAN_AUDITORIA.md)**
— 7 etapas con **un prompt autocontenido por etapa** para ejecutar en sesiones nuevas (E1 datos/base →
E2 fórmulas → E3 UX 4 lentes → E4 código → E5 infra/seguridad → E6 historia por PR → E7 síntesis +
backlog maestro), con flujo *informe → OK de Lautaro hallazgo por hallazgo → recién corregir* y plantilla
en `auditoria/_TEMPLATE.md`. Se relevó base para no re-descubrir: `src/` completo (fórmulas localizadas
archivo:línea), 14 ingestas/13 workflows/21 migraciones, y la base viva por MCP (advisors ya marcaron:
matviews de mesa legibles por anon vía API, ~17 RPC SECURITY DEFINER ejecutables por anon/authenticated,
5 tablas heredadas sin DDL en el repo, healthcheck sin cubrir compras/djve/matviews) — todo precargado
como "semilla" en los prompts. **Próximo paso: ejecutar el PROMPT E1** de `PLAN_AUDITORIA.md` en una
sesión nueva. Detalle: [`sesiones/2026-07-21-plan-auditoria.md`](sesiones/2026-07-21-plan-auditoria.md).

**📰 PLAN DE INFORMES AUTOMATIZADOS (ítems 11 y 21) — misma sesión y PR #49.** Segundo plan del día:
**[`PLAN_INFORMES.md`](PLAN_INFORMES.md)** — 4 mini-proyectos con un prompt autocontenido c/u:
**MP1 informe diario** (placa PNG para WhatsApp: datos de la web + "color de la rueda" que Lautaro
carga en /admin + prosa `voz-lautaro` molde "Mesa de operaciones") → **MP2 informe semanal** (PDF
research 3-5 páginas; cierra de paso el ítem 13) → **MP3 view de mercado por grano** (alcista/bajista/
neutral con research citando datos de la web; interno mesa primero) → **MP4 interpretación de informes
de organismos** (ítem 21; borrador → OK en /admin → publica en /produccion). **Worker = Routines de
Claude Code** (sesiones programadas, corren con la suscripción de Lautaro — decisión: no gastar en
API; OpenRouter evaluado y descartado, plan B = GH Actions + API Anthropic documentado). Render =
página Next oculta que reusa libs + CSS reales; entrega = Resend + página `/informes`. **Próximo paso
de este plan: ejecutar el PROMPT MP1** (antes, Lautaro configura las env vars del entorno de Claude
Code — listadas en el plan).

**🗂️ PLAN DEL BACKLOG COMPLETO — misma sesión y PR #49.** Tercer plan del día:
**[`PLAN_BACKLOG.md`](PLAN_BACKLOG.md)** — tabla de mapeo de TODOS los pendientes a su plan (los ya
cubiertos apuntan a auditoría E3/E4/E5 o a informes MP1-4, sin duplicar) + **12 prompts autocontenidos
P1→P12** para los que no tenían: P1 Merval/EWZ/vol. Matba · P2 variación semanal USD · P3 compras
netas BCRA · P4 camiones en puerto · P5 vista por grano · P6 gráficos v2 · P7 vista productor + PWA ·
P8 feed A3 intradiario · P9 sintéticos TIR · P10 estrategias avanzadas · P11 capacidad de pago propia ·
P12 scoring de clientes. Los que esperan insumos de Lautaro (P9-P12, parte de P6) llevan el insumo
como paso 1 del prompt. Con esto **TODO pendiente del proyecto tiene dueño**: se ejecuta pegando el
prompt correspondiente de los 3 planes en una sesión nueva; el backlog maestro único lo consolida la
etapa E7 de la auditoría.

## Anterior (20/07/2026 — fix compras ÷1000 + prompt Agrochat en el uploader)

**🔧 FIX DE DATOS (compras semana 08/07 ÷1000) + PROMPT AGROCHAT EN EL UPLOADER — rama
`claude/pendientes-4c5ovu`.** Al probar el uploader (`/admin/datos`) apareció que **toda la semana del
08/07/2026 estaba cargada ÷1000** (30 filas, todas las columnas): venía así desde la carga original del
19/07 y el saneamiento del 20/07 solo había tocado los valores *gigantes* (>1e9), no estos *chicos*. Se
reescribieron las 30 filas con los valores del CSV verificado del repo (control: trigo 25/26 Export
16.088.400→**16.238.900**, coincide 1:1 con MAGyP) por `execute_sql` (la RPC `admin_upsert_compras` exige
`is_admin()`, no corre por MCP) + `refresh_compras_avance()`; 0 caídas de acumulado desde 2025.
**Causa raíz:** el export **"Última Semana" de Agrochat viene en MILES de toneladas** (trigo 16238,9), la
base guarda toneladas enteras → subirlo tal cual mete la semana ÷1000. **Fix de proceso:** componente
`src/app/admin/datos/prompt-agrochat.tsx` (client, botón copiar) con el **prompt canónico** que le pide a
Agrochat el export en **toneladas enteras** con la cabecera y unidades exactas; Lautaro lo copia cada
semana cambiando solo la fecha. **Guard de unidades HECHO** (`actions.ts` + checkbox "forzar" en
`uploader.tsx`): en la previsualización avisa y en la confirmación **bloquea** si el acumulado subido cae
>50% vs el último acumulado de esa clave ya en la base (imposible en un acumulado → señal de export en
miles), salvo que se tilde "forzar". Umbral de bloqueo: ≥3 filas sospechosas y ≥30% de las comparables.
lint/tsc/build ✅.

## Anterior (20/07/2026 — Home = novedades del día)

**🏠 HOME = NOVEDADES DEL DÍA (ítem 4 del backlog) HECHO — rama `claude/desarrollos-pendientes-unm9cg`.**
Se dio vuelta la jerarquía del home (antes: cinta + grilla de secciones del rediseño UX #22). Ahora `/` es
un tablero de novedades: **Novedades del día** (titular destacado grande + hasta 7 titulares más, de
`getNoticias().destacados`) → grid `home-panels` con **El mercado hoy** (`src/components/mercado-hoy.tsx`,
nuevo — **reusa `getMonitorMercados()`** del #42: los 5 granos de Chicago en USD/tn + Δ del día con
semáforo) + **Próximos informes** (`InformesPanel`, reusado) + **Última estimación** (`EstimacionesMini`,
reusado; degrada a nada si la tabla está vacía) → **grilla de secciones compacta** al pie ("Explorá el
sitio"). El dólar no se repite en "El mercado hoy" (ya vive en la cinta). Se preservó el filtro de permisos
por sección con el login prendido (mercado hoy = `granos`; informes/estimación = `produccion`). lint/tsc/
build ✅; navegador claro+oscuro con datos reales (soja NOV26 450,1 USD/tn, coincide 1:1 con el monitor de
`/granos`). **Trampa:** el checkout arrancó 50 commits atrás del main real (#46) → se reancló la rama antes
de construir. Detalle: [`sesiones/2026-07-20-home-novedades.md`](sesiones/2026-07-20-home-novedades.md).

**📈 MONITOR DE MERCADOS (Chicago + macro) — HECHO Y VERIFICADO — rama `claude/todo-implementation-7nockf`,
PR #42.** Panel nuevo en `/granos` **debajo de la tabla de Arbitrajes**: bloque **agro destacado** (soja ·
aceite de soja · harina de soja · maíz · trigo de Chicago, posición continua, **normalizados a USD/tn**)
+ bloque **macro/referencias informativo** (**maní ZCE** · WTI · oro · plata · DXY · USD/BRL · SPY con su
unidad propia). **View-only**
(pedido explícito: nada se guarda — sin tabla, sin cron, como el feed A3): `src/lib/monitor-mercados.ts`
(fetch batch `spark` de Yahoo con `React.cache()`+`revalidate:30`, parser de posición robusto, conversión
a USD/tn con los factores de `ingest-cbot.mjs`) + `src/components/monitor-mercados.tsx` (server component,
hereda el refresh de la página) + bloque CSS chico en `globals.css`. **Maní** agregado a pedido de Lautaro:
no cotiza en Chicago → único futuro del mundo = **Bolsa de Zhengzhou (ZCE, China)**, contrato `PK`, traído
del continuo de Sina (`nf_PK0`, parse por índice sin GBK) y pasado a USD/tn con `CNY=X`; va **separado** de
Chicago, encabezando el bloque de referencias con tag "China" (benchmark internacional, no el maní argentino). **Fuente** elegida del catálogo de
skills de gauss y verificada con request real (endpoint `spark`, 1 request → los 11 sin auth, requiere
User-Agent). **Delay medido: futuros + DXY 10 min exactos, SPY y USD/BRL en tiempo real**; se investigó si
alguna fuente del catálogo baja el delay → **NO** (10 min es el piso de licencia CME/ICE; Barchart medido
= 10,0 min igual; Investing 403 Cloudflare; tabla en el plan §3.b) → sello honesto "futuros demorados
~10 min" (nombra CBOT·NYMEX·COMEX·ICE). **Cadencia objetivo (1 min) sin infra nueva**: viaja en el ISR de
30 s que `/granos` ya tiene. **Verificado**: lint/tsc/build ✅ · lógica 1:1 vs datos reales (soja 1.226,5
¢/bu → 450,7 USD/tn, etc.) · SSR con valores reales · navegador claro+oscuro. Decisiones (20/07): solo
continuo · visibilidad sección "granos" · WTI. Plan: **[`PLAN_MONITOR_MERCADOS.md`](PLAN_MONITOR_MERCADOS.md)**;
detalle: [`sesiones/2026-07-20-plan-monitor-mercados.md`](sesiones/2026-07-20-plan-monitor-mercados.md).
**PR #42 MERGEADO a `main`.** (Antes en el día: PR #41 mergeado — repaso del backlog
contra la nota vieja de Lautaro, ítem 21 nuevo.)

## Anterior (20/07/2026 — Tabla de datos + marca de agua en todos los gráficos)

**📊 TABLA DE DATOS + MARCA DE AGUA EN TODOS LOS GRÁFICOS — rama `claude/data-table-charts-2m8nvd`,
PR #43 (MERGEADO).** Pedido de Lautaro: doble lectura curva+número en cada chart + el **logo completo** como
marca de agua. **Fundaciones**: `ChartTabla` (`chart-tabla.tsx`, tabla genérica **SIEMPRE visible** bajo el
gráfico — sin toggle, decisión 20/07 —, reusa `.tbl` con header sticky + scroll propio, el caller formatea
es-AR) y `ChartMarca` (`chart-marca.tsx`, overlay server-safe del logo; opacidad y tamaño centralizados en
`.cm-marca` de `globals.css`, debajo del tooltip — subida a **.20/.22 claro/oscuro** a pedido de Lautaro para
que se note más) + asset **`public/rofoagro-logo-marca.svg`** (logo completo limpiado de los halos del
auto-trace SOLO en la zona del isotipo — los blancos del wordmark son los contadores de las letras, se
conservan). **Integrado en todos los gráficos**: `/graficos` (los 2 modos; la tabla sale de las MISMAS rows
que dibuja Recharts, X con el formato del tooltip, banda mín/med/máx) · `/produccion` (evolución: fecha ×
organismo) · `/dolar` (tabla de la curva con SPOT + **pivot** de implícitas plazo × serie) · calcs "a fijar"
y "estrategias" (**solo marca** — sus tablas de escenarios ya listan los mismos datos). **Cero fórmulas
tocadas**; `watermark.tsx` (login) intacto. **Verificado**: lint/tsc/build + navegador claro/oscuro con datos
reales cotejados 1:1 contra KPIs/leyendas (soja MAY/JUL mín 5,10/máx 9,40 · dólar SPOT 1.478,5/DIC26 1.625,0 ·
implícitas 10d 11,1% · producción 149,00 Mt) + cero errores de consola. Cierra el pendiente "tabla
alternativa" de la v2 de gráficos (se hizo siempre visible). **Seguimiento (PR #45, MERGEADO)**: el gráfico
nuevo `/comercio/negociado` (histograma de SIO Granos, llegó en el PR #44 después de arrancar el #43) también
recibió su tabla + marca — mismo patrón, reusa `ChartMarca`/`ChartTabla` (rama `claude/negociado-tabla-marca`;
tabla semana/mes × Exportación/Industria/Total en t; verificado en navegador claro/oscuro con datos sintéticos
porque la página exige admin). Con esto **TODOS los gráficos de la web** quedaron con la doble lectura + marca.
Ojo sandbox: se creó `.env.local` (gitignoreado) con las creds públicas de Supabase para builds con datos.
Detalle: [`sesiones/2026-07-20-tabla-datos-y-marca-graficos.md`](sesiones/2026-07-20-tabla-datos-y-marca-graficos.md).

## Anterior (20/07/2026 — Negociado por producto (SIO Granos) + uploader admin de compras)

**📊 NEGOCIADO POR PRODUCTO (ítems 8 y 9 del backlog, convergen) + UPLOADER ADMIN — rama
`claude/volumen-siogranos-analysis-iq6dnd`, PR #44.** Página nueva **`/comercio/negociado`** (solo mesa,
`requireAdmin`) sobre la serie semanal de `compras` (SIO Granos): KPIs de la última semana (total negociado
todos los granos, grano líder), **tabla por producto/campaña** (campaña activa = mayor venta semanal; semanal,
Δ vs semana anterior, acumulado, **% sobre cosecha** vía `compras_avance_hist`, **% priceado** = (precio hecho
+ fijado)/acumulado, saldo a fijar; filtro por sector + CSV) e **histograma SVG** apilado Exportación+Industria
con toggle **Semanal (52 sem.) / Mensual (24 meses)** y selector de grano. Lee `compras` SIN filtrar `fuente`
(cuando el cron MAGyP sume semanas nuevas, aparecen solas). UI dice **SIO Granos** (Agrochat = puente, no se
nombra). **Uploader `/admin/datos`** (pestaña nueva): Lautaro sube el export de Agrochat (**CSV o .xlsx** —
xlsx parseado SIN dependencias, ZIP+inflateRaw, seriales de fecha manejados) → **Previsualizar** (resumen sin
escribir, claves existentes vs nuevas) → **Confirmar** (upsert por lotes vía RPC `admin_upsert_compras` +
refresh del avance; sin service key en la web). `serverActions.bodySizeLimit=16mb`. **2 migraciones nuevas**
(las aplica el orquestador por MCP): `20260720120000_admin_carga_compras.sql` (las 2 RPC SECURITY DEFINER con
guard `is_admin()` + **fix de seguridad**: drop de las policies públicas de INSERT/UPDATE de `compras` +
revoke) y `20260720150000_compras_avance_todas_fuentes.sql` (**matview v3**: el cron MAGyP pisa la última
semana por la clave UNIQUE y le cambia `fuente` → con el filtro `AGROCHAT` la última semana quedaba parcial y
rompía el `pctlFarmer`; ahora filtra solo `LEGACY`. De paso quedó **verificado empíricamente** que MAGyP y
Agrochat fechan igual el corte semanal: mismas claves). **Fix `num()`** en cargador y parser: el export trae
floats con punto decimal (`64099.99…`) que el parser viejo rompía (6,4e15) — **base SANEADA por MCP en esta
sesión** (529 valores en 477 filas corregidos; post-fix 0 valores >1e9; ya no hace falta re-subir el CSV).
**Verificado**: parser = 9.522 filas idénticas al dry-run del mjs (CSV y xlsx generado); `getNegociado()`
offline contra la serie real (total semanal 2.568.000 t; trigo 25/26 Exportación 16.238.900 t = el valor
verificado 1:1 con MAGyP); code review adversarial (4 fixes menores aplicados); lint/tsc/build. **Falta**:
confirmar las 2 migraciones aplicadas + que Lautaro pruebe el uploader logueado. Detalle:
[`sesiones/2026-07-20-negociado-siogranos-uploader.md`](sesiones/2026-07-20-negociado-siogranos-uploader.md).

## Anterior (19/07/2026 — Farmer selling C3 LIVE · serie Agrochat cargada · fix modelo)

**🌡️ ÍNDICE MESA — 3ª PATA (FARMER SELLING / C3) LIVE — PR #39 (base) MERGEADO + carga corrida; fix del
modelo en el PR #40 (rama `claude/desarrollos-pendientes-tqgic8`).** Al mergear el #39 se corrió el workflow
*Cargar serie histórica de compras*: **9.522 filas cargadas** (7 granos, 8 campañas, hasta 08/07/2026). Al
verificar con datos reales aparecieron 2 cosas, corregidas en el **PR #40**: (a) **modelo** — en cada fecha
conviven varias campañas; ahora se toma la **campaña activa = la de mayor venta semanal** (no la que recién se
planta) y el percentil es **calendario** (hoy vs misma fecha ±15d, últimos 5 años); (b) **refresh** — refrescar
las 4 matviews por PostgREST daba timeout (hizo fallar el 1er run del cargador tras subir bien los datos) → RPC
liviana `refresh_compras_avance()`. **Verificado por SQL** (lo que muestra la página): maíz avance 49,7%→pctl
59 · soja 43,3%→pctl 5 (retención fuerte) · trigo 71,2%→pctl 23. C3 corre con las **3 patas**. Detalle del build
inicial abajo; el fix en el mismo doc de sesión.

### Build inicial (PR #39, mergeado)
**ÍNDICE MESA — 3ª PATA (FARMER SELLING / C3) — rama `claude/desarrollos-pendientes-tqgic8`, PR #39.** Cierra la Fase 4: la pata de OFERTA (avance de ventas del productor) dejó de degradar a null.
Lautaro exportó de **Agrochat** la serie histórica semanal de comercialización (7 granos × 2 sectores ×
**8 campañas 19/20→26/27** × 389 semanas, en toneladas) → **verificada 1:1** (trigo 25/26 Exportador =
16.238.900 tn coincide con el scrape MAGyP de la Fase 4; volúmenes sensatos vs producción; identidades
contables cierran al 0,004%; defectos del origen —spike de 49,9 Mt, caídas en campañas viejas— registrados
y limpiados). **Decisión "juntemos todo"**: el avance SUMA Exportador + Industria (soja: SOJA_CRUSH y SBS
usan el total de poroto). **Matview `compras_avance_hist`** = comprado acumulado (suma de sectores + limpieza
monótona `min`-de-derecha que descarta spikes) / producción USDA AR (último vintage/campaña, Mt→tn);
`temperatura.ts` computa el `pctlFarmer` (percentil estacional) → índice con las 3 patas; panel con fila
"pctl farmer". **Base**: columnas ricas en `compras` (semanal/precio hecho/fijado/saldo/djve + `fuente`),
scraper vivo `ingest-compras.mjs` actualizado. **Cargador `cargar-compras.mjs` + workflow `cargar-compras.yml`**
(+ CSV versionado en `data/compras/`). **Verificado**: lógica de la matview por SQL sintético (spike
clampeado, suma de sectores, join USDA), transform del cargador (dry-run 9.522 filas), lint/tsc/build.
**FALTA (1 paso): al mergear el PR #39, correr el workflow *Cargar serie histórica de compras*
(workflow_dispatch)** — NO es disparable desde la rama (GitHub sólo despacha workflows de la default → 404)
→ carga las 9.522 filas + refresca la matview → **C3 queda live**. Hasta entonces el índice degrada solo a
las 2 patas de demanda (idéntico a antes; `compras` quedó vacía tras borrar las 715 filas LEGACY viejas). El
workflow carga los 7 granos + columnas ricas → habilita también el **ítem 8** del backlog (negociado/priceado
por producto). Detalle:
[`sesiones/2026-07-19-farmer-selling-c3-agrochat.md`](sesiones/2026-07-19-farmer-selling-c3-agrochat.md).

## Anterior (19/07/2026 — Comercio exterior Fase 4: temperatura de mercadería · índice MESA)

**🌡️ COMERCIO EXTERIOR — FASE 4 HECHA (temperatura de mercadería · índice MESA) — cierra el ítem 6 del
backlog.** Rama `claude/fase-4-temperatura-mesa-84g387`. El **PR #36 (parcial) se mergeó a `main`** (fuente +
scraper de compras + densidad C2); el resto del índice va en un **PR nuevo** (protocolo de PR mergeado: rama
reiniciada desde `main`). Página **`/comercio/temperatura`** (`requireAdmin`, solo mesa): semáforo por
producto — índice 0-100 por **percentil estacional** de las 2 patas de **demanda** (gap de cobertura C1 =
`lineup_gap_hist` · densidad de line-up C2 = `lineup_densidad_hist`, ambas 2020→2026) + momentum (dirección
del gap) → acción (DIFERIR / VENDER YA / COMPRAR BARATO). Soja crush por equivalente poroto. **Portado 1:1 de
`LineUps_Code`** (`estacional.ts` + `mesa_calor.ts`, **41/41 tests**). **La pata de OFERTA (farmer selling C3)
degrada a null** (índice sobre las 2 de demanda, pesos renormalizados) hasta que `compras` junte historia:
**MAGyP dio de baja el dataset CKAN** que usaba el scraper viejo (por eso `compras` se frenó el 11/06, no fue
IP) → fuente nueva = página institucional MAGyP "Compras y DJVE de Granos" (**scraper reactivado**,
`ingest-compras.mjs`, ambos sectores, verificado 1:1); su historia semanal solo es reconstruíble por
**Wayback desde Actions** (pendiente de correr). Research de fuente en
[`negocio/06_fuentes_comercializacion_granos.md`](negocio/06_fuentes_comercializacion_granos.md) + `FUENTES.md`
§13. **Verificado** 1:1 vs SQL independiente (MAIZE gap 39 / dens 94 · SBS 38 / 18) + render SSR con datos
reales (Maíz FIRME 65 · Trigo FIRME 76 · Soja crush 🔥 CALIENTE 81 · Soja poroto PESADO 29) + lint/tsc/build.
**Falta (para retomar):** prender la pata C3 vía **Agrochat** — **Wayback quedó DESCARTADO** (backfill corrido
desde Actions = **0 capturas** de la página MAGyP; no reintentar). Lautaro exporta de Agrochat el *comprado por
producto × sector × campaña, semanal, ~5 campañas* → armar `cargar-compras.mjs` + poner `pctlFarmer` real en
`temperatura.ts`. · reemplazar las 715 filas viejas de `compras` (semántica incompatible) · extras de la spec
(matriz por mes/zonas/"qué cambió"). Detalle:
[`sesiones/2026-07-19-comercio-temperatura-fase-4.md`](sesiones/2026-07-19-comercio-temperatura-fase-4.md).

## Anterior (19/07/2026 — Comercio exterior Fase 3: mesa de embarque + research DJVE + backfill)

**🚢 COMERCIO EXTERIOR — FASE 3 HECHA (mesa de embarque + research DJVE + backfill 2011-2025) — rama
`claude/fase-3-pr-pendiente-dkwjc0`, PR #35.** Antes de construir, Lautaro pidió **research de cómo
funcionan las DJVE** ("menos información antes que incorrecta") → 3 investigaciones con fuentes primarias
documentadas en **[`negocio/05_djve_marco_y_circuito.md`](negocio/05_djve_marco_y_circuito.md)** (qué fija
una DJVE · regímenes 30/360 · el granel declara VENTANA MENSUAL por norma · el forward paga el 90% de los
derechos a 5 días hábiles · el line-up "ve" ~10 días · cronología de retenciones 2023-2026). Eso definió el
diseño: **`/comercio/embarques`** (solo mesa, `requireAdmin`) = matriz **programa declarado por mes ×
producto** (split disponible/forward, referencia "programa final año pasado"), **cumplimiento del mes en
curso** (único cruce físico válido contra line-up, line-up>declarado es sano) y **tablas en idioma A3**
(mes → posición SOJ/MAI/TRI + ajuste). **Backfill DJVE 2011-2025 APLICADO** (+326.580 filas desde los XLS
oficiales SSMA, verificado por año; columna nueva `cosecha` para la era ROE; la cobertura de Fase 2 ya lo
refleja). **Perf**: dedup de visitas materializado (`lineup_visitas` + RPC de refresh llamada por
`ingest-lineup.mjs`) → las vistas de Fases 2-3 pasaron de ~6 s a ~66 ms; `lineup_originado_campana`
recreada 1:1. Migración `20260719180000` (por `execute_sql`; el canal de aprobación del MCP volvió a
caerse — workarounds en el doc de sesión). **Verificado 1:1 vs SQL** (maíz JUL 3.854/AGO 2.998 kt ·
cumplimiento 146% · A3 337,9) + navegador claro/oscuro real + lint/tsc/build. **Falta:** Fase 4
(temperatura, requiere reactivar `compras`). Detalle:
[`sesiones/2026-07-19-comercio-embarques-fase-3.md`](sesiones/2026-07-19-comercio-embarques-fase-3.md).

## Anterior (19/07/2026 — Comercio exterior Fase 2: empresas + semáforo)

**🚢 COMERCIO EXTERIOR / PUERTOS — FASE 2 HECHA (empresas + semáforo físico→precio) — rama
`claude/comercio-exterior-fase-2-id2fql`, PR #_.** Lo que quedó del PR #33. Se pensaron las lógicas con
Lautaro antes de construir. **Panel de empresas `/comercio/empresas`** (solo mesa, `requireAdmin`): por
exportador normalizado — **gap de cobertura foto-forward 60d** (declarado DJVE vs originado line-up →
señal alcista/bajista, `cobertura.py`), **avance de campaña**, **ritmo estacional** (line-up parado hoy
vs lo normal para esta época, 5 campañas), share por producto/zona, tabla filtrable + CSV; + tablas por
producto con **campaña nueva/vieja** y **disponible (op30)/forward (op360)**. **Semáforo físico→precio
`/comercio/senal`** (idea nueva): cruza la señal física de cobertura con la capacidad de pago (FAS
teórico) y la pizarra por grano. **Decisiones (19/07):** gap = las dos lecturas · ritmo = "line-up parado
vs lo normal" (estacional) · **transbordo PY/UY fuera del ratio** (no tiene DJVE argentina) · avance vs
Bolsa **descartado** · roster depurado 2025-26 (+8 empresas, −OLAM/PROMASA, Glencore→Viterra, fix acento
ACA). La DJVE es **solo registros** (sin "cumplido" — verificado): el cruce con line-up es la única forma.
Migración `20260719120000` (fn `campana_ini_year` + vistas `djve_cobertura`, `lineup_originado_campana`,
`lineup_estacional`). **Verificado 1:1 vs SQL** (maíz cobertura 0,32 · soja 0,11 · cebada 1,98) + ports
39/39 + lint/tsc/build. **Falta:** render en navegador (el MCP estuvo caído para escritura → validar en el
Preview del PR) y Fases 3-4 (mesa de embarque · temperatura). Detalle:
[`sesiones/2026-07-19-comercio-empresas-fase-2.md`](sesiones/2026-07-19-comercio-empresas-fase-2.md).

## Anterior (18/07/2026 — Puertos/line-up Fase 0 + Fase 1)

**🚢 PUERTOS / LINE-UP (ítem 6 del backlog) — PLAN CERRADO + FASE 0 (dato vivo) + FASE 1 (foto operativa)
HECHAS — rama `claude/desarrollos-pendientes-ypxvfd`, PR #33.** Se retoma el line-up de buques de ISA
Agents (tabla `lineup`, 6 años de historia, scraper frenado desde el 06/07). Lautaro pasó su repo
`LineUps_Code` (Python/Streamlit sobre la MISMA base) → la lógica se **porta**, no se reinventa. **Plan**
en [`PLAN_PUERTOS.md`](PLAN_PUERTOS.md) (11 decisiones + 5 fases): solo mesa (análisis protegidos siempre,
DJVE pública), subpáginas en `/comercio`, productos = complejos soja/girasol + maíz/trigo/cebada/sorgo,
zonas Up River N/S + Bahía. **Diagnóstico del freeze**: ISA bloquea las IPs de GitHub Actions (falso verde),
no se perdió la fuente. **Fase 0 (dato vivo) HECHA y verificada**: Edge Function **`lineup-ingest`** en
Supabase (sa-east-1 São Paulo, IP que ISA sí acepta) que fetchea+parsea (puerto fiel de `scraper.py`)+
upsertea idempotente, restringida a `service_role`; disparada por `scripts/ingest-lineup.mjs` +
`ingest-lineup.yml` (10:00 y 22:00 ART, una fecha por request); `lineup` sumado al healthcheck. **Backfill
07/07→16/07 aplicado** (2.853 filas; último snapshot 16/07 vs 06/07 antes). **Fase 1 (foto operativa) HECHA
y verificada**: página nueva **`/comercio/puertos`** (gateada `requireAdmin()`, protegida siempre — solo
mesa) con KPIs del último line-up, **qué cambió vs la rueda anterior** (buques nuevos con empresa
normalizada), tablas por producto y por zona (Up River N/S + Bahía), y tabla de buques filtrable + export
CSV. Lógica portada: `zona_carga` (por muelle), `shipper_norm` (~18 exportadores canónicos), `mesa_diff`
(buques nuevos ≥30kt). **Verificado 1:1 contra SQL** (rueda 16/07: 187 buques, 6.497.074 t) + navegador
claro/oscuro real. **Falta**: Fases 2-4 (empresas, mesa de embarque, temperatura) y que Lautaro mergee a
`main` para que el cron de Fase 0 arranque. Detalle:
[`sesiones/2026-07-18-puertos-fase-0.md`](sesiones/2026-07-18-puertos-fase-0.md).

## Anterior (17/07/2026 — Landing institucional)

**🏛️ LANDING INSTITUCIONAL (ítem 3 del backlog) HECHA — rama `claude/desarrollos-pendientes-dbq59w`, PR #32.**
`/bienvenida` dejó de ser la landing mínima de login y pasó a ser la **página de venta** de ROFO AGRO (enfoque de
venta, estilo [Praxis](https://praxis.chetech.com.ar/)). Se **movió fuera de `(auth)`** a `src/app/bienvenida/`
con layout propio (topbar + footer); la URL sigue siendo `/bienvenida`. Secciones: hero ("Dejá de tomar decisiones
a ciegas") → problema → cómo funciona (01·02·03) → servicios (6) → **vistazo al tablero** (mockups ilustrativos,
sin datos reales, chip "Vista previa") → por qué ROFO AGRO → **para acopios** (replicá el correacopio) → equipo (sin
nombres, "más de 10 años") → FAQ ("no reemplaza a tu corredor") → **formulario de contacto** (Resend a
`ADMIN_EMAILS`, honeypot, degrada sin key). Link "Conocé ROFO AGRO →" en el footer del dashboard. **Textos = borrador
que Lautaro edita.** Estilos `lp-*` nuevos, claro/oscuro. lint/tsc/build ✅; navegador claro+oscuro + formulario
end-to-end ✅. Detalle: [`sesiones/2026-07-17-landing-institucional.md`](sesiones/2026-07-17-landing-institucional.md).

**🎨 LOGO REAL INTEGRADO (ítem 2 del backlog) HECHO — rama `claude/desarrollos-pendientes-dbq59w`.** La marca
dejó de ser 100% tipográfica: Lautaro pasó el logo real (isotipo de 3 símbolos — trigo amarillo · trigo verde
con espiga dorada · gota de soja — + wordmark "ROFO AGRO" + "Consultora de agronegocios"). Se guardó como assets
en **`public/`** (`rofoagro-isotipo.svg` 34 KB · `rofoagro-logo.svg` completo). El **isotipo real** reemplaza el
glifo `WheatMark` en header, landing, auth, admin y footer; el wordmark sigue en **texto** (así se adapta al
tema claro/oscuro — el logo del cliente es un auto-trace con fondo blanco y verde oscuro que en el tema "rueda"
quedaba apagado). **Fondo transparente** (pedido de Lautaro) quitando la 1ª ruta del trazado. **Favicon nuevo**
(espiga simple, legible a 16px). Feedback de Lautaro atendido: se **limpiaron los halos de borde** que el
auto-trace mostraba en el tema oscuro (se quitaron las rutas de baja saturación). **Proxy** ajustado para no
redirigir los assets de marca cuando se prenda el login. lint/tsc/build ✅ (el entorno arrancó sin
`node_modules` → `npm install`); navegador claro/oscuro ✅.
Detalle: [`sesiones/2026-07-17-logo-real-integrado.md`](sesiones/2026-07-17-logo-real-integrado.md).

## Anterior (17/07/2026 — Login Etapa 3: hardening + encendido)

**🔐 LOGIN ETAPA 3 (sesión única · marca de agua · landing · listo para encender) HECHA — PR #_ (rama
`claude/login-stage-3-kqt0pg`).** Cierra el módulo de login (las 3 etapas). **Sesión única por usuario** (anti-préstamo):
el login en un 2º dispositivo desplaza al 1º, que al navegar cae en `/sesion-cerrada` ("tu cuenta se abrió en otro
dispositivo") — enforcement en el **proxy** (`tocar_sesion` por request, `session_id` del JWT decodificado local,
**signOut LOCAL** para no matar la sesión buena), evento `kickeado` en `access_log`, botón "Cerrar sesión" por usuario
en `/admin`. **Duración 7 días** renovables por `last_seen`. **Marca de agua** sutil (email en diagonal, `mask-image`
sobre `var(--ink)` → sigue el tema, opacidad .05/.06) sobre las páginas de datos. **Landing pública mínima**
`/bienvenida` (el proxy manda ahí al visitante sin sesión, solo con el flag prendido). **`/api/series` protegida** con
el flag prendido (401/403), pública e igual que hoy con el flag apagado. Migración nueva
`20260717120000_auth_sesion_unica.sql` (tabla `sesiones_activas` + 4 RPC, **aplicada** por `execute_sql`).
lint/tsc/build ✅; **backend por SQL** (kicked/expired/adopt/guard + RLS anon=0, cliente=solo la suya); **navegador con
el flag PRENDIDO** (anon key real + usuario de prueba aprobado, borrado al final): landing → login → tablero con marca
de agua (claro/oscuro) → sección permitida/`/sin-acceso`/`/api/series` 403 → **sesión única kickea al 1º**; y **flag
apagado = web idéntica a hoy** (`/` tablero, sin landing ni marca de agua, cache público intacto). **Falta solo el
encendido manual de Lautaro** (`AUTH_ENFORCED=true` + promover a Mauro + aprobar clientes — checklist en
[`GUIA_LOGIN_SETUP.md`](GUIA_LOGIN_SETUP.md)) y resolver **hosting** antes de clientes reales.
Detalle: [`sesiones/2026-07-17-login-etapa-3.md`](sesiones/2026-07-17-login-etapa-3.md).

**🔐 LOGIN ETAPA 2 (panel admin + permisos + emails) HECHA — PR #29 (rama `claude/login-stage-2-a8wr99`).** Sobre la
base de la Etapa 1: **panel `/admin`** (route propio, estética premium) con 4 pestañas — **Pendientes** (aprobar
eligiendo/creando empresa · rechazar · badge de conteo), **Usuarios** (bloquear · cambiar empresa · promover/degradar
admin · override individual de secciones), **Empresas** (crear/renombrar + checkboxes de las 7 secciones + conteo) y
**Actividad** (historial filtrable por usuario/empresa/fecha, paginado, con dispositivo/navegador/IP). **Enforcement
real de permisos por sección**: cada página llama `requireSeccion()` (NO-OP con el flag apagado → ISR intacto), la nav
y la home filtran por permisos, y `/sin-acceso` recibe a quien entra a una sección que no tiene. **`/admin` protegido
SIEMPRE** (aun con el flag apagado), así se puede aprobar clientes antes de encender. **Registro de visitas** por beacon
liviano (throttle 10 min en RPC, sin service key). **Emails Resend** (aviso a admins por registro + al cliente al aprobar,
degrada sin key). Migración nueva `20260716180000_auth_admin_panel.sql` (4 RPC de lectura + la de visitas).
**Las DOS migraciones de auth quedaron APLICADAS a la base** (Etapa 1 estaba pendiente; se aplicaron por `execute_sql`
del MCP). lint/tsc/build ✅; backend verificado end-to-end por SQL (RLS admin/cliente, aprobación, override, throttle,
**guard anti-escalada**); navegador (flag off) = web idéntica a hoy + `/admin`→307 a `/ingresar`.
**Falta (manual de Lautaro):** env vars en Vercel (`NEXT_PUBLIC_SUPABASE_*`, y para emails `RESEND_API_KEY`/`RESEND_FROM`/
`ADMIN_EMAILS`) + Google OAuth — todo en [`GUIA_LOGIN_SETUP.md`](GUIA_LOGIN_SETUP.md). **Sigue Etapa 3** (sesión única,
marca de agua, landing mínima, encendido de `AUTH_ENFORCED`) — prompt en `PLAN_LOGIN.md` §5.3.
Detalle: [`sesiones/2026-07-16-login-etapa-2.md`](sesiones/2026-07-16-login-etapa-2.md).

**🔐 LOGIN ETAPA 1 (base de auth) HECHA — PR #28 (rama `claude/pending-tasks-list-2m6y6u`).** Construida sobre
Supabase Auth + `@supabase/ssr`: capa `src/lib/auth/` (config/env/client/server/session/dal/log), migración
`20260716120000_create_auth_base.sql` (tablas `empresas`/`profiles`/`access_log` + `is_admin()` + trigger de alta
que siembra a `lautaroronchi97@gmail.com` como admin + RLS), pantallas premium en el route group `(auth)`
(`/ingresar` `/registro` `/pendiente` `/recuperar` `/completar` + callback OAuth + server actions), y el gate en
`src/proxy.ts` (¡en Next 16 el middleware se llama **proxy**!) detrás del flag **`AUTH_ENFORCED` (apagado)**.
**Clave: con el flag apagado la web queda igual que hoy.** (La migración de Etapa 1, que había quedado pendiente de
aplicar, se aplicó en la sesión de Etapa 2.) Detalle: [`sesiones/2026-07-16-login-etapa-1.md`](sesiones/2026-07-16-login-etapa-1.md).

**📋 PLAN DE LOGIN CERRADO (ítem 7 del backlog) — [`PLAN_LOGIN.md`](PLAN_LOGIN.md).** 15 decisiones cerradas con
Lautaro (registro autoservicio + aprobación manual · 1 sesión activa por usuario · permisos por sección a nivel
empresa + override · todo tras login con landing mínima · historial de logins/actividad · mail a admins por
registro · sesión 7 días · marca de agua sutil · feature flag `AUTH_ENFORCED` que entra APAGADO · Supabase Auth).
**3 etapas = 3 PRs** (Etapa 1 ✅). Hosting (Vercel Pro vs alternativas): sesión aparte ANTES de clientes reales.
Detalle del plan: [`sesiones/2026-07-16-plan-login.md`](sesiones/2026-07-16-plan-login.md).

**✅ Feed A3 por WebSocket (adiós 429) MERGEADO a `main` (PR #27).** El REST `marketdata/get` es de a un
símbolo y A3 lo rate-limitea (429) → dropeaba posiciones. `src/lib/a3-live.ts` ahora abre **una conexión WS**
y suscribe todo en un `smd`; verificado en rueda abierta 15/15 símbolos sin 429, coincide con el Excel de
Lautaro. Detalle: [`sesiones/2026-07-13-arbitrajes-en-vivo.md`](sesiones/2026-07-13-arbitrajes-en-vivo.md) (Follow-up 2).

**✅ Arbitrajes en vivo — 1ª columna + fix "no actualiza" MERGEADO a `main` (PR #26).** Fuera de rueda =
último ajuste; en rueda = último operado de A3, spread/tasa/TNA recalculados; header "Últ. operado" + punto
en vivo; refresh por poll cada 30s con rueda abierta (`refresh-on-focus.tsx` + `algunaRuedaAbierta`);
`/granos` a `revalidate=30`. (Pizarra no se tocó — cron, va aparte.)

---

## Plan ROFO AGRO (backlog priorizado por Lautaro, registrado 13/07/2026)

> ⚠️ **REEMPLAZADO POR EL BACKLOG MAESTRO (22/07/2026, auditoría E7).** Esta lista queda como
> **registro histórico** de los 21 ítems originales y su estado al cierre de la auditoría. La lista
> viva donde se prioriza y se tacha es **[`auditoria/E7-sintesis.md`](auditoria/E7-sintesis.md) §4**
> (integra lo vigente de acá: remanente del 5, 11-21, extras del 6, encendido del 7/10). Todo
> pendiente NUEVO va directo allá — esta sección no se vuelve a editar.

> Lista de tareas que Lautaro quiere hacer. **Las fechas/semanas son solo agrupación de orden, NO
> deadlines duros** — no hay que forzar nada por calendario. Cada sesión que arranque revisa esta lista,
> marca lo que se hizo (`[x]`) y anota en «Ahora» el detalle. Si una tarea ya tiene algo hecho o
> relacionado en el repo, se anota el link para no duplicar research.
>
> **Repaso 20/07/2026**: Lautaro trajo una nota vieja con pendientes sueltos. Cruzada contra esta lista:
> ya estaban cubiertos por los ítems 4, 5, 6 (con el fix de la pata C3 en el PR #40), 7/10, 8, 9, 16, 18,
> 19 y la sección "Pendiente del panel de gráficos (v2)" más abajo (tabla de datos en gráficos). Lo único
> nuevo fue el ítem 21 (resumen/interpretación de informes), agregado abajo.
>
> **Mapeo 21/07/2026**: TODOS los pendientes de esta lista (y los de CONTEXTO + gráficos v2) quedaron
> mapeados a un plan ejecutable en [`PLAN_BACKLOG.md`](PLAN_BACKLOG.md) (tabla de mapeo + prompts
> P1→P12; lo ya cubierto apunta a `PLAN_AUDITORIA.md` o `PLAN_INFORMES.md`).

**Bloque 1**
- [x] 1. **Verificación de bases de datos + resiliencia de ingestas — HECHO (13/07, PR #25).** Auditoría
  en vivo de las 10 tablas + 8 crons + 10 scripts. Hallazgo raíz: **"falso verde"** (0 filas → `upsert([])`
  no hace POST → run verde sin insertar) que dejó a **BCR-GEA congelado en feb-2026**. Arreglos: guard
  anti falso-verde en los 8 scripts (0 filas live = `exit 1`) + aislar pasos del workflow AR; cron de
  pizarra a **10:30/10:45/11:00 ART**; **healthcheck de frescura** diario (`healthcheck-frescura.mjs` +
  `healthcheck.yml`, rojo+mail si algo se atrasa); y **descongelado de GEA** por dispatch (live #196 julio
  + backfill Wayback mayo). Detalle: [`sesiones/2026-07-13-verificacion-bases-datos.md`](sesiones/2026-07-13-verificacion-bases-datos.md).
- [x] 2. **Logo real integrado — HECHO (17/07, rama `claude/desarrollos-pendientes-dbq59w`).** Assets en
  `public/` (`rofoagro-isotipo.svg` = 3 símbolos · `rofoagro-logo.svg` = logo completo). Header/landing/auth/
  admin/footer usan el isotipo real + wordmark en texto; favicon nuevo; fondo transparente; halos de borde
  del tema oscuro limpiados. Detalle: [`sesiones/2026-07-17-logo-real-integrado.md`](sesiones/2026-07-17-logo-real-integrado.md).
- [x] 3. **Landing institucional — HECHO (17/07, rama `claude/desarrollos-pendientes-dbq59w`, PR #32).**
  `/bienvenida` reconvertida en página de venta (hero → problema → cómo funciona → servicios →
  vistazo al tablero → por qué → acopios → equipo → FAQ → formulario). Enfoque de venta, estilo Praxis,
  mockups llamador (sin datos reales), formulario por Resend, link "Conocé ROFO AGRO" en el footer. Textos
  = borrador editable. Detalle: [`sesiones/2026-07-17-landing-institucional.md`](sesiones/2026-07-17-landing-institucional.md).
- [x] 4. **Home = novedades del día — HECHO (20/07, rama `claude/desarrollos-pendientes-unm9cg`).** `/` pasó
  a: **Novedades del día** (titular destacado + hasta 7) → **El mercado hoy** (Chicago en USD/tn, reusa
  `getMonitorMercados` del #42) + **Próximos informes** + **Última estimación** → grilla de secciones
  compacta al pie. Detalle: [`sesiones/2026-07-20-home-novedades.md`](sesiones/2026-07-20-home-novedades.md).
- [ ] 5. Extender el reporte diario: Matba (volumen) + CBOT + metales + petróleo + Merval + SPY + EWZ
  (hoy `cbot_cierres` ya tiene CBOT maíz/soja/trigo; falta sumar metales/petróleo/Merval/SPY/EWZ — ver
  fuentes candidatas `barchart`/`investing`/`yahoo-finance` en `CONTEXTO.md`). **Precios Chicago**: el
  dato ya está (`cbot_cierres`) y se usa en `/graficos` (preset "Chicago", A3 vs CBOT); falta sumarlo acá,
  al reporte diario/semanal. La **vista web en vivo** de Chicago + macro ya está HECHA (20/07, PR #42):
  Monitor de mercados en `/granos` (soja/aceite/harina/maíz/trigo en USD/tn + WTI/oro/plata/DXY/USD-BRL/SPY),
  [`PLAN_MONITOR_MERCADOS.md`](PLAN_MONITOR_MERCADOS.md). Lo que falta del ítem 5 es sumar estos datos al
  **reporte diario/semanal** (metales/petróleo/Merval/SPY/EWZ) — otra tarea.
- [~] 6. **Barcos / lineups en puerto — EN CURSO (plan + Fases 0, 1, 2 y 3 hechas).** Plan cerrado
  ([`PLAN_PUERTOS.md`](PLAN_PUERTOS.md), 11 decisiones + 5 fases, lógica portada de `LineUps_Code`).
  **Fase 0 (dato vivo) HECHA** (18/07): scraper reactivado vía Edge Function de Supabase, backfill,
  healthcheck. **Fase 1 (foto operativa) HECHA** (18/07): `/comercio/puertos` con KPIs, tape de cambios,
  tablas por producto/zona y buques. **Fase 2 (empresas + semáforo) HECHA** (19/07): `/comercio/empresas`
  (gap de cobertura + señales + avance + ritmo estacional + campaña nueva/vieja + share) y
  `/comercio/senal` (semáforo físico→precio); verificado 1:1 contra SQL. **Fase 3 (mesa de embarque)
  HECHA** (19/07): `/comercio/embarques` (programa DJVE por mes × producto en idioma A3), sobre el
  research verificado de DJVE (`negocio/05`) + backfill 2011-2025 de la tabla `djve`. **Fase 4
  (temperatura · índice MESA) HECHA** (19/07): `/comercio/temperatura` (semáforo por producto, índice
  0-100 por percentil estacional de las 2 patas de demanda + momentum → acción; portado 1:1 de
  `LineUps_Code`). El scraper de `compras` se reactivó (nueva fuente MAGyP); la pata de farmer selling
  degrada hasta que junte historia (backfill Wayback pendiente). Detalle:
  `sesiones/2026-07-19-comercio-temperatura-fase-4.md`.

**Bloque 2**
- [~] 7. Login (cliente / Lautaro / Mauro) — roles distintos, hoy la web es 100% pública/anónima.
  **Plan cerrado 16/07 → [`PLAN_LOGIN.md`](PLAN_LOGIN.md)** (15 decisiones + 3 prompts de ejecución).
  **Las 3 etapas HECHAS en código:** Etapa 1 (base de auth, PR #28), Etapa 2 (panel admin + permisos + emails,
  PR #29) y **Etapa 3** (sesión única + marca de agua + landing + hardening, rama `claude/login-stage-3-kqt0pg`).
  El flag `AUTH_ENFORCED` **sigue apagado**: falta solo el **encendido manual de Lautaro** (checklist en
  `GUIA_LOGIN_SETUP.md`) y resolver hosting. Se marca `[x]` cuando prenda y valide.
- [x] 8. **Total negociado por producto — HECHO (20/07)** junto con el 9: página `/comercio/negociado`
  (volumen semanal por producto, Δ, histograma, % sobre cosecha, % priceado, saldo a fijar). El dato de
  SIO Granos es semanal (no hay corte diario). Detalle:
  [`sesiones/2026-07-20-negociado-siogranos-uploader.md`](sesiones/2026-07-20-negociado-siogranos-uploader.md).
- [x] 9. **SIOGRANOS semanal/mensual — HECHO (20/07)**, converge con el ítem 8: mismo panel, histograma
  con toggle Semanal/Mensual + uploader admin `/admin/datos` para actualizar la serie (export Agrochat
  CSV/xlsx). Detalle: [`sesiones/2026-07-20-negociado-siogranos-uploader.md`](sesiones/2026-07-20-negociado-siogranos-uploader.md).

**Bloque 3**
- [~] 10. Terminar login (si sigue abierto del bloque 2). **Código de las 3 etapas HECHO** (ver ítem 7);
  queda el encendido manual (`AUTH_ENFORCED=true`) + hosting. Se marca `[x]` cuando Lautaro prenda y valide.
- [~] 11. Automatizar informe diario/semanal — **PLAN CERRADO (21/07)** en
  [`PLAN_INFORMES.md`](PLAN_INFORMES.md) (MP1 placa PNG diaria + MP2 PDF semanal, con prompts listos;
  decisiones: Routines de Claude como worker, prosa `voz-lautaro`, color de la rueda por /admin,
  entrega mail + `/informes`). Falta ejecutar MP1 y MP2.
- [ ] 12. Acumulado de rueda USD + compras BCRA (compras netas BCRA hoy es proxy/manual, ver módulo 7
  "Panel cambiario" en `CONTEXTO.md`).
- [ ] 13. Variación semanal del USD (gráfico).
- [ ] 14. Movimiento de camiones en puerto (fuente a confirmar, probablemente BCR).
- [ ] 15. Comercio exterior (incluye tablas DJVE) — solo si sobra tiempo. Ya existe `djve`/`djve_resumen`
  en Supabase y el sitemap del rediseño UX ya reservó la sección "Comercio exterior"; falta el contenido.

**Bloque 4 (post-Bloque 3)**
- [ ] 16. Cron/automatizaciones — revisión integral (todos los workflows de GitHub Actions: cierres,
  USDA/CONAB/estimaciones AR, noticias, calendario).
- [ ] 17. Comercio exterior (si no cerró antes, ver ítem 15).
- [ ] 18. Vista por grano (hoy los paneles son transversales a los 3 granos; falta una vista filtrada
  por un solo grano).
- [ ] 19. Mejora front-end general · revisión de calculadoras · pegar `ESTADO.md`/`CONTEXTO.md` (mantener
  la documentación de sesiones al día).
- [ ] 20. Skill de escritura · skill de informes (herramientas internas de generación de contenido).
- [ ] 21. **Resumen/interpretación de informes** (nuevo, anotado 20/07): lectura automática de los
  informes que ya se ingestan (WASDE/PSD, CONAB, BCR-GEA, DEA-SAGyP, DJVE) para armar un resumen en
  lenguaje llano de "qué cambió y qué implica" — hoy `/produccion` y `/comercio` muestran los datos crudos
  + tarjetas de cambios numéricas, pero no una interpretación redactada. Podría apoyarse en la skill
  `voz-lautaro` para el tono. **PLAN CERRADO (21/07): es el MP4 de
  [`PLAN_INFORMES.md`](PLAN_INFORMES.md)** (alcance decidido: por informe individual, borrador → OK
  de Lautaro en /admin → publica en /produccion). Falta ejecutarlo (requiere MP1 antes).

---

**Contexto previo (12/07/2026 — Rediseño UX «web en capas» MERGEADO · Sesión C estimaciones Argentina):**

**✅ REDISEÑO UX «WEB EN CAPAS» MERGEADO a `main` (PR #22).** [`docs/PLAN_UX_NAVEGACION.md`](PLAN_UX_NAVEGACION.md): se dejó la tira vertical larga y se pasó a
**sitio por páginas (hub)** — portada tablero → clickeás un tópico y entrás a esa sección con link propio.
Decisiones de Lautaro: multipágina (no acordeón/pestañas de esqueleto) · **sin** vista trader "tira" (todos
por secciones) · calculadoras con **link propio** por calc · Noticias sección propia + titulares en Inicio ·
DJVE → sección propia "Comercio exterior" · fuentes **"institución sí, puente no"** (mostrar el organismo/
mercado de origen, ocultar el proveedor técnico; nunca "vía") · explicaciones "¿Qué es esto?" por calc/reporte.
Sitemap: Inicio · Granos · Dólar y tasas · Comercio exterior · Calculadoras · Gráficos · Producción · Noticias,
con layout compartido `(site)/layout.tsx`. **Fase 0 hecha** (layout compartido: route group `src/app/(site)/`,
nav a client component `usePathname`, URLs intactas). **Fase 1 (estructural) hecha** (sellos = `[origen] ·
Actualizado HH:MM` con nombre propio de institución — Matba Rofex, Bolsa de Comercio de Rosario, MAE, Mercado
de deuda local, SAGyP, USDA·CONAB; pie sin chips técnicos; cinta "prov."; marca `.st-prov`). Todo con
build/lint/tsc ✅. **Falta de Fase 1:** las notas al pie de los paneles aún nombran puentes → se limpian en la
**Fase 5** (capa explicativa). **Fase 2 hecha** (páginas por grupo aditivas `/granos /dolar /comercio
/calculadoras /noticias`; nav a los 7 destinos reales, activo por `pathname`; logo → Inicio). **Fase 3 hecha**
(la home dejó de ser la tira: ahora es el tablero = cinta + "Lo importante hoy" con titulares del día + grilla
de 7 tarjetas por sección; se sacaron los paneles de la home → fin de la duplicación). **Fase 4 hecha**
(calculadoras con link propio: `src/lib/calculadoras.ts` + `/calculadoras` índice de tarjetas + ruta dinámica
`/calculadoras/[slug]` con las 9 en SSG, slug inválido → 404). **Fase 5 hecha** (capa explicativa: componente
`que-es-esto.tsx` desplegable "¿Qué es esto?" en las 9 calcs + todos los reportes, reemplazando las notas al
pie; **se sacaron TODOS los puentes** que quedaban → barrido del HTML servido limpio; cierra el pendiente de la
Fase 1). **Fase 6 hecha** (migas de pan `Inicio › Sección › Subpágina` en el layout, `breadcrumbs.tsx`; nav
mobile scrollea horizontal; `noindex` se mantiene por datos provisorios). **✅ PLAN UX COMPLETO (Fases 0→6),
MERGEADO a `main` (PR #22).** Todo con build/lint/tsc ✅.
Detalle: [`sesiones/2026-07-12-plan-ux-navegacion.md`](sesiones/2026-07-12-plan-ux-navegacion.md).

**✅ SWITCH COMPLETO. Producción (Vercel) sirve `main`** con el rediseño premium + todos los paneles
de datos reales. Default de GitHub = `main` · Vercel Branch Tracking = `main`.

**Hecho esta sesión (rama `claude/session-c-local-production-pvqf6f`, PR #23 MERGEADO a `main`) — Sesión C: estimaciones Argentina:**
- **Ingestas + workflow**: `scripts/ingest-gea.mjs` (BCR-GEA: tablas `bcr-estimaciones` de soja/maíz/trigo +
  fecha/PDF del informe; **backfill Wayback** 2020→hoy por CDX), `scripts/ingest-dea.mjs` (DEA-SAGyP: POST del CSV
  oficial → nacional por cultivo/campaña de los 6 granos, snapshot semanal = vintage), `scripts/ingest-pas.mjs`
  (BCBA-PAS **probe-first, pendiente de validar desde Actions** — el dominio está tras Cloudflare; no inserta datos
  sin verificar ni scrapea noticias). Workflow único `ingest-estimaciones-ar.yml` (GEA mié + DEA vie + dispatch).
- **Comparador AR real**: la lib/UI ya eran genéricas → con GEA + DEA + USDA la pizarra muestra BCR vs SAGyP vs USDA
  lado a lado ("quién está más alcista"), el gráfico de evolución (BCR vs USDA por campaña) y las tarjetas de cambios.
  Dos fixes: `campaniaVigente` prefiere la última campaña **con producción** (BCR-trigo 29,5 de 2025/26, no "—" de
  2026/27); y la tarjeta de "Cambios" ahora usa el organismo real (antes mostraba "USDA" en la tarjeta de SAGyP).
- **Verificado**: lint/tsc/build ✅; parsers y lógica contra datos reales (GEA soja 51,5 / maíz 68 / trigo 29,5 Mt;
  backfill feb-2026 soja 48,0 = coincide con el plan; DEA soja 22/23 25,0 Mt = la sequía, soja 24/25 51,1 Mt); UI en
  navegador claro/oscuro (comparador AR de 3 vías, screenshots).
- **✅ SUPABASE POBLADO (12/07, post-merge)**: se corrieron los `workflow_dispatch` y **terminaron en verde** —
  *Ingesta estimaciones Argentina* (`backfill_gea` + `dea_since=2019` + `pas_probe`), *Ingesta USDA* (backfill 2020→
  + PSD) e *Ingesta CONAB* (full). Como cada script sale con error si el upsert falla, el `success` confirma que los
  datos entraron. Los crons ahora mantienen solo. **OJO ISR**: `/produccion` es estática con `revalidate=3600` →
  la pizarra real aparece en la próxima regeneración (~1 h) o con cualquier redeploy en Vercel.
- **⚠️ PAS (BCBA) — validar**: el `pas_probe` corrió dentro del run de Argentina; **falta leer el log** (Actions →
  *Ingesta estimaciones Argentina* → paso "PAS (BCBA)") para ver si la IP de Actions pasó el Cloudflare. Si pasó,
  endurecer el parser de `ingest-pas.mjs` con el HTML real y activarlo en el schedule; si no, respaldo por mail.
  El comparador AR ya es sólido con BCR + SAGyP + USDA. Detalle: [`sesiones/2026-07-12-estimaciones-argentina.md`](sesiones/2026-07-12-estimaciones-argentina.md).
- **✅ Módulo Calendario + estimaciones COMPLETO (A+B+C) y poblado**: solo resta validar el PAS (arriba).

**Hecho antes (rama `claude/session-b-pr20-wwijnz`, PR #21 mergeado) — Sesión B: ingestas USDA + CONAB:**
- **Ingestas + workflows**: `scripts/ingest-usda.mjs` (WASDE = producción por país incl. mundo + vintages;
  PSD bulk = área/rinde de los 6 granos + producción de girasol/sorgo/cebada — ZIP descomprimido sin
  dependencias), `scripts/ingest-conab.mjs` (`LevantamentoGraos.txt`, 27 UF → nacional Brasil, milho = 3
  safras, vintages 2017/18→hoy, fecha derivada por cadencia), `scripts/refresh-calendario.mjs` (centinela
  mensual del seed del año siguiente). Workflows `ingest-usda.yml` / `ingest-conab.yml` / `refresh-calendario.yml`.
- **UI de `/produccion`**: reemplazado el bloque "En construcción" por la **pizarra de estimaciones** (última
  por organismo/país/grano + Δ vs anterior, filtrable), el **gráfico de evolución** (SVG multi-serie, USDA vs
  CONAB) y las **tarjetas de cambios** del último informe (`estimaciones-panel/cliente.tsx`, `evolucion-chart.tsx`,
  `src/lib/estimaciones.ts`). **Home**: mini-tabla "Última estimación" (USDA, `estimaciones-mini.tsx`).
- **Verificado**: lint/tsc/build ✅; parsers y lógica contra datos reales (soja AR 48→50 Mt, soja BR CONAB
  177,6→180,25 Mt, maíz EEUU 406,4 Mt en Mt — no bushels); UI en navegador claro/oscuro (screenshots).
- **⚠️ FALTA POBLAR Supabase**: el MCP de este entorno no resolvió la aprobación de escritura. **Tras el merge,
  correr los `workflow_dispatch`**: *Ingesta USDA* backfill (from 2020-01) + snapshot_psd=true, e *Ingesta CONAB*
  full=true → después el cron mantiene solo. Hasta entonces la UI muestra el roadmap (degrada solo).
  Detalle: [`sesiones/2026-07-12-estimaciones-usda-conab.md`](sesiones/2026-07-12-estimaciones-usda-conab.md).
- **Sesión C (Argentina) HECHA** (arriba) — solo resta poblar Supabase por dispatch + validar el PAS desde Actions.

**Hecho antes (PR #20) — módulo Calendario de informes + estimaciones de producción:**
- **[`PLAN_CALENDARIO_PRODUCCION.md`](PLAN_CALENDARIO_PRODUCCION.md)**: investigación verificada con
  requests reales del núcleo v1 (USDA WASDE/PSD/NASS, CONAB, BCR-GEA, BCBA-PAS, DEA-SAGyP): qué publica
  cada uno, calendarios oficiales 2026, endpoints de datos e histórico/vintages desde 2020. FAO-AMIS tiene
  un proxy BigQuery abierto con vintages 2020→hoy de FAO+IGC+USDA (tier-2, candidato barato a sesión B).
  Un 2º pase de verificadores re-testeó los ~50 endpoints: todo se sostiene (ESMIS 0-indexed, ICS NASS
  sin TZID, Wayback OK para backfill GEA — en §8 del plan).
- **✅ SESIÓN A del build hecha**: tablas `calendario_informes` + `estimaciones_produccion`
  (migración `20260712020000`), motor `src/lib/calendario.ts` (seed oficial 2026 + reglas + hora DST-aware),
  panel "Próximos informes" en la home y **página nueva `/produccion`** con el calendario cronológico
  filtrable + sección de estimaciones "en construcción". Verificado con navegador (claro/oscuro) + build.
- **Sigue: Sesión B (USDA+CONAB) y C (Argentina)** — ingestas + vintages + pizarra de estimaciones +
  gráficos. El `refresh-calendario.yml` va con la B (en v1 el calendario rinde solo desde código).

**✅ LAS 3 BASES DE GRÁFICOS ESTÁN COMPLETAS (verificado por SQL el 11/07):** PR #10 mergeado
(merge #14) y **backfill CBOT ya corrido** — `futuros_cierres` 31.049 filas (2020-01-02→08/07,
feriado 9/7 de por medio) · `cbot_cierres` **28.915 filas, 129 contratos** (→09/07) ·
`pizarra_historico` 7.893 filas (→07/07). Los 3 crons corren solos. Ya no queda nada pendiente de
[`PLAN_BASES_GRAFICOS.md`](PLAN_BASES_GRAFICOS.md).

**✅ PANEL DE GRÁFICOS DE SPREADS COMPLETO Y EN PRODUCCIÓN (PR #17 mergeado, merge `55c68c0`)**
([`PLAN_GRAFICOS_SPREADS.md`](PLAN_GRAFICOS_SPREADS.md)) — página `/graficos` con dos modos:
- **Modo Campañas** (superponer años alineados al vto): motor de 2 patas (A3/CBOT/pizarra) × métrica
  (spread/ratio/crudas) · presets **15 calendar spreads** por grano (con salto de campaña) + **entre
  productos** + **Chicago** (A3 vs CBOT, mapeo empírico por correlación) · **banda histórica**
  min–máx+mediana · **percentil** hoy vs historia · **mes** en el eje días-al-vto.
- **Modo Período** (base vs varias posiciones sobre un año, eje calendario): base pizarra/posición,
  todas las posiciones que cotizan (las 2 cosechas) + filtro, presets de pizarra, cada línea hasta
  su vto.
- **Fase 0 (fixes):** guard del truncado 206 + `sbSelectAll` paginado (`supabase.ts`) · flag
  estimativo en `pizarra.ts` → el panel Arbitrajes marca "estimativa".
- **Arquitectura:** vista `series_catalogo` (351 series), `series.ts`/`derivadas.ts`,
  `/api/series` + `/api/series/catalogo`, Recharts 3.9.2, estado del modo Campañas en la URL.
- **Validado contra el Excel** (Playwright, claro/oscuro): spread 2021-04-05 = 125,6; ratio U7 =
  0,5796. Mapeo CBOT confirmado por SQL (ej. maíz ABR↔CBOT MAY, soja NOV↔CBOT JUL). CI verde.
  Decisiones (30 preguntas) e historia en `docs/sesiones/2026-07-11-plan-graficos-spreads.md`.

**Pendiente del panel de gráficos (v2, no bloquea nada):** persistir el modo Período en la URL ·
ratio/base en % · guardar presets del usuario (requiere login) · export PNG/CSV · media móvil ·
volumen/OI (tabla alternativa → **HECHO** 20/07, ver arriba) · P12/P17 (esperan ejemplos de Lautaro) ·
import de campañas 2018/19. Mapeado completo con prompt de ejecución en **P6 de
[`PLAN_BACKLOG.md`](PLAN_BACKLOG.md)** (retirado de acá el 21/07 por la auditoría E6, para no
mantener dos copias — ver [`auditoria/E6-historia.md`](auditoria/E6-historia.md)).

**Recién entrado a `main` de otras sesiones (contexto + pendientes de Lautaro):**
- **Calculadora "Negocios de planta" (PR #18, mergeada):** `src/components/calc-planta.tsx` en
  Calculadoras — arranca de un precio (pizarra CAC editable) y descuenta 6 rubros (contra flete,
  secada, merma volátil, paritaria, embolsado, otros) → Precio final + Total de gastos.
  Detalle: `docs/sesiones/2026-07-11-calc-negocios-planta.md`.
- **Portal de noticias (PR #12):** panel Noticias rediseñado (categorización propia por 6 temas, chips,
  15 fuentes) + cron horario `ingest-noticias.yml` → tabla `noticias`. Pendiente: 1ª carga a mano
  (Actions → *Ingesta noticias* → Run workflow); el cron arranca solo al estar en `main`.
  Detalle: `docs/sesiones/2026-07-10-portal-noticias.md`.
- **Feed A3 en vivo (PR #11):** Pases suma Comprador/Vendedor/Último/Vol del pase real y Arbitrajes suma
  Comprador/Vendedor del futuro (frescura ~60s por ISR, degrada solo sin creds). Pendiente: validar con
  datos reales en horario de rueda (10:30–17:00) tildando el scope Preview/Production en las 3 vars A3 de
  Vercel. Detalle: `docs/sesiones/2026-07-09-feed-a3-en-vivo.md`.

**Ramas vivas y su veredicto:** ⚠️ tabla **congelada al 12/07/2026** (ninguna de estas ramas existe ya
— se limpiaron sin volver a este apunte). Para las ramas remotas vivas de HOY y los comandos de
limpieza, ver [`auditoria/E6-historia.md`](auditoria/E6-historia.md) § «Higiene de ramas remotas»
(auditoría del 21/07).

**Lo próximo (en orden — detalle en CONTEXTO «Pendientes»):**
0. **Gráficos de spreads — v2** (panel ya en producción): persistir el modo Período en la URL ·
   ratio/base en % · export PNG/CSV · media móvil · volumen/OI · presets del usuario (login) ·
   P12 (relaciones %) y P17 (serie continua) con ejemplos de Lautaro · import 2018/19. Lista
   completa arriba en «Ahora».
1. **Módulo Calendario + estimaciones — COMPLETO y poblado** (A+B+C + dispatches corridos en verde). Solo resta:
   **validar el PAS (BCBA)** — leer el log del `pas_probe` (Actions → *Ingesta estimaciones Argentina* → paso "PAS
   (BCBA)"); si la IP de Actions pasó el Cloudflare, endurecer el parser de `ingest-pas.mjs` con el HTML real y
   activarlo en el schedule; si no, respaldo por mail. Opcional: backfill histórico DEA por PDFs mensuales (`?mes=`)
   y el candidato tier-2 `ingest-amis.mjs` (proxy BigQuery de FAO-AMIS, vintages de 3 organismos).
2. **Fase 2 del Feed A3 — histórico intradiario**: cron GH Actions `*/15 13-20 * * 1-5` UTC +
   `scripts/ingest-rueda.mjs` + tabla `snapshots` + `ingest_log` (INFRAESTRUCTURA.md). Habilita gráficos
   intradía. (La frescura ya está resuelta web-directa; esto es SOLO para guardar historia.)
3. Sintéticos TIR (pago final por letra, IAMC). [Requiere tabla de Lautaro]
4. Fase B (resiliencia, tests, mobile) y backlog de datos (reactivar scrapers `lineup`/`compras`,
   lineups, calendario, reporte WhatsApp — lista completa en CONTEXTO «Pendientes» punto 5).
