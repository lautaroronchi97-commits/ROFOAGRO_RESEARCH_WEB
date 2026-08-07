# Aprendizajes del view de mercado (loop de calibración)

> Reglas destiladas de las 3 señales que deja Lautoro en cada view (§7 de
> `docs/PLAN_INFORMES_V2.md`): `feedback_lautaro` (texto libre), `nota_lautaro`
> (1-5, calidad/utilidad del view) y el scorecard (`views-scorecard.ts`, acierto
> objetivo contra `futuros_cierres`) — las tres se leen juntas: la nota dice si el
> view sirvió, el scorecard si acertó (un view puede acertar y ser poco útil, o
> fallar y estar bien razonado). La sesión semanal lee este archivo ANTES de
> escribir (Paso 0 de la skill, después de F2 blind-first) y además lee el
> feedback+nota crudos de la base.
>
> **Destilación gateada** (la Routine NUNCA destila): una sesión de mantenimiento
> mensual, o cuando se acumulen ≥4 feedbacks, lee episodios + scorecard y propone
> ediciones acá. Gate: "¿una corrida futura actúa mejor por esto?" — promoción solo
> por repetición (≥2 episodios) o marca explícita de Lautoro ("siempre X").
> **Cap duro: ≤200 líneas** — lleno = para agregar hay que borrar o fusionar.
> Formato por regla: `[fecha] [origen: view/feedback que la generó] regla`.
>
> Las primeras 3-4 semanas son de ajuste declarado: confianza conservadora y
> preguntas explícitas en el resumen de sesión si un criterio quedó ambiguo.

## Reglas vigentes

### Horizonte y estructura

- [2026-08-07] [chat con Lautaro, primer lote de feedback] **El horizonte del view es
  "próximos 7-14 días", nunca más.** El view se rehace cada semana — una tesis a 4-8
  semanas que se reescribe semana a semana no tiene sentido. La dirección, los
  argumentos y los invalidadores se piensan para ese plazo corto; el scorecard mide
  exactamente 7 y 14 días.

### Datos y criterio

- [2026-08-07] [feedback soja 07/08, nota 3] **Soja: el FAS teórico de referencia es
  el de la INDUSTRIA (`capacidad.industriaSoja`, complejo aceite+harina), no el del
  poroto de exportación** — "hay mucha menos diferencia" contra la pizarra; en la
  práctica argentina el de industria es el que manda para el precio al productor.
- [2026-08-07] [feedback soja+maíz+aceite 07/08] **Nombrá siempre la posición de los
  fondos (le sirve y lo pidió), y decila en criollo: "posición comprada/vendida de
  los fondos"** — nunca "largos", "largo cargado" ni "net long". Si el dato necesita
  contexto (neto, Δ semanal), explicalo en una frase, no con jerga.
- [2026-08-07] [feedback maíz+soja 07/08] **Bolsas locales: examiná más lo que
  publican, sobre todo BCR** (GEA y demás informes de Rosario; también BCBA) — no
  solo los números ya ingestados, también su prosa de la semana (avance de cosecha,
  condición, comercialización). Con pasaporte, como todo research externo.
- [2026-08-07] [feedback maíz 07/08, punto 11] **El clima local que traba la cosecha
  o la logística es driver, no color** — el maíz estuvo muy afectado porque no se
  podía cosechar; eso frena la oferta física de corto y tiene que estar en el view
  aunque no haya ventana crítica de crecimiento abierta.
- [2026-08-07] [feedback trigo 07/08, nota 4] **Trigo: más datos de la cosecha nueva
  en el plano local y del clima** — la campaña entrante (siembra/condición/heladas)
  pesa más que el remanente de la vieja.
- [2026-08-07] [feedback soja 07/08, punto 3 — DUDA ABIERTA, no regla] "Calor de
  mercadería" (índice MESA / temperatura): a Lautaro le falta validar si refleja la
  realidad. Hasta que lo valide, citarlo con moderación y sin apoyar una tesis SOLO
  en ese índice.

### Redacción (comunes a los 4 productos — ver también los aprendizajes de diario/semanal/interpretaciones)

- [2026-08-07] [feedback los 4 views 07/08] **Nunca nombres la fuente de un dato en
  el texto** — ni la página/sección de nuestra propia web ni el medio externo. El
  número va limpio; la trazabilidad externa vive en `evidencia_externa`, no en la
  prosa.
- [2026-08-07] [feedback maíz+soja 07/08] **Terminología SIEMPRE en español** — cero
  términos en inglés. Si un concepto solo se conoce por su nombre en inglés,
  traducilo/explicalo ("margen de crush de pizarra" y qué significa, no "board
  crush" a secas).
- [2026-08-07] [feedback maíz+soja 07/08] **"como lo vemos", nunca "como lo ve la
  mesa"** — no hablar de "la mesa" en tercera persona. Y no digas "delta gap":
  explicá el cambio del gap de cobertura en palabras.
- [2026-08-07] [feedback soja 07/08, punto 3] **La jerga se explica al usarla**: "el
  crush se está cerrando" no se entendió — decí qué significa (el margen de la
  industria — aceite+harina contra poroto — achicándose) la primera vez que aparece.
- [2026-08-07] [feedback los 4 views + chat 07/08] **No exageres la voz de Lautaro**
  — frases tipo "no me quiero comer la película bajista de un saque" están pasadas
  de rosca. La voz se nota en el voseo, la claridad y la humildad, no en color de
  piso de operaciones inventado. En la duda, más llano.

## Historial de cambios

| Fecha | Cambio | Origen |
|---|---|---|
| 2026-07-21 | Archivo creado con el primer view (sesión MP3) | — |
| 2026-07-28 | Formalizado el loop de §7 (nota 1-5 + scorecard, destilación gateada) — sin reglas nuevas todavía, sigue sin feedback real que destilar | V1, PLAN_INFORMES_V2.md |
| 2026-08-07 | Primer lote real de feedback destilado (los 4 views del 07/08 con nota + texto, más directivas de Lautaro por chat): horizonte 7-14 días, FAS industria para soja, posición de fondos en español, sin fuentes en el texto, bolsas locales, clima de cosecha, reglas de redacción comunes | Feedback views 07/08/2026 + chat |
