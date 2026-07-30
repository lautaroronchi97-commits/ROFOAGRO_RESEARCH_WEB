/**
 * Cobertura exportadora — puerto de la lógica de señales de `cobertura.py` de
 * LineUps_Code. Compara lo DECLARADO (DJVE) contra lo ORIGINADO (line-up) para
 * detectar quién está corto (presión compradora / alcista FAS) o sobre-originado
 * (bajista).
 *
 * Calibración (lote L4, auditoría E7, 23/07/2026): el corte fijo 0.7/1.3 heredado
 * literal del Python NUNCA se validó contra la distribución real acá — se verificó por
 * SQL contra `lineup_gap_hist` (3,5 años de historia real) que dispara señal (ratio<0.7)
 * el 74-95% de los días según el producto (maíz 94,7% · trigo 80,3% · soja poroto
 * 73,8%): no es una señal, es casi el estado por defecto. Reemplazado por
 * `umbralesPorPercentil`: el corte de cada producto sale del P25/P75 de SU PROPIA
 * historia (mismo criterio que ya usa el percentil estacional del índice MESA en
 * `mesa_calor.ts`/`estacional.ts`), decisión de Lautaro. RATIO_CORTO/RATIO_SOBRE_ORIGEN
 * quedan como FALLBACK para cuando no hay historia suficiente (o para tests).
 */

export const RATIO_CORTO = 0.7; // fallback sin historia suficiente
export const RATIO_SOBRE_ORIGEN = 1.3; // fallback sin historia suficiente
export const DECLARADO_MIN_SIGNIFICATIVO = 5_000; // tn mínimas para emitir señal (ambos lados — ver senalDe)
// Mínimo de observaciones históricas para confiar en un percentil (≈2 meses de fotos diarias).
export const MIN_MUESTRA_PERCENTIL = 60;
export const PERCENTIL_BAJO = 25;
export const PERCENTIL_ALTO = 75;

export type SenalTag = "ALCISTA FAS" | "BAJISTA" | "NEUTRO";
export type Senal = { tag: SenalTag; intensidad: number; racional: string };
export type UmbralesCobertura = { ratioCorto: number; ratioSobreOrigen: number };

const UMBRALES_DEFAULT: UmbralesCobertura = { ratioCorto: RATIO_CORTO, ratioSobreOrigen: RATIO_SOBRE_ORIGEN };

/** Percentil por interpolación lineal (mismo método que `percentile_cont` de Postgres). */
function percentilLineal(valoresAsc: number[], p: number): number {
  const n = valoresAsc.length;
  if (n === 0) return NaN;
  if (n === 1) return valoresAsc[0]!; // n===1 recién chequeado
  const idx = (p / 100) * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  // p en [0,100] → idx en [0,n-1] → lo/hi (floor/ceil de idx) siempre en [0,n-1].
  if (lo === hi) return valoresAsc[lo]!;
  return valoresAsc[lo]! + (valoresAsc[hi]! - valoresAsc[lo]!) * (idx - lo);
}

/**
 * Umbrales por percentil histórico (P25/P75 por defecto) de una serie de ratios
 * originado/declarado. Cae a `RATIO_CORTO`/`RATIO_SOBRE_ORIGEN` si hay menos de
 * `MIN_MUESTRA_PERCENTIL` observaciones válidas (producto nuevo o sin historia).
 */
export function umbralesPorPercentil(
  ratiosHistoricos: number[],
  pBajo = PERCENTIL_BAJO,
  pAlto = PERCENTIL_ALTO,
): UmbralesCobertura {
  const validos = ratiosHistoricos.filter((r) => Number.isFinite(r) && r >= 0).sort((a, b) => a - b);
  if (validos.length < MIN_MUESTRA_PERCENTIL) return UMBRALES_DEFAULT;
  return {
    ratioCorto: percentilLineal(validos, pBajo),
    ratioSobreOrigen: percentilLineal(validos, pAlto),
  };
}

/**
 * Ratio de cobertura = originado / declarado, con los mismos bordes que cobertura.py:
 *  - declarado ≤ 0 y originado > 0 → Infinity (todo originado, nada declarado)
 *  - declarado ≤ 0 y originado ≤ 0 → null (sin dato)
 */
export function ratioCobertura(declarado: number, originado: number): number | null {
  if (declarado <= 0) return originado > 0 ? Infinity : null;
  return originado / declarado;
}

/** Intensidad 1-5 por el valor absoluto de la falta a cubrir (mismos cortes que cobertura.py). */
export function intensidad(faltaCubrir: number): number {
  const a = Math.abs(faltaCubrir);
  if (a < 60_000) return 1;
  if (a < 180_000) return 2;
  if (a < 360_000) return 3;
  if (a < 720_000) return 4;
  return 5;
}

/**
 * Señal de una fila (declarado vs originado), contra los umbrales del producto
 * (default = el fallback fijo, para productos sin historia suficiente):
 *  - ALCISTA FAS: ratio < umbrales.ratioCorto (declaró fuerte pero no puso barcos → compra).
 *  - BAJISTA: ratio > umbrales.ratioSobreOrigen (originó de más → demanda agotada).
 *  - NEUTRO: el resto.
 * El mínimo de `declarado` protege AMBOS lados (lote L4: antes solo protegía el lado
 * alcista — un producto con poco volumen podía marcar BAJISTA sin piso alguno).
 */
export function senalDe(declarado: number, originado: number, umbrales: UmbralesCobertura = UMBRALES_DEFAULT): Senal {
  const ratio = ratioCobertura(declarado, originado);
  const falta = declarado - originado;
  const significativo = declarado >= DECLARADO_MIN_SIGNIFICATIVO;
  if (ratio !== null && ratio < umbrales.ratioCorto && significativo) {
    return {
      tag: "ALCISTA FAS",
      intensidad: intensidad(falta),
      racional: "Declaró fuerte pero todavía no puso barcos: le falta originar → presión compradora sobre el FAS.",
    };
  }
  if (ratio !== null && ratio > umbrales.ratioSobreOrigen && significativo) {
    return {
      tag: "BAJISTA",
      intensidad: intensidad(falta),
      racional: "Ya originó más de lo declarado a esta ventana: demanda de corto agotada.",
    };
  }
  return { tag: "NEUTRO", intensidad: 0, racional: "Declarado y originado en línea." };
}

/** Formatea el ratio como % es-AR (Infinity → "∞", null → "—"). Relevamiento web R8, punto 55:
 *  antes mostraba el ratio crudo (ej. "0.87"); ahora "87%", más legible de un vistazo. */
export function ratioFmt(r: number | null): string {
  if (r === null) return "—";
  if (!Number.isFinite(r)) return "∞";
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(r * 100)}%`;
}
