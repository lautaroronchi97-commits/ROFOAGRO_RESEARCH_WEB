-- ROFO AGRO · proyecto Supabase lineup-argentina (gbpfgfeksqmzmsxnxiwg)
-- C32/F1 (docs/PLAN_CALOR_MERCADERIA.md §3.3, prompt F1 punto 2): base histórica del FAS teórico,
-- en formato LARGO, para fusionar la señal física con el eje precio (F2) y backtestear el
-- veredicto contra el premio local (F3).
--
-- 4 fuentes conviven en la MISMA tabla, una fila por (fecha, producto, fuente):
--   'sagyp'         — FAS Teórico Oficial SAGyP (backfill: serie de Agrochat 2007→hoy, §4 del
--                     plan; live diario: columna "SAGyP" de la planilla de BCR, que expone la
--                     MISMA base — ver `capacidad.ts` CapGrano.fasSagyp, C32/F1 punto 1).
--   'bcr_upriver'   — FAS teórico que hoy ya muestra `/granos/capacidad` como "BCR"
--                     (CapGrano.fasBcr — para GIRASOL sale de la sección Industria, ver el
--                     docstring de capacidad.ts).
--   'bcr_industria' — FAS Teórico Industria de BCR (complejo aceite+harina), solo producto='SBS'
--                     hoy (decisión 6 del plan, "SOJA = VARA INDUSTRIA"; CapIndustria.fasBcr).
--   'nuestro'       — FAS teórico ROFO AGRO (capacidad-modelo.ts / capacidad-industria-modelo.ts).
--
-- `producto` usa el catálogo interno de src/lib/fas-catalogo.ts (SBS/MAIZE/WHEAT/SFSEED/SORGHUM
-- para los 5 granos con pata física + SBO/SFO/CEBADA_C/BARLEY para los productos que solo trae
-- el CSV, sin consumidor todavía — F4 del plan).
--
-- Interno mesa: `/comercio/temperatura` (F2) es solo-admin — mismo patrón de RLS que
-- `views_mercado`/`pas_zonas` (SELECT solo authenticated+is_admin(), anon revocado). Escritura:
-- SIEMPRE service_role (cron `scripts/ingest-fas.mjs` + backfill `scripts/cargar-fas.mjs`), sin
-- policy de insert/update ni RPC — nadie loguea escribe esta tabla a mano.
--
-- Refuerzo de default privileges DESDE EL DÍA 1 (lección de C31, 05/08/2026: los default
-- privileges del esquema public dan ALL a `authenticated`/`service_role` en toda tabla nueva —
-- sin este revoke, `authenticated` tendría DELETE/TRUNCATE de más pese a que RLS no le da
-- ninguna policy de escritura; TRUNCATE en particular ignora RLS por completo).

create table public.fas_historico (
  fecha    date not null,
  producto text not null,
  fuente   text not null check (fuente in ('sagyp', 'bcr_upriver', 'bcr_industria', 'nuestro')),
  fas_usd  double precision not null,
  fas_ars  double precision,
  tc       double precision,
  creado_en timestamptz not null default now(),
  primary key (fecha, producto, fuente)
);

comment on table public.fas_historico is
  'Base histórica del FAS teórico por producto y fuente (C32/F1, docs/PLAN_CALOR_MERCADERIA.md §3.3). '
  'Interno mesa: RLS solo admin. Escritura solo service_role (cron ingest-fas.mjs + backfill cargar-fas.mjs).';

-- Serie por producto (la que consumirá F2/F3: percentil del spread FAS−pizarra por producto,
-- 19 años de historia) — la PK ya sirve fecha+producto+fuente, este índice cubre el barrido
-- "toda la historia de UN producto" sin filtrar por fuente.
create index fas_historico_producto_fecha_idx on public.fas_historico (producto, fecha);

alter table public.fas_historico enable row level security;

create policy fas_historico_select_admin on public.fas_historico
  for select to authenticated using (public.is_admin());

revoke all on public.fas_historico from public, anon;
revoke all on public.fas_historico from authenticated;
grant select on public.fas_historico to authenticated;
