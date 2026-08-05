# Sesión 2026-08-05 — Plan operaciones diarias de clientes (C31)

- **Rama:** `claude/daily-operations-client-table-rff7u6` · **PR:** #_ (base `main`)
- **Objetivo pedido por Lautaro:** pensar juntos (etapa de craneo, sin construir) una tabla donde
  cada empresa cliente cargue sus compras/ventas del día y vea si está calzada — por producto,
  con tipos de negocio, precio editable (incl. pizarra que sale al otro día), plazos de entrega,
  historia por día, y **cada empresa viendo SOLO lo suyo** como requisito número uno. Mauro pasó
  una planilla ("Posición Agroleaginosa") como guía. "Quiero que me hagas todas las preguntas
  necesarias… no supongas nada… luego lo construyo con Sonnet."

## Hecho
- **Leída a fondo la planilla de Mauro** (openpyxl, fórmulas incluidas): una hoja por día clonada
  de `Plantilla` (compras y ventas separadas: N° Ctto · contraparte · producto · fecha entrega ·
  período auto · condición · TN · USD/tn · obs), matrices producto × período por día (compras /
  ventas / neto) y hoja `Posición` que acumula los días con columnas de mes rodantes (Disponible
  + 8 meses + "Más adelante") y Estado COMPRADOS/VENDIDOS/NEUTRO. La estructura quedó transcripta
  en el plan (§2); **el xlsx NO se versiona** (trae el nombre de un cliente real).
- **Primera ronda: 29 preguntas** organizadas en 6 bloques (qué es una operación · el tiempo ·
  quién ve/toca · pantalla · análisis · seguridad), cada una con recomendación. Lautaro contestó
  las 29 en un solo mensaje — todas las decisiones quedaron en §1 del plan.
- **Relevamiento del repo con agente** (anclas archivo:línea): auth/DAL/permisos por sección,
  patrón RLS canónico (`views_mercado`), molde de escritura de un no-admin (`completarPerfil` —
  el ÚNICO precedente), `pizarra_historico` + cron, curva/ajustes A3, `CurvaPicker`,
  `filtro-grano`, export CSV, tabs de admin, formato del backlog. Hallazgo clave: **hoy no existe
  ninguna tabla con RLS por `empresa_id`** — esta feature estrena el patrón, por eso el plan lo
  especifica hasta el DDL y las policies exactas.
- **Entregable: [`PLAN_OPERACIONES_CLIENTES.md`](../PLAN_OPERACIONES_CLIENTES.md)** — decisiones
  (§1) · planilla transcripta (§2) · reuso con anclas (§3) · modelo de datos + RLS completos
  (§4: `mi_empresa_id()`, `operaciones` con constraints de coherencia, `operaciones_log` por
  trigger, policies con initplan, sin grant de DELETE) · lógica y pantallas (§5: reglas del neto,
  buckets, pizarra resuelta en lectura, fórmula de futuros CON ejemplo a confirmar, las 2
  páginas) · qué NO entra (§6) · **7 preguntas de segunda ronda con default** (§7) · **2 prompts
  de ejecución autocontenidos** (§8 Fase 1: migración+sección+carga+registro diario+posición
  mínima · §9 Fase 2: posición completa+heatmap+futuros valorizados) · backlog derivado (§10).
- Registrado como **C31** en el backlog maestro (`auditoria/E7-sintesis.md` §4) + «Ahora» de
  `ESTADO.md`.

## Decisiones tomadas (y por qué)
- **Libro mayor, no "planillas diarias"** — confirmado por Lautaro (§1.11): cada operación con su
  fecha de concertación; registro del día, neto del día, posición acumulada y posición-a-fecha
  son vistas calculadas. El "arrancar con el saldo de ayer" sale gratis.
- **Fijación = registro nuevo que genera precio y NO suma volumen** (Lautaro, textual: "una cosa
  es el negocio a fijar y otra la fijación") — evita el doble conteo. En la 2ª ronda eligió
  **SIN vínculo** al contrato a fijar ("no hace falta"): registros independientes, sin self-FK.
- **Futuros A3 separados del físico** (físico / futuros / total) + tabla propia valorizada vs
  precio de ejecución (§1.27). La fórmula quedó escrita con ejemplo numérico y **gateada a su
  confirmación explícita** (regla dura de fórmulas) — es la única pregunta abierta que bloquea
  algo, y solo el panel de futuros de la Fase 2.
- **Pizarra resuelta en LECTURA, no completada a mano**: Lautaro dijo "completamos nosotros al
  otro día", pero la regla del proyecto es que nada dependa de un paso manual — el diseño
  resuelve el precio contra `pizarra_historico` (cron ya existente) al mostrar, con "Pizarra
  (pendiente)" hasta que el dato llegue y override manual editando la operación (que además queda
  en el historial). Mismo resultado, cero proceso nuevo.
- **Anulación en vez de borrado** (queda tachada, pedido explícito) llevada hasta la base: sin
  grant de DELETE a `authenticated` — borrar es imposible incluso pegando directo a PostgREST.
- **Historial de cambios por TRIGGER** (no por la app): registra cualquier camino de escritura
  (cliente, admin en nombre del cliente, service_role) sin depender de cada server action.
- **La regla "Disponible = próximos 30 días" del Excel se CONSERVA** — se le propuso a Lautaro
  la alternativa sin migración silenciosa (forward cae a Disponible recién cuando arranca la
  entrega) y **eligió explícitamente la de Mauro** en la 2ª ronda (§7.2): la posición migra sola
  de columna con el paso de los días, y eso es lo que la mesa quiere leer.
- **Admin ve/edita todo desde la MISMA página** con selector de empresa (nada duplicado en
  `/admin`); para clientes el `empresa_id` sale SIEMPRE de `getPerfil()` server-side, jamás del
  form (y la RLS rebota cualquier forja igual).
- **El xlsx de Mauro no se versiona** (nombre de cliente real en títulos/ejemplos); la
  transcripción de §2 alcanza — no es fixture de ningún parser.

## Verificado
- lint / `tsc --noEmit` / `vitest run` (484 tests) / build ✅ — diff solo docs, protocolo igual.
- La lectura de la planilla se hizo sobre el archivo real con fórmulas y valores (dos pasadas de
  openpyxl), no sobre una vista previa.

## Quedó pendiente / en vuelo
- **Las 7 preguntas de la 2ª ronda quedaron CONTESTADAS en la misma sesión** (§7 del plan):
  1) fijación SIN vínculo al contrato · 2) bucket Disponible = regla de Mauro (hoy+30, migra
  sola) · 3) **pizarra del DÍA SIGUIENTE a la operación** ("la pizarra refleja el mercado del
  día anterior") · 4) descuentos % y monto fijo COMBINABLES (pizarra −10% y −38.000 $ flete) ·
  5) fórmula de futuros confirmada con el ejemplo numérico tal cual · 6) export CSV v1 ·
  7) campañas rotativas + campo libre. **No queda ninguna decisión pendiente.**
- **Ejecutar Fase 1** (prompt §8) → merge → **Fase 2** (prompt §9, completa, panel de futuros
  incluido).
- La migración de Fase 1 se versiona SIN aplicar; la aplica el orquestador por MCP con OK de
  Lautaro (protocolo de siempre).

## Trampas descubiertas (para la próxima sesión)
- `sbSelect`/`sbSelectAll` (`src/lib/supabase.ts`) usan la **service key** en prod → bypasean RLS.
  Para datos por-empresa hay que leer con `createSupabaseServerClient()` (sesión del usuario) —
  está remarcado en el prompt §8; usarlos acá sería un agujero silencioso.
- `requireSeccion()` es NO-OP con `AUTH_ENFORCED` apagado (sandbox): las páginas nuevas necesitan
  degradar honesto sin sesión (sin 500) y la verificación visual local va a requerir bypass
  temporal, como siempre.
- `xlsx-lite.ts` solo LEE xlsx (inflate, no deflate): "export a Excel" real requeriría un módulo
  de escritura nuevo — por eso v1 exporta CSV con BOM (patrón ya existente) y el xlsx quedó en
  backlog derivado.
- El trigger de auditoría debe ser SECURITY DEFINER y además pisar `actualizado_en/actualizado_por`
  — si esas columnas se dejan al cliente, el rastro se puede falsear.
