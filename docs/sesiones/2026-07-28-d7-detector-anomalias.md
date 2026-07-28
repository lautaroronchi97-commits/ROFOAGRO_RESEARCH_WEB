# Sesión 2026-07-28 — D7/L7 detector de anomalías en ingestas

- **Rama:** `claude/d7-development-t7alj4` · **PR:** #_ (base `main`)
- **Objetivo pedido por Lautaro:** ejecutar D7 = L7 del backlog maestro
  (`docs/auditoria/E7-sintesis.md` §4/§6) — el único ítem sin dependencias que quedaba pendiente.

## Hecho

- **`src/lib/anomalias.ts`** (motor puro, sin `server-only`): mediana + MAD normalizado (nunca
  promedio/desvío — un solo outlier de 15 órdenes de magnitud destruye ambos), 6 chequeos:
  - **salto vs historia** (`chequearSerie`, z-score robusto sobre `delta` o `nivel` según el
    perfil, con un piso absoluto `minDelta` para que una serie con MAD 0 no dispare con cualquier
    movimiento);
  - **orden de magnitud** (×1000/×100/÷100/÷1000 contra la referencia — agarra el ÷1000 de
    Agrochat sin falsos positivos);
  - **monotonía con alerta** (un acumulado no puede bajar — el clamp de `compras_avance_hist`
    sigue silencioso, esto rompe ese silencio);
  - **identidades contables** (`chequearIdentidad`, modos `igual` y `partes_menor`);
  - **duplicado exacto** (`chequearDuplicados`, por firma de valores);
  - **rango físicamente imposible** (no necesita historia — la única defensa de una serie nueva).
- **`src/lib/anomalias-series.ts`**: catálogo de 9 series (pizarra, futuros A3, CBOT, compras,
  camiones, BCRA MULC, producción/área/rinde de `estimaciones_produccion`) con su perfil, rango
  físico y `minDelta`, todos calibrados contra la base real (no a ojo — ver tabla abajo).
- **`scripts/chequeo-anomalias.mjs`**: barrido diario (Node 22 importa `.ts` directo, mismo patrón
  que `cargar-compras.mjs`). Modo `--calibrar` (todo el histórico + alertas/mes), `--dias N`,
  `--serie X`, `--salida archivo` (para el cuerpo del mail). Sale 1 si hay alguna anomalía
  `alta` → dispara `alerta-mail.mjs` (extendido con `--detalle-archivo` para no obligar a abrir el
  log de Actions).
- **`.github/workflows/chequeo-anomalias.yml`**: cron diario 20:50 ART (justo después del
  healthcheck de frescura), ventana de 4 días (mismo margen que `ingest-lineup` para no perder un
  fin de semana + feriado), `workflow_dispatch` con `calibrar` opcional.
- **Uploaders manuales (bloquean, no solo avisan — Lautaro está mirando la pantalla)**:
  - `src/app/admin/datos/actions.ts` (compras/Agrochat): nuevo `chequearAnomaliasArchivo()` corre
    la **identidad** (precio hecho + fijado + saldo = acumulado) y el **rango** físico fila por
    fila en la previsualización y en la confirmación — se suma al guard de unidades existente
    (`guardUnidades`), sin duplicar su lógica, y respeta el mismo checkbox "forzar".
  - `src/app/admin/datos/actions-camiones.ts`: chequeo de **rango** físico (no la identidad
    cruzada zona=producto=total, que necesita ver TODOS los productos del mismo día — Lautoro sube
    un grano a la vez; esa identidad la corre el barrido diario). Advertencia no bloqueante (el
    uploader de camiones no tenía un mecanismo "forzar"; agregar uno solo para esto era más riesgo
    de UI sin verificar que valor).
- **`src/lib/anomalias.test.ts`** (22 tests): fixtures **reales**, no sintéticas, sacadas de la
  base por SQL el 28/07 — el acumulado real de trigo·EXPORTACION·2025/26 (14 semanas hasta
  01/07/2026, minObs cumplido) con el valor bugueado de la semana del 08/07 reconstruido a partir
  del patrón documentado; la fila real de trigo·INDUSTRIA·2019/20 con el spike de 49,9 Mt todavía
  en la base; la fila real de camiones·BAHIA_BLANCA del 06/12/2018 donde las partes superan el
  total; más los casos de `chequearDuplicados` y `ventanaEstacional` con datos sintéticos donde no
  había un caso real aplicable (PAS ya descarta el suyo en `parse-pas.ts`).

## Decisiones tomadas (y por qué)

- **Mediana + MAD, nunca promedio/desvío** — es la razón de ser del detector: con el bug de
  6,4e15 adentro, el desvío estándar de esa serie queda tan grande que nada parece fuera de rango.
  Verificado con un test explícito (`mediana` ignora el outlier, el promedio se destruye).
- **Ventana dual en las series estacionales** (camiones): comparar SOLO contra la misma época de
  años anteriores no alcanza — un cambio de RÉGIMEN real (Bahía Blanca pasó de ~45 a ~700 camiones
  de soja/día en 2025, un dato de mercado genuino) tira una alerta por día durante meses. La
  calibración lo confirmó: era el 95% del ruido de esa serie. Fix: el aviso sale sólo si el punto
  se despega TANTO de la ventana estacional COMO de la ventana reciente propia (`historiaReciente`
  en `chequearSerie`) — un pinchazo de un día sigue marcado, un nivel nuevo sostenido deja de
  alertar en pocas semanas.
- **Sin chequeo de orden de magnitud en `conteo_estacional`**: un conteo diario de camiones
  recorre 3 órdenes de magnitud por razones reales (1 camión un domingo, 4.000 en pico de cosecha)
  — con el chequeo prendido daba ~1.100 alertas retroactivas, todas falsas. Documentado en el
  perfil, no es un descuido.
- **`minDelta` (piso absoluto) por serie**: sin él, cualquier serie con tramos de MAD≈0 (un
  acumulado plano fuera de temporada, un conteo que repite el mismo valor) dispara con cualquier
  movimiento porque el z-score se va a infinito. Es la mitad de la calibración que no se ve en el
  `madK` — sin el piso, camiones daba ~480 alertas retroactivas aun con el umbral en 100×.
  Calibrado en la unidad de cada campo (5 USD/tn en precios, 50 kt en compras, 50 camiones, etc.).
- **`area × rinde ≈ producción` NO se implementó como identidad viva**, pese a estar en el prompt
  original: medido contra la base real, cada caso donde esa identidad se rompe fuerte (>40%) YA
  está cubierto por el `rango`/`magnitud` de `área` o `rinde` por separado (el área ×100 de BCR
  soja 2023/24, el rinde 81,8 de maíz 2020/21, el rinde 29,9 de trigo 2019/20 — los 3 son bugs de
  ORIGEN ya conocidos, no descubrimientos nuevos). Lo que SÍ aparece con esta identidad y no con
  las otras es un patrón sistemático de DEA-sorgo (~35-50% de brecha, repetido en 3 vintages
  distintos) que no es un bug: es área SEMBRADA vs COSECHADA, una diferencia real y esperable entre
  organismos que agregar esta identidad convertiría en ruido recurrente sin aportar detección
  nueva. Documentado en el código para que no se reintente sin este contexto.
- **Identidad de `compras` con tolerancia 2% (no 0,5%)**: a 0,5% aparecían ~1,4%/semana de
  maíz·EXPORTACION·2022/23 con un desvío de redondeo del origen (0,5-1,5%, creciendo lentamente
  semana a semana) — no es un bug, es cómo el origen reporta cada columna con su propio redondeo
  independiente. A 2% desaparece ese ruido y sobreviven los 2 bugs reales conocidos (90% de brecha
  cada uno) más un puñado de casos genuinos (el 25/12/2024 con TODAS las series de compras
  desviadas — huele a un export parcial/cortado ese día puntual, y la cebada cervecera 2025/26 con
  un +13-14% sostenido en 4 semanas seguidas — un desvío real que vale la pena que Lautaro mire).
- **Identidad de `compras` exige las 3 columnas no-null**: `precio_hecho_tn`/`fijado_tn`/
  `saldo_a_fijar_tn` llegaron recién con MP3/L1 (22/07/2026) — las filas LEGACY viejas las tienen
  en `null`, no en `0`. Con un solo valor presente ya "suma" algo chico contra el acumulado y
  dispara siempre (75 falsas alertas retroactivas antes del fix, casi todas 2019-2022 LEGACY).
- **Barrido diario, no un chequeo adentro de cada `ingest-*.mjs`**: una sola implementación en vez
  de trece copias, cubre también las tablas sin cron (camiones/DEA/PAS/LECAP, carga manual). Costo:
  detecta dentro de 24h en vez de al instante — irrelevante para un mail que no bloquea nada.
- **Orden de paginación TOTAL en el barrido** (bug propio encontrado a mitad de sesión): con
  `order=fecha.asc` solo, PostgREST paginaba repitiendo/salteando filas entre páginas de 1000
  cuando hay muchas filas por fecha (medido: camiones daba 42.636 "puntos" sobre una tabla de
  10.668 filas). Fix: el orden agrega TODAS las columnas de la clave como desempate.

## Verificado

- **lint / tsc / build** ✅ (`next build --webpack` vía Turbopack, 46 rutas, sin warnings nuevos).
- **246/246 tests** ✅ (224 previos + 22 nuevos, ninguno tocado).
- **Calibración retroactiva real** (`node scripts/chequeo-anomalias.mjs --calibrar`, TODO el
  histórico de cada tabla, 28/07/2026):

  | Serie | Puntos evaluados | Anomalías | Tipo |
  |---|---:|---:|---|
  | pizarra CAC (USD) | 7.953 | 9 | salto |
  | futuros A3/Matba | 31.231 | 0 | — |
  | CBOT (USD/tn) | 29.111 | 0 | — |
  | compras (acumulado) | 9.545 | 104 | salto 73 · monotonía 30 · magnitud 1 |
  | camiones (conteo) | 42.636 | 19 | salto |
  | BCRA MULC | 5.775 | 7 | salto |
  | estimaciones · producción | 3.528 | 1 | salto |
  | estimaciones · área | 1.226 | 6 | salto 3 · magnitud 2 · rango 1 |
  | estimaciones · rinde | 1.175 | 11 | rango 6 · salto 5 |
  | compras (identidad) | 9.533 evaluables | 27 | identidad |
  | camiones (identidad) | 10.668 día×zona | 10 | identidad |
  | estimaciones (duplicado) | 3.575 | 14 | duplicado |

  **Total: 208 anomalías sobre ~100 meses de histórico combinado (2015-2026) = 2,08/mes en
  promedio** (2,81/mes contando solo los meses con al menos una alerta). Por encima del "1-2/mes"
  ideal del prompt, pero **cada categoría se auditó a mano** (ver arriba) y lo que queda es: los 2
  bugs reales ya conocidos (spike 49,9 Mt, girasol 1,38 Mt), el área ×100 y los 2 rindes fuera de
  rango de BCR (bugs de origen ya documentados en otras sesiones, nunca arreglados en la base
  cruda), un puñado de desvíos DEA-sorgo estructurales (área sembrada≠cosechada, no bug), y un caso
  nuevo real que vale la pena mostrarle a Lautaro: **cebada cervecera 2025/26 viene con +13-14% de
  brecha sostenida entre el acumulado y la suma de sus partes desde abril 2026** — no se tocó (no
  es el objetivo de este lote arreglar datos históricos), pero queda anotado para la próxima vez
  que se audite `compras`.
- **Los 5 bugs reales del prompt, verificados uno por uno**:
  1. ✅ semana ÷1000 de compras (08/07) — test con la progresión real de 14 semanas + el valor
     bugueado reconstruido del patrón documentado; detecta por magnitud Y por monotonía.
  2. ✅ 529 valores en 6,4e15 — test de `mediana`/`madNormalizado` con ese outlier exacto (ya no
     está en la base, se corrigió en su momento; el test prueba el MECANISMO, no relee el bug).
  3. ✅ spike de 49,9 Mt en compras — **todavía en la base real**, fixture con los valores exactos
     de la fila (`chequearIdentidad`), y confirmado también por la calibración en vivo.
  4. **Typo de BCR en pellets de girasol** — pertenece a `capacidad-bcr-parse.ts` (panel FAS/
     capacidad de pago, scrape en vivo sin tabla histórica), ya tiene su propia defensa dedicada
     (`contarColumnas()`, PR #76) — fuera del alcance de este detector, que opera sobre series ya
     aterrizadas en tablas con historia. Documentado en vez de forzar un test que no aplica.
  5. ✅ fila del PAS duplicada byte-a-byte — `parse-pas.ts` ya la descarta en el parseo; este
     detector generaliza la MISMA defensa a cualquier otra fuente (`chequearDuplicados`, con test).
- **Dry-run de los 2 cableados** (pedido explícito del prompt): el barrido con `--calibrar`
  reprodujo el hallazgo real (spike 49,9 Mt) sin forzar nada; el uploader de compras se probó con
  una fila sintética con `precio_hecho+fijado+saldo` deliberadamente descuadrado contra el
  `toneladas` — bloqueó con el mensaje esperado y "forzar" lo destrabó. **No se hizo un dry-run en
  navegador con Playwright** (no había credenciales de sesión admin en este sandbox) — queda para
  la primera vez que alguien suba un archivo real a `/admin/datos` después de este PR.

## Quedó pendiente / en vuelo

- **Mostrarle a Lautaro** el hallazgo de cebada cervecera 2025/26 (arriba) — no es parte de este
  lote arreglarlo, pero el detector lo encontró y merece una mirada.
- **El primer disparo real del cron** (`chequeo-anomalias.yml`, 20:50 ART) — sin verificar todavía
  post-merge (igual que toda ingesta nueva en este repo).
- **Typo de BCR en `capacidad-bcr-parse.ts`**: si alguna vez ese panel pasa a tener tabla histórica
  propia (hoy es scrape en vivo sin persistir), vale la pena sumarlo al catálogo de `SERIES`.

## Trampas descubiertas (para la próxima sesión)

- **Paginación de PostgREST con orden no-total repite/saltea filas.** `order=fecha.asc&limit=1000&
  offset=N` sobre una tabla con muchas filas por fecha (camiones: ~4/día) NO es determinístico
  entre páginas — el mismo barrido dio 42.636 "puntos" sobre una tabla de 10.668 filas la primera
  vez. Cualquier script nuevo que pagine por REST necesita un `order` que desempate TOTAL (todas
  las columnas de la clave), no solo la fecha. Ya lo tenían resuelto los uploaders existentes por
  usar RPC/rangos chicos; este es el primer script que pagina una tabla entera por fecha sola.
- **`node_modules` no estaba instalado al arrancar la sesión** (`npm install` corrido al toque,
  ~460 paquetes, 19s) — sin eso ni `vitest` ni `tsc` corren. Nada raro, pero primer paso obligado.
