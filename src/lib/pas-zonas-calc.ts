import { CAMPANIA_ZONAL_CONFIABLE, ZONAS_PRODUCTIVAS } from "./parse-pas-zonas";

/**
 * pas-zonas-calc.ts — agregaciones PURAS sobre `pas_zonas` (C23, docs/PLAN_PAS_ZONAS.md §6),
 * separadas de `pas-zonas.ts` (que trae "server-only" para el fetch con la sesión de admin) para
 * poder testear con Node/Vitest pelado — mismo patrón que `views-scorecard.ts`/`views-mercado.ts`
 * (`server-only` rompe Vitest apenas se importa). `pas-zonas.ts` reexporta todo esto, así el resto
 * del código sigue importando un solo módulo.
 */

export { CAMPANIA_ZONAL_CONFIABLE, ZONAS_PRODUCTIVAS };

export type FilaZonaDB = {
  grano: string;
  campania: string;
  zona: string;
  sembrado_ha: number | null;
  perdido_ha: number | null;
  cosechado_ha: number | null;
  produccion_tn: number | null;
  rinde_tn_ha: number | null;
};

export const GRANOS_ZONAS = ["soja", "maiz", "trigo", "girasol", "cebada", "sorgo"] as const;
export type GranoZona = (typeof GRANOS_ZONAS)[number];
export const GRANO_ZONA_LABEL: Record<GranoZona, string> = {
  soja: "Soja",
  maiz: "Maíz",
  trigo: "Trigo",
  girasol: "Girasol",
  cebada: "Cebada",
  sorgo: "Sorgo",
};

/** Campañas (cualquier zona, incl. TOTAL) presentes para un grano, ascendente. */
export function campaniasDeGrano(filas: FilaZonaDB[], grano: string): string[] {
  return [...new Set(filas.filter((f) => f.grano === grano).map((f) => f.campania))].sort();
}

/** Default del selector del panel: la campaña más reciente CON desglose zonal (no solo TOTAL). */
export function campaniaDefault(filas: FilaZonaDB[], grano: string): string | null {
  const conZonas = new Set(filas.filter((f) => f.grano === grano && f.zona !== "TOTAL").map((f) => f.campania));
  if (conZonas.size === 0) return null;
  return [...conZonas].sort().at(-1) ?? null;
}

export type FilaFotoZona = {
  zona: string;
  sembrado_ha: number | null;
  perdido_ha: number | null;
  cosechado_ha: number | null;
  produccion_tn: number | null;
  rinde_tn_ha: number | null;
  /** % del TOTAL de esta campaña (null si la campaña es anterior a CAMPANIA_ZONAL_CONFIABLE). */
  pctDelTotal: number | null;
  deltaProdTn: number | null;
  /** Descomposición del Δ: efecto área = Δárea·rinde₋₁ · efecto rinde = Δrinde·área_actual (§6). */
  efectoAreaTn: number | null;
  efectoRindeTn: number | null;
  /** Contribución en puntos porcentuales al Δ nacional (Δprod_zona / TOTAL_prod_anterior). */
  contribucionPp: number | null;
};

export type FotoCampania = {
  campania: string;
  campaniaAnterior: string | null;
  /** false si `campania` es anterior a CAMPANIA_ZONAL_CONFIABLE — el desglose no es representativo. */
  confiable: boolean;
  /** Solo las zonas presentes en esta campaña (nunca fantasma). */
  zonas: FilaFotoZona[];
  total: FilaFotoZona | null;
};

function filaFoto(
  zona: string,
  cur: FilaZonaDB | undefined,
  prev: FilaZonaDB | undefined,
  totalCurProd: number | null,
  totalPrevProd: number | null,
  confiable: boolean,
): FilaFotoZona {
  const prod = cur?.produccion_tn ?? null;
  const cosechado = cur?.cosechado_ha ?? null;
  const rinde = cur?.rinde_tn_ha ?? null;
  const prodPrev = prev?.produccion_tn ?? null;
  const cosechadoPrev = prev?.cosechado_ha ?? null;
  const rindePrev = prev?.rinde_tn_ha ?? null;

  const deltaProdTn = prod != null && prodPrev != null ? prod - prodPrev : null;
  let efectoAreaTn: number | null = null;
  let efectoRindeTn: number | null = null;
  if (cosechado != null && cosechadoPrev != null && rinde != null && rindePrev != null) {
    efectoAreaTn = (cosechado - cosechadoPrev) * rindePrev;
    efectoRindeTn = (rinde - rindePrev) * cosechado;
  }
  const pctDelTotal = confiable && prod != null && totalCurProd ? (prod / totalCurProd) * 100 : null;
  const contribucionPp = confiable && deltaProdTn != null && totalPrevProd ? (deltaProdTn / totalPrevProd) * 100 : null;

  return {
    zona,
    sembrado_ha: cur?.sembrado_ha ?? null,
    perdido_ha: cur?.perdido_ha ?? null,
    cosechado_ha: cosechado,
    produccion_tn: prod,
    rinde_tn_ha: rinde,
    pctDelTotal,
    deltaProdTn,
    efectoAreaTn,
    efectoRindeTn,
    contribucionPp,
  };
}

/**
 * Foto de una campaña: una fila por zona presente + TOTAL, con el Δ vs. la campaña anterior CON
 * DATOS para ese grano (no necesariamente el año calendario inmediato — cebada/sorgo no tienen
 * desglose zonal antes de 2009/10). `null` si la campaña no existe para ese grano.
 */
export function construirFotoCampania(filas: FilaZonaDB[], grano: string, campania: string): FotoCampania | null {
  const deGrano = filas.filter((f) => f.grano === grano);
  const porZonaCur = new Map(deGrano.filter((f) => f.campania === campania).map((f) => [f.zona, f]));
  if (porZonaCur.size === 0) return null;

  const campaniasOrdenadas = [...new Set(deGrano.map((f) => f.campania))].sort();
  const idx = campaniasOrdenadas.indexOf(campania);
  const campaniaAnterior = idx > 0 ? (campaniasOrdenadas[idx - 1] ?? null) : null;
  const porZonaPrev = campaniaAnterior
    ? new Map(deGrano.filter((f) => f.campania === campaniaAnterior).map((f) => [f.zona, f]))
    : new Map<string, FilaZonaDB>();

  const confiable = campania >= CAMPANIA_ZONAL_CONFIABLE;
  const totalCur = porZonaCur.get("TOTAL");
  const totalPrev = porZonaPrev.get("TOTAL");
  const totalCurProd = totalCur?.produccion_tn ?? null;
  const totalPrevProd = totalPrev?.produccion_tn ?? null;

  const zonas = ZONAS_PRODUCTIVAS.filter((z) => porZonaCur.has(z)).map((z) =>
    filaFoto(z, porZonaCur.get(z), porZonaPrev.get(z), totalCurProd, totalPrevProd, confiable),
  );
  const total = totalCur
    ? { ...filaFoto("TOTAL", totalCur, totalPrev, totalCurProd, totalPrevProd, confiable), pctDelTotal: totalCurProd != null ? 100 : null }
    : null;

  return { campania, campaniaAnterior, confiable, zonas, total };
}

export type SerieParticipacion = { zona: string; puntos: { campania: string; pct: number }[] };
export type EvolucionParticipacion = { campanias: string[]; series: SerieParticipacion[] };

/**
 * % de participación de cada zona en la producción nacional, campaña a campaña, desde
 * CAMPANIA_ZONAL_CONFIABLE — top-6 por participación media de las últimas 5 campañas +
 * "Resto" agregado (15 líneas fijas es sopa, §6 del plan).
 */
export function evolucionParticipacion(filas: FilaZonaDB[], grano: string): EvolucionParticipacion {
  const porCampania = new Map<string, Map<string, FilaZonaDB>>();
  for (const f of filas) {
    if (f.grano !== grano || f.campania < CAMPANIA_ZONAL_CONFIABLE) continue;
    let m = porCampania.get(f.campania);
    if (!m) {
      m = new Map();
      porCampania.set(f.campania, m);
    }
    m.set(f.zona, f);
  }
  const campanias = [...porCampania.keys()].sort();
  if (campanias.length === 0) return { campanias: [], series: [] };

  // Solo zonas que realmente aparecen en el archivo para este grano (nunca las 15 canónicas fijas
  // — si el grano tiene menos zonas con datos, no hay que rellenar con series fantasma en 0%).
  const zonasConDatos = ZONAS_PRODUCTIVAS.filter((z) =>
    [...porCampania.values()].some((m) => m.has(z)),
  );

  const pctPorZona = new Map<string, Map<string, number>>(); // zona -> campania -> pct
  for (const campania of campanias) {
    const porZona = porCampania.get(campania)!;
    const total = porZona.get("TOTAL");
    if (!total || total.produccion_tn == null || total.produccion_tn <= 0) continue;
    for (const zona of zonasConDatos) {
      const pct = ((porZona.get(zona)?.produccion_tn ?? 0) / total.produccion_tn) * 100;
      let m = pctPorZona.get(zona);
      if (!m) {
        m = new Map();
        pctPorZona.set(zona, m);
      }
      m.set(campania, pct);
    }
  }

  const ultimas5 = campanias.slice(-5);
  const promedios = [...pctPorZona.entries()]
    .map(([zona, m]) => {
      const vals = ultimas5.map((c) => m.get(c) ?? 0);
      return { zona, prom: vals.reduce((a, b) => a + b, 0) / (vals.length || 1) };
    })
    .sort((a, b) => b.prom - a.prom);

  const top6 = promedios.slice(0, 6).map((x) => x.zona);
  const resto = promedios.slice(6).map((x) => x.zona);

  const series: SerieParticipacion[] = top6.map((zona) => ({
    zona,
    puntos: campanias.map((c) => ({ campania: c, pct: pctPorZona.get(zona)?.get(c) ?? 0 })),
  }));
  if (resto.length > 0) {
    series.push({
      zona: "Resto",
      puntos: campanias.map((c) => ({
        campania: c,
        pct: resto.reduce((s, zona) => s + (pctPorZona.get(zona)?.get(c) ?? 0), 0),
      })),
    });
  }
  return { campanias, series };
}
