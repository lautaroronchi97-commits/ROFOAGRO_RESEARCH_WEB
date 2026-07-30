import "server-only";
import { cache } from "react";
import { getCierresGranos } from "./futuros";
import { getVencimientos } from "./vencimientos";
import { diasEntre } from "./dates";
import type { Meta } from "./market";

/**
 * Pases (spreads de calendario) de futuros de granos, derivados de los cierres
 * reales de Supabase (`futuros_cierres`, fuente CEM · Matba ROFEX).
 *
 * Un "pase" es la diferencia de precio entre dos posiciones del mismo grano
 * (vender la corta / comprar la larga). Se arman DOS familias (decisión de
 * Lautaro, auditoría E2 21/07/2026): la posición cercana (la primera viva)
 * contra cada posición más lejana, y además los pases CONSECUTIVOS entre
 * posiciones intermedias (SEP/NOV, NOV/MAY…). Se calcula sobre el
 * ajuste (settlement), el precio de liquidación oficial del día: siempre existe
 * aunque la posición no opere, así que es el más robusto.
 *
 * Columnas y su fórmula (confirmadas en `pases.ts`, hoja PASES del Excel):
 *   - ajuste  = settlement(larga) − settlement(cercana)          [US$]
 *   - directa = settlement(larga) / settlement(cercana) − 1      [% del período]
 *   - tna     = directa × 365 / días_entre_vencimientos          [%, anualizada]
 *   - ultimo  = close(larga) − close(cercana)                    [US$, si ambas operaron]
 * Los días salen de los vencimientos reales de cada posición (tabla
 * `vencimientos`, fuente CEM). Si falta un vto, la TNA de ese pase queda null.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

export type PaseSpread = {
  label: string; // "JUL26 / DIC26"
  spreadSymbol: string; // instrumento de pase en A3, ej. "SOJ.ROS/JUL26/DIC26" (clave del feed en vivo)
  ajuste: number | null; // settlement(larga) − settlement(cercana)
  directa: number | null; // settlement(larga) / settlement(cercana) − 1, en %
  tna: number | null; // directa anualizada (365/días entre vtos), en %
  dias: number | null; // días entre vencimientos
  ultimo: number | null; // close(larga) − close(cercana), solo si ambas operaron
};

export type PaseGrano = {
  underlying: string;
  nombre: string;
  fecha: string | null;
  spreads: PaseSpread[];
};

export type PasesData = { granos: PaseGrano[]; meta: Meta };

/**
 * `liquidaSymbol`, si se pasa, filtra las posiciones candidatas ANTES de armar los
 * pares — mismo criterio de liquidez que Arbitrajes (relevamiento 29/07, punto 26):
 * si una posición se oculta allá (OI<100 sin operar hoy), no debe aparecer como pata
 * de ningún pase acá. Depende de datos en vivo de A3 (`operoHoy`), por eso no vive
 * adentro de esta lib pura — el caller (`pases-panel.tsx`) arma el predicado con
 * `getFuturosLive()` y lo inyecta.
 */
export const getPases = cache(async (liquidaSymbol?: (symbol: string, openInterest: number | null) => boolean): Promise<PasesData> => {
  const [{ granos, meta }, vtos] = await Promise.all([getCierresGranos(), getVencimientos()]);

  type Pos = { symbol: string; posicion: string; settlement: number | null; close: number | null };
  const armarPase = (corta: Pos, larga: Pos): PaseSpread => {
    const pc = corta.settlement;
    const pl = larga.settlement;
    const ajuste = pc != null && pl != null ? round2(pl - pc) : null;
    const directa = pc != null && pc > 0 && pl != null ? round2((pl / pc - 1) * 100) : null;
    const ultimo =
      corta.close && larga.close && corta.close > 0 && larga.close > 0
        ? round2(larga.close - corta.close)
        : null;
    const vc = vtos.get(corta.symbol);
    const vl = vtos.get(larga.symbol);
    const dias = vc && vl ? diasEntre(vc, vl) : null;
    const tna = directa != null && dias != null && dias > 0 ? round2((directa * 365) / dias) : null;
    return {
      label: `${corta.posicion} / ${larga.posicion}`,
      // Símbolo del pase real en A3: root de la corta + posición de la larga.
      spreadSymbol: `${corta.symbol}/${larga.posicion}`,
      ajuste,
      directa,
      tna,
      dias,
      ultimo,
    };
  };

  const out: PaseGrano[] = [];
  for (const g of granos) {
    // Solo futuros con vencimiento (excluye disponible, venc = 0), ya en orden de vto.
    // Sin `liquidaSymbol`, no se filtra por liquidez (comportamiento previo intacto).
    const fut = g.posiciones
      .filter((p) => p.venc > 0)
      .filter((p) => !liquidaSymbol || liquidaSymbol(p.symbol, p.openInterest ?? null));
    const spreads: PaseSpread[] = [];
    // 1) Posición cercana (la primera viva) contra cada posición más lejana.
    const cercana = fut[0];
    if (cercana) {
      for (let j = 1; j < fut.length; j++) {
        const larga = fut[j];
        if (larga) spreads.push(armarPase(cercana, larga));
      }
    }
    // 2) Pases consecutivos entre intermedias (el par 0/1 ya salió arriba).
    for (let i = 1; i + 1 < fut.length; i++) {
      const corta = fut[i];
      const larga = fut[i + 1];
      if (corta && larga) spreads.push(armarPase(corta, larga));
    }
    if (spreads.length > 0) {
      out.push({ underlying: g.underlying, nombre: g.nombre, fecha: g.fecha, spreads });
    }
  }

  const hayDatos = out.length > 0;
  return {
    granos: out,
    meta: {
      source: "Matba Rofex",
      updatedAt: meta.updatedAt,
      status: hayDatos ? "real" : "parcial",
      problemas: hayDatos
        ? []
        : meta.problemas.length
          ? meta.problemas
          : ["Sin cierres para calcular pases"],
    },
  };
});
