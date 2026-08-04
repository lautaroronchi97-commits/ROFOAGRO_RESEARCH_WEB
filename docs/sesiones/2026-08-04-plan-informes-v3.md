# Sesión 2026-08-04 — Plan Informes V3 (Word de Lautaro)

- **Rama:** `claude/reportes-skills-voz-i71jlw` · **PR:** #_ (base `main`)
- **Objetivo pedido por Lautaro:** integrar su Word de requisitos ("INFORMES", 04/08) sobre los 4
  productos ya construidos (diario · semanal · view · interpretaciones) — relevar lo hecho, no
  tirar nada, sumar lo del Word, dejar los datos explícitos por informe, un skill + una Routine
  por producto, todos con `voz-lautaro`, retroalimentación donde se pueda, sin repetir entre
  informes. Primero el PLAN (esta sesión); la construcción después con Sonnet.

## Hecho
- **Word extraído completo** (4 secciones: diario/semanal/view/interpretaciones) y transcripto
  fiel en `docs/PLAN_INFORMES_V3.md` §1.1 — el .docx no se versiona, la transcripción es la
  referencia.
- **Relevamiento profundo con 7 agentes en paralelo** (workflow): los 4 pipelines de punta a punta
  (skills + plantillas + libs + endpoints + migraciones, con gap-analysis requisito por requisito
  contra el Word) · mapa de disponibilidad de datos (16 ítems a→p, con ruta exacta de cada lib) ·
  decisiones vigentes de `PLAN_INFORMES{,_V2}.md` que un plan nuevo no puede pisar sin marcar ·
  auditoría de las Routines REALES por MCP (128 triggers paginados → 3 Routines de informes).
- **Entregable: [`PLAN_INFORMES_V3.md`](../PLAN_INFORMES_V3.md)** — roles/nutrición de los 4
  productos (anti-duplicación, §4) · decisiones nuevas N1-N10 con qué revocan (§3) · datos
  explícitos campo por campo por informe con estado EXISTE/NUEVO/MANUAL (§5-§8) · rediseño de
  interpretaciones como skill+Routine propias con calendario y auto-reprogramación (§8) ·
  retroalimentación para los 4 (§9) · **6 prompts de ejecución autocontenidos E1→E6 para builds
  con Sonnet** (§10) · criterios de éxito (§12). Registrado como **C30** en el backlog maestro.
- **Plan auditado adversarialmente** (agente revisor: completitud vs Word, consistencia interna,
  verificación por muestreo de 15 afirmaciones sobre el código) y **corregido en la misma
  sesión** — 3 hallazgos ALTOS reales: (1) el feedback por diff de interpretaciones nacía muerto
  (las RPC dejan `publicado_md == borrador_md` SIEMPRE → se sumó `borrador_original_md` a la
  migración de E1); (2) el Paso 0 de feedback/aprendizajes de diario/semanal se prometía en §9
  pero ninguna etapa lo construía (sumado a E3/E4); (3) colisión horaria entre la
  auto-publicación y los despertadores de la tarde (cierre movido a 18:20 ART, después de
  GEA/DEA/PAS/COT y antes del diario 18:30).

## Decisiones tomadas (y por qué) — las 4 contestadas por Lautaro en el chat
- **Carga diaria sigue TEXTO LIBRE** (sin form estructurado): pizarra estimada/volumen físico
  entran a mano en el color; la variación se calcula contra el último valor del cron
  (`pizarra_historico`) y **si falta cualquiera de los dos, no se calcula** (textual de Lautaro).
- **Interpretaciones se AUTO-PUBLICAN "tras unas horas"** si no las tocó — revoca parcialmente
  "su firma nunca sale sin su OK" SOLO para interpretaciones (propuesta concreta del plan:
  cierre 18:20 ART + marca `auto_publicado`).
- **Diario: PNG sigue + versión WEB con link** ("que entren los clientes o el público con un
  link, indaguémoslo") — E3 construye las dos puertas (gate por sección + link firmado) y él elige.
- **Alcance de interpretaciones**: los 5 organismos + **PAS zonas/condición + CFTC COT + USDA
  Export Sales** (eligió las 3 opciones) — COT/Export Sales por fetch-en-vivo, sin ingesta nueva.

Del Word salen además: semanal **sin límite de páginas** (revoca las 5 duras de V2 §10.3) · view
con **5 estados** (alcista/lev. alcista/neutral/lev. bajista/bajista) · diario y semanal
**estructurados por producto SOJA→MAÍZ→TRIGO con local/internacional separados** · regla "**sin
internals**" (percentiles → tendencias en lo que sale a clientes).

## Verificado
- lint ✅ · tsc ✅ · vitest 445/445 ✅ · build ✅ (diff solo docs — protocolo igual).
- Relevamiento cotejado contra el código real (rutas archivo:línea en los informes de los
  agentes, guardados en el scratchpad de la sesión); las afirmaciones del plan sobre el repo
  pasaron por el revisor adversarial con verificación por muestreo.
- Routines auditadas contra el MCP real (ids, crons, prompts completos — no contra docs).

## Revisión objetiva post-plan (pedida por Lautaro en la misma sesión)

Se revisó el trabajo con ojo crítico, verificando contra el repo. **Hallazgo mayor confirmado
contra los workflows**: `ingest-cierres` corre 20:08 ART y el diario 18:30 → los bloques A3 EOD
del informe se armaban con la rueda de AYER (y el semanal de vie 19:00 cierra su semana en
jueves: los cierres del viernes entran 20:08 y CBOT 19:11). **Lautaro definió la fuente: para
los futuros locales diarios, el WebSocket de A3** (trae volúmenes y ajuste); CEM "no creo que
actualice para el informe, hay que chequearlo" → registrado como **decisión N11** en el plan
(§3) y bajado a §5.1.C y al prompt E1.

**Propuestas del resto de la revisión, PENDIENTES del OK de Lautaro** (viven en el chat de la
sesión; se bajan al plan cuando decida):
1. **Semanal de 19:00 → 20:30 ART** para que la semana incluya el viernes (cambio de cron, E6).
2. **Telemetría de Routines** (tabla `routine_runs`: duración/degradaciones por corrida) +
   watchdog "no salió el informe de hoy → mail 19:00" — de paso resuelve la medición R5 de V2.
3. **Scorecard de interpretaciones**: medir el `impacto` por grano contra `futuros_cierres` a
   7/14 días con la misma lib del scorecard del view.
4. **Nota 1-tap desde el mail** (links firmados 👍/😐/👎 sin login) + **eco de lo entendido**
   del color en el mail (el feedback del view lleva 0 notas desde el 28/07 — el loop necesita
   fricción cero).
5. **Backtest de umbrales en E1** (DJVE/camiones/macro contra 90 días reales, objetivo 1-3
   disparos/semana — la lección del 0,7/1,3 de L4).
6. Menores: PNG compacto 1 página + web completa como resolución de la tensión "1-2 páginas" ·
   banco de oro de prosa por skill · firma "Mesa ROFO AGRO" para las auto-publicadas · spikes de
   datos (SIO diario, serie FAS/basis, scrape del comentario Chicago BCR, expectativas DTN
   guardadas, clima SMN a futuro) · paralelizar E3/E4/E5 en 3 sesiones Sonnet.

## Quedó pendiente / en vuelo
- **Ejecutar E1→E6** con Sonnet (prompts en `PLAN_INFORMES_V3.md` §10). Orden: E1 (datos/
  migraciones) → E2 (interpretaciones) → E3 (diario) → E4 (semanal) → E5 (view) → E6 (Routines
  + cierre). Las migraciones de E1 se aplican por MCP con OK de Lautaro.
- Micro-decisión en E1: campo aparte `chicago_bcr` vs pegar todo en el único texto del color
  (el plan recomienda campo aparte para citar "según BCR" sin mezclar fuentes; no bloquea).
- En E2: verificar si el entorno headless de Routines tiene `send_later` (auto-reprogramación);
  fallback documentado (2º cron fijo 18:00 ART).
- El loop de feedback del view sigue **sin usar** (0 notas al 04/08) — V3 no lo puede arrancar
  por Lautaro; queda como hábito suyo (1 min/semana en `/granos/view`).

## Trampas descubiertas (para la próxima sesión)
- **La plantilla del diario NO consume el JSON del API**: re-llama las libs directo → el fix de
  `actualizadoEn` para PAS está en `route.ts:121` pero NO en `getInformesHoy` de
  `informe-diario-datos.ts` (dos criterios distintos de "informe de hoy" según la superficie).
  E1 lo unifica.
- **Las 3 Routines tienen el prompt con el repo viejo** (`RFAGRO_RESEARCH_WEB`) — funcionan
  porque el clone real sale del `job_config.sources` (que sí apunta al nuevo), pero el texto
  está desactualizado. La del view además NO avisa por mail ante falla (las otras 2 sí).
- La detección de interpretaciones depende de que la ingesta haya corrido: GEA/DEA ingestan
  22:16 → hoy su interpretación sale un día tarde; el plan lo ataca con la rutina propia
  (detección por `actualizado_en` varias veces al día + posible `workflow_dispatch` de la
  ingesta desde la rutina).
- `calendario_informes` (tabla) existe desde julio y está muerta — nadie la escribe ni la lee;
  el calendario vivo es `calendario.ts` (código). No confundirse al construir E2.
