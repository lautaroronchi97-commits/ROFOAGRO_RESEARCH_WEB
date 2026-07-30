"use client";

import { useState } from "react";
import { nfmt } from "@/lib/format";
import { ChartMarca } from "@/components/chart-marca";

type Pt = { x: number; y: number };
type Serie = { name: string; color: string; points: Pt[]; line?: boolean };

const W = 760;
const H = 300;
const pad = { l: 46, r: 16, t: 14, b: 30 };
const iw = W - pad.l - pad.r;
const ih = H - pad.t - pad.b;

/** Tasas implícitas (TNA) por plazo, varias series superpuestas. */
export function ImplicitasChart({ series }: { series: Serie[] }) {
  const [hover, setHover] = useState<{ s: number; p: number } | null>(null);

  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return <div className="ic-wrap" />;

  const maxX = Math.max(...all.map((p) => p.x), 1);
  let minY = Math.min(...all.map((p) => p.y), 0);
  let maxY = Math.max(...all.map((p) => p.y), 0);
  const padY = (maxY - minY) * 0.12 || 1;
  minY -= padY;
  maxY += padY;

  const X = (x: number) => pad.l + (x / maxX) * iw;
  const Y = (y: number) => pad.t + (1 - (y - minY) / (maxY - minY)) * ih;
  const yTicks = Array.from({ length: 5 }, (_, k) => minY + ((maxY - minY) * k) / 4);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxX * f));

  const sorted = series.map((s) => [...s.points].sort((a, b) => a.x - b.x));

  return (
    <div className="ic-wrap">
      <ChartMarca />
      <svg viewBox={`0 0 ${W} ${H}`} className="ic" role="img" aria-label="Tasas implícitas por plazo: dólar futuro, dólar linked, sintéticos y granos">
        {yTicks.map((t, k) => (
          <g key={k}>
            <line className={Math.abs(t) < 1e-9 ? "ic-zero" : "ic-grid"} x1={pad.l} y1={Y(t)} x2={W - pad.r} y2={Y(t)} />
            <text className="ic-axis" x={pad.l - 7} y={Y(t) + 3} textAnchor="end">
              {nfmt(t, 0)}%
            </text>
          </g>
        ))}
        {xTicks.map((t, k) => (
          <text key={k} className="ic-axis" x={X(t)} y={H - 10} textAnchor="middle">
            {t}d
          </text>
        ))}
        {series.map((s, si) => {
          const pts = sorted[si]!; // sorted = series.map(...) → mismo largo e índices que `series`
          const dpath = pts.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
          return (
            <g key={si}>
              {s.line !== false && pts.length > 1 && (
                <path className="ic-line" style={{ stroke: s.color }} d={dpath} />
              )}
              {pts.map((p, pi) => (
                <circle
                  key={pi}
                  className="ic-dot"
                  style={{ fill: s.color }}
                  cx={X(p.x)}
                  cy={Y(p.y)}
                  r={3.2}
                  onPointerEnter={() => setHover({ s: si, p: pi })}
                  onPointerLeave={() => setHover(null)}
                />
              ))}
            </g>
          );
        })}
      </svg>
      {hover &&
        (() => {
          // `hover` es state guardado entre renders: si `series` cambia de largo, s/p pueden
          // quedar afuera — guard real (no `!`), mismo criterio que camiones-chart.tsx.
          const p = sorted[hover.s]?.[hover.p];
          const s = series[hover.s];
          if (!p || !s) return null;
          return (
            <div className="ic-tip" style={{ left: `${(X(p.x) / W) * 100}%`, top: `${(Y(p.y) / H) * 100}%` }}>
              <b>{s.name}</b> · {p.x}d · {nfmt(p.y, 1)}%
            </div>
          );
        })()}
      <div className="ic-legend">
        {series.map((s, si) => (
          <span className="lk" key={si}>
            <span className="sw" style={{ background: s.color }} aria-hidden="true" />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
