import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "./auth/server";

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
 */
export * from "./pas-zonas-calc";

import type { FilaZonaDB } from "./pas-zonas-calc";

export type PasZonasData = { filas: FilaZonaDB[]; error: string | null };

export const getPasZonas = cache(async (): Promise<PasZonasData> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pas_zonas")
    .select("grano,campania,zona,sembrado_ha,perdido_ha,cosechado_ha,produccion_tn,rinde_tn_ha")
    .order("campania", { ascending: true });
  if (error) return { filas: [], error: error.message };
  return { filas: (data ?? []) as FilaZonaDB[], error: null };
});
