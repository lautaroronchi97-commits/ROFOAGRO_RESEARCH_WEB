import type { GranoView } from "./views-mercado";
import {
  GRANO_UNDERLYING,
  elegirPosicionT0,
  medirVentana,
  esAcierto,
  sumarDias,
  type FuturoCierreRow,
  type VentanaScorecard,
} from "./views-scorecard";
import type { Impacto, ImpactoGrano } from "./interpretaciones";

/**
 * interpretaciones-scorecard.ts — PURO (sin `server-only`, testeable con Vitest pelado — mismo
 * criterio que `views-scorecard.ts`). N14 de docs/PLAN_INFORMES_V3.md §3/§9: mide si el `impacto`
 * por grano de cada interpretación (tabla `interpretaciones`, columna `impacto` de E1) acertó,
 * contra `futuros_cierres` a **7 y 14 días** (N14 pide esas dos ventanas, más cortas que las de
 * `views-scorecard.ts` porque una interpretación reacciona a UN evento puntual, no a una tesis de
 * varias semanas).
 *
 * Reusa `elegirPosicionT0`/`medirVentana`/`esAcierto` de `views-scorecard.ts` tal cual: `t0` se fija
 * en `fecha_publicacion` del informe (día del evento) y NUNCA se re-elige — mismo motivo que el
 * scorecard del view: si se re-eligiera "la posición más cercana" en cada fecha de medición, el
 * retorno mediría en parte el salto de rolleo entre contratos, no el movimiento que el impacto
 * predijo. `ImpactoGrano` ("alcista"|"neutral"|"bajista") comparte los 3 mismos valores literales
 * que `DireccionView`, así que `esAcierto` se reusa sin adaptar ni castear nada.
 */

const VENTANAS_DIAS = [7, 14] as const;

export type VentanaImpacto = VentanaScorecard;

export type ScorecardGranoInterp = {
  grano: GranoView;
  impacto: ImpactoGrano;
  posicionT0: string | null;
  settlementT0: number | null;
  ventanas: VentanaImpacto[];
};

export type ScorecardInterpretacion = {
  interpretacionId: string;
  fechaPublicacion: string;
  porGrano: ScorecardGranoInterp[];
};

const GRANOS_VALIDOS = new Set<string>(Object.keys(GRANO_UNDERLYING));

function esGranoValido(g: string): g is GranoView {
  return GRANOS_VALIDOS.has(g);
}

/**
 * Scorecard de UNA interpretación, para todos los granos presentes en su `impacto` (los que el
 * reporte tocó — normalmente 1-3). `rows` son TODAS las filas de `futuros_cierres` de los 3
 * underlyings (SOJ/MAI/TRI), sin filtrar por grano — se filtra acá adentro, por grano.
 */
export function calcularScorecardInterpretacion(
  interp: { id: string; fecha_publicacion: string; impacto: Impacto },
  rows: FuturoCierreRow[],
): ScorecardInterpretacion {
  const porGrano: ScorecardGranoInterp[] = [];

  for (const [grano, impacto] of Object.entries(interp.impacto)) {
    if (!impacto || !esGranoValido(grano)) continue;
    const underlying = GRANO_UNDERLYING[grano];
    const rowsU = rows.filter((r) => r.underlying === underlying);
    const t0 = elegirPosicionT0(rowsU, interp.fecha_publicacion);

    const ventanas: VentanaImpacto[] = VENTANAS_DIAS.map((dias) => {
      if (!t0) {
        return {
          dias,
          fechaObjetivo: sumarDias(interp.fecha_publicacion, dias),
          retorno: null,
          acierto: null,
          motivo: null,
        };
      }
      const v = medirVentana(rowsU, t0.posicion, t0.settlement, interp.fecha_publicacion, dias);
      return { ...v, acierto: esAcierto(impacto, v.retorno) };
    });

    porGrano.push({
      grano,
      impacto,
      posicionT0: t0?.posicion ?? null,
      settlementT0: t0?.settlement ?? null,
      ventanas,
    });
  }

  return { interpretacionId: interp.id, fechaPublicacion: interp.fecha_publicacion, porGrano };
}

export type ResumenScorecardInterp = {
  n7: number;
  hitRate7: number | null;
  n14: number;
  hitRate14: number | null;
};

function resumirVentana(scorecards: ScorecardInterpretacion[], dias: 7 | 14): { n: number; hitRate: number | null } {
  const medidas = scorecards
    .flatMap((s) => s.porGrano.flatMap((g) => g.ventanas))
    .filter((v) => v.dias === dias && v.acierto !== null);
  if (medidas.length === 0) return { n: 0, hitRate: null };
  const aciertos = medidas.filter((v) => v.acierto).length;
  return { n: medidas.length, hitRate: aciertos / medidas.length };
}

/** Resumen agregado (todas las interpretaciones, todos los granos) para la fila de
 *  `/admin/interpretaciones` — "qué tan bien leemos los reportes", N14. */
export function resumirScorecardInterpretaciones(scorecards: ScorecardInterpretacion[]): ResumenScorecardInterp {
  const w7 = resumirVentana(scorecards, 7);
  const w14 = resumirVentana(scorecards, 14);
  return { n7: w7.n, hitRate7: w7.hitRate, n14: w14.n, hitRate14: w14.hitRate };
}
