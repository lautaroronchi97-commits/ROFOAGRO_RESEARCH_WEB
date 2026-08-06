"use client";

import { RfChart } from "@/charts/RfChart";
import { ChartTabla, type ChartTablaColumna, type ChartTablaFila } from "@/components/chart-tabla";
import { fmtNeto } from "@/lib/operaciones/matriz-vista";
import { PRODUCTO_LABEL, type OperacionProducto } from "@/lib/operaciones/tipos";
import type { SerieEvolucionProducto } from "@/lib/operaciones/posicion";

/**
 * Colores por producto (evolución de la posición, 06/08/2026) — mismo criterio
 * que `ORG_COLOR` de `evolucion-chart.tsx` (producción): hex fijos, no
 * `var(--...)`, porque ECharts pinta en `<canvas>` y no resuelve custom
 * properties de CSS ahí (bug ya documentado — ver `bcra-mulc-chart.tsx`).
 * Soja/maíz toman el verde/dorado de marca; trigo/girasol/sorgo/expeller/aceite,
 * tonos distintos entre sí y del semáforo pos/neg (`--pos`/`--neg`) para no
 * confundir "línea de maíz" con "vendido".
 */
const PRODUCTO_COLOR: Record<OperacionProducto, string> = {
  soja: "#2F6E34",
  maiz: "#EFBF2E",
  trigo: "#B45309",
  girasol: "#E8871E",
  sorgo: "#8B3A3A",
  expeller_soja: "#6D4C7D",
  aceite_soja: "#C08A2E",
};

function epoch(fechaISO: string): number {
  return Date.parse(`${fechaISO}T00:00:00Z`);
}

function fmtFecha(fechaISO: string): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${fechaISO}T00:00:00Z`),
  );
}

/** Tabla pivot (doble lectura): una fila por fecha, una columna por producto. */
function tablaDeSeries(series: SerieEvolucionProducto[]): { columnas: ChartTablaColumna[]; filas: ChartTablaFila[] } {
  const columnas: ChartTablaColumna[] = [
    { key: "fecha", label: "Fecha", align: "left" },
    ...series.map((s) => ({ key: s.producto, label: `${PRODUCTO_LABEL[s.producto]} (tn)` })),
  ];
  const porFecha = new Map<string, ChartTablaFila>();
  for (const serie of series) {
    for (const p of serie.puntos) {
      let fila = porFecha.get(p.fecha);
      if (!fila) {
        fila = { fecha: fmtFecha(p.fecha) };
        porFecha.set(p.fecha, fila);
      }
      fila[serie.producto] = fmtNeto(p.acumulado);
    }
  }
  const filas = [...porFecha.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, fila]) => fila);
  return { columnas, filas };
}

type PuntoChart = [number, number]; // [ms, acumulado]

/**
 * Curva de la posición física acumulada por producto, publicación a
 * publicación (fecha de la operación) — una línea por producto de la campaña
 * elegida (el selector de campaña vive en la página, server-side).
 */
export function EvolucionChart({ series }: { series: SerieEvolucionProducto[] }) {
  if (series.length === 0) {
    return <div className="chart-wrap chart-empty">Sin negocios físicos cargados en esta campaña todavía.</div>;
  }

  const tabla = tablaDeSeries(series);

  return (
    <>
      <RfChart
        ariaLabel="Evolución de la posición física acumulada por producto"
        exportName="evolucion-posicion-fisica"
        xTitle="Fecha de la operación"
        yTitle="Posición acumulada (tn)"
        option={{
          xAxis: { type: "time" },
          yAxis: { type: "value" },
          tooltip: {
            trigger: "item",
            formatter: (p: unknown) => {
              const params = p as { seriesName: string; value: PuntoChart; color: string };
              const [, acumulado] = params.value;
              return `<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color}"></span><b>${params.seriesName}</b></div>
                <div>${fmtNeto(acumulado)} tn</div>`;
            },
          },
          series: series.map((s) => ({
            name: PRODUCTO_LABEL[s.producto],
            type: "line",
            data: s.puntos.map((p): PuntoChart => [epoch(p.fecha), p.acumulado]),
            itemStyle: { color: PRODUCTO_COLOR[s.producto] },
            lineStyle: { color: PRODUCTO_COLOR[s.producto], width: 2 },
          })),
        }}
      />
      <ChartTabla
        columnas={tabla.columnas}
        filas={tabla.filas}
        exportCsv="evolucion-posicion-fisica"
        nota="Una fila por fecha con al menos una operación física; «—» = ese producto no tuvo movimiento ese día."
      />
    </>
  );
}
