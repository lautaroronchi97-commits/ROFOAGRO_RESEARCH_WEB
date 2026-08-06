-- ROFO AGRO · proyecto Supabase ROFO_AGRO_BASES_DE_DATOS (gbpfgfeksqmzmsxnxiwg)
-- Rediseño de "condición" + botón Canje + período de fijación en "Mis operaciones"
-- (C31, docs/PLAN_OPERACIONES_CLIENTES.md). Pedido de Lautaro (06/08/2026).
--
-- SIN APLICAR a propósito (protocolo del proyecto): la aplica el orquestador por MCP
-- con el OK de Lautaro. El código ya valida estas reglas en `validarOperacion`
-- (src/lib/operaciones/registro.ts) — esta migración solo hace que la base las exija
-- también (mismo criterio "coherencia dura" del resto de la tabla).
--
-- Cambios:
--   1. Condición pasa de (carta_garantia, a_fijar, a_precio, forward) a
--      (a_fijar, a_precio, pago_anticipado, pizarra) — 4 valores nuevos, mismo
--      catálogo por nombre resuelto en runtime que 20260806130000/20260806140000
--      (el CHECK original de 20260805130000 es inline sin nombre explícito).
--   2. Qué condición admite cada tipo (antes libre para cualquier tipo):
--        disponible/forward → las 4 · fijación → SOLO pizarra o a_precio (nunca
--        null) · futuro_a3 → ninguna (siempre null, precio siempre manual).
--   3. precio_modo pasa a derivarse SIEMPRE de la condición cuando hay una
--      (a_fijar→sin_precio · pizarra→pizarra · a_precio/pago_anticipado→manual);
--      esto reemplaza la constraint vieja `op_fijacion_precio` (que exigía
--      SIEMPRE manual en fijación — ahora también admite pizarra).
--   4. es_canje: booleano simple, default false.
--   5. fijacion_desde/fijacion_hasta: período de fijación, solo aplica con
--      condición "a_fijar" (desde obligatorio, hasta libre/abierto).

-- 1. Condición: reemplazar el CHECK (mismo patrón de catálogo por nombre).
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
    and pg_get_constraintdef(con.oid) ilike '%condicion%'
    and pg_get_constraintdef(con.oid) not ilike '%tipo%'; -- no tocar la nueva op_condicion_por_tipo si esta migración se re-corre

  if v_conname is not null then
    execute format('alter table public.operaciones drop constraint %I', v_conname);
  end if;
end $$;

alter table public.operaciones
  add constraint operaciones_condicion_check
  check (condicion in ('a_fijar', 'a_precio', 'pago_anticipado', 'pizarra'));

-- 2. Columnas nuevas.
alter table public.operaciones
  add column if not exists es_canje boolean not null default false,
  add column if not exists fijacion_desde date,
  add column if not exists fijacion_hasta date;

-- 3. Reemplazar la constraint vieja de fijación (exigía SIEMPRE precio_modo
--    manual; ahora fijación admite pizarra también, ver punto 3 de arriba).
alter table public.operaciones drop constraint if exists op_fijacion_precio;
alter table public.operaciones
  add constraint op_fijacion_precio check (tipo <> 'fijacion' or precio_modo in ('manual', 'pizarra'));

-- 4. Qué condición admite cada tipo.
alter table public.operaciones drop constraint if exists op_condicion_por_tipo;
alter table public.operaciones
  add constraint op_condicion_por_tipo check (
    (tipo not in ('fijacion', 'futuro_a3'))
    or (tipo = 'fijacion' and condicion in ('pizarra', 'a_precio'))
    or (tipo = 'futuro_a3' and condicion is null)
  );

-- 5. precio_modo tiene que coincidir con lo que la condición implica (cuando
--    hay condición — futuro_a3 no la usa y sigue con su propia constraint
--    `op_futuro_posicion`, que ya exige precio_modo='manual').
alter table public.operaciones drop constraint if exists op_precio_modo_condicion;
alter table public.operaciones
  add constraint op_precio_modo_condicion check (
    condicion is null
    or (condicion = 'a_fijar' and precio_modo = 'sin_precio')
    or (condicion = 'pizarra' and precio_modo = 'pizarra')
    or (condicion in ('a_precio', 'pago_anticipado') and precio_modo = 'manual')
  );

-- 6. Período de fijación: obligatorio (desde) solo con condición "a fijar";
--    "hasta" queda libre (null = fijación abierta, sin límite).
alter table public.operaciones drop constraint if exists op_fijacion_periodo;
alter table public.operaciones
  add constraint op_fijacion_periodo check (condicion <> 'a_fijar' or fijacion_desde is not null);

alter table public.operaciones drop constraint if exists op_fijacion_periodo_orden;
alter table public.operaciones
  add constraint op_fijacion_periodo_orden
  check (fijacion_hasta is null or fijacion_desde is null or fijacion_hasta >= fijacion_desde);

comment on column public.operaciones.condicion is
  '4 condiciones: a_fijar (sin precio, ver fijacion_desde/hasta) · a_precio/pago_anticipado (precio manual) · pizarra (precio_modo=pizarra, se resuelve solo al día siguiente). Disponible/forward admiten las 4; fijación solo pizarra/a_precio; futuro_a3 no la usa (siempre null).';
comment on column public.operaciones.es_canje is
  'Botón "Es canje: Sí/No" del registro (pedido de Lautoro 06/08/2026) — flag simple, sin efecto en el cálculo de posición.';
comment on column public.operaciones.fijacion_desde is
  'Período de fijación (solo condición a_fijar): desde cuándo se puede fijar el precio. Sugerido en la UI desde el inicio de entrega (forward) o la fecha de la operación (disponible), editable.';
comment on column public.operaciones.fijacion_hasta is
  'Período de fijación (solo condición a_fijar): hasta cuándo. Null = fijación abierta, sin fecha límite.';
