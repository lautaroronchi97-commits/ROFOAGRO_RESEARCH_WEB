"use client";

import { useTheme } from "next-themes";
import { nfmt } from "@/lib/format";
import { RfChart } from "@/charts/RfChart";
import { paletteFor } from "@/charts/rofoTheme";

type Pt = { label: string; value: number };

/** Curva de dólar futuro por posición (SPOT + posiciones vigentes). Serie única:
 *  RfChart aplica sola el color institucional + degradé de área (`aplicarColorSerieUnica`).
 *  El punto final (posición más lejana) se resalta en dorado — mismo criterio visual
 *  que el `.cv-end` del motor SVG viejo — vía itemStyle a nivel de dato, no de serie.
 *  El color no puede ir como `"var(--gold)"` literal: ECharts pinta en un `<canvas>`,
 *  cuyo `fillStyle` no resuelve custom properties de CSS (a diferencia del DOM) — hay
 *  que resolver el token del tema acá mismo, igual que hace RfChart puertas adentro. */
export function DolarFuturoChart({ points }: { points: Pt[] }) {
  const { resolvedTheme } = useTheme();
  const p = paletteFor(resolvedTheme === "dark" ? "dark" : "light");

  if (points.length === 0) return <div className="chart-wrap" />;

  const last = points.length - 1;

  return (
    <RfChart
      ariaLabel="Curva de precios de dólar futuro por posición"
      exportName="dolar-futuro"
      xTitle="Posición"
      yTitle="Precio ($)"
      valueFormatter={(v) => nfmt(v, 1)}
      option={{
        xAxis: { type: "category", data: points.map((pt) => pt.label) },
        yAxis: { type: "value" },
        series: [
          {
            type: "line",
            name: "Dólar futuro",
            areaStyle: {},
            data: points.map((pt, i) =>
              i === last
                ? {
                    value: pt.value,
                    symbolSize: 10,
                    itemStyle: { color: p.gold, borderColor: p.panel, borderWidth: 2 },
                  }
                : pt.value,
            ),
          },
        ],
      }}
    />
  );
}
