"use client";

import { useState } from "react";
import { nfmt } from "@/lib/format";
import { ChartMarca } from "./chart-marca";
import { ChartTabla, type ChartTablaColumna, type ChartTablaFila } from "./chart-tabla";
import { RangoChips } from "./rango-chips";
import type { PuntoBcraMulc } from "@/lib/bcra-mulc";

type Rango = "30" | "60" | "90";
const OPCIONES_RANGO: { label: string; value: Rango }[] = [
  { label: "30D", value: "30" },
  { label: "60D", value: "60" },
  { label: "90D", value: "90" },
];

const W = 660;
const H = 200;
const pad = { l: 56, r: 16, t: 16, b: 26 };
const iw = W - pad.l - pad.r;
const ih = H - pad.t - pad.b;

function fmtFecha(fechaISO: string): string {
  const [, m, d] = fechaISO.split("-");
  return `${d}/${m}`;
}

/**
 * Compras netas de divisas del BCRA en el MULC (C4) — barras diarias en M USD: verde compra neta,
 * rojo venta neta. Las barras de carga manual (todavía sin confirmar por la oficial) van más
 * tenues para distinguirlas de un vistazo; se pisan solas cuando llega el dato de la API.
 */
export function BcraMulcChart({ serie: serieCompleta }: { serie: PuntoBcraMulc[] }) {
  const [hi, setHi] = useState<number | null>(null);
  const [rango, setRango] = useState<Rango>("90");

  if (serieCompleta.length === 0) {
    return <div className="chart-wrap chart-empty">Sin datos todavía para el gráfico.</div>;
  }

  const serie = serieCompleta.slice(-Number(rango));
  const vals = serie.map((p) => p.montoMusd);
  let yMin = Math.min(0, ...vals);
  let yMax = Math.max(0, ...vals);
  const padv = (yMax - yMin) * 0.14 || 10;
  yMin -= padv;
  yMax += padv;

  const bw = Math.max(2, Math.min(14, iw / serie.length - 2));
  const X = (i: number) => pad.l + ((i + 0.5) / serie.length) * iw;
  const Y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * ih;
  const y0 = Y(0);

  const yTicks = Array.from({ length: 4 }, (_, k) => yMin + ((yMax - yMin) * k) / 3);
  const step = Math.max(1, Math.ceil(serie.length / 6));

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bd = Infinity;
    serie.forEach((_, i) => {
      const dist = Math.abs(X(i) - px);
      if (dist < bd) {
        bd = dist;
        best = i;
      }
    });
    setHi(best);
  }
  // `hi` es state entre renders: si `serie` cambia de largo puede quedar afuera — guard real.
  const hiPt = hi !== null ? serie[hi] : undefined;

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
      <div className="chart-wrap">
        <ChartMarca />
        <svg viewBox={`0 0 ${W} ${H}`} className="cv" role="img" aria-label="Compras netas del BCRA en el MULC, M USD por día">
          {yTicks.map((t, k) => (
            <g key={k}>
              <line className="cv-grid" x1={pad.l} y1={Y(t)} x2={W - pad.r} y2={Y(t)} />
              <text className="cv-axis" x={pad.l - 7} y={Y(t) + 3} textAnchor="end">
                {nfmt(t, 0)}
              </text>
            </g>
          ))}
          <line x1={pad.l} y1={y0} x2={W - pad.r} y2={y0} className="cv-grid" />
          {serie.map((p, i) =>
            i % step === 0 ? (
              <text key={i} className="cv-axis" x={X(i)} y={H - 7} textAnchor="middle">
                {fmtFecha(p.fecha)}
              </text>
            ) : null,
          )}
          {serie.map((p, i) => {
            const yTop = p.montoMusd >= 0 ? Y(p.montoMusd) : y0;
            const yBottom = p.montoMusd >= 0 ? y0 : Y(p.montoMusd);
            return (
              <rect
                key={i}
                x={X(i) - bw / 2}
                y={yTop}
                width={bw}
                height={Math.max(1, yBottom - yTop)}
                style={{
                  fill: p.montoMusd >= 0 ? "var(--pos)" : "var(--neg)",
                  opacity: p.fuente === "manual" ? 0.5 : 0.92,
                }}
              />
            );
          })}
          {hi !== null && <line className="cv-cross" x1={X(hi)} y1={pad.t} x2={X(hi)} y2={pad.t + ih} />}
          <rect
            x={pad.l}
            y={pad.t}
            width={iw}
            height={ih}
            fill="transparent"
            style={{ cursor: "crosshair" }}
            onPointerMove={onMove}
            onPointerLeave={() => setHi(null)}
          />
        </svg>
        {hi !== null && hiPt && (
          <div className="cv-tip" style={{ left: `${(X(hi) / W) * 100}%`, top: `${(Y(Math.max(0, hiPt.montoMusd)) / H) * 100}%` }}>
            <span className="tt-x">{fmtFecha(hiPt.fecha)}</span> · {nfmt(hiPt.montoMusd, 1)} M USD
            {hiPt.fuente === "manual" ? " (manual)" : ""}
          </div>
        )}
      </div>
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
