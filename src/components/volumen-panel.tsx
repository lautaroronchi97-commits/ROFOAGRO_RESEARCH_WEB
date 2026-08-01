"use client";

import { useTheme } from "next-themes";
import { nfmt } from "@/lib/format";
import { etiquetaCalendario, mesEnRuedasAlVto, type Eje } from "@/lib/derivadas";
import { RfChart } from "@/charts/RfChart";
import { paletteFor } from "@/charts/rofoTheme";
import { ChartTabla, type ChartTablaColumna, type ChartTablaFila } from "./chart-tabla";

/**
 * Subpanel de volumen/OI (P6 del backlog maestro): barras de volumen operado +
 * línea de open interest de UNA pata (la campaña vigente), en el mismo eje X que
 * el chart principal. Solo tiene sentido para A3/CBOT (pizarra no opera
 * contratos, no tiene volumen) — el caller decide cuándo mostrarlo.
 */

export type VolPunto = { x: number; f: string; vol: number | null; oi: number | null };

export function VolumenPanel({
  puntos, eje, anchorMes, refVto, label, exportName,
}: {
  puntos: VolPunto[];
  eje: Eje;
  anchorMes: number;
  refVto?: string;
  label: string;
  exportName?: string;
}) {
  const { resolvedTheme } = useTheme();
  const p = paletteFor(resolvedTheme === "dark" ? "dark" : "light");
  const conDato = puntos.filter((pt) => pt.vol !== null || pt.oi !== null);
  if (conDato.length === 0) return null;

  const mesEnX = (x: number): string =>
    refVto ? mesEnRuedasAlVto(refVto, Math.max(0, Math.round(-x))) : "";
  const headDe = (x: number): string =>
    eje === "vto" ? `${-Math.round(x)} ruedas al vto · ${mesEnX(x)}` : etiquetaCalendario(x, anchorMes);

  const columnas: ChartTablaColumna[] = [
    { key: "x", label: eje === "vto" ? "Ruedas al vto" : "Fecha", align: "left" },
    { key: "vol", label: "Volumen" },
    { key: "oi", label: "Open interest" },
  ];
  const filas: ChartTablaFila[] = conDato.map((pt) => ({
    x: eje === "vto" ? `${-Math.round(pt.x)} · ${mesEnX(pt.x)}` : etiquetaCalendario(pt.x, anchorMes),
    vol: pt.vol !== null ? nfmt(pt.vol, 0) : null,
    oi: pt.oi !== null ? nfmt(pt.oi, 0) : null,
  }));

  return (
    <div className="gx-volpanel">
      <div className="gx-preset-glabel">Volumen / open interest · {label}</div>
      <RfChart
        ariaLabel={`Volumen y open interest — ${label}`}
        exportName={exportName ?? "volumen-oi"}
        xTitle={eje === "vto" ? "Ruedas al vto" : "Fecha"}
        yTitle={["Volumen", "Open interest"]}
        valueFormatter={(v) => nfmt(v, 0)}
        option={{
          xAxis: {
            type: "value",
            axisLabel: { formatter: (v: number) => (eje === "vto" ? String(-Math.round(v)) : etiquetaCalendario(v, anchorMes)) },
          },
          yAxis: [{ type: "value" }, { type: "value" }],
          tooltip: {
            trigger: "axis",
            formatter: (params: unknown) => {
              const arr = (Array.isArray(params) ? params : [params]) as Array<{
                axisValue: number;
                seriesName: string;
                color: string;
                value: [number, number | null];
              }>;
              if (arr.length === 0) return "";
              // `value` es la tupla [x,y] entera (el dato tal cual se pasó), no solo el y — mismo
              // desempaquetado que el formatter default de RfChart hace para series con array.
              const filas2 = arr
                .filter((p2) => p2.value[1] !== null && p2.value[1] !== undefined)
                .map(
                  (p2) =>
                    `<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;padding:1.5px 0;">
                      <span style="display:inline-flex;align-items:center;gap:6px">
                        <span style="display:inline-block;width:12px;height:2.5px;border-radius:2px;background:${p2.color}"></span>
                        ${p2.seriesName}
                      </span>
                      <b style="margin-left:10px">${nfmt(p2.value[1]!, 0)}</b>
                    </div>`,
                )
                .join("");
              return `<div style="font-size:10.5px;opacity:.75;margin-bottom:2px">${headDe(arr[0]!.axisValue)}</div>${filas2}`;
            },
          },
          series: [
            {
              name: "Volumen",
              type: "bar",
              yAxisIndex: 0,
              itemStyle: { color: p.brandDeep, opacity: 0.55 },
              data: conDato.map((pt) => [pt.x, pt.vol]),
            },
            {
              name: "Open interest",
              type: "line",
              yAxisIndex: 1,
              symbol: "none",
              connectNulls: true,
              itemStyle: { color: p.goldText },
              lineStyle: { color: p.goldText, width: 1.6 },
              data: conDato.map((pt) => [pt.x, pt.oi]),
            },
          ],
        }}
      />
      <ChartTabla titulo="Datos de volumen/OI" columnas={columnas} filas={filas} exportCsv={exportName} />
    </div>
  );
}
