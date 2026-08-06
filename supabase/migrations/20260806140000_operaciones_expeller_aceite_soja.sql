-- ROFO AGRO · proyecto Supabase ROFO_AGRO_BASES_DE_DATOS (gbpfgfeksqmzmsxnxiwg)
-- Suma "expeller_soja" y "aceite_soja" como 2 productos más de "Mis operaciones"
-- (C31, docs/PLAN_OPERACIONES_CLIENTES.md), junto a soja/maiz/trigo/girasol/sorgo.
-- Pedido de Lautaro (06/08/2026).
--
-- SIN APLICAR a propósito (protocolo del proyecto): la aplica el orquestador por MCP
-- con el OK de Lautaro. El código ya soporta los 2 productos nuevos y degrada honesto
-- mientras tanto (el POST a `operaciones` con producto='expeller_soja'/'aceite_soja'
-- rechaza por el CHECK viejo hasta que esta migración se aplique).
--
-- El CHECK original (20260805130000) es inline SIN nombre explícito — Postgres lo
-- autogeneró como `operaciones_producto_check` (mismo patrón resuelto por catálogo que
-- 20260806130000_view_mercado_aceite_soja, por si el nombre real difiere).
--
-- Ninguno de los 2 tiene futuro propio en A3 (no entran a PRODUCTOS_CON_FUTURO en
-- src/lib/operaciones/tipos.ts) ni cotizan en la pizarra CAC (`pizarra_historico` solo
-- tiene los 5 granos de siempre) — el precio_modo "pizarra" para estos 2 productos
-- degrada siempre a "pizarra_pendiente" (honesto, no se inventa una cotización), y el
-- tipo "futuro_a3" queda rechazado por `validarOperacion` (mismo criterio que
-- girasol/sorgo hoy).

do $$
declare
  v_conname text;
begin
  select con.conname into v_conname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'operaciones'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%producto%';

  if v_conname is not null then
    execute format('alter table public.operaciones drop constraint %I', v_conname);
  end if;
end $$;

alter table public.operaciones
  add constraint operaciones_producto_check
  check (producto in ('soja', 'maiz', 'trigo', 'girasol', 'sorgo', 'expeller_soja', 'aceite_soja'));

comment on column public.operaciones.producto is
  '7 productos: soja/maiz/trigo (con futuro A3 en PRODUCTOS_CON_FUTURO) + girasol/sorgo/expeller_soja/aceite_soja (solo físico, sin futuro A3 ni pizarra CAC — ver src/lib/operaciones/tipos.ts).';
