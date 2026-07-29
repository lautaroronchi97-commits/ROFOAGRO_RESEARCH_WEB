-- ROFO AGRO · proyecto Supabase lineup-argentina (gbpfgfeksqmzmsxnxiwg)
-- C23 (docs/PLAN_PAS_ZONAS.md §3.a, Fase 1): producción BCBA-PAS por zona agroecológica.
--
-- Formato ANCHO sin vintages (decisión 6 del plan): el export de BCBA trae SIEMPRE el
-- histórico completo, las campañas cerradas no cambian y el origen no publica fecha de
-- edición → upsert simple por clave natural (grano, campania, zona) + actualizado_en.
--
-- RLS cerrada de verdad (decisión 2 del plan, patrón views_mercado de 20260721150000):
-- SELECT solo authenticated + is_admin(), anon revocado. NO alcanza con el gate de página
-- (requireAdmin en /produccion/zonas) — la tabla en sí queda inaccesible sin sesión de mesa.

-- ============================================================================
-- 1. Tabla pas_zonas
-- ============================================================================
create table public.pas_zonas (
  grano          text not null,   -- 'soja'|'maiz'|'trigo'|'girasol'|'cebada'|'sorgo'
  campania       text not null,   -- canónico '2000/01' (mismo formato que estimaciones_produccion)
  zona           text not null,   -- nombre literal BCBA ('NOA'…'Otras') o 'TOTAL'
  sembrado_ha    numeric,
  perdido_ha     numeric,
  cosechado_ha   numeric,
  produccion_tn  numeric,         -- null si todavía sin cosecha (nunca 0 fantasma)
  rinde_tn_ha    numeric,         -- SIEMPRE recalculado produccion/cosechado, nunca del origen
  actualizado_en timestamptz not null default now(),
  primary key (grano, campania, zona)
);

comment on table public.pas_zonas is
  'Producción por zona agroecológica de BCBA-PAS (C23, docs/PLAN_PAS_ZONAS.md). Carga manual '
  'semi-manual vía /admin/datos (Cloudflare bloquea bots). Interno mesa: RLS solo admin.';

alter table public.pas_zonas enable row level security;

create policy pas_zonas_select_admin on public.pas_zonas
  for select to authenticated using (public.is_admin());

revoke all on public.pas_zonas from public, anon;
grant select on public.pas_zonas to authenticated;

-- ============================================================================
-- 2. admin_upsert_pas_zonas(filas jsonb) → integer
--    Clon estructural de admin_upsert_estimaciones (20260722180000): guard is_admin()
--    adentro, upsert por lote de filas ya parseadas en el server action (parse-pas-zonas.ts).
--    actualizado_en = now() en el UPDATE es lo que /admin/conexiones usa como "última carga".
-- ============================================================================
create or replace function public.admin_upsert_pas_zonas(filas jsonb)
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
    insert into public.pas_zonas
      (grano, campania, zona, sembrado_ha, perdido_ha, cosechado_ha, produccion_tn, rinde_tn_ha, actualizado_en)
    select
      f->>'grano',
      f->>'campania',
      f->>'zona',
      (f->>'sembrado_ha')::numeric,
      (f->>'perdido_ha')::numeric,
      (f->>'cosechado_ha')::numeric,
      (f->>'produccion_tn')::numeric,
      (f->>'rinde_tn_ha')::numeric,
      now()
    from jsonb_array_elements(filas) as f
    on conflict (grano, campania, zona) do update
      set sembrado_ha = excluded.sembrado_ha,
          perdido_ha = excluded.perdido_ha,
          cosechado_ha = excluded.cosechado_ha,
          produccion_tn = excluded.produccion_tn,
          rinde_tn_ha = excluded.rinde_tn_ha,
          actualizado_en = now()
    returning 1
  )
  select count(*) into n from ins;

  return n;
end;
$$;

revoke all on function public.admin_upsert_pas_zonas(jsonb) from public, anon;
grant execute on function public.admin_upsert_pas_zonas(jsonb) to authenticated;
