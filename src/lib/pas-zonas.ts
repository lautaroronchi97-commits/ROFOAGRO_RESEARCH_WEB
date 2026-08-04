import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "./auth/server";
import { selectAllPaginado } from "./auth/select-all";
import { sbSelectAll } from "./supabase";

/**
 * pas-zonas.ts — lectura de `pas_zonas` (C23, docs/PLAN_PAS_ZONAS.md §3.a/§6). La tabla tiene RLS
 * INTERNA MESA (solo authenticated + is_admin(), migración 20260729120000) — a diferencia del
 * resto de las libs de datos (`supabase.ts` con la anon key), acá hace falta el cliente SSR CON
 * la sesión del admin. Leer con anon devolvería la tabla vacía en silencio (mismo precedente que
 * `views-mercado.ts`/`/granos/view`) — por eso `getPasZonas` NUNCA se llama fuera de una página
 * detrás de `requireAdmin()`.
 *
 * Las agregaciones puras (foto de campaña, evolución de participación) viven en
 * `pas-zonas-calc.ts` (sin "server-only", testeable) — reexportadas acá para que el resto del
 * código importe un solo módulo.
 *
 * Pagina con `selectAllPaginado` (29/07/2026, bug real): con 1.837 filas (>1.000, el corte de
 * PostgREST) un `.select()` sin `.range()` devolvía solo las campañas más viejas — el panel
 * mostraba producción "completa" hasta 2016/17 y desaparecía todo lo posterior, sin ningún error
 * visible. Orden por (campania, grano, zona) — las 3 columnas de la PK que no sea `semana`
 * (no aplica acá) — para que la paginación sea determinística entre páginas.
 */
export * from "./pas-zonas-calc";

import type { FilaZonaDB } from "./pas-zonas-calc";

export type PasZonasData = { filas: FilaZonaDB[]; error: string | null };

export const getPasZonas = cache(async (): Promise<PasZonasData> => {
  const supabase = await createSupabaseServerClient();
  const { filas, error } = await selectAllPaginado<FilaZonaDB>((from, to) =>
    supabase
      .from("pas_zonas")
      .select("grano,campania,zona,sembrado_ha,perdido_ha,cosechado_ha,produccion_tn,rinde_tn_ha")
      .order("campania", { ascending: true })
      .order("grano", { ascending: true })
      .order("zona", { ascending: true })
      .range(from, to),
  );
  return { filas, error };
});

/**
 * Variante para contextos SIN sesión de usuario (rutas con token, no cookies) — el informe
 * semanal y el view v3 (E1 de docs/PLAN_INFORMES_V3.md §6.1/§7.2) leen con la SERVICE KEY
 * (bypasa RLS, mismo criterio que `getViewMercadoVigentePorGrano` con `views_mercado`), nunca
 * con `getPasZonas()` — esa requiere el cliente SSR con la sesión del admin y en un route
 * handler autenticado por token (sin cookies) devolvería la tabla vacía en silencio.
 */
export const getPasZonasInforme = cache(async (): Promise<FilaZonaDB[]> => {
  const res = await sbSelectAll(
    "pas_zonas?select=grano,campania,zona,sembrado_ha,perdido_ha,cosechado_ha,produccion_tn,rinde_tn_ha&order=campania.asc,grano.asc,zona.asc",
    3600,
  );
  return res.ok && Array.isArray(res.data) ? (res.data as FilaZonaDB[]) : [];
});
