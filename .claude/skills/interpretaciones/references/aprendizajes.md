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

- (todavía sin feedback — skill creada el 04/08/2026, E2 de PLAN_INFORMES_V3.md; las reglas
  aparecen acá cuando haya diffs reales para leer)

## Historial de cambios

| Fecha | Cambio | Origen |
|---|---|---|
| 2026-08-04 | Archivo creado (E2, rutina propia de interpretaciones — antes vivía como Paso 9 de `informe-diario`, sin `aprendizajes.md` propio) | E2, PLAN_INFORMES_V3.md |
