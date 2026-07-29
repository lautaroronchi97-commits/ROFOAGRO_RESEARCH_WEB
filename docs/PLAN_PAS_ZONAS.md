# PLAN — BCBA-PAS por zona agroecológica + condición de cultivos (C23 + C27)

> **Qué es esto.** Plan cerrado con Lautaro el 29/07/2026 (sesión de craneo, cero código de
> producto): la web hoy solo modela el **total país** de las estimaciones BCBA-PAS; los exports de
> `bolsadecereales.com/estimaciones-agricolas` traen además (a) el desglose de producción por
> **zona agroecológica** (15 zonas, 27 campañas) y (b) la serie **semanal de condición de
> cultivos** (condición de cultivo + condición hídrica + avance fenológico, un export por
> cultivo). Un plan, **dos entregas independientes**: Fase 1 = producción por zona (**C23** del
> backlog maestro) · Fase 2 = condición de cultivos (**C27**, nuevo). Los prompts de ejecución
> autocontenidos están en **§8** (Fase 1) y **§9** (Fase 2). Modelo sugerido para ambos builds:
> **Sonnet** (patrón claro, regla de PLAN_BACKLOG); el juicio de diseño ya está tomado acá.
> Los archivos reales están **versionados en [`data/pas/`](../data/pas/)** — el build no le pide
> nada a Lautaro.

## 1. Decisiones cerradas (29/07/2026, con Lautaro)

1. **Un plan, dos entregas.** Fase 1 (zonas) y Fase 2 (condición) se ejecutan en sesiones
   separadas, cada una con su PR. Fase 2 asume mergeada la Fase 1 (comparte `xlsx-lite.ts`).
2. **Solo-mesa por ahora**: ambos paneles gateados con `requireAdmin()` **y RLS cerrada de
   verdad** (patrón `views_mercado`: SELECT solo `authenticated` + `is_admin()`, revoke a anon).
   No alcanza el gate de página: la RLS acompaña.
3. **Panel de zonas = foto de campaña + evolución histórica** (recomendación aceptada).
4. **Carga manual** por `/admin/datos` (Cloudflare bloquea bots — confirmado 3 veces desde IPs
   distintas, NO reintentar automatizar). Cadencia esperada: **semanal, con el PAS del jueves**.
5. **Registro en el monitoreo de ingestas**: las 2 cargas nuevas entran al catálogo del panel
   `/admin/conexiones` (PR #104: `src/lib/monitoreo/catalogo.ts` — arrays `CHECKS` y
   `CARGAS_MANUALES`) para que Lautaro vea cuándo toca subir y el healthcheck avise por mail.
6. **Sin vintages**: el export trae SIEMPRE el histórico completo, las campañas cerradas no
   cambian y el origen no publica fecha de edición → upsert simple por clave natural +
   `actualizado_en`. Un vintage acá sería inventado.
7. La condición de cultivos v1 es **nacional** (los exports traen zona=TOTAL), pero la tabla nace
   **con columna `zona`** para no migrar si BCBA habilita el desglose zonal.
8. **Cobertura real de condición**: BCBA solo publica este reporte para **soja, maíz, trigo y
   girasol** — confirmado por Lautaro (29/07). Cebada y sorgo no tienen este export; el parser y
   el selector del panel se acotan a esos 4 cultivos, sin dejar un hueco fantasma para los otros 2.

## 2. Los archivos reales, verificados (29/07/2026 — parseados en esta sesión)

Versionados en `data/pas/` (respaldo crudo estilo `data/camiones/` **y** fixture de los tests del
build — los tests los leen de acá, nunca fixtures sintéticas, regla dura del proyecto):

| Archivo | Contenido | Filas de datos |
|---|---|---|
| `reporte_zonas_2026-07-29.xlsx` | Producción por zona, 6 cultivos × 27 campañas | 1.900 |
| `reporte_condicion_girasol_2026-07-29.xlsx` | Condición semanal girasol, 2020/21→2025/26 | 250 |
| `reporte_condicion_soja_2026-07-29.xlsx` | Condición semanal soja (×3 ciclos: Soja/Soja1/Soja2), 2021/22→2025/26 | 566 |
| `reporte_condicion_maiz_2026-07-29.xlsx` | Condición semanal maíz (×3 ciclos: Maiz/Maiz1/Maiz2), 2021/22→2025/26 | 729 |
| `reporte_condicion_trigo_2026-07-29.xlsx` | Condición semanal trigo (sin ciclos), 2018/19→2026/27 (incl. campaña en curso) | 335 |

**Cobertura confirmada por Lautaro: la condición de cultivos SOLO existe para estos 4 cultivos**
(soja, maíz, trigo, girasol) — cebada y sorgo no tienen este reporte en BCBA. El parser y el
selector del panel se acotan a los 4; no hay hueco que llenar.

Todos con una única hoja **"Reporte base de datos"** (`sheet1.xml`).

### 2.a Producción por zona (`reporte_zonas_*.xlsx`)

- **Columnas exactas, en orden**: `Campaña · Zona · Cultivo · Sembrado (Ha) · Perdído(Ha) ·
  Cosechado(Ha) · Rinde(qq/Ha) · Producción(MTn)`.
  - ⚠️ **"Perdído" con typo de tilde REAL en el origen** — matchear headers por nombre
    normalizado (minúsculas, sin tildes ni espacios), así tolera el typo Y su eventual corrección.
  - ⚠️ **"Producción(MTn)" son toneladas CRUDAS**, no millones — verificado contra cifras
    publicadas: soja 2024/2025 TOTAL = 50.300.000 (50,3 Mt) · maíz = 49.000.000 (49,0 Mt).
- **Campaña en formato `2000/2001`** (año completo en las dos puntas) — DISTINTO del CSV nacional
  (`2000/01`) y de los archivos de condición (`2025/26`). Todo se normaliza al canónico `2000/01`.
- **15 zonas + TOTAL** (nombres literales, set canónico del parser): `NOA · NEA · Núcleo Norte ·
  Núcleo Sur · Centro N Cba · Centro N Sta Fe · S Cba · SL · Ctro E ER · Ctro BA · N LP-O BA ·
  Cuenca Sal · SE BA · SO BA-S LP · Otras · TOTAL`.
- **6 cultivos** (Soja, Maíz, Trigo, Girasol, Cebada, Sorgo) × **27 campañas** (2000/01→2026/27).
  Cebada y sorgo tienen desglose zonal recién desde **2009/10**. 2026/27 (trigo/girasol/cebada) y
  2025/26 (maíz/sorgo) por ahora traen **solo la fila TOTAL** (siembra proyectada, sin zonas).
- **Hallazgo que define el diseño**: la identidad contable *suma de zonas = TOTAL* (producción)
  cierra **exacto (≤0,5%) en TODOS los grupos grano×campaña desde 2008/09**; de 2000/01 a 2007/08
  NO cierra (las zonas suman ~50% del total — BCBA no zonificaba todo al principio). El desglose
  zonal es confiable desde 2008/09. **Nunca rellenar ni inventar**.
- Columna Rinde consistente con producción/cosechado en 1.815/1.829 filas — igual se **recalcula
  siempre** (convención de `parse-pas.ts`, que ya encontró un rinde corrupto en el origen).

### 2.b Condición de cultivos (`reporte_condicion_*.xlsx`)

- **Columnas 1-15, fijas**: `Cultivo · Zona · Campaña · Semana · Siembra · CC_Mala(%) ·
  CC_Regular(%) · CC_Normal(%) · CC_Buena(%) · CC_Excelente(%) · CH_Sequía(%) · CH_Regular(%) ·
  CH_Adecuada(%) · CH_Óptima(%) · CH_Exceso(%)`.
- **Columnas 16-21: fenología, con nombres que CAMBIAN por cultivo** (confirmado en los 4 exports
  reales — cada uno con su propia agronomía):
  - Girasol: `Expansión Foliar · Botón Floral · Floración · Llenado de grano · Madurez
    Fisiológica · Cosecha`.
  - Soja: `Expansión Foliar · Comienzo de Floración · Comienzo de Fructificación · Comienzo de
    Llenado · Comienzo de Madurez · Cosecha`.
  - Maíz: `Expansión Foliar · Panojamiento · Floración Femenina · Grano Pastoso · Madurez
    Fisiológica · Cosecha`.
  - Trigo: `Macollaje · Encañazón · Espigazón · Grano Pastoso · Madurez Fisiológica · Cosecha`.
  **El parser las lee dinámicamente del header, tal cual y en orden — JAMÁS hardcodearlas** (no
  hace falta ningún mapeo a mano por cultivo; la prueba con los 4 reales es la garantía).
- **Ciclos**: soja y maíz vienen desglosados en `X` / `X1` / `X2` = total / 1ra / 2da (**maíz
  también tiene 1ra/2da**, no solo soja); **trigo y girasol NO se desdoblan** (un solo cultivo por
  archivo, sin sufijo). El parser no debe asumir que todo cultivo tiene ciclos.
- `Zona` = solo `TOTAL` en los 4 exports.
- **`Semana` = número DENTRO de la campaña, rango real observado 0-53** (no arranca siempre en 1:
  maíz 1ra/2da y trigo 2025/26 traen semana `0`), **sin fecha real** — el eje de todo es "semana
  de campaña" (habilita el overlay campaña vs campañas previas, mismo concepto que el modo
  Campañas de `/graficos`). Las semanas sin dato no aparecen en el archivo.
- Cobertura real: girasol 2020/21→2025/26 · soja 2021/22→2025/26 · maíz 2021/22→2025/26 · **trigo
  2018/19→2026/27** (el único con la campaña EN CURSO ya con filas — trigo se siembra antes, tiene
  más historia y llega hasta semana ~30 de 2026/27 al 29/07). El panel debe tolerar que cada
  cultivo tenga un rango de campañas distinto.
- Bloques CC y CH: suman ~100 cuando hay dato; vienen todo en 0 en semanas pre-emergencia
  (normal, no es un error).

## 3. Modelo de datos (DDL + RPCs)

**Formato ancho en ambas tablas** (las medidas de cada fila llegan y se consultan siempre juntas;
el formato largo de `estimaciones_produccion` solo paga con variables heterogéneas
multi-organismo, que acá no existen). **Upsert simple, sin vintages** (decisión 6).

### 3.a Fase 1 — `pas_zonas` (migración `c23_pas_zonas.sql`)

```sql
create table public.pas_zonas (
  grano          text not null,   -- 'soja'|'maiz'|'trigo'|'girasol'|'cebada'|'sorgo'
  campania       text not null,   -- canónico '2000/01' (mismo formato que estimaciones_produccion)
  zona           text not null,   -- nombre literal BCBA ('NOA'…'Otras') o 'TOTAL'
  sembrado_ha    numeric,
  perdido_ha     numeric,
  cosechado_ha   numeric,
  produccion_tn  numeric,         -- null si todavía sin cosecha (nunca 0 fantasma)
  rinde_tn_ha    numeric,         -- SIEMPRE recalculado produccion/cosechado, nunca del origen
  actualizado_en timestamptz not null default now(),
  primary key (grano, campania, zona)
);
alter table public.pas_zonas enable row level security;
create policy pas_zonas_select_admin on public.pas_zonas
  for select to authenticated using (public.is_admin());
revoke all on public.pas_zonas from public, anon;
grant select on public.pas_zonas to authenticated;
```

- **Las filas TOTAL se guardan** (zona `'TOTAL'`): son la única verdad en la era 2000-2007 y hacen
  el % de participación autocontenido (sin join a otra tabla).
- La regla de era vive como **constante de lib**, no en la DB (es derivable):
  `CAMPANIA_ZONAL_CONFIABLE = "2008/09"` en `src/lib/pas-zonas.ts`. Participaciones y
  comparaciones solo ≥ esa campaña, con nota visible en el panel.
- RPC `admin_upsert_pas_zonas(filas jsonb) returns integer` — clon estructural de
  `admin_upsert_estimaciones` (`20260722180000`): `security definer`, guard `is_admin()` adentro,
  `on conflict (grano, campania, zona) do update set … , actualizado_en = now()`, revoke a
  public/anon + grant execute a authenticated. ⚠️ El `actualizado_en = now()` en el UPDATE **no es
  opcional**: es lo que el panel `/admin/conexiones` (PR #104) usa como "última carga" — sin eso,
  re-subir el archivo no refresca el semáforo (la trampa exacta que ese PR documentó en
  `compras`/`camiones`).

### 3.b Fase 2 — `pas_condicion` (migración propia)

```sql
create table public.pas_condicion (
  grano       text not null,                   -- 'girasol'|'soja'|'maiz'|'trigo'|'cebada'|'sorgo'
  ciclo       text not null default 'total',   -- 'total'|'1ra'|'2da'  (Soja/Soja1/Soja2)
  zona        text not null default 'TOTAL',   -- v1 solo TOTAL; columna lista para el desglose
  campania    text not null,                   -- canónico '2020/21'
  semana      smallint not null,               -- 1-53, semana DE CAMPAÑA (el origen no trae fecha)
  siembra_pct numeric,
  cc_mala numeric, cc_regular numeric, cc_normal numeric, cc_buena numeric, cc_excelente numeric,
  ch_sequia numeric, ch_regular numeric, ch_adecuada numeric, ch_optima numeric, ch_exceso numeric,
  fenologia   jsonb not null default '[]',     -- ARRAY ordenado [{"etapa":"Expansión Foliar","pct":12.3},…]
  actualizado_en timestamptz not null default now(),
  primary key (grano, ciclo, zona, campania, semana)
);
-- misma RLS que pas_zonas (SELECT authenticated + is_admin(), revoke anon)
```

- **Fenología en jsonb array** (no columnas): los nombres de etapa cambian por cultivo y el array
  preserva el orden secuencial del header (un objeto `{etapa: pct}` lo perdería).
- RPC `admin_upsert_pas_condicion(filas jsonb)` — mismo molde, mismo `actualizado_en = now()`.

## 4. Parsers (todo en `src/lib/`, puros, testeados contra los archivos de `data/pas/`)

### 4.a `xlsx-lite.ts` — util XLSX compartido (SE EXTRAE, Fase 1)

Hoy el único parser XLSX vive dentro de `compras/parse-agrochat.ts`; con los 2 parsers nuevos
serían 3 copias, y el proyecto ya pagó un bug de producción por espejos duplicados (auditoría E4).
Se extrae `src/lib/xlsx-lite.ts` con estas funciones de `parse-agrochat.ts` (líneas verificadas al
29/07): `unzip` (L271) · `xmlDecode` (L301) · `textoDeRuns` (L310) · `colIndex` (L319) ·
`serialExcelAISO` (L326) · `parseTablaXLSX` (L334). **Move BYTE-A-BYTE**: cero cambios en cuerpo
de funciones ni regex; `parse-agrochat.ts` pasa a importarlas; **sus tests existentes quedan
INTACTOS como red — prohibido tocarlos en ese commit** (si un test falla, el refactor está mal,
no el test). También se exporta `normalizarCampania` desde `parse-pas.ts` (cambio de una
palabra) — maneja los 3 formatos: `2000/2001`→`2000/01`; `2025/26`/`2020/21` pasan tal cual.

### 4.b `parse-pas-zonas.ts` (Fase 1)

`parsePasZonas(buf: Buffer): { filas: FilaZona[]; descartes: Descarte[]; controlIdentidad: …;
resumen }` — puro, sin `server-only`, sin fecha (sin vintages).

| Situación | Tratamiento |
|---|---|
| ZIP inválido / sin hoja / headers no matchean / 0 filas | **Error total** (nada se carga) |
| Headers: matcheo por nombre normalizado (minúsculas, sin tildes/espacios) | tolera `Perdído` y su eventual corrección; falta una columna → error total |
| Zona fuera del set canónico de 16 | **Descarte visible** (BCBA puede sumar una zona; no rompe la carga) |
| Cultivo desconocido | Descarte visible (mismo mapa `CULTIVO` de `parse-pas.ts`) |
| Escala: `RANGO_MT` (de `parse-pas.ts`) sobre la fila TOTAL de cada grano×campaña | fuera de rango → **descarte del grupo entero** (si cambió la escala, todo el grupo está mal). NO aplicar el rango nacional a zonas individuales |
| Rinde | **Recalculado siempre** = produccion/cosechado; columna del origen ignorada |
| Producción ≤ 0 con sembrado > 0 | La fila **SE CARGA** con `produccion_tn = null` (la foto de campaña vigente necesita el área antes de la cosecha). Fila todo 0/vacía → se omite sin descarte |
| Grupo grano×campaña idéntico byte-a-byte al de la campaña anterior | Descarte del grupo (generaliza el bug real de trigo 2025/26 del CSV nacional) |
| **Identidad suma-zonas = TOTAL ±0,5%, SOLO campañas ≥2008/09** con TOTAL y ≥1 zona | **BLOQUEA la confirmación salvo checkbox "forzar"** (mismo patrón/UX que el guard de unidades del uploader de compras). <2008/09: sin chequeo, documentado |

### 4.c `parse-pas-condicion.ts` (Fase 2)

`parsePasCondicion(buf): { filas: FilaCondicion[]; descartes; etapasPorCultivo:
Record<string, string[]>; resumen }`.

| Situación | Tratamiento |
|---|---|
| 15 columnas fijas validadas por nombre normalizado (tolerar tildes de `CH_Sequía`/`CH_Óptima`) | falta una → error total |
| Columnas 16+ | **Etapas de fenología leídas dinámicamente del header, tal cual y en orden** |
| Cultivo | `Soja→(soja,total)` · `Soja1→(soja,1ra)` · `Soja2→(soja,2da)` · `Maiz→(maiz,total)` · `Maiz1→(maiz,1ra)` · `Maiz2→(maiz,2da)` · `Trigo→(trigo,total)` · `Girasol→(girasol,total)` — solo estos 4 cultivos existen en BCBA (sin cebada/sorgo, confirmado); desconocido → descarte visible. Un archivo puede traer varios valores de esta columna (soja y maíz traen 3 cada uno; trigo y girasol solo 1) |
| Semana | entero **0-53** (rango real observado, no arranca siempre en 1); fuera de ese rango → descarte visible |
| Bloque CC o CH con algún valor pero suma fuera de [98,102] | ese bloque va en **null + descarte visible del bloque** (nunca cargar un desglose inconsistente). Bloque todo 0/vacío → null sin descarte (pre-emergencia, normal) |
| Zona ≠ TOTAL | Se carga (la tabla lo soporta) pero se lista en la preview como novedad |
| PK duplicada dentro del archivo | gana la última + descarte visible |
| Fechas | **NUNCA se inventan** — el eje es semana de campaña |

## 5. Uploaders (`/admin/datos`)

Dos cards nuevas, clones del patrón `pas-uploader.tsx` + `pas-actions.ts` (flujo `useActionState`
de 2 pasos — preview parsea sin tocar la DB y muestra TODO descarte; confirm llama
`requireAdmin()` + RPC + `revalidatePath` —, el `File` se re-envía en ambos pasos por el
statelessness serverless): `pas-zonas-uploader.tsx`/`pas-zonas-actions.ts` y
`pas-condicion-uploader.tsx`/`pas-condicion-actions.ts`. `accept=".xlsx"`. Sin campo fecha.

La preview de **zonas** suma dos controles propios:
- **Guard de identidad** (§4.b) con checkbox "forzar" — UX copiada del uploader de compras
  (`uploader.tsx`/`actions.ts`), no del de PAS que no lo tiene.
- **Cruce vs nacional**: producción TOTAL de la campaña vigente comparada contra el último dato
  BCBA de `estimaciones_produccion`; diferencia >2% → **warning, no bloqueo** (el CSV nacional
  puede estar legítimamente más viejo/nuevo que el xlsx).

## 6. Paneles

Rutas nuevas **`/produccion/zonas`** ("Producción por zona") y **`/produccion/condicion`**
("Condición de cultivos"), registradas en `src/lib/biblioteca.ts` grupo Producción con
`soloMesa: true` (🔒). Páginas cáscara fina: `requireAdmin()` + `PageHead` + componente. ⚠️ **Leen
con `createSupabaseServerClient()` (la sesión del admin), NUNCA con la anon key** — con la RLS
cerrada, leer con anon devuelve tabla vacía en silencio (precedente exacto: `/granos/view`).
Libs de datos: `src/lib/pas-zonas.ts` y `src/lib/pas-condicion.ts` (fetch + agregaciones puras
testeables).

**`zonas-panel.tsx`** — selector de grano + campaña (default: la mayor con desglose zonal):
- **(a) Foto de campaña**: tabla con las zonas en FILAS (15×8 es legible; 15 columnas no) ×
  columnas `Sembrado · Perdido · Cosechado · Producción · Rinde · % del total · Δ vs campaña
  anterior descompuesto en efecto área y efecto rinde · contribución (pp) al Δ nacional`.
  La descomposición responde literal la pregunta que motivó C23 ("¿la caída es rinde flojo en el
  Núcleo o menos hectáreas en el NOA?"): Δprod ≈ Δárea·rinde₋₁ + Δrinde·área_actual. Esqueleto de
  tabla: `embarques-panel.tsx` L163-201 (`.table-scroll`).
- **(b) Evolución histórica**: `SvgLineChartBase` multi-serie (patrón `evolucion-chart.tsx`) con
  el **% de participación por zona** — **top-6 por participación media de las últimas 5 campañas +
  "Resto" agregado + selector para destacar cualquier zona** (15 líneas fijas es sopa; barras
  apiladas de 15, peor). Eje X = campaña, **desde 2008/09**, con la nota visible de por qué.
- Campañas con TOTAL sin zonas (2026/27; maíz/sorgo 2025/26): mostrar el TOTAL + "sin desglose
  zonal todavía" — degradación honesta, nunca filas fantasma.
- `ChartTabla` (todas las zonas, % y tn, export CSV) + `ChartMarca`, como todo chart del sitio.

**`condicion-panel.tsx`** — selector cultivo (+ ciclo si soja) + campaña base:
- **Chart 1 — condición de cultivo**: línea **Buena+Excelente %** por semana de campaña; campaña
  vigente en color pleno, previas en gris (overlay conceptual del modo Campañas de `/graficos`);
  tooltip con las 5 categorías.
- **Chart 2 — condición hídrica**: ídem con **Adecuada+Óptima %** (Sequía visible en tooltip).
- **Chart 3 — fenología**: multi-serie, una línea por etapa (6 es manejable), campaña
  seleccionada, leyenda con los nombres literales del header.
- Nota visible: "eje = semana de campaña (el origen no publica fechas)". `ChartTabla` +
  `ChartMarca` en los tres. Números es-AR. Claro/oscuro.

## 7. Monitoreo (catálogo PR #104) + anomalías

En `src/lib/monitoreo/catalogo.ts` (PR #104 — si al momento del build todavía no mergeó,
registrar en `scripts/healthcheck-frescura.mjs` y anotar el traslado como pendiente):
- `CHECKS`: `{ nombre: "pas_zonas (BCBA zonal)", tabla: "pas_zonas", col: "actualizado_en",
  maxDias: 21, cadencia: "manual (PAS jueves; el zonal cambia fuerte solo en siembra/cosecha)" }`
  y `{ nombre: "pas_condicion (BCBA semanal)", tabla: "pas_condicion", col: "actualizado_en",
  maxDias: 14, cadencia: "manual (PAS semanal; 2 jueves de gracia)" }`. Umbrales razonados con la
  cadencia confirmada por Lautaro (sube semanal con el PAS del jueves): condición envejece rápido
  (14d = 2 PAS perdidos, como compras); zonas se mueve de verdad solo en ventanas de
  siembra/cosecha (21d, como Williams). ⚠️ Comentar que la RLS solo-admin exige leer con la
  **SERVICE key** (precedente: el comentario de `views_mercado` en el healthcheck).
- `CARGAS_MANUALES`: 2 ítems nuevos apuntando a las anclas de sus cards en `/admin/datos`, con la
  regla de "última carga" = `actualizado_en` (que las RPC refrescan en cada upsert — §3.a).
- **Catálogo D7 del barrido diario (`anomalias-series.ts`): NO se suman series** — estos datos
  solo entran por upload con guard en la preview; el barrido diario existe para datos que entran
  solos por cron.

## 8. PROMPT DE EJECUCIÓN — FASE 1 (C23: producción por zona) — autocontenido

```
Sos una sesión de build del repo ROFOAGRO_RESEARCH_WEB. Ejecutá la FASE 1 del plan
docs/PLAN_PAS_ZONAS.md (C23 del backlog maestro): producción BCBA-PAS por zona agroecológica.
LEÉ PRIMERO: docs/ESTADO.md + la última entrada de docs/sesiones/ + docs/PLAN_PAS_ZONAS.md
COMPLETO (§1-§7 son decisiones CERRADAS con Lautaro — no re-decidas ni re-preguntes nada de lo
que ya está ahí) + AGENTS.md (Next.js 16 tiene breaking changes: leé la doc relevante en
node_modules/next/dist/docs/ ANTES de escribir código de rutas/páginas). Antes de tocar UI,
cargá la skill ui-ux-pro-max. Protocolo: rama claude/* desde main actualizado, commits chicos,
PR draft base main, lint + tsc + vitest + build antes de cada push.

El archivo real está en data/pas/reporte_zonas_2026-07-29.xlsx (1.900 filas de datos, hoja
"Reporte base de datos") — es el fixture de los tests Y el archivo de la verificación
end-to-end. Su estructura exacta, trampas incluidas (typo "Perdído", "MTn" = toneladas crudas,
campaña "2000/2001", 15 zonas + TOTAL, identidad que solo cierra ≥2008/09), está en §2.a.

ORDEN DE OBRA:
1. Extraer src/lib/xlsx-lite.ts desde src/lib/compras/parse-agrochat.ts (§4.a): move
   BYTE-A-BYTE de unzip/xmlDecode/textoDeRuns/colIndex/serialExcelAISO/parseTablaXLSX;
   parse-agrochat pasa a importarlas. PROHIBIDO tocar los tests existentes de agrochat en este
   commit: son la red del refactor (si uno falla, el refactor está mal, no el test). Exportar
   normalizarCampania desde src/lib/parse-pas.ts (sin tocar su comportamiento — sigue
   descartando zona ≠ TOTAL para el CSV nacional). Correr vitest completo acá.
2. src/lib/parse-pas-zonas.ts + tests: implementar EXACTAMENTE la tabla de defensas de §4.b
   (error total / descarte visible / carga con null / bloqueo con forzar). Tests con fixture
   REAL (readFileSync de data/pas/…): conteos exactos (1.900 filas fuente), soja 2024/25 TOTAL
   = 50.300.000, identidad que cierra ≥2008/09 y NO cierra en 2000-2007, typo del header
   tolerado, rinde recalculado ≠ columna origen donde difieren.
3. Migración supabase/migrations/<timestamp>_c23_pas_zonas.sql con el DDL + RPC de §3.a
   (incluido actualizado_en = now() en el on-conflict-update — no opcional). La migración la
   APLICA EL ORQUESTADOR por MCP con OK de Lautaro: vos la escribís y avisás, no la aplicás.
4. Uploader: card nueva "Estimaciones BCBA-PAS por zona" en /admin/datos
   (pas-zonas-uploader.tsx + pas-zonas-actions.ts), patrón 2 pasos de pas-uploader.tsx, guard
   de identidad con checkbox "forzar" copiado del uploader de compras, cruce vs nacional como
   warning (§5).
5. Lib src/lib/pas-zonas.ts (fetch con createSupabaseServerClient — NUNCA anon, la RLS
   devuelve vacío en silencio — + agregaciones puras testeables: % participación, top-6+Resto,
   descomposición Δárea/Δrinde con la fórmula de §6) + página /produccion/zonas (requireAdmin +
   PageHead + zonas-panel.tsx según §6) + registro en biblioteca.ts (grupo Producción,
   soloMesa: true).
6. Monitoreo (§7): CHECKS + CARGAS_MANUALES en src/lib/monitoreo/catalogo.ts (o en
   healthcheck-frescura.mjs si el PR #104 aún no mergeó — verificalo).

GUARDAS DURAS: cero dependencias npm nuevas · no tocar el comportamiento del PAS nacional ni
de parse-agrochat · TODO descarte visible en la preview · degradación honesta (sin datos → "sin
datos", nunca crash ni fila fantasma) · % de participación y comparaciones SOLO ≥2008/09
(CAMPANIA_ZONAL_CONFIABLE), con nota en la UI · números es-AR · claro/oscuro · ChartMarca +
ChartTabla en todo chart · si agregás CSS: ojo con secuencias */ en comentarios de globals.css
(ya rompió dev dos veces).

VERIFICACIÓN (todas, antes de cerrar): lint + tsc + vitest (sin tocar expects ajenos) + build ·
subida END-TO-END del xlsx real de data/pas/ por el uploader con Playwright (bypass temporal de
admin si hace falta, REVERTIDO antes de cerrar, git diff limpio) · panel con datos reales
cotejados 1:1 contra el análisis de §2.a (soja 24/25 = 50,3 Mt; identidad 2008/09) · claro +
oscuro + mobile 390px, cero errores de consola, cero scroll horizontal · RLS por SQL (anon no
lee, admin sí).

CIERRE: docs/sesiones/<fecha>-c23-fase1-pas-zonas.md + actualizar la sección «Ahora» de
docs/ESTADO.md + tachar C23 en docs/auditoria/E7-sintesis.md §4. Un PR, base main, draft hasta
verificado.
```

## 9. PROMPT DE EJECUCIÓN — FASE 2 (C27: condición de cultivos) — autocontenido

```
Sos una sesión de build del repo ROFOAGRO_RESEARCH_WEB. Ejecutá la FASE 2 del plan
docs/PLAN_PAS_ZONAS.md (C27 del backlog maestro): condición de cultivos semanal BCBA-PAS.
PRECONDICIÓN: la Fase 1 (C23) está mergeada — src/lib/xlsx-lite.ts y normalizarCampania
exportada ya existen; si no existen, PARÁ y avisá (la Fase 1 va primero).
LEÉ PRIMERO: docs/ESTADO.md + última entrada de docs/sesiones/ + docs/PLAN_PAS_ZONAS.md
COMPLETO (decisiones cerradas, no re-preguntar) + AGENTS.md (Next 16: doc local en
node_modules/next/dist/docs/ antes de rutas). Antes de tocar UI, cargá la skill ui-ux-pro-max.
Protocolo: rama claude/* desde main, commits chicos, PR draft base main, lint + tsc + vitest +
build antes de push.

Archivos reales en data/pas/, los 4 cultivos que BCBA publica (sin cebada/sorgo, confirmado):
reporte_condicion_girasol_2026-07-29.xlsx (250 filas), reporte_condicion_soja_2026-07-29.xlsx
(566 filas, ciclos Soja/Soja1/Soja2), reporte_condicion_maiz_2026-07-29.xlsx (729 filas, ciclos
Maiz/Maiz1/Maiz2) y reporte_condicion_trigo_2026-07-29.xlsx (335 filas, sin ciclos, incluye la
campaña EN CURSO 2026/27) — fixtures de tests y de la verificación end-to-end. Estructura exacta
en §2.b — LAS 2 TRAMPAS GRANDES: (1) las columnas de fenología cambian de nombre por cultivo →
se leen DINÁMICAMENTE del header, jamás hardcodeadas (los 4 reales ya prueban 4 vocabularios
distintos); (2) Semana es 0-53 dentro de la campaña (arranca en 0 en algunos archivos, no
siempre en 1), SIN fecha real — nunca inventes fechas.

ORDEN DE OBRA:
1. src/lib/parse-pas-condicion.ts + tests: tabla de defensas de §4.c EXACTA (headers fijos
   normalizados, fenología dinámica en orden, mapa Soja/Soja1/Soja2/Maiz/Maiz1/Maiz2/Trigo/
   Girasol — sin cebada/sorgo, no dejes un selector con huecos para ellos —, suma-100 por
   bloque, PK duplicada gana la última). Tests contra LOS 4 ARCHIVOS reales: etapas de cada
   cultivo leídas del header (las 4 son distintas entre sí) · conteos exactos · trigo con su
   campaña en curso (2026/27, semanas parciales) sin romper · semana 0 aceptada · bloques
   pre-emergencia en null sin descarte.
2. Migración con el DDL + RPC de §3.b (fenología jsonb ARRAY ordenado; actualizado_en = now()
   en el update). La aplica el orquestador por MCP con OK de Lautaro.
3. Uploader "Condición de cultivos BCBA-PAS" en /admin/datos (patrón 2 pasos; un archivo por
   cultivo, la preview muestra cultivo/ciclos/campañas/etapas detectadas + descartes).
4. Lib src/lib/pas-condicion.ts (fetch con createSupabaseServerClient, series por semana de
   campaña) + página /produccion/condicion (requireAdmin + PageHead + condicion-panel.tsx:
   selector de cultivo ACOTADO a soja/maíz/trigo/girasol —nunca cebada/sorgo, no hay dato—, con
   selector de ciclo solo cuando el cultivo elegido lo tenga (soja/maíz sí, trigo/girasol no); los
   3 charts de §6 — Buena+Excelente overlay campañas, Adecuada+Óptima ídem, fenología
   multi-etapa) + biblioteca.ts (Producción, soloMesa: true).
5. Monitoreo (§7): CHECKS (maxDias 14) + CARGAS_MANUALES en el catálogo.

GUARDAS DURAS: las mismas de la Fase 1 (§8) + eje SIEMPRE "semana de campaña" con su nota en
la UI.

VERIFICACIÓN: lint + tsc + vitest + build · upload end-to-end de LOS 4 archivos reales con
Playwright (bypass revertido, git limpio) · overlay de campañas cotejado contra filas crudas
del xlsx (incluida la campaña en curso de trigo) · claro + oscuro + mobile · RLS por SQL.

CIERRE: doc de sesión + ESTADO.md «Ahora» + tachar C27 en E7-sintesis.md §4.
```

## 10. Riesgos conocidos (mirarlos al ejecutar)

1. **Refactor de `xlsx-lite` "mejorado"** → move textual estricto; tests de agrochat intocables
   en ese commit.
2. **Panel vacío en silencio por RLS** → leer con la sesión del admin, no anon; Playwright
   logueado tiene que mostrar números.
3. **"MTn" leído como millones** → son toneladas crudas (verificado §2.a); `RANGO_MT` sobre las
   filas TOTAL ataja un cambio futuro de escala del origen.
4. **3 formatos de campaña conviviendo** → todo pasa por `normalizarCampania`; clave canónica
   `2000/01`.
5. **% de participación sobre 2000-2007** → prohibido (las zonas suman ~50% del total en esa
   era); constante `CAMPANIA_ZONAL_CONFIABLE` + nota en UI.
6. **Fenología hardcodeada del primer cultivo que se mire** → headers dinámicos; test que exige
   etapas distintas entre girasol y soja.
7. **Semana → fecha calendario** → jamás; el origen no publica fechas.
8. **Campañas parciales** (2026/27 y maíz/sorgo 2025/26 solo TOTAL) → degradación honesta.
9. **Next 16** → doc local antes de rutas (`AGENTS.md`).
10. **PR #104 en vuelo** → el catálogo de monitoreo puede estar en `src/lib/monitoreo/catalogo.ts`
    o todavía en `healthcheck-frescura.mjs` — verificar qué mergeó antes de registrar los checks.
