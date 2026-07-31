# ROFO AGRO — Contexto del proyecto (handoff para sesiones nuevas)

> Web de research de mercado de granos (Argentina) para la consultora **ROFO AGRO** (Lautaro + Mauro).
> Doble uso: panel para Lautaro (datos varias veces por día) + datos de cierre para clientes
> (productores / acopios). El tiempo real tick-a-tick lo maneja Lautaro aparte (Excel + eTrader);
> esta web es **demorado / varias veces por día**, no realtime.
>
> **Deploy:** https://rofoagro-research-web.vercel.app · **Rama de integración: `main`** (todo entra por PR a `main`).
> Cada sesión trabaja en su rama `claude/*` creada DESDE `main`.
>
> ⚠️ **ANTES de empezar cualquier sesión: leé [`docs/ESTADO.md`](ESTADO.md)** (tablero vivo: qué hay en
> producción, qué ramas están abiertas, qué sigue) y la última entrada de [`docs/sesiones/`](sesiones/).
> El protocolo de trabajo entre sesiones está en `ESTADO.md`.

## Cómo trabajar con Lautaro (reglas)
- Principiante en programación: explicá cada comando/concepto paso a paso.
- **No supongas nada**; ante dudas de negocio/dato/alcance, preguntá antes de avanzar.
- Incremental: plan → aprobación → construir → mostrar funcionando → validar. Commits frecuentes.
- **Las fórmulas financieras las define él**: antes de implementar una, confirmala con un ejemplo
  numérico. **NO modifiques una fórmula existente** (tasas, spreads, conversiones de días) sin
  mostrarle el diff exacto y esperar su confirmación explícita — los tests con fixtures del Excel
  deben seguir pasando, o hay que avisarle por qué cambian.
- **Esquema de Supabase y API pública: avisar ANTES de tocar.** Ningún cambio de esquema (tablas,
  RLS, policies, funciones, grants) ni de la API pública sin avisarle primero; las migraciones se
  versionan en `supabase/migrations/` y se aplican recién con su OK explícito.
- **Un fix por vez.** Antes de empezar cada uno, avisar qué se va a tocar. Commits chicos, uno por fix.
- **Si algo falla, frenar**: no seguir de largo — parar y explicarle qué pasó.
- **Nada se da por terminado sin `npm run lint` + `npx tsc --noEmit` + `npx vitest run` en verde**
  (build incluido si se va a pushear — ver protocolo en `ESTADO.md`).
- Secretos SOLO en variables de entorno, NUNCA en el repo.
- Conciso, sin relleno. Español rioplatense.
- **Voz de Lautaro**: para cualquier texto que se redacte en su nombre (informes, reportes de
  mercado "Mesa de operaciones", posteos, hilos, emails, mensajes), considerar la skill
  **`voz-lautaro`** (`.claude/skills/voz-lautaro/`) como referencia de su forma de hablar (voseo
  siempre, rigor + calle, humildad, datos exactos, emojis funcionales). **No es excluyente**: es una
  guía a tener en cuenta, no fuerza jerga de agro donde el tema no lo pide, y convive con registros
  más sobrios (ej. copy institucional de la landing).

## Stack
Next.js 16 (App Router) + TypeScript · Tailwind v4 · next-themes · gráficos SVG a mano (Recharts previsto) ·
**Supabase CONECTADO** (proyecto `lineup-argentina`, lectura anon con RLS; tablas `futuros_cierres`,
`vencimientos`, `djve` (registro DJVE **2011→hoy**: histórico backfilleado 19/07/2026 de los XLS oficiales
SSMA, 334k filas, col. `cosecha` para la era ROE sin ventana de embarque), `lineup`, `compras` (serie semanal de comercialización SIO Granos 2019→hoy, 7 granos × 2 sectores ×
campañas; se actualiza por el scraper MAGyP y por el uploader admin `/admin/datos` con el export de Agrochat;
alimenta `/comercio/negociado` y la pata C3 del índice MESA), **`pizarra_historico`** (pizarra CAC 2020→hoy, $ y US$,
5 granos), **`cbot_cierres`** (futuros CBOT maíz/soja/trigo, ¢/bu + USD/tn), `noticias` (portal del agro,
`sesiones/2026-07-10-portal-noticias.md`), **`estimaciones_produccion`** (una fila por vintage: producción/área/
rinde por organismo/país/grano/campaña — USDA, CONAB, BCR-GEA, SAGyP-DEA; poblada 12/07) y `calendario_informes`
(base; en v1 el calendario se genera en código) — detalle en las sesiones abajo) · Deploy en Vercel.
TZ America/Argentina/Cordoba.

## Design system — "Pizarra electrónica" (aprobado; rediseño premium 09/07/2026 PR #5 → tipografía
"Argentina" + motion, rediseño premium front/UI/UX 28/07/2026 PR #88)
Tokens en `src/app/globals.css`. Paleta del logo: verdes (RF `#2F6E34` / AGRO `#4E9C3A`) + trigo `#EFBF2E`;
fondo claro `#EDF2E3`. Semáforo vivo: pos `#16A34A`/`#37D982`, neg `#DC2626`/`#FF5C5C`. Dos temas, un solo
sistema de tokens: claro **"Research de banca privada"** (clientes) / oscuro **"Sala de operaciones"**
(trader). Marca: **ROFO AGRO** (nunca "CONSULTAR"). Glifos trigo/soja/maíz, cinta tipo pizarrón.
**Tipografía "Argentina" (28/07/2026, PR #88):** Piazzolla (Huerta Tipográfica, Buenos Aires) para
titulares/números protagonistas · Rosario (Omnibus-Type) para UI/prosa · IBM Plex Mono para datos
tabulares — las 3 vía `next/font/google` (autohospedadas, sin red en runtime), reemplazan Inter +
JetBrains Mono. Display aplicado quirúrgicamente (`--font-display`): wordmark, `.panel-hd h2` (TODO panel
del sitio), titulares editoriales (home/landing/producción/auth). **Los números de mercado SIEMPRE en
mono, nunca display** — restricción deliberada, terminal financiera de verdad.
**Rediseño premium (solo presentación, cero cambios de datos/fórmulas):** oscuro = carbón verde profundo
(`#060A07`, paneles `#0C130D`–`#152017`) con atmósfera radial sutil; claro = papel crema con regla doble
editorial bajo el masthead. Oro `#EFBF2E` SOLO como acento (hairlines, filos, glow) — mantener esa
avaricia. Bordes hairline translúcidos, sombras multicapa, `::selection` dorada, scrollbars finas,
contraste AA verificado. **Motion medio (28/07/2026)**, todo gated en `prefers-reduced-motion`: cinta con
marquee continuo (pausa en hover/foco), entrada en cascada fade+rise de paneles/tarjetas, transición de
color suave al cambiar de tema. Masthead con filo dorado (mínimo desde C25 28/07: logo · rueda ·
tema · sesión — la nav se mudó a la **sidebar** lateral, ver más abajo), cinta con fades, tablas con
hover/tick dorado, charts con grilla punteada + área en degradé, footer colofón.

## Fuentes de datos (Fase 0, validadas con requests reales) — todo REST
| Dato | Fuente | Endpoint / nota |
|------|--------|-----------------|
| Futuros granos + dólar (reales) | **A3 / Cocos xOMS** (Primary) | `api.cocos.xoms.com.ar`: `POST /auth/getToken` → `GET /rest/marketdata/get`, `GET /rest/instruments/bySegment` (segmentos **DDA** granos, **DDF** dólar) |
| Dólar futuro, volumen rueda, **oficial mayorista** | **MAE** | `api.marketdata.mae.com.ar` → `/api/mercado/resumen/DDF`, `/volumen-categoria/{ARS\|USD}`, `/resumen/FOR` (ticker **`UST$T`** = oficial mayorista/A3500) |
| Dólar linked, LECAPs, BONCAPs | **data912** | `data912.com/live/arg_notes` (serie `D*`=linked, `S*`=LECAP), `/live/arg_bonds` (`T*`=BONCAP — data912 los clasifica como "título", no como "letra") |
| Oficial / MEP / CCL / mayorista | dolarapi + criptoya | `dolarapi.com/v1/dolares`, `criptoya.com/api/dolar` |
| Macro / reservas | BCRA v4 | `api.bcra.gob.ar/estadisticas/v4.0/monetarias` (v3 deprecada) |
| Pizarra soja/maíz/trigo (día) | **CAC-BCR** | `www.cac.bcr.com.ar/es/precios-de-pizarra` (scrape HTML; trae `$` y `US$` + TC BNA) |
| Pizarra histórica 2020→hoy (5 granos, $ y US$) | **CAC-BCR (consulta)** | `www.cac.bcr.com.ar/es/precios-de-pizarra/consultas?product={13\|3\|8\|9\|6}&type=any&period=day&date_start=&date_end=` → JSON en `drupalSettings.app_prices.plot.data` (`y`=$/tn, `y_usd`=US$/tn). US$ = BNA divisa comprador. Trocear en ventanas ≤3 años. → `pizarra_historico` |
| FOB oficial de granos (base de derechos de exportación) | **SAGyP/MAGyP** | `www.magyp.gob.ar/sitio/areas/ss_mercados_agropecuarios/ws/ssma/precios_fob.php?Fecha=dd/mm/aaaa` (API JSON pública sin auth, por posición NCM y ventana de embarque; posiciones homologadas empíricamente por grano — ver `sesiones/2026-07-24-c16-capacidad-pago.md`). Alimenta el FAS teórico propio del panel de Capacidad de pago (`fob-oficial.ts` + `capacidad-modelo.ts`) |
| Estimaciones de producción — USDA (WASDE+PSD), CONAB | **USDA / CONAB** | `ingest-usda.mjs` (CSV tidy del WASDE por edición = vintages soja/maíz/trigo por país + mundo; PSD bulk ZIP = área/rinde 6 granos + producción girasol/sorgo/cebada) · `ingest-conab.mjs` (`LevantamentoGraos.txt`, 27 UF → nacional Brasil, vintages 2017/18→hoy). → `estimaciones_produccion`. Detalle: `sesiones/2026-07-12-estimaciones-usda-conab.md` |
| Estimaciones de producción — Argentina (BCR-GEA, SAGyP-DEA, BCBA-PAS) | **BCR / SAGyP / BCBA** | `ingest-gea.mjs` (scrape tablas `bcr-estimaciones` de soja/maíz/trigo + backfill Wayback) · `ingest-dea.mjs` (POST del CSV oficial `datosestimaciones.magyp.gob.ar` → nacional por cultivo/campaña, 6 granos, snapshot=vintage) · `ingest-pas.mjs` (BCBA: **descartado automatizar**, Cloudflare confirmado también desde IPs de GitHub Actions — `pas_probe` 12/07, HTTP 403; respaldo = suscripción por mail de Lautaro). → `estimaciones_produccion`. Detalle: `sesiones/2026-07-12-estimaciones-argentina.md` y `auditoria/E6-historia.md` |
| Futuros CBOT maíz/soja/trigo (por posición, vencidos incl.) | **Barchart (API interno)** | `barchart.com/proxies/core-api/v1/historical/get` (auth por cookie `XSRF-TOKEN` del `/overview` + header `x-xsrf-token`). ¢/bu fraccionario (`"565-2"`=565,25). USD/tn: maíz ×0.3936826, soja/trigo ×0.3674371. → `cbot_cierres` |
| Camiones en puerto — Up River por planta, empresa y grano | **Agroentregas** | `agroentregas.com.ar/RestServiceImpl.svc/camiones` (JSON público sin auth, envuelto en sobre XML de WCF). Foto del día EN CURSO: ignora cualquier parámetro de fecha, **sin backfill posible** — pero cada respuesta trae además el mismo día de la SEMANA de hace 1 y 2 años, y la ingesta los guarda (así se acumula estacionalidad sin backfillear). Cron 2×/día todos los días (`ingest-camiones-agroentregas.mjs`) → `camiones_plantas`. ⚠️ **NO es el total nacional**: Up River + Paraná bonaerense, sin Bahía Blanca ni Necochea → tabla propia, nunca se mezcla con `camiones` (Williams). Detalle: `negocio/10_fuente_camiones_agroentregas.md` |
| Camiones en puerto — 4 zonas nacionales por producto (serie histórica 2018→hoy) | **Williams Entregas** (vía export de Agrochat) | Servicio B2B pago sin API → **carga manual** por `/admin/datos` (`williams.ts`). → `camiones`. Es la serie que alimenta el percentil estacional de la señal barcos-vs-camiones (`negocio/09`) |
| **Noticias del agro** (portal) | **medios + Google News** (RSS + scrape) | Cron horario `ingest-noticias.mjs` → tabla Supabase `noticias`. Medios directos: BCR resumen + InfoCampo, Bichos de Campo, Ámbito, La Nación Campo, Clarín Rural, Agrositio (granos/economía/clima), dataPORTUARIA, TodoAgro, Cebada Cervecera, Agrofy News (scrape), G1 Brasil, World-Grain. **+ vía Google News RSS** (link-out, para fuentes sin feed propio/bloqueadas): bolsas (Rosario/BsAs/Córdoba), internacional (Reuters/Bloomberg/AgWeb/CME…), informes (USDA/CONAB/CFTC) e instituciones (CIARA/CREA/Aapresid/Coninagro). Categorización PROPIA por reglas (`noticias-reglas.json`); dedup por link + por título (colapsa la misma nota directa vs. Google). Detalle: `sesiones/2026-07-10-portal-noticias.md` |

> **Directorio completo de fuentes de noticias/informes/datos del agro** (relevamiento de Lautaro, 06/07/2026):
> [`docs/FUENTES.md`](FUENTES.md) — oficiales AR, bolsas, cadenas por cultivo, mercados, logística, clima,
> internacional (USDA/CONAB/etc.), consultoras, medios y calendario de publicación. Alimenta el módulo
> **Noticias** (fuentes propias, ya implementado — ver fila arriba) y el futuro **Calendario de informes**.
>
> **Base de conocimiento del negocio** (correacopio / mesa de trading, referencia permanente):
> [`docs/negocio/`](negocio/) — `01_contexto_negocio` (estructura, instrumentos, pricing, estrategias,
> financiero, glosario) · `02_logicas_y_principios` (reglas + **REGLAS DEL DELTA** §6) ·
> `03_modulo_comportamiento_cliente_vendedor` (scoring AHP + P&L, producto a futuro) ·
> `04_datos_y_workarounds` (intranets de acopios, reportes, parseo de exports) ·
> `05_djve_marco_y_circuito` (research verificado 18/07/2026: Ley 21.453, regímenes 30/360,
> circuito del grano, cronología de retenciones 2023-2026, implicancias para los paneles).
> Sin datos personales.

## Metodología de fórmulas (confirmada con Lautaro)
- **Referencia oficial = oficial mayorista MAE** (ticker `UST$T` de `resumen/FOR`, **plazo `000` = T+0**;
  el resumen trae también la fila plazo `001` = T+1 — decisión de Lautaro, auditoría E2 21/07/2026).
  NO el minorista.
- **Dólar futuro** (spot = mayorista MAE, base 365): directa = Fut/Spot − 1 · TNA = directa × 365/días ·
  TEA = (Fut/Spot)^(365/días) − 1 · TEM = (1+TEA)^(1/12) − 1.
- **Dólar linked** (vs oficial MAE, base 365, misma lógica): TC implícito = Px/100 · spread of. = Oficial − TCimpl ·
  TNA/TEA/TEM con Oficial/TCimpl. Vencimiento inferido del ticker (`D` + dd + letra-mes + yy).
- **Arbitrajes granos** (implementado el 08/07 con cierres CEM + pizarra CAC): tasa directa =
  (precio futuro / pizarra USD) − 1 · TNA USD = directa × 365/días al vto (act/365). Pizarra USD desde
  CAC (+ override manual + editable en el panel).

## Estado de módulos (`src/components/`)
| # | Módulo | Estado |
|---|--------|--------|
| 0 | Cinta | REAL (dólares). Pizarra en la cinta = ejemplo (falta usar CAC). |
| 1 | Arbitrajes | **REAL** (`arbitrajes-cierres.ts` + `arbitrajes-editable.tsx`): futuro vs pizarra USD de CAC (`pizarra.ts`, scrape + override). **1ª columna dinámica** (`arbitrajes-table.tsx` + `ruedaAgroCorrioHoy`): fuera de rueda = último **ajuste** (A3/CEM); en rueda se borra y muestra el último **operado** en vivo (— hasta operar), post-cierre hasta que sale el próximo ajuste. Spread/tasa directa/**TNA USD**/Vol se recalculan sobre esa referencia (todo en vivo). **Pizarra editable**. **+ Comprador/Vendedor del futuro en vivo** (`a3-live.ts`, A3 en horario de rueda). Refresh en vivo por poll cada 30s con rueda abierta (`refresh-on-focus.tsx`). |
| 2 | Pases | **REAL** (`pases-cierres.ts`): spread de ajuste + tasa directa + **TNA** (días entre vtos, tabla `vencimientos`). **+ Comprador/Vendedor/Último/Vol del pase en vivo** (`a3-live.ts`, instrumento `GRANO.ROS/POS1/POS2` de A3, en horario de rueda). |
| 3 | Dólar futuro | REAL (MAE) + TNA/TEM/TEA. |
| 4 | Dólar linked | REAL (data912) + TNA/TEM/TEA + spread oficial MAE. |
| 5 | Implícitas combinadas | REAL (futuro + linked); granos = ejemplo. |
| 6 | Sintéticos/LECAPs y BONCAPs | **REAL** (`market/sinteticos.ts` + `sinteticos.ts` puro): sintético = spot×(pagoFinal/px), directa, TNA act/365; empareja letra/bono↔DLR por mismo mes; compara vs futuro directo. Precio de LECAP (`arg_notes`) y BONCAP (`arg_bonds`) de data912 (`market/lecaps.ts`); **pago final** por carga semi-manual en `/admin/datos` (tabla `lecap_pago_final`, fuente última BYMA, casi estático). C13/P9, `sesiones/2026-07-24-c13-sinteticos-tir.md` + `sesiones/2026-07-29-boncaps-live.md`. |
| 7 | Panel cambiario | REAL (volumen MAE). Compras netas BCRA = pendiente (sin API; proxy / vía X). |
| 8 | Noticias (portal) | **REAL** (`noticias.ts` lee Supabase `noticias` + fallback en vivo; `noticias-panel.tsx` + `noticias-client.tsx`). 15 medios vía cron horario, **categorización propia** por reglas (`noticias-reglas.json` + `noticias-clasificar.ts`), filtro de ruido, chips de filtro, link-out. Detalle: `sesiones/2026-07-10-portal-noticias.md`. |
| 9 | Producción — calendario + estimaciones (página `/produccion`) | **REAL** (poblado 12/07). Calendario de informes generado en código (`calendario.ts`); pizarra de estimaciones + gráfico de evolución + tarjetas de cambios desde `estimaciones_produccion` (`estimaciones.ts` + `estimaciones-panel/cliente.tsx` + `evolucion-chart.tsx`). Fuentes: USDA (WASDE+PSD), CONAB, BCR-GEA, SAGyP-DEA (comparador AR lado a lado). BCBA-PAS descartado de automatizar (Cloudflare confirmado 2/2, ver `auditoria/E6-historia.md`) — respaldo por mail. Home: mini-tabla USDA (`estimaciones-mini.tsx`). Crons: `ingest-usda/conab.yml` + `ingest-estimaciones-ar.yml`. Detalle: `sesiones/2026-07-12-estimaciones-argentina.md`. |

## Secretos / entorno
- **A3** en variables de entorno (Vercel → Settings → Environment Variables): `A3_API_BASE=https://api.cocos.xoms.com.ar`,
  `A3_USERNAME`, `A3_PASSWORD`. Local: `.env.local` (git lo ignora; plantilla en `.env.local.example`).
  `src/lib/a3.ts` las lee de env. **Nunca** en el repo.
- **Red del entorno web (sandbox):** allowlist con los hosts de datos. Si una fuente da 403 del proxy, falta el host.
- **Sandbox tip:** el `fetch` de Node no usa el proxy → para ver datos reales corriendo local en el sandbox,
  usar `NODE_USE_ENV_PROXY=1 npm run dev` (o build). En Vercel no hace falta.

## A3 — verificado OK
Token válido, 349 instrumentos DDA (granos) + 69 DDF (dólar), market data real llegando. Formatos de símbolo:
futuros `SOJ.ROS/JUL26`, pases `MAI.ROS/SEP26/DIC26`, dólar `DLR/JUL26`; opciones traen strike+`C/P` (excluir),
disponible = `/DISPO`. **Límites:** el REST `marketdata/get` es **de a UN símbolo** y A3 lo **rate-limitea
(HTTP 429)** al pedir muchos seguidos → por eso la MD en vivo va por **WebSocket** (la doc oficial lo indica).
**Feed en vivo (WebSocket, 13/07):** `src/lib/a3-live.ts` (`fetchPuntas`) abre **una conexión WS**
(`wss://<host>/`, header `X-Auth-Token`) y suscribe TODOS los instrumentos en un mensaje `smd`; Primary manda
el snapshot de cada uno (puntas + último + volumen). Reemplazó el polling REST (que dropeaba posiciones por el
429). Se abre por la regeneración ISR de la página (`revalidate = 30`), NO por un cron. Dep `ws` +
`serverExternalPackages:["ws"]`. Detalle: `sesiones/2026-07-13-arbitrajes-en-vivo.md` (Follow-up 2). Un cron
queda SOLO para el histórico intradiario (Fase 2, tabla `snapshots`).

## Auditoría integral (07/07/2026) — hecha, Fase 0+A aplicada
Se auditó todo (arquitectura/datos, UI/UX, seguridad/repo) + plan por fases revisado por experto.
**Ya aplicado** (commit `fff4f40`): React.cache() dedup de fetches (16→6 por regeneración), Result
tipado + guards, stamps honestos (SourceStamp REAL/PARCIAL/EJEMPLO + "datos al HH:MM"), refresh
al volver a la pestaña, tema sin bloque @media duplicado, contraste AA, touch-action:pan-y,
headers de seguridad, robots noindex (mientras haya EJEMPLO), README real, CI (GitHub Actions),
favicon de marca. **Cero credenciales en historial de git (verificado).**

### Flujo de deploy (vigente desde la unificación del 09/07/2026)
- **`main` = la ÚNICA rama de integración y producción.** Todo el trabajo va en ramas `claude/*` creadas
  **desde `main`** → Preview URL en Vercel; publicar = PR con **base `main`** → merge (GitHub UI).
  Historia y pasos del switch: [`docs/PLAN_ORGANIZACION_REPO.md`](PLAN_ORGANIZACION_REPO.md).
- **NUNCA** abrir PRs contra otra rama que no sea `main`, ni actualizar `CONTEXTO.md`/`ESTADO.md` en dos
  ramas a la vez (así se partió la historia en dos entre el 07 y el 09/07).
- Los `schedule` de GitHub Actions (cron de cierres) corren SOLO desde la rama default de GitHub → la
  default debe ser `main` y los workflows viven ahí.
- Env vars sensibles con scope **Production only**.
- Vercel Hobby es no-comercial → decidir upgrade a Pro ANTES de poner datos reales frente a clientes (C2).

## Pendientes

> **Retirada la lista propia (21/07/2026, auditoría E6) y backlog consolidado (22/07/2026, auditoría
> E7):** desde el cierre de la auditoría integral, **la única lista donde se prioriza y se tacha es el
> BACKLOG MAESTRO de [`auditoria/E7-sintesis.md`](auditoria/E7-sintesis.md) §4** (con matriz impacto ×
> esfuerzo y dependencias). Los prompts de ejecución viven donde siempre: P1–P12 en
> [`PLAN_BACKLOG.md`](PLAN_BACKLOG.md), MP1–MP4 en [`PLAN_INFORMES.md`](PLAN_INFORMES.md), lotes
> L1–L6 en el propio `E7-sintesis.md` §6. El checklist «Plan ROFO AGRO» de `ESTADO.md` quedó como
> registro histórico. **Regla: ni `CONTEXTO.md` ni ninguna otra lista paralela — todo pendiente nuevo
> se agrega directo al backlog maestro.**

## Comandos
- `npm run dev` (real en sandbox: `NODE_USE_ENV_PROXY=1 npm run dev`) · `npm run build` · push a la rama → deploy.

## Sesión 07–08/07/2026 (rama `claude/financial-data-web-infra-whg41m`) — Fase C aplicada
> Rescatada al unificar el repo (09/07): este apunte solo existía en esa rama y nunca había llegado a una
> rama integrada. Su código entró por el merge `96a9bc9` + el rescate del PR #2 en el PR #4.

**Documentos de referencia creados** (leerlos para el detalle): `docs/INFRAESTRUCTURA.md`
(arquitectura y escalado), `docs/FORMULAS_EXCEL.md` (fórmulas reales del Excel RF),
`docs/ESTRATEGIAS_COMBINADAS.md` (opciones), `docs/PLANILLA_DIARIA.md` (modelos varios).

### Supabase — CONECTADO
- Proyecto **`lineup-argentina`** · ref **`gbpfgfeksqmzmsxnxiwg`** · región sa-east-1 (São Paulo).
  Org `chona97`. Se consolidó ROFO AGRO sobre este proyecto (no se creó uno nuevo).
- Tablas: `lineup` (~494k, scraper ISA Agents **frenado** desde ~jun), `djve` (MAGyP, **al día**),
  `compras` (% cosecha/priceado, **frenado**), **`futuros_cierres`** (cierres A3 granos).
- Vistas (lectura anon): `djve_resumen`, `futuros_cierres_ultimo` (curva = último cierre por posición).
- **`futuros_cierres`**: 22.398 filas al momento de esa sesión (2021-07-08 → 2026-07-03), solo futuros.
  [Actualización 09/07: 22.443 filas, al día hasta 2026-07-08 — el cron nocturno ya corre solo.]
- Web lee con **`src/lib/supabase.ts`** (PostgREST, clave publishable/anon, RLS solo-lectura).
- Env vars web: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (en Vercel + `.env.local`). Son PÚBLICAS (RLS protege).
- ⚠️ El MCP `execute_sql` de escritura estuvo **bloqueado en permisos** → para escribir vía MCP usar
  **`apply_migration`** (sí funciona).

### Fuente CEM (Matba ROFEX) — la clave de los históricos de A3
- **`https://apicem.matbarofex.com.ar/api/v2`** — API REST PÚBLICA, sin auth, Swagger en `/swagger/v1/swagger.json`.
- `GET /closing-prices?product=&type=FUT&from=&to=&page=&pageSize=500&sortDir=ASC` → cierres por posición/día
  (settlement, OHLC, openInterest, volume, impliedRate, previousClose, change).
- **Claves aprendidas:** `type=FUT` trae **solo futuros** (sin `type` vienen opciones mezcladas, 10× más filas).
  `sortDir` en **MAYÚSCULAS**. Rangos amplios dan **HTTP 424** → el script parte en **ventanas de 180 días**.
  Productos grano: `SOJ/MAI/TRI Dolar MATba`.
- Otros endpoints útiles: `/spot-prices` (pizarra, solo dólar), `/daily|monthly|yearly-trading-volume`,
  `/spread` (pases), `/market-position-data`, `/downloads/*` (CSV). El CEM RECHAZA conexiones desde
  Supabase (SSL) → ingerir por GitHub Actions.

### Cron de ingesta (GitHub Actions)
- **`.github/workflows/ingest-cierres.yml`** (schedule `0 23 * * 1-5` post-cierre + `workflow_dispatch`).
  Corre **`scripts/ingest-cierres.mjs`** (fetch CEM → upsert Supabase por symbol+fecha).
- Secrets en GitHub → Settings → Secrets → Actions: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (service_role,
  ESCRITURA, secreta). El workflow corre SOLO desde la rama default.
- Backfill manual: dispatch con inputs `from`/`to`. Ya se corrió el de 5 años.

### Otros aprendizajes de esa sesión
- **Skills de gauss** (github.com/gauss314/skills): catálogo de fuentes. Útiles: `primary` (A3/Matba),
  `data912`, `mae`, `bcra-macro`; para **CBOT/metales/Merval/SPY/EWZ**: `barchart`/`investing`/`yahoo-finance`.
- Conversión Chicago→USD/tn (arbitraje CBOT): maíz ×0,3937 · soja/trigo ×0,3674 (`docs/PLANILLA_DIARIA.md`).
- ⚠️ Hoja "Clientes" de la planilla diaria = datos personales reales → NUNCA al repo; va en base con login.
- Paneles de esa sesión: DJVE (`djve-panel`), Cierres A3 (`cierres-panel`), primeras 8 calculadoras
  (incl. **costos Cocos**: tarifario real web/app, persona humana/jurídica, comisiones % TNA prorrateadas
  por plazo — vive en `src/lib/costos.ts`) — luego reformadas en la sesión 08/07 de abajo.

## Sesión 08/07/2026 (rama `claude/pending-tasks-vzoa3c`)

### Hecho en esta sesión
- **Pases REAL** (`src/lib/pases-cierres.ts` + `pases-panel.tsx`): deriva el pase = diferencia de
  ajuste (settlement) entre posiciones consecutivas del mismo grano, desde `futuros_cierres` (CEM en
  Supabase). Suma tasa directa (larga/cercana − 1, exacta, sin fechas). TNA pendiente (necesita días
  entre vencimientos). Verificado contra SQL: valores sensatos (contango/backwardation por cosecha).
- **Fix posiciones vivas** (`src/lib/futuros.ts`): la vista `futuros_cierres_ultimo` traía el último
  cierre de TODOS los símbolos históricos (JUL21, ABR22…). Ahora se filtran a vto ≥ mes actual (Córdoba).
  Corrige también el panel **Cierres**, que mostraba posiciones muertas como vigentes.
- **Arbitrajes REAL** (`arbitrajes-cierres.ts` + `pizarra.ts`): futuro (ajuste A3/CEM) vs pizarra USD
  de CAC-BCR (scrape del HTML `board-{grano}`, parser verificado, + override `PIZARRA_OVERRIDE`).
- **TNA USD real en Arbitrajes y Pases**: nueva tabla `vencimientos` (migración
  `20260708120000`, seed desde CEM `/api/v2/symbols` campo `maturityDate`) + `vencimientos.ts` +
  `dates.ts` (hoyCordobaISO/diasEntre/diasHasta). Arbitraje: directa × 365/(vto − hoy). Pase: directa
  × 365/(vto_larga − vto_cercana). Verificado por SQL (ej. TRI JUL26 +1,51% en 16 días → +34,5% TNA).
- **Capacidad de pago REAL** (`capacidad.ts` + `capacidad-panel.tsx`): FAS Teórico de BCR (scrape de la
  planilla `#sheet` de "Precios FOB/FAS Argentina", fila "FAS Teórico en u$s", 2º valor = Up River Rosario;
  parser verificado). Muestra pizarra CAC al lado como contexto. Override `CAPACIDAD_OVERRIDE` para el
  modelo propio de Lautaro. Sin históricos (decisión de Lautaro). Ojo: el FAS tiene varias columnas
  (SAGyP/Up River/Brasil) — se toma Up River (Rosario), elegido por Lautaro.
- **Estado de rueda** (`rueda-status.tsx`): horarios oficiales Matba Rofex — Dólar 10:00–15:00, Agro
  10:30–17:00 (verificado en la página de horarios). Indicador abierto/cerrado en vivo, L-V, hora Córdoba.
  El reloj (`rueda-clock.tsx`) ya tickeaba solo (el `--:--:--` es el estado pre-hidratación).
- **Volumen en Arbitrajes** (columna Vol, desde `futuros_cierres.volume`). Volumen de pases NO disponible
  aún (el CEM no tiene instrumentos de pase → necesita el feed en vivo de A3).
- **Mejor para hacer caja** (`mejor-caja-panel.tsx`): ranking soja/maíz/trigo por MENOR tasa implícita
  (min TNA disponible vs posiciones siguientes). Reusa `getArbitrajes`.
- **Ajuste por posición fuera de pantalla**: se quitó `CierresPanel` de `page.tsx` (los datos quedan en
  Supabase para gráficos; el componente sigue en el repo por si se re-usa).
- **Pases = armados por patas** (verificado): el CEM NO publica instrumentos de pase (`MAI.ROS/POS1/POS2`);
  las cotizaciones de pase de la rueda + su volumen requieren el feed en vivo de A3 (cron 60s a definir).
- Limpieza: se quitó `pases` de ejemplo de `src/lib/sample.ts` (código muerto).

### Hecho (cont.) — pizarra editable, calculadoras, estrategias, noticias
- **Pizarra editable en Arbitrajes** (`arbitrajes-editable.tsx`, client): el disponible USD arranca con
  CAC y es editable con el precio del día → recalcula spread/tasa directa/**TNA en vivo** (días fijos del
  vto). Botón ↺ para volver al valor de CAC. El wrapper server pasa los datos al client.
- **Sección Calculadoras** (`page.tsx`): página agrupada en **Granos · Calculadoras · Dólar y tasas**
  (`.sec-title`), + **Noticias** arriba de todo.
- **Pago diferido → pesos** (`calc-diferido.tsx`): labels ARS + tasa pesos; el cálculo por interés simple
  no cambia (Lautaro: "está perfecto").
- **Negocios con pagos** (nueva, `calc-negocios-pago.tsx`): disponible USD = futuro ÷ (1 + tasa × días/365),
  interés simple; días del pago (hoy + 5 hábiles, editable) al vto; pesos = ⌊disponible × TC⌋ (TC a mano).
  Editables: futuro, vto, días de pago, tasa USD, TC. (Descuento simple confirmado por Lautaro.)
- **Carry implícito entre dos posiciones** (era "arbitraje disp/fut", `calc-arbitraje.tsx`): rename +
  relabel cercana/lejana; mismo cálculo (lejana/cercana − 1, TNA, spread).
- **Cotizador a fijar** (`calc-fijar.tsx` + `fijar.ts`): **solo deltas** (disponible − futuro), SIN costo
  de oportunidad; toggle **compro/vendo a fijar** (signo del resultado); **comparador con tasa editable**
  (TNA impl. vs tu tasa, verde si la supera; + "precio a tu tasa"); **tabla + gráfico del delta** (barras).
- **Cotizador por porcentaje** (`calc-porcentaje.tsx`): relabel (posición vendida / de fijación) + celda
  **Aforo (%)** que resta al **porcentaje lleno** (a cliente).
- **Cotizador con pases** (`calc-pases.tsx`): relabel (vendida / plazo de fijación) + **Quita (USD)** sobre
  el **spread lleno** (a cliente).
- **Estrategias con opciones** (`estrategias.ts` + `calc-estrategias.tsx`): reescrita como estrategias
  combinadas. Catálogo de ~27 estrategias (`docs/ESTRATEGIAS_CATALOGO.md`) mapeadas a **patas** (futuro/call/
  put, compra/venta, cttos); **menú con explicación al seleccionarla**; precio base + paso generan las patas;
  patas editables; **gráfico de payoff con breakevens** + línea del precio base; resumen (máx ganancia/pérdida,
  prima neta) + tabla de escenarios por strike. El collar quedó como un preset.
- **Noticias** (`noticias.ts` + `noticias-panel.tsx`): agregador con link-out (sin republicar texto).
  Scrape del **resumen de diarios de BCR** (categorizado: agronegocios/economía/región/internacionales, con
  link a la fuente) + **RSS** de InfoCampo, Bichos de Campo y Ámbito (de `FUENTES.md`). Parser verificado
  contra HTML+RSS reales. Cache 30 min, degrada solo. Panel arriba de todo.
- **Docs nuevos persistidos**: `FUENTES.md` (directorio de fuentes del agro), `docs/negocio/` (base de
  conocimiento del correacopio, con **REGLAS DEL DELTA** en 02 §6 / 03 §2), `ESTRATEGIAS_CATALOGO.md`.
- **CI corre lint**: `npm run lint` es parte del workflow `ci.yml` → correr `lint` + `typecheck` + `build`
  antes de pushear (una vez falló por `react/no-unescaped-entities` con comillas literales en JSX).

### Fuentes validadas con request real (para lo que sigue)
- **Capacidad de pago = FAS Teórico** de BCR: `bcr.com.ar/es/mercados/mercado-de-granos/cotizaciones/cotizaciones-locales-1`
  (HTML por grano: FOB, retenciones, gastos, **FAS Teórico u$s**) + PDF de metodología. Base según Lautaro;
  después él pasa su propio modelo para chequear. Complemento: MINAGRI.
- **Sintéticos (pago final por letra)**: IAMC `iamc.com.ar/informeslecap/` — "Informe Letras y Bonos del
  Tesoro" trae el **pago al vencimiento (valor final)** por letra (PDF por fecha). Emisor oficial = Min. Economía.
- **CBOT (maíz/trigo/soja Chicago)**: no hay skill dedicado en gauss; se cubre con `barchart` / `investing` /
  `yahoo-finance`. `primary` es solo Matba ROFEX (no CBOT).
- **Pases CEM `/api/v2/spread`**: existe pero devolvió HTTP 400 con params mínimos (necesita product/from/to);
  NO fue necesario: los pases se calculan desde los cierres que ya guardamos.
- **Pizarra granos**: el `/api/v2/spot-prices` de CEM es **solo dólar** (BNA/USD G/BCRA), no granos → la
  pizarra USD de soja/maíz/trigo sale de **CAC-BCR** (scrape) o del FAS teórico BCR + override manual.
- **Noticias (nuevo pedido)**: `bcr.com.ar/es/mercados/investigacion-y-desarrollo/resumen-de-noticias/resumen-de-diarios`
  es el FORMATO que le gusta a Lautaro (HTML por categorías con links a las fuentes). Fuente propia a definir.
- **Reporte diario**: formato objetivo = **imagen/PDF para enviar por WhatsApp**.
- **Camiones en puerto**: fuente a confirmar (BCR suele tenerlo).

### Cron de cierres — ✅ RESUELTO (verificado 09/07)
Diagnóstico de esta sesión (luego desactualizado): el workflow no estaba en la rama default y faltaban
secrets. **Ya no aplica**: los secrets `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` fueron cargados, el workflow
vive en la rama default y **el schedule ya disparó solo** (run #4, `event=schedule`, 09/07 00:07 UTC,
success) → la curva se actualiza sola cada noche hábil. Al cambiar la default a `main`, el workflow tiene
que existir en `main` (lo garantiza el PR de unificación del 09/07).

### Resuelto en la sesión (ya no bloquea)
- **Vencimiento por posición** (para días→TNA): sale del CEM `/api/v2/symbols` (`maturityDate`) → tabla
  `vencimientos`. No hizo falta regla manual.
- **Pizarra USD** de arbitrajes: **CAC-BCR** (scrape) + override `PIZARRA_OVERRIDE`; y editable en el panel.
- **Capacidad de pago**: **FAS teórico Up River (Rosario)** de BCR como base + override `CAPACIDAD_OVERRIDE`.
- **Noticias**: **BCR resumen + RSS** (InfoCampo, Bichos de Campo, Ámbito), link-out.
- **Cotizador a fijar**: solo deltas, sin costo de oportunidad, con comparador de tasa (confirmado).
- **Pago diferido**: pesos, interés simple (confirmado).

### Pendientes al cierre (para retomar)
1. ~~Cron de cierres~~ → **RESUELTO** (verificado 09/07: secrets cargados, schedule corriendo solo desde
   la default, curva al día). Queda para el futuro: armar el resto de los crons (rueda, pizarra, ingest_log)
   con el mismo esquema.
2. ✅ **Auto-curva A3 en las calculadoras** — HECHO (09/07, PR #4). Ver "Sesión 09/07/2026" abajo.
   Las calcs autocompletan precio + vto desde la curva real; queda pendiente sólo que el pase traiga
   volumen/bid-ask (eso depende del feed A3 en vivo, punto 3).
3. **Feed A3 en vivo (cron 60s)**: cotizaciones de pase de la rueda + volumen de pases + comprador/vendedor
   (bid/ask) de arbitrajes/pases. El CEM (diario) no tiene nada de esto.
4. **Sintéticos TIR**: pago final por letra (IAMC `informeslecap` / Min. Economía).
5. **Estrategias**: costos/IVA por pata, primas/strikes reales (cadena CBOT/A3), avanzadas (calendarios de
   dos vtos, acumulador path-dependent).
6. **Modelo propio de Lautaro** para capacidad de pago (fórmula + ejemplo) vía `CAPACIDAD_OVERRIDE`.
7. **Fase 3**: calendario de informes (con `FUENTES.md`), lineups/camiones, reporte diario para WhatsApp,
   ratio maíz/soja, arbitraje Matba↔CBOT (factores bushel→tn en `docs/negocio/`).
8. **Módulo scoring de clientes** (`docs/negocio/03`): producto de consultora a futuro (no es panel de esta
   web; requiere datos de fijaciones de clientes + historial A3 externo).

## Sesión 09/07/2026 (rama `claude/pending-tasks-vzoa3c`)

### Hecho — auto-curva A3 en las calculadoras (PR #4, mergeado a producción)
Se rescató el contenido del **PR #2** (había quedado en draft y con conflictos porque el PR #3 reescribió
los mismos archivos de calculadoras) y se re-aplicó **sobre la lógica de hoy, sin tocar ninguna fórmula**:
- **`src/lib/curva.ts` + `curva-types.ts`**: `getCurvaGranos()` lee la vista `futuros_cierres_ultimo`
  (último cierre por posición). **Filtra posiciones vencidas** con la misma regla que `futuros.ts`
  (`vencKey >= hoyVencKey` en zona Córdoba) → sólo muestra posiciones vivas. `vtoDePosicion("JUL26")` =
  último día del mes ("2026-07-31"), suficiente para el plazo.
- **`src/components/curva-picker.tsx`** (client): selector reutilizable grano → posición; al elegir,
  `onPick` autocompleta precio (settlement) + vencimiento. Si no hay curva, no renderiza (inputs a mano).
- **Wiring en 5 calculadoras**: Negocios con pagos (futuro+vto), Carry implícito (la lejana), A fijar
  (carga la **curva entera** del grano en la grilla de escenarios), Por porcentaje (posición de fijación),
  Pases (dos selectores: corta y larga). `page.tsx` llama `getCurvaGranos()` y pasa `curva.granos`.
- **`scripts/ingest-cierres.mjs`**: ventanas de **180 días** (evita HTTP 424 del CEM en rangos amplios) +
  `type=FUT` (sólo futuros en origen, sin opciones).
- `lint` + `typecheck` + `build` ✅. Deploy de producción **READY** (commit merge del PR #4).

### Limpieza de PRs
- **PR #2 cerrado** (su contenido quedó cubierto por el PR #4, adaptado a las calculadoras nuevas).
- **PR #3 y PR #4 mergeados** a la rama default (`claude/new-session-frovqj` = producción en Vercel).

### Pendiente que sigue (no cambió)
- El **volumen y bid/ask de los pases** en las calcs siguen dependiendo del **feed A3 en vivo** (punto 3
  de la lista de arriba); el CEM diario no los tiene. La curva de precios ya es real.
- ~~Cron de cierres sin correr solo~~ → **resuelto**: verificado el 09/07 que el schedule ya corre solo
  y la curva está al día (ver «Cron de cierres — RESUELTO» arriba).

## Sesión 09/07/2026 (rama `claude/repo-branch-organization-lh2siw`) — Unificación del repo
El trabajo estaba partido en DOS historias: `main` (rediseño premium, PRs #5/#6) y
`claude/new-session-frovqj` (datos/calculadoras/noticias, PRs #1/#3/#4/#7) — producción NO tenía el diseño
nuevo y cada línea tenía su propio CONTEXTO. Esta sesión unificó todo (merge + este CONTEXTO único) y creó
el sistema de handoff entre sesiones: **`docs/ESTADO.md`** (tablero vivo, leído automáticamente por cada
sesión vía `CLAUDE.md`) + **`docs/sesiones/`** (un markdown por sesión, append-only, sin conflictos).
Diagnóstico completo y pasos manuales de Lautaro: [`docs/PLAN_ORGANIZACION_REPO.md`](PLAN_ORGANIZACION_REPO.md).
**A partir de acá, los apuntes de sesión van en `docs/sesiones/` — NO agregar más secciones "Sesión" acá.**
