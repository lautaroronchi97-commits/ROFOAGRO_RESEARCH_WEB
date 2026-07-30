import "server-only";
import { cache } from "react";
import { sbSelectAll } from "../supabase";
import type { Meta } from "../market";
import {
  ZONA_CLAVES,
  ZONA_DISPLAY,
  PRODUCTO_CLAVES,
  PRODUCTO_DISPLAY,
  ZONAS_SENAL,
  type ZonaCamiones,
  type ProductoCamiones,
} from "./config";
import { mediaMovil, percentilCalendario, calcularSenal, type Punto, type SenalPunto } from "./senal";

/**
 * camiones.ts — Capa de datos pública (`/comercio/camiones`, C5 del backlog maestro) y de la señal
 * "barcos vs camiones" (solo mesa, negocio/09).
 *
 * Fuente: tabla `camiones` — carga MANUAL desde /admin/datos (Williams Entregas vía Agrochat,
 * fuente='williams') + una fuente de referencia sin usar hoy (fuente='magyp', ver sagyp.ts). Cuando
 * las dos coexisten para una misma (fecha, zona, producto), Williams gana SIEMPRE — es "la fuente
 * de camiones por excelencia" según Lautoro; magyp solo llena el hueco si Williams no cargó ese día.
 */

const SOURCE = "Williams Entregas";
const REVALIDATE = 900; // 15 min (dato de carga manual, no hay apuro de frescura)

type CamionRow = { fecha: string; zona: ZonaCamiones; producto: string; fuente: "williams" | "magyp"; cantidad: number };

/** fecha ISO → Date UTC medianoche (mismo patrón que parseFechaUTC de campanas.ts). */
function parseFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** Resuelve prioridad de fuente (williams > magyp) por clave lógica, colapsando duplicados. */
function resolverPrioridad(rows: CamionRow[]): CamionRow[] {
  const porClave = new Map<string, CamionRow>();
  for (const r of rows) {
    const k = `${r.fecha}|${r.zona}|${r.producto}`;
    const prev = porClave.get(k);
    if (!prev || (prev.fuente !== "williams" && r.fuente === "williams")) porClave.set(k, r);
  }
  return [...porClave.values()];
}

export type SerieZona = { zona: ZonaCamiones; display: string; puntos: { fecha: string; cantidad: number }[] };
export type SerieProducto = { producto: ProductoCamiones; display: string; puntos: { fecha: string; cantidad: number }[] };
/** Matriz cruda zona×producto (excluye TOTAL) — insumo puro de `matriz.ts` para el chart único de
 *  Williams (relevamiento web R9, punto 53): grano elegido → sumar/filtrar zonas o re-agrupar por
 *  campaña. Cada export "un grano puntual" de Williams SÍ trae las 4 zonas para ese producto
 *  (ver QueEsEsto de `camiones-panel.tsx`), así que el cruce existe en la tabla — antes se perdía
 *  al sumarlo todo en `porProducto`. */
export type PuntoZonaProducto = { fecha: string; zona: ZonaCamiones; producto: ProductoCamiones; cantidad: number };

export type CamionesData = {
  fecha: string | null;
  totalHoy: number | null;
  deltaAyer: number | null; // vs día hábil anterior con dato
  deltaSemana: number | null; // vs el mismo día calendario 7 días antes (si hay dato esa fecha)
  productoLiderHoy: { cod: ProductoCamiones; display: string; cantidad: number } | null;
  porZona: SerieZona[]; // producto = TOTAL únicamente (el reporte no abre zona×producto)
  porProducto: SerieProducto[]; // suma nacional (4 zonas) por producto cargado
  porZonaProducto: PuntoZonaProducto[];
  productosDisponibles: ProductoCamiones[];
  meta: Meta;
};

const vacia = (problema: string): CamionesData => ({
  fecha: null,
  totalHoy: null,
  deltaAyer: null,
  deltaSemana: null,
  productoLiderHoy: null,
  porZona: [],
  porProducto: [],
  porZonaProducto: [],
  productosDisponibles: [],
  meta: { source: SOURCE, updatedAt: null, status: "parcial", problemas: [problema] },
});

export const getCamiones = cache(async (): Promise<CamionesData> => {
  const res = await sbSelectAll("camiones?select=fecha,zona,producto,fuente,cantidad&order=fecha.asc", REVALIDATE);
  if (!res.ok) {
    return vacia(res.reason === "unconfigured" ? "Supabase sin configurar" : "Tabla camiones no disponible");
  }
  const rows = resolverPrioridad(res.data as CamionRow[]);
  if (rows.length === 0) return vacia("Sin datos todavía — cargalos desde /admin/datos (pestaña Camiones)");

  // --- Serie por zona (producto = TOTAL) ---
  const porZonaMap = new Map<ZonaCamiones, Map<string, number>>();
  for (const r of rows) {
    if (r.producto !== "TOTAL") continue;
    if (!porZonaMap.has(r.zona)) porZonaMap.set(r.zona, new Map());
    porZonaMap.get(r.zona)!.set(r.fecha, (porZonaMap.get(r.zona)!.get(r.fecha) ?? 0) + r.cantidad);
  }
  const porZona: SerieZona[] = ZONA_CLAVES.filter((z) => porZonaMap.has(z)).map((z) => ({
    zona: z,
    display: ZONA_DISPLAY[z],
    puntos: [...porZonaMap.get(z)!.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, cantidad]) => ({ fecha, cantidad })),
  }));

  // --- Serie nacional por producto (suma de las 4 zonas, para cada producto cargado ≠ TOTAL) ---
  const porProductoMap = new Map<ProductoCamiones, Map<string, number>>();
  for (const r of rows) {
    if (r.producto === "TOTAL" || !PRODUCTO_CLAVES.includes(r.producto as ProductoCamiones)) continue;
    const p = r.producto as ProductoCamiones;
    if (!porProductoMap.has(p)) porProductoMap.set(p, new Map());
    porProductoMap.get(p)!.set(r.fecha, (porProductoMap.get(p)!.get(r.fecha) ?? 0) + r.cantidad);
  }
  const productosDisponibles = PRODUCTO_CLAVES.filter((p) => porProductoMap.has(p));
  const porProducto: SerieProducto[] = productosDisponibles.map((p) => ({
    producto: p,
    display: PRODUCTO_DISPLAY[p],
    puntos: [...porProductoMap.get(p)!.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, cantidad]) => ({ fecha, cantidad })),
  }));

  // --- Matriz cruda zona×producto (sin sumar entre zonas ni entre fechas) ---
  const porZonaProducto: PuntoZonaProducto[] = rows
    .filter((r) => r.producto !== "TOTAL" && PRODUCTO_CLAVES.includes(r.producto as ProductoCamiones))
    .map((r) => ({ fecha: r.fecha, zona: r.zona, producto: r.producto as ProductoCamiones, cantidad: r.cantidad }));

  // --- KPIs de la última fecha con dato TOTAL ---
  const fechasTotal = [...(porZonaMap.get("ROSARIO_ALEDANOS")?.keys() ?? [])].sort();
  // Fallback: si por algún motivo no hay TOTAL, usar la fecha más nueva de cualquier serie.
  const todasFechas = [...new Set(rows.map((r) => r.fecha))].sort();
  const fecha = fechasTotal.length
    ? (fechasTotal[fechasTotal.length - 1] ?? null)
    : (todasFechas[todasFechas.length - 1] ?? null);

  let totalHoy: number | null = null;
  let deltaAyer: number | null = null;
  let deltaSemana: number | null = null;
  if (fecha) {
    totalHoy = ZONA_CLAVES.reduce((acc, z) => acc + (porZonaMap.get(z)?.get(fecha) ?? 0), 0);
    const idx = fechasTotal.indexOf(fecha);
    if (idx > 0) {
      // idx>0 → idx-1 es un índice válido de fechasTotal.
      const fAyer = fechasTotal[idx - 1]!;
      const tAyer = ZONA_CLAVES.reduce((acc, z) => acc + (porZonaMap.get(z)?.get(fAyer) ?? 0), 0);
      deltaAyer = totalHoy - tAyer;
    }
    const hace7 = new Date(parseFecha(fecha).getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
    if (fechasTotal.includes(hace7)) {
      const tSemana = ZONA_CLAVES.reduce((acc, z) => acc + (porZonaMap.get(z)?.get(hace7) ?? 0), 0);
      deltaSemana = totalHoy - tSemana;
    }
  }

  let productoLiderHoy: CamionesData["productoLiderHoy"] = null;
  if (fecha) {
    for (const p of productosDisponibles) {
      const v = porProductoMap.get(p)?.get(fecha);
      if (v != null && (productoLiderHoy == null || v > productoLiderHoy.cantidad)) {
        productoLiderHoy = { cod: p, display: PRODUCTO_DISPLAY[p], cantidad: v };
      }
    }
  }

  return {
    fecha,
    totalHoy,
    deltaAyer,
    deltaSemana,
    productoLiderHoy,
    porZona,
    porProducto,
    porZonaProducto,
    productosDisponibles,
    meta: { source: SOURCE, updatedAt: null, status: "real", problemas: [] },
  };
});

/* ==================== Señal barcos vs camiones (solo mesa) ==================== */

type DensRow = { fecha: string; cod: string; densidad_tn: number };
type DensZonaRow = { fecha: string; zona: "GRAN_ROSARIO" | "BAHIA_BLANCA"; densidad_tn: number };

export type SenalItem = {
  cod: string;
  display: string;
  senal: SenalPunto;
  camionesHoyMA7: number | null;
  densidadHoyTn: number | null;
  fecha: string | null;
};

export type SenalCamionesData = {
  fecha: string | null;
  porProducto: SenalItem[];
  porZona: SenalItem[];
  meta: Meta;
};

const senalVacia = (problema: string): SenalCamionesData => ({
  fecha: null,
  porProducto: [],
  porZona: [],
  meta: { source: "Elaboración propia ROFO AGRO", updatedAt: null, status: "parcial", problemas: [problema] },
});

function comoPuntos(mapa: Map<string, number> | undefined): Punto[] {
  if (!mapa) return [];
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, valor]) => ({ fecha: parseFecha(fecha), valor }));
}

export const getSenalCamiones = cache(async (): Promise<SenalCamionesData> => {
  const [camRes, densRes, densZonaRes] = await Promise.all([
    sbSelectAll("camiones?select=fecha,zona,producto,fuente,cantidad&order=fecha.asc", REVALIDATE),
    sbSelectAll("lineup_densidad_ar_hist?select=fecha,cod,densidad_tn", REVALIDATE),
    sbSelectAll("lineup_densidad_zona_hist?select=fecha,zona,densidad_tn", REVALIDATE),
  ]);
  if (!camRes.ok) {
    return senalVacia(camRes.reason === "unconfigured" ? "Supabase sin configurar" : "Tabla camiones no disponible");
  }
  if (!densRes.ok || !densZonaRes.ok) {
    // Server-only: en local/preview sin SUPABASE_SERVICE_KEY estas matviews no son legibles por
    // anon (a propósito, son mesa-only) → degrada explicando por qué, no como error genérico.
    return senalVacia("Series de line-up no disponibles (requiere SUPABASE_SERVICE_KEY server-side)");
  }
  const camRows = resolverPrioridad(camRes.data as CamionRow[]);
  const densRows = densRes.data as DensRow[];
  const densZonaRows = densZonaRes.data as DensZonaRow[];

  // --- Camiones: serie nacional por producto (suma 4 zonas) + serie por zona (producto=TOTAL) ---
  const camPorProducto = new Map<string, Map<string, number>>();
  const camPorZona = new Map<string, Map<string, number>>();
  for (const r of camRows) {
    if (r.producto !== "TOTAL" && PRODUCTO_CLAVES.includes(r.producto as ProductoCamiones)) {
      if (!camPorProducto.has(r.producto)) camPorProducto.set(r.producto, new Map());
      const m = camPorProducto.get(r.producto)!;
      m.set(r.fecha, (m.get(r.fecha) ?? 0) + r.cantidad);
    }
    if (r.producto === "TOTAL" && (r.zona === "ROSARIO_ALEDANOS" || r.zona === "BAHIA_BLANCA")) {
      if (!camPorZona.has(r.zona)) camPorZona.set(r.zona, new Map());
      camPorZona.get(r.zona)!.set(r.fecha, r.cantidad);
    }
  }

  // --- Line-up: densidad nacional por producto + por zona ---
  const densPorProducto = new Map<string, Map<string, number>>();
  for (const r of densRows) {
    if (!densPorProducto.has(r.cod)) densPorProducto.set(r.cod, new Map());
    densPorProducto.get(r.cod)!.set(r.fecha, Number(r.densidad_tn));
  }
  const densPorZona = new Map<string, Map<string, number>>();
  for (const r of densZonaRows) {
    if (!densPorZona.has(r.zona)) densPorZona.set(r.zona, new Map());
    densPorZona.get(r.zona)!.set(r.fecha, Number(r.densidad_tn));
  }

  let fechaGlobal: string | null = null;
  for (const m of camPorProducto.values()) {
    const f = [...m.keys()].sort().at(-1);
    if (f && (!fechaGlobal || f > fechaGlobal)) fechaGlobal = f;
  }

  /** Calcula una señal (producto o zona) a partir de las 2 series crudas. */
  function calcularItem(cod: string, display: string, camSerieMap: Map<string, number> | undefined, densSerieMap: Map<string, number> | undefined): SenalItem {
    const camPts = comoPuntos(camSerieMap);
    const densPts = comoPuntos(densSerieMap);
    if (camPts.length === 0 || densPts.length === 0) {
      return { cod, display, senal: calcularSenal(null, null), camionesHoyMA7: null, densidadHoyTn: null, fecha: null };
    }
    const ma7 = mediaMovil(camPts, 7);
    // mediaMovil() de senal.ts es de ventana EXPANSIVA (nunca acorta el largo): ma7.length ===
    // camPts.length, ya >=1 por el guard de arriba. densPts idem.
    const hoyCam = ma7[ma7.length - 1]!;
    const hoyDens = densPts[densPts.length - 1]!;
    const hoy = hoyCam.fecha > hoyDens.fecha ? hoyCam.fecha : hoyDens.fecha;
    const pctlCamiones = percentilCalendario(ma7, hoy, hoyCam.valor);
    const pctlLineup = percentilCalendario(densPts, hoy, hoyDens.valor);
    return {
      cod,
      display,
      senal: calcularSenal(pctlLineup, pctlCamiones),
      camionesHoyMA7: Math.round(hoyCam.valor),
      densidadHoyTn: Math.round(hoyDens.valor),
      fecha: hoy.toISOString().slice(0, 10),
    };
  }

  const porProducto: SenalItem[] = PRODUCTO_CLAVES.map((p) =>
    calcularItem(p, PRODUCTO_DISPLAY[p], camPorProducto.get(p), densPorProducto.get(p)),
  );
  const porZona: SenalItem[] = ZONAS_SENAL.map((z) =>
    calcularItem(z.clave, z.display, camPorZona.get(z.clave), densPorZona.get(z.lineupZona)),
  );

  return {
    fecha: fechaGlobal,
    porProducto,
    porZona,
    meta: { source: "Elaboración propia ROFO AGRO", updatedAt: null, status: "real", problemas: [] },
  };
});
