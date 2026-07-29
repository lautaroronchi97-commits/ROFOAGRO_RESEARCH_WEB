# Auditoría E7 — Síntesis y backlog maestro (2026-07-22)

- **Rama:** `claude/auditoria-e7-sintesis-a919cq` · **PR:** #61 (base `main`, draft hasta el OK)
- **Alcance:** etapa final de la auditoría integral ([`PLAN_AUDITORIA.md`](../PLAN_AUDITORIA.md)):
  fusionar los 6 informes E1–E6, deduplicar los hallazgos que aparecieron en más de una etapa
  arrastrando la decisión de Lautaro de cada uno, armar la matriz impacto × esfuerzo de lo
  aprobado-y-pendiente, y dejar el **backlog maestro único** (reemplaza las 3 listas paralelas,
  como propuso E6) + un prompt autocontenido por cada lote grande. **Esta etapa NO descubre
  hallazgos nuevos** — consolida.
- **Cómo se verificó:** lectura completa de los 6 informes (`E1-datos` · `E2-formulas` [+ fichas] ·
  `E3-ux` · `E4-codigo` · `E5-infra` · `E6-historia`), `PLAN_AUDITORIA.md`, `PLAN_BACKLOG.md`,
  `PLAN_INFORMES.md` (tablero), `GUIA_LOGIN_SETUP.md` (guía definitiva 22/07), `ESTADO.md` y
  `CONTEXTO.md`, cruzando cada «diferido a E7» / «Para E7» / decisión de Lautaro contra el estado
  real al 22/07/2026 (post PR #58/#59/#60). Cero código tocado: solo consolidación y documentación.

---

## Resumen ejecutivo de TODA la auditoría (léase de una sentada)

**Qué se hizo.** Entre el 21 y el 22/07/2026 se auditó el proyecto completo en 6 etapas, cada una
con su informe, tu decisión hallazgo por hallazgo, y su fase de corrección mergeada a `main`:
**E1 datos** (PR #50) · **E2 fórmulas** (PR #51) · **E3 UX** (PR #57) · **E4 código** (PR #55) ·
**E5 infraestructura** (PRs #58 + #59) · **E6 historia** (PR #56). En total: **~71 hallazgos con
evidencia verificable** (archivo:línea, SQL corrido, requests reales, screenshots, logs de Actions)
y **~30 preguntas de criterio** — todas con decisión tuya registrada. Cero hallazgos especulativos.

**La foto grande: el proyecto está sano donde más importa.**
- **Los datos guardados son correctos y fieles a la fuente** (E1): cotejo 1:1 exacto contra CEM,
  CAC, Barchart y MAGyP; matviews frescas; sin outliers vigentes.
- **Cero bugs de fórmula en 45 fichas** (E2): la metodología INTRATE act/365 del Excel está 1:1 en
  todas las libs, guards completos, controles históricos reproducidos exactos.
- **El sitio está muy bien en lo grueso** (E3): navegación coherente, temas parejos, degradaciones
  prolijas, el flujo de decisión de mesa se lee de un vistazo.
- **El código está en buen estado general** (E4): cero deps sin uso, degradación uniforme, cero N+1,
  `server-only` bien aplicado.
- **Cero secretos en 139 commits** (E5) y **53/54 PRs mergeados limpios con protocolo disciplinado** (E6).

**Lo que estaba mal y ya se corrigió** (todo mergeado, verificado en cada fase 2):
1. **Dos páginas de mesa caídas** por vistas sin materializar que tiraban timeout/500 bajo
   concurrencia (`djve_cobertura`, `djve_embarques_mes`, `lineup_estacional`) → las 3 materializadas.
2. **El refresh de matviews moría en silencio** (`statement_timeout=8s` de PostgREST vs una RPC que
   creció a 6 matviews; `ingest-lineup` rojo 6/6) → timeout por-función a 300s, cron verde.
3. **Falso-verde sistémico**: 22 caminos mapeados donde una ingesta parcialmente rota quedaba verde
   → guards por componente en GEA/pizarra/CBOT/cierres/noticias/USDA + alertas Resend en 6 workflows
   críticos + healthcheck ampliado a 17 checks (incl. matviews, vencimientos, seeds con vencimiento).
4. **La limpieza de E1 borró sin saberlo la semana real del 15/07 de `compras`** (`DELETE` por
   etiqueta sin filtro de fecha) → se auto-reparó con el cron del 23/07; el parser ahora descarta el
   grupo de paneles viejo de MAGyP y el upsert es `ignore-duplicates` (Agrochat manda). Lección de
   protocolo: DELETE de limpieza siempre con la clave completa observada.
5. **Espejos lib↔script que ya habían roto producción** (el fix ÷1000 de compras hubo que aplicarlo
   a mano en dos lados) → los scripts ahora **importan** las libs reales; +91 tests Vitest en CI con
   los fixtures exactos de E2 congelando tus fórmulas contra regresiones.
6. **~235 KB del SDK de Supabase viajaban al cliente en todas las páginas públicas** → `AuthMenu`
   lazy: `/comercio` 783→526 KB, `/graficos` 1.150→911 KB.
7. **Datos de ejemplo a la vista** (pizarra de la cinta hardcodeada, implícitas "Granos (ej.)") →
   cinta con pizarra real de CAC, serie de ejemplo eliminada, `sample.ts` borrado, **`noindex`
   global quitado**.
8. **Trampas del encendido del login desactivadas**: el proxy ya no bloquea `/api/views|informes/*`
   (la Routine MP3 sobrevive), `INFORME_TOKEN` por header + `timingSafeEqual`, CSP Report-Only +
   HSTS, mesa lee con service key y el revoke de las 7 matviews **ya está aplicado y verificado**,
   RPC muerta `ingest_cierres_cem` dropeada (con la lección: revocar PUBLIC, no solo anon).
9. **Mobile**: fin del scroll horizontal en todas las `(site)`; `/produccion` en pestañas; 404
   branded; DJVE sin ~70 filas vacías; sellos sin el puente "ISA Agents".
10. **Historia y docs**: PAS (BCBA) cerrado formalmente (Cloudflare 2/2, respaldo por mail),
    `PLAN_PUERTOS.md` al día, y las 3 listas de pendientes paralelas consolidadas — desde esta etapa,
    en el **backlog maestro de este archivo**.
11. **Decisiones de fórmula tuyas aplicadas** (E2): UST$T fijado a T+0, picker con vencimiento real,
    pases consecutivos agregados, aforo a % relativo, soja en equivalente poroto en el semáforo,
    extremos reales ("ilimitada") en estrategias + 4 presets nuevos.
12. **Hosting decidido y contratado**: Vercel Pro $20/mes, functions en gru1, spend limit.

**Lo que queda abierto** (el porqué de este documento) — en orden:
1. **Terminar el encendido del login** (Parte C: publicar la app de Google → `AUTH_ENFORCED=true`).
   Es lo único que está a mitad de camino HOY.
2. **DEA-SAGyP sigue bloqueada** — ni GitHub Actions ni la Edge Function de São Paulo conectan
   (`tcp connect error` 5/5). El dato está clavado al 13/07. Cubierta por healthcheck+alertas, pero
   hay que destrabar la fuente (lote L5).
3. **El backlog de producto**: informes automáticos MP1/MP2/MP4 (MP3 ya está — falta solo tu
   Routine), y los P1–P12 de `PLAN_BACKLOG.md` (P3/P4 con research hecho, esperan tus respuestas).
4. **Los 4 refactors de código aprobados-diferidos** (partir `market.ts`, util de mes/posición,
   motor de gráfico compartido, `noUncheckedIndexedAccess`) — lotes L1–L3.
5. **La calibración de parámetros de mesa** que quedaron marcados PROVISORIOS en el código
   (umbrales de cobertura, pesos/bandas/rindes del índice MESA, comisiones de estrategias) — lote L4.
6. **Robustez v2 de ingestas** (barrido de falso-verde en modos backfill + calendario desde el ICS
   de NASS + chequeo de erosión del roster) — lote L6.
7. **Pasos manuales tuyos chicos**: Routine MP3, borrar ramas mergeadas, suscripción mail PAS,
   responder P3/P4, confirmar el uploader, decidir H12 y girasol/sorgo.

**Nada aprobado se perdió; nada rechazado reaparece** — el registro completo está en las secciones
de abajo (§2 fusión, §5 rechazados).

---

## 1. Estado final por etapa

| Etapa | Hallazgos | Fase 2 | Quedó abierto (→ backlog §4) |
|---|---|---|---|
| E1 datos | 9 (+4 dudas) | 7 aplicados; #2 (visibilidad) diferido a E5 → **cerrado el 22/07** (service key + revoke aplicado); `calendario_informes` se conserva (decisión) | nada propio |
| E2 fórmulas | 6 (+11 preguntas, todas respondidas) | 5 aplicados + 8 respuestas implementadas; tests → E4 (hechos) | calibraciones r3/r4 + comisiones r9b → **L4** |
| E3 UX | 11 (+H12, +6 dudas) | 11 aplicados (incl. matviews H1/H6, aplicada 22/07); noindex quitado | **H12** (mobile /graficos, sin aprobar) · **D6** (montos VIEJA) |
| E4 código | 23 | 19 aplicados (incl. Vitest 91 tests, espejos por import real, bundle −235 KB) | #10/#11/#13/#14 → **L1–L3** |
| E5 infra | 14 (+22 caminos falso-verde) | 14 aplicados (todo aprobado); Partes A y B de la guía ejecutadas por Lautaro el 22/07 | **DEA** (#8, la Edge no alcanzó) → **L5** · barrido backfills + ICS NASS + roster → **L6** |
| E6 historia | 8 (+tabla de promesas) | 7 aplicados (docs consolidados, PAS cerrado) | ramas remotas (comandos) · uploader sin confirmar · girasol/sorgo (preguntar) |

## 2. Fusión: hallazgos que aparecieron en más de una etapa (dedup con decisión arrastrada)

> Regla de esta tabla: **una fila por problema real**, sin importar cuántas etapas lo vieron.
> La decisión es la de Lautaro en la etapa que lo cerró; el estado es el verificado HOY (22/07).

| Problema (una sola vez) | Lo vieron | Decisión arrastrada | Estado 22/07 |
|---|---|---|---|
| Visibilidad de datos de mesa: matviews/`lineup` legibles por anon vía API | E1 #2 → E5 Duda 5 | (a) mesa lee con service key + revoke a anon **al encendido** | ✅ CERRADO — `supabase.ts` prefiere service key; revoke de las 7 matviews **aplicado y verificado** (Parte B, 22/07) |
| Vistas pesadas sin materializar → timeout/500 (djve_cobertura · djve_embarques_mes · lineup_estacional) | E2 #1 · E3 H1/H6 | corregir (materializar, patrón `lineup_visitas`) | ✅ CERRADO — 3 matviews aplicadas; `/comercio/empresas`, `/senal` y `/embarques` pobladas |
| Refresh de matviews no corre / muere en silencio | E2 #2 → E5 #3 | corregir (causa raíz a E5) | ✅ CERRADO — `statement_timeout='300s'` por-función; `ingest-lineup` verde (dispatch 22/07) |
| DEA-SAGyP caída (timeout de conexión desde Actions) | E6 #1 → E5 #8 | Edge Function como ISA | ⚠️ **ABIERTO** — `dea-fetch` deployada pero MAGyP tampoco acepta São Paulo (`tcp connect error`); dato al 13/07; cubierto por healthcheck (9d) + alertas → **L5** |
| PAS (BCBA) "pendiente de validar" repetido en 4+ docs | semilla E1/E2/E5 → E6 #2 | cerrar: no automatizable (403 Cloudflare 2/2), respaldo mail | ✅ CERRADO en docs — falta el paso manual: **suscribirse al informe PAS por mail** |
| `ingest_cierres_cem` ejecutable por anon (SECURITY DEFINER con INSERT+HTTP) | E1 #1 → E5 #4 | revoke → al ver que PUBLIC lo neutralizaba, DROP | ✅ CERRADO — función dropeada; regla nueva: revocar incluye PUBLIC |
| Semántica de `compras.fuente` / convivencia MAGyP–Agrochat (y el DELETE que borró la semana 15/07) | E1 #3+Duda 2 → E5 #1/#2 | **(b)** MAGyP automática solo-INSERT + Agrochat manda (pisa la decisión provisoria de E1 "Agrochat única") | ✅ CERRADO — parser descarta el grupo viejo; upsert `ignore-duplicates`; semana 15/07 restaurada por el cron del 23/07 |
| Healthcheck sin cubrir compras/djve/matviews + umbrales flojos | E1 #4 → E5 #7 | corregir | ✅ CERRADO — 17 checks (matviews, `views_mercado`, `vencimientos` ≥180d, seeds ≥60d, DEA 9d) + alertas Resend |
| Datos de ejemplo a la vista (cinta pizarra · implícitas granos) → causa del `noindex` | semilla E3 · E6 → E3 H4/H5/D1-D2 → E4 #15 | conectar CAC real + sacar la serie + borrar `sample.ts` + quitar noindex | ✅ CERRADO — todo aplicado; el sitio ya es indexable (páginas de mesa mantienen su noindex propio) |
| `compras.*` en float8 (causa raíz del incidente ÷1000/6,4e15) | E1 →Para E4 → E4 #7 | migrar a `numeric` ahora | ✅ CERRADO — 9 columnas migradas, matview recreada idéntica |
| `campanas.ts` (TS) ↔ SQL `campana_ini_year` divergentes (SOJA_CRUSH) | E1 →Para E4 → E4 #3 | corregir + test de paridad | ✅ CERRADO — SQL actualizada; paridad 612/612 en Vitest |
| Espejos lib↔script (parse-agrochat, noticias-clasificar, factores CBOT, ADMIN_SEED_EMAILS) | E4 #2/#4/#5/#20 (semilla E2) | import real (no copias) | ✅ CERRADO — los `.mjs` importan `src/lib`; función SQL de chequeo de seeds |
| Cero tests / fichas E2 como fixtures | E2 #6 → E4 #12 | tanda completa | ✅ CERRADO — Vitest, 14 archivos, 91 tests verdes en CI |
| Fórmula de `calc-planta` inline + `precioConPago` duplicada | E2 →Para E4 → E4 #16 | corregir | ✅ CERRADO — `src/lib/planta.ts` extraída; import real |
| Prender `AUTH_ENFORCED` rompía flujos (proxy vs `/api/*` con token propio · Routine MP3) | E5 #5 (semilla MP3) | corregir antes del encendido | ✅ CERRADO — proxy deja pasar `/api/views|informes/*`; token por header Bearer |
| Hardcodeos con vencimiento (seed `vencimientos` · `FERIADOS_AR` · seeds calendario 2026) | E5 #9 (semilla E2 para feriados) | corregir | ✅ CERRADO — `vencimientos` se refresca cada noche desde CEM; test Vitest de feriados; checks de seed en healthcheck. La **versión mayor** (generar desde ICS NASS) → **L6** |
| Alertas de un solo canal (nadie vio DEA 5 días ni lineup 3 días en rojo) | E6 #1 (evidencia) → E5 #7 | mail Resend a lautaroronchi97@gmail.com | ✅ CERRADO — 6 workflows críticos con `if: failure()`; `RESEND_API_KEY` cargada y probada (3 alertas reales) |
| Tres listas de pendientes paralelas | E6 #5 (propuesta) → E7 | lista única | ✅ CERRADO — el backlog maestro es el **§4 de este archivo**; `ESTADO.md`/`CONTEXTO.md`/`PLAN_BACKLOG.md` apuntan acá |

**El resto de los hallazgos fue único de su etapa** y quedó cerrado en su propia fase 2 (verificación
en la tabla «Fase 2» de cada informe). Los únicos abiertos están en la matriz de abajo.

## 3. Matriz impacto × esfuerzo de TODO lo aprobado-y-pendiente

> Impacto: para la **mesa** (Lautaro/Mauro operando) · para **clientes** (productores/acopios) ·
> para la **robustez** (que nada se rompa/mienta en silencio). Esfuerzo en **sesiones estimadas**
> (una sesión = un PR). Los ítems 🔒 esperan un insumo/decisión de Lautaro como paso 1.

| Ítem | Origen | Mesa | Clientes | Robustez | Sesiones | Depende de |
|---|---|---|---|---|---|---|
| Encendido del login — Parte C (publicar app Google + `AUTH_ENFORCED=true`) | E5/guía | alto | **alto** | alto | manual (~30 min) | Partes A/B ✅ hechas |
| **L5** — DEA: destrabar la fuente | E5 #8 | **alto** | medio | alto | 0,5–1 | — |
| **MP1** — informe diario (placa WhatsApp) | PLAN_INFORMES | **alto** | **alto** | — | 1 | env vars Claude ✅ listas |
| **MP2** — informe semanal (PDF) | PLAN_INFORMES | alto | **alto** | — | 1 | MP1 |
| **MP4** — interpretación de informes de organismos | PLAN_INFORMES / ítem 21 | alto | alto | — | 1 | MP1 |
| Routine semanal MP3 | PLAN_INFORMES | alto | — | — | manual (~10 min) | prompt listo en la sesión MP3 |
| **P3** build — compras netas BCRA (API v4 var 78 + carga manual del día) | PLAN_BACKLOG | alto | medio | — | 1 | ✅ decidido 22/07 (§7) |
| **P4** build — camiones en puerto (SAGyP diario, público, backfill 2020→) | PLAN_BACKLOG | alto | medio | — | 1–1,5 | ✅ decidido 22/07 (§7) |
| **L4** — calibración de mesa (umbrales cobertura · parámetros MESA · comisiones estrategias · roster) | E2 r3/r4/r9b + E5 | **alto** | bajo | medio | 1 | 🔒 tus valores (paso 1 del prompt) |
| **P1** — Merval + EWZ + volumen Matba en el monitor | PLAN_BACKLOG / ítem 5 | medio | medio | — | 0,5 | — |
| **P2** — variación semanal USD (gráfico) | PLAN_BACKLOG / ítem 13 | medio | medio | — | 1 | — |
| **P5** — vista por grano | PLAN_BACKLOG / ítem 18 | medio | **alto** | — | 1 | — |
| **L6** — robustez ingestas v2 (backfills + ICS NASS + roster-erosión) | E5 →E7 | bajo | — | **alto** | 1 | — |
| **P6** — gráficos v2 (paquete) | PLAN_BACKLOG | medio | medio | — | 1–1,5 | 🔒 ejemplos P12/P17 (parcial); presets de usuario esperan login ON |
| **P7** — vista productor + PWA | PLAN_BACKLOG | — | **alto** | — | 1 | login ON conviene primero (noindex ya resuelto ✅) |
| **P8** — feed A3 histórico intradiario | PLAN_BACKLOG | medio | — | medio | 1 | 🔒 secrets A3 en GitHub (manual) |
| Extras de spec de puertos (matriz mes/zonas · "qué cambió" ampliado) | ítem 6 backlog | medio | — | — | 0,5–1 | — |
| **L1** — partir `market.ts` + util única de mes/posición | E4 #10+#11 | — | — | medio | 1 | mejor ANTES de P2/P6 (tocan lo mismo) |
| **L3** — `noUncheckedIndexedAccess` (152 errores, 32 archivos) | E4 #13 | — | — | medio | 1 | después de L1 (menos archivos que sanear) |
| **L2** — motor de gráfico SVG compartido | E4 #14 | — | — | bajo | 1 | mejor antes de P2 (que suma un chart) |
| ~~**H12** — overflow mobile de `/graficos`~~ | E3 | bajo | medio | — | — | **NO** por ahora (22/07, §7) |
| **D6** — montos "VIEJA" enormes en `/comercio/empresas` (¿acumulan campañas?) | E3 → E1/E2 | medio | — | — | 0,5 | Claude investiga (22/07, §7) |
| **P9** — sintéticos TIR | PLAN_BACKLOG | medio | medio | — | 1 | 🔒 tabla IAMC + tu fórmula |
| **P10** — estrategias avanzadas (primas reales · costos por pata) | PLAN_BACKLOG | medio | medio | — | 1–2 | 🔒 tus decisiones/ejemplos |
| **P11** — modelo propio de capacidad de pago | PLAN_BACKLOG | medio | bajo | — | 1 | 🔒 tu fórmula |
| **P12** — scoring de clientes | PLAN_BACKLOG | alto (producto) | — | — | 2+ | 🔒 datos de fijaciones |
| Girasol/sorgo en "Negocios de planta" | E6 promesas | bajo | bajo | — | 0,1 | ✅ sí (22/07, §7) |
| Leaked password protection | E1/E5 | — | — | bajo | 1 click | 🔒 requiere Supabase Pro ($25/mes) — decidiste NO por ahora; re-evaluar si upgradeás |

## 4. BACKLOG MAESTRO ÚNICO

> **Desde el 22/07/2026 esta es LA lista donde se prioriza.** Reemplaza el checklist «Plan ROFO AGRO»
> de `ESTADO.md` (queda como histórico), los «Pendientes» de `CONTEXTO.md` (ya retirados por E6) y
> el tablero de `PLAN_BACKLOG.md` (absorbido — sus prompts P1–P12 siguen siendo los prompts de
> ejecución). Cada sesión que complete un ítem lo tacha ACÁ y anota el PR.
> El orden dentro de cada grupo sale de la matriz §3; Lautaro puede reordenar libremente.

### A. Pasos manuales de Lautaro (no son sesiones — son clics/respuestas; destraban lo demás)

- [x] **A1. Terminar Parte C del login** — ✅ hecha 27/07: verificación de marca de Google OK →
  app publicada a producción → `AUTH_ENFORCED=true` en Vercel + Redeploy. De paso, bug real
  encontrado y arreglado (config de Supabase, no código): Site URL/Redirect URLs de Supabase Auth
  seguían con las URLs viejas de antes del dominio propio, el login con Google caía en
  `localhost:3000`. Confirmado funcionando de punta a punta con `rofoagro.com.ar`. Mauro sigue sin
  registrarse (no bloquea). `sesiones/2026-07-27-a1-login-encendido.md`.
- [x] **A2. Crear la Routine semanal MP3** — ✅ hecha 23/07 (cron `0 12 * * 5`, modelo asignado a
  mano por Lautaro desde la app). El primer disparo real cae el viernes siguiente, sin verificar
  todavía de punta a punta. `sesiones/2026-07-23-mp2-skill-y-alta-srl.md`.
- [x] **A3. Suscribirse por mail al informe PAS de la BCBA** — ✅ hecha 23/07 (Lautaro se suscribió
  por WhatsApp, no por mail — mismo efecto: respaldo humano del informe). `sesiones/2026-07-23-mp2-skill-y-alta-srl.md`.
- [x] **A4. Borrar las ramas remotas ya mergeadas** — ✅ verificado 24/07: `git ls-remote --heads
  origin` solo devuelve `main`, no queda ninguna rama remota vieja (se limpiaron solas al mergear
  con el flujo habitual de PR). Nada que borrar.
- [x] **A5. Responder las preguntas de P3 y P4** — ✅ respondido 22/07 (§7): P3 = automático +
  carga manual del día · P4 = público, backfill 2020→hoy. C4 y C5 desbloqueados.
- [x] **A6. Probar el uploader de `/admin/datos` logueado — ✅ CERRADO 27/07**, con Lautoro en vivo,
  las 7 secciones. Detalle en `sesiones/2026-07-27-a6-uploaders-formato-crudo.md`:
  - ✅ **Datos del día** (23/07) + historial editable de los últimos 14 días (24/07).
  - ✅ **DEA-SAGyP**: fix del límite de payload (24/07) confirmado con el CSV real (27/07) — 24
    filas, vintage del día.
  - ✅ **Comercialización (Agrochat)** y ✅ **Camiones (Williams)** (27/07): bug real de origen
    encontrado (no de la web) — lo que Agrochat devuelve ya transformado sale como texto de una
    celda de dataframe, sin salto de línea real, no descargable. Fix: los dos parsers aceptan
    directo el dataset CRUDO de origen (SÍ es un archivo real) y replican la transformación en
    TypeScript. 90/90 y 80/80 filas verificadas contra datos reales.
  - ✅ **BCBA-PAS** (27/07): `historico_pas_datasets.csv`, 400 filas.
  - ✅ **Compras BCRA manual** y ✅ **Pago final LECAP** (27/07): cargados y verificados por SQL.
  Solo queda sin confirmar el detalle chico del historial editable de "Datos del día" (editar un
  día viejo + ver el bloqueo 🔒) — no bloquea nada, el resto del ítem está cerrado.
- [x] **A7. Decidir H12 y girasol/sorgo** — ✅ decidido 22/07 (§7): H12 no por ahora · girasol/sorgo sí.
- [x] ~~**A8. Re-evaluar Leaked password protection**~~ → **descartado por ahora, 24/07** (Lautaro:
  "descartalo"). Se retoma solo si algún día se decide upgradear Supabase a Pro ($25/mes).

### B. Quick wins restantes (fixes chicos, se pueden juntar en una sola sesión)

- [x] **B2. D6** — ✅ investigado 22/07 (§7): era bug real — la columna "VIEJA" de
  `/comercio/empresas` sumaba las 17 campañas 2010→2025 (backfill Fase 3) pero la UI la etiquetaba
  como la campaña anterior sola. **Fix elegido: VIEJA = solo camp_ini = actual−1** (maíz 395,3→29,0
  Mt, soja 108,9→12,1 Mt). Mergeado (PR #62).
- [x] **B3. Girasol/sorgo** en el selector de "Negocios de planta" — hecho 23/07
  (`sesiones/2026-07-23-l4-c5-camiones.md`).
- [x] ~~**B1. H12** — overflow mobile de `/graficos`~~ → **NO por ahora** (22/07, §7): es
  herramienta de mesa que se usa en desktop. Revisable si se empieza a usar en celular.

### C. Features de producto (el valor nuevo; orden por matriz §3)

- [x] **C1. MP1 — informe diario** — ✅ código hecho 22/07, PR #63 (rama
  `claude/resolver-pendientes-qnts8j`). Falta el paso manual A2 (crear la Routine) para que
  corra sola; el primer disparo real termina de verificar RPC/Storage/mail.
- [~] **C2. MP2 — informe semanal PDF** — base + gráfico HECHOS 23/07, PR #63 (datos
  semanales, plantilla A4 de 5 páginas verificada con PDF real, dólar oficial BCRA A3500
  sumado también a `/dolar` en vivo). **Falta la skill** (a pedido de Lautaro: quiere pensar
  con calma qué destacar cada semana antes de automatizarlo) + la Routine. Detalle:
  [`sesiones/2026-07-23-informes-mp2-semanal.md`](../sesiones/2026-07-23-informes-mp2-semanal.md).
- [x] **C3. MP4 — interpretación de informes de organismos** — hecho 23/07 (rama
  `claude/avance-c3-1ra0au`, PR #67): tabla `interpretaciones` + RPCs admin (migración
  **aplicada**), detección/generación como paso nuevo de la skill `informe-diario` (reusa
  `informesHoy` que MP1 ya dejó preparado en `/api/informes/datos`), panel
  `/admin/interpretaciones` (editor + Publicar/Descartar), "La lectura de la mesa" colapsable en
  `/produccion` + feed en `/informes`. Probado con un informe real ya ingestado (USDA WASDE #673):
  borrador generado con números exactos y dejado SIN publicar en la base, a la espera de que
  Lautaro lo revise — publicarlo yo mismo hubiera saltado la regla "nunca sale sin su OK". RLS
  verificado por SQL en los dos sentidos. `sesiones/2026-07-23-mp4-interpretacion.md`.
- [x] **C4. P3 build — compras netas BCRA** — hecho 23/07 (fuente: API v4 var 78 para la
  historia/rezago + carga manual del día en /admin, decidido 22/07, §7): ingesta automática
  `ingest-bcra-mulc.mjs` + workflow + healthcheck, panel nuevo en `panel-cambiario.tsx`
  ("Compras netas BCRA (MULC)", KPIs + gráfico de barras), backfill real 5.770 filas 2003→hoy
  cargado a la base (verificado 1:1 contra la API), `compras_bcra` pasó a pública (mismo criterio
  que camiones/DJVE). **Verificación visual + primer cron real: HECHO 24/07** (panel confirmado en
  navegador claro/oscuro con datos reales, primer `workflow_dispatch` disparado y verificado 1:1
  contra la API). `sesiones/2026-07-23-c4-compras-bcra.md` +
  `sesiones/2026-07-24-verificacion-panel-bcra.md`.
- [x] **C5. P4 build — camiones en puerto** — hecho 23/07, **pivotó de fuente**: en vez de SAGyP
  diario automático, Williams Entregas (vía Agrochat) por carga manual — zona Y producto, cero
  dependencia de SAGyP (Williams confirmado como servicio pago sin API). Panel público + señal
  barcos-vs-camiones solo-mesa. Backfill 2018→hoy (mejor que el 2020→hoy decidido el 22/07, porque
  la fuente cambió a una con más historia disponible). `sesiones/2026-07-23-l4-c5-camiones.md`.
- [x] **C6. P1 — Merval + EWZ + volumen Matba** — hecho 23/07. Merval/EWZ sumados al Monitor de
  mercados (`/granos`); volumen+interés abierto por grano sumados al panel de Arbitrajes (ya
  conectado al feed en vivo de A3 — decisión de Lautaro: sumar a lo que ya fluye ahí, no traer una
  fuente externa nueva), en toneladas (contrato Matba = 100 t, verificado). Detalle:
  [`sesiones/2026-07-23-p1-p2-monitor-dolar.md`](../sesiones/2026-07-23-p1-p2-monitor-dolar.md).
- [x] **C7. P2 — variación semanal del USD** — hecho 23/07 (se construyó sin esperar L1/L2: el
  combo línea+barras se armó con Recharts, patrón `volumen-panel.tsx`, no con el motor SVG que L2
  va a compartir). Hallazgo: ya existía un panel chico (~13 días, para MP2) marcado "pendiente" por
  desactualización del backlog — quedó sin tocar; se sumó la serie semanal larga (26 semanas,
  fuente BCRA API v4 var. 5 directa, en vivo cacheada, sin tabla nueva) + un gráfico de volatilidad
  (desvío rolling 12 semanas anualizado, pedido nuevo de Lautaro, fórmula confirmada con datos
  reales). Detalle:
  [`sesiones/2026-07-23-p1-p2-monitor-dolar.md`](../sesiones/2026-07-23-p1-p2-monitor-dolar.md).
- [x] **C8. P5 — filtro por grano** — hecho 23/07. Lautaro aclaró que NO quería
  una página nueva por grano (como proponía el prompt original): quería un
  **filtro por grano dentro de los paneles ya existentes**. Chips
  Todos/Soja/Maíz/Trigo (nuevo `filtro-grano.tsx`) en Arbitrajes/Pases/Monitor
  de mercados (`/granos`) y Temperatura (`/comercio/temperatura`); select
  "Producto" en Negociado y Empresas (`/comercio/*`, ya tenían selects para
  otros filtros). Deliberadamente sin filtro: "Mejor para hacer caja" (el
  ranking ES la comparación cross-grano) y "Capacidad de pago" (3 filas, no
  aporta). Verificado con Playwright + datos reales.
  `sesiones/2026-07-23-c8-filtro-por-grano.md`.
- [x] **C9. Extras de spec de puertos** — hecho 24/07: alcance cerrado con Lautaro por
  `AskUserQuestion` (no había prompt escrito ni spec original versionada acá). Matriz mes×zona en
  `/comercio/embarques` solo en la fila de embarcado (DJVE no tiene puerto/muelle) + "qué cambió"
  ampliado en `/comercio/puertos` (buques que salieron, mismo umbral 30kt + comparación contra una
  rueda de referencia ~1 semana atrás). 2 vistas SQL aditivas, verificado 1:1 contra SQL real.
  `sesiones/2026-07-24-c9-puertos-extras.md`.
- [x] **C10. P6 — gráficos v2** — hecho 23/07 (URL modo Período · ratio/base % · export PNG/CSV ·
  media móvil · vol/OI · guard parcial). P12/P17 resueltos con la respuesta de Lautaro (la relación
  % es el ratio existente pizarra maíz/soja; "son pizarras" → sin serie front-month que construir).
  Presets de usuario siguen esperando login ON (A1). `sesiones/2026-07-23-c10-graficos-v2.md`.
- [x] ~~**C11. P7 — vista productor + PWA**~~ → **DESCARTADO 24/07** (Lautaro: "ninguno de los
  dos desarrollos me interesa" — ni la vista simplificada ni la PWA instalable). Ver §5.
- [x] ~~**C12. P8 — feed A3 histórico intradiario**~~ → **DESCARTADO 24/07** (Lautaro lo descartó
  directamente). Ver §5.
- [x] **C13. P9 — sintéticos TIR** — HECHO (24/07, PR #75). Fórmula validada contra el Excel de
  Lautaro (sint = spot×(pagoFinal/px); directa = sint/fut−1; TNA act/365), panel `/dolar` Sintéticos
  con TIR + comparación vs futuro directo. "Pago final por letra" por carga semi-manual en
  `/admin/datos` (fuente última BYMA, no expone endpoint parseable; casi estático). Ver
  `sesiones/2026-07-24-c13-sinteticos-tir.md`.
- [ ] **C14. P10 — estrategias avanzadas** 🔒 (primas reales/costos: tus decisiones como paso 1).
  **Sin prioridad por ahora (24/07)**: Lautaro no quiere sumar estrategias con costos por el
  momento — sigue pendiente, no descartado, se retoma cuando él lo pida.
- [x] **C15. P11 — modelo propio de capacidad de pago** — hecho 24/07 (Lautaro le dijo "C16" al
  pedirlo — la sesión y el PR quedaron con ese nombre; es este ítem, no el C16 real de abajo).
  En vez del paso 1 original (fórmula de Lautaro a mano), pidió research profundo con Fable +
  construir el modelo con eso. BCR/Nuestro/Pizarra + diferenciales, FOB oficial de SAGyP/MAGyP
  (fuente propia, homologada empíricamente), gastos sembrados de BCR y editables.
  `sesiones/2026-07-24-c16-capacidad-pago.md`.
- [x] ~~**C16. P12 — scoring de clientes**~~ → **DESCARTADO 24/07** (Lautaro: "tampoco me
  interesa, descartalo"). Ver §5.
- [x] ~~**C17. Gráficos intradía**~~ → **DESCARTADO 24/07** (cae con C12: consumía la tabla
  `snapshots` que C12 iba a crear, sin C12 no tiene insumo). Ver §5.

**C18–C22 — INFORMES V2 (research multi-agente + bola de nieve).** Bloque nuevo del 24/07, plan
propio en **[`PLAN_INFORMES_V2.md`](../PLAN_INFORMES_V2.md)** (PR #81, mergeado): nutre las 4 piezas
MP1-MP4 ya construidas con agentes de research sobre fuentes externas verificadas + un view
**acumulativo** (tesis previa + lo nuevo de cada semana, con switch cuando un evento la invalida).
Los prompts autocontenidos de cada fase están en **§9 de ese plan**, no acá. Las 4 decisiones
abiertas ya las contestó Lautaro antes de mergear (§10 del plan).

- [x] **C18 = V0. Verificar el piso** — ✅ **hecho 27/07.** Diagnosticadas y arregladas 3 causas
  reales encadenadas: (1) `INFORME_TOKEN` desincronizado entre el entorno de Claude Code y Vercel
  Producción (401 en silencio); (2) falso positivo de lunes en `ingest-lineup` (ventana de fechas
  corta); (3) **regresión real del mismo A1**: `/informes/plantilla/*` quedó atrás del gate de
  `AUTH_ENFORCED`, la Routine se llevaba el HTML de `/ingresar` — fix en `src/proxy.ts` (mergeado,
  PR #83) + skills `informe-diario`/`informe-semanal` actualizadas (workaround de Playwright detrás
  del proxy del sandbox + modelo grande fijado). Confirmado dos veces, en sesiones independientes,
  que `add_repo`/`register_repo_root` no existen en el entorno headless — el camino real es `git
  clone` directo; los 3 prompts de las Routines se limpiaron de esa instrucción falsa. **Las 3
  Routines verificadas de punta a punta el mismo día**: informe diario enviado (27/07), informe
  semanal enviado (semana 18/07–24/07, "El trigo se lleva la semana"), view de mercado con los 3
  granos guardados (27/07: soja NEUTRAL, maíz ALCISTA, trigo NEUTRAL).
  **Queda (menor, no bloquea)**: feedback real de Lautaro sobre el contenido del informe del 27/07 ·
  cargar la key gratuita de USDA FAS · confirmar si una Routine puede invocar subagentes
  (precondición del fan-out de V1) · evaluar en una sesión de calibración el aprendizaje que
  propuso la sesión del view (índice MESA caliente + dirección cerrándose + Chicago corrigiendo en
  el día → leer neutral, no alcista — una sola observación, no aplicar aún a
  `references/aprendizajes.md`). Detalle:
  [`sesiones/2026-07-27-c18-routines-diagnostico.md`](../sesiones/2026-07-27-c18-routines-diagnostico.md).
- [x] **C19 = V1. View v2 (la bola de nieve)** — ✅ **hecho 28/07**, PR #89 (mergeado). Migración
  aditiva de `views_mercado` (`relacion_previa`/`view_previo_id`/`invalidadores`/
  `evidencia_externa`/`nota_lautaro`) + skill con pipeline F0-F6 (blind-first, invalidadores
  inmutables, 4 lentes de research con pasaporte, agente rojo, verificación mecánica) +
  `views-scorecard.ts` (contrato fijado en t0, nunca re-elegido) + UI con badges/scorecard/
  invalidadores/nota. Detalle:
  [`sesiones/2026-07-28-c19-c20-view-mercado-interpretaciones.md`](../sesiones/2026-07-28-c19-c20-view-mercado-interpretaciones.md).
- [x] **C20 = V2. Interpretaciones v2 (expectativa vs dato)** — ✅ **hecho 28/07**, mismo PR #89.
  DTN verificado real (tabla de expectativas sin paywall). El Paso 9 de `informe-diario` arma
  "el mercado esperaba A, salió B → sorpresa" + "cuánto ya estaba en el precio" para USDA;
  GEA/DEA/CONAB/PAS degradan a consenso implícito. **Fix crítico del disparo de BCBA-PAS**
  hecho: `construirCambios` expone `actualizadoEn`, el filtro ya no depende solo de
  `fecha_publicacion`. Mismo detalle de sesión que C19.
- [x] **C21 = V3. Semanal v2** — ✅ **hecho 28/07**, rama `claude/v3-v4-informes-e7sfwf`, PR #_.
  Sección "El mundo esta semana" (research acotado, mismas fuentes que la lente 1/2 de
  `view-mercado`, pasaporte verificado) en la página de dólar/Chicago, sin sumar hoja (recorte:
  `ChartTabla` redundante bajo `DolarOficialChart` omitido en el PDF, `/dolar` en vivo intacto) +
  `relacion_previa`/`evidencia_externa` sumados a `getViewMercadoVigentePorGrano()` (bullet
  automático si algún grano hizo SWITCH) + `getScorecardResumen()` (hit-rate/racha 1 vez por mes,
  reusa `calcularScorecard` sin fórmula nueva) + agenda con expectativas en el cierre. Medido con
  datos reales que la página 3 quedó exacta en 297mm; el `/Count 7` del PDF es 100% atribuible a
  la página 5 (tesis largas de V1), preexistente y confirmado NO ser una regresión de V3 (mismo
  `/Count` con el informe YA enviado el 24/07). Detalle:
  [`sesiones/2026-07-28-v3-v4-informes.md`](../sesiones/2026-07-28-v3-v4-informes.md).
- [x] **C22 = V4. Diario (retoque) + medición** — ✅ **hecho 28/07 (parcial)**, mismo PR. El diario
  ahora recibe `viewsMercado` (con `evidencia_externa` ya verificada) y la skill dice explícito
  que la puede citar de contexto sin research propio ni multi-agente. **La medición de consumo
  real de las 4 Routines NO se pudo completar**: esa telemetría no es visible desde este entorno
  de código (vive del lado de la cuenta de Lautoro) — queda pendiente real, no bloqueante.
  Mismo detalle de sesión que C21.
- [x] **C23. Estimaciones BCBA-PAS por ZONA agroecológica (anotado 27/07 — PLAN CERRADO 29/07 —
  ✅ FASE 1 HECHA 29/07, rama `claude/fase1-bcba-pas-zonas-7lwyom`)** —
  al probar el uploader de BCBA-PAS (A6) Lautaro pasó un export alternativo (`reporte.xlsx`, hoja
  "Reporte base de datos") desglosado por **zona agroecológica**, no solo el total país que ya
  carga `historico_pas_datasets.csv`. **29/07: archivo real analizado a fondo y plan cerrado con
  Lautaro** — es la **Fase 1 de [`PLAN_PAS_ZONAS.md`](../PLAN_PAS_ZONAS.md)** (prompt de ejecución
  autocontenido en **§8**; build sugerido con Sonnet). Lo verificado: 15 zonas + TOTAL (nombres
  exactos en el plan §2.a), 6 cultivos × 27 campañas 2000/01→2026/27, `Producción(MTn)` = toneladas
  CRUDAS (soja 24/25 = 50,3 Mt ✓, maíz = 49,0 Mt ✓), typo real "Perdído" en el header, y el
  hallazgo que define el diseño: la identidad suma-zonas = TOTAL **cierra ≤0,5% solo desde
  2008/09** (antes las zonas cubren ~50%). Decisiones: tabla nueva `pas_zonas` ancha sin vintages ·
  **solo-mesa con RLS cerrada de verdad** (patrón `views_mercado`) · panel `/produccion/zonas` =
  foto de campaña (Δ descompuesto en efecto área/efecto rinde) + evolución histórica (top-6+Resto,
  desde 2008/09) · uploader con guard de identidad "forzar" · registro en el catálogo de monitoreo
  del PR #104. El archivo real quedó **versionado en `data/pas/`** (fixture del build, no depende
  de volver a pedirlo). **Fase 1 construida 29/07** (`xlsx-lite.ts` extraído de `parse-agrochat.ts` ·
  `parse-pas-zonas.ts` · uploader · `pas-zonas.ts`/`pas-zonas-calc.ts` + panel `/produccion/zonas` ·
  catálogo de monitoreo) y **verificada con Playwright contra el .xlsx real** (1.837 filas cargables,
  identidad cierra 100% desde 2008/09, soja/maíz coinciden 1:1 con lo verificado en el plan) —
  detalle en `sesiones/2026-07-29-c23-fase1-pas-zonas.md`. **Pendiente real: la migración
  `20260729120000_c23_pas_zonas.sql` quedó ESCRITA SIN APLICAR** (instrucción explícita del prompt
  de ejecución: la aplica el orquestador por MCP con el OK de Lautaro) — hasta que se aplique, el
  panel degrada solo ("no se pudo cargar") y el uploader falla prolijo en el paso 2. Sigue la
  **Fase 2 (C27)** una vez mergeado esto.
- [x] **C24. Camiones de Agroentregas** — ✅ **hecho 28/07**, y **salió mejor que el pedido**: el
  ítem estaba escrito como "carga diaria MANUAL desde la cuenta de X, mismo patrón que Compras
  BCRA", con el research de qué publica esa cuenta como paso 1. Ese research (28/07, con requests
  reales) encontró que la página pública `agroentregas.com.ar/total-de-camiones.html` se alimenta
  de un **endpoint JSON abierto sin auth** que trae exactamente la placa que postean **y con más
  detalle: planta, empresa y grano** → C24 dejó de ser carga manual y pasó a ser **ingesta
  automática** (2 corridas diarias). Cero formulario nuevo en `/admin/datos`.
  **El razonamiento del ítem sobre el upsert quedó obsoleto** (decía "el archivo de Williams
  después lo pisa"): se confirmó, como pedía el propio ítem, que NO aplica — los 28 destinos son
  Up River + Paraná bonaerense, **sin Bahía Blanca ni Necochea**, así que su total no es comparable
  con el nacional de Williams y pisarse mutuamente contaminaría el percentil estacional de la señal
  barcos-vs-camiones. Va en **tabla propia** (`camiones_plantas`, migración `20260728150000`
  aplicada), conviviendo con `camiones` sin mezclarse: Williams = respaldo nacional e histórico
  (2018→hoy, alimenta la señal), Agroentregas = pulso diario de Up River + "qué exportador está
  levantando" (apertura por empresa, solo mesa — no la da ninguna otra fuente que tengamos).
  Sin backfill posible (el endpoint ignora parámetros de fecha), pero cada respuesta trae el mismo
  día de la semana de hace 1 y 2 años y la ingesta los guarda → al año de correr hay 3 años de
  estacionalidad construidos solos. Research y verificación:
  [`negocio/10_fuente_camiones_agroentregas.md`](../negocio/10_fuente_camiones_agroentregas.md);
  detalle: [`sesiones/2026-07-28-c24-camiones-agroentregas.md`](../sesiones/2026-07-28-c24-camiones-agroentregas.md).

- [x] **C25. Biblioteca + menú lateral (sidebar) — ✅ HECHO 28/07, PR #_.** Registro único
  `src/lib/biblioteca.ts` (espejo de `SECCIONES_META`) + 15 páginas nuevas cáscara-fina
  (`/granos/{arbitrajes,pases,caja,capacidad,monitor}`, `/dolar/{futuro,oficial,linked,implicitas,
  sinteticos,cambiario}`, `/comercio/djve`, `/produccion/{calendario,estimaciones}`) + índices
  (`/granos`, `/dolar`, `/produccion` a hub-grid; `/comercio` suma DJVE) + `src/components/sidebar.tsx`
  (biblioteca real: varios grupos abiertos a la vez, no acordeón; fijo en desktop, drawer con foco
  atrapado en mobile) + `SiteHeader` mínimo (perdió `NavLinks`, que murió). **Hallazgo real durante
  la verificación**: meter la cinta en el layout compartido (como sugería el árbol del plan) rompía
  la guarda "cero cambios de render" — arrastraba páginas de mesa 100% estáticas a revalidar cada
  ~30-60s (medido con build real, comparado contra `main`); la cinta se dejó donde ya estaba (home).
  Detalle: [`sesiones/2026-07-28-c25-biblioteca-sidebar.md`](../sesiones/2026-07-28-c25-biblioteca-sidebar.md).

- [x] **C26. Panel /admin/conexiones (monitoreo de crons, Routines y cargas manuales) — ✅ HECHO
  29/07, PR #104 (mergeado).** Pedido nuevo de Lautaro: un lugar para ver de un vistazo qué carga
  manual falta, qué cron corrió/no corrió, si las 3 Routines produjeron lo suyo y si A3 está
  trayendo datos en vivo. Confirmado que **no existe ningún `ingest_log`** en el repo → el panel
  combina 3 fuentes reales (API de GitHub Actions, opcional vía `GH_MONITOR_TOKEN`; frescura de
  Supabase, catálogo único extraído a `src/lib/monitoreo/catalogo.ts` y reusado por
  `healthcheck-frescura.mjs`; `informes_generados`/`views_mercado` para las Routines) en vez de un
  registro de corridas que nunca se construyó. Solo lectura + links (sin "correr ahora", decisión
  de Lautaro). Detalle:
  [`sesiones/2026-07-29-panel-conexiones.md`](../sesiones/2026-07-29-panel-conexiones.md).

- [ ] **C27. Condición de cultivos semanal BCBA-PAS (nuevo, 29/07)** — al cerrar el plan de C23,
  Lautaro adjuntó además los exports de **condición de cultivos** de la misma web de BCBA (uno por
  cultivo, hoja "Reporte base de datos"): serie **semanal** de condición de cultivo
  (Mala→Excelente %), condición hídrica (Sequía→Exceso %) y avance fenológico (% por etapa, con
  **nombres de etapa que cambian por cultivo** — verificado con los 4 reales, headers dinámicos
  obligatorios). **Cobertura confirmada: solo soja, maíz, trigo y girasol** (sin cebada/sorgo, BCBA
  no publica este reporte para esos 2). Soja y maíz vienen desglosados en total/1ra/2da, trigo y
  girasol no; `Semana` = 0-53 dentro de la campaña, **sin fecha real** (el eje es "semana de
  campaña", habilita overlay campaña vs previas); trigo llega con la campaña 2026/27 YA en curso.
  Es el panel de "condición de cultivos" que había quedado fasado a propósito el 23/07
  (`reporte_2-5`). **Fase 2 de [`PLAN_PAS_ZONAS.md`](../PLAN_PAS_ZONAS.md)** (prompt autocontenido
  en **§9**; requiere C23 mergeado — comparte `xlsx-lite.ts`). Tabla `pas_condicion` (fenología en
  jsonb array ordenado), solo-mesa con RLS cerrada, panel `/produccion/condicion` (selector
  acotado a los 4 cultivos reales), uploader manual semanal + registro en el monitoreo. Los 4
  archivos reales (soja/maíz/trigo/girasol) ya quedaron versionados en `data/pas/` — el build no
  depende de volver a pedirle nada a Lautaro.

### D. Lotes técnicos aprobados (refactors/calibración/robustez — prompts en §6)

- [x] **D1 = L5. DEA: destrabar la fuente** — ✅ hecho 23/07, PR #63. Bloqueo confirmado a nivel
  TLS desde 3 proveedores cloud (GitHub Actions, Edge Function São Paulo, este sandbox); CKAN
  descartado (le falta la campaña 2025/26 completa). Decisión: carga semi-manual (Lautaro sube el
  CSV por `/admin/datos`, mismo patrón que compras/Agrochat). Detalle:
  [`sesiones/2026-07-23-lote-l5-dea-carga-manual.md`](../sesiones/2026-07-23-lote-l5-dea-carga-manual.md).
- [x] **D2 = L4. Calibración de mesa** — hecho 23/07: umbrales de cobertura pasaron a percentil
  P25/P75 por producto (el fijo 0,7/1,3 disparaba señal 74-95% de los días, verificado por SQL);
  índice MESA auditado y dejado como está; roster con aviso al 15% de OTROS; comisiones de
  estrategias con toggle (tarifario A3/Cocos). `sesiones/2026-07-23-l4-c5-camiones.md`.
- [x] **D3 = L6. Robustez de ingestas v2** — hecho 24/07: guard "0 filas = exit 1" extendido a
  modos backfill/dispatch de cierres/cbot/pizarra/usda/gea/lineup (Anexo A de E5-infra.md, caminos
  1/3/5/6/13/15/19) + guard `daily` muerto de la Edge Function `lineup-ingest` retirado (camino 20,
  redeployado). Calendario NASS (WASDE/Grain Stocks/Crop Progress) generado desde el ICS oficial en
  vez de arrays a mano (`calendario-nass.ts` + `generar-calendario-nass.mjs` →
  `calendario-seed-nass.json`, versionado); verificado 1:1 contra el ICS real antes del cambio,
  2027 confirmado no publicado todavía (404 esperable). Roster de exportadores ya lo había cerrado
  L4 el 23/07 (nada que hacer). `sesiones/2026-07-24-l6-l3-l2-lotes-tecnicos.md`.
- [x] **D4 = L1. Partir `market.ts` + util única de mes/posición** — ✅ hecho 23/07, PR #_. Refactor
  puro (cero cambios de comportamiento): `market.ts` (546 líneas) partido en 8 módulos de
  `src/lib/market/*` + fachada de re-export; `dates.ts` extendido con la util única de mes/posición
  (`MESES_ES`/`mesIndice`/`parsePosicion`/`vencKeyDePosicion`/`vtoDePosicion`/`posicionDeFecha`/
  `hoyVencKey`), migrados los 9 call-sites duplicados. 107/107 tests verdes (16 nuevos), HTML real
  antes/después verificado (byte a byte en `/` y `/granos`; `/dolar` con la única diferencia siendo
  datos en vivo de `data912`, no código). Detalle:
  [`sesiones/2026-07-23-lote-l1-market.md`](../sesiones/2026-07-23-lote-l1-market.md).
- [x] **D5 = L3. `noUncheckedIndexedAccess`** — hecho 24/07. Re-medido primero (pedía el prompt):
  288 errores en 55 archivos (más que los ~152/32 de E4 del 21/07, por el trabajo nuevo del 23-24/07)
  — documentado, no recortado en silencio. Saneados los 288/288 con guard explícito por defecto y
  `!` solo en invariantes de una línea arriba, comentados. 4 bugs latentes reales encontrados y
  corregidos (crash de leyenda con series vacías en `evolucion-chart.tsx`, crash con CSV de 0 filas
  en `parse-agrochat.ts` y en `actions-camiones.ts`, fecha inválida silenciada en `calendario.ts`).
  147/147 tests sin tocar expects. `sesiones/2026-07-24-l6-l3-l2-lotes-tecnicos.md`.
- [x] **D6 = L2. Motor de gráfico SVG compartido** — hecho 24/07: `chart-svg-base.tsx`
  (`useCrosshair` + `SvgLineChartBase`) extraído de `evolucion-chart.tsx`/`dolar-futuro-chart.tsx`/
  `compras/negociado-chart.tsx` — comparten el envoltorio (wrap+marca+svg+grilla+rect interactivo) y
  el estado del crosshair, pero CADA chart conserva su propio algoritmo de "punto más cercano"
  (2D para series superpuestas, 1D para una sola serie, índice directo para el histograma de
  barras — forzar una sola métrica habría cambiado comportamiento real). Verificado con Playwright
  real (datos reales, claro/oscuro, desktop/mobile, hover) sin diferencia visual.
  `sesiones/2026-07-24-l6-l3-l2-lotes-tecnicos.md`.
- [x] **D7 = L7. Detector de anomalías en ingestas** — ✅ hecho 28/07/2026. `src/lib/anomalias.ts`
  (mediana+MAD, salto/magnitud/monotonía/identidad/duplicado/rango) + `anomalias-series.ts`
  (catálogo de 9 series, calibradas contra la base real) + `scripts/chequeo-anomalias.mjs` (barrido
  diario, cron 20:50 ART) + guard en la previsualización de los uploaders manuales de compras/
  camiones (bloquea, con "forzar"). Calibración retroactiva: 2,08 alertas/mes sobre ~100 meses de
  histórico, cada categoría auditada a mano. Los 5 bugs reales del prompt verificados (4/5 con
  fixture real; el typo de BCR en pellets de girasol queda fuera de alcance — ya tiene su propia
  defensa en `capacidad-bcr-parse.ts`, PR #76). `sesiones/2026-07-28-d7-detector-anomalias.md`.

### Dependencias explícitas (grafo corto)

```
A1 (login ON) ──→ presets de usuario de C10 · marca de agua activa (C11 cayó — descartado, §5)
A2 ──→ /granos/view se regenera solo
A5 ──→ C4 y C5
A7 ──→ B1 y B3
C1 (MP1) ──→ C2 (MP2) y C3 (MP4)
C12 (P8) y C17 (gráficos intradía) — cayeron ambos, descartados (§5)
D4 (L1) ──→ D5 (L3 más barato) · conviene antes de C7/C10
D6 (L2) ──→ conviene antes de C7 (chart nuevo del USD semanal)
D2 (L4) 🔒 valores de Lautaro;  C13 hecho (PR #75) · C14 sin prioridad (pendiente) · C15 hecho
(PR #76) · C16 cayó, descartado (§5)
noindex→index: ✅ YA RESUELTO (E3/E4) — la dependencia que citaba PLAN_BACKLOG quedó caída

C18 (V0, Routines rotas) ──→ C19 (V1) ──→ C21 (V3) y C22 (V4)
                        └──→ C20 (V2, paralela a C19)
D7 (L7 anomalías) — INDEPENDIENTE de todo: no depende de A1, del login ni de los informes
```

### Orden decidido (tras los 3 bloques de decisiones del 22/07 — ver §7)

**Ahora:** A1 + A2 (manuales de Lautaro) → C1 (MP1) → D1/L5 (DEA) → C2 (MP2) → **D2/L4
(calibración — Lautaro se sienta con los números)** → C4/C5 (P3/P4, ya desbloqueados) → C3 (MP4).
**Refactors intercalados:** D4/L1 y D6/L2 se meten **antes** de cualquier feature que toque su
código (P2 el USD semanal, P6 gráficos); D5/L3 después de L1.
**En cola (Lautaro evalúa una por una, sin orden fijo):** C6 (P1), C7 (P2), C8 (P5), C9 (extras
puertos), C10 (P6), C11 (P7, mejor con login), C12 (P8), y C13–C16 cuando estén sus insumos.
**Cuando haya ventana:** B2 (Claude investiga D6), B3 (girasol/sorgo, quick win), D3/L6.

*(Nota 24/07: D3/L6, D5/L3 y D6/L2 — los 3 lotes técnicos que quedaban de este grupo — ya están
HECHOS, ver §4. Esta sección "Orden decidido" queda como registro histórico del 22/07, sin reescribir.)*

*(Nota 28/07: D7/L7 — nuevo el 24/07, sumado al grafo de arriba como "independiente de todo" —
también ya está HECHO, ver §4.)*

## 5. Rechazados y descartados (para que NO reaparezcan)

| Qué | Dónde se decidió | Veredicto |
|---|---|---|
| Modelar planes Cocos Gold/Pro/AFI en `costos.ts` | E2 r9c | **No** — alcanza humana/jurídica |
| Migración de `globals.css` a Tailwind / reorganización big-bang | E4 | **No recomendada** — CSS custom bien organizado; Tailwind queda instalado sin uso |
| Unificar las policies permisivas duplicadas (advisor perf) | E5 #13b | **No, deliberado** — cambiar semántica de policies por un warning de perf en tablas de <100 filas no paga el riesgo |
| MAGyP como fuente única / apagar el cron de compras | E5 Duda 1 | **No** — decisión (b): MAGyP automática + Agrochat manda (pisa la provisoria de E1) |
| Avance vs Bolsa en el panel de empresas | PR #34, confirmado E6 #4 | **Descartado** en esa entrega |
| Backfill Wayback de `compras` | 19/07, confirmado E6 | **Descartado — NO reintentar** (0 capturas) |
| Automatizar PAS (BCBA) | E6 #2 | **Descartado** — Cloudflare 403 desde 2 IPs distintas; respaldo = mail (A3) |
| X/medios/Telegram para compras netas BCRA | research P3 | **Descartado** para automatizar — la API v4 tiene el dato oficial |
| BCR-prosa / dataPORTUARIA / CKAN para camiones | research P4 | **Descartados** — SAGyP es la fuente |
| Cloudflare Workers como hosting | E5 hosting | **Descartado por ahora** (el adapter no soporta el Node middleware que `proxy.ts` necesita) — re-evaluar en ~6 meses |
| `arbitrajes-table.tsx` como código muerto | semilla E3 | **Falso** — es el wrapper server de `arbitrajes-editable` |
| Borrar `calendario_informes` (0 filas) | E1 Duda 3 | **No** — se conserva como base del ítem 21/MP4 |
| `cierres-panel.tsx` huérfano | E4 | **Intencional**, documentado — no tocar |
| Leaked password protection ya | E5 #13c → sesión 22/07 | **Diferido a propósito** (requiere Supabase Pro $25/mes; plan Free confirmado) — solo vive como A8 |
| C11/P7 — vista productor + PWA | Sesión 24/07 | **Descartado** — Lautaro: "ninguno de los dos desarrollos me interesa" (ni la vista simplificada ni la PWA instalable) |
| C12/P8 — feed A3 histórico intradiario (+ C17, gráficos intradía que dependían de esto) | Sesión 24/07 | **Descartado** — Lautaro: "lo descarto" |
| C16/P12 — scoring de clientes | Sesión 24/07 | **Descartado** — Lautaro: "tampoco me interesa, descartalo" |

## 6. Prompts de corrección por lote (autocontenidos, estilo PLAN_AUDITORIA)

> Cada uno se pega en una sesión nueva. Reglas transversales de siempre: rama desde `main`
> actualizado · 1 PR por lote, base `main`, draft hasta verificado · `npm run lint` + `npx tsc
> --noEmit` + `npm run build` (+ `npm test`) antes de pushear · doc de sesión + tachar el ítem en el
> backlog maestro (`auditoria/E7-sintesis.md` §4) al cerrar · Next.js 16 con breaking changes (leer
> `node_modules/next/dist/docs/`) · no suponer: dudas → AskUserQuestion.

### L1 — Partir `market.ts` + util única de mes/posición (E4 #10 + #11)

```text
Ejecutá el lote L1 del backlog maestro (docs/auditoria/E7-sintesis.md §4; leé antes ESTADO.md y
docs/auditoria/E4-codigo.md §A y §B — ahí está el diseño ya aprobado). Rama claude/lote-l1-market
desde main. Es REFACTOR PURO: cero cambios de comportamiento, cero fórmulas tocadas.
PARTE 1 — market.ts (546 líneas, 8 responsabilidades) → src/lib/market/{http,types,tickers,fuentes,
cinta,dolar-futuro,dolar-linked,volumen,lecaps}.ts según el §A EXACTO del informe E4, con
src/lib/market.ts como FACHADA de re-export (los 11 imports existentes de "@/lib/market" no se
tocan; getMaeOficial NO se re-exporta — es interno). Resolvé las 3 notas "Fase B" moviendo el parser
de tickers a tickers.ts; la nota "TIR pendiente" de LECAPs queda documentada en lecaps.ts (la TIR es
el backlog C13, no de este lote).
PARTE 2 — util única de mes/posición: extender src/lib/dates.ts con MESES_ES, mesIndice,
parsePosicion, vencKeyDePosicion, vtoDePosicion, posicionDeFecha, hoyVencKey y migrar los 9
call-sites de la tabla §B de E4 (curva.ts, futuros.ts, derivadas.ts, market/tickers.ts,
lineup/embarque.ts, graficos-client.tsx, periodo-panel.tsx, calc-fijar.tsx, negociado-chart.tsx).
MONTH_LETTER (bonos AR) y EN2ES/EN_IDX (monitor-mercados, meses en inglés) quedan FUERA — resuelven
otro problema. OJO: mantener la diferencia semántica intencional de filtro DISPO (futuros sí, curva
no) — que quede como parámetro explícito, no como copia.
CRITERIOS DE ACEPTACIÓN: (1) los 91+ tests existentes pasan SIN modificar sus expects; (2) sumá
tests de paridad de la util nueva reusando los 39 casos que E2 corrió (transcriptos en la ficha
transversal de E2-formulas-fichas.md); (3) `git grep "@/lib/market"` muestra los mismos 11
importadores; (4) diff de HTML servido en /granos, /dolar y / (home) idéntico byte a byte corriendo
local con datos reales (NODE_USE_ENV_PROXY=1) antes vs después — guardá la evidencia en el doc de
sesión; (5) lint/tsc/build/test verdes. PR draft base main; doc de sesión + tachar D4 en el backlog
maestro.
```

### L2 — Motor de gráfico SVG compartido (E4 #14)

```text
Ejecutá el lote L2 del backlog maestro (docs/auditoria/E7-sintesis.md §4; leé antes ESTADO.md y el
hallazgo #14 de docs/auditoria/E4-codigo.md). Rama claude/lote-l2-chart-engine desde main.
REFACTOR PURO de UI: cero cambios visuales ni de datos.
ALCANCE: evolucion-chart.tsx, compras/negociado-chart.tsx y dolar-futuro-chart.tsx reimplementan
cada uno constantes de tamaño/padding, escalas X/Y, yTicks, algoritmo de "punto más cercano" del
crosshair (onPointerMove/onPointerLeave) y tooltip por %. Extraé: hook useCrosshair(puntos, W, H,
pad) + componente base SvgLineChartBase parametrizado (children/slots para lo específico: gradiente
de área, series múltiples, tabla). Los 3 charts pasan a usarlos. NO tocar spread-chart.tsx (usa
recharts, patrón distinto) ni ChartMarca/ChartTabla (ya deduplicados).
CRITERIOS DE ACEPTACIÓN: (1) screenshots antes/después por chart (claro+oscuro, desktop+390px) sin
diferencia visual — Playwright con /opt/pw-browsers/chromium, datos reales; (2) el crosshair y el
tooltip se comportan igual (probar hover en puntos extremos y series con huecos); (3) ningún chart
nuevo de líneas SVG debería volver a copiar el motor — dejá un comentario-guía en el componente
base; (4) lint/tsc/build/test verdes. PR draft base main; doc de sesión + tachar D6 en el backlog
maestro. NOTA: si este lote corre antes que P2 (variación semanal USD), avisale a la sesión de P2
que su chart nuevo DEBE usar SvgLineChartBase.
```

### L3 — `noUncheckedIndexedAccess` (E4 #13)

```text
Ejecutá el lote L3 del backlog maestro (docs/auditoria/E7-sintesis.md §4; leé antes ESTADO.md y el
hallazgo #13 de docs/auditoria/E4-codigo.md). Rama claude/lote-l3-nuia desde main.
OBJETIVO: prender "noUncheckedIndexedAccess": true en tsconfig.json y sanear los ~152 errores en 32
archivos que E4 midió con una corrida real (si L1 ya corrió, serán menos — re-medí primero).
ESTRATEGIA en 2 tandas dentro del mismo PR: (1) los 3 archivos concentrados (calendario.ts 25,
graficos-client.tsx 14, evolucion-chart.tsx 14 ≈ 1/3 del total); (2) el resto disperso (1-5 por
archivo). REGLAS: el fix por defecto es el guard explícito (if (!x) …/?? fallback) que respete la
degradación existente — NUNCA el operador ! salvo invariante obvio y comentado en el mismo renglón;
prohibido cambiar comportamiento: si un guard nuevo cambia un resultado (antes crasheaba o daba
undefined silencioso), anotalo en el doc de sesión como bug latente encontrado. Los .match()[1] y
arr[i] de parsers son los candidatos a bug real — prestales atención especial.
CRITERIOS DE ACEPTACIÓN: (1) tsc limpio con la flag prendida EN el tsconfig.json real; (2) los 91+
tests pasan sin tocar expects; (3) build y páginas clave (/, /granos, /dolar, /graficos,
/produccion) renderizan igual con datos reales; (4) lista en el doc de sesión de todo lugar donde el
saneo reveló un bug latente (aunque sea "ninguno"). PR draft base main; doc de sesión + tachar D5.
```

### L4 — Calibración de parámetros de mesa (E2 r3 + r4 + r9b + roster E5)

```text
Ejecutá el lote L4 del backlog maestro (docs/auditoria/E7-sintesis.md §4; leé antes ESTADO.md,
docs/auditoria/E2-formulas.md (preguntas 3, 4 y 9b + respuestas) y los archivos con los parámetros
marcados PROVISORIOS: src/lib/lineup/cobertura.ts y src/lib/lineup/mesa_calor.ts). Rama
claude/lote-l4-calibracion desde main. REGLA CENTRAL: los valores los define Lautaro — este lote es
una entrevista estructurada + implementación de SUS números, no una calibración estadística propia.
PASO 1 (AskUserQuestion, con el efecto numérico de cada opción calculado con datos REALES del día):
(a) umbrales de cobertura 0,7/1,3 + mínimo 5.000 t + cortes de intensidad 60k-720k — mostrale qué
señal da HOY cada producto con los valores actuales y qué cambiaría con alternativas; incluí la
asimetría señalada por E2 (el mínimo de 5.000 t solo protege el lado alcista — ¿mínimo bajista
también?); (b) parámetros del índice MESA: pesos 0,35/0,30/0,35, bandas 80/60/40/20, umbral de
dirección 32.500 t, K=10 días, y los rindes de equivalente poroto 0,745 harina / 0,19 aceite
(mostrale la sensibilidad: en 10.000 t de aceite, 0,19→0,185 mueve ~1.400 t); (c) comisiones de
estrategias del catálogo (25 USD/ctto, IVA, tamaño de contrato — ESTRATEGIAS_CATALOGO.md) — ¿se
implementan en calc-estrategias reusando costos.ts, y con qué ejemplo numérico suyo?; (d) roster de
exportadores (shippers.ts): proponele el chequeo de erosión "share de OTROS > X% = aviso" y que fije
X.
PASO 2 (solo tras sus respuestas): aplicar los valores confirmados, SACAR las marcas "PROVISORIO"
del código reemplazándolas por un comentario "calibrado por Lautaro AAAA-MM-DD", actualizar los
tests afectados (mesa_calor/estacional tienen fixtures) con los valores nuevos COMO NUEVOS FIXTURES
aprobados, implementar comisiones si dio el OK (con su ejemplo como test), y el chequeo de erosión
del roster (en el propio getEmpresas o en el healthcheck — proponé el lugar).
CRITERIOS DE ACEPTACIÓN: cada valor cambiado tiene la decisión citada en el doc de sesión; /comercio/
temperatura y /empresas verificadas en navegador con datos reales antes/después (las señales pueden
cambiar — documentar el antes/después es parte del entregable); lint/tsc/build/test verdes. PR draft
base main; doc de sesión + tachar D2. Si Lautaro contesta "quedan como están", el lote cierra igual:
se saca PROVISORIO y se documenta que los validó.
```

### L5 — DEA-SAGyP: destrabar la fuente (E5 #8, incidente abierto)

```text
Ejecutá el lote L5 del backlog maestro (docs/auditoria/E7-sintesis.md §4; leé antes ESTADO.md,
el hallazgo #8 de docs/auditoria/E5-infra.md y el § Continuación de
docs/sesiones/2026-07-21-auditoria-e5-infra.md). Rama claude/lote-l5-dea desde main.
SITUACIÓN: datosestimaciones.magyp.gob.ar no acepta conexiones ni desde GitHub Actions (ConnectTimeout
4/4) ni desde la Edge Function dea-fetch en sa-east-1 (tcp connect error, timeout 240s) — el remedio
que funcionó para ISA acá NO alcanzó. El dato DEA está clavado (verificá la fecha real con SQL al
arrancar). Healthcheck (9d) + alertas ya avisan; este lote va por la fuente.
FASE RESEARCH (con requests reales, sin construir hasta cerrar con Lautaro): (a) ¿el bloqueo es por
IP de datacenter en general? probá el POST del CSV desde este sandbox y documentá el resultado;
(b) rutas alternativas al MISMO dato oficial: los PDFs mensuales de DEA (?mes=, ya identificados en
la sesión C del 12/07 como backfill), otra URL/subdominio de MAGyP que sirva el mismo CSV, o el
dataset en datos.gob.ar/CKAN si reapareció; (c) relay barato fuera de datacenters conocidos (ej.
Cloudflare Worker gratis con IP distinta — probá si MAGyP le responde; un worker de 20 líneas que
solo proxya ese POST); (d) último recurso: carga semi-manual (Lautaro baja el CSV del navegador y lo
sube por /admin/datos con una pestaña nueva — patrón uploader existente). Armá la comparativa
(fiabilidad · esfuerzo · mantenimiento) y presentásela con AskUserQuestion.
FASE FIX (tras su OK): implementar la opción elegida reusando el pipeline actual (ingest-dea.mjs
parsea/upsertea igual — solo cambia CÓMO llega el CSV); si es relay, el secreto/URL va en secrets de
Actions, nunca al repo; guard anti falso-verde intacto; probar end-to-end con dispatch al mergear y
verificar que estimaciones_produccion DEA avanza de fecha. Si NADA destraba la fuente, documentar el
cierre honesto (dato DEA discontinuado + quitarlo del comparador con sello claro) — que lo decida
Lautaro, no el silencio.
CRITERIOS DE ACEPTACIÓN: dato DEA fresco en la base (o decisión explícita de descarte), healthcheck
verde con el umbral que corresponda, doc de sesión con TODOS los intentos y sus resultados (para que
nadie re-pruebe caminos muertos). PR draft base main + tachar D1.
```

### L6 — Robustez de ingestas v2 (E5 → E7)

```text
Ejecutá el lote L6 del backlog maestro (docs/auditoria/E7-sintesis.md §4; leé antes ESTADO.md,
docs/auditoria/E5-infra.md Anexo A completo y su fase 2 — el camino DIARIO ya quedó cubierto; este
lote cierra lo que quedó). Rama claude/lote-l6-ingestas-v2 desde main.
ALCANCE (3 bloques):
1) FALSO-VERDE RESTANTE: barrer los caminos del Anexo A que la fase 2 de E5 NO cubrió — en
   particular los modos backfill/dispatch (caminos 1, 3, 5, 6, 8, 13, 15, 19, 20 del anexo: "backfill
   con parser roto y 0 filas = verde"). Regla uniforme: en modo backfill, N snapshots pedidos con 0
   filas parseadas = exit 1 (el patrón ya aplicado a compras en E5); json shape inesperado = error
   tipado, no []. El camino 20 (guard daily muerto de la Edge lineup-ingest) se resuelve borrando la
   capa redundante o activándola de verdad — elegí y documentá.
2) CALENDARIO DESDE EL ICS DE NASS: reemplazar los arrays hardcodeados 2026 de src/lib/calendario.ts
   (WASDE_2026, CROP_PROGRESS_2026, etc.) por generación desde el ICS oficial de NASS + calendarios
   publicados (los endpoints ya están validados en PLAN_CALENDARIO_PRODUCCION.md §8, OJO ICS sin
   TZID y ESMIS 0-indexed). Puede ser generación en build/cron que emite el seed versionado (mejor
   que fetch en runtime: /produccion es ISR y el calendario debe funcionar aunque NASS no responda).
   El check "seed <60 días de futuro" del healthcheck queda como red por si la generación se rompe.
   Si el ICS no cubre algún organismo (CONAB/BCR), su seed sigue a mano — documentar cuál y por qué.
3) ROSTER DE EXPORTADORES: si L4 ya fijó el umbral de erosión, implementarlo acá si aún no está;
   si L4 no corrió, proponer default (share de OTROS >25% en el line-up de la rueda = ::warning +
   fila en healthcheck) y confirmarlo con Lautaro.
CRITERIOS DE ACEPTACIÓN: (1) tabla en el doc de sesión "camino del Anexo A → cómo quedó cerrado"
(los 22 con estado final — completa, para cerrar el tema de una vez); (2) cada guard nuevo probado
con un dry-run forzando el fallo (fixture roto o flag); (3) el calendario generado reproduce 1:1 el
seed 2026 actual (diff vacío) ANTES de agregarle 2027; (4) dispatches de smoke-test documentados
como paso post-merge; (5) lint/tsc/build/test verdes. PR draft base main; doc de sesión + tachar D3.
```

### L7 — Detector de anomalías en ingestas (nuevo, 24/07)

```text
Ejecutá el lote L7 del backlog maestro (docs/auditoria/E7-sintesis.md §4 D7; leé antes ESTADO.md).
Rama claude/lote-l7-anomalias desde main.

PROBLEMA: los chequeos actuales cubren frescura (healthcheck-frescura.mjs, 17 checks) y "0 filas"
(guard anti falso-verde), pero NADIE valida que los VALORES que entran sean plausibles contra la
historia de su propia serie. Bugs reales que pasaron sin detección: semana del 08/07 cargada ÷1000
(export de Agrochat en miles de tn), 529 valores en 6.4e15 (bug de num() con floats), spike de
49,9 Mt en compras, typo de BCR en pellets de girasol que corría el índice de columnas, fila de
trigo 2025/26 duplicada byte-a-byte de 2024/25 en el PAS.

ALCANCE:
1) LIB PURA `src/lib/anomalias.ts` (mismo patrón que parse-dea.ts / capacidad-modelo.ts: sin
   server-only, testeable, importable desde los .mjs — Node 22 importa .ts directo, ya se hace en
   cargar-compras.mjs e ingest-noticias.mjs). Chequeos, cada uno atado a un bug real de arriba:
   a) SALTO VS HISTORIA: |x − mediana| / MAD sobre las últimas N obs de ESA serie. Mediana y MAD,
      NO promedio/desvío estándar (un solo outlier los destruye — por eso el 6.4e15 no se veía).
   b) ORDEN DE MAGNITUD: ratio contra la mediana ≈ 1000, 1/1000, 100, 1/100 → error de unidad, no
      dato raro. Casi sin falsos positivos. Agarra el ÷1000 de Agrochat.
   c) MONOTONÍA CON ALERTA: un acumulado no puede bajar. HOY la matview lo clampea EN SILENCIO —
      ese silencio es lo que dejó pasar el ÷1000 días enteros. El clamp se mantiene (para que el
      panel no muestre disparates) pero además AVISA.
   d) IDENTIDADES CONTABLES: total = suma de partes; zona = producto = total (ya verificado a mano
      en camiones); área × rinde ≈ producción. Si una identidad se rompe no es noticia de mercado,
      es un parser leyendo mal (typo de BCR).
   e) DUPLICADO EXACTO: fila nueva idéntica columna por columna a otro período (trigo PAS).
   f) RANGOS FÍSICAMENTE IMPOSIBLES: rinde soja >10 tn/ha, precio negativo, producción > récord
      histórico × 1,5. Límites duros por campo.
2) CONFIG POR SERIE (tabla TS/JSON, patrón de noticias-reglas.json) con UMBRALES POR TIPO DE DATO,
   NO uno global — es lo que decide si el detector se usa o se ignora:
   · precios diarios: genuinamente volátiles (un WASDE mueve Chicago 5%) → umbral generoso, solo
     agarra errores groseros de unidad; · series acumuladas (compras, DJVE): casi monótonas →
   umbral estricto + monotonía dura; · estimaciones de producción: se mueven poco entre vintages →
   estricto; · conteos (camiones, buques): fuertemente estacionales → comparar contra el mismo
   período de años anteriores, NO contra el promedio anual (reusar la lógica de percentiles
   estacionales que ya existe en estacional.ts).
3) CABLEADO, con severidad distinta por origen:
   · INGESTAS AUTOMÁTICAS (crons): corre DESPUÉS del upsert y AVISA por mail (infra ya existe:
     scripts/alerta-mail.mjs). NO bloquea — bloquear por falso positivo pierde el dato del día y el
     cron no reintenta.
   · UPLOADERS MANUALES (/admin/datos): corre en la previsualización y BLOQUEA con casilla
     "forzar" — ahí Lautaro está mirando la pantalla y puede confirmar. Es exactamente el patrón
     del guard de unidades que ya tiene el uploader de compras: EXTENDERLO, no duplicarlo.

CALIBRACIÓN (el paso que hace o rompe este lote — no saltearlo): correr el detector RETROACTIVO
sobre todo el histórico de cada tabla y medir DOS cosas, ambas en el doc de sesión:
(1) ¿agarra los bugs conocidos? (la semana ÷1000 está documentada en ESTADO.md con sus 30 filas;
    el spike de 49,9 Mt y los valores >1e9 también) — si no los agarra, el umbral está flojo;
(2) ¿cuántas alertas por mes hubiera tirado sobre datos SANOS? Si son más de 1-2/mes, los umbrales
    están demasiado estrictos: se aflojan hasta llegar ahí. Un detector que grita se ignora, y un
    detector ignorado es peor que no tenerlo.

FUERA DE ALCANCE (a propósito): tabla nueva, cron nuevo, UI nueva, y cualquier modelo de machine
learning — con chequeos univariados por serie se cubre el 90% a una fracción de la complejidad
(conversación con Lautaro del 24/07). Si más adelante hace falta, se evalúa aparte.

CRITERIOS DE ACEPTACIÓN: (1) tests con fixtures de los bugs REALES (no sintéticos: la semana ÷1000,
el typo de girasol, la fila duplicada del PAS); (2) tabla de calibración en el doc de sesión con
las dos métricas de arriba; (3) un dry-run de cada cableado forzando el fallo; (4) lint/tsc/build/
test verdes. PR draft base main; doc de sesión + tachar D7.
```

---

## 7. Registro de decisiones de Lautaro (post-síntesis)

> Se van asentando acá a medida que Lautaro las responde (en bloques, como en cada etapa), para que
> queden en el repo y no dependan del chat. Cada decisión actualiza también su ítem en el §4.

### Bloque 1 — arranque + research listos (22/07/2026)

| Decisión | Respuesta de Lautaro | Efecto en el backlog |
|---|---|---|
| **Orden de arranque** | **Orden sugerido** (§4 "Orden sugerido"): A1+A2 manuales → MP1 → L5 (DEA) → MP2 → P3/P4 | Se mantiene el orden del §4 tal cual |
| **P3 — compras netas BCRA** (C4/A5) | **Automático (API v4 var 78) + carga manual del día** en /admin (patrón "color de la rueda") | C4: build = ingesta BCRA v4 para la historia/rezago + campo admin para el dato del día. Queda desbloqueado (ya no espera respuesta) |
| **P4 — visibilidad** (C5/A5) | **Público** (como la DJVE, no solo-mesa) | C5: el panel de camiones va público en /comercio, sin `requireAdmin` |
| **P4 — backfill** (C5/A5) | **Desde 2020 en adelante** (no todo 2018→, no solo 2 años) | C5: backfill de los PDFs mensuales de camiones 2020→hoy |

**Con esto A5 queda respondido** → C4 (P3) y C5 (P4) dejan de estar bloqueados: se pueden ejecutar
cuando les toque en el orden.

### Bloque 2 — quick wins + un dato a validar (22/07/2026)

| Decisión | Respuesta de Lautaro | Efecto en el backlog |
|---|---|---|
| **H12** — overflow mobile de /graficos | **No por ahora** (herramienta de mesa, se usa en desktop) | B1 sale del backlog activo → queda anotado como descartado (revisable si /graficos se usa en celular) |
| **Girasol/sorgo** en "Negocios de planta" | **Sí, sumarlos** | B3 confirmado como quick win activo |
| **D6** — montos "VIEJA" enormes en /comercio/empresas | **Investigado + fix elegido:** era bug real (la columna sumaba 17 campañas 2010→2025 bajo la etiqueta de una sola) → **VIEJA = solo la campaña anterior** (camp_ini = actual−1) | B2 = fix en `empresas.ts` → **PR #62** (maíz 395,3→29,0 Mt, soja 108,9→12,1 Mt; lint/tsc/build ✅) |
| **Uploader** /admin/datos probado logueado | **No todavía** | A6 sigue como pendiente manual: probarlo con el próximo export de Agrochat |

### Bloque 3 — prioridad fina de features + lotes técnicos (22/07/2026)

| Decisión | Respuesta de Lautaro | Efecto en el backlog |
|---|---|---|
| **Features chicas** (P5 vista por grano · P1 monitor · P2 USD semanal · extras puertos) | **Ninguna priorizada ahora** — quedan registradas, las evalúa por separado más adelante | C6/C7/C8/C9 quedan en cola sin orden fijo; se retoman cuando Lautaro las evalúe |
| **Refactors L1-L3 / L6** | **Intercalados antes de tocar lo mismo** | L1 antes de P2/P6, L2 antes de P2, L3 después de L1 (ya reflejado en las dependencias del §4) |
| **L4 calibración de mesa** | **Pronto — se sienta con los números** | L4 sube en prioridad: se agenda entre lo primero tras el arranque; el prompt le muestra el efecto de cada valor con datos del día |

**Orden actualizado tras los 3 bloques:** A1+A2 (manuales) → MP1 → L5 (DEA) → MP2 → **L4
(calibración, pronto)** → C4/C5 (P3/P4, ya desbloqueados) → MP4. Los refactors L1/L2/L3 se
intercalan cuando toque el código que comparten (antes de P2/P6). Las features chicas (P5/P1/P2/
extras puertos) esperan a que Lautaro las evalúe una por una. B2 (D6) lo investiga Claude cuando
haya una ventana; B3 (girasol/sorgo) entra como quick win.

### Bloque 4 — L5 destrabado (23/07/2026)

| Decisión | Respuesta de Lautaro | Efecto en el backlog |
|---|---|---|
| **L5 — cómo destrabar DEA** (semi-manual · probar Cloudflare Worker · las dos · descartar) | **Carga semi-manual** (mismo patrón que el uploader de compras/Agrochat) — elegida directo, sin pasar por la prueba del Worker | D1/L5 cerrado. Código: `src/lib/parse-dea.ts` + migración `admin_upsert_estimaciones` (aplicada) + sección nueva en `/admin/datos` + `ingest-estimaciones-ar.yml` con DEA dispatch-only. Detalle: [`sesiones/2026-07-23-lote-l5-dea-carga-manual.md`](../sesiones/2026-07-23-lote-l5-dea-carga-manual.md) |

**Siguiente en el orden:** MP2 (informe semanal).

### Bloque 5 — B3/L4/C5 ejecutados, pivote de fuente en camiones (23/07/2026)

| Decisión | Respuesta de Lautoro | Efecto en el backlog |
|---|---|---|
| **Umbral de cobertura** (L4) — el fijo 0,7/1,3 disparaba señal 74-95% de los días (SQL real) | **Percentiles P25/P75 por producto** (mismo criterio que el índice MESA) | `cobertura.ts` recalibrado; `empresas.ts`/`semaforo.ts` lo consumen. B2/D2 cerrado |
| **Índice MESA** (pesos/bandas/rindes) — auditado, ¿tiene sentido? | **Dejarlos como están** (diseño ya sólido; sin backtesting no se puede afirmar que otro valor sea mejor) | Sin cambios en `mesa_calor.ts`; queda anotado si algún día se hace el backtesting |
| **Roster de exportadores** — umbral de aviso de "OTROS" | **15%** (hoy 2,6% real) | Chequeo nuevo en `healthcheck-frescura.mjs`, `::warning` sin fallar el workflow |
| **Comisiones de estrategias** — ¿qué tarifario? | **A3/Cocos** (reusar `costos.ts`), con **toggle** para calcular con o sin costos | Toggle en `calc-estrategias.tsx`; monto gravable = prima/strike × cttos (simplificación documentada, sin tamaño de contrato todavía) |
| **Camiones — módulo nuevo propuesto por Lautoro**: cruzar barcos (line-up) vs camiones, no solo un panel aislado | **Sí** — "si están los barcos y los camiones no llegan debería ser alcista, y viceversa" | Research nuevo `negocio/09` → señal barcos-vs-camiones (diferencial de percentiles), integrada a C5 en vez de un proyecto aparte |
| **Fuente de camiones** — el plan original apuntaba a SAGyP/MAGyP | **Williams Entregas** ("la fuente de camiones por excelencia"), Lautoro aportó 5 CSV reales 2018-2026 vía su export de Agrochat (zona total + zona por maíz/soja/trigo + localidades) | Pivote de arquitectura a mitad del build C5: cero SAGyP, todo carga manual — ver `sesiones/2026-07-23-l4-c5-camiones.md` |
| **Ingesta diaria de camiones hacia adelante** | **Botón manual en `/admin/datos`** (mismo patrón que compras/Agrochat) — confirmado "y no depender más de MAGyP" | Uploader + prompt nuevo (`prompt-camiones.tsx`) en vez de un cron automático |
| **Visibilidad de la señal barcos-vs-camiones** | Datos crudos públicos, **señal solo mesa** | Página `/comercio/camiones` pública, bloque de señal gateado por `esAdmin` |
| **Alcance zonal v1** | Nacional + Gran Rosario + Bahía Blanca alcanza (no sumar Necochén/Quequén todavía) | Sin cambios a `zonas.ts` |
| **Timing del índice MESA** | En fases: señal en el panel de camiones ahora, evaluar sumarla al índice recién después de que L4 asiente | `temperatura.ts`/`mesa_calor.ts` sin tocar en este lote |
| **C4 (compras BCRA)** — ¿arrancar ya que la API sigue viva? | No fue preguntado directamente, pero se descubrió que la sesión de MP1 ya creó `compras_bcra` en la base real | C4 diferido hasta que la rama de MP1 mergee (evitar pisarse con su migración/uploader) |

**L5, B3, L4 y C5 quedan CERRADOS** (backlog §4 actualizado arriba). MP1/MP2/L1 también cerraron en
sesiones paralelas el mismo día (ver `ESTADO.md`). Próximo en el orden: retomar C4 (compras BCRA)
ahora que MP1 ya mergeó.

### Bloque 6 — repaso del bloque A de manuales (24/07/2026)

| Decisión | Respuesta de Lautaro | Efecto en el backlog |
|---|---|---|
| **A4** — borrar ramas remotas mergeadas | **"Eliminalo y no tenemos ramas"** | Verificado con `git ls-remote --heads origin`: no queda ninguna rama remota salvo `main` — ya estaban limpias, nada que borrar. A4 cerrado |
| **A1** — estado del login/dominio | **"Se está validando por Vercel el dominio"** | Sigue abierto (no depende de una sesión de código) — anotado como en curso, un paso más cerca de retomar la verificación de marca de Google |
| **A6** — qué probar del uploader | **"Más específico qué debo probar"** | A6 detallado en el ítem de arriba: son 7 secciones hoy (creció desde el PR #44), con el paso a paso de cada una |
| **A8** — leaked password protection | **"Descartalo por ahora"** | Cerrado sin acción — se retoma solo si algún día se upgradea Supabase a Pro |

### Bloque 7 — A6 probado en vivo: 1 bug real + feature nueva + bloqueo de acceso (24/07/2026)

| Qué pasó | Resultado | Efecto en el backlog |
|---|---|---|
| Lautoro probó "Datos del día" con un texto real | Guardó bien | Confirmado — ver checklist de A6 |
| Pedido nuevo: historial editable hasta que el informe lo toma | Construido (14 días, guard también server-side) | Sin migración nueva, PR #77 |
| Lautoro probó DEA-SAGyP con el CSV real (~11,5 MB) | `ERR_CONNECTION_REFUSED` en "1 · Previsualizar" | Bug real: límite de payload de Server Actions en Vercel (~4,5 MB). Arreglado moviendo el parseo al navegador (PR #77) — **falta confirmar el fix con un reintento real** |
| Lautoro no podía loguearse, pidió la contraseña de su cuenta | No existe (Google OAuth, sin password propia) | Se le explicó el flujo; no era eso |
| Reintentó Google, tiraba conexión rechazada en `localhost:3000` | Diagnosticado por logs de Supabase Auth: navegador apuntando a una dirección de desarrollo que no existe, no un bug del sitio | Se le indicó escribir `rofoagro-research-web.vercel.app` a mano; sesión cortada sin confirmar si entró |

**A6 sigue en curso**: 1/7 secciones confirmadas (Datos del día), el fix de DEA sin confirmar, 5
secciones sin probar todavía. PR #77 mergeado (docs + historial + fix de DEA). Checklist completo
de qué falta y cómo probar cada fuente: `ESTADO.md` «Ahora» del 24/07 (esta sesión).

### Bloque 8 — informes v2 + detector de anomalías (24/07/2026)

| Qué se decidió | Resultado | Efecto en el backlog |
|---|---|---|
| Llevar los informes "a otro nivel" con agentes de research + view acumulativo | Plan cerrado y auditado: `PLAN_INFORMES_V2.md` (PR #81, mergeado) | **C18-C22** nuevas (V0→V4); prompts en §9 de ese plan |
| Las 4 preguntas abiertas del plan (§10) | Nota 1-5 en el feedback **SÍ** · semanal se queda en **5 páginas** · COT solo en semanal/view, **no** en el diario · la key gratuita de USDA FAS la registra Lautaro antes de V0 | Incorporadas al plan antes de mergear; queda abierta solo la del modelo de la Routine (Opus hoy, Fable cuando esté disponible) |
| Verificación de las Routines al cerrar el plan | 🚨 **Las 3 disparan y no producen nada** (`informes_generados` vacía; el view del 24/07 no existe) — fallan en silencio, sin mail de error | **C18 (V0) pasa a urgente** y bloquea a las otras 4 |
| ¿Tiene sentido meter machine learning? | Para generar el view **no** (3 filas en `views_mercado`, cero feedback; aun con un año serían ~156 obs. muy correlacionadas). Sí para problemas puntuales sobre los datos de mercado, **más adelante**, y con el scorecard como prerrequisito de medición | Nada se agenda de ML por ahora; se retoma con 3-4 meses de scorecard real |
| De esa charla salió lo que sí conviene ya | **Detector de anomalías en ingestas** (estadística clásica, no ML): valida que los VALORES que entran sean plausibles contra su propia historia — hoy solo se chequea frescura y "0 filas" | **D7 = L7** nueva, prompt completo en §6. Independiente de todo lo demás |

---

## Cierre de la auditoría

Con esta síntesis, la auditoría integral **queda completa**: E1–E7 cerradas, tablero de
`PLAN_AUDITORIA.md` al día. La regla operativa desde acá:

1. **Se prioriza en el §4 de este archivo** (backlog maestro único). `ESTADO.md` conserva su
   protocolo de sesiones y el «Ahora»; su checklist viejo quedó como histórico apuntando acá.
2. Los **prompts de ejecución** viven donde siempre: P1–P12 en `PLAN_BACKLOG.md`, MP1–MP4 en
   `PLAN_INFORMES.md`, L1–L6 acá (§6).
3. Todo pendiente **nuevo** se agrega acá (§4), no en listas paralelas (regla de E6).
