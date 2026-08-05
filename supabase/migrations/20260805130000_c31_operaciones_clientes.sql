-- ROFO AGRO · proyecto Supabase lineup-argentina (gbpfgfeksqmzmsxnxiwg)
-- C31 (docs/PLAN_OPERACIONES_CLIENTES.md §4/§8, Fase 1): operaciones diarias de clientes.
-- Cada empresa carga sus compras/ventas del día y ve su posición neta por producto ×
-- período de entrega. PRIMERA tabla del sistema con RLS por `empresa_id` y la PRIMERA
-- donde los clientes ESCRIBEN (hasta hoy solo leían `views_mercado`/etc. como admins).
--
-- SIN APLICAR a propósito (protocolo del proyecto): la aplica el orquestador por MCP
-- con el OK de Lautaro. El código de la Fase 1 degrada honesto mientras tanto.

-- ============================================================================
-- 1. mi_empresa_id(): helper SECURITY DEFINER, mismo patrón que is_admin()
--    (20260716120000) — evita recursión de RLS al consultar `profiles` desde las
--    propias policies de `operaciones`. Devuelve null si el usuario no está
--    aprobado o no tiene empresa asignada → ninguna policy matchea → 0 filas.
-- ============================================================================
create or replace function public.mi_empresa_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select empresa_id from public.profiles
  where id = auth.uid() and estado = 'aprobado';
$$;

revoke all on function public.mi_empresa_id() from public, anon;
grant execute on function public.mi_empresa_id() to authenticated;

-- ============================================================================
-- 2. Tabla operaciones (§4.2 del plan)
-- ============================================================================
create table public.operaciones (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id),
  fecha           date not null,                    -- fecha de concertación (editable, retroactiva ok)
  lado            text not null check (lado in ('compra','venta')),
  producto        text not null check (producto in ('soja','maiz','trigo','girasol','sorgo')),
  tipo            text not null check (tipo in ('disponible','forward','fijacion','futuro_a3')),
  condicion       text     check (condicion in ('carta_garantia','a_fijar','a_precio','forward')),
  campania        text not null check (campania ~ '^[0-9]{2}/[0-9]{2}$'),   -- '25/26'
  volumen_tn      numeric(14,2) not null check (volumen_tn > 0),
  precio_modo     text not null check (precio_modo in ('manual','pizarra','sin_precio')),
  precio          numeric(14,2) check (precio > 0),  -- solo modo manual (o pizarra ya "pisada" a mano)
  moneda          text check (moneda in ('usd','ars')),
  descuento_pct   numeric(7,4)  check (descuento_pct  >= 0 and descuento_pct <= 100),  -- ej. pizarra −10%
  descuento_monto numeric(14,2) check (descuento_monto >= 0),  -- monto fijo en la moneda de la op. (ej. −38.000 $ flete)
  entrega_desde   date,                             -- inicio de entrega (forwards)
  entrega_hasta   date,                             -- fin de entrega
  posicion_a3     text,                             -- 'NOV26' — solo tipo futuro_a3
  contraparte     text,
  nro_contrato    text,
  observaciones   text,
  anulada         boolean not null default false,
  creado_por      uuid references public.profiles(id),
  creado_en       timestamptz not null default now(),
  actualizado_por uuid references public.profiles(id),
  actualizado_en  timestamptz not null default now(),

  -- coherencia dura (la UI valida antes, la base no deja pasar igual):
  constraint op_manual_completo   check (precio_modo <> 'manual'     or (precio is not null and moneda is not null)),
  constraint op_sin_precio_limpio check (precio_modo <> 'sin_precio' or precio is null),
  constraint op_pizarra_moneda    check (precio_modo <> 'pizarra'    or moneda is not null),
  constraint op_futuro_posicion   check (tipo <> 'futuro_a3' or (posicion_a3 is not null and precio_modo = 'manual')),
  constraint op_fijacion_precio   check (tipo <> 'fijacion'  or precio_modo = 'manual'),
  constraint op_forward_entrega   check (tipo <> 'forward'   or entrega_desde is not null),
  constraint op_entrega_orden     check (entrega_hasta is null or entrega_desde is null or entrega_hasta >= entrega_desde)
);

comment on table public.operaciones is
  'Operaciones de compra/venta diarias por empresa cliente (C31). Libro mayor: cada fila con su fecha de concertación; posición/neto son vistas calculadas en TS (src/lib/operaciones/posicion.ts). Fijaciones NO suman volumen (registro nuevo que solo genera precio). Sin vínculo a su contrato a fijar (decisión Lautoro §7.1).';

create index idx_operaciones_empresa_fecha    on public.operaciones (empresa_id, fecha desc);
create index idx_operaciones_empresa_producto on public.operaciones (empresa_id, producto);

-- ============================================================================
-- 3. operaciones_log (§4.3): historial de cambios por TRIGGER, no por la app —
--    queda registrado cualquier camino de escritura (cliente, admin en nombre
--    del cliente, service_role) sin depender de que cada server action se acuerde.
-- ============================================================================
create table public.operaciones_log (
  id           bigint generated always as identity primary key,
  operacion_id uuid not null,
  empresa_id   uuid not null,
  usuario_id   uuid,                -- auth.uid(); null si escribió service_role
  accion       text not null check (accion in ('crear','editar','anular','restaurar')),
  antes        jsonb,               -- fila completa previa (null en 'crear')
  despues      jsonb not null,      -- fila completa nueva
  en           timestamptz not null default now()
);

comment on table public.operaciones_log is
  'Audit trail de operaciones (C31, decisión Lautoro §1.15). Escrito por trigger sobre operaciones — nunca por la app.';

create index idx_operaciones_log_op on public.operaciones_log (operacion_id, en desc);

-- ============================================================================
-- 4. Trigger de auditoría: fija actualizado_en/actualizado_por (el cliente no
--    los controla, mismo espíritu que protect_profile_fields) y escribe el log.
-- ============================================================================
create or replace function public.operaciones_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accion text;
begin
  new.actualizado_en := now();
  new.actualizado_por := auth.uid();

  if tg_op = 'INSERT' then
    v_accion := 'crear';
    new.creado_en := coalesce(new.creado_en, now());
    new.creado_por := coalesce(new.creado_por, auth.uid());
  elsif old.anulada = false and new.anulada = true then
    v_accion := 'anular';
  elsif old.anulada = true and new.anulada = false then
    v_accion := 'restaurar';
  else
    v_accion := 'editar';
  end if;

  insert into public.operaciones_log (operacion_id, empresa_id, usuario_id, accion, antes, despues)
  values (
    new.id,
    new.empresa_id,
    auth.uid(),
    v_accion,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );

  return new;
end;
$$;

drop trigger if exists operaciones_auditoria_trg on public.operaciones;
create trigger operaciones_auditoria_trg
  before insert or update on public.operaciones
  for each row execute function public.operaciones_auditoria();

-- ============================================================================
-- 5. RLS — el contrato de seguridad completo (§4.4). Postgres es la garantía
--    real: aunque un cliente pegue directo a PostgREST con su JWT, solo ve/
--    escribe filas de SU empresa. Sin grant de DELETE: anular es la única baja
--    posible, ni siquiera queriendo se puede borrar.
-- ============================================================================
alter table public.operaciones     enable row level security;
alter table public.operaciones_log enable row level security;

revoke all on public.operaciones     from public, anon;
revoke all on public.operaciones_log from public, anon;
grant select, insert, update on public.operaciones to authenticated;  -- SIN delete a propósito
grant select on public.operaciones_log to authenticated;              -- el log solo lo escribe el trigger

drop policy if exists op_select on public.operaciones;
create policy op_select on public.operaciones for select to authenticated
  using ((select public.is_admin()) or empresa_id = (select public.mi_empresa_id()));

drop policy if exists op_insert on public.operaciones;
create policy op_insert on public.operaciones for insert to authenticated
  with check ((select public.is_admin()) or empresa_id = (select public.mi_empresa_id()));

drop policy if exists op_update on public.operaciones;
create policy op_update on public.operaciones for update to authenticated
  using      ((select public.is_admin()) or empresa_id = (select public.mi_empresa_id()))
  with check ((select public.is_admin()) or empresa_id = (select public.mi_empresa_id()));

drop policy if exists oplog_select on public.operaciones_log;
create policy oplog_select on public.operaciones_log for select to authenticated
  using ((select public.is_admin()) or empresa_id = (select public.mi_empresa_id()));
