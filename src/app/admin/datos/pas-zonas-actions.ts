"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/auth/server";
import {
  parsePasZonas,
  fallasIdentidad,
  type FilaZona,
  type DescarteZona,
  type ControlIdentidadItem,
} from "@/lib/parse-pas-zonas";

/**
 * Server actions del uploader de producción BCBA-PAS por zona agroecológica (C23,
 * docs/PLAN_PAS_ZONAS.md §5) — /admin/datos. Mismo flujo de 2 pasos sin estado en memoria del
 * server que el resto de los uploaders (`compras`/`pas`/`dea`): el `File` vive en el estado del
 * cliente y se reenvía en los dos pasos. Escritura por la RPC SECURITY DEFINER
 * `admin_upsert_pas_zonas` (guard is_admin() adentro, migración 20260729120000).
 */

export type CruceNacionalItem = {
  grano: string;
  campania: string;
  zonalMt: number;
  nacionalMt: number | null;
  diffPct: number | null;
};

export type PreviewPasZonas = {
  archivo: string;
  filas: number;
  granos: string[];
  campanias: string[];
  descartes: DescarteZona[];
  fallasIdentidad: ControlIdentidadItem[];
  cruce: CruceNacionalItem[];
};

export type PasZonasState =
  | { error?: string; preview?: PreviewPasZonas; ok?: { filas: number; descartadas: number } }
  | undefined;

async function parsearArchivo(
  formData: FormData,
): Promise<
  | { error: string }
  | { filas: FilaZona[]; descartes: DescarteZona[]; controlIdentidad: ControlIdentidadItem[]; nombre: string }
> {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Elegí el export de producción por zona (bolsadecereales.com/estimaciones-agricolas)." };
  }
  const datos = new Uint8Array(await archivo.arrayBuffer());
  let r: ReturnType<typeof parsePasZonas>;
  try {
    r = parsePasZonas(datos);
  } catch (e) {
    return { error: `No pude leer el archivo: ${e instanceof Error ? e.message : "formato inválido"}.` };
  }
  if (!r.ok) return { error: r.error };
  return { filas: r.filas, descartes: r.descartes, controlIdentidad: r.controlIdentidad, nombre: archivo.name };
}

/**
 * Compara la producción TOTAL zonal de la campaña más reciente de cada grano contra el último
 * dato del comparador nacional (`estimaciones_produccion`, organismo BCBA — carga del uploader
 * `pas-uploader.tsx`). Solo WARNING (§5 del plan): el CSV nacional puede estar legítimamente más
 * viejo/nuevo que el xlsx de zonas, son dos cargas manuales independientes.
 */
async function cruceNacional(filas: FilaZona[]): Promise<CruceNacionalItem[]> {
  const masReciente = new Map<string, { campania: string; tn: number }>();
  for (const f of filas) {
    if (f.zona !== "TOTAL" || f.produccion_tn == null) continue;
    const actual = masReciente.get(f.grano);
    if (!actual || f.campania > actual.campania) masReciente.set(f.grano, { campania: f.campania, tn: f.produccion_tn });
  }
  if (masReciente.size === 0) return [];

  const supabase = await createSupabaseServerClient();
  const out: CruceNacionalItem[] = [];
  for (const [grano, { campania, tn }] of masReciente) {
    const { data } = await supabase
      .from("estimaciones_produccion")
      .select("valor")
      .eq("organismo", "BCBA")
      .eq("grano", grano)
      .eq("campania", campania)
      .eq("variable", "produccion")
      .order("fecha_publicacion", { ascending: false })
      .limit(1)
      .maybeSingle();
    const zonalMt = tn / 1e6;
    const nacionalMt = typeof data?.valor === "number" ? data.valor : null;
    const diffPct = nacionalMt != null && nacionalMt > 0 ? (Math.abs(zonalMt - nacionalMt) / nacionalMt) * 100 : null;
    out.push({ grano, campania, zonalMt, nacionalMt, diffPct });
  }
  return out;
}

export async function procesarPasZonas(_state: PasZonasState, formData: FormData): Promise<PasZonasState> {
  await requireAdmin();

  const res = await parsearArchivo(formData);
  if ("error" in res) return { error: res.error };
  const { filas, descartes, controlIdentidad, nombre } = res;
  const fallas = fallasIdentidad(controlIdentidad);

  const paso = String(formData.get("paso") ?? "preview");

  // ------------------------------------------------------------------
  // Paso 1 — PREVISUALIZAR: resumen sin escribir nada.
  // ------------------------------------------------------------------
  if (paso !== "confirm") {
    const cruce = await cruceNacional(filas);
    const granos = [...new Set(filas.map((f) => f.grano))].sort();
    const campanias = [...new Set(filas.map((f) => f.campania))].sort();
    return {
      preview: { archivo: nombre, filas: filas.length, granos, campanias, descartes, fallasIdentidad: fallas, cruce },
    };
  }

  // ------------------------------------------------------------------
  // Paso 2 — CONFIRMAR: guard de identidad (salvo "forzar") + upsert por lotes.
  // ------------------------------------------------------------------
  const forzar = String(formData.get("forzar") ?? "") === "1";
  if (fallas.length > 0 && !forzar) {
    const primera = fallas[0]!;
    return {
      error:
        `La identidad suma-zonas=TOTAL no cierra en ${fallas.length} campaña(s) (ej. ${primera.grano} ${primera.campania}: ` +
        `zonas ${Math.round(primera.sumaZonasTn).toLocaleString("es-AR")} t vs TOTAL ${Math.round(primera.totalTn).toLocaleString("es-AR")} t, ` +
        `${primera.diffPct.toFixed(1)}% de diferencia). No se cargó nada. Si estás seguro de que el dato es correcto, marcá "forzar" y confirmá de nuevo.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const BATCH = 500;
  let procesadas = 0;
  for (let i = 0; i < filas.length; i += BATCH) {
    const lote = filas.slice(i, i + BATCH);
    const { data, error } = await supabase.rpc("admin_upsert_pas_zonas", { filas: lote });
    if (error) {
      return {
        error: `Falló el upsert en la fila ${i + 1} (${procesadas} cargadas antes del error): ${error.message}`,
      };
    }
    procesadas += typeof data === "number" ? data : lote.length;
  }

  revalidatePath("/produccion/zonas");
  return { ok: { filas: procesadas, descartadas: descartes.length } };
}
