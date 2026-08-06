import type { ChartTablaColumna, ChartTablaFila } from "@/components/chart-tabla";
import { fmtNeto } from "./matriz-vista";
import type { FuturoAcumulado, FuturoValorizado } from "./futuros-valorizados";
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

// ============================================================================
// Vista de la posición de futuros ACUMULADA (pedido de Lautaro 06/08/2026):
// una fila por producto × posición, con neto, precio promedio ponderado y
// valorización — mismo esquema de subtotales/TOTAL que la tabla por operación.
// ============================================================================

/** Sin columna Estado (pedido de Lautaro 06/08/2026: "dejala igual, quitale la columna estado"). */
export function futurosAcumuladosAColumnas(): ChartTablaColumna[] {
  return [
    { key: "posicion", label: "Posición", align: "left" },
    { key: "ops", label: "Ops." },
    { key: "neto", label: "Neto (tn)" },
    { key: "promedio", label: "Precio prom. (USD)" },
    { key: "ajuste", label: "Ajuste hoy (USD)" },
    { key: "resultado", label: "Resultado (USD)" },
  ];
}

export function futurosAcumuladosAFilas(filas: FuturoAcumulado[], filtro?: OperacionProducto): ChartTablaFila[] {
  const base = filtro ? filas.filter((f) => f.producto === filtro) : filas;
  const rows: ChartTablaFila[] = [];

  const productos = filtro ? [filtro] : PRODUCTOS_CON_FUTURO;
  for (const p of productos) {
    const deEsteProducto = base.filter((f) => f.producto === p);
    if (deEsteProducto.length === 0) continue;

    let subtotal = 0;
    let subtotalValorizado = false;
    for (const f of deEsteProducto) {
      if (f.estado === "valorizado" && f.resultadoUsd != null) {
        subtotal += f.resultadoUsd;
        subtotalValorizado = true;
      }
      rows.push({
        posicion: f.moneda === "usd" ? f.posicionA3 : `${f.posicionA3} ($)`,
        ops: String(f.operaciones),
        neto: fmtNeto(f.netoTn) === "—" ? "0,00" : fmtNeto(f.netoTn),
        promedio: fmtMoneda(f.precioPromedio),
        ajuste: fmtMoneda(f.ajusteHoy),
        resultado: f.estado === "valorizado" ? fmtNeto(f.resultadoUsd ?? 0) : "—",
      });
    }

    if (!filtro && productos.length > 1) {
      rows.push({
        posicion: `Subtotal ${PRODUCTO_LABEL[p]}`,
        ops: "",
        neto: "",
        promedio: "",
        ajuste: "",
        resultado: subtotalValorizado ? fmtNeto(subtotal) : "—",
      });
    }
  }

  if (base.length > 0) {
    const valorizadas = base.filter((f) => f.estado === "valorizado" && f.resultadoUsd != null);
    const total = valorizadas.reduce((a, f) => a + (f.resultadoUsd ?? 0), 0);
    rows.push({
      posicion: "TOTAL",
      ops: "",
      neto: "",
      promedio: "",
      ajuste: "",
      resultado: valorizadas.length > 0 ? fmtNeto(total) : "—",
    });
  }

  return rows;
}
