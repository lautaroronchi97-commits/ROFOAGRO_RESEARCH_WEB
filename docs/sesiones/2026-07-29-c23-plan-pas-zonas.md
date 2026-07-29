# Sesión 2026-07-29 — Plan C23/C27: BCBA-PAS por zona + condición de cultivos

- **Rama:** `claude/plan-desarrollo-auditoria-yccgvw` · **PR:** #_ (base `main`)
- **Objetivo pedido por Lautaro:** cerrar C23 (único ítem del backlog maestro sin prompt escrito)
  — producción BCBA-PAS por zona agroecológica —, haciendo "toda la lógica y planificación con
  Fable" y pidiéndole todas las preguntas necesarias para un resultado 10/10. Sesión de
  planificación pura, cero código de producto.

## Hecho
- Exploración del patrón existente (3 agentes en paralelo): ingesta PAS nacional
  (`src/lib/parse-pas.ts`, uploader `/admin/datos`, tabla `estimaciones_produccion` + RPC), zonas
  ya modeladas en el repo (line-up/puertos, sin relación con zonas agroecológicas) y el detalle
  textual del origen de C23 en sesiones previas.
- Lautaro adjuntó **5 archivos reales de BCBA** en 2 tandas: `reporte.xlsx` (producción por zona),
  `reporte_1.xlsx`/`reporte_2.xlsx` (condición girasol/soja) y, tras una pregunta de seguimiento,
  `reporte_3.xlsx`/`reporte_4.xlsx` (condición maíz/trigo). Los 5 se **parsearon a fondo con un
  script Python propio** (regex sobre el XML crudo del ZIP — el sandbox no tenía `openpyxl`):
  conteo de filas, columnas exactas, zonas/cultivos/campañas, identidad contable suma-zonas=TOTAL
  por año, y verificación cruzada contra cifras públicas conocidas.
- Diseño completo delegado a un agente Fable (`Agent` con `model: "fable"`, siguiendo la regla de
  `PLAN_BACKLOG.md` "juicio → Fable"), validado después contra el código real (RLS de
  `views_mercado`, funciones exactas de `parse-agrochat.ts`, convención `soloMesa` de
  `biblioteca.ts`).
- Escrito **[`docs/PLAN_PAS_ZONAS.md`](../PLAN_PAS_ZONAS.md)** completo (mismo formato que
  `PLAN_SIDEBAR.md`): decisiones cerradas, los 5 archivos documentados con sus trampas, DDL de
  `pas_zonas`/`pas_condicion` + RPCs, tabla de defensas de cada parser, diseño de uploaders y
  paneles, registro en el monitoreo (PR #104 en vuelo en paralelo), 2 prompts de ejecución
  autocontenidos (Fase 1 = C23, Fase 2 = C27) y 10 riesgos conocidos.
- Los 5 XLSX quedaron **versionados en `data/pas/`** (con fecha en el nombre) — el build futuro
  no depende de que Lautaro los vuelva a subir; se re-parsearon post-copia para confirmar
  integridad (mismo conteo de filas que el análisis original).
- Actualizado `docs/auditoria/E7-sintesis.md` §4: C23 reescrito con el plan cerrado; **C27 nuevo**
  (condición de cultivos) agregado, apuntando a la Fase 2 del mismo plan.

## Decisiones tomadas (y por qué)
- **Un plan, dos entregas independientes** (Lautaro) — condición de cultivos es un dataset
  distinto que apareció "de paso"; una entrega grande hubiera quedado medio-tachada en el backlog.
- **Solo-mesa con RLS cerrada de verdad** (Lautaro), patrón `views_mercado` en vez del patrón más
  común del sitio (anon + gate de página) — las páginas nuevas leen con la sesión del admin, no
  con la anon key, para que la RLS realmente proteja.
- **Tablas nuevas anchas, sin vintages** — el export trae siempre el histórico completo y las
  campañas cerradas no cambian; un vintage sería inventado (el origen no publica fecha de edición).
- **Filas TOTAL de zonas SÍ se guardan** — son la única verdad en la era 2000-2007 donde el
  desglose zonal no cierra, y evitan un join extra para el % de participación.
- **Identidad contable suma-zonas=TOTAL bloquea la carga (con "forzar") solo desde 2008/09** —
  verificado que antes de esa campaña las zonas cubren ~50% del total (BCBA no zonificaba todo al
  principio); aplicar el guard sin esta excepción hubiera bloqueado TODO el histórico viejo.
- **Fenología en jsonb array ordenado, no columnas** — los nombres de etapa cambian por cultivo
  (confirmado con los 4 exports reales: girasol/soja/maíz/trigo tienen vocabularios distintos) y
  el array preserva el orden secuencial que el header trae.
- **`xlsx-lite.ts` se extrae de `parse-agrochat.ts`** en vez de duplicar el unzip por tercera vez —
  el proyecto ya pagó un bug de producción por espejos duplicados (auditoría E4); move
  byte-a-byte, tests de agrochat intocables en ese commit.
- **Cadencia de healthcheck: 21 días (zonas) / 14 días (condición)**, confirmado por Lautaro que
  sube semanal con el PAS del jueves — zonas se mueve fuerte solo en siembra/cosecha, condición
  envejece rápido (14d = 2 PAS perdidos).
- **Registro en `/admin/conexiones` (PR #104)**, no un mecanismo nuevo — Lautaro avisó que ese
  panel de monitoreo de ingestas se está mergeando en paralelo; el plan deja la instrucción de
  verificar cuál de los dos catálogos (el nuevo o `healthcheck-frescura.mjs`) está vigente al
  momento del build.

## Verificado
- Los 5 XLSX reales parseados dos veces (análisis original + re-parseo post-copia a `data/pas/`):
  mismo conteo de filas en los dos casos (1.900 / 250 / 566 / 729 / 335).
  Identidad suma-zonas=TOTAL: 0/N cierra en 2000-2007, N/N cierra desde 2008/09 (medido año por
  año). Escala de "Producción(MTn)" verificada contra 2 cifras públicas conocidas (soja y maíz
  2024/25). Fenología: las 4 listas de etapas por cultivo transcriptas directo del header real,
  no de memoria.
- `npm run lint` corrido tras los cambios de docs (sin código de producto, no debería fallar; se
  corre igual por protocolo).

## Quedó pendiente / en vuelo
- Ejecutar el prompt de Fase 1 (§8 de `PLAN_PAS_ZONAS.md`) en una sesión de build — sugerido
  Sonnet, patrón ya claro.
- Ejecutar el prompt de Fase 2 (§9) DESPUÉS de que la Fase 1 mergee (comparte `xlsx-lite.ts`).
- Verificar al ejecutar si el PR #104 (`/admin/conexiones`) ya mergeó, para saber si los checks de
  monitoreo van en `src/lib/monitoreo/catalogo.ts` o en `healthcheck-frescura.mjs`.
- Si BCBA llega a exportar condición de cultivos para cebada/sorgo en el futuro, sumarlos recién
  ahí (hoy no existen, confirmado por Lautaro — no se dejó ningún hueco fantasma en el diseño).

## Trampas descubiertas (para la próxima sesión)
- El sandbox no tenía `openpyxl`/`pandas` — el análisis de los 5 XLSX se hizo con un parser
  regex propio sobre `sharedStrings.xml` + `sheet1.xml` (el mismo mecanismo que ya usa
  `parse-agrochat.ts` en producción, solo que en Python para explorar rápido).
- El campo `Campaña` viene en **3 formatos distintos** entre los archivos de este mismo dataset
  (`2000/2001` en zonas, `2025/26` en condición, `2000/01` en el CSV nacional ya soportado) — la
  normalización tiene que cubrir los 3, no solo 2.
- `Semana` no siempre arranca en 1 (aparece `0` en maíz 1ra/2da y en trigo 2025/26) — un rango
  1-53 hubiera descartado filas válidas.
- Trigo es el único cultivo de condición con la campaña EN CURSO ya con filas parciales
  (2026/27, semanas ~20-30 al 29/07) — el parser/panel no puede asumir que la última campaña
  siempre está cerrada.
