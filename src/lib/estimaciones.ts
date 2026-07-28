/**
 * Estimaciones de producción por organismo — capa de transformación (PURA).
 *
 * Lee las filas de la tabla Supabase `estimaciones_produccion` (una por VINTAGE:
 * organismo × país × grano × campaña × variable × fecha_publicacion) y arma las vistas de
 * la página /produccion:
 *   - pizarra: última estimación de cada organismo por grano/país (producción + área + rinde),
 *     con el Δ vs la publicación anterior (mismo organismo, misma campaña).
 *   - cambios: qué números tocó el último informe de cada organismo.
 *   - serie: evolución de una campaña publicación a publicación (una línea por organismo).
 *
 * Este archivo NO toca red ni server-only (solo `import type`) → es testeable en Node. El fetch
 * a Supabase lo hace el componente server con `sbSelectAll`. Ver docs/PLAN_CALENDARIO_PRODUCCION.md.
 */

export type Variable = "produccion" | "area" | "rinde";

export type EstimRow = {
  organismo: string;
  pais: string;
  grano: string;
  campania: string;
  variable: Variable;
  valor: number;
  unidad: string;
  fecha_publicacion: string; // "YYYY-MM-DD"
  informe: string;
  url: string | null;
  /** Cuándo se cargó ESTA fila a la base (`now()` en cada upsert) — puede ser MUY posterior a
   * `fecha_publicacion` para fuentes de carga manual (BCBA-PAS: Lautaro sube el informe con su
   * fecha real, que puede ser de días atrás). V2 de PLAN_INFORMES_V2.md §6.2: el disparo del
   * Paso 9 de informe-diario usa esto para no perderse informes cargados hoy con fecha vieja. */
  actualizado_en: string | null;
};

/** Una celda de la pizarra: última estimación de un organismo para un grano/país/campaña. */
export type CeldaEstim = {
  organismo: string;
  pais: string;
  grano: string;
  campania: string;
  produccion: number | null;
  deltaProd: number | null; // vs vintage anterior (misma campaña/organismo), en Mt
  area: number | null;
  rinde: number | null;
  fecha: string;
  informe: string;
  url: string | null;
};

/** Un cambio puntual entre el último vintage y el anterior. */
export type Cambio = {
  organismo: string;
  grano: string;
  pais: string;
  campania: string;
  variable: Variable;
  antes: number;
  ahora: number;
  delta: number;
  unidad: string;
  fecha: string;
};

export type PuntoSerie = { fecha: string; valor: number; informe: string };
export type SerieEvol = { organismo: string; puntos: PuntoSerie[] };

export const GRANO_LABEL: Record<string, string> = {
  soja: "Soja",
  maiz: "Maíz",
  trigo: "Trigo",
  girasol: "Girasol",
  sorgo: "Sorgo",
  cebada: "Cebada",
};
export const PAIS_LABEL: Record<string, string> = {
  argentina: "Argentina",
  brasil: "Brasil",
  eeuu: "EEUU",
  mundo: "Mundo",
};
export const VAR_LABEL: Record<Variable, string> = {
  produccion: "Producción",
  area: "Área",
  rinde: "Rinde",
};

const ORDEN_GRANO = ["soja", "maiz", "trigo", "girasol", "sorgo", "cebada"];
const ORDEN_PAIS = ["argentina", "brasil", "eeuu", "mundo"];
const ORDEN_ORG = ["USDA", "CONAB", "BCR", "BCBA", "DEA"];

function ordenPor(orden: string[]): (a: string, b: string) => number {
  return (a, b) => {
    const ia = orden.indexOf(a);
    const ib = orden.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || (a < b ? -1 : a > b ? 1 : 0);
  };
}

/* ------------------------------------------------------------------ */
/* Parseo/validación de las filas crudas de PostgREST                 */
/* ------------------------------------------------------------------ */

const VARIABLES = new Set<Variable>(["produccion", "area", "rinde"]);

export function parseRows(data: unknown): EstimRow[] {
  if (!Array.isArray(data)) return [];
  const out: EstimRow[] = [];
  for (const r of data) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const variable = o.variable as Variable;
    const valor = typeof o.valor === "number" ? o.valor : Number(o.valor);
    if (
      typeof o.organismo !== "string" ||
      typeof o.pais !== "string" ||
      typeof o.grano !== "string" ||
      typeof o.campania !== "string" ||
      !VARIABLES.has(variable) ||
      !Number.isFinite(valor) ||
      typeof o.fecha_publicacion !== "string"
    ) {
      continue;
    }
    out.push({
      organismo: o.organismo,
      pais: o.pais,
      grano: o.grano,
      campania: o.campania,
      variable,
      valor,
      unidad: typeof o.unidad === "string" ? o.unidad : "",
      fecha_publicacion: o.fecha_publicacion.slice(0, 10),
      informe: typeof o.informe === "string" ? o.informe : "",
      url: typeof o.url === "string" ? o.url : null,
      actualizado_en: typeof o.actualizado_en === "string" ? o.actualizado_en : null,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Índices y helpers                                                  */
/* ------------------------------------------------------------------ */

/** Vintages ordenados (asc por fecha) de una serie (organismo/pais/grano/campaña/variable). */
function vintagesDe(
  rows: EstimRow[],
  organismo: string,
  pais: string,
  grano: string,
  campania: string,
  variable: Variable,
): EstimRow[] {
  return rows
    .filter(
      (r) =>
        r.organismo === organismo &&
        r.pais === pais &&
        r.grano === grano &&
        r.campania === campania &&
        r.variable === variable,
    )
    .sort((a, b) => (a.fecha_publicacion < b.fecha_publicacion ? -1 : 1));
}

/**
 * Campaña más reciente presente para (organismo, pais, grano) — formato "YYYY/YY" ordena bien.
 * Prefiere la campaña más nueva que YA tenga producción (así el titular de la pizarra no queda en "—"
 * cuando un organismo abre una campaña nueva con solo el área — ej. GEA publica área de trigo 2026/27
 * antes que rinde/producción). Si ninguna campaña tiene producción, cae a la más nueva con cualquier dato.
 */
function campaniaVigente(rows: EstimRow[], organismo: string, pais: string, grano: string): string | null {
  let maxAny: string | null = null;
  let maxProd: string | null = null;
  for (const r of rows) {
    if (r.organismo === organismo && r.pais === pais && r.grano === grano) {
      if (maxAny === null || r.campania > maxAny) maxAny = r.campania;
      if (r.variable === "produccion" && (maxProd === null || r.campania > maxProd)) maxProd = r.campania;
    }
  }
  return maxProd ?? maxAny;
}

export function granosPresentes(rows: EstimRow[]): string[] {
  return [...new Set(rows.map((r) => r.grano))].sort(ordenPor(ORDEN_GRANO));
}
export function organismosPresentes(rows: EstimRow[]): string[] {
  return [...new Set(rows.map((r) => r.organismo))].sort(ordenPor(ORDEN_ORG));
}
export function paisesDe(rows: EstimRow[], grano?: string): string[] {
  return [...new Set(rows.filter((r) => !grano || r.grano === grano).map((r) => r.pais))].sort(
    ordenPor(ORDEN_PAIS),
  );
}
export function campaniasDe(rows: EstimRow[], grano: string, pais: string): string[] {
  return [...new Set(rows.filter((r) => r.grano === grano && r.pais === pais).map((r) => r.campania))].sort(
    (a, b) => (a > b ? -1 : a < b ? 1 : 0), // más nueva primero
  );
}

/* ------------------------------------------------------------------ */
/* Vista 1 — Pizarra de últimas estimaciones                          */
/* ------------------------------------------------------------------ */

/**
 * Última estimación por (organismo, país, grano): toma la campaña vigente de cada organismo,
 * el último vintage de producción (+ Δ vs el anterior de la misma campaña) y el último área/rinde.
 */
export function construirPizarra(rows: EstimRow[]): CeldaEstim[] {
  const combos = new Set<string>();
  for (const r of rows) combos.add(`${r.organismo}|${r.pais}|${r.grano}`);

  const celdas: CeldaEstim[] = [];
  for (const combo of combos) {
    // combo se armó acá mismo como `${organismo}|${pais}|${grano}` (línea de arriba) → split
    // siempre da los 3 (ninguno de los 3 campos trae "|" — son códigos cortos, verificado).
    const [organismo, pais, grano] = combo.split("|") as [string, string, string];
    const campania = campaniaVigente(rows, organismo, pais, grano);
    if (!campania) continue;

    const prod = vintagesDe(rows, organismo, pais, grano, campania, "produccion");
    const area = vintagesDe(rows, organismo, pais, grano, campania, "area");
    const rinde = vintagesDe(rows, organismo, pais, grano, campania, "rinde");

    const ultProd = prod[prod.length - 1] ?? null;
    const prevProd = prod.length >= 2 ? prod[prod.length - 2] : null;
    const ultArea = area[area.length - 1] ?? null;
    const ultRinde = rinde[rinde.length - 1] ?? null;

    // fecha/informe/url de referencia = el del último dato disponible (prod, si no área/rinde)
    const ref = ultProd ?? ultArea ?? ultRinde;
    if (!ref) continue;

    celdas.push({
      organismo,
      pais,
      grano,
      campania,
      produccion: ultProd ? ultProd.valor : null,
      deltaProd: ultProd && prevProd ? round2(ultProd.valor - prevProd.valor) : null,
      area: ultArea ? ultArea.valor : null,
      rinde: ultRinde ? ultRinde.valor : null,
      fecha: ref.fecha_publicacion,
      informe: ref.informe,
      url: ref.url,
    });
  }

  return celdas.sort(
    (a, b) =>
      ordenPor(ORDEN_GRANO)(a.grano, b.grano) ||
      ordenPor(ORDEN_PAIS)(a.pais, b.pais) ||
      ordenPor(ORDEN_ORG)(a.organismo, b.organismo),
  );
}

/* ------------------------------------------------------------------ */
/* Vista 2 — Cambios del último informe de cada organismo             */
/* ------------------------------------------------------------------ */

/** Fecha del último vintage de un organismo. */
export function ultimaFecha(rows: EstimRow[], organismo: string): string | null {
  let max: string | null = null;
  for (const r of rows) {
    if (r.organismo === organismo && (max === null || r.fecha_publicacion > max)) {
      max = r.fecha_publicacion;
    }
  }
  return max;
}

/**
 * Qué tocó el último informe de `organismo`: para cada fila de la última fecha, busca el vintage
 * inmediatamente anterior (misma serie) y devuelve el delta. Solo producción (la variable estrella).
 */
export function construirCambios(
  rows: EstimRow[],
  organismo: string,
): { organismo: string; fecha: string | null; informe: string; actualizadoEn: string | null; cambios: Cambio[] } {
  const fecha = ultimaFecha(rows, organismo);
  if (!fecha) return { organismo, fecha: null, informe: "", actualizadoEn: null, cambios: [] };

  const delDia = rows.filter(
    (r) => r.organismo === organismo && r.fecha_publicacion === fecha && r.variable === "produccion",
  );
  const informe = delDia[0]?.informe ?? "";
  // Más reciente `actualizado_en` entre las filas de este vintage — cuándo se cargó A LA BASE
  // (fix de auditoría V2: para carga manual como BCBA-PAS, esto puede ser MUY distinto de `fecha`).
  const actualizadoEn = delDia.reduce<string | null>(
    (max, r) => (r.actualizado_en && (!max || r.actualizado_en > max) ? r.actualizado_en : max),
    null,
  );
  const cambios: Cambio[] = [];
  for (const r of delDia) {
    const serie = vintagesDe(rows, organismo, r.pais, r.grano, r.campania, "produccion");
    const idx = serie.findIndex((s) => s.fecha_publicacion === fecha);
    const prev = idx > 0 ? serie[idx - 1] : null;
    if (!prev) continue; // sin anterior no hay cambio que mostrar
    const delta = round2(r.valor - prev.valor);
    cambios.push({
      organismo,
      grano: r.grano,
      pais: r.pais,
      campania: r.campania,
      variable: "produccion",
      antes: prev.valor,
      ahora: r.valor,
      delta,
      unidad: r.unidad,
      fecha,
    });
  }
  // Los movimientos más grandes primero (por magnitud absoluta).
  cambios.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { organismo, fecha, informe, actualizadoEn, cambios };
}

/* ------------------------------------------------------------------ */
/* Vista 3 — Serie de evolución (una línea por organismo)             */
/* ------------------------------------------------------------------ */

export function construirSerie(
  rows: EstimRow[],
  grano: string,
  pais: string,
  campania: string,
  variable: Variable = "produccion",
): SerieEvol[] {
  const orgs = [...new Set(rows.filter((r) => r.grano === grano && r.pais === pais && r.campania === campania && r.variable === variable).map((r) => r.organismo))].sort(ordenPor(ORDEN_ORG));
  const series: SerieEvol[] = [];
  for (const organismo of orgs) {
    const puntos = vintagesDe(rows, organismo, pais, grano, campania, variable).map((r) => ({
      fecha: r.fecha_publicacion,
      valor: r.valor,
      informe: r.informe,
    }));
    if (puntos.length > 0) series.push({ organismo, puntos });
  }
  return series;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Vista completa (lo que consume el componente)                      */
/* ------------------------------------------------------------------ */

