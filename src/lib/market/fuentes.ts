import "server-only";
import { cache } from "react";
import { fetchJson, asArr, asObj, asNum, asStr } from "./http";

/* ---------------- fuentes crudas de terceros ---------------- */

export type DolarApiRow = { casa: string; venta: number };

export const getDolarApi = cache(async (): Promise<DolarApiRow[] | null> => {
  const r = await fetchJson("https://dolarapi.com/v1/dolares");
  if (!r.ok) return null;
  const arr = asArr(r.data);
  if (!arr) return null;
  const rows: DolarApiRow[] = [];
  for (const it of arr) {
    const o = asObj(it);
    if (!o) continue;
    const casa = asStr(o.casa);
    const venta = asNum(o.venta);
    if (casa && venta !== null) rows.push({ casa, venta });
  }
  return rows.length ? rows : null;
});

export type CriptoyaQuote = { price: number | null; variation: number | null };

export const getCriptoya = cache(async (): Promise<Record<string, CriptoyaQuote> | null> => {
  const r = await fetchJson("https://criptoya.com/api/dolar");
  if (!r.ok) return null;
  const o = asObj(r.data);
  if (!o) return null;
  const out: Record<string, CriptoyaQuote> = {};
  for (const [k, v] of Object.entries(o)) {
    const q = asObj(v);
    if (q) out[k] = { price: asNum(q.price), variation: asNum(q.variation) };
  }
  return Object.keys(out).length ? out : null;
});

export type MaeResumenRow = {
  ticker: string;
  ultimo: number;
  variacion: number | null;
  cantidad: number | null;
  plazo: string | null;
};

export const getMaeResumen = cache(async (seg: "DDF" | "FOR"): Promise<MaeResumenRow[] | null> => {
  const r = await fetchJson(`https://api.marketdata.mae.com.ar/api/mercado/resumen/${seg}`);
  if (!r.ok) return null;
  const arr = asArr(r.data);
  if (!arr) return null;
  const rows: MaeResumenRow[] = [];
  for (const it of arr) {
    const o = asObj(it);
    if (!o) continue;
    const ticker = asStr(o.ticker);
    const ultimo = asNum(o.ultimo);
    if (ticker && ultimo !== null && ultimo > 0) {
      rows.push({
        ticker,
        ultimo,
        variacion: asNum(o.variacion),
        cantidad: asNum(o.cantidad),
        plazo: asStr(o.plazo),
      });
    }
  }
  return rows.length ? rows : null;
});

export type NoteRow = {
  symbol: string;
  c: number | null;
  px_bid: number | null;
  px_ask: number | null;
  pct_change: number | null;
  v: number | null;
};

export const getNotes = cache(async (): Promise<NoteRow[] | null> => {
  const r = await fetchJson("https://data912.com/live/arg_notes");
  if (!r.ok) return null;
  const arr = asArr(r.data);
  if (!arr) return null;
  const rows: NoteRow[] = [];
  for (const it of arr) {
    const o = asObj(it);
    if (!o) continue;
    const symbol = asStr(o.symbol);
    if (!symbol) continue;
    rows.push({
      symbol,
      c: asNum(o.c),
      px_bid: asNum(o.px_bid),
      px_ask: asNum(o.px_ask),
      pct_change: asNum(o.pct_change),
      v: asNum(o.v),
    });
  }
  return rows.length ? rows : null;
});

/**
 * `arg_bonds` — títulos públicos de data912 (misma forma de fila que `arg_notes`). Los BONCAPs
 * (T15E7, T30A7, T31Y7, T30J7…) cotizan ACÁ, no en `arg_notes`: data912 los clasifica como
 * "título" (bono), no como "letra" (nota) — a diferencia de las LECAP (S*), que sí son notas.
 */
export const getBonds = cache(async (): Promise<NoteRow[] | null> => {
  const r = await fetchJson("https://data912.com/live/arg_bonds");
  if (!r.ok) return null;
  const arr = asArr(r.data);
  if (!arr) return null;
  const rows: NoteRow[] = [];
  for (const it of arr) {
    const o = asObj(it);
    if (!o) continue;
    const symbol = asStr(o.symbol);
    if (!symbol) continue;
    rows.push({
      symbol,
      c: asNum(o.c),
      px_bid: asNum(o.px_bid),
      px_ask: asNum(o.px_ask),
      pct_change: asNum(o.pct_change),
      v: asNum(o.v),
    });
  }
  return rows.length ? rows : null;
});

/**
 * Dólar oficial mayorista MAE = ticker "UST$T" en resumen/FOR, plazo "000" (T+0).
 * El resumen trae DOS filas UST$T (000 = contado inmediato, 001 = T+1); la referencia
 * es el T+0 (decisión de Lautaro, auditoría E2 21/07/2026).
 * Referencia para dólar futuro (spot) y dólar linked (ajuste). Uso 100% interno:
 * NO se re-exporta desde la fachada `src/lib/market.ts`.
 */
export const getMaeOficial = cache(
  async (): Promise<{ valor: number | null; varPct: number | null }> => {
    const rows = await getMaeResumen("FOR");
    const ust =
      rows?.find((r) => r.ticker === "UST$T" && r.plazo === "000") ??
      rows?.find((r) => r.ticker === "UST$T") ??
      rows?.find((r) => r.ticker.startsWith("UST$"));
    return { valor: ust?.ultimo ?? null, varPct: ust?.variacion ?? null };
  },
);
