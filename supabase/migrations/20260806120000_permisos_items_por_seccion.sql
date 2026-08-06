-- ROFO AGRO · proyecto Supabase lineup-argentina (gbpfgfeksqmzmsxnxiwg)
-- PERMISOS POR ÍTEM DENTRO DE CADA SECCIÓN (pedido de Lautaro 06/08/2026): hasta ahora
-- `empresas.secciones` / `profiles.secciones_override` solo permitían prender/apagar una
-- sección ENTERA (ej. "Calculadoras"). Esta migración suma un segundo nivel, opcional:
-- qué ítems concretos de esa sección ve la empresa (ej. solo 3 de las 9 calculadoras).
--
-- Modelo (mismo espíritu que `secciones`, whitelist explícita — sin migración de datos
-- necesaria, el default deja a TODAS las empresas existentes exactamente como estaban):
--   `items` (empresas) / `items_override` (profiles) = jsonb, `{ [seccionKey]: string[] }`.
--   - Si la clave de una sección NO está presente en el objeto → sin restricción, se ven
--     TODOS los ítems de esa sección (comportamiento de hoy, default `'{}'::jsonb`).
--   - Si está presente → solo esos hrefs son visibles (subconjunto explícito).
-- `items_override` va SIEMPRE de la mano de `secciones_override` (mismo par que hoy):
-- solo se lee cuando `secciones_override` no es null (permisos individuales activos).
--
-- No se toca ninguna policy de RLS (las de Etapa 1 ya cubren la tabla entera, no por
-- columna) ni la enforcement de `soloMesa` (esos ítems siguen 100% fuera de este sistema,
-- protegidos con `requireAdmin()` — nunca aparecen en el whitelist de una empresa).

alter table public.empresas
  add column if not exists items jsonb not null default '{}'::jsonb;

alter table public.profiles
  add column if not exists items_override jsonb;

comment on column public.empresas.items is
  'Restricción opcional por ítem dentro de una sección habilitada: { seccionKey: string[] de hrefs }. Sección ausente del objeto = todos los ítems visibles.';
comment on column public.profiles.items_override is
  'Igual forma que empresas.items, pero para el override individual — solo se usa si secciones_override no es null.';

-- ============================================================================
-- Guard anti escalada (Etapa 1): sumar items_override a los campos que un no-admin
-- NO puede tocar de su propia fila (mismo criterio que secciones_override).
-- ============================================================================
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.estado := old.estado;
    new.rol := old.rol;
    new.empresa_id := old.empresa_id;
    new.secciones_override := old.secciones_override;
    new.items_override := old.items_override;
    new.approved_at := old.approved_at;
    new.approved_by := old.approved_by;
    new.email := old.email;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- admin_usuarios() / admin_empresas() (Etapa 2, `20260716180000_auth_admin_panel.sql`):
-- suman los campos nuevos. El tipo de retorno cambia → hace falta drop antes del create.
-- ============================================================================
drop function if exists public.admin_usuarios();
create function public.admin_usuarios()
returns table (
  id uuid, email text, nombre text, empresa_texto text, telefono text,
  estado text, rol text, empresa_id uuid, empresa_nombre text,
  empresa_secciones text[], secciones_override text[],
  empresa_items jsonb, items_override jsonb,
  created_at timestamptz, approved_at timestamptz, ultimo_login timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id, p.email, p.nombre, p.empresa_texto, p.telefono,
    p.estado, p.rol, p.empresa_id, e.nombre, e.secciones, p.secciones_override,
    e.items, p.items_override,
    p.created_at, p.approved_at,
    (select max(a.ts) from public.access_log a where a.user_id = p.id and a.evento = 'login')
  from public.profiles p
  left join public.empresas e on e.id = p.empresa_id
  where public.is_admin()
  order by p.created_at desc;
$$;

revoke all on function public.admin_usuarios() from public;
grant execute on function public.admin_usuarios() to authenticated;

drop function if exists public.admin_empresas();
create function public.admin_empresas()
returns table (id uuid, nombre text, secciones text[], items jsonb, created_at timestamptz, n_usuarios bigint)
language sql
security definer
stable
set search_path = public
as $$
  select e.id, e.nombre, e.secciones, e.items, e.created_at,
         (select count(*) from public.profiles p where p.empresa_id = e.id)
  from public.empresas e
  where public.is_admin()
  order by e.nombre;
$$;

revoke all on function public.admin_empresas() from public;
grant execute on function public.admin_empresas() to authenticated;
