-- ROFO AGRO · proyecto Supabase ROFO_AGRO_BASES_DE_DATOS (gbpfgfeksqmzmsxnxiwg)
-- V2 (docs/PLAN_INFORMES_V2.md §6.2, fix de auditoría MEDIO): interpretaciones v2.
--
-- `evidencia_externa` guarda los pasaportes (URL + fecha + cita) del research de "expectativa
-- vs dato" (tabla DTN/Pro Farmer pre-report) que la skill informe-diario suma al Paso 9 — mismo
-- shape que `views_mercado.evidencia_externa` (V1, 20260728120000), para que quede algo mecánico
-- que re-verificar en vez de texto enterrado en borrador_md/publicado_md. La escribe la skill por
-- INSERT directo con service_role (como el resto de la fila) — no necesita RPC nueva.

alter table public.interpretaciones
  add column if not exists evidencia_externa jsonb not null default '[]'::jsonb;

comment on column public.interpretaciones.evidencia_externa is
  'Array [{dato, url, fecha_pub, cita}] — pasaportes del research "expectativa vs dato" (DTN/Pro Farmer pre-report), verificados antes de citar. Vacío si el informe no tuvo research externo (GEA/DEA/CONAB degradan a consenso implícito, sin fuente nueva).';
