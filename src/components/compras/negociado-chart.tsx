"use client";

import { useMemo, useState } from "react";
import { nfmt } from "@/lib/format";
import { MESES_ES } from "@/lib/dates";
import type { PuntoHisto } from "@/lib/compras/negociado";
import { RfChart } from "@/charts/RfChart";
import { ChartTabla } from "@/components/chart-tabla";

/**
 * Histograma del volumen negociado (compras semanales SIO Granos): barras apiladas por
 * sector (Exportación + Industria), toggle Semanal (últimas 52 semanas) / Mensual (suma
 * calendario, últimos 24 meses) y selector de grano (Todos = suma de los 7). Eje Y con
 * tick compacto en miles de toneladas; tooltip y tabla siguen en toneladas exactas.
 * Colores: paleta categórica de RfChart (antes Exportación=verde institucional/Industria=
 * dorado — el dorado como fill de una serie entera viola la regla propia del proyecto,
 * "oro solo como acento"; sin otro consumidor de `.ng-bar-*` en el sitio, no hacía falta
 * preservar ese hex puntual).
 */

type Barra = { clave: string; label: string; exp: number; ind: number };

function labelSemana(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
function labelMes(ym: string): string {
  const mes = Number(ym.slice(5, 7));
  return `${(MESES_ES[mes - 1] ?? "").toLowerCase()} ${ym.slice(2, 4)}`;
}

export function NegociadoChart({ serie, productos }: { serie: PuntoHisto[]; productos: { cod: string; display: string }[] }) {
  const [grano, setGrano] = useState("TODOS");
  const [modo, setModo] = useState<"semanal" | "mensual">("semanal");

  const barras = useMemo<Barra[]>(() => {
    const filtrada = grano === "TODOS" ? serie : serie.filter((p) => p.cod === grano);
    const map = new Map<string, { exp: number; ind: number }>();
    for (const p of filtrada) {
      const clave = modo === "semanal" ? p.fecha : p.fecha.slice(0, 7);
      if (!map.has(clave)) map.set(clave, { exp: 0, ind: 0 });
      const b = map.get(clave)!;
      if (p.sector === "INDUSTRIA") b.ind += p.tn;
      else b.exp += p.tn;
    }
    const claves = [...map.keys()].sort();
    const ventana = modo === "semanal" ? 52 : 24;
    return claves.slice(-ventana).map((clave) => ({
      clave,
      label: modo === "semanal" ? labelSemana(clave) : labelMes(clave),
      ...map.get(clave)!,
    }));
  }, [serie, grano, modo]);

  if (serie.length === 0) {
    return <div className="chart-wrap chart-empty">Sin historia de compras para graficar.</div>;
  }

  return (
    <div>
      <div className="ng-controles">
        <div className="gx-seg" role="group" aria-label="Frecuencia">
          <button type="button" className={modo === "semanal" ? "on" : ""} onClick={() => setModo("semanal")}>Semanal</button>
          <button type="button" className={modo === "mensual" ? "on" : ""} onClick={() => setModo("mensual")}>Mensual</button>
        </div>
        <label className="lu-field">
          <span>Grano</span>
          <select value={grano} onChange={(e) => setGrano(e.target.value)}>
            <option value="TODOS">Todos</option>
            {productos.map((p) => <option key={p.cod} value={p.cod}>{p.display}</option>)}
          </select>
        </label>
        <span className="ng-hint dim">
          {modo === "semanal" ? "Últimas 52 semanas" : "Últimos 24 meses"} · miles de t
        </span>
      </div>

      <RfChart
        ariaLabel="Histograma de volumen negociado por semana o mes, apilado por sector"
        exportName={`negociado-${modo}-${grano.toLowerCase()}`}
        xTitle={modo === "semanal" ? "Semana" : "Mes"}
        yTitle="Miles de t"
        valueFormatter={(v) => nfmt(v, 0)}
        option={{
          xAxis: { type: "category", data: barras.map((b) => b.label) },
          yAxis: { type: "value", axisLabel: { formatter: (v: number) => nfmt(v / 1000, 0) } },
          series: [
            { name: "Exportación", type: "bar", stack: "total", data: barras.map((b) => b.exp) },
            { name: "Industria", type: "bar", stack: "total", data: barras.map((b) => b.ind) },
          ],
        }}
      />

      <ChartTabla
        titulo={`Datos del gráfico · ${modo === "semanal" ? "semanal" : "mensual"}`}
        columnas={[
          { key: "periodo", label: modo === "semanal" ? "Semana" : "Mes", align: "left" },
          { key: "exp", label: "Exportación (t)" },
          { key: "ind", label: "Industria (t)" },
          { key: "total", label: "Total (t)" },
        ]}
        filas={barras.map((bar) => ({
          periodo: bar.label,
          exp: bar.exp > 0 ? nfmt(bar.exp, 0) : null,
          ind: bar.ind > 0 ? nfmt(bar.ind, 0) : null,
          total: nfmt(bar.exp + bar.ind, 0),
        }))}
        nota="Mismos valores que dibuja el histograma (toneladas), por sector. «—» = sin volumen en ese período."
        colapsable
      />
    </div>
  );
}
