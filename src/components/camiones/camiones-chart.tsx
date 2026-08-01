"use client";

import { nfmt } from "@/lib/format";
import { RfChart } from "@/charts/RfChart";
import { ChartTabla, type ChartTablaColumna, type ChartTablaFila } from "../chart-tabla";

/**
 * Gráfico multi-serie de camiones en puerto (por zona o por producto, según lo que pase el
 * caller) — ECharts vía RfChart (eje X temporal real, tooltip axis-trigger, leyenda con
 * paleta categórica; antes SVG a mano). Hoy el único caller (Agroentregas "por grano") tiene
 * pocos puntos reales por serie — se decidió A PROPÓSITO mantenerlo como línea (no barra
 * agrupada): son 3 "eras" (hoy/hace 1 año/hace 2 años) que la ingesta diaria va a ir llenando
 * para siempre, mismo caso que "por campaña" de `williams-chart.tsx`, que también quedó en línea.
 */

export type SerieCamiones = { key: string; display: string; puntos: { fecha: string; cantidad: number }[] };

function epoch(fechaISO: string): number {
  return Date.parse(`${fechaISO}T00:00:00Z`);
}

function fmtFecha(fechaISO: string): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${fechaISO}T00:00:00Z`),
  );
}

function tablaDeSeries(series: SerieCamiones[]): { columnas: ChartTablaColumna[]; filas: ChartTablaFila[] } {
  const columnas: ChartTablaColumna[] = [
    { key: "fecha", label: "Fecha", align: "left" },
    ...series.map((s) => ({ key: s.key, label: `${s.display} (camiones)` })),
  ];
  const porFecha = new Map<string, ChartTablaFila>();
  for (const s of series) {
    for (const p of s.puntos) {
      let fila = porFecha.get(p.fecha);
      if (!fila) {
        fila = { fecha: fmtFecha(p.fecha) };
        porFecha.set(p.fecha, fila);
      }
      fila[s.key] = nfmt(p.cantidad, 0);
    }
  }
  const filas = [...porFecha.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, f]) => f);
  return { columnas, filas };
}

export function CamionesChart({
  series,
  tituloAria,
  tablaColapsable = false,
  tablaAbierta,
  onToggleTabla,
}: {
  series: SerieCamiones[];
  tituloAria: string;
  /** Opt-in (relevamiento web R9 punto 53): la `ChartTabla` interna arranca cerrada, coordinada
   *  por el padre (`abierta`/`onToggleAbierta`). Sin esto, sigue siempre-visible como hoy. */
  tablaColapsable?: boolean;
  tablaAbierta?: boolean;
  onToggleTabla?: () => void;
}) {
  const total = series.reduce((acc, s) => acc + s.puntos.length, 0);
  if (total === 0) {
    return <div className="chart-wrap chart-empty">Sin datos para mostrar.</div>;
  }

  const tabla = tablaDeSeries(series);

  return (
    <>
      <RfChart
        ariaLabel={tituloAria}
        exportName="camiones-plantas"
        xTitle="Fecha"
        yTitle="Camiones"
        valueFormatter={(v) => nfmt(v, 0)}
        option={{
          xAxis: { type: "time" },
          yAxis: { type: "value" },
          series: series.map((s) => ({
            name: s.display,
            type: "line",
            data: s.puntos.map((p) => [epoch(p.fecha), p.cantidad]),
          })),
        }}
      />
      <ChartTabla
        columnas={tabla.columnas}
        filas={tabla.filas}
        nota="Una fila por día con dato; cantidad de CAMIONES (no toneladas)."
        colapsable={tablaColapsable}
        abierta={tablaAbierta}
        onToggleAbierta={onToggleTabla}
      />
    </>
  );
}
