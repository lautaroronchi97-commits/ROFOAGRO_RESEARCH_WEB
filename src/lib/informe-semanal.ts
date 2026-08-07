import "server-only";
import { cache } from "react";
import { sbSelect, sbSelectAll } from "./supabase";
import { diasEntre } from "./dates";
import { GRANOS_VIEW, parseEvidenciaExterna, type EvidenciaExterna, type GranoView } from "./views-mercado";
import { calcularScorecard, type Scorecard } from "./views-scorecard";
import {
  volumenPorUnderlying,
  calcularDesacople,
  type PuntoValor,
  type VolumenUnderlying,
  type Desacople,
} from "./informe-v3-calc";
import { getPizarra } from "./pizarra";
import { getCierresGranos } from "./futuros";
import { fetchSerie } from "./series";
import { percentil } from "./derivadas";

/**
 * Insumos SEMANALES para el informe semanal (MP2 de docs/PLAN_INFORMES.md): variación de
 * granos/Chicago/pizarra/dólar oficial entre el último dato disponible y el de ~7 días antes.
 * No asumimos "viernes calendario" (el mercado puede no operar ese día por feriado): se toma la
 * fecha real más reciente dentro de la ventana pedida, y la fecha real más cercana a "esa fecha
 * menos 7 días" — mismo criterio que ya usa `getNegociado` (última vs penúltima fecha real).
 *
 * REGLA DURA: si no hay 2 fechas reales para comparar, la variación queda `null` — nunca se
 * inventa un valor. El dólar OFICIAL usa la serie de BCRA (variable 5, Tipo de Cambio
 * Mayorista/A3500): es la ÚNICA fuente con historial real; el spot `UST$T` de MAE que usa el
 * resto de la web NO tiene historial en ningún lado (API en vivo, `?fecha=` no tiene efecto,
 * verificado con request real 23/07) — decisión de Lautaro: usar A3500 igual, aclarando la
 * fuente (trae el spread bancario implícito, por eso el resto de la web usa el spot de MAE).
 */

const MESES: Record<string, number> = {
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6,
  JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12,
};

/** JUL26 → 202607 ; DISPO/otros → 0 (mismo criterio que futuros.ts, sin exportar de ahí — L1 lo unifica). */
function vencKeyDePosicion(posicion: string | null): number {
  if (!posicion) return 0;
  const m = posicion.toUpperCase().match(/^([A-Z]{3})(\d{2})$/);
  if (!m) return 0;
  const mes = MESES[m[1] ?? ""] ?? 0;
  return (2000 + Number(m[2] ?? "")) * 100 + mes;
}

function hoyVencKey(hoyISO: string): number {
  const [anio, mes] = hoyISO.split("-").map(Number);
  return (anio ?? 0) * 100 + (mes ?? 0);
}

function restarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

/** De una lista de fechas ISO (con `excluir` afuera), la más cercana a `objetivo`. */
function fechaMasCercana(fechas: string[], objetivo: string, excluir: string): string | null {
  let mejor: string | null = null;
  let mejorDist = Infinity;
  for (const f of fechas) {
    if (f === excluir) continue;
    const dist = Math.abs(diasEntre(f, objetivo));
    if (dist < mejorDist) {
      mejor = f;
      mejorDist = dist;
    }
  }
  return mejor;
}

export type VariacionPunto = {
  actual: number | null;
  previa: number | null;
  deltaPct: number | null;
  fechaActual: string | null;
  fechaPrevia: string | null;
};

/** Contrato "vivo" de verdad: tiene un cierre dentro de los últimos `maxDias` (no solo mes vigente
 * por nombre — un JUL26 puede dejar de operar a mitad de julio, antes de "vencer" por calendario). */
function esReciente(fechaActual: string | null, hastaISO: string, maxDias = 10): boolean {
  return fechaActual != null && diasEntre(fechaActual, hastaISO) <= maxDias;
}

function calcularVariacion(porFecha: Map<string, number>): VariacionPunto {
  const fechas = [...porFecha.keys()].sort();
  const vacio: VariacionPunto = { actual: null, previa: null, deltaPct: null, fechaActual: null, fechaPrevia: null };
  if (fechas.length === 0) return vacio;
  const fechaActual = fechas[fechas.length - 1]!; // length===0 ya salió arriba
  const actual = porFecha.get(fechaActual) ?? null;
  const objetivo = restarDias(fechaActual, 7);
  const fechaPrevia = fechaMasCercana(fechas, objetivo, fechaActual);
  const previa = fechaPrevia ? porFecha.get(fechaPrevia) ?? null : null;
  if (actual == null || previa == null || previa === 0) {
    return { actual, previa, deltaPct: null, fechaActual, fechaPrevia };
  }
  return { actual, previa, deltaPct: ((actual - previa) / previa) * 100, fechaActual, fechaPrevia };
}

export type VariacionGrano = { underlying: string; posicion: string } & VariacionPunto;

/** Variación semanal de los futuros de granos vivos (SOJ/MAI/TRI), por posición cercana. */
export const getVariacionSemanalGranos = cache(async (hastaISO: string): Promise<VariacionGrano[]> => {
  const desde = restarDias(hastaISO, 12);
  const res = await sbSelect(
    `futuros_cierres?select=symbol,underlying,posicion,fecha,settlement&underlying=in.(SOJ,MAI,TRI)&fecha=gte.${desde}&fecha=lte.${hastaISO}&order=fecha.asc`,
    0,
  );
  if (!res.ok || !Array.isArray(res.data)) return [];

  const hoyYM = hoyVencKey(hastaISO);
  const bySymbol = new Map<string, { underlying: string; posicion: string; porFecha: Map<string, number> }>();
  for (const r of res.data as Record<string, unknown>[]) {
    const symbol = String(r.symbol ?? "");
    const underlying = String(r.underlying ?? "");
    const posicion = String(r.posicion ?? "");
    const fecha = r.fecha;
    const settlement = typeof r.settlement === "number" ? r.settlement : Number(r.settlement);
    if (!symbol || typeof fecha !== "string" || !Number.isFinite(settlement)) continue;
    if (vencKeyDePosicion(posicion) < hoyYM) continue; // solo posiciones vivas
    let g = bySymbol.get(symbol);
    if (!g) {
      g = { underlying, posicion, porFecha: new Map() };
      bySymbol.set(symbol, g);
    }
    g.porFecha.set(fecha, settlement);
  }

  const out: VariacionGrano[] = [];
  for (const g of bySymbol.values()) {
    const v = calcularVariacion(g.porFecha);
    if (!esReciente(v.fechaActual, hastaISO)) continue; // contrato sin operar en la semana (aunque el mes siga "vigente")
    out.push({ underlying: g.underlying, posicion: g.posicion, ...v });
  }
  // Las 3 posiciones más cercanas por grano (mismo recorte que usa el resto de la web).
  out.sort((a, b) => a.underlying.localeCompare(b.underlying) || vencKeyDePosicion(a.posicion) - vencKeyDePosicion(b.posicion));
  const porGrano = new Map<string, number>();
  return out.filter((v) => {
    const n = (porGrano.get(v.underlying) ?? 0) + 1;
    porGrano.set(v.underlying, n);
    return n <= 3;
  });
});

export type VariacionChicago = { grano: string; posicion: string } & VariacionPunto;

/** Variación semanal de Chicago (cbot_cierres) por grano, posiciones cercanas. */
export const getVariacionSemanalChicago = cache(async (hastaISO: string): Promise<VariacionChicago[]> => {
  const desde = restarDias(hastaISO, 12);
  const res = await sbSelect(
    `cbot_cierres?select=symbol,grano,posicion,fecha,settlement_usd_tn&grano=in.(soja,maiz,trigo)&fecha=gte.${desde}&fecha=lte.${hastaISO}&order=fecha.asc`,
    0,
  );
  if (!res.ok || !Array.isArray(res.data)) return [];

  const hoyYM = hoyVencKey(hastaISO);
  const bySymbol = new Map<string, { grano: string; posicion: string; porFecha: Map<string, number> }>();
  for (const r of res.data as Record<string, unknown>[]) {
    const symbol = String(r.symbol ?? "");
    const grano = String(r.grano ?? "");
    const posicion = String(r.posicion ?? "");
    const fecha = r.fecha;
    const val = typeof r.settlement_usd_tn === "number" ? r.settlement_usd_tn : Number(r.settlement_usd_tn);
    if (!symbol || typeof fecha !== "string" || !Number.isFinite(val)) continue;
    if (vencKeyDePosicion(posicion) < hoyYM) continue;
    let g = bySymbol.get(symbol);
    if (!g) {
      g = { grano, posicion, porFecha: new Map() };
      bySymbol.set(symbol, g);
    }
    g.porFecha.set(fecha, val);
  }

  const out: VariacionChicago[] = [];
  for (const g of bySymbol.values()) {
    const v = calcularVariacion(g.porFecha);
    if (!esReciente(v.fechaActual, hastaISO)) continue;
    out.push({ grano: g.grano, posicion: g.posicion, ...v });
  }
  out.sort((a, b) => a.grano.localeCompare(b.grano) || vencKeyDePosicion(a.posicion) - vencKeyDePosicion(b.posicion));
  const porGrano = new Map<string, number>();
  return out.filter((v) => {
    const n = (porGrano.get(v.grano) ?? 0) + 1;
    porGrano.set(v.grano, n);
    return n <= 2;
  });
});

export type VariacionPizarra = { grano: string } & VariacionPunto;

/** Variación semanal de la pizarra CAC-BCR (USD/tn) por grano. */
export const getVariacionSemanalPizarra = cache(async (hastaISO: string): Promise<VariacionPizarra[]> => {
  const desde = restarDias(hastaISO, 12);
  const res = await sbSelect(
    `pizarra_historico?select=grano,fecha,precio_usd&grano=in.(soja,maiz,trigo)&fecha=gte.${desde}&fecha=lte.${hastaISO}&order=fecha.asc`,
    0,
  );
  if (!res.ok || !Array.isArray(res.data)) return [];

  const porGrano = new Map<string, Map<string, number>>();
  for (const r of res.data as Record<string, unknown>[]) {
    const grano = String(r.grano ?? "");
    const fecha = r.fecha;
    const val = typeof r.precio_usd === "number" ? r.precio_usd : Number(r.precio_usd);
    if (!grano || typeof fecha !== "string" || !Number.isFinite(val)) continue;
    let m = porGrano.get(grano);
    if (!m) {
      m = new Map();
      porGrano.set(grano, m);
    }
    m.set(fecha, val);
  }
  return [...porGrano.entries()].map(([grano, porFecha]) => ({ grano, ...calcularVariacion(porFecha) }));
});

/**
 * Dólar oficial semanal — BCRA v4, variable 5 ("Tipo de Cambio Mayorista"/A3500). Único con
 * historial real; decisión de Lautaro (23/07): usarlo igual aclarando la fuente en el informe
 * (no es el spot UST$T que usa el resto de la web, que no tiene historial en ningún lado).
 */
export const getVariacionSemanalDolarOficial = cache(async (hastaISO: string): Promise<VariacionPunto & { serie: { fecha: string; valor: number }[] }> => {
  const desde = restarDias(hastaISO, 13);
  const vacio = { actual: null, previa: null, deltaPct: null, fechaActual: null, fechaPrevia: null, serie: [] };
  try {
    const res = await fetch(
      `https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/5?desde=${desde}&hasta=${hastaISO}`,
      { headers: { "user-agent": "Mozilla/5.0 (ROFOAGRO research)" }, signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return vacio;
    const json = (await res.json()) as { results?: { detalle?: { fecha: string; valor: number }[] }[] };
    const detalle = json.results?.[0]?.detalle ?? [];
    const porFecha = new Map<string, number>();
    for (const d of detalle) {
      if (d.fecha <= hastaISO) porFecha.set(d.fecha, d.valor);
    }
    const variacion = calcularVariacion(porFecha);
    const serie = [...porFecha.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([fecha, valor]) => ({ fecha, valor }));
    return { ...variacion, serie };
  } catch {
    return vacio;
  }
});

export type ViewMercadoResumen = {
  grano: string;
  direccion: "alcista" | "bajista" | "neutral";
  confianza: number;
  horizonte: string;
  tesis_md: string;
  invalidacion: string;
  fecha: string;
  /** V3/V4 (PLAN_INFORMES_V2.md §6.3/§6.4): CONFIRMA/AJUSTA/SWITCH/CUMPLIDA vs el view anterior
   *  — null si es la primera tesis de ese grano ("inicial") o si el campo no vino seteado. */
  relacion_previa: string | null;
  /** Pasaportes (URL+fecha+cita) ya verificados en F5 de `view-mercado` — el diario (V4) los
   *  puede citar como contexto sin research nuevo; el semanal (V3) los usa en "El mundo esta
   *  semana" si `viewsMercado` trae algo fresco que el research propio de esta semana no cubrió. */
  evidencia_externa: EvidenciaExterna[];
};

/**
 * View de mercado vigente por grano (MP3/V1), leído con `sbSelect` (prefiere la service key en
 * producción, que bypasa el RLS `is_admin()` de `views_mercado`) en vez de `getViewsMercado()`
 * (que usa la sesión SSR del usuario — no existe en este contexto de route handler con token).
 */
export const getViewMercadoVigentePorGrano = cache(async (): Promise<ViewMercadoResumen[]> => {
  const res = await sbSelect(
    "views_mercado?select=grano,direccion,confianza,horizonte,tesis_md,invalidacion,fecha,relacion_previa,evidencia_externa&order=fecha.desc",
    0,
  );
  if (!res.ok || !Array.isArray(res.data)) return [];
  const vistos = new Set<string>();
  const out: ViewMercadoResumen[] = [];
  for (const r of res.data as Record<string, unknown>[]) {
    const grano = String(r.grano ?? "");
    if (!grano || vistos.has(grano)) continue;
    vistos.add(grano);
    out.push({
      grano,
      direccion: r.direccion as ViewMercadoResumen["direccion"],
      confianza: Number(r.confianza),
      horizonte: String(r.horizonte ?? ""),
      tesis_md: String(r.tesis_md ?? ""),
      invalidacion: String(r.invalidacion ?? ""),
      fecha: String(r.fecha ?? ""),
      relacion_previa: typeof r.relacion_previa === "string" ? r.relacion_previa : null,
      evidencia_externa: parseEvidenciaExterna(r.evidencia_externa),
    });
  }
  return out;
});

/**
 * Resumen del scorecard (hit-rate/racha a 14 días por grano) para el informe semanal (V3,
 * §6.3 de PLAN_INFORMES_V2.md: se menciona 1 vez por mes, transparencia estilo "what we got
 * wrong"). Reusa `calcularScorecard` — la misma lib pura que ya usa `/granos/view`, cero fórmula
 * nueva. `views_mercado` se lee con `sbSelectAll` (prefiere la service key, bypasa el RLS
 * `is_admin()`), mismo criterio que `getViewMercadoVigentePorGrano` de acá arriba.
 */
export const getScorecardResumen = cache(async (): Promise<Scorecard["porGrano"]> => {
  const vacio: Scorecard["porGrano"] = {
    soja: { grano: "soja", nMedidos: 0, hitRate: null, brier: null, racha: null },
    maiz: { grano: "maiz", nMedidos: 0, hitRate: null, brier: null, racha: null },
    trigo: { grano: "trigo", nMedidos: 0, hitRate: null, brier: null, racha: null },
    aceite_soja: { grano: "aceite_soja", nMedidos: 0, hitRate: null, brier: null, racha: null },
  };
  const [viewsRes, cierresRes] = await Promise.all([
    sbSelectAll("views_mercado?select=id,grano,fecha,direccion,confianza&order=fecha.asc", 3600),
    sbSelectAll(
      "futuros_cierres?select=underlying,posicion,fecha,settlement&underlying=in.(SOJ,MAI,TRI)&order=fecha.asc",
      3600,
    ),
  ]);
  if (!viewsRes.ok || !Array.isArray(viewsRes.data)) return vacio;

  const views = (viewsRes.data as Record<string, unknown>[])
    .filter((r) => GRANOS_VIEW.includes(String(r.grano) as GranoView))
    .map((r) => ({
      id: String(r.id ?? ""),
      grano: String(r.grano) as GranoView,
      fecha: String(r.fecha ?? ""),
      direccion: r.direccion as "alcista" | "bajista" | "neutral",
      confianza: Number(r.confianza),
    }));
  if (views.length === 0) return vacio;

  type CierreRaw = { underlying: string; posicion: string; fecha: string; settlement: number | string };
  const cierres = cierresRes.ok && Array.isArray(cierresRes.data)
    ? (cierresRes.data as CierreRaw[]).map((r) => ({
        underlying: r.underlying,
        posicion: r.posicion,
        fecha: r.fecha,
        settlement: Number(r.settlement),
      }))
    : [];

  return calcularScorecard(views, cierres).porGrano;
});

/* ==================================================================================
 * E1 de PLAN_INFORMES_V3.md §10 — insumos nuevos del semanal/view v3: volumen A3
 * semanal, desacople local-internacional (premio/descuento A3 vs CBOT) y zona del
 * precio (percentil histórico 5 años). Reusan las primitivas puras de
 * `informe-v3-calc.ts`.
 * ================================================================================ */

const UNDERLYING_A_GRANO: Record<string, GranoView> = { SOJ: "soja", MAI: "maiz", TRI: "trigo" };

/** Volumen A3 semanal por grano — suma de `futuros_cierres.volume` de las últimas 5 ruedas de
 *  cada underlying (§6.1 "la semana en números"). */
export const getVolumenA3Semanal = cache(async (hastaISO: string): Promise<VolumenUnderlying[]> => {
  const desde = restarDias(hastaISO, 15); // colchón para 5 ruedas con feriados/fin de semana de por medio
  const res = await sbSelect(
    `futuros_cierres?select=underlying,fecha,volume&underlying=in.(SOJ,MAI,TRI)&fecha=gte.${desde}&fecha=lte.${hastaISO}`,
    0,
  );
  if (!res.ok || !Array.isArray(res.data)) return [];
  const filas = (res.data as Record<string, unknown>[])
    .map((r) => ({
      underlying: String(r.underlying ?? ""),
      fecha: String(r.fecha ?? ""),
      volume: typeof r.volume === "number" ? r.volume : r.volume == null ? null : Number(r.volume),
    }))
    .filter((r) => r.underlying && r.fecha);
  return volumenPorUnderlying(filas, hastaISO, 5);
});

/**
 * Serie histórica del contrato "vivo hoy" de una tabla de cierres (`futuros_cierres`/
 * `cbot_cierres`), dentro de [hastaISO−lookbackDias, hastaISO]. Mismo criterio "vivo" (vencKey ≥
 * mes de hastaISO) que `getVariacionSemanalGranos`/`getVariacionSemanalChicago` — proxy razonable
 * de serie continua para leer el nivel de precio en fechas pasadas SIN reconstruir rolleos
 * históricos (si el contrato de referencia rolleó hace poco, los puntos más viejos del contrato
 * anterior simplemente no aparecen — el caller degrada honesto con `null`, nunca inventa).
 */
async function serieContratoVivo(
  tabla: "futuros_cierres" | "cbot_cierres",
  filtroCol: "underlying" | "grano",
  filtroVal: string,
  valCol: "settlement" | "settlement_usd_tn",
  hastaISO: string,
  lookbackDias: number,
): Promise<PuntoValor[]> {
  const desde = restarDias(hastaISO, lookbackDias);
  const res = await sbSelect(
    `${tabla}?select=symbol,posicion,fecha,${valCol}&${filtroCol}=eq.${filtroVal}&fecha=gte.${desde}&fecha=lte.${hastaISO}&order=fecha.asc`,
    0,
  );
  if (!res.ok || !Array.isArray(res.data)) return [];

  const hoyYM = hoyVencKey(hastaISO);
  const bySymbol = new Map<string, PuntoValor[]>();
  for (const r of res.data as Record<string, unknown>[]) {
    const symbol = String(r.symbol ?? "");
    const posicion = String(r.posicion ?? "");
    const fecha = r.fecha;
    const raw = r[valCol];
    const val = typeof raw === "number" ? raw : Number(raw);
    if (!symbol || typeof fecha !== "string" || !Number.isFinite(val)) continue;
    if (vencKeyDePosicion(posicion) < hoyYM) continue;
    const arr = bySymbol.get(symbol) ?? [];
    arr.push({ fecha, valor: val });
    bySymbol.set(symbol, arr);
  }

  // El contrato "vivo" cuyo último cierre dentro de la ventana es más reciente = la referencia de hoy.
  let mejor: PuntoValor[] = [];
  let mejorFecha = "";
  for (const arr of bySymbol.values()) {
    const ultima = arr.reduce((mx, p) => (p.fecha > mx ? p.fecha : mx), "");
    if (ultima > mejorFecha) {
      mejorFecha = ultima;
      mejor = arr;
    }
  }
  return mejor;
}

/** Premio/descuento A3 vs CBOT por grano, hoy y hace 1/4 semanas (§7.2 del view v3) — responde
 *  "¿el precio local y el internacional van de la mano o se desprenden?" con números. */
export const getDesacopleLocal = cache(async (hastaISO: string): Promise<Record<GranoView, Desacople>> => {
  const entries = await Promise.all(
    (Object.entries(UNDERLYING_A_GRANO) as [string, GranoView][]).map(async ([underlying, grano]) => {
      const [a3, cbot] = await Promise.all([
        serieContratoVivo("futuros_cierres", "underlying", underlying, "settlement", hastaISO, 40),
        serieContratoVivo("cbot_cierres", "grano", grano, "settlement_usd_tn", hastaISO, 40),
      ]);
      return [grano, calcularDesacople(a3, cbot, hastaISO)] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<GranoView, Desacople>;
});

export type ZonaPrecioGrano = {
  grano: GranoView;
  nivelPizarraUsd: number | null;
  percentilPizarra5y: number | null;
  posicionA3: string | null;
  nivelA3Usd: number | null;
  percentilA3_5y: number | null;
};

function restarAniosISO(iso: string, anios: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - anios);
  return d.toISOString().slice(0, 10);
}

/**
 * Percentil histórico (5 años) del nivel actual de precio — pizarra y 1ª posición A3 — para
 * responder "¿en qué zona del rango está el precio?" (view v3, §7.2). Reusa la infraestructura
 * de `/api/series` (`fetchSerie` + `percentil`) en vez de duplicar lógica de series.
 */
export const getZonaPrecio = cache(async (hastaISO: string): Promise<Record<GranoView, ZonaPrecioGrano>> => {
  const desde5y = restarAniosISO(hastaISO, 5);
  const [pizarra, cierres] = await Promise.all([getPizarra(), getCierresGranos()]);

  const entries = await Promise.all(
    (Object.entries(UNDERLYING_A_GRANO) as [string, GranoView][]).map(async ([underlying, grano]) => {
      const seriePizarra = await fetchSerie(`pizarra:${grano}`, desde5y, hastaISO, "usd");
      const nivelPizarraUsd = pizarra.granos[underlying]?.usd ?? null;
      const percentilPizarra5y =
        seriePizarra && nivelPizarraUsd != null ? percentil(nivelPizarraUsd, seriePizarra.v) : null;

      const g = cierres.granos.find((x) => x.underlying === underlying);
      const front = g?.posiciones[0] ?? null;
      let nivelA3Usd: number | null = null;
      let percentilA3_5y: number | null = null;
      if (front?.settlement != null) {
        const serieA3 = await fetchSerie(front.symbol, desde5y, hastaISO, "usd");
        nivelA3Usd = front.settlement;
        percentilA3_5y = serieA3 ? percentil(nivelA3Usd, serieA3.v) : null;
      }
      return [
        grano,
        { grano, nivelPizarraUsd, percentilPizarra5y, posicionA3: front?.posicion ?? null, nivelA3Usd, percentilA3_5y },
      ] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<GranoView, ZonaPrecioGrano>;
});
