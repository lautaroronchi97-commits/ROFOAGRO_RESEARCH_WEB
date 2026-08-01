"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { nfmt, pfmt } from "@/lib/format";
import { nombreArchivo } from "@/lib/chart-export";
import { RfChart } from "@/charts/RfChart";
import { paletteFor } from "@/charts/rofoTheme";
import { ChartTabla, type ChartTablaColumna, type ChartTablaFila } from "./chart-tabla";
import { RangoChips } from "./rango-chips";
import type { PuntoSemanalDolar } from "@/lib/dolar-historico";

type Rango = "12" | "26";
const OPCIONES_RANGO: { label: string; value: Rango }[] = [
  { label: "12 sem.", value: "12" },
  { label: "26 sem.", value: "26" },
];

/**
 * Serie semanal larga del dólar oficial (P2 del backlog maestro): línea con el
 * cierre de cada semana + barras con la variación % semana a semana (verde/
 * roja), mismo eje X. Ventana visible fija en 26 semanas (~6 meses, decisión
 * de Lautaro) — la lib ya entrega solo esas.
 */

function fmtSemana(fechaISO: string): string {
  const [, m, d] = fechaISO.split("-");
  return `${d}/${m}`;
}

export function DolarOficialSemanalChart({ semanas: semanasCompletas }: { semanas: PuntoSemanalDolar[] }) {
  const [rango, setRango] = React.useState<Rango>("26");
  const { resolvedTheme } = useTheme();
  const p = paletteFor(resolvedTheme === "dark" ? "dark" : "light");
  if (semanasCompletas.length < 2) {
    return <div className="chart-wrap chart-empty">Sin suficiente historial semanal todavía.</div>;
  }

  const semanas = semanasCompletas.slice(-Number(rango));

  const columnas: ChartTablaColumna[] = [
    { key: "fecha", label: "Semana (cierre)", align: "left" },
    { key: "valor", label: "$ oficial (A3500)" },
    { key: "deltaPct", label: "Variación semanal" },
  ];
  const filas: ChartTablaFila[] = semanas.map((p2) => ({
    fecha: fmtSemana(p2.fecha),
    valor: nfmt(p2.valor, 2),
    deltaPct: p2.deltaPct != null ? pfmt(p2.deltaPct, 2) : null,
  }));

  return (
    <div className="gx-volpanel">
      <div className="gx-preset-glabel">Serie semanal · últimas {semanas.length} semanas</div>
      <RangoChips opciones={OPCIONES_RANGO} valor={rango} onChange={setRango} label="Plazo del gráfico" />
      <RfChart
        ariaLabel="Dólar oficial semanal: cierre y variación % semana a semana"
        exportName={nombreArchivo("dolar-oficial-semanal")}
        xTitle="Semana"
        yTitle={["$ oficial (A3500)", "Variación semanal"]}
        valueFormatter={(v, name) => (name === "Variación semanal" ? pfmt(v, 2) : `$ ${nfmt(v, 2)}`)}
        option={{
          xAxis: { type: "category", data: semanas.map((s) => fmtSemana(s.fecha)) },
          yAxis: [
            // scale:true a mano: el default de RfChart pone scale:false (honesto, arranca en 0)
            // apenas hay una serie de barras en el chart — acá la barra vive en el 2do eje (%),
            // el nivel en $ (1er eje) necesita zoom al rango real como cualquier chart de sólo
            // líneas, si no la curva se ve chata contra 0.
            { type: "value", scale: true },
            { type: "value", axisLabel: { formatter: (v: number) => pfmt(v, 1) } },
          ],
          series: [
            {
              name: "Variación semanal",
              type: "bar",
              yAxisIndex: 1,
              // itemStyle a nivel serie: solo decide el swatch de la leyenda (cada barra ya
              // trae su propio itemStyle pos/neg/neu abajo, que siempre gana).
              itemStyle: { color: p.pos },
              data: semanas.map((s) => ({
                value: s.deltaPct,
                itemStyle: { color: s.deltaPct == null ? p.neu : s.deltaPct >= 0 ? p.pos : p.neg, opacity: 0.55 },
              })),
            },
            {
              name: "$ oficial (A3500)",
              type: "line",
              yAxisIndex: 0,
              symbol: "none",
              itemStyle: { color: p.goldText },
              lineStyle: { color: p.goldText, width: 1.8 },
              data: semanas.map((s) => s.valor),
            },
          ],
        }}
      />
      <ChartTabla
        columnas={columnas}
        filas={filas}
        maxFilas={5}
        orden="desc"
        nota="BCRA A3500 (Comunicación 3500) — cierre de cada semana (último dato hábil disponible) y su variación % vs la semana anterior."
        exportCsv={nombreArchivo("dolar-oficial-semanal")}
      />
    </div>
  );
}
