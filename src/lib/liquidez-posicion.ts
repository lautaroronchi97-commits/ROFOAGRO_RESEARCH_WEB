/**
 * Criterio de liquidez de una posición de futuro (pedido de Lautaro, extraído de
 * `arbitrajes-table.tsx` en R3 para reusarlo en Pases — relevamiento 29/07, punto
 * 26): posiciones con poco interés abierto (< 100 contratos) son ruido salvo que
 * hayan operado HOY de verdad (volumen en vivo de A3, no el del último cierre,
 * que podría ser de una rueda vieja). Sin dato de OI (hueco del cierre) NO se
 * oculta — mismo criterio conservador del resto del filtrado de posiciones vivas.
 * Lib pura y sin `server-only`: testeable con Vitest.
 */

const UMBRAL_OI = 100;

export function esPosicionLiquida(args: { openInterest: number | null; operoHoy: boolean }): boolean {
  const { openInterest, operoHoy } = args;
  if (openInterest != null && openInterest < UMBRAL_OI && !operoHoy) return false;
  return true;
}
