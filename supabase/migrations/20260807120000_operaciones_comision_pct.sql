-- ROFO AGRO · proyecto Supabase ROFO_AGRO_BASES_DE_DATOS (gbpfgfeksqmzmsxnxiwg)
-- "Mis operaciones" (C31): comisión % del negocio, campo nuevo pedido por Lautaro
-- (07/08/2026) para "Carga de negocios" — se suma a descuento_pct/descuento_monto
-- como otro ajuste que se aplica sobre el precio base para llegar al precio final
-- (src/lib/operaciones/registro.ts: aplicarDescuentos/resolverPrecio).
--
-- SIN APLICAR a propósito (protocolo del proyecto): la aplica el orquestador por
-- MCP con el OK de Lautaro. El código ya valida 0-100 en `validarOperacion`.

alter table public.operaciones
  add column if not exists comision_pct numeric(7,4)
  check (comision_pct >= 0 and comision_pct <= 100);

comment on column public.operaciones.comision_pct is
  'Comisión % del negocio (pedido de Lautaro 07/08/2026, "Carga de negocios") — se aplica junto con descuento_pct/descuento_monto para llegar al precio final (aplicarDescuentos). Independiente del descuento (ej. comisión de la mesa vs. descuento de flete/pizarra).';
