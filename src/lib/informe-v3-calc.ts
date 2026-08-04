import { diasEntre } from "./dates";
import type { MonitorRow } from "./monitor-mercados";

/**
 * informe-v3-calc.ts — cálculos PUROS de los insumos nuevos de informes v3 (E1 de
 * docs/PLAN_INFORMES_V3.md §10), separados de sus wrappers `server-only` (que hacen el fetch a
 * Supabase/A3) para poder testear con Vitest sin tocar red — mismo patrón que
 * `views-scorecard.ts`/`pas-zonas-calc.ts`/`camiones/matriz.ts`. Nunca inventa un dato: si falta
 * el punto de comparación, el campo correspondiente queda `null` (regla dura del proyecto).
 */

export type PuntoValor = { fecha: string; valor: number };

export type DeltaSerie = {
  actual: number | null;
  previo: number | null;
  deltaPct: number | null;
  fechaActual: string | null;
  fechaPrevia: string | null;
};

const DELTA_VACIO: DeltaSerie = { actual: null, previo: null, deltaPct: null, fechaActual: null, fechaPrevia: null };

/** ISO menos `dias` días calendario (UTC, sin corrimiento de huso). */
export function restarDiasISO(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Variación entre el último punto disponible (≤ hastaISO) y el punto de la misma serie más
 * cercano a `diasAtras` días antes de ese último — generaliza "Δ vs ayer" (`diasAtras=1`, pizarra
 * diaria) y "Δ vs hace ~7/28 días" (macro semanal) con la lógica de "fecha más cercana" que ya usa
 * `informe-semanal.ts` para no asumir que el mercado operó exactamente esa cantidad de días atrás
 * (fines de semana, feriados). `null` si no hay ningún otro punto para comparar.
 */
export function calcularDeltaSerie(puntos: PuntoValor[], hastaISO: string, diasAtras: number): DeltaSerie {
  const disponibles = puntos.filter((p) => p.fecha <= hastaISO).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  if (disponibles.length === 0) return DELTA_VACIO;
  const ultimo = disponibles[disponibles.length - 1]!; // length>0 recién chequeado

  let mejor: PuntoValor | null = null;
  let mejorDist = Infinity;
  for (const p of disponibles) {
    if (p.fecha === ultimo.fecha) continue;
    const dist = Math.abs(diasEntre(p.fecha, ultimo.fecha) - diasAtras);
    if (dist < mejorDist) {
      mejor = p;
      mejorDist = dist;
    }
  }
  if (!mejor) {
    return { actual: ultimo.valor, previo: null, deltaPct: null, fechaActual: ultimo.fecha, fechaPrevia: null };
  }
  return {
    actual: ultimo.valor,
    previo: mejor.valor,
    deltaPct: mejor.valor !== 0 ? (ultimo.valor / mejor.valor - 1) * 100 : null,
    fechaActual: ultimo.fecha,
    fechaPrevia: mejor.fecha,
  };
}

/* ---------------- Top 3 por volumen (informe diario, bloque C) ---------------- */

export type FilaVolumen = {
  posicion: string;
  ajuste: number | null;
  ajusteFuente: "vivo" | "cierre_anterior";
  deltaPct: number | null;
  volumen: number | null;
};

export type Top3Grano = { underlying: string; top3: FilaVolumen[]; volumenTotal: number | null };

/** Agrupa por underlying, ordena por volumen desc y recorta a 3 + el volumen total del producto
 *  (todas las posiciones con volumen, no solo el top 3). */
export function elegirTop3PorVolumen(filas: (FilaVolumen & { underlying: string })[]): Top3Grano[] {
  const porGrano = new Map<string, (FilaVolumen & { underlying: string })[]>();
  for (const f of filas) {
    const g = porGrano.get(f.underlying) ?? [];
    g.push(f);
    porGrano.set(f.underlying, g);
  }
  return [...porGrano.entries()].map(([underlying, fs]) => {
    const conVolumen = fs.filter((f) => f.volumen != null);
    const ordenadas = [...conVolumen].sort((a, b) => (b.volumen ?? 0) - (a.volumen ?? 0));
    const volumenTotal = conVolumen.length > 0 ? conVolumen.reduce((s, f) => s + (f.volumen ?? 0), 0) : null;
    return { underlying, top3: ordenadas.slice(0, 3), volumenTotal };
  });
}

/* ---------------- Ventana semanal (BCRA/camiones — semanal, bloque comercio exterior) ---------------- */

export type VentanaSuma = {
  totalActual: number | null;
  totalPrevio: number | null;
  deltaPct: number | null;
  nActual: number;
  nPrevio: number;
};

/** Suma de `puntos` en los últimos `dias` (≤ hastaISO) vs los `dias` inmediatamente anteriores —
 *  primitiva genérica reusada por el acumulado semanal de compras BCRA y de camiones. */
export function sumaVentana(puntos: PuntoValor[], hastaISO: string, dias = 7): VentanaSuma {
  const desdeActual = restarDiasISO(hastaISO, dias - 1);
  const hastaPrevio = restarDiasISO(desdeActual, 1);
  const desdePrevio = restarDiasISO(hastaPrevio, dias - 1);

  const actual = puntos.filter((p) => p.fecha >= desdeActual && p.fecha <= hastaISO);
  const previo = puntos.filter((p) => p.fecha >= desdePrevio && p.fecha <= hastaPrevio);

  return {
    totalActual: actual.length > 0 ? actual.reduce((s, p) => s + p.valor, 0) : null,
    totalPrevio: previo.length > 0 ? previo.reduce((s, p) => s + p.valor, 0) : null,
    deltaPct:
      actual.length > 0 && previo.length > 0 && previo.reduce((s, p) => s + p.valor, 0) !== 0
        ? (actual.reduce((s, p) => s + p.valor, 0) / previo.reduce((s, p) => s + p.valor, 0) - 1) * 100
        : null,
    nActual: actual.length,
    nPrevio: previo.length,
  };
}

/* ---------------- Volumen A3 semanal por underlying ---------------- */

export type VolumenUnderlying = { underlying: string; volumen: number | null; nRuedas: number };

/** Suma el volumen de TODAS las posiciones de cada underlying en las últimas `ruedas` fechas
 *  distintas de ESE underlying (≤ hastaISO) — el calendario de ruedas se calcula por grano, no
 *  global: si faltó una rueda por feriado, no cuenta como 0. */
export function volumenPorUnderlying(
  filas: { underlying: string; fecha: string; volume: number | null }[],
  hastaISO: string,
  ruedas = 5,
): VolumenUnderlying[] {
  const porGrano = new Map<string, { underlying: string; fecha: string; volume: number | null }[]>();
  for (const f of filas) {
    if (f.fecha > hastaISO) continue;
    const g = porGrano.get(f.underlying) ?? [];
    g.push(f);
    porGrano.set(f.underlying, g);
  }
  return [...porGrano.entries()].map(([underlying, fs]) => {
    const fechasDisponibles = [...new Set(fs.map((f) => f.fecha))].sort();
    const ultimasFechas = new Set(fechasDisponibles.slice(-ruedas));
    const conVolumen = fs.filter((f) => ultimasFechas.has(f.fecha) && f.volume != null);
    return {
      underlying,
      volumen: conVolumen.length > 0 ? conVolumen.reduce((s, f) => s + (f.volume ?? 0), 0) : null,
      nRuedas: ultimasFechas.size,
    };
  });
}

/* ---------------- Otros mercados relevantes (informe diario, bloque internacional §5.1 E) ---------------- */

/**
 * "Otros mercados" del bloque internacional del diario: solo entran si superan el umbral de
 * relevancia — propuesta del plan (§5.3) ≥3% en WTI/oro/plata/DXY/real (los 5 instrumentos "de
 * commodities/FX" del monitor; SPY/Merval/EWZ/Maní quedan fuera de este condicional, son
 * referencia de otro tipo). Regla determinística de TEMPLATE (no de la skill): mismo dato, mismo
 * criterio siempre — a diferencia de los condicionales DJVE/camiones, que sí dependen de
 * contexto/redacción y por eso los decide la skill.
 */
const OTROS_MERCADOS_NOMBRES = ["Petróleo WTI", "Oro", "Plata", "Dólar (DXY)", "Real (USD/BRL)"];

export function otrosMercadosRelevantes(macro: MonitorRow[], umbralPct = 3): MonitorRow[] {
  return macro.filter(
    (r) => OTROS_MERCADOS_NOMBRES.includes(r.nombre) && r.deltaPct != null && Math.abs(r.deltaPct) >= umbralPct,
  );
}

/* ---------------- Desacople local vs internacional (view, §7.2) ---------------- */

export type PuntoPremio = { fecha: string | null; a3: number | null; cbot: number | null; premioUsdTn: number | null };
export type Desacople = { hoy: PuntoPremio; hace7d: PuntoPremio; hace28d: PuntoPremio };

/** Punto con fecha ≤ objetivo más cercano a esa fecha (el mercado no opera todos los días). */
function valorEnOAntes(puntos: PuntoValor[], objetivo: string): PuntoValor | null {
  let mejor: PuntoValor | null = null;
  for (const p of puntos) {
    if (p.fecha <= objetivo && (!mejor || p.fecha > mejor.fecha)) mejor = p;
  }
  return mejor;
}

/** Premio/descuento A3 vs CBOT (misma unidad USD/tn, ya convertida por el caller) hoy y hace
 *  1/4 semanas — responde "¿el precio local y el internacional van de la mano o se desprenden?". */
export function calcularDesacople(a3: PuntoValor[], cbot: PuntoValor[], hastaISO: string): Desacople {
  const armar = (objetivo: string): PuntoPremio => {
    const pa3 = valorEnOAntes(a3, objetivo);
    const pcbot = valorEnOAntes(cbot, objetivo);
    return {
      fecha: pa3?.fecha ?? pcbot?.fecha ?? null,
      a3: pa3?.valor ?? null,
      cbot: pcbot?.valor ?? null,
      premioUsdTn: pa3 && pcbot ? pa3.valor - pcbot.valor : null,
    };
  };
  return {
    hoy: armar(hastaISO),
    hace7d: armar(restarDiasISO(hastaISO, 7)),
    hace28d: armar(restarDiasISO(hastaISO, 28)),
  };
}
