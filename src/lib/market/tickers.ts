import { MESES_ES } from "../dates";

/**
 * Parsing de tickers de dólar futuro (A3) y dólar linked (bonos AR).
 *  - `parseDdf`: ticker "DLR<mm><yyyy>" → label + vencimiento aproximado (último
 *    día CALENDARIO del mes; A3 liquida el último día HÁBIL — para precisión real
 *    usar la tabla `vencimientos`, ej. curva.ts).
 *  - `vencFromTicker`: vencimiento inferido del propio ticker de bonos AR
 *    (ej. "D30S6" → 30/sep/2026; "S31L6" → LECAP; "T30J7" → BONCAP, mismo formato de ticker).
 */

export function parseDdf(ticker: string): { label: string; venc: Date } | null {
  const m = /^DLR(\d{2})(\d{4})$/.exec(ticker);
  if (!m) return null;
  const mm = Number(m[1]);
  const yy = Number(m[2]);
  if (mm < 1 || mm > 12 || yy < 2000 || yy > 2100) return null;
  return { label: `${MESES_ES[mm - 1]}${String(yy).slice(2)}`, venc: new Date(yy, mm, 0) };
}

// Código de mes en tickers argentinos: E F M A Y J L G S O N D. Familia
// relacionada con MESES_ES (letra única en vez de abreviatura de 3 letras) pero
// NO duplicado literal — queda fuera de la unificación (E4 hallazgo #11).
const MONTH_LETTER: Record<string, number> = {
  E: 0, F: 1, M: 2, A: 3, Y: 4, J: 5, L: 6, G: 7, S: 8, O: 9, N: 10, D: 11,
};

export function vencFromTicker(sym: string): number | null {
  // D = dólar linked, S = LECAP, T = BONCAP (bono capitalizable del Tesoro).
  const m = /^[DST](\d{2})([EFMAYJLGSOND])(\d)$/.exec(sym);
  if (!m) return null;
  const day = Number(m[1]);
  if (day < 1 || day > 31) return null;
  // m[2] matcheó la clase [EFMAYJLGSOND] del regex → siempre es una clave válida de MONTH_LETTER.
  const month = MONTH_LETTER[m[2]!]!;
  const year = 2020 + Number(m[3]);
  return new Date(year, month, day).getTime();
}
