# Aprendizajes de interpretaciones (loop de calibración)

> Reglas destiladas del feedback implícito por DIFF (§9 de `docs/PLAN_INFORMES_V3.md`):
> a diferencia del view (que tiene nota + feedback de texto explícitos), acá el feedback es
> el DELTA entre `borrador_original_md` (lo que la IA escribió) y `publicado_md` (lo que
> Lautaro terminó publicando) — qué recortó, qué agregó, qué tono corrigió. Las
> interpretaciones `auto_publicado=true` (nunca las tocó) también informan: silencio = estaba
> bien así. La sesión lee este archivo en el Paso 0, DESPUÉS de `voz-lautaro` y ANTES de leer
> el diff crudo de las últimas ~8.
>
> **Destilación gateada** (la Routine NUNCA destila): una sesión de mantenimiento mensual, o
> cuando se acumulen ≥4 diffs con el mismo patrón, lee los episodios y propone ediciones acá.
> Gate: "¿una corrida futura escribe mejor por esto?" — promoción solo por repetición (≥2
> episodios) o marca explícita de Lautaro. **Cap duro: ≤200 líneas.**
> Formato por regla: `[fecha] [origen: organismo/informe que la generó] regla`.
>
> Las primeras semanas son de ajuste declarado: si un criterio de segmentación por grano o de
> "qué tan chico es chico" queda ambiguo, decilo en el resumen de la sesión en vez de asumir.

## Reglas vigentes

### Redacción — comunes a los 4 productos (primer lote de feedback de Lautaro sobre los views del 07/08/2026, marcado por él como común "para todos los informes")

- [2026-08-07] [feedback views 07/08] **Nunca nombres la fuente de un dato en el
  texto** — ni la página/sección de nuestra propia web ni el medio externo. El número
  va limpio en la prosa. (El organismo del informe que se interpreta sí se nombra —
  es el tema de la interpretación, no "la fuente de un dato".)
- [2026-08-07] [feedback views 07/08] **Terminología SIEMPRE en español** — cero
  términos en inglés; si un concepto solo se conoce en inglés, traducilo/explicalo.
- [2026-08-07] [feedback views 07/08] **Posición de fondos: "posición comprada/vendida
  de los fondos"**, nunca "largos"/"largo cargado"/"net long". A Lautaro le gusta que
  el dato aparezca — pero explicado en criollo.
- [2026-08-07] [feedback views 07/08] **"como lo vemos", nunca "como lo ve la mesa"**
  — no hablar de "la mesa" en tercera persona.
- [2026-08-07] [feedback views + chat 07/08] **No exageres la voz de Lautaro** — nada
  de color de piso de operaciones inventado ("no me quiero comer la película bajista
  de un saque" fue el ejemplo que marcó como pasado de rosca). La voz es voseo,
  claridad y humildad; en la duda, más llano. La jerga se explica la primera vez que
  aparece.

## Historial de cambios

| Fecha | Cambio | Origen |
|---|---|---|
| 2026-08-04 | Archivo creado (E2, rutina propia de interpretaciones — antes vivía como Paso 9 de `informe-diario`, sin `aprendizajes.md` propio) | E2, PLAN_INFORMES_V3.md |
| 2026-08-07 | Bloque de redacción común (Lautaro marcó su feedback sobre los views como válido para todos los informes) | Feedback views 07/08/2026 + chat |
