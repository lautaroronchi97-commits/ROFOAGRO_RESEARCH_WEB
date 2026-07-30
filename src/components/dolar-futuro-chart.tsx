"use client";

import { nfmt } from "@/lib/format";
import { useCrosshair, SvgLineChartBase } from "@/components/chart-svg-base";

type Pt = { label: string; value: number };

const W = 640;
const H = 320;
const pad = { l: 46, r: 14, t: 14, b: 26 };
const iw = W - pad.l - pad.r;
const ih = H - pad.t - pad.b;

/** Posición X de un índice (función pura, fuera del componente para poder usarla dentro del
 *  callback de `useCrosshair` sin depender del orden de declaración de variables locales). */
function xDe(nPuntos: number, i: number): number {
  return pad.l + (nPuntos <= 1 ? 0 : (i / (nPuntos - 1)) * iw);
}

/** Curva de dólar futuro — SVG a mano (motor compartido `chart-svg-base.tsx`) con crosshair + tooltip. */
export function DolarFuturoChart({ points }: { points: Pt[] }) {
  // `useCrosshair` (hook) tiene que llamarse SIEMPRE, antes de cualquier return condicional
  // (rules-of-hooks) — el guard de `points.length===0` se resuelve DENTRO de `hallar`.
  const { hi, onPointerMove, onPointerLeave } = useCrosshair(W, H, (px) => {
    if (points.length === 0) return null;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(xDe(points.length, i) - px);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  });

  if (points.length === 0) return <div className="chart-wrap" />;

  const vals = points.map((p) => p.value);
  let mn = Math.min(...vals);
  let mx = Math.max(...vals);
  const padv = (mx - mn) * 0.12 || 1;
  mn -= padv;
  mx += padv;

  const X = (i: number) => xDe(points.length, i);
  const Y = (v: number) => pad.t + (1 - (v - mn) / (mx - mn)) * ih;

  const yTicks = Array.from({ length: 5 }, (_, k) => mn + ((mx - mn) * k) / 4);
  const line = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.value).toFixed(1)}`).join(" ");
  const area =
    `M${pad.l},${pad.t + ih} ` +
    points.map((p, i) => `L${X(i).toFixed(1)},${Y(p.value).toFixed(1)}`).join(" ") +
    ` L${X(points.length - 1).toFixed(1)},${pad.t + ih} Z`;
  const last = points.length - 1;
  // `hi` es state entre renders: si `points` cambia de largo puede quedar afuera — guard real.
  const hiPt = hi !== null ? points[hi] : undefined;

  return (
    <SvgLineChartBase
      w={W}
      h={H}
      inner={{ x: pad.l, y: pad.t, width: iw, height: ih }}
      ariaLabel="Curva de precios de dólar futuro por posición"
      yTicks={yTicks.map((t) => ({ valor: t, y: Y(t), label: nfmt(t, 0) }))}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      defs={
        <linearGradient id="cvGrad" x1="0" y1="0" x2="0" y2="1">
          <stop className="cv-grad-a" offset="0" />
          <stop className="cv-grad-b" offset="1" />
        </linearGradient>
      }
      after={
        hi !== null &&
        hiPt && (
          <div
            className="cv-tip"
            style={{ left: `${(X(hi) / W) * 100}%`, top: `${(Y(hiPt.value) / H) * 100}%` }}
          >
            <span className="tt-x">{hiPt.label}</span> · $ {nfmt(hiPt.value, 1)}
          </div>
        )
      }
    >
      <path d={area} className="cv-area" fill="url(#cvGrad)" />
      <path d={line} className="cv-line" />
      {points.map((p, i) => (
        <text key={`x${i}`} className="cv-axis" x={X(i)} y={H - 8} textAnchor="middle">
          {p.label}
        </text>
      ))}
      {points.map((p, i) =>
        i < last ? <circle key={`d${i}`} cx={X(i)} cy={Y(p.value)} r={2.4} className="cv-dot" /> : null,
      )}
      <circle cx={X(last)} cy={Y(points[last]!.value)} r={4.5} className="cv-end" />
      {hi !== null && hiPt && (
        <>
          <line className="cv-cross" x1={X(hi)} y1={pad.t} x2={X(hi)} y2={pad.t + ih} />
          <circle className="cv-focus" cx={X(hi)} cy={Y(hiPt.value)} r={5} />
        </>
      )}
    </SvgLineChartBase>
  );
}
