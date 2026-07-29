import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "./auth/server";

/**
 * pas-condicion.ts — lectura de `pas_condicion` (C27, docs/PLAN_PAS_ZONAS.md §3.b/§6). La tabla
 * tiene RLS INTERNA MESA (solo authenticated + is_admin(), migración 20260729130000) — igual que
 * `pas-zonas.ts`, hace falta el cliente SSR CON la sesión del admin. Leer con anon devolvería la
 * tabla vacía en silencio (precedente: `/granos/view`, `/produccion/zonas`) — por eso
 * `getPasCondicion` NUNCA se llama fuera de una página detrás de `requireAdmin()`.
 *
 * Las agregaciones puras viven en `pas-condicion-calc.ts` (sin "server-only", testeable) —
 * reexportadas acá para que el resto del código importe un solo módulo.
 */
export * from "./pas-condicion-calc";

import type { FilaCondicionDB } from "./pas-condicion-calc";

export type PasCondicionData = { filas: FilaCondicionDB[]; error: string | null };

export const getPasCondicion = cache(async (): Promise<PasCondicionData> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pas_condicion")
    .select("grano,ciclo,zona,campania,semana,siembra_pct,cc_mala,cc_regular,cc_normal,cc_buena,cc_excelente,ch_sequia,ch_regular,ch_adecuada,ch_optima,ch_exceso,fenologia")
    .order("campania", { ascending: true })
    .order("semana", { ascending: true });
  if (error) return { filas: [], error: error.message };
  return { filas: (data ?? []) as FilaCondicionDB[], error: null };
});
