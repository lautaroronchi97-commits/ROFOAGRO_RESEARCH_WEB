# Sesión 2026-08-07 — Primer feedback real del view + plazo 7-14 días + voz humanizada

- **Rama:** `claude/weekly-view-skill-feedback-6a6hx7` · **PR:** #_ (base `main`)
- **Objetivo pedido por Lautaro:** alimentar por primera vez la skill `view-mercado` con su
  feedback (los 4 views del 07/08 tienen nota + texto en `views_mercado`), marcando que
  parte del feedback es común a TODOS los informes; acortar el plazo del view de "4-8
  semanas" a **7-14 días como máximo** ("si lo vamos rehaciendo semana a semana no tiene
  sentido"); y (pedido en la misma sesión) **humanizar la skill de voz** — "toma tonos muy
  exagerados a veces".

## Hecho

### 1. Plazo del view: 7-14 días (horizonte + scorecard + UI)

- `.claude/skills/view-mercado/SKILL.md`: el campo `horizonte` de F6 pasa de
  `ej. "próximas 4-8 semanas"` a **"próximos 7-14 días"** fijo, con la razón documentada.
- `src/lib/views-scorecard.ts`: `VENTANAS_DIAS` de `[7, 14, 28]` a **`[7, 14]`**; el
  resumen por grano (hit-rate/Brier/racha) pasa de la ventana de 28 días a la de **14
  días** como titular. Comentarios de metodología actualizados. Cero fórmula tocada — solo
  qué ventanas se miden y cuál resume.
- `src/lib/views-scorecard.test.ts`: fixtures adaptadas (el caso de rolleo/contrato_vencido
  ahora se prueba con la ventana de 14 días cruzando el vto; el test genérico de
  `medirVentana` con 28 días se conserva porque prueba el mecanismo, no una ventana real).
- `src/app/(site)/granos/view/page.tsx`: "Scorecard (4 semanas)" → "Scorecard (14 días)"
  (fila + empty state + ¿Qué es esto?).
- Comentarios/tabla de insumos que citaban "4 semanas": `informe-semanal.ts`,
  `informe-semanal-datos.ts`, `api/informes/datos/route.ts`,
  `.claude/skills/informe-semanal/SKILL.md`.
- Los views ya guardados conservan su `horizonte` viejo (registro histórico, no se
  reescriben); el próximo view semanal sale con el plazo nuevo.

### 2. Feedback destilado (primer lote real del loop de calibración)

Leído de `views_mercado` (los 4 views del 07/08: soja nota 3, maíz 4, trigo 4, aceite 4,
todos con texto). Esta sesión actuó como la "sesión de mantenimiento" del loop (gate
cumplido: ≥4 feedbacks + marca explícita de Lautaro).

- `.claude/skills/view-mercado/references/aprendizajes.md` — reglas nuevas:
  - Horizonte 7-14 días (chat).
  - **Soja: FAS teórico de la INDUSTRIA** (`capacidad.industriaSoja`), no del poroto.
  - **Posición de fondos siempre nombrada y en criollo** ("posición comprada/vendida de
    los fondos", nunca "largos"/"largo cargado"/"net long").
  - **Bolsas locales**: examinar más lo que publica BCR (GEA y demás) y BCBA.
  - **Clima que traba la cosecha/logística = driver local** (el caso real del maíz).
  - Trigo: más datos de cosecha nueva local + clima.
  - "Calor de mercadería" anotado como **DUDA ABIERTA** (Lautaro dijo que le falta validar
    si refleja la realidad) — citarlo con moderación, no regla.
  - Redacción: sin fuentes en el texto (ni web propia ni externas), terminología siempre
    en español, "como lo vemos" (nunca "como lo ve la mesa"), no decir "delta gap",
    explicar la jerga al usarla ("el crush se está cerrando" no se entendió), no exagerar
    la voz.
- `SKILL.md` del view además: el ejemplo de `argumentos` ya no lleva la ruta de la web
  (`— /comercio/temperatura` fuera) + regla explícita "sin nombrar la fuente"; el agente 2
  de F1 suma el research de **bolsas locales** y la excepción de **clima de cosecha** al
  calendario de ventanas críticas.
- **Bloque común a los 4 productos** (Lautaro: "algunos de los feedbacks son comunes para
  todos los informes") replicado en los `aprendizajes.md` de `informe-diario`,
  `informe-semanal` e `interpretaciones`: sin fuentes en el texto · español siempre ·
  fondos en criollo · "como lo vemos" · no exagerar la voz. En interpretaciones se aclaró
  que el ORGANISMO del informe interpretado sí se nombra (es el tema, no "la fuente de un
  dato").

### 3. Voz humanizada (`.claude/skills/voz-lautaro/SKILL.md`)

Pedido textual: *"el skill con voz está muy exagerado, quiero que lo humanices más, toma
tonos muy exagerados a veces"*.

- "Vive el mercado" pasa a **"Vive el mercado — con dosificación"**: la intensidad es de
  posteos/recaps de X en días movidos, NO el registro por defecto; "la voz es condimento,
  no el plato"; el feedback textual de Lautaro quedó citado como ancla, con el ejemplo
  real de frase pasada de rosca.
- NUNCA nuevos: **caricaturizarlo** (frases de color inventadas, muletillas apiladas — las
  muletillas salen de `references/ejemplos.md`, no se fabrican) · **terminología en
  inglés** · hablar de **"la mesa" en tercera persona**.
- Checklist de entrega suma el chequeo espejo: "¿suena a una IMITACIÓN de él? — el error
  más reportado es el exceso, no la falta".

## Decisiones tomadas (y por qué)

- **Ventana titular del scorecard = 14 días** (antes 28): es el techo del horizonte nuevo;
  medir a 28 días una tesis que se rehace a los 7 no mide nada. La de 7 días queda como
  lectura secundaria (igual que antes la de 7/14 respecto de 28).
- **No se reescriben los views guardados** con horizonte viejo — son registro histórico;
  el cambio rige desde la próxima corrida.
- El feedback común se **duplicó a propósito** en los 4 `aprendizajes.md` (cada skill lee
  solo el suyo en su Paso 0) y lo transversal de voz se subió además a `voz-lautaro`
  (que las 4 leen siempre) — leve redundancia aceptada para que ninguna corrida se lo
  pierda.
- El punto 12 del feedback de maíz ("reflejaste bastante la realidad, el momentum de venta
  expiró") se tomó como refuerzo positivo, no como regla — no genera instrucción nueva.

## Verificado

- lint ✅ · `npx tsc --noEmit` ✅ · `npx vitest run` **650/650** ✅ (tests del scorecard
  reescritos para las ventanas nuevas) · `npm run build` ✅.
- Feedback leído de la base real (`views_mercado`, los 4 views del 07/08 con nota+texto)
  antes de destilar — no se trabajó de memoria.
- **Sin verificar**: la primera corrida real de la Routine semanal con el horizonte nuevo
  (el viernes que viene, post-merge) — ahí se confirma que el view sale con "próximos 7-14
  días", sin fuentes en el texto y con la voz más llana.

## Quedó pendiente / en vuelo

- **"Calor de mercadería" (índice MESA)**: Lautaro tiene pendiente validar si refleja la
  realidad — quedó como duda abierta en `aprendizajes.md`; si lo valida (o lo rechaza), la
  regla se ajusta.
- La primera corrida real post-cambio (view del viernes) como verificación de punta a
  punta del feedback aplicado.

## Trampas descubiertas (para la próxima sesión)

- El feedback de Lautaro en `views_mercado` llega con `\r\n` y numeración propia (1-12) —
  los puntos 2/4-10 se repiten textuales entre granos (es UN feedback transversal pegado
  en varios views, no N feedbacks independientes): no contarlos como episodios repetidos
  a la hora del gate de destilación futura.
- Ajustar `VENTANAS_DIAS` obliga a revisar las fixtures de los tests de resumen: con
  fechas de fixture pensadas para 28 días, la ventana de 14 caía en `filaEnOAntes` =
  fila de t0 → retorno 0 → cambia el sentido del test sin fallar ruidosamente.
