"use client";

import { nfmt } from "@/lib/format";
import { RfChart } from "@/charts/RfChart";

type Pt = { x: number; y: number; pos?: string };
type Serie = { name: string; points: Pt[] };

/**
 * Tasas implícitas (TNA) por plazo, varias series superpuestas — value/value (el eje X
 * son días al vencimiento, no una categoría discreta). Colores: paleta categórica de
 * RfChart (antes 2 de las 4 series traían hex fijo, una `--gold-text` como fill completo
 * de la serie — la misma violación de "oro solo como acento" corregida en el resto de
 * los charts de esta migración; sin otro consumidor de esos hex puntuales).
 *
 * `pos` (feedback 07/08/2026): en las series de granos identifica la posición (ej.
 * "NOV26") — el tooltip default de RfChart no lo muestra, así que acá hay un formatter
 * propio que agrega esa línea cuando el punto la trae. Nombrado `pos`, no `label`: ECharts
 * ya usa `label` en cada item de `data` para su propia config de texto sobre el punto —
 * colisiona de tipos si se reusa el nombre.
 */
export function ImplicitasChart({ series }: { series: Serie[] }) {
  const conDatos = series.filter((s) => s.points.length > 0);
  if (conDatos.length === 0) {
    return <div className="chart-wrap chart-empty">Sin datos para graficar.</div>;
  }

  return (
    <RfChart
      ariaLabel="Tasas implícitas por plazo: dólar linked, sintéticos y granos (soja/maíz/trigo)"
      exportName="implicitas-tna"
      xTitle="Días al vencimiento"
      yTitle="TNA (%)"
      valueFormatter={(v) => `${nfmt(v, 1)}%`}
      option={{
        xAxis: { type: "value", axisLabel: { formatter: (v: number) => `${v}d` } },
        yAxis: { type: "value", axisLabel: { formatter: (v: number) => `${nfmt(v, 0)}%` } },
        tooltip: {
          trigger: "item",
          formatter: (params: unknown) => {
            const p = params as { seriesName: string; color: string; data: { value: [number, number]; pos?: string } };
            const [x, y] = p.data.value;
            const posLinea = p.data.pos ? `<div style="opacity:.75;font-size:10.5px;margin:1.5px 0">${p.data.pos}</div>` : "";
            return `<div style="font-size:10.5px;opacity:.75;margin-bottom:2px">${x}d al vencimiento</div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;padding:1.5px 0;">
                <span style="display:inline-flex;align-items:center;gap:6px">
                  <span style="display:inline-block;width:12px;height:2.5px;border-radius:2px;background:${p.color}"></span>
                  ${p.seriesName}
                </span>
                <b style="margin-left:10px">${nfmt(y, 1)}%</b>
              </div>${posLinea}`;
          },
        },
        series: conDatos.map((s) => ({
          name: s.name,
          type: "line",
          data: [...s.points].sort((a, b) => a.x - b.x).map((p) => ({ value: [p.x, p.y], pos: p.pos })),
          showSymbol: true,
          symbolSize: 7,
        })),
      }}
    />
  );
}
