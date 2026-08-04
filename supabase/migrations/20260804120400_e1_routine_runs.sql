-- ROFO AGRO · proyecto Supabase ROFO_AGRO_BASES_DE_DATOS (gbpfgfeksqmzmsxnxiwg)
-- E1 (docs/PLAN_INFORMES_V3.md §3 N13, §9, §11): telemetría de las 4 Routines de
-- informes — cada skill inserta UNA fila al cerrar (con la service key, bypasa
-- RLS, mismo patrón de escritura que `informes_generados`/`views_mercado`).
-- Resuelve la medición R5 que quedó pendiente de PLAN_INFORMES_V2.md, alimenta con
-- dato real el balde "🟣 No se generó" de /admin/checklist, y habilita el watchdog
-- de E6 ("no salió el informe diario a las 19:00 ART").

create table if not exists public.routine_runs (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('diario', 'semanal', 'view', 'interpretaciones')),
  fecha         date not null,
  iniciado_en   timestamptz not null,
  terminado_en  timestamptz,
  duracion_ms   integer,
  degradaciones jsonb not null default '[]'::jsonb,
  mail_enviado  boolean not null default false,
  creado_en     timestamptz not null default now()
);

comment on table public.routine_runs is
  'Telemetría de cada corrida de las 4 Routines de informes (diario/semanal/view/interpretaciones) — N13 de PLAN_INFORMES_V3.md. Escribe la Routine (service_role) al cerrar; lee solo la mesa (is_admin).';
comment on column public.routine_runs.degradaciones is
  'Array de strings — qué insumo faltó o degradó honesto en esta corrida (ej. "sin pizarra estimada", "WS de A3 caído, fallback a futuros_cierres"). Vacío si todo salió con datos completos.';
comment on column public.routine_runs.duracion_ms is
  'terminado_en − iniciado_en en milisegundos, precalculado por la skill al cerrar (evita repetir el cálculo en cada lectura del panel).';

create index if not exists routine_runs_tipo_fecha_idx on public.routine_runs (tipo, fecha desc);

alter table public.routine_runs enable row level security;

drop policy if exists routine_runs_select_admin on public.routine_runs;
create policy routine_runs_select_admin on public.routine_runs
  for select to authenticated using (public.is_admin());

revoke all on public.routine_runs from public, anon;
grant select on public.routine_runs to authenticated;
