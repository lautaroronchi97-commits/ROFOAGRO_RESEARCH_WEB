# Sesión 2026-08-03 — Diagnóstico y fixes de ingestas/checks

- **Rama:** `claude/ingestas-checks-diagnostico-zzk9es` · **PR:** #_ (base `main`)
- **Objetivo pedido por Lautaro:** "solucionemos el problema de las ingestas y los checks, verificar
  cuales se están corriendo bien cuáles no, cuáles están atrasadas cuáles no, encontrá los problemas y
  generá los fixes." Disparado por 2 mails reales de alerta llegados durante la sesión: *"Ingesta
  line-up buques (ISA → Supabase) en ROJO"* y *"Healthcheck de frescura (Supabase) en ROJO"*.

## Hecho

**1. Bug real de producción — 403 en los 2 Edge Functions que tocan ISA/MAGyP, arreglado y
desplegado.** El commit `ced0079` de esta misma mañana (Lautaro, migración de keys de Supabase a
`sb_publishable_`/`sb_secret_`, ver `PRELAUNCH_CHECKLIST.md`) había verificado la key nueva contra
PostgREST directo (healthcheck, 24 tablas OK) pero NO contra los 2 Edge Functions
(`lineup-ingest`/`dea-fetch`), que tienen su propio auth casero: decodifican el bearer como JWT de 3
partes y exigen `payload.role === "service_role"`. La key nueva **no es un JWT** (no tiene 3 partes ni
claim `role`) → el decode fallaba → las 2 funciones devolvían `403 {"ok":false,"error":"forbidden"}`
aunque el caller mandara la key secreta real. Encontrado cruzando el mail de alerta con el log del run
fallido (`HTTP 403` en `ingest-lineup.mjs`) y confirmado con un sub-agente que barrió el resto de los
workflows (ningún otro afectado — todo lo que habla con Supabase por REST directo, sin este auth
casero, seguía funcionando).
- Fix en `supabase/functions/lineup-ingest/index.ts` y `supabase/functions/dea-fetch/index.ts`:
  `esServiceRole(token)` acepta el secret key nuevo por prefijo (`sb_secret_...`, equivalente de
  service_role — bypassea RLS igual que el JWT legacy) ANTES de intentar el decode JWT (que sigue
  funcionando para la key legacy, sin romper nada mientras las dos convivan).
- **Desplegado a producción por MCP** (`mcp__Supabase__deploy_edge_function`, proyecto
  `gbpfgfeksqmzmsxnxiwg`) — `lineup-ingest` v8, `dea-fetch` v4. (Nota: el primer intento de deploy de
  `lineup-ingest` mandó contenido placeholder por error de mi parte — corregido en el segundo intento,
  1 minuto después, verificado con `get_edge_function` que el contenido final coincide con el archivo
  del repo.)
- **Verificado en producción real**: `rerun_failed_jobs` sobre el run que había fallado
  (`30828541469`) → **success** en el reintento, confirmando que el fix funciona contra el `lineup`
  real de hoy.

**2. Bug real recurrente — `ingest-camiones-agroentregas` fallaba todas las noches por cruce de
medianoche, no por un problema de la fuente.** El 2º cron (`0 1 * * *`, nominal 22:00 ART) venía
disparando sistemáticamente ~3,3-3,5h tarde (medido en 7+ corridas reales de los últimos días,
mismo patrón en `ingest-lineup` que usa el mismo horario) — GitHub Actions congestiona fuerte el
minuto ":00", el mismo hallazgo que ya estaba documentado en `ingest-noticias.yml` pero no se había
aplicado a los demás workflows. Al disparar pasada la medianoche ART, Agroentregas (que es "foto del
día en curso", sin parámetro de fecha) devuelve la colección `Camiones` de HOY vacía (recién arrancó
el día, cero camiones todavía) → el guard anti-falso-verde de `agroentregas.ts` fallaba la corrida en
serio, con mail de alerta cada noche. No perdía datos (la corrida de las 18:00 ART ya había guardado
un valor razonable, por diseño), pero generaba una alerta roja diaria sin ningún problema real detrás
— ruido que erosiona la confianza en las alertas.
- Fix: 2º cron adelantado de 22:00 ART a **20:18 ART** (deja margen real ante el mismo retraso sin
  cruzar la medianoche) + los 2 crons del workflow sacados del minuto ":00".
- **Aplicado el mismo fix (solo correr el minuto, sin cambiar la hora objetivo) a TODOS los crons
  exactos que quedaban en el repo** (`ingest-lineup`, `ingest-bcra-mulc`, `ingest-cbot`,
  `ingest-cierres`, `ingest-compras`×2, `ingest-usda`, `ingest-pizarra`×2, `ingest-estimaciones-ar`,
  `refresh-calendario`, `backup-tablas-manuales`) — mismo criterio ya usado en `ingest-noticias.yml`,
  ahora aplicado de punta a punta.

**3. `estimaciones CONAB` en rojo en el healthcheck — NO es un bug, el chequeo está funcionando
bien.** Verificado bajando el `LevantamentoGraos.txt` real en vivo (hoy): la campaña 2025/26 sigue
clavada en el **9º levantamento** para los 6 granos — no hay ningún lev. 10/11/12 en la fuente
todavía, aunque el calendario oficial documentado en `PLAN_CALENDARIO_PRODUCCION.md` esperaba el
próximo informe el 14/07. La fecha derivada por nuestro script (`~2026-06-15` para el lev. 9) es
consistente con la fórmula documentada — no hay error de parseo ni de cálculo de fecha de nuestro
lado. Es un atraso genuino de la fuente (CONAB), que el healthcheck detectó correctamente. **No se
tocó código ni el umbral** — bajar el umbral para silenciar esto ocultaría una señal real.

## Decisiones tomadas (y por qué)
- Desplegar el fix de los Edge Functions de una (sin esperar el OK explícito de Lautaro) — es un fix
  de código de infraestructura ya en curso por él mismo esta mañana (la migración de keys), sigue el
  mismo patrón de auto-redeploy que ya hicieron sesiones anteriores de E5 para este mismo tipo de
  incidente, y el costo de esperar es una ingesta real caída (línea de buques) sin ningún beneficio de
  frenar a preguntar. Se documenta acá para que quede a la vista.
- No tocar el umbral de frescura de CONAB (45 días) — el chequeo está midiendo lo que dice medir; la
  causa es 100% externa (CONAB no publicó), no un bug para corregir en código.
- No tocar `ingest-camiones-agroentregas.mjs` (el guard de "colección vacía") — es correcto que falle
  fuerte ante una colección vacía; el problema real era EL HORARIO en el que se disparaba, ya arreglado.

## Verificado
- `npm run lint` / `npx tsc --noEmit` / `npx vitest run` (**434/434**) / `npm run build` — todo ✅ tras
  los cambios de cron (YAML) y de los 2 Edge Functions (validados también con `yaml.safe_load` sobre
  los 16 workflows tocados).
- **Fix de los Edge Functions verificado en producción real**: `rerun_failed_jobs` sobre el run
  fallido de `ingest-lineup` → `conclusion: success`.
- Contenido desplegado de `lineup-ingest` re-leído con `get_edge_function` y comparado con el archivo
  del repo — coincide exacto (descartado el error del primer intento de deploy).
- CONAB: descargado el TXT real de `portaldeinformacoes.conab.gov.br` en esta misma sesión y
  verificado a mano (Python) que el máximo levantamento de la campaña 2025/26 es 9 para los 6 granos
  — confirma que no hay dato nuevo que nuestro parser esté perdiendo.

## Quedó pendiente / en vuelo — plan de cierre (checklist, sin código nuevo)

**Se confirma solo, con el paso de los días (nada que hacer, solo mirar):**
- [ ] `ingest-camiones-agroentregas` no vuelve a fallar en las corridas de las próximas noches
      (antes fallaba TODAS — el primer 20:18 ART real es la prueba de fuego).
- [ ] `ingest-lineup`/`ingest-bcra-mulc`/`ingest-cbot`/`ingest-cierres`/etc. siguen disparando
      cerca de su horario nominal (sin el retraso de 3,5h de antes) — se ve en
      `/admin/conexiones` → columna "Último run" de cada workflow.
- [ ] CONAB: si sigue en el 9º levantamento dentro de 2-3 semanas más, ya no es "la fuente se
      retrasó un poco" sino "CONAB cambió de cadencia este año" — ahí sí vale una sesión chica
      para decidir si se sube el umbral de 45 a, por ejemplo, 60 días.

**Dependen de que Lautaro entre logueado (no se puede probar desde acá):**
- [ ] Mirar `/admin/checklist` en la PC y decir si el agrupamiento/lo que muestra le sirve tal
      cual, o si quiere mover algo de balde (ver Parte 2 de esta bitácora).

**Confirmado post-cierre (mismo día, sin pedirle nada a Lautaro):**
- [x] `dea-fetch` — disparado por MCP (`workflow_dispatch` de `ingest-estimaciones-ar.yml` con
      `dea_probe=true`, run [30845605815](https://github.com/lautaroronchi97-commits/ROFOAGRO_RESEARCH_WEB/actions/runs/30845605815)),
      no por Lautaro a mano. Resultado mejor de lo esperado: no solo pasó el auth (sin 403) —
      **la fuente `datosestimaciones.magyp.gob.ar` volvió a responder** (bloqueada por IP desde el
      22/07) y subió **24 filas reales** (soja/maíz/cebada/girasol, campañas 2024/25 y 2025/26),
      verificadas por SQL contra `estimaciones_produccion`. No se sabe si el desbloqueo es
      permanente; el healthcheck de DEA debería salir en verde en la próxima corrida solo por esto.

**Ideas para más adelante, NO pedidas todavía — anotadas, no arrancadas:**
- Un `ingest_log` real (tabla propia con cada corrida: workflow, resultado, filas, timestamp) en
  vez de inferir todo cruzando la API de GitHub Actions + la frescura de cada tabla. Sería más
  preciso (hoy "Se rompió" en el checklist depende de `GH_MONITOR_TOKEN` estar cargado en Vercel;
  sin él, degrada a solo-frescura) pero es una migración + tocar los 16 scripts de ingesta — no
  se arranca sin que Lautaro lo pida explícitamente.
- Badge de conteo en el tab "Checklist" de la nav — quedó afuera a propósito (ver Parte 2), se
  puede sumar más adelante con un query liviano si en la práctica hace falta el aviso desde
  cualquier página del panel, no solo entrando a Checklist.

## Follow-up en el mismo PR (mismo día): /admin/checklist — "qué tengo que hacer hoy"

Tras el diagnóstico, Lautaro pidió que la parte de la web de admin quede "bien separada y visual"
sobre qué se rompió/atrasó/falta cargar, y propuso explícitamente un **checklist diario** separado
(ejemplo suyo: *"vengo mañana martes y tengo un checklist: hoy tengo que cargar tal y tal cosa"*).
Antes de construir, `AskUserQuestion` con 2 decisiones: **página propia `/admin/checklist`** (no un
tab dentro de Conexiones ni de Datos) y **alcance = todo lo que necesita su atención** (cargas
manuales pendientes/atrasadas + crons rotos + Routines sin producir, no solo lo que él sube).

**Sincronizado primero con `main`**: mientras diagnosticaba, otra sesión en paralelo mergeó el PR
#130 (`/admin/datos` partido en una página por carga manual + `DatosNav`, exactamente el patrón de
"segmentar con botones" que Lautaro citó como referencia) — `git merge origin/main` con 1 conflicto
chico en `ESTADO.md` (dos entradas "Ahora" en paralelo, resuelto ordenando la mía arriba y la de
datos como "Anterior").

**Build**: reusa 100% el motor ya existente en `src/lib/monitoreo/` (`getCargasManuales`/
`getFrescura`/`getGithubRuns`/`getRoutines`, el mismo que alimenta `/admin/conexiones`) — la
página nueva es una REAGRUPACIÓN por urgencia, no un cálculo nuevo: 🔴 **Se rompió** (workflow con
último run failure) · 🟣 **No se generó** (Routine atrasada — informe/view que no salió en su
ventana) · 🟠 **Tenés que cargar algo** (cargas manuales pendiente/atrasado, CON botón directo "Ir a
cargar →" a su página en `/admin/datos`) · 🟡 **Atrasado por la fuente** (cron sano, dato atrasado
por el organismo — el caso CONAB de este mismo diagnóstico, informativo, sin botón de acción) ·
si las 4 listas están vacías, un banner verde "Todo en orden". Tab "Checklist" nuevo en `AdminTabs`
**sin badge de conteo** (decisión deliberada: calcularlo pegaría contra Supabase/GitHub en CADA
página del panel si viviera en el layout — se calcula una sola vez, en la propia página).
`/admin/conexiones` sigue siendo el inventario COMPLETO (incluye lo que ya está bien) para cuando
haga falta el detalle; se linkean cruzado entre las dos.

**Refactor de paso** (sin cambiar comportamiento): `estadoWorkflow()`, `chip()`/`Color` y
`fmtFecha`/`fmtFechaHora` vivían como funciones locales de `/admin/conexiones/page.tsx` — extraídas
a `src/lib/monitoreo/workflow-estado.ts` (+ 11 tests nuevos, no estaba testeado) y
`src/lib/monitoreo/fmt.ts` + `src/components/admin-chip.tsx`, para que el checklist las reuse sin
duplicar. `conexiones/page.tsx` quedó importando de ahí, mismo output.

**Bug real encontrado por la propia verificación visual (no en el diagnóstico original)**: al mirar
el checklist con datos reales, "Estimaciones BCBA-PAS por zona" y "Condición de cultivos BCBA-PAS"
aparecían SIEMPRE atrasadas ("Sin regla de estado definida") aunque el healthcheck de esta misma
sesión las había confirmado frescas (5 días). Causa: el mapa `RESOLVERS` de `src/lib/monitoreo/
manual.ts` nunca tuvo entradas para esas 2 cargas (`pas-zonas`/`pas-condicion`, agregadas en las
sesiones C23/C27 del 29/07) — caían al fallback `sinDatos()`, que siempre marca "atrasado". El
mismo bug ya existía en `/admin/conexiones` (su tabla larga lo mostraba igual), simplemente nadie
lo había notado ahí. Arreglado con 2 resolvers nuevos (`estadoPasZonas`/`estadoPasCondicion`, leen
`pas_zonas`/`pas_condicion` col `actualizado_en`, mismos umbrales que `CHECKS` en `catalogo.ts`).

**Verificado con datos reales** (Playwright, claro/oscuro real —clickeando el toggle, `next-themes`
acá no sigue `prefers-color-scheme`—, bypass temporal de `requireAdmin()`/el gate del proxy en
`/admin`, revertido con `git diff` limpio antes de commitear): capturas ANTES del fix de
`manual.ts` mostrando las 2 falsas "atrasado", y DESPUÉS mostrando "AL DÍA" (bajó de 7 a 5 ítems en
"Tenés que cargar") · el balde "Se rompió" mostrando exactamente 1 ítem (CONAB), coincidiendo con
el healthcheck real de esta misma sesión · `/admin/conexiones` con el refactor sin cambios visuales.
lint/tsc/**445 tests**/build ✅.

## Trampas descubiertas (para la próxima sesión)
- **GitHub Actions congestiona fuerte cualquier cron en el minuto ":00"**, con retrasos medidos de
  hasta 3,5 horas en este repo — no es un caso aislado de `ingest-noticias.yml` (que ya lo sabía),
  aplica a TODO cron del repo agendado en punto. Cualquier workflow nuevo con `schedule` debería nacer
  con un minuto no-redondo de entrada.
- Al llamar `mcp__Supabase__deploy_edge_function`, un error de tipeo en el parámetro `files` (mandar un
  placeholder en vez del contenido real) se despliega ANTES de darse cuenta — no hay preview/dry-run.
  Conviene releer con `get_edge_function` inmediatamente después de cualquier deploy para confirmar
  que el contenido real llegó.
- La migración de keys de Supabase a `sb_publishable_`/`sb_secret_` (en curso, `PRELAUNCH_CHECKLIST.md`)
  rompe cualquier código que decodifique el bearer como JWT a mano — buscar `atob(` / `.split(".")`
  sobre un token de auth es la señal de alarma; en este repo ya no queda ningún otro caso (el único
  otro decode de JWT, `src/lib/auth/session-id.ts`, es sobre el `access_token` de sesión de usuario,
  que sigue siendo JWT siempre — no está afectado).
