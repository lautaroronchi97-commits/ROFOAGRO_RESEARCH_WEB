import type { Matriz, Estado } from "./posicion";
import { totalGeneral, type FuturoValorizado } from "./futuros-valorizados";
import type { OperacionProducto } from "./tipos";

/**
 * Lib PURA del resumen ejecutivo de "Mi posición" (mejora post-C31, 06/08/2026):
 * condensa lo que las 3 matrices ya calculan en una lectura de un vistazo por
 * producto — neto total en tn, desglose físico/futuros y estado — más el
 * resultado a hoy del panel de futuros valorizado. CERO fórmula nueva: todo
 * sale de `Matriz` (posicion.ts) y `FuturoValorizado[]` (futuros-valorizados.ts),
 * los mismos números que las tablas de abajo muestran celda por celda.
 */

export type CoberturaEstado = "cubierto" | "sobre_cubierto" | "sin_cobertura" | "sin_fisico";

export type ResumenProducto = {
  producto: OperacionProducto;
  fisicoTn: number;
  futurosTn: number;
  totalTn: number;
  estado: Estado;
  /** % del físico cubierto por futuros en sentido opuesto (0-100), `null` si no aplica (sin físico). */
  pctCalzado: number | null;
  coberturaEstado: CoberturaEstado;
};

/**
 * % de calzado (pedido de Lautaro 06/08/2026): cuánto del físico está cubierto
 * por una posición de futuros en sentido OPUESTO (comprado físico + vendido
 * futuro, o vendido físico + comprado futuro — la definición de cobertura).
 * Signo igual en físico y futuros NO es cobertura, es exposición que se suma
 * (ej. comprado físico Y comprado futuro = doble exposición alcista) → se
 * marca `sin_cobertura`, nunca se computa un % que sugiera protección donde no
 * la hay. Sin físico no hay nada que cubrir → `sin_fisico`, `pctCalzado: null`.
 */
export function calcularCobertura(fisicoTn: number, futurosTn: number): { pct: number | null; estado: CoberturaEstado } {
  if (fisicoTn === 0) return { pct: null, estado: "sin_fisico" };
  const sentidoOpuesto = (fisicoTn > 0 && futurosTn < 0) || (fisicoTn < 0 && futurosTn > 0);
  if (!sentidoOpuesto) return { pct: 0, estado: "sin_cobertura" };
  const pct = redondear((Math.min(Math.abs(futurosTn), Math.abs(fisicoTn)) / Math.abs(fisicoTn)) * 100);
  return { pct, estado: Math.abs(futurosTn) > Math.abs(fisicoTn) ? "sobre_cubierto" : "cubierto" };
}

export type ResumenPosicion = {
  /** Solo productos con actividad (físico o futuros ≠ 0), en el orden de la matriz. */
  productos: ResumenProducto[];
  /** Resultado a hoy de los futuros valorizados (suma de los `valorizado`), `null` si ninguno valorizó. */
  resultadoFuturosUsd: number | null;
  /** Contratos de futuro que NO pudieron valorizarse (sin ajuste vigente o moneda ≠ USD). */
  futurosSinValorizar: number;
};

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resumenPosicion(fisico: Matriz, total: Matriz, futurosValorizados: FuturoValorizado[]): ResumenPosicion {
  const productos: ResumenProducto[] = [];
  for (const filaTotal of total.filas) {
    const filaFisico = fisico.filas.find((f) => f.producto === filaTotal.producto);
    const fisicoTn = filaFisico?.total ?? 0;
    const futurosTn = redondear(filaTotal.total - fisicoTn);
    // "Con actividad" mira las CELDAS, no solo los totales: un producto calzado
    // entre períodos (+100 Sep / −100 Nov → total 0) tiene que aparecer igual —
    // justamente en estado NEUTRO, la lectura más valiosa del resumen.
    const hayActividad =
      fisicoTn !== 0 || futurosTn !== 0 || total.columnas.some((c) => (filaTotal.porColumna[c.key] ?? 0) !== 0);
    if (!hayActividad) continue;
    const cobertura = calcularCobertura(fisicoTn, futurosTn);
    productos.push({
      producto: filaTotal.producto,
      fisicoTn,
      futurosTn,
      totalTn: filaTotal.total,
      estado: filaTotal.estado,
      pctCalzado: cobertura.pct,
      coberturaEstado: cobertura.estado,
    });
  }

  return {
    productos,
    resultadoFuturosUsd: totalGeneral(futurosValorizados),
    futurosSinValorizar: futurosValorizados.filter((f) => f.estado !== "valorizado").length,
  };
}
