import "server-only";
import { cache } from "react";
import { getCierresGranos } from "./futuros";
import { getPizarra } from "./pizarra";
import { getVencimientos } from "./vencimientos";
import { diasHasta } from "./dates";
import type { Meta } from "./market";

/**
 * Arbitrajes disponible (pizarra CAC) vs futuro (A3/CEM). Por cada posición viva
 * del grano se compara el ajuste del futuro contra la pizarra USD del disponible.
 *
 * Fórmulas (metodología confirmada, ver docs/CONTEXTO.md):
 *   spread  = ajuste_futuro − pizarra_usd                 [US$]
 *   directa = ajuste_futuro / pizarra_usd − 1             [% del período]
 *   TNA USD = directa × 365 / días_al_vto                 [%, anualizada]
 * Los días salen del vencimiento real de cada posición (tabla `vencimientos`,
 * fuente CEM). Si falta el vto de una posición, su TNA queda en null.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

export type ArbRow = {
  pos: string;
  symbol: string; // símbolo del futuro en A3, ej. "SOJ.ROS/JUL26" (clave del feed en vivo)
  ajuste: number | null; // settlement del futuro (USD)
  variacion: number | null; // variación diaria nominal del ajuste vs el cierre previo (US$)
  spread: number | null; // ajuste − pizarra
  directa: number | null; // ajuste/pizarra − 1, en %
  dias: number | null; // días hasta el vencimiento
  tna: number | null; // directa anualizada (365/días), en %
  volume: number | null; // volumen operado en el día (contratos)
  openInterest: number | null; // interés abierto de cierre (contratos)
};

export type ArbGrano = {
  underlying: string;
  nombre: string;
  fecha: string | null;
  pizarraUsd: number | null;
  pizarraArs: number | null;
  pizarraEstimativa: boolean; // CAC no fijó pizarra ese día (estimación Dto. 1058/99)
  rows: ArbRow[];
};

export type ArbData = { granos: ArbGrano[]; pizarraFecha: string | null; meta: Meta };

export const getArbitrajes = cache(async (): Promise<ArbData> => {
  const [cierres, pizarra, vtos] = await Promise.all([
    getCierresGranos(),
    getPizarra(),
    getVencimientos(),
  ]);

  const granos: ArbGrano[] = [];
  for (const g of cierres.granos) {
    const pz = pizarra.granos[g.underlying];
    const pizarraUsd = pz?.usd ?? null;
    const fut = g.posiciones.filter((p) => p.venc > 0);
    const rows: ArbRow[] = fut.map((p) => {
      const ajuste = p.settlement;
      const spread = ajuste != null && pizarraUsd != null ? round2(ajuste - pizarraUsd) : null;
      const directa =
        ajuste != null && pizarraUsd != null && pizarraUsd > 0
          ? round2((ajuste / pizarraUsd - 1) * 100)
          : null;
      const vto = vtos.get(p.symbol);
      const dias = vto ? diasHasta(vto) : null;
      const tna =
        directa != null && dias != null && dias > 0 ? round2((directa * 365) / dias) : null;
      return {
        pos: p.posicion,
        symbol: p.symbol,
        ajuste,
        variacion: p.change ?? null,
        spread,
        directa,
        dias,
        tna,
        volume: p.volume ?? null,
        openInterest: p.openInterest ?? null,
      };
    });
    if (rows.length > 0) {
      granos.push({
        underlying: g.underlying,
        nombre: g.nombre,
        fecha: g.fecha,
        pizarraUsd,
        pizarraArs: pz?.ars ?? null,
        pizarraEstimativa: pz?.estimativo ?? false,
        rows,
      });
    }
  }

  const hayCierres = granos.length > 0;
  const hayPizarra = Object.keys(pizarra.granos).length > 0;
  const problemas = [...cierres.meta.problemas, ...pizarra.meta.problemas];
  if (hayCierres && !hayPizarra) problemas.push("Sin pizarra CAC (spreads no disponibles)");
  if (!hayCierres) problemas.push("Sin cierres de A3");

  return {
    granos,
    pizarraFecha: pizarra.fecha,
    meta: {
      source: "Matba Rofex · Bolsa de Comercio de Rosario",
      updatedAt: cierres.meta.updatedAt,
      status: hayCierres && hayPizarra ? "real" : "parcial",
      problemas,
    },
  };
});
