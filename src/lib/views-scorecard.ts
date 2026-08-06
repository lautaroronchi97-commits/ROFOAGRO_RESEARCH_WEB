import type { GranoView, DireccionView, ViewMercado } from "./views-mercado";
import { vencKeyDePosicion, vtoDePosicion } from "./dates";

/**
 * views-scorecard.ts — PURO y sin `server-only` (mismo criterio que `derivadas.ts`/`sinteticos.ts`:
 * testeable sin Supabase). Mide, contra `futuros_cierres`, si cada view direccional (tabla
 * `views_mercado`) acertó — V1 de docs/PLAN_INFORMES_V2.md §5. La lectura/fetch vive en
 * `views-mercado.ts` (ya `server-only`), que junta las filas y llama a `calcularScorecard`.
 *
 * Metodología de contrato — FIJADA EN t0, NUNCA RE-ELEGIDA (fix de auditoría, crítico para que el
 * hit-rate/Brier de §11 sea confiable): "la posición más cercana" cambia con el tiempo — si el
 * scorecard re-eligiera "la más cercana" en cada fecha de medición, el retorno mediría en parte el
 * salto de rolleo (contango/backwardation) entre contratos, no el movimiento que la tesis predijo.
 * Acá la posición se elige UNA VEZ en `fecha` del view (`elegirPosicionT0`) y todas las ventanas
 * (1/2/4 semanas) miden ESA MISMA posición; si venció antes de la ventana, esa ventana degrada a
 * `null` con motivo "contrato_vencido" — nunca se sustituye por otra.
 */

export type FuturoCierreRow = { underlying: string; posicion: string; fecha: string; settlement: number };

/** `aceite_soja` no tiene futuro local en A3 (sin fila en `futuros_cierres`) — el ticker de
 *  abajo es un placeholder que nunca matchea un `underlying` real, así el scorecard de ese
 *  grano degrada siempre a `nMedidos: 0` en vez de mezclar el retorno de otro producto. */
export const GRANO_UNDERLYING: Record<GranoView, string> = { soja: "SOJ", maiz: "MAI", trigo: "TRI", aceite_soja: "SOJACEITE" };

const VENTANAS_DIAS = [7, 14, 28] as const;
/** Umbral de "sin movimiento" para que un view NEUTRAL cuente como acierto — provisorio, a calibrar
 *  con Lautaro contra los primeros scorecards reales (no hay un umbral de negocio definido todavía). */
const BANDA_NEUTRAL = 0.01;

export type MotivoVentana = "ok" | "contrato_vencido" | "sin_dato_aun";

export type VentanaScorecard = {
  dias: number;
  fechaObjetivo: string;
  retorno: number | null;
  acierto: boolean | null;
  motivo: MotivoVentana | null;
};

export type ScorecardView = {
  viewId: string;
  grano: GranoView;
  fecha: string;
  direccion: DireccionView;
  confianza: number;
  posicionT0: string | null;
  settlementT0: number | null;
  ventanas: VentanaScorecard[];
};

export type Racha = { tipo: "acierto" | "error"; largo: number };

export type ResumenGrano = {
  grano: GranoView;
  /** Views con la ventana de 4 semanas efectivamente medida (no null). */
  nMedidos: number;
  /** Hit-rate a 4 semanas sobre los medidos. null si nMedidos === 0. */
  hitRate: number | null;
  /** Brier promedio (confianza mapeada a probabilidad vs acierto), a 4 semanas. */
  brier: number | null;
  /** Racha de aciertos/errores consecutivos, del más reciente hacia atrás (ventana 4 semanas). */
  racha: Racha | null;
};

export type Scorecard = {
  porGrano: Record<GranoView, ResumenGrano>;
  porView: Record<string, ScorecardView>;
};

/** Exportada para `interpretaciones-scorecard.ts` (N14, PLAN_INFORMES_V3.md §9) — mismo cálculo
 *  de fecha objetivo, sin duplicar aritmética de fechas entre los dos scorecards. */
export function sumarDias(iso: string, dias: number): string {
  return new Date(new Date(`${iso}T12:00:00Z`).getTime() + dias * 86_400_000).toISOString().slice(0, 10);
}

/** Fila con `fecha` <= objetivo más cercana a esa fecha (el mercado no opera todos los días
 *  calendario). null si no hay ninguna fila en o antes del objetivo. */
function filaEnOAntes(rows: FuturoCierreRow[], objetivo: string): FuturoCierreRow | null {
  let mejor: FuturoCierreRow | null = null;
  for (const r of rows) {
    if (r.fecha <= objetivo && (!mejor || r.fecha > mejor.fecha)) mejor = r;
  }
  return mejor;
}

/**
 * Posición viva más cercana a `fechaT0` para un underlying (misma lógica que la curva de
 * `futuros.ts`: la de vencimiento más próximo que todavía no venció) — se fija UNA VEZ, ver
 * metodología arriba. null si no hay ninguna fila en o antes de `fechaT0`, o ninguna sigue viva.
 */
export function elegirPosicionT0(
  rowsUnderlying: FuturoCierreRow[],
  fechaT0: string,
): { posicion: string; settlement: number } | null {
  const fechasDisponibles = [...new Set(rowsUnderlying.map((r) => r.fecha))].filter((f) => f <= fechaT0).sort();
  const fechaRef = fechasDisponibles.at(-1);
  if (!fechaRef) return null;

  const vivas = rowsUnderlying
    .filter((r) => r.fecha === fechaRef && vtoDePosicion(r.posicion) >= fechaT0)
    .sort((a, b) => vencKeyDePosicion(a.posicion) - vencKeyDePosicion(b.posicion));
  const elegida = vivas[0];
  return elegida ? { posicion: elegida.posicion, settlement: elegida.settlement } : null;
}

/** Mide la MISMA posición fijada en t0, `dias` después. Nunca re-elige otra posición. */
export function medirVentana(
  rowsUnderlying: FuturoCierreRow[],
  posicionT0: string,
  settlementT0: number,
  fechaT0: string,
  dias: number,
): VentanaScorecard {
  const fechaObjetivo = sumarDias(fechaT0, dias);
  const vto = vtoDePosicion(posicionT0);
  if (vto && vto < fechaObjetivo) {
    return { dias, fechaObjetivo, retorno: null, acierto: null, motivo: "contrato_vencido" };
  }

  const rowsPos = rowsUnderlying.filter((r) => r.posicion === posicionT0);
  const ultimaDisponible = rowsPos.reduce((max, r) => (r.fecha > max ? r.fecha : max), "");
  if (!ultimaDisponible || ultimaDisponible < fechaObjetivo) {
    return { dias, fechaObjetivo, retorno: null, acierto: null, motivo: "sin_dato_aun" };
  }

  const fila = filaEnOAntes(rowsPos, fechaObjetivo);
  if (!fila) return { dias, fechaObjetivo, retorno: null, acierto: null, motivo: "sin_dato_aun" };

  return { dias, fechaObjetivo, retorno: fila.settlement / settlementT0 - 1, acierto: null, motivo: "ok" };
}

/** "levemente_X" = misma dirección que X, menor convicción (V3, N2/§7.1) — cuenta como esa
 *  misma dirección para el hit-rate; solo la probabilidad de Brier se acota distinto (abajo). */
function esLeve(direccion: DireccionView): boolean {
  return direccion === "levemente_alcista" || direccion === "levemente_bajista";
}

/** ¿La dirección del view acertó ese retorno? null si no hay retorno medido. */
export function esAcierto(direccion: DireccionView, retorno: number | null): boolean | null {
  if (retorno === null) return null;
  if (direccion === "alcista" || direccion === "levemente_alcista") return retorno > 0;
  if (direccion === "bajista" || direccion === "levemente_bajista") return retorno < 0;
  return Math.abs(retorno) <= BANDA_NEUTRAL;
}

/**
 * Confianza 1-5 → probabilidad estimada de acierto. Direcciones plenas (alcista/bajista/neutral):
 * mapeo lineal 1→0.55 … 5→0.95 (rango histórico, sin cambios). Direcciones "leves" (V3, N2/§7.1,
 * menor convicción por diseño): mapeo más chato 1→0.55 … 5→0.75 — provisorio, a calibrar como la
 * banda neutral (mismo criterio que `BANDA_NEUTRAL` arriba).
 */
export function confianzaAProbabilidad(confianza: number, direccion: DireccionView = "alcista"): number {
  const c = Math.min(5, Math.max(1, confianza));
  return esLeve(direccion) ? 0.55 + 0.05 * (c - 1) : 0.45 + 0.1 * c;
}

/** Brier de una ventana: (probabilidad − resultado)². null si la ventana no tiene acierto medido. */
export function brierDeVentana(direccion: DireccionView, confianza: number, retorno: number | null): number | null {
  const acierto = esAcierto(direccion, retorno);
  if (acierto === null) return null;
  const p = confianzaAProbabilidad(confianza, direccion);
  return (p - (acierto ? 1 : 0)) ** 2;
}

/** Scorecard de un único view contra la serie de su underlying. */
export function calcularScorecardView(
  view: Pick<ViewMercado, "id" | "grano" | "fecha" | "direccion" | "confianza">,
  rowsUnderlying: FuturoCierreRow[],
): ScorecardView {
  const t0 = elegirPosicionT0(rowsUnderlying, view.fecha);
  const ventanas: VentanaScorecard[] = VENTANAS_DIAS.map((dias) => {
    if (!t0) {
      return { dias, fechaObjetivo: sumarDias(view.fecha, dias), retorno: null, acierto: null, motivo: null };
    }
    const v = medirVentana(rowsUnderlying, t0.posicion, t0.settlement, view.fecha, dias);
    return { ...v, acierto: esAcierto(view.direccion, v.retorno) };
  });

  return {
    viewId: view.id,
    grano: view.grano,
    fecha: view.fecha,
    direccion: view.direccion,
    confianza: view.confianza,
    posicionT0: t0?.posicion ?? null,
    settlementT0: t0?.settlement ?? null,
    ventanas,
  };
}

function resumirGrano(grano: GranoView, vistas: ScorecardView[]): ResumenGrano {
  const medidos = vistas
    .map((v) => ({ v, w28: v.ventanas.find((w) => w.dias === 28) ?? null }))
    .filter((x): x is { v: ScorecardView; w28: VentanaScorecard } => x.w28 !== null && x.w28.acierto !== null)
    .sort((a, b) => (a.v.fecha < b.v.fecha ? 1 : a.v.fecha > b.v.fecha ? -1 : 0)); // desc por fecha

  if (medidos.length === 0) return { grano, nMedidos: 0, hitRate: null, brier: null, racha: null };

  const aciertos = medidos.filter((x) => x.w28.acierto).length;
  const hitRate = aciertos / medidos.length;

  const briers = medidos
    .map((x) => brierDeVentana(x.v.direccion, x.v.confianza, x.w28.retorno))
    .filter((b): b is number => b !== null);
  const brier = briers.length > 0 ? briers.reduce((a, b) => a + b, 0) / briers.length : null;

  const tipo: Racha["tipo"] = medidos[0]!.w28.acierto ? "acierto" : "error";
  let largo = 0;
  for (const x of medidos) {
    if ((tipo === "acierto") !== !!x.w28.acierto) break;
    largo++;
  }

  return { grano, nMedidos: medidos.length, hitRate, brier, racha: { tipo, largo } };
}

/** Scorecard completo: todos los views (vigentes + historial) contra todas las filas de `futuros_cierres`. */
export function calcularScorecard(
  views: Pick<ViewMercado, "id" | "grano" | "fecha" | "direccion" | "confianza">[],
  rows: FuturoCierreRow[],
): Scorecard {
  const porView: Record<string, ScorecardView> = {};
  const rowsPorGrano: Record<GranoView, ScorecardView[]> = { soja: [], maiz: [], trigo: [], aceite_soja: [] };

  for (const v of views) {
    const underlying = GRANO_UNDERLYING[v.grano];
    const rowsU = rows.filter((r) => r.underlying === underlying);
    const sc = calcularScorecardView(v, rowsU);
    porView[v.id] = sc;
    rowsPorGrano[v.grano].push(sc);
  }

  const porGrano = Object.fromEntries(
    (Object.keys(rowsPorGrano) as GranoView[]).map((g) => [g, resumirGrano(g, rowsPorGrano[g])]),
  ) as Record<GranoView, ResumenGrano>;

  return { porGrano, porView };
}
