"use client";

import { useState } from "react";
import { nfmt } from "@/lib/format";
import { RfChart } from "@/charts/RfChart";
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
 * neta, rojo venta neta (color por punto, no por serie — `itemStyle` a mano). Las barras de
 * carga manual (todavía sin confirmar por la oficial) van más tenues para distinguirlas de un
 * vistazo; se pisan solas cuando llega el dato de la API.
 */
export function BcraMulcChart({ serie: serieCompleta }: { serie: PuntoBcraMulc[] }) {
  const [rango, setRango] = useState<Rango>("90");

  if (serieCompleta.length === 0) {
    return <div className="chart-wrap chart-empty">Sin datos todavía para el gráfico.</div>;
  }

  const serie = serieCompleta.slice(-Number(rango));

  const columnas: ChartTablaColumna[] = [
    { key: "fecha", label: "Fecha", align: "left" },
    { key: "monto", label: "Compras netas (M USD)" },
    { key: "fuente", label: "Fuente", align: "left" },
  ];
  const filas: ChartTablaFila[] = serie.map((p) => ({
    fecha: fmtFecha(p.fecha),
    monto: nfmt(p.montoMusd, 1),
    fuente: p.fuente === "manual" ? "carga manual" : "BCRA oficial",
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
              data: serie.map((p) => ({
                value: p.montoMusd,
                itemStyle: {
                  color: p.montoMusd >= 0 ? "var(--pos)" : "var(--neg)",
                  opacity: p.fuente === "manual" ? 0.5 : 0.92,
                },
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
        nota="Banco Central (~3-4 días hábiles de rezago) + carga manual del día en /admin/datos, que se pisa sola cuando llega el dato oficial."
      />
    </>
  );
}
