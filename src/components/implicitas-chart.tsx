"use client";

import { nfmt } from "@/lib/format";
import { RfChart } from "@/charts/RfChart";

type Pt = { x: number; y: number };
type Serie = { name: string; points: Pt[] };

/**
 * Tasas implícitas (TNA) por plazo, varias series superpuestas — value/value (el eje X
 * son días al vencimiento, no una categoría discreta). Colores: paleta categórica de
 * RfChart (antes 2 de las 4 series traían hex fijo, una `--gold-text` como fill completo
 * de la serie — la misma violación de "oro solo como acento" corregida en el resto de
 * los charts de esta migración; sin otro consumidor de esos hex puntuales).
 */
export function ImplicitasChart({ series }: { series: Serie[] }) {
  const conDatos = series.filter((s) => s.points.length > 0);
  if (conDatos.length === 0) {
    return <div className="chart-wrap chart-empty">Sin datos para graficar.</div>;
  }

  return (
    <RfChart
      ariaLabel="Tasas implícitas por plazo: dólar futuro, dólar linked, sintéticos y granos"
      exportName="implicitas-tna"
      xTitle="Días al vencimiento"
      yTitle="TNA (%)"
      valueFormatter={(v) => `${nfmt(v, 1)}%`}
      option={{
        xAxis: { type: "value", axisLabel: { formatter: (v: number) => `${v}d` } },
        yAxis: { type: "value", axisLabel: { formatter: (v: number) => `${nfmt(v, 0)}%` } },
        series: conDatos.map((s) => ({
          name: s.name,
          type: "line",
          data: [...s.points].sort((a, b) => a.x - b.x).map((p) => [p.x, p.y]),
          showSymbol: true,
          symbolSize: 7,
        })),
      }}
    />
  );
}
