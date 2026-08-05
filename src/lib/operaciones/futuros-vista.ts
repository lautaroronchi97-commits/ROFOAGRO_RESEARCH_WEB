import type { ChartTablaColumna, ChartTablaFila } from "@/components/chart-tabla";
import { fmtNeto } from "./matriz-vista";
import type { FuturoValorizado } from "./futuros-valorizados";
import { totalesPorProducto, totalGeneral } from "./futuros-valorizados";
import { PRODUCTO_LABEL, PRODUCTOS_CON_FUTURO, type OperacionProducto } from "./tipos";

/**
 * Transforma `FuturoValorizado[]` (futuros-valorizados.ts) al formato de
 * `ChartTabla` (§5.5, Fase 2) — mismo patrón que matriz-vista.ts, pero acá cada
 * fila es UN contrato (no una celda de matriz agregada): se agrupan por
 * producto con un subtotal por grupo y un TOTAL general al pie, marcados con
 * `destacada` vía el campo interno `_destacada` (no es una columna real, solo
 * lo lee `futuroEsFilaDestacada`).
 */

const ESTADO_LABEL: Record<FuturoValorizado["estado"], string> = {
  valorizado: "Vigente",
  sin_ajuste_vigente: "Sin ajuste vigente",
  moneda_no_usd: "Sin TC (moneda $)",
};

const LADO_LABEL = { compra: "Compra", venta: "Venta" } as const;

function fechaAR(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function fmtMoneda(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function futurosValorizadosAColumnas(): ChartTablaColumna[] {
  return [
    { key: "posicion", label: "Posición", align: "left" },
    { key: "lado", label: "Lado", align: "left" },
    { key: "volumen", label: "Vol. (tn)" },
    { key: "precio", label: "Precio ejecución (USD)" },
    { key: "ajuste", label: "Ajuste hoy (USD)" },
    { key: "resultado", label: "Resultado (USD)" },
    { key: "estado", label: "Estado", align: "left" },
  ];
}

/** `filtro` (opcional) acota a un solo producto. Devuelve también si hubo algún volumen no múltiplo de 100 (para la nota al pie). */
export function futurosValorizadosAFilas(
  filas: FuturoValorizado[],
  filtro?: OperacionProducto,
): { rows: ChartTablaFila[]; hayNoMultiplo: boolean } {
  const base = filtro ? filas.filter((f) => f.producto === filtro) : filas;
  const rows: ChartTablaFila[] = [];
  let hayNoMultiplo = false;

  const productos = filtro ? [filtro] : PRODUCTOS_CON_FUTURO;
  for (const p of productos) {
    const deEsteProducto = base.filter((f) => f.producto === p).sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (deEsteProducto.length === 0) continue;

    for (const f of deEsteProducto) {
      if (!f.multiploDeContrato) hayNoMultiplo = true;
      rows.push({
        posicion: f.posicionA3,
        lado: LADO_LABEL[f.lado],
        volumen: `${fmtMoneda(f.volumenTn)}${f.multiploDeContrato ? "" : " *"}`,
        precio: fmtMoneda(f.precioEjecucion),
        ajuste: fmtMoneda(f.ajusteHoy),
        resultado: f.estado === "valorizado" ? fmtNeto(f.resultadoUsd ?? 0) : "—",
        estado: `${ESTADO_LABEL[f.estado]}${f.fecha ? ` · ${fechaAR(f.fecha)}` : ""}`,
      });
    }

    if (!filtro && productos.length > 1) {
      const subtotal = totalesPorProducto(deEsteProducto)[p];
      rows.push({
        posicion: `Subtotal ${PRODUCTO_LABEL[p]}`,
        lado: "",
        volumen: "",
        precio: "",
        ajuste: "",
        resultado: fmtNeto(subtotal ?? 0),
        estado: "",
      });
    }
  }

  if (base.length > 0) {
    const total = totalGeneral(base);
    rows.push({
      posicion: "TOTAL",
      lado: "",
      volumen: "",
      precio: "",
      ajuste: "",
      resultado: fmtNeto(total ?? 0),
      estado: "",
    });
  }

  return { rows, hayNoMultiplo };
}

export function futuroEsFilaDestacada(fila: ChartTablaFila): boolean {
  const pos = String(fila.posicion ?? "");
  return pos === "TOTAL" || pos.startsWith("Subtotal ");
}
