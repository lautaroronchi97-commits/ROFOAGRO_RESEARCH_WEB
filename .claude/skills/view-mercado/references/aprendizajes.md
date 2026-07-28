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

- (todavía sin feedback — primer view generado el 21/07/2026; las reglas aparecen
  acá cuando Lautaro empiece a calificar)

## Historial de cambios

| Fecha | Cambio | Origen |
|---|---|---|
| 2026-07-21 | Archivo creado con el primer view (sesión MP3) | — |
| 2026-07-28 | Formalizado el loop de §7 (nota 1-5 + scorecard, destilación gateada) — sin reglas nuevas todavía, sigue sin feedback real que destilar | V1, PLAN_INFORMES_V2.md |
