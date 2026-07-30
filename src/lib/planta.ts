/**
 * Calculadora "Negocios de planta": arranca de un precio (pizarra del grano
 * elegido, editable) y le va restando rubros de descuento hasta el precio final.
 * Todo en USD, aritmética local (no toca datos de mercado).
 *
 * Rubros: contra flete · secada (fijo = puntos × valor único; no fijo = un valor
 * propio por cada punto, relevamiento web punto 47) · merma volátil (% sobre el
 * precio de arranque) · paritaria · embolsado · otros (varios conceptos, punto 47).
 */

/** 5 USD por punto de humedad (valor fijo por defecto de la secada). */
export const VALOR_PUNTO_FIJO = 5;

export type OtroItem = { label: string; valor: number };

export type RubrosPlanta = {
  arranque: number;
  flete: number;
  secadaModo: "fijo" | "libre";
  puntos: number;
  /** USD/punto único, usado solo en modo "fijo". */
  valorPunto: number;
  /** Un valor USD por cada punto (1º, 2º, 3º…), usado solo en modo "libre". */
  valoresPorPunto: number[];
  pctMerma: number;
  paritaria: number;
  embolsado: number;
  otros: OtroItem[];
};

export type ResultadoPlanta = {
  dFlete: number;
  dSecada: number;
  dMerma: number;
  dParitaria: number;
  dEmbolsado: number;
  dOtros: number;
  totalGastos: number;
  /** arranque − totalGastos; NaN si el arranque no es un precio válido (>0). */
  final: number;
};

export function calcularPlanta(r: RubrosPlanta): ResultadoPlanta {
  const arranqueOk = Number.isFinite(r.arranque) && r.arranque > 0;
  const dSecada =
    r.secadaModo === "fijo"
      ? r.puntos * r.valorPunto
      : r.valoresPorPunto.reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0);
  const dMerma = arranqueOk ? (r.arranque * r.pctMerma) / 100 : 0;
  const dOtros = r.otros.reduce((a, o) => a + (Number.isFinite(o.valor) ? o.valor : 0), 0);
  const totalGastos = r.flete + dSecada + dMerma + r.paritaria + r.embolsado + dOtros;
  const final = arranqueOk ? r.arranque - totalGastos : NaN;
  return {
    dFlete: r.flete,
    dSecada,
    dMerma,
    dParitaria: r.paritaria,
    dEmbolsado: r.embolsado,
    dOtros,
    totalGastos,
    final,
  };
}
