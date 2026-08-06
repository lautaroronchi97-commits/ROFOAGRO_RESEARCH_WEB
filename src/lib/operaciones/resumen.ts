import type { Matriz, Estado } from "./posicion";
import type { OperacionProducto } from "./tipos";

/**
 * Lib PURA del resumen ejecutivo (KPIs) de "Posición diaria" (mejora post-C31,
 * 06/08/2026 — vuelta 4): neto TOTAL de pricing por producto (mercadería con
 * precio + fijaciones + futuros A3, `construirMatrizPricing`), de un vistazo.
 * Pedido explícito de Lautaro: el KPI refleja el pricing, sin desglose
 * físico/futuros ni % de cobertura (los tenía antes, los sacó a propósito).
 * CERO fórmula nueva: sale de la misma `Matriz` que la tabla "Pricing
 * acumulado" ya muestra celda por celda.
 */

export type ResumenProducto = {
  producto: OperacionProducto;
  totalTn: number;
  estado: Estado;
};

export type ResumenPosicion = {
  /** Solo productos con actividad (pricing ≠ 0 en algún período), en el orden de la matriz. */
  productos: ResumenProducto[];
};

export function resumenPosicion(pricing: Matriz): ResumenPosicion {
  const productos: ResumenProducto[] = [];
  for (const fila of pricing.filas) {
    // "Con actividad" mira las CELDAS, no solo el total: un producto calzado
    // entre períodos (+100 Sep / −100 Nov → total 0) tiene que aparecer igual —
    // justamente en estado NEUTRO, la lectura más valiosa del resumen.
    const hayActividad = fila.total !== 0 || pricing.columnas.some((c) => (fila.porColumna[c.key] ?? 0) !== 0);
    if (!hayActividad) continue;
    productos.push({ producto: fila.producto, totalTn: fila.total, estado: fila.estado });
  }
  return { productos };
}
