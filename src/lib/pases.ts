/**
 * Cotizador de pases (spread entre la posición vendida —cercana— y la comprada
 * —lejana— de un mismo grano).
 *
 * Corrección de fórmula (relevamiento web 29/07, punto 42, confirmada con el
 * ejemplo ±10 de Lautaro): el pase se arma cuando la cercana vale MÁS que la
 * lejana — el signo estaba invertido (`larga − corta` daba +10 donde el
 * negocio real da −10). Solo el PASE (spread cliente-facing) cambia de signo;
 * la tasa directa y la TNA (informativas, tasa del carry) quedan iguales.
 *
 *   pase          = precio_cercana (vendida) − precio_lejana (comprada)
 *   tasa directa  = precio_lejana / precio_cercana − 1                 (× 100)
 *   TNA USD       = (precio_lejana / precio_cercana − 1) × 365/días    (días entre posiciones)
 */

export function pase(precioCorta: number, precioLarga: number): number {
  return precioCorta - precioLarga;
}

export function tasaDirectaPase(precioCorta: number, precioLarga: number): number {
  return precioCorta > 0 ? (precioLarga / precioCorta - 1) * 100 : NaN;
}

export function tnaPase(precioCorta: number, precioLarga: number, dias: number): number {
  return precioCorta > 0 && dias > 0 ? (precioLarga / precioCorta - 1) * (365 / dias) * 100 : NaN;
}
