# Sesión 2026-07-28 — V1/V2 de PLAN_INFORMES_V2 (C19/C20)

- **Rama:** `claude/plan-desarrollo-auditoria-mkdvam` · **PR:** #89 (base `main`, mergeado)
- **Objetivo pedido por Lautaro:** repasar el backlog pendiente → seguir con C19-C22 (fases
  V1→V4 del plan de informes v2, `docs/PLAN_INFORMES_V2.md` §9).

## Hecho

**Antes de arrancar, verificación puntual de un bug reportado**: Lautaro probó el historial
editable de "Datos del día" (A6) y una edición del 24/07 se guardó sin bloquear. Confirmado
por SQL que NO es un bug: `informes_generados` solo tiene una fila real (2026-07-27, la única
corrida exitosa post-fix de C18) — el 24/07 nunca tuvo un informe real que lo tomara, así que
el guard correctamente lo deja editable. Pendiente real: probar el candado con un caso real
(cargar el color de hoy y confirmar mañana que bloquea).

Dos pendientes menores de V0 cerrados en el camino:
- **Key de USDA FAS** (`USDA_FAS_API_KEY`): Lautaro la registró y la cargó como env var del
  entorno de Claude Code (no hay tool para hacerlo desde la sesión).
- **Subagentes en Routine headless**: confirmado por config (no por log) — el `job_config` de
  una Routine de prueba y de las Routines de producción existentes declara `"Task"` en
  `session_context.allowed_tools`. El fan-out paralelo de V1 es viable.

**V1 — view-mercado v2 (C19)**: la skill pasa de un prompt lineal a un pipeline F0→F6
(invalidadores mecánicos → fan-out de 4 agentes → view blind-first → reconciliación
CONFIRMA/AJUSTA/SWITCH/CUMPLIDA con "recorrido de la tesis" → abogado del diablo →
verificación de pasaportes → salida). `getSenalCamiones()` sumado a los insumos (`/api/views/
insumos`) — fix de auditoría del propio plan ("quién pone el precio"). `src/lib/views-
scorecard.ts` (lib pura, 17 tests): hit-rate 1/2/4 semanas + Brier contra `futuros_cierres`,
con la posición fijada UNA VEZ en t0 (nunca re-elegida — evita que un rolleo de contrato
contamine la medición). Migración `20260728120000` (relacion_previa, view_previo_id,
invalidadores, evidencia_externa, nota_lautaro en `views_mercado`; `admin_feedback_view`
extendida con `p_nota`, dropeando la firma vieja de 2 argumentos para no dejar overloads
ambiguos). UI de `/granos/view`: badges de relación con la tesis previa, fila de scorecard,
invalidadores 🟢/🔴, selector de nota 1-5.

**V2 — interpretaciones v2 (C20)**: verificado con un fetch real (28/07) que un artículo
pre/post-WASDE completo de DTN muestra la tabla de expectativas (Avg/High/Low) sin paywall
— queda como fuente primaria, sin necesitar Pro Farmer. Paso 9 de `informe-diario`
reescrito: para USDA, research acotado (≤10 tool calls) arma la estructura qué se esperaba →
qué salió → sorpresa → reacción del precio → qué implica, con pasaporte verificado guardado
en `evidencia_externa` (columna nueva en `interpretaciones`, migración `20260728130000`).
GEA/DEA/CONAB/PAS degradan a "consenso implícito" (sin encuesta pública). Fix crítico: el
disparo del Paso 9 filtraba solo por `fecha_publicacion === hoy`, que nunca matcheaba el día
real en que Lautaro sube el BCBA-PAS (fecha real del informe, de días atrás) — ahora
`construirCambios` expone `actualizadoEn` y el filtro dispara con cualquiera de las dos
fechas.

**Cambios de modelo pedidos por Lautaro en el camino**: `view-mercado` quedó en
`effort: high` (probó `medium`, lo volvió a `high`); `informe-diario` quedó en
`effort: medium` (antes `high`); `informe-semanal` sin tocar (`high`).

## Decisiones tomadas (y por qué)

- Modelo de las 2 skills pinneado en el frontmatter (no solo en el selector de la Routine) —
  mismo mecanismo que ya usaban `informe-diario`/`informe-semanal`, decisión explícita de
  Lautaro ("muy importante dejar en la skill seleccionado el modelo").
- Invalidadores en la UI de `/granos/view`: solo 🟢 vigente / 🔴 disparado. Se descartó
  fabricar un tercer estado 🟡 "cerca" (lo que pedía el plan) porque `condicion`/`dato_ref`
  son texto libre que escribe el research — no hay un umbral machine-checkable en el
  frontend sin inventar un parser de lenguaje natural, y eso viola "ni un número inventado".
  Documentado en el código como limitación explícita, no como bug.
- Banda de "acierto" para views NEUTRAL en el scorecard: |retorno| ≤ 1%, umbral provisorio
  documentado en el código, a calibrar con Lautaro contra los primeros scorecards reales (el
  plan no especificaba un número).
- Mapeo confianza→probabilidad para Brier: lineal 1→0,55 … 5→0,95 (documentado en el código,
  mismo criterio: no hay un mapeo de negocio definido, se deja explícito y fácil de ajustar).

## Verificado

- lint/tsc/vitest (224/224, 19 tests nuevos) ✅ en cada paso.
- `npx next build --webpack` ✅ (46 páginas; Turbopack no disponible en este sandbox por
  bindings nativos faltantes — no es una regresión de código, ver Trampas).
- V1: scorecard cotejado contra datos reales de Supabase (view de soja del 21/07, fija JUL26
  en t0, la ventana de 7 días degrada correctamente a "sin dato aún" porque el cierre de hoy
  todavía no había cargado al momento de la verificación).
- V2: regenerada en seco la interpretación del WASDE #673 (10/07) con el formato nuevo,
  comparada contra la publicada (mismos números duros, capa de expectativa nueva donde DTN
  la tiene — soja EEUU, coincide con nuestro dato real ≈121,8 Mt — y degradación honesta
  donde no — maíz mundial/Argentina, sin encuesta pública de DTN para esos países). No se
  guardó en la base (no pisa la publicada).
- Migraciones aplicadas por MCP con OK de Lautaro + verificadas por SQL (columnas, una sola
  firma de `admin_feedback_view`) + `get_advisors` sin hallazgos nuevos (mismo patrón
  `is_admin()` interno ya aceptado en el resto de las RPC `admin_*`).
- PR #89 con CI verde (GitHub Actions + Vercel), mergeado a `main`.

## Quedó pendiente / en vuelo

- **V3 (informe semanal)** y **V4 (diario, retoque + medición)** — prompts ya escritos en
  `PLAN_INFORMES_V2.md` §9. V3 depende de que V1 esté mergeado (ya lo está).
- Confirmar en la primera corrida real de cada Routine (viernes para el view/semanal) el
  consumo/duración del pipeline nuevo — línea de base para R5 del plan.
- El candado de "Datos del día" (A6) sigue sin un caso real confirmado end-to-end.

## Trampas descubiertas (para la próxima sesión)

- El sandbox de esta sesión no tenía los bindings nativos de Turbopack
  (`@next/swc-linux-x64-gnu`) — `npm run build` (que usa Turbopack por default en Next 16)
  falla con "Turbopack is not supported on this platform". Workaround: `npx next build
  --webpack`. No es un problema de código; CI real (GitHub Actions) sí tiene los bindings y
  pasó verde.
- `admin_feedback_view(uuid, text)` y `admin_feedback_view(uuid, text, smallint)` son
  overloads DISTINTOS para Postgres — `create or replace` con la firma nueva NO pisa la
  vieja. Hay que `drop function if exists` con la firma vieja explícita antes de crear la
  nueva con parámetro default, si no quedan las dos coexistiendo (PostgREST puede ambiguar
  la llamada de 2 argumentos).
- Las Routines headless SÍ tienen el tool `Task` disponible (confirmado por
  `session_context.allowed_tools` de la config de la Routine) — no hace falta re-verificarlo
  para V1.
