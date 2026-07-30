"use client";

import * as React from "react";
import {
  ComposedChart, Bar, Cell, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { nfmt, pfmt } from "@/lib/format";
import { exportarSvgComoPng, nombreArchivo } from "@/lib/chart-export";
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
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [rango, setRango] = React.useState<Rango>("26");
  if (semanasCompletas.length < 2) {
    return <div className="chart-wrap chart-empty">Sin suficiente historial semanal todavía.</div>;
  }

  const semanas = semanasCompletas.slice(-Number(rango));

  const columnas: ChartTablaColumna[] = [
    { key: "fecha", label: "Semana (cierre)", align: "left" },
    { key: "valor", label: "$ oficial (A3500)" },
    { key: "deltaPct", label: "Variación semanal" },
  ];
  const filas: ChartTablaFila[] = semanas.map((p) => ({
    fecha: fmtSemana(p.fecha),
    valor: nfmt(p.valor, 2),
    deltaPct: p.deltaPct != null ? pfmt(p.deltaPct, 2) : null,
  }));

  return (
    <div className="gx-volpanel">
      <div className="gx-preset-glabel">Serie semanal · últimas {semanas.length} semanas</div>
      <div className="gx-chart-toolbar" style={{ justifyContent: "space-between" }}>
        <RangoChips opciones={OPCIONES_RANGO} valor={rango} onChange={setRango} label="Plazo del gráfico" />
        <button
          type="button"
          className="gx-preset"
          onClick={() => exportarSvgComoPng(wrapRef.current, `${nombreArchivo("dolar-oficial-semanal")}.png`)}
        >
          ↓ PNG
        </button>
      </div>
      <div style={{ position: "relative" }} ref={wrapRef}>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={semanas} margin={{ top: 4, right: 16, bottom: 6, left: 4 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" />
            <XAxis
              dataKey="fecha"
              tickFormatter={fmtSemana}
              tick={{ fill: "var(--ink-3)", fontSize: 10.5 }}
              stroke="var(--line-2)"
              height={22}
              minTickGap={24}
            />
            <YAxis
              yAxisId="nivel"
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => nfmt(v, 0)}
              tick={{ fill: "var(--ink-3)", fontSize: 10.5 }}
              stroke="var(--line-2)"
              width={58}
            />
            <YAxis
              yAxisId="delta"
              orientation="right"
              tickFormatter={(v: number) => pfmt(v, 1)}
              tick={{ fill: "var(--ink-3)", fontSize: 10.5 }}
              stroke="var(--line-2)"
              width={48}
            />
            <Tooltip
              isAnimationActive={false}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const row = payload[0]!.payload as PuntoSemanalDolar; // length===0 ya salió arriba
                return (
                  <div className="gx-tip">
                    <div className="gx-tip-h">Semana del {fmtSemana(row.fecha)}</div>
                    <div className="gx-tip-row">Cierre: $ {nfmt(row.valor, 2)}</div>
                    {row.deltaPct != null && <div className="gx-tip-row">Variación: {pfmt(row.deltaPct, 2)}</div>}
                  </div>
                );
              }}
            />
            <Bar yAxisId="delta" dataKey="deltaPct" isAnimationActive={false}>
              {semanas.map((p, i) => (
                <Cell key={i} fill={p.deltaPct == null ? "var(--neu)" : p.deltaPct >= 0 ? "var(--pos)" : "var(--neg)"} opacity={0.55} />
              ))}
            </Bar>
            <Line yAxisId="nivel" type="monotone" dataKey="valor" stroke="var(--gold-text)" strokeWidth={1.8} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
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
