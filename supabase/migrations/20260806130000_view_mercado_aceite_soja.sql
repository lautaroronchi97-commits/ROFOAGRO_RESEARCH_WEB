-- ROFO AGRO · proyecto Supabase ROFO_AGRO_BASES_DE_DATOS (gbpfgfeksqmzmsxnxiwg)
-- Suma "aceite_soja" como 4º grano del view direccional semanal (skill view-mercado),
-- junto a soja/maiz/trigo. Pedido de Lautaro (06/08/2026).
--
-- El CHECK original (20260721150000) es inline SIN nombre explícito — Postgres lo
-- autogeneró como `views_mercado_grano_check` (mismo patrón resuelto por catálogo que
-- 20260804120000_e1_views_mercado_5_estados, por si el nombre real difiere).
--
-- aceite_soja NO tiene futuro propio en A3 (sin fila en `futuros_cierres`) — el view de
-- ese grano se apoya en `chicago` (CBOT ZL, ya viene en los insumos) y en
-- `capacidad.industriaSoja` (FAS teórico del complejo aceite+harina) en vez de la
-- batería de datos físicos locales (temperatura/semáforo/empresas/embarques/negociado/
-- senalCamiones/arbitrajes/pases), que son del poroto. Su scorecard degrada siempre a
-- "sin datos" (ver GRANO_UNDERLYING en src/lib/views-scorecard.ts) — no hace falta
-- ningún cambio de esquema para eso, es puro código.

do $$
declare
  v_conname text;
begin
  select con.conname into v_conname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'views_mercado'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%grano%';

  if v_conname is not null then
    execute format('alter table public.views_mercado drop constraint %I', v_conname);
  end if;
end $$;

alter table public.views_mercado
  add constraint views_mercado_grano_check
  check (grano in ('soja', 'maiz', 'trigo', 'aceite_soja'));

comment on column public.views_mercado.grano is
  '4 granos: soja/maiz/trigo (con futuro local en A3 y scorecard contra futuros_cierres) + aceite_soja (sin futuro local — se apoya en chicago/CBOT ZL y capacidad.industriaSoja; scorecard siempre "sin datos", ver views-scorecard.ts).';
