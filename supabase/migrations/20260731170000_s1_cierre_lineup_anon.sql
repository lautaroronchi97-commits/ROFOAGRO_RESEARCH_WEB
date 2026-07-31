-- S1 — Auditoría de pre-lanzamiento (C29, 31/07/2026): cierre del acceso anon a `lineup`
-- y todos sus derivados. E1 (21/07) difirió este cierre "al prender el login"; el login se
-- prendió el 27/07 y el cierre quedó a medias: las 7 matviews de mesa se revocaron
-- (20260722013200) pero la TABLA BASE, sus 5 vistas security_invoker y las 2 matviews de
-- densidad de C5 (20260723120000 — grant a service_role sin revocar el default, advisors
-- `materialized_view_in_api`) siguieron legibles por cualquiera con la anon key, que es
-- pública por diseño (viaja al browser para el auth).
--
-- La web lee todo esto SERVER-SIDE con `SUPABASE_SERVICE_KEY` (src/lib/supabase.ts, E5) y
-- las páginas que lo muestran son solo-mesa (`requireAdmin`). Ni anon ni authenticated lo
-- necesitan. En local/preview sin service key, /comercio/* degrada a vacío — comportamiento
-- ya aceptado y documentado (src/lib/camiones/camiones.ts). La Edge Function lineup-ingest
-- escribe con service_role: no la afecta.
--
-- Mismo patrón que pas_condicion/pas_zonas: revoke total, ni siquiera 0 filas silenciosas.

-- Tabla base: fuera la policy pública heredada de la era LineUps_Code + revoke de grants.
drop policy if exists anon_select_lineup on public.lineup;
revoke all on table public.lineup from anon, authenticated;

-- Vistas (security_invoker=true: con la tabla cerrada ya fallarían, pero el revoke las saca
-- de la API de PostgREST directamente — 401 en vez de error confuso).
revoke all on table public.lineup_embarcado_mes from anon, authenticated;
revoke all on table public.lineup_originado_campana from anon, authenticated;
revoke all on table public.lineup_ultimas_ruedas from anon, authenticated;
revoke all on table public.lineup_visitas_recientes from anon, authenticated;
revoke all on table public.lineup_fechas_recientes from anon, authenticated;

-- Las 2 matviews de densidad que quedaron fuera del revoke de 20260722013200.
revoke all on table public.lineup_densidad_ar_hist from anon, authenticated;
revoke all on table public.lineup_densidad_zona_hist from anon, authenticated;
