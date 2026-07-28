-- ROFO AGRO · proyecto Supabase ROFO_AGRO_BASES_DE_DATOS (gbpfgfeksqmzmsxnxiwg)
-- V1 (docs/PLAN_INFORMES_V2.md §5 y §6.1): view-mercado v2 — "la bola de nieve".
--
-- Migración ADITIVA sobre `views_mercado` (20260721150000): la tesis de cada view queda
-- vinculada a su predecesora (relacion_previa/view_previo_id), lleva invalidadores
-- ESTRUCTURADOS que F0 chequea mecánicamente (antes solo texto libre en `invalidacion`),
-- guarda la evidencia externa con pasaporte (URL + fecha + cita, anillo 2 del plan), y
-- suma la nota 1-5 de Lautaro (decisión §10.2) junto al feedback de texto que ya existía.

-- ============================================================================
-- 1. Columnas nuevas
-- ============================================================================
alter table public.views_mercado
  add column if not exists relacion_previa text
    check (relacion_previa in ('inicial', 'confirma', 'ajusta', 'switch', 'cumplida')),
  add column if not exists view_previo_id uuid references public.views_mercado(id),
  add column if not exists invalidadores jsonb not null default '[]'::jsonb,
  add column if not exists evidencia_externa jsonb not null default '[]'::jsonb,
  add column if not exists nota_lautaro smallint check (nota_lautaro between 1 and 5);

comment on column public.views_mercado.relacion_previa is
  'Cómo se relaciona esta tesis con la anterior del mismo grano (F3 de la skill). NULL en views v1 (antes de esta migración).';
comment on column public.views_mercado.view_previo_id is
  'FK al view del mismo grano que esta corrida reconcilió contra (F3). NULL si es la tesis inicial.';
comment on column public.views_mercado.invalidadores is
  'Array [{condicion, umbral, dato_ref, disparado_en}] — condiciones pre-declaradas que F0 chequea mecánicamente en cada corrida. Inmutable una vez escrito salvo tesis nueva (inicial/switch) o edición manual de Lautaro: la skill tiene prohibido tocarlos al confirmar/ajustar.';
comment on column public.views_mercado.evidencia_externa is
  'Array [{dato, url, fecha_pub, cita}] — pasaportes del anillo 2 (fuentes externas), verificados mecánicamente en F5. Nunca pisa un dato del anillo 1 (JSON de insumos propios).';
comment on column public.views_mercado.nota_lautaro is
  'Nota 1-5 de Lautaro sobre el view (calidad/utilidad, no acierto — el acierto lo mide el scorecard contra futuros_cierres). Decisión de Lautaro, 24/07.';

-- ============================================================================
-- 2. admin_feedback_view — EXTENDIDA con p_nota (no se crea una RPC nueva, decisión §5 UI).
--    Postgres trata (uuid,text) y (uuid,text,smallint) como overloads DISTINTOS —
--    `create or replace` con la firma nueva NO pisa la vieja, quedarían las dos
--    coexistiendo (y PostgREST podría ambiguar la llamada de 2 argumentos). Se
--    dropea la firma vieja explícitamente antes de crear la nueva con el parámetro
--    opcional (default null): las llamadas existentes de 2 argumentos siguen
--    resolviendo a esta misma función sin cambios.
-- ============================================================================
drop function if exists public.admin_feedback_view(uuid, text);

create or replace function public.admin_feedback_view(p_id uuid, p_feedback text, p_nota smallint default null)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'solo admin';
  end if;

  if p_nota is not null and (p_nota < 1 or p_nota > 5) then
    raise exception 'nota fuera de rango (1-5)';
  end if;

  update public.views_mercado
     set feedback_lautaro = nullif(btrim(coalesce(p_feedback, '')), ''),
         nota_lautaro = p_nota
   where id = p_id;

  return found;
end;
$$;

revoke all on function public.admin_feedback_view(uuid, text, smallint) from public, anon;
grant execute on function public.admin_feedback_view(uuid, text, smallint) to authenticated;
