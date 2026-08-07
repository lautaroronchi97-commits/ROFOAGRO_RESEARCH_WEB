"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { nfmt } from "@/lib/format";
import { RfChart } from "@/charts/RfChart";
import { paletteFor } from "@/charts/rofoTheme";
import { ChartTabla, type ChartTablaColumna, type ChartTablaFila } from "./chart-tabla";
import { RangoChips } from "./rango-chips";
import type { PuntoBcraMulc } from "@/lib/bcra-mulc";

type Rango = "30" | "60" | "90";
const OPCIONES_RANGO: { label: string; value: Rango }[] = [
  { label: "30D", value: "30" },
  { label: "60D", value: "60" },
  { label: "90D", value: "90" },
];

function fmtFecha(fechaISO: string): string {
  const [, m, d] = fechaISO.split("-");
  return `${d}/${m}`;
}

/**
 * Compras netas de divisas del BCRA en el MULC (C4) — barras diarias en M USD: verde compra
 * neta, rojo venta neta (color por punto, no por serie — `itemStyle` a mano). Las barras se
 * pisan solas cuando llega el dato oficial (`fuente` sigue distinguiendo carga manual internamente
 * para esa lógica de pisado, pero no se muestra en la UI — feedback 07/08/2026: Lautaro no quiere
 * ver si el dato es manual o por API, es un detalle interno de la ingesta).
 */
export function BcraMulcChart({
  serie: serieCompleta,
  colapsable = false,
}: {
  serie: PuntoBcraMulc[];
  /** Feedback 07/08/2026: la página en vivo la pasa `true` (tabla arranca cerrada). La
   *  plantilla del informe semanal (screenshot vía Playwright) NUNCA la pasa. */
  colapsable?: boolean;
}) {
  const [rango, setRango] = useState<Rango>("90");
  const { resolvedTheme } = useTheme();
  const p = paletteFor(resolvedTheme === "dark" ? "dark" : "light");

  if (serieCompleta.length === 0) {
    return <div className="chart-wrap chart-empty">Sin datos todavía para el gráfico.</div>;
  }

  const serie = serieCompleta.slice(-Number(rango));

  const columnas: ChartTablaColumna[] = [
    { key: "fecha", label: "Fecha", align: "left" },
    { key: "monto", label: "Compras netas (M USD)" },
  ];
  const filas: ChartTablaFila[] = serie.map((p) => ({
    fecha: fmtFecha(p.fecha),
    monto: nfmt(p.montoMusd, 1),
  }));

  return (
    <>
      <RangoChips opciones={OPCIONES_RANGO} valor={rango} onChange={setRango} label="Plazo del gráfico" />
      <RfChart
        ariaLabel="Compras netas del BCRA en el MULC, M USD por día"
        exportName="bcra-mulc"
        xTitle="Fecha"
        yTitle="M USD"
        valueFormatter={(v) => nfmt(v, 1)}
        option={{
          xAxis: { type: "category", data: serie.map((p) => fmtFecha(p.fecha)) },
          yAxis: { type: "value" },
          series: [
            {
              type: "bar",
              data: serie.map((s) => ({
                value: s.montoMusd,
                itemStyle: { color: s.montoMusd >= 0 ? p.pos : p.neg },
              })),
            },
          ],
        }}
      />
      <ChartTabla
        columnas={columnas}
        filas={filas}
        maxFilas={5}
        orden="desc"
        colapsable={colapsable}
        nota="Banco Central (~3-4 días hábiles de rezago) + carga manual del día en /admin/datos, que se pisa sola cuando llega el dato oficial."
      />
    </>
  );
}
