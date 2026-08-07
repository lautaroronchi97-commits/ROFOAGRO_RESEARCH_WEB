import "server-only";
import { createSupabaseServerClient } from "@/lib/auth/server";
import type { Operacion, OperacionLogEntry, OperacionProducto } from "./tipos";
import type { PizarraFila } from "./registro";

/**
 * Capa de datos de "Operaciones diarias de clientes" (C31,
 * docs/PLAN_OPERACIONES_CLIENTES.md §4.4 capa 2): SIEMPRE lee con
 * `createSupabaseServerClient()` (la sesión real del usuario) — NUNCA con
 * `sbSelect`/la service key. En esta sección la RLS ES el producto: un cliente
 * solo puede traer filas de su propia empresa aunque el código tuviera un bug,
 * porque Postgres se lo niega a nivel de fila. `empresaId` viaja siempre
 * explícito (nunca se omite) para que un admin viendo "Empresa X" no termine
 * mezclando filas de varias empresas en una sola matriz.
 */

export type EmpresaOpcion = { id: string; nombre: string };

/** Empresas para el selector de admins (§5.6.8) — `empresas` es de lectura abierta a cualquier authenticated. */
export async function getEmpresasParaSelector(): Promise<EmpresaOpcion[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("empresas").select("id,nombre").order("nombre");
  if (error || !data) return [];
  return data as EmpresaOpcion[];
}

/** Todas las operaciones (incl. anuladas) de UNA empresa — la posición nunca se cierra (§1.13). */
export async function getOperaciones(empresaId: string): Promise<Operacion[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operaciones")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false });
  if (error || !data) return [];
  return data as Operacion[];
}

/** Las operaciones concertadas en UN día (registro diario, §5.6). */
export async function getOperacionesDelDia(empresaId: string, fecha: string): Promise<Operacion[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operaciones")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("fecha", fecha)
    .order("creado_en", { ascending: false });
  if (error || !data) return [];
  return data as Operacion[];
}

/** Historial de cambios (§4.3) de varias operaciones a la vez, agrupado por operacion_id. */
export async function getHistorialDe(operacionIds: string[]): Promise<Map<string, OperacionLogEntry[]>> {
  const mapa = new Map<string, OperacionLogEntry[]>();
  if (operacionIds.length === 0) return mapa;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operaciones_log")
    .select("*")
    .in("operacion_id", operacionIds)
    .order("en", { ascending: false });
  if (error || !data) return mapa;
  for (const fila of data as OperacionLogEntry[]) {
    const arr = mapa.get(fila.operacion_id) ?? [];
    arr.push(fila);
    mapa.set(fila.operacion_id, arr);
  }
  return mapa;
}

/**
 * Pizarras candidatas para resolver precios "pizarra" de un grano en una ventana
 * de fechas (§5.4) — trae TODAS las filas útiles de una sola vez (no una query
 * por operación). `pizarra_historico` es pública (policy `for select to public`):
 * se lee igual con la sesión del usuario, sin service key.
 */
export async function getPizarrasCandidatas(
  producto: OperacionProducto,
  desdeISO: string,
  hastaISO: string,
): Promise<PizarraFila[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pizarra_historico")
    .select("fecha,precio_ars,precio_usd")
    .eq("grano", producto)
    .gte("fecha", desdeISO)
    .lte("fecha", hastaISO)
    .order("fecha", { ascending: true });
  if (error || !data) return [];
  return data as PizarraFila[];
}
