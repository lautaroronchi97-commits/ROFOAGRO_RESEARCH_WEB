# Sesión 2026-07-28 — C24: camiones de Agroentregas (automático, por planta y empresa)

- **Rama:** `claude/plan-desarrollo-auditoria-matsqn` · **PR:** #_ (base `main`)
- **Objetivo pedido por Lautaro:** ejecutar **C24** del backlog maestro. Lo pidió después de
  descartar C14 y de dejar C23 en pausa. Su pedido textual al pasar la captura de la placa de
  Agroentregas: *"Si se puede pegar esa imagen genial. Sino cargo los totales"*.

## Hecho

**No hubo que pegar la imagen ni cargar totales: la fuente es automatizable.** El research
encontró que `agroentregas.com.ar/total-de-camiones.html` se alimenta de un **endpoint JSON
público sin auth** (`RestServiceImpl.svc/camiones`) que devuelve exactamente la placa que
Agroentregas postea, y con más detalle: por planta, por **empresa** y por grano. C24 dejó de ser
"carga manual diaria" y pasó a ser una ingesta automática más.

- **`src/lib/camiones/agroentregas.ts`** — parser puro y self-contained (mismo patrón/motivo que
  `williams.ts`: lo importa el script con Node plano). Desenvuelve el sobre XML de WCF, arma las
  filas de los 3 bloques (hoy + los 2 comparativos interanuales) y **exige que la suma del detalle
  por planta dé exacto la fila de totales que publica la propia fuente**, fallando si no cierra.
- **`scripts/ingest-camiones-agroentregas.mjs`** — importa ese parser (no lo reimplementa) y
  upsertea con la service key. Guards anti falso-verde: parseo/consistencia fallidos = `exit 1`,
  y día en curso con 0 camiones = `exit 1`.
- **`.github/workflows/ingest-camiones-agroentregas.yml`** — 2 corridas diarias (18:00 y 22:00
  ART), todos los días, con aviso por mail en rojo.
- **Migración `20260728150000`** — tabla `camiones_plantas` (aplicada por MCP y verificada).
- **`src/lib/camiones/plantas.ts`** + **`src/components/camiones/plantas-panel.tsx`** — panel
  "Pulso diario Up River" en `/comercio/camiones`, **arriba** del de Williams (es el único de los
  dos que llega solo). KPIs + serie por grano (público, reusa `CamionesChart` sin tocarlo) +
  tabla "quién recibió camiones hoy" por empresa (solo mesa).
- **Healthcheck** — check nuevo con umbral **3 días** (al revés que el de Williams, que es laxo:
  ver "Decisiones").

## Decisiones tomadas (y por qué)

- **Tabla aparte, NO filas de `camiones`.** Alcance elegido por Lautaro: "completo (grano + planta
  + empresa)". Los 28 destinos son Up River + Paraná bonaerense: **no hay Bahía Blanca ni
  Necochea**, y solo las plantas que Agroentregas atiende → su total **no es comparable** con el
  nacional de Williams. Meterlos en la misma tabla contaminaría el percentil estacional de la
  señal barcos-vs-camiones (`negocio/09`), cuyas dos patas son Gran Rosario **y Bahía Blanca**.
- **Complementa, no reemplaza.** Lautaro preguntó explícitamente si esto cambiaba el desarrollo
  actual y si evitaba la carga manual. Respuesta razonada: le saca la **urgencia** (el día a día
  ya lo cubre el cron) pero Williams queda como respaldo **nacional e histórico** — tiene 42.624
  filas desde 2018 y cubre las 2 zonas que la señal necesita; Agroentregas arranca de cero.
- **Guardar también los 2 bloques comparativos.** Es la única forma de tener historia: el endpoint
  ignora cualquier parámetro de fecha (probado) y no hay backfill posible. Corriendo el cron a
  diario, al año hay 3 años de estacionalidad de Up River construidos solos.
- **Dos corridas por día, todos los días.** El endpoint es la foto del día *en curso*: una vez que
  la fuente rota de fecha, ayer ya no se corrige nunca. La tardía toma el día casi cerrado, la
  temprana es red de seguridad; el upsert va por la fecha que dicta la respuesta, así que repetir
  es idempotente. Fines de semana incluidos (los puertos reciben los sábados).
- **Umbral de healthcheck corto (3 días), al revés que Williams (21).** Acá sí hay cron y no hay
  backfill: un atraso de más de 2 días significa **días perdidos para siempre**.
- **Serie por grano pública, apertura por empresa solo-mesa.** El dato crudo está abierto en la web
  de origen (no es un secreto), pero la lectura "quién está levantando" es research de mesa —
  mismo criterio que la señal en esa misma página. RLS con `select` a anon, igual que `camiones`.
- **Filas: grano solo si > 0, `TOTAL` por planta siempre (aunque sea 0).** Así "la planta reportó
  sin camiones" (la fuente lo marca `'SIN CAMIONES'`) queda distinguible de "no reportó ese día".

## Verificado

- **lint ✅ · tsc ✅ · build ✅ · 235/235 tests** (224 previos + **11 nuevos**, fixture = respuesta
  real del endpoint capturada el 28/07, sin retocar).
- **1:1 contra la placa que pasó Lautaro**, las 3 filas del encabezado incluidas: 28/07/2026
  4.560 camiones / 145.920 tn · 29/07/2025 2.846 / 91.072 · 30/07/2024 3.325 / 106.400, con la
  apertura por grano exacta en las tres.
- **Corrida real de la ingesta contra la base**: 233 filas, 3 fechas. Cotejado por SQL: 28 plantas,
  suma por grano = totales de la fuente, `total × 32 = ton aprox.`
- **RLS por SQL**: anon lee (233 filas) y **no puede escribir** (probado con un insert que
  falla y no deja basura). `get_advisors` sin hallazgos nuevos (todos los warnings son
  preexistentes y ya documentados).
- **Navegador con datos reales** (Playwright, claro/oscuro/mobile 390px): 4.560 el 28/07 (28
  plantas) · **+60,2% vs 29/07/2025** (4560/2846−1 = 60,22%, exacto) · maíz líder 2.413 · delta
  "día anterior" correctamente en "—" (el anterior con dato es de hace un año → el guard de
  contigüidad funciona). Tabla por empresa cotejada a mano: Cargill 352+324=676, Bunge
  440+180+29+13=662, ACA 286+191=477, y **los 17 exportadores suman exacto 4.560**. Cero errores
  de consola, cero scroll horizontal en mobile.
- Verificación del bloque de mesa con **bypass temporal de `esAdmin`**, revertido antes de cerrar
  (`git status` limpio de ese cambio).

## Quedó pendiente / en vuelo

- **El primer disparo real del cron** (post-merge): recién ahí se confirma end-to-end en Actions.
  Hasta entonces la tabla tiene los 3 días que cargó la corrida manual de esta sesión.
- **La historia se construye sola, pero lento**: hasta que no pasen meses, el panel muestra 3
  puntos isla (hoy + 2 comparativos). Es esperable, no un bug.
- Sigue pendiente medir si conviene, más adelante, cruzar la apertura por empresa contra el roster
  `shipper_norm` del line-up (hoy se muestran los nombres tal cual los da la fuente).

## Trampas descubiertas (para la próxima sesión)

- **El endpoint devuelve JSON envuelto en un sobre XML de WCF** (`<CamionesResult>{...}`), con el
  JSON escapado (`&quot;`). Hay que desenvolver y desescapar antes de parsear.
- **`?fecha=` no hace nada**: devuelve igual el día en curso. No hay forma de backfillear.
- **Los comparativos son el mismo día de la SEMANA, no la misma fecha** (28/07/2026 ↔ 29/07/2025 ↔
  30/07/2024, los tres martes). Son 364 días en este caso, pero puede ser 371 según el calendario
  → `plantas.ts` busca en una ventana de ±1 semana en vez de clavar el número.
- **El `fetch` de Node no usa el proxy del sandbox** (ya documentado en `CONTEXTO.md`, pero acá
  muerde fuerte: la fuente devuelve **HTTP 503** sin proxy y 200 con él). Correr el script con
  `NODE_USE_ENV_PROXY=1`. En Actions/Vercel no hace falta.
- **Cuidado al reiniciar `npm run start` para verificar en navegador**: quedó un server viejo
  sirviendo el build anterior y el bloque de mesa aparecía como `false` en el RSC pese al bypass
  ya aplicado — casi se diagnostica como un bug de la lógica. Matar el proceso y confirmar que el
  que responde es el build nuevo antes de sacar conclusiones.
- `idDp` (id de planta) viene con **padding de espacios** (`'4         '`) y es estable entre años
  (verificado contra los bloques de 2025 y 2024) — sirve como clave, pero hay que trimearlo.
