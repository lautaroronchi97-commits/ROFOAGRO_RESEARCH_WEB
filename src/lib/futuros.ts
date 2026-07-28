import "server-only";
import { cache } from "react";
import { sbSelect } from "./supabase";
import type { Meta } from "./market";
import { vencKeyDePosicion, hoyVencKey, hoyCordobaISO } from "./dates";
import { getVencimientos } from "./vencimientos";

/**
 * Cierres de futuros de granos (A3/Matba ROFEX), leídos de Supabase
 * (vista `futuros_cierres_ultimo`: último cierre por posición). Fuente original: CEM.
 */

export type CierrePos = {
  symbol: string;
  posicion: string;
  settlement: number | null;
  close: number | null;
  changePercent: number | null;
  volume: number | null;
  openInterest: number | null;
  oiChange: number | null;
  impliedRate: number | null;
  venc: number; // clave de orden por vencimiento (aaaamm; 0 = disponible)
};

export type GranoCierres = {
  underlying: string;
  nombre: string;
  fecha: string | null;
  posiciones: CierrePos[];
};

export type CierresData = { granos: GranoCierres[]; meta: Meta };

type RawRow = {
  symbol: string;
  fecha: string | null;
  underlying: string | null;
  posicion: string | null;
  settlement: number | null;
  close: number | null;
  change_percent: number | null;
  volume: number | null;
  open_interest: number | null;
  oi_change: number | null;
  implied_rate: number | null;
};

const NOMBRES: Record<string, string> = { SOJ: "Soja", MAI: "Maíz", TRI: "Trigo" };

// Tamaño del contrato de granos en Matba Rofex: 100 tn. Verificado 23/07/2026
// contra el CEM (apicem.matbarofex.com.ar/api/v1/totals): unitsVolume / volume
// = 100 para SOJ/MAI/TRI Dolar MATba en varios días reales.
export const CONTRATO_GRANO_TN = 100;

// JUL26 → 202607 ; DISPO (no matchea la regex) → 0, disponible primero. Ojo: un
// "DIS24" SÍ matchea → 202400 (comportamiento heredado, ver dates.ts#parsePosicion).
const vencKey = vencKeyDePosicion;

// La vista `_ultimo` trae el último cierre de CADA símbolo histórico (incluye
// posiciones ya vencidas como JUL21): para la pizarra vigente hay que descartar
// las muertas (venc < hoy) con `hoyVencKey()`.

const SOURCE = "Matba Rofex";

export const getCierresGranos = cache(async (): Promise<CierresData> => {
  const [res, vtos] = await Promise.all([
    sbSelect(
      "futuros_cierres_ultimo?select=symbol,fecha,underlying,posicion,settlement,close,change_percent,volume,open_interest,oi_change,implied_rate&order=underlying.asc",
      900,
    ),
    getVencimientos(),
  ]);

  if (!res.ok) {
    const problema =
      res.reason === "unconfigured"
        ? "Supabase sin configurar"
        : "Fuente de cierres caída (aún sin datos ingeridos)";
    return { granos: [], meta: { source: SOURCE, updatedAt: null, status: "parcial", problemas: [problema] } };
  }

  const raw = (Array.isArray(res.data) ? res.data : []) as RawRow[];
  const byGrano = new Map<string, GranoCierres>();

  for (const r of raw) {
    const u = r.underlying;
    if (!u || !NOMBRES[u]) continue; // solo soja/maíz/trigo
    let g = byGrano.get(u);
    if (!g) {
      g = { underlying: u, nombre: NOMBRES[u], fecha: r.fecha, posiciones: [] };
      byGrano.set(u, g);
    }
    if (r.fecha && (!g.fecha || r.fecha > g.fecha)) g.fecha = r.fecha;
    g.posiciones.push({
      symbol: r.symbol,
      posicion: r.posicion ?? r.symbol,
      settlement: r.settlement,
      close: r.close,
      changePercent: r.change_percent,
      volume: r.volume,
      openInterest: r.open_interest,
      oiChange: r.oi_change,
      impliedRate: r.implied_rate,
      venc: vencKey(r.posicion),
    });
  }

  const orden = ["SOJ", "MAI", "TRI"];
  const hoyYM = hoyVencKey();
  const hoy = hoyCordobaISO();
  const granos = [...byGrano.values()]
    .sort((a, b) => orden.indexOf(a.underlying) - orden.indexOf(b.underlying))
    .map((g) => ({
      ...g,
      // Disponible (venc 0) siempre + posiciones vivas. Con vencimiento real
      // conocido (tabla `vencimientos`) se usa la fecha exacta — así un contrato
      // que ya venció (ej. JUL26 el 24/07) deja de listarse aunque siga siendo
      // el mes en curso; A3 lo rechaza como inexistente en el feed en vivo si se
      // lo sigue pidiendo (ver a3-live.ts). Sin vencimiento cargado se cae a la
      // granularidad de MES de siempre, para no ocultar una posición real por un
      // hueco en `vencimientos` (ej. SOJ.ROS/AGO26, sin fila todavía).
      posiciones: g.posiciones
        .filter((p) => {
          if (p.venc === 0) return true;
          const vto = vtos.get(p.symbol);
          return vto ? vto >= hoy : p.venc >= hoyYM;
        })
        .sort((a, b) => a.venc - b.venc),
    }))
    .filter((g) => g.posiciones.length > 0);

  const fechas = granos.map((g) => g.fecha).filter(Boolean) as string[];
  const ultima = fechas.sort().at(-1) ?? null;
  const updatedAt = ultima ? Date.parse(`${ultima}T00:00:00-03:00`) : null;

  return {
    granos,
    meta: {
      source: SOURCE,
      updatedAt: Number.isNaN(updatedAt) ? null : updatedAt,
      status: granos.length > 0 ? "real" : "parcial",
      problemas: granos.length > 0 ? [] : ["Sin cierres cargados todavía"],
    },
  };
});

/**
 * Volumen operado del día en A3, sumando TODAS las posiciones vivas del grano
 * (venc > 0, mismo filtro de "posición futura" que usa el resto de la web —
 * ver futuros.ts/arbitrajes-cierres.ts). `null` si ninguna posición trajo volumen
 * (no confundir con 0: 0 es "hubo dato y no se operó nada").
 */
export function volumenTotalGrano(g: GranoCierres): number | null {
  const vols = g.posiciones.filter((p) => p.venc > 0).map((p) => p.volume).filter((v): v is number => v != null);
  if (vols.length === 0) return null;
  return vols.reduce((a, b) => a + b, 0);
}
