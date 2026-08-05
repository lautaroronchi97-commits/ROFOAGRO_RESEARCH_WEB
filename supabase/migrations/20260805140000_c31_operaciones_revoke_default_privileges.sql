-- ROFO AGRO · proyecto Supabase lineup-argentina (gbpfgfeksqmzmsxnxiwg)
-- C31 (docs/PLAN_OPERACIONES_CLIENTES.md §4.4): refuerzo de RLS post-verificación.
--
-- La migración anterior (20260805130000) hizo `revoke all ... from public, anon` +
-- `grant select, insert, update ... to authenticated` — pero NUNCA revocó de
-- `authenticated`, así que los default privileges del esquema `public` (que dan
-- ALL a `authenticated`/`service_role` en cualquier tabla nueva) le dejaron a
-- `authenticated` DELETE/TRUNCATE/REFERENCES/TRIGGER de más sobre `operaciones`
-- y `operaciones_log`. Verificado por SQL (05/08/2026) que RLS ya bloqueaba el
-- DELETE (0 filas, sin policy de escritura para ese comando) — pero TRUNCATE
-- ignora RLS por completo, así que ese permiso de más sí era explotable en teoría.
--
-- Refuerzo: revoke total de `authenticated` + re-grant exacto de lo necesario,
-- deja el mismo comportamiento de hoy (cero cambio funcional) con una segunda
-- barrera independiente de RLS. APLICADA con OK de Lautaro (05/08/2026).

revoke all on public.operaciones from authenticated;
grant select, insert, update on public.operaciones to authenticated;  -- SIN delete, SIN truncate, a propósito

revoke all on public.operaciones_log from authenticated;
grant select on public.operaciones_log to authenticated;              -- el log solo lo escribe el trigger
