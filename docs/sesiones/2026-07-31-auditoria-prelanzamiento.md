# Sesión 2026-07-31 — Auditoría pre-lanzamiento: seguridad (C29)

- **Rama:** `claude/development-guidelines-k9firc` · **PR:** #_ (base `main`)
- **Objetivo pedido por Lautaro:** auditar el proyecto contra el checklist de pre-lanzamiento de
  sus 3 informes de research (por partes, en Plan Mode, sin tocar nada hasta aprobar el plan),
  empezando por **seguridad**: RLS en todas las tablas, service_role key no expuesta en el
  cliente, `/security-review`. Para cada punto: qué se encontró / gravedad / plan de corrección
  archivo por archivo / qué podría romperse. La sesión arrancó además con sus 5 reglas duras de
  trabajo (esquema/API con aviso, fórmulas con diff aprobado, lint+tests, un fix por vez, frenar
  ante fallas), que también había que persistir.

## Hecho

- **Auditoría de seguridad completa en solo-lectura** contra la base real
  (`gbpfgfeksqmzmsxnxiwg`) y el código: RLS/policies/grants tabla por tabla (SQL a
  `pg_policies`/`pg_class`+`aclexplode`), advisors de Supabase, `security_invoker` de las
  vistas, exposición de claves en `src/`, `.env` en git, callers de cada RPC.
- **Fase 0 (metodología, la tarea original de esta rama):** las 5 reglas duras persistidas en
  `docs/CONTEXTO.md` § "Cómo trabajar con Lautaro" · protocolo de `docs/ESTADO.md` ahora incluye
  `npx vitest run` en el checklist pre-push (el CI ya lo corría, el protocolo escrito no lo
  decía) · **`docs/PRELAUNCH_CHECKLIST.md`** nuevo: los 3 informes consolidados en un checklist
  maestro con el estado real (lo cubierto por E1→E7 tildado con evidencia; pendientes de código
  vs pasos manuales 🖐 separados) · registrado como **C29** en `auditoria/E7-sintesis.md` §4.
- **3 migraciones versionadas SIN aplicar** (regla: esquema solo con OK explícito):
  - `20260731170000_s1_cierre_lineup_anon.sql` — **S1**: drop de `anon_select_lineup` + revoke
    de `lineup`, sus 5 vistas y las 2 matviews de densidad a anon/authenticated.
  - `20260731170500_s2_revoke_refresh_compras_avance.sql` — **S2**: revoke del EXECUTE default.
  - `20260731171000_s3_limpieza_execute_definer.sql` — **S3**: limpieza de EXECUTE de anon en
    10 RPC (re-grant explícito a authenticated+service_role; `is_admin()` conserva
    authenticated; trigger functions excluidas).

## Hallazgos de la auditoría (detalle en `PRELAUNCH_CHECKLIST.md` fase S)

- **Verificado OK**: RLS activo en 24/24 tablas con policies correctas (sensibles cerradas,
  públicas por decisión) · service key `server-only` sin `NEXT_PUBLIC_`, único uso extra en un
  Server Component (URLs firmadas de Storage, 1 h) · sin `.env` commiteado · las 7 matviews de
  mesa siguen revocadas (E5) · headers/INFORME_TOKEN/guards ya auditados en E5.
- **S1 (importante-alto)**: `lineup` (~494k filas, insumo de las páginas solo-mesa) + 5 vistas +
  2 matviews de densidad legibles por anon — el remanente del cierre que E1 difirió "al prender
  el login" (prendido el 27/07, cierre a medias: solo las 7 matviews). Riesgo del fix: cero en
  producción (la web lee con service key); en local/preview sin service key `/comercio/*`
  degrada a vacío (comportamiento ya aceptado, `src/lib/camiones/camiones.ts`).
- **S2 (importante)**: `refresh_compras_avance()` ejecutable por anon vía RPC (EXECUTE default a
  PUBLIC nunca revocado — misma clase que `ingest_cierres_cem` de E5) → spam del REFRESH.
- **S3 (puede esperar)**: EXECUTE de anon sobrante en ~10 definer functions con guard interno;
  ningún caller real usa anon (verificado archivo por archivo).
- **S4 (decisión de plan)**: leaked password protection sigue deshabilitada (ya diferida el
  22/07; requiere Supabase Pro). De paso quedó marcado el **crítico abierto de la parte
  "backups"**: plan Free = sin backup automático de la base → decisión Supabase Pro (US$25/mes
  resuelve los dos).

## Decisiones tomadas (y por qué)

- **`/security-review` no corrió**: el comando revisa el diff pendiente de la rama y la rama
  estaba limpia e idéntica a `main` (además el clon no tiene `origin/HEAD`, que su preámbulo
  necesita). Se reemplazó por la revisión manual proyecto-completo (más profunda que un diff
  vacío) y quedó en el checklist correrlo sobre el diff de cada PR de fixes.
- **`is_admin()` conserva EXECUTE de authenticated** en S3: las policies RLS la evalúan con el
  rol del que consulta — revocarla rompería TODAS las tablas gateadas. Documentado en la propia
  migración.
- **Trigger functions (`handle_new_user`, `protect_profile_fields`) excluidas de S3**: PostgREST
  no puede invocarlas (devuelven `trigger`) y tocar sus grants arriesga el alta de usuarios por
  un beneficio solo cosmético (silenciar un advisor).
- **S3 re-otorga authenticated explícito** en cada función: al revocar PUBLIC se pierde el
  acceso implícito que authenticated tenía por el default — sin el grant explícito, el panel
  `/admin` y la sesión única morían en silencio.
- El checklist maestro va en `docs/PRELAUNCH_CHECKLIST.md` referenciado desde el backlog (C29),
  NO importado en `CLAUDE.md` — importarlo cargaría ~200 líneas a todas las sesiones futuras.

## Verificado

- lint ✅ · `npx tsc --noEmit` ✅ · **426/426 tests** ✅ · `npm run build` ✅ (el diff es docs+SQL,
  pero el protocolo es el protocolo).
- La auditoría en sí: policies/grants leídos de la base real (no de las migraciones), advisors
  corridos, callers de cada RPC verificados con grep sobre `src/`.

## Quedó pendiente / en vuelo

- ~~Aplicar las 3 migraciones por MCP~~ → **✅ APLICADAS (misma sesión, 31/07)** con el OK
  explícito de Lautaro (eligió "Aplicar las 3"). **Verificado por SQL contra la base real**:
  `set local role anon` → `permission denied` en `lineup` Y en `is_admin()` · `authenticated`
  sigue ejecutando `is_admin()` y leyendo `empresas` (las policies gateadas quedaron sanas) ·
  lo público intacto (futuros 31.285 / djve_resumen 88 / noticias 2.313 filas visibles como
  anon) · ACLs releídas de `pg_class`/`pg_proc`: los 8 objetos de line-up SIN grants para
  anon/authenticated, `refresh_compras_avance` solo service_role, las 10 RPC con
  authenticated+service_role. Falta solo el vistazo de Lautaro logueado a `/comercio/*` y
  `/admin` en producción (esperado: idéntico a antes) — la re-corrida de `get_advisors` quedó
  bloqueada por una caída transitoria del clasificador de permisos del entorno al cierre; las
  ACLs verificadas por SQL son la fuente de la que esos WARN derivan.
- **Resto del checklist por partes** (performance, cálculos, datos, backups, deployment) —
  auditar contra `PRELAUNCH_CHECKLIST.md`; el crítico abierto es backups (Supabase Pro).
- Los 🖐 manuales de Lautaro: Dependabot, branch protection de `main`, Supabase Pro, acceso de
  emergencia para Mauro, migración a keys `sb_secret_`/`sb_publishable_`, gitleaks.

## Parte 2 (01/08/2026) — cálculos, frescura, performance, deployment

Lautaro pidió seguir con el resto del checklist, aclarando explícitamente que **no va a
contratar Supabase Pro** (backups/S4 quedan como riesgo aceptado). Se auditaron las 4 partes
restantes en solo-lectura, con 2 agentes de exploración en paralelo (cálculos+frescura /
performance+deployment) contra el código real. Resultado completo incorporado a
`docs/PRELAUNCH_CHECKLIST.md` fase por fase; resumen:

- **Cálculos financieros**: 0 bugs. `number` puro sin decimal.js, sostenido por >90 asserts
  `toBeCloseTo` + 426 tests con fixtures del Excel. Un bug de escala ya cazado con test
  (`capacidad-modelo.test.ts:90-96`). `FERIADOS_AR` vive en `src/lib/habiles.ts` (no
  `dates.ts` — corrección menor de referencia); próxima falla real del centinela: octubre 2027.
- **Frescura de datos**: sólido (17 checks + 6 tipos de anomalía + alertas), pero 3 paneles de
  cliente sin `SourceStamp` (`/dolar/oficial`, `/graficos`, cinta del home) y 8 tablas con
  chequeo de frescura pero sin chequeo de VALOR — 2 de ellas (`pas_zonas`/`pas_condicion`) son
  100% carga manual, las más expuestas a error humano. Este segundo hallazgo no estaba en
  ninguno de los 3 informes de Lautaro — lo encontró la auditoría cruzando el catálogo de
  anomalías contra el de frescura.
- **Performance**: base sólida (headers de seguridad completos, ISR consistente, 9 deps de
  producción sin hinchazón) pero CERO medición real de Core Web Vitals — nadie sabe hoy si el
  sitio es rápido de verdad para un cliente en producción.
- **Deployment/CI**: el CI corre pero NO bloquea merges (sin branch protection en `main`) · sin
  `npm audit` · Dependabot a medias (version-updates commiteado, alertas de seguridad sin
  prender) · los Preview deployments de Vercel leen la base de PRODUCCIÓN (sin staging) ·
  Vercel Pro confirmado contratado pero Instant Rollback sin documentar en ningún runbook (que
  tampoco existe todavía).
- **Operación** (Fase 5): confirmado que NINGUNO de los 3 existe hoy: `/api/health`,
  kill-switch/banner de "datos en revisión", `error.tsx`/`global-error.tsx`.

**Decisión de Lautaro**: sin Supabase Pro por ahora → el dump versionado propio de las tablas
de carga manual (ya estaba en el checklist como "evaluar") pasa a ser la ÚNICA red de backups
real, sube de prioridad.

## Verificado (parte 2)

- lint ✅ · `npx tsc --noEmit` ✅ · **426/426 tests** ✅ · `npm run build` ✅ (diff 100% docs,
  `docs/PRELAUNCH_CHECKLIST.md`, cero cambios en `src/` — todavía no se construyó ningún fix,
  solo se documentó el estado real con evidencia archivo:línea).

## Quedó pendiente / en vuelo (parte 2)

- Ningún fix de código todavía — esta parte fue 100% auditoría. Repriorizado en el checklist:
  runbook+kill-switch+`/api/health`+`error.tsx` (operación crítica, nada existe) → dump de
  backups (única red real) → branch protection+`npm audit` (gates baratos) → gaps de
  `SourceStamp`+extender anomalías → legal → OG/CWV → staging (evaluar si se justifica) → beta.
  Falta que Lautaro elija por dónde arrancar a construir (mismo patrón que S1-S3: reportar,
  preguntar, recién ahí tocar código).

## Parte 3 (01/08/2026) — build de "Operación crítica"

Con el reporte de la parte 2 en mano, Lautaro eligió por dónde arrancar a construir: **Operación
crítica** (kill-switch + `/api/health` + `error.tsx`/`global-error.tsx`, los 3 confirmados
inexistentes en la auditoría). Los 3 son código nuevo sin tocar esquema ni fórmulas — no
necesitaban aviso previo especial más allá de la elección ya hecha.

- **`src/app/error.tsx`** + **`src/app/global-error.tsx`**: 500 branded, mismo lenguaje visual que
  `not-found.tsx` (`.aviso-card`, botones Reintentar/Volver al inicio). `global-error.tsx` con
  estilos inline (reemplaza el root layout completo, no puede depender de `globals.css`).
- **`src/app/api/health/route.ts`**: GET público, `force-dynamic` (sin caché), SELECT liviano
  contra `vencimientos` vía `sbSelect` (mismo helper que toda la lectura de Supabase) — 200 si
  responde, 503 si no.
- **`src/components/kill-switch-banner.tsx`**: banner condicionado a `KILL_SWITCH_ACTIVO` (env
  var), mensaje personalizable con `KILL_SWITCH_MENSAJE`, cableado en `(site)/layout.tsx` arriba
  del masthead. CSS nuevo (`.ks-banner*`) reusando el token `--neg` ya existente.

**Verificación real, no solo build**: con las creds reales de Supabase del entorno (proceso, no
`.env.local`), se levantó el server 3 veces — (1) `/api/health` contra la base real: `{"status":
"ok","checks":{"app":true,"supabase":true},...}` · (2) rebuild con `KILL_SWITCH_ACTIVO=true` +
capturas de Playwright en claro y oscuro (el toggle de tema real, no `prefers-color-scheme` — el
sitio no lo sigue) confirmando el banner arriba del masthead en las dos pieles · (3) página
temporal con `throw` forzado (`force-dynamic` para que no rompiera el build al pre-renderizar) →
HTTP 500 confirmado + captura del `error.tsx` real, después **borrada sin dejar rastro**
(`git status` limpio antes del commit).

**Trampa real encontrada**: el kill-switch no se vio en el primer intento de verlo en el navegador
— la home es ISR (`revalidate=60`) y quedó pre-renderizada en el build hecho ANTES de setear
`KILL_SWITCH_ACTIVO=true`. Confirma en la práctica el caveat que ya se había documentado a mano en
`.env.local.example`: en Vercel, cambiar el env var no alcanza, hace falta un Redeploy.

**Verificado**: lint ✅ · `npx tsc --noEmit` ✅ (con un `.next` corrupto por la página temporal
borrada — limpiado con `rm -rf .next` antes de repetir, mismo tipo de trampa que ya había pasado
en la sesión del rediseño premium del 28/07) · **426/426 tests** ✅ · `npm run build` ✅.

**Quedó pendiente**: `docs/RUNBOOK.md` (documentaría cómo usar estas 3 piezas en una emergencia
real) — no estaba en el alcance elegido, es el siguiente paso natural. El resto del backlog
repriorizado de la parte 2 sigue completo en `PRELAUNCH_CHECKLIST.md`.

## Trampas descubiertas (para la próxima sesión)

- **El EXECUTE default de Postgres a PUBLIC** sigue mordiendo: toda función nueva nace
  ejecutable por anon vía PostgREST salvo revoke explícito — ya pasó con `ingest_cierres_cem`
  (E5) y ahora con `refresh_compras_avance`. Hábito nuevo documentado en la migración S3: cada
  función nueva lleva su `revoke ... from public, anon` en la misma migración.
- **Revocar PUBLIC en una función le saca el acceso implícito a authenticated** — un revoke
  "solo cosmético" sin re-grant explícito rompe el panel admin en silencio. Por eso S3 empareja
  cada revoke con su grant.
- `/security-review` necesita `origin/HEAD` en el clon (los checkouts de este entorno no lo
  traen) además de un diff pendiente — para usarlo sobre un PR: `git remote set-head origin -a`
  primero.
- `mcp__Supabase__get_project` no devuelve el tier del plan (Free/Pro) — el estado del plan hay
  que mirarlo en el dashboard.
