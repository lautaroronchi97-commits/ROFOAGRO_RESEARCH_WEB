"use client";

import { nfmt } from "@/lib/format";
import { ORG_LABEL } from "@/lib/calendario";
import type { SerieEvol } from "@/lib/estimaciones";
import { RfChart } from "@/charts/RfChart";
import { ChartTabla, type ChartTablaColumna, type ChartTablaFila } from "./chart-tabla";

/** Colores por organismo — misma familia de tono que `.org-*` en globals.css
 *  (USDA azulado, CONAB verde, BCR dorado/marrón, BCBA azul-violeta, DEA violeta,
 *  CFTC rojizo), pero retocados en luminancia/saturación: corridos los 6 contra
 *  `scripts/validate_palette.js` (skill `dataviz`) el `.org-*` original FALLABA
 *  duro — USDA y DEA leían casi grises (chroma bajo el piso) y BCR↔CONAB eran
 *  indistinguibles para protanopía (ΔE 1,2, piso 8). Este set pasa los 5 checks
 *  en claro Y oscuro. Ajuste acotado a ESTE chart (no toca `.org-*`, que además
 *  pinta badges en otras páginas — separado a propósito, fuera del alcance de
 *  la migración a ECharts). EIA/NOPA quedan igual (gris, ya comparten hex a
 *  propósito, no coexisten en el mismo combo grano/país). */
const ORG_COLOR: Record<string, string> = {
  USDA: "#1E7FA8",
  CONAB: "#4E9C3A",
  BCR: "#8F5A16",
  BCBA: "#5B7FC7",
  DEA: "#7A3FA0",
  CFTC: "#B06A4A",
  EIA: "#7E8C74",
  NOPA: "#7E8C74",
};

function epoch(fechaISO: string): number {
  return Date.parse(`${fechaISO}T00:00:00Z`);
}

function fmtFecha(fechaISO: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${fechaISO}T00:00:00Z`));
}

function orgLabel(organismo: string): string {
  return ORG_LABEL[organismo as keyof typeof ORG_LABEL] ?? organismo;
}

/**
 * Tabla de datos del gráfico (doble lectura): una fila por fecha de publicación,
 * una columna por organismo. Mismos puntos y mismo formateo que el tooltip
 * (nfmt a 2 decimales, en la unidad del gráfico); "—" cuando un organismo no
 * publicó ese día.
 */
function tablaDeSeries(series: SerieEvol[], unidad: string): { columnas: ChartTablaColumna[]; filas: ChartTablaFila[] } {
  const columnas: ChartTablaColumna[] = [
    { key: "fecha", label: "Fecha", align: "left" },
    ...series.map((serie) => ({
      key: serie.organismo,
      label: `${orgLabel(serie.organismo)} (${unidad})`,
    })),
  ];
  const porFecha = new Map<string, ChartTablaFila>();
  for (const serie of series) {
    for (const p of serie.puntos) {
      let fila = porFecha.get(p.fecha);
      if (!fila) {
        fila = { fecha: fmtFecha(p.fecha) };
        porFecha.set(p.fecha, fila);
      }
      fila[serie.organismo] = nfmt(p.valor, 2);
    }
  }
  const filas = [...porFecha.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, fila]) => fila);
  return { columnas, filas };
}

type PuntoEvol = [number, number, string]; // [ms, valor, informe]

/**
 * Evolución de la estimación de una campaña, publicación a publicación. Una línea por organismo,
 * eje x = fecha de publicación (escala temporal real, así USDA y CONAB se superponen aunque tengan
 * distinta cantidad de vintages).
 */
export function EvolucionChart({
  series,
  unidad,
  variableLabel = "Estimación",
}: {
  series: SerieEvol[];
  unidad: string;
  variableLabel?: string;
}) {
  const total = series.reduce((acc, s) => acc + s.puntos.length, 0);
  if (total === 0) {
    return <div className="chart-wrap chart-empty">Sin datos para esta combinación.</div>;
  }

  const tabla = tablaDeSeries(series, unidad);

  return (
    <>
      <RfChart
        ariaLabel="Evolución de la estimación de producción por organismo"
        exportName={`evolucion-${variableLabel.toLowerCase()}`}
        xTitle="Fecha de publicación"
        yTitle={`${variableLabel} (${unidad})`}
        option={{
          xAxis: { type: "time" },
          yAxis: { type: "value" },
          tooltip: {
            trigger: "item",
            formatter: (p: unknown) => {
              const params = p as { seriesName: string; value: PuntoEvol; color: string };
              const [, valor, informe] = params.value;
              return `<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color}"></span><b>${params.seriesName}</b></div>
                <div>${nfmt(valor, 2)} ${unidad}</div>
                <div style="opacity:.75;font-size:10.5px;margin-top:2px">${informe}</div>`;
            },
          },
          // Sin endLabel: con 2-8 organismos las líneas convergen todas cerca del
          // borde derecho y los nombres quedaban pegados/con bordes raros — la
          // skill dataviz señala exactamente este caso ("cuando los end-labels
          // colisionan... usar la leyenda + tooltip"). RfChart ya agrega la
          // leyenda sola al ver 2+ series.
          series: series
            .filter((s) => s.puntos.length > 0)
            .map((s) => ({
              name: orgLabel(s.organismo),
              type: "line",
              data: s.puntos.map((p): PuntoEvol => [epoch(p.fecha), p.valor, p.informe]),
              itemStyle: { color: ORG_COLOR[s.organismo] ?? undefined },
              lineStyle: { color: ORG_COLOR[s.organismo] ?? undefined, width: 2 },
            })),
        }}
      />
      <ChartTabla
        columnas={tabla.columnas}
        filas={tabla.filas}
        nota="Una fila por fecha de publicación; «—» = ese organismo no publicó ese día."
      />
    </>
  );
}
