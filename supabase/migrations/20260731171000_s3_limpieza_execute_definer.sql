-- S3 — Auditoría de pre-lanzamiento (C29, 31/07/2026): limpieza del EXECUTE sobrante de anon
-- en las funciones SECURITY DEFINER expuestas por PostgREST (advisors
-- `anon_security_definer_function_executable`). Todas tienen guard interno
-- (is_admin() / auth.uid()) — patrón aceptado en E1/E5 — y NINGÚN caller real usa la anon key
-- pelada (verificado caller por caller el 31/07: src/lib/auth/{sesion,session,admin}.ts,
-- src/app/admin/actions.ts, src/app/api/log-seccion/route.ts — todos con sesión authenticated
-- o service key). Esto es defensa en profundidad: que una RPC futura sin guard no herede un
-- default ejecutable por anónimos, y que los advisors dejen de gritar.
--
-- Reglas de esta limpieza (NO cambiarlas sin releer la bitácora de C29):
--  · Se revoca PUBLIC además de anon → el acceso de authenticated que venía implícito por el
--    default se pierde, por eso CADA revoke va acompañado de su grant explícito a
--    authenticated (los admin y las RPC de sesión se llaman logueados) y a service_role.
--  · `is_admin()` CONSERVA authenticated: las policies RLS la evalúan con el rol del que
--    consulta — revocársela rompería todas las tablas gateadas por is_admin().
--  · `handle_new_user()` y `protect_profile_fields()` quedan AFUERA a propósito: devuelven
--    `trigger` (PostgREST no puede invocarlas) y tocar sus grants arriesga el alta de
--    usuarios por un beneficio solo cosmético.
--  · Hábito desde acá: toda función nueva nace con `revoke ... from public, anon` en su
--    propia migración.

-- RPC de lectura del panel /admin (guard is_admin() interno).
revoke execute on function public.admin_actividad(uuid, uuid, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function public.admin_actividad(uuid, uuid, timestamptz, timestamptz, integer, integer) to authenticated, service_role;

revoke execute on function public.admin_actividad_count(uuid, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_actividad_count(uuid, uuid, timestamptz, timestamptz) to authenticated, service_role;

revoke execute on function public.admin_usuarios() from public, anon;
grant execute on function public.admin_usuarios() to authenticated, service_role;

revoke execute on function public.admin_empresas() from public, anon;
grant execute on function public.admin_empresas() to authenticated, service_role;

revoke execute on function public.admin_cerrar_sesiones(uuid) from public, anon;
grant execute on function public.admin_cerrar_sesiones(uuid) to authenticated, service_role;

-- Guard central de permisos: authenticated OBLIGATORIO (ver reglas arriba).
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- RPC de sesión única / actividad (exigen auth.uid() internamente).
revoke execute on function public.cerrar_mi_sesion() from public, anon;
grant execute on function public.cerrar_mi_sesion() to authenticated, service_role;

revoke execute on function public.registrar_sesion(text, text, text) from public, anon;
grant execute on function public.registrar_sesion(text, text, text) to authenticated, service_role;

revoke execute on function public.tocar_sesion(text, text, text) from public, anon;
grant execute on function public.tocar_sesion(text, text, text) to authenticated, service_role;

revoke execute on function public.registrar_visita_seccion(text, text, text) from public, anon;
grant execute on function public.registrar_visita_seccion(text, text, text) to authenticated, service_role;
