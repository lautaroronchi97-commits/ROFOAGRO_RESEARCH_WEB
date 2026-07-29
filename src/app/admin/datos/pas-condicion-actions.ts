"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { parsePasCondicion, type FilaCondicion, type DescarteCondicion } from "@/lib/parse-pas-condicion";

/**
 * Server actions del uploader de condición de cultivos BCBA-PAS (C27, docs/PLAN_PAS_ZONAS.md
 * §9) — /admin/datos. Un archivo por cultivo (girasol/soja/maíz/trigo, el parser detecta cuál es
 * del propio contenido). Mismo flujo de 2 pasos sin estado en memoria del server que el resto de
 * los uploaders: el `File` vive en el estado del cliente y se reenvía en los dos pasos. Sin
 * vintages ni guard de identidad (a diferencia de pas-zonas: acá no hay un TOTAL nacional contra
 * el que cruzar). Escritura por la RPC SECURITY DEFINER `admin_upsert_pas_condicion` (guard
 * is_admin() adentro, migración 20260729130000).
 */

export type PreviewPasCondicion = {
  archivo: string;
  filas: number;
  grano: string;
  ciclos: string[];
  campanias: string[];
  etapas: string[];
  zonasNuevas: string[];
  descartes: DescarteCondicion[];
};

export type PasCondicionState =
  | { error?: string; preview?: PreviewPasCondicion; ok?: { filas: number; descartadas: number } }
  | undefined;

async function parsearArchivo(
  formData: FormData,
): Promise<{ error: string } | { filas: FilaCondicion[]; descartes: DescarteCondicion[]; etapas: string[]; zonasNuevas: string[]; nombre: string }> {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Elegí el export de condición de cultivos (bolsadecereales.com/estimaciones-agricolas), un archivo por cultivo." };
  }
  const datos = new Uint8Array(await archivo.arrayBuffer());
  let r: ReturnType<typeof parsePasCondicion>;
  try {
    r = parsePasCondicion(datos);
  } catch (e) {
    return { error: `No pude leer el archivo: ${e instanceof Error ? e.message : "formato inválido"}.` };
  }
  if (!r.ok) return { error: r.error };
  const granos = Object.keys(r.etapasPorCultivo);
  const etapas = granos.length > 0 ? (r.etapasPorCultivo[granos[0]!] ?? []) : [];
  return { filas: r.filas, descartes: r.descartes, etapas, zonasNuevas: r.zonasNuevas, nombre: archivo.name };
}

export async function procesarPasCondicion(_state: PasCondicionState, formData: FormData): Promise<PasCondicionState> {
  await requireAdmin();

  const res = await parsearArchivo(formData);
  if ("error" in res) return { error: res.error };
  const { filas, descartes, etapas, zonasNuevas, nombre } = res;

  const paso = String(formData.get("paso") ?? "preview");

  // ------------------------------------------------------------------
  // Paso 1 — PREVISUALIZAR: resumen sin escribir nada.
  // ------------------------------------------------------------------
  if (paso !== "confirm") {
    const grano = filas[0]?.grano ?? "";
    const ciclos = [...new Set(filas.map((f) => f.ciclo))].sort();
    const campanias = [...new Set(filas.map((f) => f.campania))].sort();
    return {
      preview: { archivo: nombre, filas: filas.length, grano, ciclos, campanias, etapas, zonasNuevas, descartes },
    };
  }

  // ------------------------------------------------------------------
  // Paso 2 — CONFIRMAR: upsert por lotes.
  // ------------------------------------------------------------------
  const supabase = await createSupabaseServerClient();
  const BATCH = 500;
  let procesadas = 0;
  for (let i = 0; i < filas.length; i += BATCH) {
    const lote = filas.slice(i, i + BATCH);
    const { data, error } = await supabase.rpc("admin_upsert_pas_condicion", { filas: lote });
    if (error) {
      return {
        error: `Falló el upsert en la fila ${i + 1} (${procesadas} cargadas antes del error): ${error.message}`,
      };
    }
    procesadas += typeof data === "number" ? data : lote.length;
  }

  revalidatePath("/produccion/condicion");
  return { ok: { filas: procesadas, descartadas: descartes.length } };
}
