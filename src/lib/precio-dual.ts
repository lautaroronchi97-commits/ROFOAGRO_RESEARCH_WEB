/**
 * Conversión $/USD cruzada para el patrón `precio-dual.tsx` (R4 del relevamiento
 * web, puntos 38-44): mismo criterio que el cross-cálculo de Arbitrajes
 * (`arbitrajes-editable.tsx`, R3, punto 25) — el TC preferido es el IMPLÍCITO de
 * la propia pizarra del grano (ars/usd del día), con el BNA online (`bna-online.ts`)
 * como respaldo cuando falta el ARS de pizarra ese día.
 */

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** TC implícito ars/usd de una pizarra. null si falta cualquiera de los dos o usd<=0. */
export function tcImplicito(ars: number | null, usd: number | null): number | null {
  return ars != null && usd != null && usd > 0 ? ars / usd : null;
}

export function arsDesdeUsd(usd: number, tc: number): number {
  return round2(usd * tc);
}

export function usdDesdeArs(ars: number, tc: number): number {
  return round2(ars / tc);
}
