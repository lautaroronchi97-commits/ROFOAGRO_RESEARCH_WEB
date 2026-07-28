"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { parseCamionesUpload } from "@/lib/camiones/williams";
import { PRODUCTO_SERIE_CLAVES, PRODUCTO_SERIE_DISPLAY, type ProductoSerie } from "@/lib/camiones/config";
import { SERIES } from "@/lib/anomalias-series";

/**
 * Server actions del uploader de camiones en puerto (/admin/datos, pestaña Camiones). Mismo
 * patrón 2-pasos que `actions.ts` (compras): previsualizar (no escribe) → confirmar (upsert vía
 * RPC `admin_upsert_camiones`, guard `is_admin()` adentro — sin service key en la web).
 *
 * A diferencia de compras: acá el archivo NO trae el producto adentro — es Lautoro quien elige
 * "SERIE" (Total o un grano puntual) en un selector, porque el export de Agrochat/Williams viene
 * un archivo por grano (no banca los 3 juntos por tamaño). Solo CSV (los exports reales que
 * Lautoro ya pasó son CSV; si algún día llega en .xlsx, se suma el mismo parser sin-dependencias
 * que ya usa compras — no se construye ahora sin un caso real).
 */

export type PreviewCamiones = {
  archivo: string;
  producto: ProductoSerie;
  filas: number;
  filasInvalidas: number;
  formato: "zonas" | "localidades" | "crudo";
  zonasCubiertas: string[];
  desde: string;
  hasta: string;
  advertencias: string[];
  muestra: { fecha: string; zona: string; cantidad: number }[];
};

export type DatosCamionesState =
  | {
      error?: string;
      preview?: PreviewCamiones;
      ok?: { filas: number };
    }
  | undefined;

function productoValido(v: FormDataEntryValue | null): ProductoSerie | null {
  const s = String(v ?? "");
  return (PRODUCTO_SERIE_CLAVES as string[]).includes(s) ? (s as ProductoSerie) : null;
}

async function parsear(formData: FormData) {
  const archivo = formData.get("archivo");
  const producto = productoValido(formData.get("producto"));
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Elegí el archivo CSV del export." };
  }
  if (!producto) {
    return { error: "Elegí qué serie representa el archivo (Total o un grano puntual)." };
  }
  const texto = await archivo.text();
  const r = parseCamionesUpload(texto);
  if (!r.ok) return { error: r.error };
  // Formato crudo: el propio archivo dice qué cultivo representa (columna "Cultivo") — si no
  // coincide con la serie elegida en el selector, es señal de haber cargado el archivo
  // equivocado (o de haber olvidado cambiar el selector). No bloquea (el selector manda, como en
  // los otros 2 formatos) pero avisa fuerte en la previsualización.
  if (r.formato === "crudo" && r.serieDetectada && r.serieDetectada !== producto) {
    r.advertencias.push(
      `El archivo dice ser la serie "${PRODUCTO_SERIE_DISPLAY[r.serieDetectada]}" pero elegiste ` +
        `"${PRODUCTO_SERIE_DISPLAY[producto]}" arriba — revisá que sea el archivo correcto antes de confirmar.`,
    );
  }
  return { parsed: r, nombre: archivo.name, producto };
}

export async function procesarCargaCamiones(_state: DatosCamionesState, formData: FormData): Promise<DatosCamionesState> {
  await requireAdmin();

  const res = await parsear(formData);
  if ("error" in res) return { error: res.error };
  const { parsed, nombre, producto } = res;

  // L3 (noUncheckedIndexedAccess): reveló un caso sin guard — 0 filas parseadas (CSV solo con
  // encabezado) dejaba `fechas` vacío y `desde`/`hasta` en `undefined` corriendo hasta la preview.
  if (parsed.filas.length === 0) {
    return { error: "El archivo no tiene filas de datos (¿subiste el CSV correcto?)." };
  }
  const fechas = parsed.filas.map((f) => f.fecha).sort();
  const desde = fechas[0]!; // filas.length===0 ya salió arriba
  const hasta = fechas[fechas.length - 1]!;
  const paso = String(formData.get("paso") ?? "preview");

  if (paso !== "confirm") {
    // Rango físico (D7/L7): un máximo imposible en una sola fila delata un parseo/copiado erróneo
    // antes de tocar la base. La identidad cruzada zona=producto=total (que sí necesita ver TODOS
    // los productos del mismo día) queda para el barrido diario `chequeo-anomalias.mjs` — acá
    // Lautaro sube un grano a la vez y no hay con qué compararla en el momento.
    const max = SERIES.camiones_conteo.rango?.max;
    const fueraDeRango = max != null ? parsed.filas.filter((f) => f.cantidad > max) : [];
    const advertencias = [
      ...parsed.advertencias,
      ...(fueraDeRango.length
        ? [
            `Detector de anomalías (D7): ${fueraDeRango.length} fila(s) superan el máximo físico (${max!.toLocaleString("es-AR")} camiones/día) — revisá antes de confirmar. Ejemplos → ${fueraDeRango
              .slice(0, 3)
              .map((f) => `${f.fecha} ${f.clave}: ${f.cantidad.toLocaleString("es-AR")}`)
              .join(" · ")}`,
          ]
        : []),
    ];
    return {
      preview: {
        archivo: nombre,
        producto,
        filas: parsed.filas.length,
        filasInvalidas: parsed.filasInvalidas,
        formato: parsed.formato,
        zonasCubiertas: parsed.zonasCubiertas,
        desde,
        hasta,
        advertencias,
        muestra: parsed.filas.slice(0, 8).map((f) => ({ fecha: f.fecha, zona: f.clave, cantidad: f.cantidad })),
      },
    };
  }

  const supabase = await createSupabaseServerClient();
  const BATCH = 1000;
  let procesadas = 0;
  for (let i = 0; i < parsed.filas.length; i += BATCH) {
    const lote = parsed.filas.slice(i, i + BATCH).map((f) => ({ fecha: f.fecha, zona: f.clave, cantidad: f.cantidad }));
    const { data, error } = await supabase.rpc("admin_upsert_camiones", { filas: lote, p_producto: producto });
    if (error) {
      return { error: `Falló el upsert en la fila ${i + 1} (${procesadas} cargadas antes del error): ${error.message}` };
    }
    procesadas += typeof data === "number" ? data : lote.length;
  }

  revalidatePath("/comercio/camiones");

  return { ok: { filas: procesadas } };
}
