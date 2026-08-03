import "server-only";
import { sbSelect, sbSelectAll } from "./supabase";
import { parseRows, construirCambios, organismosPresentes, type Cambio } from "./estimaciones";

/**
 * Datos compartidos por las plantillas del informe diario (`/informes/plantilla/diario`
 * y `/informes/plantilla/research`) que NO dependen del formato visual — el borrador
 * de prosa del día, el informe de organismos publicado hoy (+ su interpretación si ya
 * está publicada), y las compras BCRA del día. Extraído para que las dos plantillas
 * lean exactamente la MISMA fila/consulta en vez de reimplementarla cada una.
 */

export type LecturaItem = { titulo: string; texto: string };

/** Prosa del borrador (una sola fila por fecha, `informes_generados.tipo=diario`).
 *  Campos "diario" (título/comentario/líneas por grano) y "research" (tesis/lectura)
 *  conviven en el mismo JSON — el Paso 2 del skill `informe-diario` escribe los que
 *  correspondan al formato vigente. */
export type ProsaDiaria = {
  titulo?: string;
  comentario?: string[];
  lineas_por_grano?: Record<string, string>;
  tesisTitulo?: string;
  tesisParrafo?: string;
  lectura?: LecturaItem[];
};

export type FilaInforme = { titulo: string | null; prosa: ProsaDiaria | null };

export async function getBorrador(fecha: string): Promise<FilaInforme | null> {
  const res = await sbSelect(
    `informes_generados?tipo=eq.diario&fecha=eq.${fecha}&select=titulo,prosa&limit=1`,
    0,
  );
  if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) return null;
  return res.data[0] as FilaInforme;
}

export type InformeHoy = { organismo: string; fecha: string | null; informe: string; cambios: Cambio[] };

/** Informes de organismo publicados JUSTO ese día (ej. USDA/CONAB/GEA/DEA) — reusa estimaciones.ts. */
export async function getInformesHoy(fecha: string): Promise<InformeHoy[]> {
  const res = await sbSelectAll(
    "estimaciones_produccion?select=organismo,pais,grano,campania,variable,valor,unidad,fecha_publicacion,informe,url&order=fecha_publicacion.asc",
    3600,
  );
  if (!res.ok) return [];
  const rows = parseRows(res.data);
  return organismosPresentes(rows)
    .map((o) => construirCambios(rows, o))
    .filter((c) => c.fecha === fecha && c.cambios.length > 0);
}

export type Interpretacion = { organismo: string; informe: string; publicado_md: string };

/** MP4 (interpretación de informes de organismos): [] mientras nadie publicó ninguna ese día. */
export async function getInterpretaciones(fecha: string): Promise<Interpretacion[]> {
  const res = await sbSelect(
    `interpretaciones?estado=eq.publicado&fecha_publicacion=eq.${fecha}&select=organismo,informe,publicado_md`,
    0,
  );
  return res.ok && Array.isArray(res.data) ? (res.data as Interpretacion[]) : [];
}

export type BcraDia = { monto_musd: number; fuente: string };

/** Compras BCRA del día (carga manual de /admin/datos — P3 sumará la ingesta automática). */
export async function getBcra(fecha: string): Promise<BcraDia | null> {
  const res = await sbSelect(`compras_bcra?fecha=eq.${fecha}&select=monto_musd,fuente&limit=1`, 0);
  if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) return null;
  return res.data[0] as BcraDia;
}
