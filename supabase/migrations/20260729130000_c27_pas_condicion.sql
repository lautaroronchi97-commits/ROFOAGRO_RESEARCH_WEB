-- ROFO AGRO · proyecto Supabase lineup-argentina (gbpfgfeksqmzmsxnxiwg)
-- C27 (docs/PLAN_PAS_ZONAS.md §3.b, Fase 2): condición de cultivos semanal BCBA-PAS.
--
-- Formato ANCHO sin vintages (misma decisión que pas_zonas, 20260729120000): el export de BCBA
-- trae SIEMPRE el histórico completo por cultivo, sin fecha de edición → upsert simple por
-- clave natural (grano, ciclo, zona, campania, semana) + actualizado_en.
--
-- RLS cerrada de verdad (mismo patrón views_mercado / pas_zonas): SELECT solo authenticated +
-- is_admin(), anon revocado. NO alcanza con el gate de página (requireAdmin en
-- /produccion/condicion) — la tabla en sí queda inaccesible sin sesión de mesa.

-- ============================================================================
-- 1. Tabla pas_condicion
-- ============================================================================
create table public.pas_condicion (
  grano          text not null,                  -- 'girasol'|'soja'|'maiz'|'trigo' (únicos con este reporte en BCBA)
  ciclo          text not null default 'total',   -- 'total'|'1ra'|'2da' (Soja/Soja1/Soja2, Maiz/Maiz1/Maiz2)
  zona           text not null default 'TOTAL',   -- v1 solo TOTAL en los 4 exports; columna lista para el desglose futuro
  campania       text not null,                   -- canónico '2020/21'
  semana         smallint not null,               -- 0-53, semana DE CAMPAÑA (el origen no trae fecha real)
  siembra_pct    numeric,
  cc_mala        numeric, cc_regular numeric, cc_normal numeric, cc_buena numeric, cc_excelente numeric,
  ch_sequia      numeric, ch_regular numeric, ch_adecuada numeric, ch_optima numeric, ch_exceso numeric,
  fenologia      jsonb not null default '[]',     -- ARRAY ordenado [{"etapa":"Expansión Foliar","pct":12.3},…]
  actualizado_en timestamptz not null default now(),
  primary key (grano, ciclo, zona, campania, semana)
);

comment on table public.pas_condicion is
  'Condición semanal de cultivos de BCBA-PAS (C27, docs/PLAN_PAS_ZONAS.md §3.b/§4.c). Carga '
  'manual vía /admin/datos (Cloudflare bloquea bots). Interno mesa: RLS solo admin. La fenología '
  'va en jsonb porque sus etapas cambian de nombre por cultivo (girasol/soja/maíz/trigo tienen '
  '4 vocabularios agronómicos distintos) — un objeto {etapa:pct} perdería el orden secuencial '
  'del header, por eso es un array.';

alter table public.pas_condicion enable row level security;

create policy pas_condicion_select_admin on public.pas_condicion
  for select to authenticated using (public.is_admin());

revoke all on public.pas_condicion from public, anon;
grant select on public.pas_condicion to authenticated;

-- ============================================================================
-- 2. admin_upsert_pas_condicion(filas jsonb) → integer
--    Clon estructural de admin_upsert_pas_zonas (20260729120000): guard is_admin() adentro,
--    upsert por lote de filas ya parseadas en el server action (parse-pas-condicion.ts).
--    actualizado_en = now() en el UPDATE es lo que /admin/conexiones usa como "última carga".
-- ============================================================================
create or replace function public.admin_upsert_pas_condicion(filas jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer;
begin
  if not public.is_admin() then
    raise exception 'solo admin';
  end if;

  with ins as (
    insert into public.pas_condicion
      (grano, ciclo, zona, campania, semana, siembra_pct,
       cc_mala, cc_regular, cc_normal, cc_buena, cc_excelente,
       ch_sequia, ch_regular, ch_adecuada, ch_optima, ch_exceso,
       fenologia, actualizado_en)
    select
      f->>'grano',
      f->>'ciclo',
      f->>'zona',
      f->>'campania',
      (f->>'semana')::smallint,
      (f->>'siembra_pct')::numeric,
      (f->>'cc_mala')::numeric,
      (f->>'cc_regular')::numeric,
      (f->>'cc_normal')::numeric,
      (f->>'cc_buena')::numeric,
      (f->>'cc_excelente')::numeric,
      (f->>'ch_sequia')::numeric,
      (f->>'ch_regular')::numeric,
      (f->>'ch_adecuada')::numeric,
      (f->>'ch_optima')::numeric,
      (f->>'ch_exceso')::numeric,
      coalesce(f->'fenologia', '[]'::jsonb),
      now()
    from jsonb_array_elements(filas) as f
    on conflict (grano, ciclo, zona, campania, semana) do update
      set siembra_pct = excluded.siembra_pct,
          cc_mala = excluded.cc_mala,
          cc_regular = excluded.cc_regular,
          cc_normal = excluded.cc_normal,
          cc_buena = excluded.cc_buena,
          cc_excelente = excluded.cc_excelente,
          ch_sequia = excluded.ch_sequia,
          ch_regular = excluded.ch_regular,
          ch_adecuada = excluded.ch_adecuada,
          ch_optima = excluded.ch_optima,
          ch_exceso = excluded.ch_exceso,
          fenologia = excluded.fenologia,
          actualizado_en = now()
    returning 1
  )
  select count(*) into n from ins;

  return n;
end;
$$;

revoke all on function public.admin_upsert_pas_condicion(jsonb) from public, anon;
grant execute on function public.admin_upsert_pas_condicion(jsonb) to authenticated;
