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

export type ResumenProducto = {
  producto: OperacionProducto;
  fisicoTn: number;
  futurosTn: number;
  totalTn: number;
  estado: Estado;
};

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
    productos.push({
      producto: filaTotal.producto,
      fisicoTn,
      futurosTn,
      totalTn: filaTotal.total,
      estado: filaTotal.estado,
    });
  }

  return {
    productos,
    resultadoFuturosUsd: totalGeneral(futurosValorizados),
    futurosSinValorizar: futurosValorizados.filter((f) => f.estado !== "valorizado").length,
  };
}
