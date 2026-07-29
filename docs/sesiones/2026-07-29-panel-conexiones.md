# Sesión 2026-07-29 — Panel /admin/conexiones (monitoreo)

- **Rama:** `claude/admin-crons-panel-9p8f62` · **PR:** #_ (base `main`)
- **Objetivo pedido por Lautaro:** un panel dentro de `/admin` para ver de un vistazo qué carga
  manual falta, cuándo fue la última vez y cuándo toca la próxima; si los crons corrieron o no; si
  las Routines produjeron lo suyo; y si el WebSocket de A3 está trayendo datos en vivo. En una
  palabra: todas las conexiones externas del proyecto, en un solo lugar.

## Hecho

**Catálogo único, `src/lib/monitoreo/catalogo.ts`** (sin `import "server-only"`, lo importan tanto
Next como el script de Node): mueve `CHECKS`/`MATVIEWS`/`FUTURO`/`ULTIMO_SEED_CALENDARIO` desde
`scripts/healthcheck-frescura.mjs` (que ahora los importa, cero duplicación con el panel) y suma lo
que no existía en ningún lado: `WORKFLOWS` (los 14 crons con schedule + los 2 dispatch-only, con su
horario ART en texto y qué `CHECKS` alimentan), `CARGAS_MANUALES` (las 7 secciones de
`/admin/datos` + revisar interpretaciones + calificar el view, con ancla y cadencia esperada) y
`ROUTINES` (informe diario/semanal/view de mercado).

**Libs de estado, `src/lib/monitoreo/`** — separadas en pares "lógica pura" (testeable con Vitest,
sin `server-only`) + "wrapper de I/O" (`server-only`, hace los fetch), porque el paquete
`server-only` tira un error apenas se lo importa fuera de un Server Component — ni siquiera bajo
Node/Vitest (confirmado empíricamente). Mismo patrón que ya usa `anomalias.ts` en el repo:
- `manual-logica.ts` / `manual.ts`: `esHabil`/`isoMenosDias`/`huecosHabiles` (ahora la ÚNICA
  definición — `/admin/datos` las importaba duplicadas a mano, ahora las importa de acá) +
  `getCargasManuales()` con una regla de "última carga" por ítem (ver tabla abajo).
- `routines-logica.ts` / `routines.ts`: `ventanaEsperada()` (¿a esta Routine ya le tocaba correr
  hoy?) + `evaluarInforme()`/`evaluarView()`, y `getRoutines()` que las cruza contra
  `informes_generados`/`views_mercado`.
- `frescura.ts`: versión "en vivo" del veredicto de `healthcheck-frescura.mjs` (mismo catálogo,
  mismos umbrales) para mirar en cualquier momento del día, no solo a las 20:45.
- `github-runs.ts`: último run real de cada workflow vía la API de GitHub. Sin `GH_MONITOR_TOKEN`
  devuelve `disponible:false` y el panel degrada solo a mostrar la frescura del dato.

**`a3Ping()` en `src/lib/a3-live.ts`**: pide puntas de UN solo símbolo real (nunca inventado — A3
rechaza la suscripción entera si un símbolo no existe de su lado) para saber barato si el WS
responde, sin exponer `fetchPuntas` (que sigue privada del módulo).

**UI, `src/app/admin/conexiones/page.tsx`** + pestaña nueva en `admin-tabs.tsx` +
`BIBLIOTECA_ADMIN`: 3 KPIs arriba (cargas pendientes / crons con problema / A3) y 4 bloques —
Cargas manuales (tabla con link "Ir →" a cada sección de `/admin/datos`, que ahora tiene
`id="agrochat|camiones|mesa-color|bcra-manual|dea|pas|lecap"` para las anclas), Crons automáticos
(reusa las clases `.estado-aprobado/.estado-pendiente/.estado-bloqueado` ya existentes como
semáforo verde/dorado/rojo), Routines (cards `.sf-card`, mismo patrón visual del semáforo
físico→precio) y En vivo/estructural (A3, Supabase, matviews, vencimientos futuro, seed calendario).
Solo lectura + links — sin botón "correr ahora" (decisión tomada con Lautaro, ver abajo).

## Decisiones tomadas (y por qué)

- **Solo lectura + links, no botón "correr ahora"** — Lautaro eligió la opción sobria por
  `AskUserQuestion`: menos superficie de riesgo, y re-correr un workflow desde GitHub son 2 clicks
  igual.
- **Token de GitHub opcional (`GH_MONITOR_TOKEN`), con degradación limpia** — Lautaro eligió tenerlo
  (ve el run real: verde/rojo/hora/link), pero el panel nunca depende de él: sin la env var cae
  solo a mostrar la frescura del dato en Supabase (que ya cubre "¿el dato entró?", aunque no
  distinga "¿el job en sí falló hoy?" hasta que el dato se atrasa).
- **No existe `ingest_log` en el repo** (confirmado por research: solo está mencionado como
  pendiente en `INFRAESTRUCTURA.md`/`PLAN_BACKLOG.md`, nunca implementado) — por eso el panel
  combina 3 fuentes de verdad distintas en vez de leer una tabla de corridas: la API de GitHub
  (¿corrió?), la frescura de Supabase (¿el dato entró?) y `informes_generados`/`views_mercado`
  (¿la Routine produjo lo suyo?).
- **"Última carga" usa columnas distintas según la tabla, no una regla única** — verificado migración
  por migración: `compras`/`camiones` NO refrescan su columna de auditoría al re-subir una fila ya
  existente (`on conflict do update` no toca `creado_en`/`actualizado_en`), así que ahí se usa
  `fecha` (la fecha del dato) como proxy. `estimaciones_produccion`/`compras_bcra`/`mesa_color`/
  `lecap_pago_final` SÍ refrescan su columna de auditoría en cada upsert, así que ahí se usa esa
  columna — importante para DEA/PAS, donde `fecha_publicacion` puede ser de días atrás (el caso real
  ya documentado en `PLAN_INFORMES_V2.md`: Lautaro carga el PAS con la fecha REAL del informe).
- **Umbrales asimétricos por ítem manual** (Agrochat rojo a los 14d, Williams solo dorado a los 21d
  nunca rojo, PAS/LECAP solo dorado sin deadline duro) — mismo criterio que ya usaba
  `healthcheck-frescura.mjs` para no generar ruido sobre procesos sin cadencia comprometida.
- **`ventanaEsperada()` no marca "atrasado" algo que todavía no le tocó correr hoy** — cada Routine
  tiene su horario + un margen de 45 min; antes de esa hora en el día que le toca, el estado es
  "pendiente" (neutro/dorado), no "atrasado" (rojo). Recién pasado ese margen (o si la fecha
  esperada ya quedó en el pasado) pasa a "atrasado".

## Verificado

- `npm run lint` / `npx tsc --noEmit` / `npx vitest run` (**288/288**, 40 tests nuevos: 9 de
  `manual-logica.test.ts`, 21 de `routines-logica.test.ts`, 5 de `catalogo.test.ts` — más un test de
  consistencia que falla si `WORKFLOWS[].checkNombres` o los `href` de `CARGAS_MANUALES` se
  desincronizan del catálogo real) / `npm run build` ✅.
- `node scripts/healthcheck-frescura.mjs` corrido real contra la base tras el refactor: **mismo
  output exacto que antes del cambio** (15 checks + 3 matviews + 1 seed de futuro + seed de
  calendario + roster, todo ✓) — el consumidor existente no se rompió.
- Playwright real (Chromium, con las claves públicas de Supabase del proyecto — `SUPABASE_URL`/
  `SUPABASE_SERVICE_KEY` ya estaban en el entorno; `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` se
  obtuvieron por MCP de Supabase para este sandbox) contra `/admin/conexiones` y `/admin/datos`,
  claro + oscuro + mobile 390px: cero errores de consola, cero scroll horizontal, los 9 ítems de
  cargas manuales y las 3 Routines mostrando datos reales coherentes. **Cruce independiente
  verificado**: mi cálculo de huecos de BCRA (`estadoBcraManual`) dio exactamente "27/07, 28/07" —
  idéntico al que ya calculaba `/admin/datos` con la lógica original (ahora compartida vía
  `huecosHabiles`), confirmando que el refactor preservó el comportamiento exacto.
- **Hallazgo real durante la verificación** (no un bug del panel): la Routine "View de mercado"
  quedó marcada ATRASADO/"No corrió" porque las 2 corridas reales en `views_mercado` están fechadas
  martes 21/07 y lunes 27/07 — ninguna es viernes, la fecha que la skill escribe es literalmente
  "hoy Córdoba" al momento de correr (confirmado leyendo `view-mercado/SKILL.md`). Ambas corridas
  fueron disparos manuales de sesiones de build/diagnóstico (documentado en `ESTADO.md`: 21/07
  primer view real, 27/07 verificación post-fix de C18), no el cron semanal (`0 12 * * 5`,
  creado 23/07) disparando solo. El panel está señalando correctamente que el cron todavía no
  produjo una corrida real de viernes — se confirma el viernes 31/07 si corre sola.
- Bypass temporal de `requireAdmin()` (`dal.ts`) + del gate de `/admin` en `proxy.ts`
  (`LOCAL_ADMIN_BYPASS`), **revertidos con `git checkout --` antes de cerrar** — `git status`
  confirma que solo quedan los archivos de la feature, sin residuo.

## Quedó pendiente / en vuelo

- **`GH_MONITOR_TOKEN` sin cargar** (pendiente manual de Lautaro): crear un fine-grained token de
  GitHub con permiso Actions: Read-only sobre `ROFOAGRO_RESEARCH_WEB` y cargarlo en Vercel
  (Production) — instrucciones completas en el comentario de `.env.local.example`. Sin él, el
  bloque "Crons automáticos" del panel muestra "Sin señal (falta el token)" en los 3 workflows sin
  tabla propia (healthcheck/chequeo-anomalias/refresh-calendario) y "Dato al día"/"Dato atrasado"
  (derivado de frescura, no del run real) en el resto.
- **Primer vistazo real de Lautaro al panel logueado** — todo lo de arriba se verificó con el
  bypass temporal; falta la confirmación humana con su sesión real.
- Registrar el panel como ítem cerrado en el backlog maestro (`docs/auditoria/E7-sintesis.md` §4) —
  hecho en este mismo cierre de sesión.

## Trampas descubiertas (para la próxima sesión)

- **`server-only` rompe Vitest**: importar el paquete `server-only` (aunque sea indirectamente)
  hace fallar la carga del módulo bajo Vitest con "This module cannot be imported from a Client
  Component module" — incluso corriendo en Node puro, no es un tema de bundler. Cualquier lógica
  que se quiera testear tiene que vivir en un archivo SIN `server-only`, con el wrapper de I/O
  (que sí lo tiene) importándola. Confirmado con un test descartable antes de escribir las libs
  reales.
- **Dos gates de auth distintos e independientes para `/admin`**: `requireAdmin()` en
  `src/lib/auth/dal.ts` (a nivel de página/layout) Y el `proxy.ts` (`updateSession`, a nivel de
  request, corre ANTES). Para levantar un bypass local de verificación hace falta tocar los DOS —
  bypasear solo `requireAdmin()` no alcanza, el proxy redirige a `/ingresar` antes de que la página
  se renderice.
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY` retipeada a mano es un riesgo real de typo**: el JWT legacy
  `anon` es largo y un carácter mal transcripto da "Invalid API key" sin ningún otro síntoma — el
  `createSupabaseServerClient()` server-side falla silencioso y el componente que lo usa ve 0 filas
  (no un error visible). La `sb_publishable_...` (formato nuevo, ~44 chars) es muchísimo más fácil
  de transcribir sin error y funciona igual de bien para verificación local — preferirla la próxima
  vez que haga falta cargar credenciales públicas a mano en un sandbox.
- El sandbox de esta sesión SÍ tenía `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` reales como env vars del
  proceso (no en `.env.local`) — permitió correr `healthcheck-frescura.mjs` y consultas reales por
  curl sin pedir nada. Las claves públicas (`NEXT_PUBLIC_*`) hubo que pedirlas por el MCP de
  Supabase (`get_project_url`/`get_publishable_keys`) porque no estaban en el entorno.
