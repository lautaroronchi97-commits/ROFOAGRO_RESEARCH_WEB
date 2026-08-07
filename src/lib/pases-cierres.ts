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
 * (vender la corta / comprar la larga). Se calcula sobre el ajuste
 * (settlement), el precio de liquidación oficial del día: siempre existe aunque
 * la posición no opere, así que es el más robusto.
 *
 * QUÉ PARES SE MUESTRAN (fix 07/08/2026, feedback de Lautaro sobre soja/maíz —
 * "hacer ajuste de posiciones"): soja y maíz pasan a una lista FIJA de pares
 * canónicos por MES (nunca por año, para no congelarse al vencer — mismo
 * criterio que `fijar-canon.ts`), resueltos contra la curva viva; trigo queda
 * con el algoritmo anterior (marcado "ok" por Lautaro): la posición cercana (la
 * primera viva) contra cada posición más lejana + los pases CONSECUTIVOS entre
 * posiciones intermedias.
 *
 * Columnas y su fórmula (confirmadas en `pases.ts`, hoja PASES del Excel):
 *   - ajuste  = settlement(larga) − settlement(cercana)          [US$]
 *   - directa = settlement(larga) / settlement(cercana) − 1      [% del período]
 *   - tna     = directa × 365 / días_entre_vencimientos          [%, anualizada]
 *   - ultimo  = close(larga) − close(cercana)                    [US$, si ambas operaron]
 * Los días salen de los vencimientos reales de cada posición (tabla
 * `vencimientos`, fuente CEM). Si falta un vto, la TNA de ese pase queda null.
 */

/**
 * Pares fijos por grano (mes/mes, sin año) — feedback 07/08/2026: soja SEP/NOV,
 * NOV/MAY (cruza a la campaña siguiente), MAY/JUL; maíz SEP/DIC, DIC/ABR (cruza
 * campaña), ABR/JUL. Un grano ausente de este mapa (trigo) usa el algoritmo
 * anterior, sin cambios.
 */
const PARES_CANONICOS: Record<string, [string, string][]> = {
  SOJ: [
    ["SEP", "NOV"],
    ["NOV", "MAY"],
    ["MAY", "JUL"],
  ],
  MAI: [
    ["SEP", "DIC"],
    ["DIC", "ABR"],
    ["ABR", "JUL"],
  ],
};

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
    const vivo = g.posiciones.filter((p) => p.venc > 0);
    const spreads: PaseSpread[] = [];
    const paresFijos = PARES_CANONICOS[g.underlying];
    if (paresFijos) {
      // Pares fijos por mes (soja/maíz): estas son las posiciones que Lautaro pidió ver
      // siempre — SIN el filtro de liquidez (que existe para no ensuciar la generación
      // combinatoria del algoritmo viejo, no para ocultar un par que se pidió explícito).
      // Para cada par [mesCorta, mesLarga], toma la ocurrencia viva más próxima de
      // mesCorta y, de mesLarga, la más próxima que venza DESPUÉS de esa (resuelve solo
      // el cruce de campaña — NOV26/MAY27, no hace falta hardcodear el año). Si alguna
      // pata no está viva, el par no sale (nunca se inventa).
      for (const [mesCorta, mesLarga] of paresFijos) {
        const corta = vivo.filter((p) => p.posicion.toUpperCase().startsWith(mesCorta))[0];
        if (!corta) continue;
        const larga = vivo
          .filter((p) => p.posicion.toUpperCase().startsWith(mesLarga) && p.venc > corta.venc)
          .sort((a, b) => a.venc - b.venc)[0];
        if (!larga) continue;
        spreads.push(armarPase(corta, larga));
      }
    } else {
      // Algoritmo anterior (trigo, sin cambios): posición cercana (la primera viva)
      // contra cada posición más lejana + pases consecutivos entre intermedias. Acá
      // SÍ se filtra por liquidez (comportamiento previo intacto).
      const fut = vivo.filter((p) => !liquidaSymbol || liquidaSymbol(p.symbol, p.openInterest ?? null));
      const cercana = fut[0];
      if (cercana) {
        for (let j = 1; j < fut.length; j++) {
          const larga = fut[j];
          if (larga) spreads.push(armarPase(cercana, larga));
        }
      }
      for (let i = 1; i + 1 < fut.length; i++) {
        const corta = fut[i];
        const larga = fut[i + 1];
        if (corta && larga) spreads.push(armarPase(corta, larga));
      }
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
