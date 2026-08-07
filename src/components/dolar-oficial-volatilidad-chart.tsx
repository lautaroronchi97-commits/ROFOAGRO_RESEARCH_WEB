"use client";

import * as React from "react";
import { nfmt, pfmt } from "@/lib/format";
import { nombreArchivo } from "@/lib/chart-export";
import { RfChart } from "@/charts/RfChart";
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
  colapsable = false,
}: {
  semanal: PuntoVolDolar[];
  diaria: PuntoVolDolar[];
  /** Feedback 07/08/2026: la página en vivo la pasa `true` (tabla arranca cerrada). La
   *  plantilla del informe semanal (screenshot vía Playwright) NUNCA la pasa: sin click
   *  posible, la tabla tiene que seguir visible en el PDF/PNG. */
  colapsable?: boolean;
}) {
  const [modo, setModo] = React.useState<Modo>("semanal");
  const serie = modo === "semanal" ? semanal : diaria;
  const cfg = CONFIG[modo];

  const conVol = React.useMemo(() => serie.filter((p) => p.volAnualizada != null), [serie]);

  return (
    <div className="gx-volpanel">
      <div className="gx-preset-glabel">Volatilidad · {cfg.label}</div>
      <div className="fg-bar" role="toolbar" aria-label="Ventana de volatilidad">
        <button type="button" className="fg-chip" aria-pressed={modo === "semanal"} onClick={() => setModo("semanal")}>
          Semanal
        </button>
        <button type="button" className="fg-chip" aria-pressed={modo === "diaria"} onClick={() => setModo("diaria")}>
          Diaria
        </button>
      </div>
      {conVol.length < 2 ? (
        <div className="chart-wrap chart-empty">Sin suficiente historial todavía para calcular la volatilidad.</div>
      ) : (
        <>
          <RfChart
            ariaLabel={`Volatilidad del dólar oficial — ${cfg.label}`}
            exportName={nombreArchivo("dolar-oficial-volatilidad", modo)}
            xTitle={cfg.colFecha}
            yTitle="Volatilidad anualizada"
            valueFormatter={(v) => pfmt(v, 2)}
            option={{
              xAxis: { type: "category", data: conVol.map((p) => fmtFecha(p.fecha)) },
              yAxis: { type: "value", axisLabel: { formatter: (v: number) => pfmt(v, 0) } },
              tooltip: {
                trigger: "axis",
                // Formatter propio (no el default de RfChart): acá hace falta una línea de
                // contexto extra (la variación %, que no es una serie dibujada) además del valor
                // de volatilidad — mismo lenguaje visual que el default (line-key + fila), con esa
                // línea de más intercalada.
                formatter: (params: unknown) => {
                  const p0 = (Array.isArray(params) ? params[0] : params) as {
                    axisValueLabel: string;
                    color: string;
                    data: { value: number; deltaPct: number | null };
                  };
                  const deltaFila =
                    p0.data.deltaPct != null
                      ? `<div style="opacity:.75;font-size:10.5px;margin:1.5px 0">${cfg.colDelta}: ${pfmt(p0.data.deltaPct, modo === "diaria" ? 3 : 2)}</div>`
                      : "";
                  return `<div style="font-size:10.5px;opacity:.75;margin-bottom:2px">${modo === "semanal" ? "Semana del" : "Rueda del"} ${p0.axisValueLabel}</div>
                    ${deltaFila}
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;padding:1.5px 0;">
                      <span style="display:inline-flex;align-items:center;gap:6px">
                        <span style="display:inline-block;width:12px;height:2.5px;border-radius:2px;background:${p0.color}"></span>
                        Volatilidad
                      </span>
                      <b style="margin-left:10px">${pfmt(p0.data.value, 2)}</b>
                    </div>`;
                },
              },
              series: [
                {
                  name: "Volatilidad anualizada",
                  type: "line",
                  symbol: "none",
                  areaStyle: {},
                  data: conVol.map((p) => ({ value: p.volAnualizada, deltaPct: p.deltaPct })),
                },
              ],
            }}
          />
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
            colapsable={colapsable}
          />
        </>
      )}
    </div>
  );
}
