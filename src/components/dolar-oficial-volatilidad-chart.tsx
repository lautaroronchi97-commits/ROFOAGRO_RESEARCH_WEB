"use client";

import * as React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { nfmt, pfmt } from "@/lib/format";
import { exportarSvgComoPng, nombreArchivo } from "@/lib/chart-export";
import { ChartTabla, type ChartTablaColumna, type ChartTablaFila } from "./chart-tabla";
import type { PuntoVolDolar } from "@/lib/dolar-historico";

/**
 * Volatilidad del dólar oficial (P2 del backlog maestro) — DOS series, con toggle (pedido de
 * Lautaro 23/07: primero se construyó la semanal, después pidió la diaria "no quiero que la
 * volatilidad esté calculada con el dato día por día no semana" pero conservando la semanal
 * también, con un botón para elegir una u otra):
 *   - Semanal: desvío rolling de 12 semanas de la variación % semanal, anualizado ×√52.
 *   - Diaria: desvío rolling de 60 ruedas de la variación % diaria, anualizado ×√252.
 * Puntos sin ventana completa (arranque de la serie) quedan afuera del gráfico, no en 0 (0 sería
 * "sin volatilidad", falso).
 */

type Modo = "semanal" | "diaria";

const CONFIG: Record<Modo, { label: string; ventana: string; factor: string; colFecha: string; colDelta: string }> = {
  semanal: {
    label: "Semanal · desvío rolling 12 semanas, anualizado",
    ventana: "12 variaciones % semanales",
    factor: "×√52",
    colFecha: "Semana (cierre)",
    colDelta: "Variación semanal",
  },
  diaria: {
    label: "Diaria · desvío rolling 60 ruedas, anualizado",
    ventana: "60 variaciones % diarias (ruedas hábiles)",
    factor: "×√252 — convención de mercado, no de calendario",
    colFecha: "Rueda",
    colDelta: "Variación diaria",
  },
};

function fmtFecha(fechaISO: string): string {
  const [, m, d] = fechaISO.split("-");
  return `${d}/${m}`;
}

export function DolarOficialVolatilidadChart({
  semanal,
  diaria,
}: {
  semanal: PuntoVolDolar[];
  diaria: PuntoVolDolar[];
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [modo, setModo] = React.useState<Modo>("semanal");
  const serie = modo === "semanal" ? semanal : diaria;
  const cfg = CONFIG[modo];

  const conVol = React.useMemo(() => serie.filter((p) => p.volAnualizada != null), [serie]);

  return (
    <div className="gx-volpanel">
      <div className="gx-preset-glabel">Volatilidad · {cfg.label}</div>
      <div className="gx-chart-toolbar" style={{ justifyContent: "space-between" }}>
        <div className="fg-bar" role="toolbar" aria-label="Ventana de volatilidad" style={{ margin: 0 }}>
          <button type="button" className="fg-chip" aria-pressed={modo === "semanal"} onClick={() => setModo("semanal")}>
            Semanal
          </button>
          <button type="button" className="fg-chip" aria-pressed={modo === "diaria"} onClick={() => setModo("diaria")}>
            Diaria
          </button>
        </div>
        <button
          type="button"
          className="gx-preset"
          onClick={() => exportarSvgComoPng(wrapRef.current, `${nombreArchivo("dolar-oficial-volatilidad", modo)}.png`)}
        >
          ↓ PNG
        </button>
      </div>
      {conVol.length < 2 ? (
        <div className="chart-wrap chart-empty">Sin suficiente historial todavía para calcular la volatilidad.</div>
      ) : (
        <>
          <div style={{ position: "relative" }} ref={wrapRef}>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={conVol} margin={{ top: 4, right: 16, bottom: 6, left: 4 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" />
                <XAxis
                  dataKey="fecha"
                  tickFormatter={fmtFecha}
                  tick={{ fill: "var(--ink-3)", fontSize: 10.5 }}
                  stroke="var(--line-2)"
                  height={22}
                  minTickGap={28}
                />
                <YAxis
                  tickFormatter={(v: number) => pfmt(v, 0)}
                  tick={{ fill: "var(--ink-3)", fontSize: 10.5 }}
                  stroke="var(--line-2)"
                  width={48}
                />
                <Tooltip
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const row = payload[0]!.payload as PuntoVolDolar; // length===0 ya salió arriba
                    return (
                      <div className="gx-tip">
                        <div className="gx-tip-h">{modo === "semanal" ? "Semana del" : "Rueda del"} {fmtFecha(row.fecha)}</div>
                        {row.deltaPct != null && <div className="gx-tip-row">{cfg.colDelta}: {pfmt(row.deltaPct, modo === "diaria" ? 3 : 2)}</div>}
                        <div className="gx-tip-row">Volatilidad: {row.volAnualizada != null ? pfmt(row.volAnualizada, 2) : "—"}</div>
                      </div>
                    );
                  }}
                />
                <Line type="monotone" dataKey="volAnualizada" stroke="var(--brand-deep)" strokeWidth={1.8} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ChartTabla
            columnas={[
              { key: "fecha", label: cfg.colFecha, align: "left" },
              { key: "deltaPct", label: cfg.colDelta },
              { key: "vol", label: "Volatilidad anualizada" },
            ] as ChartTablaColumna[]}
            filas={conVol.map((p) => ({
              fecha: fmtFecha(p.fecha),
              deltaPct: p.deltaPct != null ? pfmt(p.deltaPct, modo === "diaria" ? 3 : 2) : null,
              vol: p.volAnualizada != null ? pfmt(p.volAnualizada, 2) : null,
            })) as ChartTablaFila[]}
            nota={`Desvío estándar de las últimas ${cfg.ventana}, anualizado (${cfg.factor}). Último dato: ${nfmt(conVol[conVol.length - 1]!.volAnualizada, 2)}%.`} // conVol.length<2 ya cayó en la rama de arriba
            exportCsv={nombreArchivo("dolar-oficial-volatilidad", modo)}
            maxFilas={5}
            orden="desc"
          />
        </>
      )}
    </div>
  );
}
