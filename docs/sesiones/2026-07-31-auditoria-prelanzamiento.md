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

- **Aplicar las 3 migraciones por MCP** — esperando el OK explícito de Lautaro (pedido al cierre
  de la sesión). Verificación post-aplicación planeada: `get_advisors` (deben caer los WARN de
  matviews y los `anon_security_definer` de las funciones tocadas), REST con anon key a `lineup`
  → permission denied, `/comercio/puertos` y `/comercio/camiones` con datos en producción, y
  login → `/admin` → beacon en Preview (valida S3).
- **Resto del checklist por partes** (performance, cálculos, datos, backups, deployment) —
  auditar contra `PRELAUNCH_CHECKLIST.md`; el crítico abierto es backups (Supabase Pro).
- Los 🖐 manuales de Lautaro: Dependabot, branch protection de `main`, Supabase Pro, acceso de
  emergencia para Mauro, migración a keys `sb_secret_`/`sb_publishable_`, gitleaks.

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
