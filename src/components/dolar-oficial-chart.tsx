"use client";

import { useState } from "react";
import { nfmt } from "@/lib/format";
import { ChartMarca } from "./chart-marca";
import { ChartTabla, type ChartTablaColumna, type ChartTablaFila } from "./chart-tabla";

const W = 660;
const H = 200;
const pad = { l: 56, r: 16, t: 16, b: 26 };
const iw = W - pad.l - pad.r;
const ih = H - pad.t - pad.b;

function fmtFecha(fechaISO: string): string {
  const [, m, d] = fechaISO.split("-");
  return `${d}/${m}`;
}

export type PuntoDolar = { fecha: string; valor: number };

/**
 * Variación semanal del dólar OFICIAL (BCRA A3500, variable 5) — ítem 13 del backlog viejo /
 * P2 de PLAN_BACKLOG.md, resuelto de paso al construir MP2 (informe semanal). Reusado en
 * `/dolar` (vivo) y en la plantilla del informe semanal (mismo componente, mismos datos).
 *
 * OJO fuente: es el tipo de cambio de referencia de BCRA (Comunicación A 3500), NO el spot
 * `UST$T` de MAE que usa el resto de la web para "oficial mayorista" — ese spot no tiene
 * historial en ningún lado (ver `src/lib/informe-semanal.ts`). Trae el spread bancario
 * implícito; se muestra igual, con la fuente aclarada, por decisión de Lautaro (23/07).
 *
 * `sinTabla` (V3, PLAN_INFORMES_V2.md §6.3): la plantilla del informe semanal la usa para
 * omitir el `ChartTabla` de acá abajo — es el recorte elegido en la página de dólar/Chicago
 * para hacerle lugar a "El mundo esta semana" sin pasar de 5 páginas (la tabla es una
 * relectura del mismo gráfico; el dato completo sigue disponible en vivo en `/dolar`). Default
 * `false`: `/dolar` (la página en vivo) no pasa la prop y queda exactamente como estaba.
 */
export function DolarOficialChart({ serie, sinTabla = false }: { serie: PuntoDolar[]; sinTabla?: boolean }) {
  const [hi, setHi] = useState<number | null>(null);

  if (serie.length < 2) {
    return <div className="chart-wrap chart-empty">Sin suficiente historial todavía para el gráfico semanal.</div>;
  }

  const ys = serie.map((p) => p.valor);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  const padv = (yMax - yMin) * 0.18 || Math.abs(yMax) * 0.02 || 1;
  yMin -= padv;
  yMax += padv;

  const X = (i: number) => pad.l + (i / (serie.length - 1)) * iw;
  const Y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * ih;

  const yTicks = Array.from({ length: 4 }, (_, k) => yMin + ((yMax - yMin) * k) / 3);
  const d = serie.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.valor).toFixed(1)}`).join(" ");

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

  const ultimo = serie[serie.length - 1]!.valor; // serie.length<2 ya salió arriba
  // `hi` es state entre renders: si `serie` cambia de largo puede quedar afuera — guard real.
  const hiPt = hi !== null ? serie[hi] : undefined;

  const columnas: ChartTablaColumna[] = [
    { key: "fecha", label: "Fecha", align: "left" },
    { key: "valor", label: "$ oficial (BCRA A3500)" },
  ];
  const filas: ChartTablaFila[] = serie.map((p) => ({ fecha: fmtFecha(p.fecha), valor: nfmt(p.valor, 2) }));

  return (
    <>
      <div className="chart-wrap">
        <ChartMarca />
        <svg viewBox={`0 0 ${W} ${H}`} className="cv" role="img" aria-label="Dólar oficial (BCRA A3500), últimos días">
          {yTicks.map((t, k) => (
            <g key={k}>
              <line className="cv-grid" x1={pad.l} y1={Y(t)} x2={W - pad.r} y2={Y(t)} />
              <text className="cv-axis" x={pad.l - 7} y={Y(t) + 3} textAnchor="end">
                {nfmt(t, 0)}
              </text>
            </g>
          ))}
          {serie.map((p, i) => (
            <text key={i} className="cv-axis" x={X(i)} y={H - 7} textAnchor="middle">
              {fmtFecha(p.fecha)}
            </text>
          ))}
          <g className="evo-serie org-DOLAR">
            <path d={d} className="evo-line" />
            {serie.map((p, i) => (
              <circle key={i} cx={X(i)} cy={Y(p.valor)} r={2.6} className="evo-dot" />
            ))}
            <circle cx={X(serie.length - 1)} cy={Y(ultimo)} r={4} className="evo-end" />
          </g>
          {hi !== null && hiPt && (
            <>
              <line className="cv-cross" x1={X(hi)} y1={pad.t} x2={X(hi)} y2={pad.t + ih} />
              <circle className="evo-focus" cx={X(hi)} cy={Y(hiPt.valor)} r={5} />
            </>
          )}
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
          <div className="cv-tip" style={{ left: `${(X(hi) / W) * 100}%`, top: `${(Y(hiPt.valor) / H) * 100}%` }}>
            <span className="tt-x">{fmtFecha(hiPt.fecha)}</span> · $ {nfmt(hiPt.valor, 2)}
          </div>
        )}
        <div className="cv-legend">
          <span className="lk org-DOLAR">
            <span className="sw evo-sw" />
            Oficial mayorista (BCRA A3500)
            <span className="lk-val">$ {nfmt(ultimo, 2)}</span>
          </span>
        </div>
      </div>
      {!sinTabla && (
        <ChartTabla
          columnas={columnas}
          filas={filas}
          maxFilas={5}
          orden="desc"
          nota="BCRA A3500 (Comunicación 3500) — no es el spot UST$T de MAE que usa el resto de la web para el oficial mayorista; se usa acá por ser la única fuente con historial diario real."
        />
      )}
    </>
  );
}
