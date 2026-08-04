import "server-only";
import { sbSelect, sbSelectAll } from "./supabase";
import { parseRows, construirCambios, organismosPresentes, type Cambio } from "./estimaciones";
import { calcularDeltaSerie, restarDiasISO, type PuntoValor, type DeltaSerie } from "./informe-v3-calc";

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

/**
 * Informes de organismo publicados JUSTO hoy (ej. USDA/CONAB/GEA/DEA) O cargados a la base hoy
 * con una `fecha_publicacion` vieja (BCBA-PAS: Lautoro lo sube con la fecha real del informe,
 * que puede ser de días atrás) — reusa estimaciones.ts. Unificado con el criterio de
 * `/api/informes/datos` (E1 de PLAN_INFORMES_V3.md §10 item 6: antes esta función solo miraba
 * `fecha`, y el route ya usaba también `actualizadoEn` desde el fix de PLAN_INFORMES_V2.md — las
 * dos plantillas (`/informes/plantilla/{diario,research}`) que llaman a esta función divergían
 * del route).
 */
export async function getInformesHoy(fecha: string): Promise<InformeHoy[]> {
  const res = await sbSelectAll(
    "estimaciones_produccion?select=organismo,pais,grano,campania,variable,valor,unidad,fecha_publicacion,informe,url,actualizado_en&order=fecha_publicacion.asc",
    3600,
  );
  if (!res.ok) return [];
  const rows = parseRows(res.data);
  return organismosPresentes(rows)
    .map((o) => construirCambios(rows, o))
    .filter((c) => c.cambios.length > 0 && (c.fecha === fecha || c.actualizadoEn?.slice(0, 10) === fecha));
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

export type VariacionPizarraDiaria = { grano: string; ars: DeltaSerie; usd: DeltaSerie };

/**
 * Δ de la pizarra oficial CAC vs el día hábil anterior, en $ y USD (E1 de PLAN_INFORMES_V3.md
 * §5.1 bloque C) — sobre `pizarra_historico` (la serie diaria que ya alimenta `/graficos` y el
 * comparador semanal), NO sobre el scrape en vivo de `pizarra.ts` (que no tiene historia). Una
 * sola query con 10 días de colchón (cubre fines de semana/feriados largos); si el cron todavía
 * no cargó el día de hoy, `ars.actual`/`usd.actual` degradan solos a null (nunca se inventa).
 */
export async function variacionDiariaPizarra(fecha: string): Promise<VariacionPizarraDiaria[]> {
  const desde = restarDiasISO(fecha, 10);
  const res = await sbSelect(
    `pizarra_historico?select=grano,fecha,precio_ars,precio_usd&grano=in.(soja,maiz,trigo)&fecha=gte.${desde}&fecha=lte.${fecha}&order=fecha.asc`,
    0,
  );
  if (!res.ok || !Array.isArray(res.data)) return [];

  const porGranoArs = new Map<string, PuntoValor[]>();
  const porGranoUsd = new Map<string, PuntoValor[]>();
  for (const r of res.data as Record<string, unknown>[]) {
    const grano = String(r.grano ?? "");
    const f = r.fecha;
    if (!grano || typeof f !== "string") continue;
    const ars = typeof r.precio_ars === "number" ? r.precio_ars : Number(r.precio_ars);
    const usd = typeof r.precio_usd === "number" ? r.precio_usd : Number(r.precio_usd);
    if (Number.isFinite(ars)) {
      const arr = porGranoArs.get(grano) ?? [];
      arr.push({ fecha: f, valor: ars });
      porGranoArs.set(grano, arr);
    }
    if (Number.isFinite(usd)) {
      const arr = porGranoUsd.get(grano) ?? [];
      arr.push({ fecha: f, valor: usd });
      porGranoUsd.set(grano, arr);
    }
  }

  const granos = new Set([...porGranoArs.keys(), ...porGranoUsd.keys()]);
  return [...granos].map((grano) => ({
    grano,
    ars: calcularDeltaSerie(porGranoArs.get(grano) ?? [], fecha, 1),
    usd: calcularDeltaSerie(porGranoUsd.get(grano) ?? [], fecha, 1),
  }));
}
