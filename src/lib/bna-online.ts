/**
 * "Dólar BNA online" (relevamiento 29/07, puntos 25/40/47): aproximación en vivo del
 * comprador BNA a partir del oficial mayorista MAE, útil el resto del día mientras no
 * está publicado el BNA de las 15hs. Offset confirmado por Lautaro — constante en
 * código, no configurable desde /admin (si algún día cambia, es un PR de una línea).
 * Cuando el BNA de las 15hs YA está confirmado (`tcBna` de CAC, ver `pizarra.ts`), ese
 * valor pisa a esta aproximación — la usan `negocios-con-pagos` y `negocios-de-planta`.
 */
export const BNA_OFFSET = 9;

export function getBnaOnline(oficialMayorista: number): number {
  return oficialMayorista - BNA_OFFSET;
}
