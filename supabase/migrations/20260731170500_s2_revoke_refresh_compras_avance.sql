-- S2 — Auditoría de pre-lanzamiento (C29, 31/07/2026): `refresh_compras_avance()` nació en
-- 20260719238000 con `grant execute to service_role` pero SIN revocar el default de Postgres
-- (toda función nueva es ejecutable por PUBLIC) → anon podía dispararla vía
-- /rest/v1/rpc/refresh_compras_avance y spamear el REFRESH de `compras_avance_hist`
-- (agotamiento de recursos; es SECURITY DEFINER). Misma clase de bug que `ingest_cierres_cem`
-- (E5 #3, ya corregida aquella).
--
-- Llamadores reales: scripts/cargar-compras.mjs y scripts/ingest-compras.mjs, ambos con la
-- service key. El uploader web usa `admin_refresh_compras_avance()` (guard is_admin(), grants
-- ya correctos en 20260720120000). Nadie la necesita como anon/authenticated.

revoke execute on function public.refresh_compras_avance() from public, anon, authenticated;
grant execute on function public.refresh_compras_avance() to service_role;
