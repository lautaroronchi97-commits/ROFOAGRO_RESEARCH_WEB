# Sesión 2026-08-08 — Plan C32: fusión señal física + calor de mercadería

- **Rama:** `claude/signal-temperature-synthesis-isja3g` · **PR:** #_ (base `main`)
- **Objetivo pedido por Lautaro:** los puntos 16 y 18 del Word del 07/08 (señal física · calor
  de mercadería) habían quedado agendados "para revisar juntos, candidatas a fusionarse".
  Pedido: explorar ≥3 soluciones, entender la lógica de cada página, analizar si vale la pena
  unificar — con dos vueltas de auto-auditoría adversarial pedidas explícitamente ("volvé a
  estudiar tu respuesta / volvé a auditar") — y al final "dejá todo listo para construir".

## Hecho
- **Análisis completo, cero código** (los 4 subagentes planificados murieron por un límite de
  sesión de la API → el research se hizo a mano): lógica exacta de `lineup/semaforo.ts` +
  `lineup/cobertura.ts` (señal) y `lineup/temperatura.ts` + `mesa_calor.ts` + `estacional.ts`
  (calor), mapa de consumidores (2 páginas + `/api/views/insumos` + `view-mercado/SKILL.md` —
  superficie chica, todo solo-mesa), y **números vivos del 05/08** traídos del endpoint real de
  insumos: las dos páginas se CONTRADICEN en producción (trigo "Equilibrado" vs "FIRME 79,9 →
  DIFERIR"; soja "Equilibrado" vs crush "VENDER YA").
- **Hallazgo metodológico**: la señal juzga el ratio 60d de hoy contra percentiles P25/P75 de la
  distribución histórica 30d (`empresas.ts:119-136` sobre `lineup_gap_hist`, que es 30d) —
  mismatch de ventanas latente, misma clase de bug que L4 ya arregló una vez.
- **Verificado con requests reales**: la API de FOB oficial de SAGyP responde FECHAS HISTÓRICAS
  (probado 05/08/2026, 14/03/2024 circular 1454, 12/03/2021 circular 722) → el FAS "Nuestro" es
  reconstruible por fecha. Wayback bloqueado por egress del sandbox (secundario).
- **CSV de Agrochat "FAS Teórico Oficial SAGyP" analizado y verificado** (Lautaro lo consiguió
  en la misma sesión): 32.076 filas · 2007→06/08/2026 · 9 productos (incl. aceites y cebadas) ·
  0 duplicados/ceros · USD=ARS/TC verificado · TC = A3500 correcto hasta en la ventana
  dólar-soja 2022 · cotejo triple mismo-día (05/08) contra FAS BCR vivo y "Nuestro": consistente,
  con brecha por-grano no uniforme (soja +17 = vara industria · girasol −70 = producto flojo en
  todas las fuentes). Perfil completo y checklist de re-verificación en
  `PLAN_CALOR_MERCADERIA.md` §4.
- **Entregable: [`PLAN_CALOR_MERCADERIA.md`](../PLAN_CALOR_MERCADERIA.md)** — diagnóstico,
  12 decisiones cerradas, diseño (motor único estacional 30d · página fusionada con veredicto
  en capas · tabla `fas_historico` + cron 4 fuentes · objeto `sintesis` para el view) y
  **3 prompts autocontenidos**: F1 (base FAS) → F2 (fusión) → F3 (backtest contra el PREMIO).
  Registrado como **C32** en el backlog maestro.

## Decisiones tomadas (y por qué)
- **Fusionar** en una sola página "Calor de mercadería"; `/comercio/senal` redirige — dos
  veredictos que se contradicen sobre la misma base es peor que uno; no son opiniones
  independientes (mismo termómetro, dos escalas). Delegado por Lautaro ("deja todo listo").
- **Fusión ANTES que backtest** (invierte la 1ª propuesta, corregida en la auto-auditoría): la
  estructura de la página no depende del resultado del backtest; el titular no estrena ninguna
  receta nueva (matriz 3×3 vigente + precio como contexto) y lleva etiqueta "en validación".
- **Eje precio anclado al FAS OFICIAL SAGyP** (la serie con 19 años de historia; lo que se
  valida = lo que se muestra) — ajusta C16 ("anclada a fasBcr"); BCR/Nuestro quedan de contraste.
- **SOJA = VARA INDUSTRIA** — cita de Lautaro: *"Tene en cuenta siempre que hablemos de soja
  industria. Rara vez el poroto valió más."* El FAS oficial ya corre a esa vara (339,98 vs
  322,94 export el 05/08). Coherente con el aprendizaje del view del 07/08.
- **Backtest contra el premio local, no el precio pleno** (las acciones de la matriz hablan del
  premio textualmente); trigo con target propio (CBOT es SRW). Hipótesis gruesas, walk-forward,
  sin calibración fina — la muestra no da para más (~2022→, autocorrelada, con regímenes).
- **El CSV no se versionó en esta sesión** — Lautaro: "en el build lo vuelvo a subir" (F1 lo
  re-verifica con el checklist §4.3 y lo versiona en `data/fas/`).
- Punto 17 del Word (mesa de embarque) queda explícitamente FUERA de esta fusión (contesta otra
  pregunta); punto 13 (camiones) empalma solo como F4b opcional.

## Verificado
- lint / tsc / vitest (650) / build ✅ (diff solo docs).
- Insumos reales de producción (05/08) · API FOB con 3 fechas históricas · CSV con perfil
  completo por awk + cotejo triple mismo-día. Todo documentado con números en el plan.

## Quedó pendiente / en vuelo
- **Ejecutar F1 → F2 → F3** (prompts en el plan §5). F1 necesita que Lautaro re-adjunte el CSV.
- OKs de protocolo en las builds: aplicar la migración `fas_historico` y la matview v2.
- Observación al pasar (no de este plan): el 08/08 los insumos mostraban line-up al 05/08 —
  jueves 06 y viernes 07 sin snapshot. Si el lunes sigue así, mirar la ingesta (el healthcheck
  debería cantarlo solo).

## Trampas descubiertas (para la próxima sesión)
- Los subagentes (`Agent` tool) pueden morir todos juntos por límite de sesión de la API — el
  research a mano con Grep/Read dirigidos alcanzó igual; no asumir que el fan-out siempre está.
- El parser de capacidad LEE la columna SAGyP de la planilla BCR y la DESCARTA (toma el 2º valor
  = Up River) — exponerla es gratis y da el par oficial-vs-BCR diario (F1.1).
- La brecha FAS oficial ↔ BCR NO es uniforme por grano (soja +17 por vara industria, girasol
  −70): nunca mezclar niveles entre fuentes; cada serie se normaliza contra su propia historia.
