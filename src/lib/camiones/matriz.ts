import { campaniaDe, campaniasAnteriores, diaDeCampana, parseFechaUTC } from "../lineup/campanas";
import { ZONA_CLAVES, type ZonaCamiones } from "./config";

/**
 * matriz.ts — Reagrupamientos puros (sin red/DB) de la matriz zona×producto de Williams Entregas
 * (relevamiento web R6, punto 53): el chart único de `/comercio/camiones` necesita, para UN grano
 * elegido, sumar/filtrar por zona (modo calendario) o re-agrupar por campaña (modo overlay, "evita
 * la línea larga y pesada" — mismo espíritu que los presets de calendar-spread de `/graficos`).
 *
 * `camiones.ts` (server-only) ya expone la matriz cruda (`porZonaProducto`); este módulo solo hace
 * aritmética sobre eso, testeable sin Supabase.
 */

/** `producto` es `string` a propósito (no `ProductoCamiones`): así el caller puede pasar también
 *  la clave sintética "TOTAL" (todos los productos, sin filtro de grano de página) por las mismas
 *  funciones — incluidas las de campaña, aunque ahí el caller nunca llama con "TOTAL" en la
 *  práctica (`campaniaDe` cae a un mes de arranque por defecto sin sentido de negocio real; la UI
 *  de `williams-chart.tsx` deshabilita el modo campaña mientras el filtro de grano sea "TOTAL"). */
export type PuntoZP = { fecha: string; zona: ZonaCamiones; producto: string; cantidad: number };

export type SerieNombrada = { key: string; display: string; puntos: { fecha: string; cantidad: number }[] };

const DIA_MS = 86_400_000;

/** Suma, para UN producto, las zonas elegidas → una sola serie (nacional si `zonas` = las 4). */
export function sumarZonas(
  puntos: PuntoZP[],
  producto: string,
  zonas: ZonaCamiones[],
): { fecha: string; cantidad: number }[] {
  const zonasSet = new Set(zonas);
  const map = new Map<string, number>();
  for (const p of puntos) {
    if (p.producto !== producto || !zonasSet.has(p.zona)) continue;
    map.set(p.fecha, (map.get(p.fecha) ?? 0) + p.cantidad);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, cantidad]) => ({ fecha, cantidad }));
}

/** Una serie POR ZONA elegida (modo calendario: cada zona queda como su propia línea). */
export function seriesPorZona(
  puntos: PuntoZP[],
  producto: string,
  zonas: ZonaCamiones[],
  display: Record<ZonaCamiones, string>,
): SerieNombrada[] {
  return ZONA_CLAVES.filter((z) => zonas.includes(z))
    .map((z) => {
      const m = new Map<string, number>();
      for (const p of puntos) {
        if (p.producto !== producto || p.zona !== z) continue;
        m.set(p.fecha, (m.get(p.fecha) ?? 0) + p.cantidad);
      }
      return {
        key: z,
        display: display[z],
        puntos: [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, cantidad]) => ({ fecha, cantidad })),
      };
    })
    .filter((s) => s.puntos.length > 0);
}

export type SerieCampana = { campana: string; puntos: { dia: number; fecha: string; cantidad: number }[] };

/**
 * Reagrupa una serie ya sumada (zonas elegidas → nacional/parcial) por campaña del producto, con
 * el día de campaña (1 = arranque) como eje X — el mismo criterio de alineación que `/graficos`
 * usa para superponer campañas, portado de `lineup/campanas.ts` (sin duplicar la regla de mes de
 * arranque por producto).
 */
export function agruparPorCampana(
  sumada: { fecha: string; cantidad: number }[],
  producto: string,
  campanas: string[],
): SerieCampana[] {
  const campSet = new Set(campanas);
  const porCamp = new Map<string, { dia: number; fecha: string; cantidad: number }[]>();
  for (const p of sumada) {
    const f = parseFechaUTC(p.fecha);
    if (!f) continue;
    const camp = campaniaDe(producto, f);
    if (!campSet.has(camp)) continue;
    if (!porCamp.has(camp)) porCamp.set(camp, []);
    porCamp.get(camp)!.push({ dia: diaDeCampana(producto, f), fecha: p.fecha, cantidad: p.cantidad });
  }
  return campanas
    .filter((c) => porCamp.has(c))
    .map((c) => ({ campana: c, puntos: porCamp.get(c)!.sort((a, b) => a.dia - b.dia) }));
}

/** La campaña vigente + las `n` anteriores (más nueva primero) para un producto, a una fecha. */
export function ultimasCampanas(producto: string, fechaRef: Date, n = 2): string[] {
  return [campaniaDe(producto, fechaRef), ...campaniasAnteriores(producto, fechaRef, n)];
}

/** Todas las campañas con algún dato en la serie sumada, más nueva primero (universo de chips). */
export function campanasDisponibles(sumada: { fecha: string; cantidad: number }[], producto: string): string[] {
  const set = new Set<string>();
  for (const p of sumada) {
    const f = parseFechaUTC(p.fecha);
    if (f) set.add(campaniaDe(producto, f));
  }
  return [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

export type Kpis = {
  fecha: string | null;
  total: number | null;
  fechaAyer: string | null;
  totalAyer: number | null;
  deltaAyer: number | null;
  deltaSemana: number | null;
  deltaInteranual: { valor: number; pct: number; fecha: string } | null;
};

const KPIS_VACIOS: Kpis = {
  fecha: null,
  total: null,
  fechaAyer: null,
  totalAyer: null,
  deltaAyer: null,
  deltaSemana: null,
  deltaInteranual: null,
};

/**
 * KPIs de una serie ya sumada (nacional o de las zonas elegidas): total del último día, el día
 * anterior CON dato (valor + delta, solo si está a ≤4 días — evita comparar contra un hueco largo
 * como si fuera "ayer"), delta vs 7 días antes (fecha exacta) y delta interanual (día con dato más
 * cercano a 364 días atrás, ventana ±7d) — mismo criterio que `camiones.ts`/`plantas.ts`.
 */
export function calcularKpis(sumada: { fecha: string; cantidad: number }[]): Kpis {
  if (sumada.length === 0) return KPIS_VACIOS;
  const fecha = sumada[sumada.length - 1]!.fecha;
  const total = sumada[sumada.length - 1]!.cantidad;
  const porFecha = new Map(sumada.map((p) => [p.fecha, p.cantidad]));

  let fechaAyer: string | null = null;
  let totalAyer: number | null = null;
  let deltaAyer: number | null = null;
  if (sumada.length > 1) {
    const previa = sumada[sumada.length - 2]!;
    const gap = Date.parse(`${fecha}T00:00:00Z`) - Date.parse(`${previa.fecha}T00:00:00Z`);
    if (gap <= 4 * DIA_MS) {
      fechaAyer = previa.fecha;
      totalAyer = previa.cantidad;
      deltaAyer = total - previa.cantidad;
    }
  }

  let deltaSemana: number | null = null;
  const hace7 = new Date(Date.parse(`${fecha}T00:00:00Z`) - 7 * DIA_MS).toISOString().slice(0, 10);
  if (porFecha.has(hace7)) deltaSemana = total - porFecha.get(hace7)!;

  let deltaInteranual: Kpis["deltaInteranual"] = null;
  const objetivo = Date.parse(`${fecha}T00:00:00Z`) - 364 * DIA_MS;
  let mejor: string | null = null;
  for (const f of porFecha.keys()) {
    const dist = Math.abs(Date.parse(`${f}T00:00:00Z`) - objetivo);
    if (dist > 7 * DIA_MS) continue;
    if (mejor === null || dist < Math.abs(Date.parse(`${mejor}T00:00:00Z`) - objetivo)) mejor = f;
  }
  if (mejor !== null) {
    const valorAnterior = porFecha.get(mejor)!;
    if (valorAnterior > 0) {
      deltaInteranual = { valor: total - valorAnterior, pct: (total / valorAnterior - 1) * 100, fecha: mejor };
    }
  }

  return { fecha, total, fechaAyer, totalAyer, deltaAyer, deltaSemana, deltaInteranual };
}
