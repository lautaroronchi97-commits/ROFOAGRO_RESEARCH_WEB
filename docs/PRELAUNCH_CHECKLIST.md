# PRELAUNCH_CHECKLIST — checklist maestro de pre-lanzamiento (C29)

> Consolida los **3 informes de research** que Lautaro trajo el 31/07/2026 (metodología de
> ejecución con Claude Code · Informe 3 "cómo ejecutar sin romper nada" · Informe complementario
> con los 8 puntos técnicos/legales) en UN solo documento con el **estado real del repo** — mucho
> de lo que piden ya existía por la auditoría E1→E7 y acá queda tildado con su evidencia, para no
> reconstruir lo hecho. **Toda auditoría de una fase se corre en Plan Mode contra este doc**; los
> fixes salen de a uno, con commit propio, y las migraciones se aplican solo con OK explícito.
> Registrado como **C29** en el backlog maestro ([`auditoria/E7-sintesis.md`](auditoria/E7-sintesis.md) §4).
>
> Leyenda: `[x]` hecho y verificado · `[ ]` pendiente (sesión de código/auditoría) · `[ ] 🖐`
> paso manual de Lautaro (clics en dashboards, no código).

## Fase 0 — Metodología (Informe 3 §1)

- [x] Reglas duras persistidas en `CONTEXTO.md` § "Cómo trabajar con Lautaro" (31/07/2026):
  esquema/API con aviso previo · fórmulas solo con diff aprobado y tests verdes · un fix por vez
  avisando · frenar ante fallas · lint+tsc+vitest antes de cerrar (protocolo de `ESTADO.md`
  actualizado con vitest, que el CI ya corría).
- [x] Flujo Plan Mode → hallazgos → fixes de a uno: es el protocolo de sesiones vigente del repo
  (rama `claude/*` desde `main`, PR único, verificación antes de push).
- [ ] Hook PostToolUse de lint tras cada edición (opcional — evaluar si aporta sobre el protocolo
  actual; el CI ya bloquea el merge).

## Fase S — Seguridad (AUDITADA 31/07/2026 — hallazgos S1-S4 en la bitácora de sesión)

- [x] **RLS activo en 24/24 tablas de `public`**, todas con policies; sensibles cerradas
  (`views_mercado`, `mesa_color`, `pas_zonas`, `pas_condicion`, `profiles`, `access_log`,
  `sesiones_activas`, borradores de `interpretaciones`/`informes_generados`); públicas solo las
  decididas (E1/E5). Verificado contra la base real por SQL.
- [x] **Service key jamás en el cliente**: `src/lib/supabase.ts` es `server-only`, sin prefijo
  `NEXT_PUBLIC_`; único uso extra en Server Component (`(site)/informes/page.tsx`, URLs firmadas
  1 h). Sin `.env` commiteado; historial sin secretos (E5, 139 commits).
- [x] Headers (CSP Report-Only + HSTS) · `INFORME_TOKEN` por Bearer + `timingSafeEqual` · RPC
  `admin_*` con guard `is_admin()` — E5.
- [x] **S1 (importante-alto)**: cerrar `lineup` + 5 vistas + 2 matviews a `anon` — migración
  `20260731170000_s1_cierre_lineup_anon.sql`, **APLICADA por MCP con OK de Lautaro (31/07)**.
  Verificado por SQL: `anon` → `permission denied for table lineup`; lo público intacto.
- [x] **S2 (importante)**: revoke `refresh_compras_avance()` a anon —
  `20260731170500_s2_revoke_refresh_compras_avance.sql`, **APLICADA (31/07)**.
- [x] **S3 (puede esperar)**: limpieza de EXECUTE sobrante de anon en 10 funciones SECURITY
  DEFINER — `20260731171000_s3_limpieza_execute_definer.sql`, **APLICADA (31/07)** (mantiene
  `authenticated`; `is_admin()` y las trigger functions con reglas especiales documentadas en
  la migración). Verificado por SQL: `anon` → `permission denied for function is_admin`;
  `authenticated` la sigue ejecutando y lee `empresas` (policies con `is_admin()` sanas).
- [ ] `/security-review` sobre el diff de cada PR de fixes (el comando revisa diffs; sobre rama
  limpia no tiene material — la auditoría proyecto-completo de hoy lo cubrió).
- [x] `npm audit` en CI — HECHO 01/08/2026: paso nuevo en `ci.yml` (`npm audit --audit-level=
  high`), **no bloqueante a propósito** (`continue-on-error: true`) — queda visible en cada run
  pero no rompe el merge. Corrido hoy: **4 altas, las 3 con fix disponible son TODAS
  transitivas de `next`** (postcss/sharp), y el único remedio es `npm audit fix --force`
  bumpeando Next fuera del rango declarado — este repo corre una versión de Next con cambios
  de breaking documentados (`AGENTS.md`), así que esa decisión queda para Lautaro, no para un
  gate de CI. **Pendiente real que sigue abierto**: decidir si vale la pena actualizar Next
  (evaluar qué tan alcanzable es explotar sharp/postcss en este proyecto — sharp es de
  `next/image`, que hoy no parece usarse con imágenes remotas; postcss actúa sobre CSS propio,
  no de usuario).
- [x] `.github/dependabot.yml` **ya está committeado** (npm + github-actions, updates mensuales
  agrupados, `open-pull-requests-limit: 10`) — es el mecanismo de **version-updates** (PRs
  automáticos). Falta el otro mecanismo, distinto: 🖐 **alertas de seguridad** (GitHub → Settings
  → Code security → Dependabot alerts), que se prende con un clic y no está en este archivo.
- [ ] 🖐 Re-scan del historial con **gitleaks** (E5 revisó a mano hasta el commit 139) — o correrlo
  en una sesión de código si el sandbox lo permite.
- [ ] 🖐 Migrar a las **keys nuevas de Supabase** (`sb_publishable_`/`sb_secret_`) — las legacy
  deprecan a fines de 2026; rotación en segundos sin desloguear. Coordinar: Vercel + GitHub
  secrets + entorno de Claude (Routines) + Edge Functions, en ese orden y con verificación.
- [ ] 🖐 **S4**: leaked password protection (se destraba al contratar Supabase Pro — ver Fase 4).

## Fase 1 — Cálculos financieros (Informe complementario §1)

- [x] **Golden tests**: 426 tests Vitest con fixtures del Excel real de Lautaro (auditoría E2:
  45 fichas de fórmulas verificadas, 0 bugs; E4 los convirtió en tests). Corren en CI en cada
  push/PR. El Excel sigue siendo la fuente de verdad (regla en `CONTEXTO.md`).
- [x] Bases de días auditadas (act/365 consistente, E2) · feriados `FERIADOS_AR` con test
  centinela que exige cargar el año próximo desde octubre (E5).
- [x] **Auditado 01/08/2026 (solo lectura, cero bugs encontrados)**: confirmado `number` IEEE 754
  puro en los 12 módulos de cálculo (`src/lib/{arbitraje,pases,sinteticos,diferido,capacidad-
  modelo,capacidad-industria-modelo,fijar,fijar-canon,djve,estimaciones,precio-dual,porcentaje,
  curva}.ts`), sin `decimal.js`/`big.js` en `package.json`. **Redondeo NO unificado** (mezcla de
  `Math.round(n×10^k)/10^k` dentro de varios `src/lib/*.ts` — ej. `arbitrajes-cierres.ts:21`,
  `capacidad.ts:95`, `capacidad-modelo.ts:107,119-120` — con `Intl.NumberFormat` es-AR en
  `format.ts:3-39` para la capa visible). Red de contención real: **>90 asserts `toBeCloseTo`**
  en los tests (4-9 dígitos de tolerancia, no igualdad exacta) + 1 bug de escala ya cazado y
  guardado con test (`capacidad-modelo.test.ts:90-96`, fracción vs. % de gastos comerciales).
  **Veredicto: sin librería decimal el repo depende 100% de esos tests para no repetir ese tipo
  de bug — sólido hoy, pero fragil a fórmulas nuevas sin su propio `toBeCloseTo`.** No se tocó
  ninguna fórmula (regla dura respetada).
- [ ] Property-based tests (fast-check) para invariantes (TEA ≥ TNA, spread+inverso=0) — opcional,
  requiere sumar una dependencia nueva (avisar antes).
- [x] `FERIADOS_AR` vive en `src/lib/habiles.ts:9-23` (no en `dates.ts`) — 2025/2026/2027 cargados
  (2027 marcado "estimado"), test centinela en `habiles.test.ts:47-54` verificado línea por línea:
  desde octubre exige el año siguiente cargado. **Próximo punto real de falla: octubre de 2027**
  (exigirá 2028, hoy sin cargar) — sin acción hasta entonces.

## Fase 2 — Frescura y calidad de datos (Informe complementario §2)

> Los crons son **GitHub Actions**, no Vercel Cron — las advertencias del informe sobre Vercel
> Cron (sin reintentos/alertas) no aplican; el equivalente al "dead man's switch" ya existe.

- [x] Healthcheck diario de frescura (17 checks, umbral por tabla) con mail en rojo.
- [x] Guard anti falso-verde en TODAS las ingestas (0 filas = exit 1, incl. backfills — E5/L6).
- [x] Detector de anomalías de valores (MAD, 6 chequeos, calibrado retroactivo contra bugs
  reales) con barrido diario + mail — D7.
- [x] Alertas Resend en los workflows críticos + panel `/admin/conexiones` (crons, Routines,
  cargas manuales, A3, matviews).
- [x] Sanity checks en uploaders manuales (identidades contables, rangos físicos, guard ÷1000).
- [ ] **Auditado 01/08/2026 (página por página) — 3 gaps reales de `SourceStamp` en cliente**:
  `SourceStamp` (`src/components/source-stamp.tsx:14-29`) ya muestra fuente + "Actualizado HH:MM"
  en hora Córdoba real (`horaCordoba()`) y está en 20 de los 23 paneles de cliente. Faltan:
  **`/dolar/oficial`** (`dolar-oficial-panel.tsx` — tiene una fecha del dato pero no el formato
  estándar) · **`/graficos`** (`graficos-client.tsx` — sin ningún sello) · **la `Cinta`** del home
  (`cinta.tsx:39-54` — badge "prov." pero nunca timestamp; es un ribbon en marquee, sumarle un
  sello es más una decisión de diseño que un fix mecánico). Las páginas mesa-only
  (`/comercio/negociado`, `/produccion/{condicion,zonas}`, `/granos/view`) NO cuentan como gap
  — confirmado `requireAdmin()` en las 4.
- [ ] **Nuevo (no estaba en los informes)**: el detector de anomalías (D7) cubre 9 series
  (`src/lib/anomalias-series.ts:51-169`) pero el healthcheck de frescura cubre 17 tablas — **8
  tablas sin chequeo de VALOR** (solo de frescura): `djve`, `lineup`, `camiones_plantas`,
  `noticias`, `views_mercado`, `pas_zonas`, `pas_condicion`, `lecap_pago_final`. Las 2 BCBA-PAS
  son las que más preocupan: son 100% carga manual (más expuestas a error humano) y hoy solo se
  valida "¿llegó el dato?", no "¿el valor tiene sentido?". No es una regresión — nunca se
  construyó — pero vale la pena que Lautaro lo sepa antes de decidir si extender el catálogo.
- [ ] No existe semáforo visual de antigüedad por tiempo transcurrido (verde/rojo según reloj del
  cliente) — hoy el ⚠ de `SourceStamp` es estático (lo setea el server al momento del fetch, vía
  `meta.problemas`), no recalcula edad en el navegador. Baja prioridad: el timestamp exacto ya es
  visible donde `SourceStamp` está presente.

## Fase 3 — Control de acceso comercial (Informe complementario §3)

> Cubierto con un diseño distinto al del informe (y más cómodo para vender): registro
> autoservicio + **aprobación manual** en `/admin`, en vez de allowlist previa.

- [x] `AUTH_ENFORCED=true` en producción (27/07): sin sesión → `/bienvenida`; secciones por
  permisos de empresa + override; `/admin` solo admin; sesión única por usuario (kickeo);
  duración 7 días; marca de agua por email.
- [x] No-aprobado NO entra al producto: pantalla `pendiente` + enforcement en el proxy (no solo
  front) + RLS como segunda capa.
- [ ] Auditar el ciclo de vida de un registro rechazado/abandonado (fila en `auth.users` +
  `profiles` en `pendiente` para siempre — ¿limpieza periódica? ¿aviso?).

## Fase 4 — Backups y entornos (checklist "backups" + Informe complementario §6)

- [ ] ~~🖐 CRÍTICO — Supabase Pro~~ → **DECIDIDO 01/08/2026: Lautaro NO va a contratarlo por
  ahora.** Riesgo aceptado explícitamente: plan Free = sin backup automático de una base con
  años de series y cargas manuales irreproducibles (y leaked password protection, S4, sigue sin
  poder prenderse). Mitigación que SÍ queda en pie (ver siguiente ítem): el dump versionado
  propio cubre al menos las tablas de carga manual, que son las irreproducibles de verdad (las
  automáticas se re-ingieren solas desde la fuente si hace falta).
- [ ] Respaldo versionado propio de las tablas de carga manual (`compras`, `camiones`,
  `estimaciones_produccion` manuales, `lecap_pago_final`, `pas_*`) — dump periódico a `data/`
  vía workflow, como red extra independiente del plan de Supabase. **Pasa a ser la única red de
  seguridad de backups** tras la decisión de arriba — subir su prioridad.
- [ ] Staging: 2º proyecto Supabase (gratis) para Previews — hoy los Previews de Vercel leen la
  base de PRODUCCIÓN con la anon key (confirmado 01/08 — no hay ninguna mención de un 2º
  proyecto en el repo, es 100% una recomendación pendiente). Con S1 aplicado, además, los
  Previews pierden lo de mesa (sin service key de preview) — decidir si se configura staging o
  se acepta la degradación.
- [ ] 🖐 **Branch protection en `main`**: require PR + checks del CI requeridos + bloquear
  force-push (GitHub → Settings → Branches). Confirmado 01/08: hoy CI corre en cada push/PR pero
  NO bloquea el merge (no hay ningún archivo de config de branch protection, ni debería haberlo
  — vive en GitHub Settings) — cualquiera puede mergear a `main` con el CI en rojo.
- [x] Vercel Pro confirmado contratado (múltiples menciones cruzadas en `ESTADO.md`/E5/E7).
- [x] Instant Rollback documentado — ver `docs/RUNBOOK.md` escenario A (paso 3).

## Fase 5 — Operación (Informe 3 §6 — runbook para un fundador solo-técnico)

- [x] **[`docs/RUNBOOK.md`](RUNBOOK.md)** — HECHO 01/08/2026, 1 página con los 4 escenarios
  del informe: A) web caída (`/api/health` → ¿deploy reciente? → Instant Rollback) · B) dato
  incorrecto (kill-switch primero, investigar después, con los pasos exactos de Vercel) · C)
  cliente reporta un dato (reproducir contra la fuente primaria → banner → fix → comunicar) ·
  D) contactos/accesos. Escrito para Lautaro (paso a paso, sin dar por sabido ningún menú).
- [x] **Kill-switch / banner "Datos en revisión — no operar con esta información"** — HECHO
  01/08/2026: `KillSwitchBanner` (`src/components/kill-switch-banner.tsx`) en
  `(site)/layout.tsx`, gateado por `KILL_SWITCH_ACTIVO` (env var, "false" default, mensaje
  personalizable con `KILL_SWITCH_MENSAJE`). Verificado con Playwright en claro/oscuro
  (screenshots reales, banner visible arriba del masthead en toda la web de cliente). **Ojo
  operativo, documentado en `.env.local.example`**: en Vercel cambiar el env var no alcanza —
  las páginas ISR quedan pre-renderizadas con el valor de la última build, hace falta un
  Redeploy (sin tocar código) para que el banner aparezca/desaparezca.
- [x] **`/api/health`** — HECHO 01/08/2026: `src/app/api/health/route.ts`, público, sin caché
  (`force-dynamic`), chequea Supabase con un SELECT liviano sobre `vencimientos` y devuelve
  `{status, checks, latencyMs, timestamp}` — 200 si Supabase responde, 503 si no (para que
  UptimeRobot/similar lo detecte como caído). Probado en vivo contra la base real:
  `{"status":"ok","checks":{"app":true,"supabase":true},...}`.
- [ ] 🖐 Acceso de emergencia para **Mauro** con cuenta propia (ya es admin de la web): Vercel
  (miembro del team), Supabase (Organization → Team), GitHub (colaborador). Sin compartir
  contraseñas; 2FA cada uno.
- [ ] Smoke test k6 (5 VUs × 1 min, p95 < 500 ms, errores < 1%) — opcional según Informe 3; el
  load testing formal está descartado para esta escala.

## Fase 6 — Legal Argentina (Informe complementario §5)

- [x] `/privacidad` y `/terminos` publicados (23/07, requisito del OAuth de Google).
- [ ] **Disclaimer CNV** (RG 1002/2024 safe harbor): texto visible en footer + informes
  diario/semanal — "información y análisis de carácter general, no constituye asesoramiento ni
  recomendación personalizada (Ley 26.831)". Línea roja documentada: nunca recomendaciones
  personalizadas por perfil de cliente.
- [ ] Auditar `/privacidad` contra Ley 25.326: finalidad, responsable y domicilio, derechos
  ARCO, AAIP como autoridad de control.
- [ ] 🖐 Consulta puntual con abogado: inscripción de la base ante la AAIP (TAD) + redacción
  final del disclaimer. Fuera de código.

## Fase 7 — Pulido y lanzamiento (Informe complementario §7-8)

- [x] 404 branded (E3) · favicon · títulos/descripciones por página · formulario de contacto
  (landing, Resend) · indicador de rueda abierta/cerrada + hora Córdoba en toda la web.
- [x] **`error.tsx`/`global-error.tsx`** — HECHO 01/08/2026: `src/app/error.tsx` (boundary de
  route segment, mismo patrón visual que `not-found.tsx` — `.aviso-card` + botones Reintentar/
  Volver al inicio) + `src/app/global-error.tsx` (último recurso si falla el root layout
  mismo, con estilos inline porque no puede asumir que `globals.css`/`ThemeProvider` sigan
  montados). Verificado forzando un error real (página temporal que tira `throw`, 500
  confirmado por HTTP + screenshot del boundary branded, borrada después — cero residuo).
- [ ] **OG tags para WhatsApp**: `og:title/description/image` (1200×630, logo centrado, URL
  absoluta) — los clientes agro comparten TODO por WhatsApp; verificar con el Sharing Debugger.
- [ ] Performance: Core Web Vitals reales de producción (base E4 ya medida: bundle −235 KB, ISR
  por página) — **confirmado 01/08: sin `@vercel/analytics`/Speed Insights instalado, sin medir
  hoy**. Lo demás auditado y sólido: `next.config.ts` con headers completos, ISR consistente
  (30s rueda en vivo / 60s dólar-calcs / 3600s baja frecuencia), 9 deps de producción sin
  hinchazón (`@supabase/ssr`, `@supabase/supabase-js`, `next`, `next-themes`, `react`,
  `react-dom`, `recharts`, `server-only`, `ws` — todas justificadas, 0 código muerto, E4). 13
  páginas sin `revalidate` explícito son en su mayoría mesa-only (esperado, dinámicas por
  `requireAdmin`) — sin evidencia de que sea un olvido real.
- [ ] 🖐 Beta cerrada: 1-2 clientes de confianza, canal de feedback, criterios go/no-go definidos
  ANTES (ej.: 0 bugs críticos abiertos · 0 reportes de dato incorrecto sin resolver en la última
  semana · clientes llegan al momento de valor). La beta termina con una decisión.

---

## Auditoría 01/08/2026 — cálculos, frescura, performance, deployment (parte 2 del checklist)

Corrida en solo-lectura contra el código real (2 agentes en paralelo + verificación cruzada),
sin tocar nada — mismo protocolo que la parte de seguridad. Resumen ejecutivo (detalle
incorporado arriba en cada fase correspondiente):

- **Cálculos financieros**: 0 bugs encontrados. Sin librería decimal, pero sostenido por >90
  asserts `toBeCloseTo` + 426 tests con fixtures reales del Excel — sólido hoy, exige disciplina
  de tests en cada fórmula nueva.
- **Frescura de datos**: sólido en general (17 checks de frescura, 6 tipos de anomalía, alertas).
  3 gaps de `SourceStamp` en cliente (`/dolar/oficial`, `/graficos`, cinta del home) + 8 tablas
  sin chequeo de VALOR (solo frescura), 2 de ellas 100% manuales (`pas_zonas`/`pas_condicion`).
- **Performance**: base sólida (headers, ISR, deps limpias) pero sin medición real de Core Web
  Vitals — nadie mide hoy si el sitio es rápido de verdad para un cliente.
- **Deployment/CI**: CI corre pero no bloquea merges (sin branch protection) · sin `npm audit` ·
  Dependabot a medias (version-updates sí, alertas de seguridad no) · Previews leen la base de
  PRODUCCIÓN (sin staging) · Vercel Pro confirmado pero Instant Rollback sin documentar.
- **Backups**: Lautaro decidió NO contratar Supabase Pro por ahora — riesgo aceptado
  explícitamente; el dump versionado propio (Fase 4) pasa a ser la única red real.

**Orden sugerido de lo pendiente** (repriorizado tras esta parte): Fase 5 runbook+kill-
switch+`/api/health`+`error.tsx` (operación crítica, ninguno existe hoy) → dump versionado de
backups (única red desde que se descartó Pro) → branch protection + `npm audit` en CI (gates
baratos) → gaps de `SourceStamp` + extender detector de anomalías → Fase 6 legal → OG tags/CWV →
staging (evaluar si se justifica) → beta. Los 🖐 corren en paralelo cuando Lautaro tenga un rato.

## Build 01/08/2026 — kill-switch + `/api/health` + `error.tsx`/`global-error.tsx`

Primer fix de código de la parte 2 (Lautaro eligió "Operación crítica" como prioridad). Los 3
verificados con Playwright real (claro/oscuro + forzando un error real con una página temporal
borrada después) y contra la base real (`/api/health` respondiendo `status:"ok"` con Supabase de
verdad). `docs/RUNBOOK.md` de 1 página (que documentaría cómo usar estas 3 piezas en una
emergencia) sigue sin existir — quedó fuera del alcance elegido, es el siguiente paso natural de
esta misma fase. Sigue pendiente el resto de "Operación crítica" strictamente hablando: acceso de
emergencia para Mauro (🖐, manual) y el smoke test k6 (opcional).
