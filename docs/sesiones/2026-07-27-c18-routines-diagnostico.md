# Sesión 2026-07-27 (cont.) — C18: diagnóstico y fix de las 3 Routines de informes

- **Rama:** `claude/plan-desarrollo-auditoria-kxn0qz` · **PR:** #83 (mismo PR que A1, misma sesión)
- **Objetivo pedido por Lautaro:** con el login ya encendido (A1), pasó las alertas reales de
  Gmail (healthcheck en rojo, `FALLÓ el informe diario — 401`, ingesta line-up en rojo) y pidió
  "así las chequeamos" — arrancó como C18/V0 (verificar por qué las 3 Routines de informes no
  producen nada, hallazgo del 24/07) y terminó destrabándolo.

## Hecho
1. **`INFORME_TOKEN` desincronizado** entre el entorno de Claude Code (usado por las Routines) y
   `Vercel` Producción → 401 en `/api/informes/datos` y `/api/views/insumos`. Confirmado en vivo con
   `curl` desde este mismo entorno. Fix: token nuevo generado, cargado en los dos lados por Lautoro,
   verificado con `curl` real → 200 en ambos endpoints.
2. **`ingest-lineup` — falso positivo de lunes**: la ventana diaria (hoy + 2 días previos) puede caer
   enteramente en fin de semana (Lun+Dom+Sáb) si corre antes de que ISA publique el lunes — el guard
   anti-falso-verde (L6, 24/07) lo marcaba como bloqueo real. Fix: ventana ampliada a 4 días (`scripts/
   ingest-lineup.mjs` + comentario de `ingest-lineup.yml`).
3. **Diagnóstico del "las Routines no producen nada" (más profundo que el token)**: se disparó
   manualmente la Routine de informe diario dos veces.
   - 1er intento (13:53 UTC): la sesión reportó que el entorno no tenía el repo clonado ni
     credenciales para clonarlo directo — nunca llegó a leer la skill.
   - Se le agregó a las 3 Routines (vía `update_trigger`) un paso explícito al principio pidiendo
     `add_repo` si el repo no estaba disponible — resultó ser una pista falsa: la tool `add_repo` **no
     existe** en el entorno de las Routines (headless). Lo que en realidad destrabó el 2º intento fue
     que la sesión hizo un `git clone` directo por el proxy preconfigurado del entorno, que sí tiene
     acceso al repo privado — el 1er fallo fue un fluke/diagnóstico incompleto de esa sesión, no un
     problema real de acceso.
   - 2º intento (14:22 UTC, sesión `cse_01TnyYP8PXmc4andtn8iRMh9`): repo clonado OK, datos traídos OK
     (token ya andaba), prosa redactada y borrador guardado — **y ahí encontró el bug real**:
4. **Bug real de producción (regresión de A1, mismo día)**: `/informes/plantilla/diario` (la página
   que Playwright screenshotea para armar la placa) quedó atrás del gate de sesión de `src/proxy.ts`
   al prender `AUTH_ENFORCED` — el proxy solo exceptuaba `/api/informes/` y `/api/views/`, nunca se
   agregó `/informes/plantilla/`. La Routine se llevaba el HTML de `/ingresar` en vez de la placa. Sin
   este fix, la Routine de mañana (informe diario 18:30 ART) iba a volver a fallar, y lo mismo el
   informe semanal (usa la misma familia de rutas).
   - Verificado que el fix es seguro ANTES de aplicarlo: las plantillas (`src/app/informes/plantilla/
     {diario,semanal}/page.tsx`) ya validan su propio `INFORME_TOKEN` por searchParam
     (`tokenValido()`) — sacarlas del gate de sesión no las deja abiertas.
   - La sesión de la Routine armó el fix ella misma (rama propia, efímera, en su entorno) y lo mandó
     como parche (`.patch`) — se aplicó acá con `git am --3way`, limpio, sin conflictos.
   - De paso encontró y documentó un 2º problema de infraestructura: detrás del proxy del sandbox
     (`HTTPS_PROXY`), Chromium con TLS 1.3 muere con `ERR_CONNECTION_RESET` contra la plantilla de
     producción — hay que pasarle `proxy: {server: HTTPS_PROXY}` + forzar `--ssl-version-max=tls1.2`.
     Documentado en el Paso 4 de la skill `informe-diario` (y replicado en `informe-semanal`, mismo
     patrón de Playwright).
   - Mientras el fix no estaba mergeado, generó el informe de hoy igual con un workaround (build +
     `npm run start` local, sin pasar por el proxy — loopback no lo necesita) → **el informe diario
     del 27/07 se generó y mandó completo, de punta a punta** (`estado: enviado`, PNG en Storage, mail
     recibido).
5. **Replicado el mismo fix en `informe-semanal`** (Lautaro lo pidió explícito): mismo bloque de
   Playwright+proxy+TLS documentado, mismo pin de `model: claude-opus-5` / `effort: high` (la prosa
   con la voz de Lautaro la escribe el modelo grande — regla del proyecto, "juicio → Fable/Opus5").
   **`view-mercado` no necesitaba nada**: no usa Playwright (solo escribe a `views_mercado`, sin PNG/
   PDF) y ya tenía el modelo fijado a nivel de la Routine (`claude-opus-4-8`), no a nivel de la skill.
6. **Conflicto de merge en el PR #83**: mientras estaba abierto, se mergeó un PR ajeno (#84, otra
   sesión, skills técnicas de skills.sh) → `git merge origin/main`, único conflicto en `ESTADO.md`
   (las dos ramas agregaron su propia sección "Ahora" el mismo día) resuelto dejando la entrada de A1
   como "Ahora" y demoviendo la de skills a "Anterior".

## Decisiones tomadas (y por qué)
- Aplicar el parche de la sesión de la Routine tal cual, sin reescribirlo — ya venía verificado en
  producción real por esa misma sesión (`AUTH_ENFORCED=true` con y sin token).
- Mergear el PR apenas estuvo verde (CI + build), en vez de esperar el cierre normal de sesión —
  el bug bloqueaba la Routine de mañana y Lautoro ya había dado el visto bueno explícito ("hagamoslo").

## Verificado
- lint / `tsc --noEmit` / 201 tests / `npm run build` ✅ (los 3 commits: fix de line-up, patch de
  proxy.ts+skill diario, fix de skill semanal).
- `curl` real contra producción: `/api/informes/datos` y `/api/views/insumos` 200 con el token nuevo.
- Por SQL contra la base real: fila de `informes_generados` del 27/07 con `estado: enviado` y
  `path_png` seteado (confirmado por la sesión de la Routine, no simulado).
- Seguridad del fix de `proxy.ts`: confirmado por `grep` que ambas plantillas llaman `tokenValido()`
  antes de renderizar nada.

## Quedó pendiente / en vuelo
- **Informe semanal y view de mercado**: no se volvieron a disparar todavía contra el fix ya
  mergeado (se pausaron cuando apareció el bug de `/informes/plantilla/`, para no repetir el mismo
  problema 2 veces). Repetir el disparo manual una vez que este PR esté en `main` y deployado.
- Pedirle a Lautoro feedback real sobre el informe diario del 27/07 (contenido, tono, formato de la
  placa) — primera vez que lo ve de punta a punta.
- El resto de C18/V0 sigue abierto: cargar la key gratuita de USDA FAS, confirmar si una Routine
  puede invocar subagentes (precondición de C19/V1).
- A6 (probar `/admin/datos` logueado) sigue en la cola, sin retomar en esta sesión.

## Trampas descubiertas (para la próxima sesión)
- **La tool `add_repo`/`register_repo_root` no existe en el entorno headless de las Routines** — no
  asumir que sí. El acceso al repo privado en ese entorno funciona con `git clone` directo por el
  proxy preconfigurado (mismo mecanismo que usa cualquier sesión en este entorno), sin pasos extra.
- **Cuando Supabase Auth no encuentra el `redirectTo` en su lista de Redirect URLs, no tira error —
  cae en silencio al Site URL configurado** (ver también la sesión de A1 más arriba en este mismo
  archivo/día).
- **Cualquier ruta nueva que dependa de auth por token propio (no cookies de sesión) tiene que sumarse
  a mano a la lista de excepciones de `src/proxy.ts`** — no hay una convención de prefijo único
  (`/api/informes/`, `/api/views/`, `/informes/plantilla/` son 3 prefijos distintos, no un solo
  padre). Si se agrega una 4ª pieza de este tipo, revisar `proxy.ts` a propósito.
- **Detrás del proxy de este sandbox, Chromium con TLS 1.3 rompe contra HTTPS externo** — no es
  específico de esta web, es el proxy interceptor del entorno. Cualquier skill futura que use
  Playwright contra una URL de producción real (no `localhost`) va a necesitar el mismo
  `proxy: {server: HTTPS_PROXY}` + `--ssl-version-max=tls1.2`.
