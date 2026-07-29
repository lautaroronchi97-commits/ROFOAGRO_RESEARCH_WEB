import "server-only";
import { cache } from "react";
import { getMonitorMercados } from "../monitor-mercados";
import type { Meta } from "./types";
import { getDolarApi, getMaeResumen, getMaeOficial, type MaeResumenRow } from "./fuentes";
import { parseDdf } from "./tickers";

/* ---------------- Módulo 0: Cinta ---------------- */

export type CintaItem = {
  label: string;
  value: number | null;
  decimals: number;
  change: number | null; // variación diaria en %
  source: string;
  sample?: boolean; // true = dato de ejemplo (sin fuente automatizada aún)
};

export type CintaData = { items: CintaItem[]; meta: Meta };

export const getCintaData = cache(async (): Promise<CintaData> => {
  // Relevamiento 29/07 (punto 24): sin pizarras en la cinta; UNA sola entrada de
  // oficial = spot mayorista MAE; + macro del monitor (petróleo/oro/plata/real/S&P/
  // Merval). `getMonitorMercados()` ya está cacheado por render → cero fetch extra
  // cuando la home también lo usa.
  const [dolar, ddf, mae, monitor] = await Promise.all([
    getDolarApi(),
    getMaeResumen("DDF"),
    getMaeOficial(),
    getMonitorMercados(),
  ]);

  const problemas: string[] = [];
  if (!dolar) problemas.push("dolarapi caído (MEP/CCL)");
  if (mae.valor === null) problemas.push("MAE caído (oficial mayorista)");
  if (!ddf) problemas.push("MAE caído (dólar futuro)");

  const byCasa = (casa: string) => dolar?.find((d) => d.casa === casa) ?? null;

  // Macro/referencias del monitor, por símbolo (label corto para la banda).
  const MACRO_CINTA: Array<{ yahoo: string; label: string }> = [
    { yahoo: "CL=F", label: "Petróleo" },
    { yahoo: "GC=F", label: "Oro" },
    { yahoo: "SI=F", label: "Plata" },
    { yahoo: "BRL=X", label: "Real" },
    { yahoo: "SPY", label: "S&P 500" },
    { yahoo: "^MERV", label: "Merval" },
  ];
  const macroItems: CintaItem[] = MACRO_CINTA.map(({ yahoo, label }) => {
    const r = monitor.macro.find((m) => m.yahoo === yahoo) ?? null;
    return {
      label,
      value: r?.ultimo ?? null,
      decimals: r?.unidadDec ?? 2,
      change: r?.deltaPct ?? null,
      source: r?.mercado ?? "Mercados internacionales",
    };
  });
  if (macroItems.every((i) => i.value === null)) problemas.push("monitor caído (referencias)");

  // Posición de dólar futuro más cercana (a hoy) del resumen DDF
  const now = Date.now();
  const fut = (ddf ?? [])
    .map((r) => ({ row: r, p: parseDdf(r.ticker) }))
    .filter((x): x is { row: MaeResumenRow; p: { label: string; venc: Date } } => x.p !== null)
    .filter((x) => x.p.venc.getTime() >= now - 40 * 86400000)
    .sort((a, b) => a.p.venc.getTime() - b.p.venc.getTime())[0];

  const items: CintaItem[] = [
    {
      // "Oficial" = spot mayorista MAE (UST$T), la referencia de las fórmulas del sitio.
      label: "Oficial",
      value: mae.valor,
      decimals: 2,
      change: mae.varPct,
      source: "MAE",
    },
    { label: "MEP", value: byCasa("bolsa")?.venta ?? null, decimals: 2, change: null, source: "Mercado de cambios" },
    { label: "CCL", value: byCasa("contadoconliqui")?.venta ?? null, decimals: 2, change: null, source: "Mercado de cambios" },
    {
      label: fut ? `Fut ${fut.p.label}` : "Dólar futuro",
      value: fut?.row.ultimo ?? null,
      decimals: 2,
      change: fut?.row.variacion ?? null,
      source: "MAE",
    },
    ...macroItems,
  ];

  return {
    items,
    meta: {
      source: "Mercado de cambios",
      updatedAt: Date.now(),
      status: problemas.length === 0 ? "real" : "parcial",
      problemas,
    },
  };
});
