import type { ChartTablaColumna, ChartTablaFila } from "@/components/chart-tabla";
import type { Matriz } from "./posicion";
import { PRODUCTO_LABEL, type OperacionProducto } from "./tipos";

/**
 * Transforma una `Matriz` (posicion.ts) al formato de `ChartTabla` — reusa el
 * componente de tabla/export CSV ya existente en el sitio en vez de construir
 * uno nuevo (docs/PLAN_OPERACIONES_CLIENTES.md §3). `import type` a propósito:
 * este archivo NO es "use client", solo toma los tipos de un componente que sí
 * lo es.
 */

/** "+150,00" / "−70,00" / "—" (§2: "+ comprado / − vendido", como la hoja de Mauro). */
export function fmtNeto(n: number): string {
  if (n === 0) return "—";
  const abs = Math.abs(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n > 0 ? "+" : "−"}${abs}`;
}

export function matrizAColumnas(matriz: Matriz): ChartTablaColumna[] {
  return [
    { key: "producto", label: "Producto", align: "left" },
    ...matriz.columnas.map((c) => ({ key: c.key, label: c.label })),
    { key: "total", label: "Total" },
    { key: "estado", label: "Estado" },
  ];
}

/** `filtro` (opcional) acota a un solo producto — la fila TOTAL sigue siendo la de toda la matriz. */
export function matrizAFilas(matriz: Matriz, filtro?: OperacionProducto): ChartTablaFila[] {
  const filas = filtro ? matriz.filas.filter((f) => f.producto === filtro) : matriz.filas;
  const rows: ChartTablaFila[] = filas.map((f) => {
    const fila: ChartTablaFila = { producto: PRODUCTO_LABEL[f.producto], total: fmtNeto(f.total), estado: f.estado };
    for (const c of matriz.columnas) fila[c.key] = fmtNeto(f.porColumna[c.key] ?? 0);
    return fila;
  });
  const totalFila: ChartTablaFila = { producto: "TOTAL", total: fmtNeto(matriz.totalGeneral), estado: "" };
  for (const c of matriz.columnas) totalFila[c.key] = fmtNeto(matriz.totalPorColumna[c.key] ?? 0);
  rows.push(totalFila);
  return rows;
}

/** La fila de TOTAL, para el prop `destacada` de `ChartTabla`. */
export function esFilaTotal(fila: ChartTablaFila): boolean {
  return fila.producto === "TOTAL";
}

/** Columnas numéricas de una `Matriz` (períodos + total) — para `ChartTabla.columnasSigno`
 *  (pedido de Lautoro 05/08/2026: verde el neto comprado, rojo el neto vendido). */
export function columnasSignoDe(matriz: Matriz): string[] {
  return [...matriz.columnas.map((c) => c.key), "total"];
}

/** Para `ChartTabla.columnasEstado` (COMPRADOS/VENDIDOS con el mismo color). */
export const COLUMNA_ESTADO = ["estado"];
