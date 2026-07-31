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
- [ ] **S1 (importante-alto)**: cerrar `lineup` + 5 vistas + 2 matviews a `anon` — migración
  `20260731170000_cierre_lineup_anon.sql` versionada, **aplicar con OK explícito**.
- [ ] **S2 (importante)**: revoke `refresh_compras_avance()` a anon —
  `20260731170500_revoke_refresh_compras_avance.sql`, ídem.
- [ ] **S3 (puede esperar)**: limpieza de EXECUTE sobrante de anon en ~10 funciones SECURITY
  DEFINER — `20260731171000_limpieza_execute_definer.sql`, ídem (mantiene `authenticated`;
  `is_admin()` y las trigger functions con reglas especiales documentadas en la migración).
- [ ] `/security-review` sobre el diff de cada PR de fixes (el comando revisa diffs; sobre rama
  limpia no tiene material — la auditoría proyecto-completo de hoy lo cubrió).
- [ ] `npm audit` como paso del CI (hoy no está; `npm ci` + lockfile sí).
- [ ] 🖐 **Dependabot** (GitHub → Settings → Code security) — alertas + updates mensuales agrupados.
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
- [ ] Auditar precisión decimal en la CAPA VISIBLE (formateo/redondeo es-AR): el repo usa `number`
  IEEE 754 sin decimal.js — evaluar si algún redondeo mostrado difiere del Excel. **Sin tocar
  ninguna fórmula sin diff aprobado** (regla dura).
- [ ] Property-based tests (fast-check) para invariantes (TEA ≥ TNA, spread+inverso=0) — opcional.

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
- [ ] Auditar que TODOS los paneles de cliente muestren el sello "datos al HH:MM" en hora AR y
  evaluar el semáforo visual de dato viejo (los `SourceStamp` existen desde la auditoría de
  07/07; verificar cobertura completa página por página).

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

- [ ] 🖐 **CRÍTICO — Supabase Pro (US$25/mes)**: hoy el proyecto está en plan Free (verificado
  22/07) ⇒ **sin backups automáticos** de una base con años de series y cargas manuales
  irreproducibles. Pro da backup diario 7 días (+PITR opcional) y de paso destraba leaked
  password protection (S4). Decisión de Lautaro.
- [ ] Evaluar respaldo versionado propio de las tablas de carga manual (`compras`, `camiones`,
  `estimaciones_produccion` manuales, `lecap_pago_final`, `pas_*`) — dump periódico a `data/`
  vía workflow, como red extra independiente del plan.
- [ ] Staging: 2º proyecto Supabase (gratis) para Previews — hoy los Previews de Vercel leen la
  base de PRODUCCIÓN con la anon key. Con S1 aplicado, además, los Previews pierden lo de mesa
  (sin service key de preview) — decidir si se configura staging o se acepta la degradación.
- [ ] 🖐 **Branch protection en `main`**: require PR + checks del CI requeridos + bloquear
  force-push (GitHub → Settings → Branches).
- [ ] Documentar Instant Rollback de Vercel (Pro ya contratado) en el runbook (Fase 5).

## Fase 5 — Operación (Informe 3 §6 — runbook para un fundador solo-técnico)

- [ ] **`docs/RUNBOOK.md` de 1 página**: A) web caída en rueda (status pages → ¿deploy reciente?
  → Instant Rollback → logs) · B) dato incorrecto en pantalla (kill-switch primero, investigar
  después) · C) cliente reporta dato (reproducir contra fuente primaria → banner → fix aislado →
  comunicar) · D) contactos/accesos.
- [ ] **Kill-switch / banner "Datos en revisión — no operar con esta información"**: env var +
  banner en el layout compartido. No existe hoy y es más urgente que en una app común.
- [ ] **`/api/health`** público liviano (app viva + Supabase responde) para monitoreo externo
  (UptimeRobot free) — `/admin/conexiones` es el tablero interno, no sirve de probe.
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
- [ ] Auditar `error.tsx`/`global-error.tsx` (500 branded — el 404 existe, el error boundary hay
  que verificarlo/crearlo).
- [ ] **OG tags para WhatsApp**: `og:title/description/image` (1200×630, logo centrado, URL
  absoluta) — los clientes agro comparten TODO por WhatsApp; verificar con el Sharing Debugger.
- [ ] Performance: Core Web Vitals reales de producción (base E4 ya medida: bundle −235 KB, ISR
  por página) — auditoría de la parte "performance" del checklist.
- [ ] 🖐 Beta cerrada: 1-2 clientes de confianza, canal de feedback, criterios go/no-go definidos
  ANTES (ej.: 0 bugs críticos abiertos · 0 reportes de dato incorrecto sin resolver en la última
  semana · clientes llegan al momento de valor). La beta termina con una decisión.

---

**Orden sugerido de lo pendiente**: S1→S3 (migraciones ya versionadas, aplicar con OK) → Fase 4
backups (el único crítico abierto) → Fase 5 runbook+kill-switch+health → Fase 2/7 (sellos, OG,
error.tsx) → Fase 6 legal → beta. Los 🖐 corren en paralelo cuando Lautaro tenga un rato.
