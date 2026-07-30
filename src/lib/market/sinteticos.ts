import "server-only";
import { cache } from "react";
import type { Meta } from "./types";
import { getLecaps } from "./lecaps";
import { getDolarFuturo } from "./dolar-futuro";
import { sbSelect } from "../supabase";
import { hoyOperativoMs } from "../dates";
import {
  emparejarSinteticos,
  type LetraIn,
  type PosicionIn,
  type SinteticoRow,
} from "../sinteticos";

/* ---------------- Módulo 6: Sintéticos LECAP + dólar futuro (backlog C13 / P9) ---------------- */

export type { SinteticoRow } from "../sinteticos";

export type SinteticosData = {
  spot: number | null; // oficial mayorista MAE (mismo que dólar futuro)
  rows: SinteticoRow[];
  meta: Meta;
};

/**
 * "Pago final por letra" — fuente: carga SEMI-MANUAL en `/admin/datos` (tabla `lecap_pago_final`).
 * El pago final se fija en la emisión/licitación de la letra y NO cambia día a día (solo cuando el
 * Tesoro emite letras nuevas, cada 1-2 meses); el precio diario ya lo trae data912 (`lecaps.ts`).
 * BYMA es la fuente última del dato (verificado: los "Pago Final" del Excel de Lautaro coinciden 1:1
 * con lo que publica BYMA) pero no expone un endpoint público parseable con el importe al
 * vencimiento; IAMC (informeslecap) es un PDF diario frágil. Por eso, mismo patrón que DEA-SAGyP y
 * camiones/Williams: Lautaro carga los valores a mano. Ver docs/sesiones/2026-07-24-c13-sinteticos-tir.md.
 */
type PagoFinalRow = { ticker: string; pago_final: number | string };

async function getPagoFinalMap(): Promise<{ map: Record<string, number>; ok: boolean }> {
  const r = await sbSelect("lecap_pago_final?select=ticker,pago_final", 3600);
  if (!r.ok || !Array.isArray(r.data)) return { map: {}, ok: false };
  const map: Record<string, number> = {};
  for (const it of r.data as PagoFinalRow[]) {
    const ticker = String(it.ticker ?? "").toUpperCase();
    const pf = typeof it.pago_final === "string" ? Number(it.pago_final) : it.pago_final;
    if (ticker && Number.isFinite(pf) && pf > 0) map[ticker] = pf;
  }
  return { map, ok: true };
}

export const getSinteticos = cache(async (): Promise<SinteticosData> => {
  const [lecaps, df, pf] = await Promise.all([getLecaps(), getDolarFuturo(), getPagoFinalMap()]);
  const now = Date.now();

  const letras: LetraIn[] = lecaps.lecaps.map((l) => ({
    symbol: l.symbol,
    px: l.px,
    vencMs: l.venc,
  }));
  const posiciones: PosicionIn[] = df.posiciones.map((p) => ({
    label: p.label,
    precio: p.ultimo,
    vencMs: p.fecha,
  }));

  const rows = emparejarSinteticos(df.spot, letras, posiciones, pf.map, hoyOperativoMs());

  const problemas: string[] = [];
  if (df.spot === null) problemas.push("oficial MAE caído (sin sintético)");
  if (!df.posiciones.length) problemas.push("MAE DDF caído (sin dólar futuro)");
  if (!lecaps.lecaps.length) problemas.push("data912 caído (sin precios de letras)");

  const conPagoFinal = rows.filter((r) => r.pagoFinal !== null).length;
  if (pf.ok && Object.keys(pf.map).length === 0) {
    problemas.push("falta cargar el pago final por letra en /admin/datos");
  } else if (rows.length > 0 && conPagoFinal < rows.length) {
    problemas.push(`pago final pendiente en ${rows.length - conPagoFinal} letra(s)`);
  }

  // "real" solo si hay al menos un sintético completo; si no, "parcial" (degrada honesto).
  const status: Meta["status"] =
    conPagoFinal > 0 && df.spot !== null ? "real" : "parcial";

  return {
    spot: df.spot,
    rows,
    meta: { source: "Mercado de deuda local · MAE", updatedAt: now, status, problemas },
  };
});
