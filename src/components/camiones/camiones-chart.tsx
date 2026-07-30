"use client";

import { useState } from "react";
import { nfmt } from "@/lib/format";
import { ChartMarca } from "../chart-marca";
import { ChartTabla, type ChartTablaColumna, type ChartTablaFila } from "../chart-tabla";

/**
 * Gráfico multi-serie de camiones en puerto (por zona o por producto, según lo que pase el
 * caller) — mismo motor SVG a mano que `evolucion-chart.tsx` (eje X temporal real, tooltip por
 * cercanía, leyenda con último valor), generalizado para no depender de organismos de estimaciones.
 * ChartMarca + ChartTabla (patrón 20/07: doble lectura + marca de agua en TODOS los gráficos).
 */

const W = 660;
const H = 260;
const pad = { l: 48, r: 16, t: 16, b: 30 };
const iw = W - pad.l - pad.r;
const ih = H - pad.t - pad.b;

export type SerieCamiones = { key: string; display: string; puntos: { fecha: string; cantidad: number }[] };

type Flat = { s: number; key: string; display: string; ms: number; valor: number; fecha: string };

function epoch(fechaISO: string): number {
  return Date.parse(`${fechaISO}T00:00:00Z`);
}

function fmtDia(ms: number): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit" }).format(new Date(ms));
}

function fmtFecha(fechaISO: string): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${fechaISO}T00:00:00Z`),
  );
}

function tablaDeSeries(series: SerieCamiones[]): { columnas: ChartTablaColumna[]; filas: ChartTablaFila[] } {
  const columnas: ChartTablaColumna[] = [
    { key: "fecha", label: "Fecha", align: "left" },
    ...series.map((s) => ({ key: s.key, label: `${s.display} (camiones)` })),
  ];
  const porFecha = new Map<string, ChartTablaFila>();
  for (const s of series) {
    for (const p of s.puntos) {
      let fila = porFecha.get(p.fecha);
      if (!fila) {
        fila = { fecha: fmtFecha(p.fecha) };
        porFecha.set(p.fecha, fila);
      }
      fila[s.key] = nfmt(p.cantidad, 0);
    }
  }
  const filas = [...porFecha.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, f]) => f);
  return { columnas, filas };
}

export function CamionesChart({
  series,
  colorClassPrefix,
  tituloAria,
  tablaColapsable = false,
  tablaAbierta,
  onToggleTabla,
}: {
  series: SerieCamiones[];
  colorClassPrefix: string;
  tituloAria: string;
  /** Opt-in (relevamiento web R9 punto 53): la `ChartTabla` interna arranca cerrada, coordinada
   *  por el padre (`abierta`/`onToggleAbierta`). Sin esto, sigue siempre-visible como hoy. */
  tablaColapsable?: boolean;
  tablaAbierta?: boolean;
  onToggleTabla?: () => void;
}) {
  const [hi, setHi] = useState<number | null>(null);

  const flat: Flat[] = [];
  series.forEach((s, i) => s.puntos.forEach((p) => flat.push({ s: i, key: s.key, display: s.display, ms: epoch(p.fecha), valor: p.cantidad, fecha: p.fecha })));
  if (flat.length === 0) {
    return <div className="chart-wrap chart-empty">Sin datos para mostrar.</div>;
  }

  const xs = flat.map((f) => f.ms);
  const ys = flat.map((f) => f.valor);
  let xMin = Math.min(...xs);
  let xMax = Math.max(...xs);
  if (xMin === xMax) {
    xMin -= 15 * 86400000;
    xMax += 15 * 86400000;
  }
  const yMin = Math.min(0, ...ys);
  let yMax = Math.max(...ys);
  const padv = (yMax - yMin) * 0.1 || 1;
  yMax += padv;

  const X = (ms: number) => pad.l + ((ms - xMin) / (xMax - xMin)) * iw;
  const Y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * ih;

  const yTicks = Array.from({ length: 5 }, (_, k) => yMin + ((yMax - yMin) * k) / 4);
  const xTicks = Array.from({ length: 5 }, (_, k) => xMin + ((xMax - xMin) * k) / 4);

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    let best = 0;
    let bd = Infinity;
    flat.forEach((f, i) => {
      const d = (X(f.ms) - px) ** 2 + (Y(f.valor) - py) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHi(best);
  }

  const tabla = tablaDeSeries(series);
  // `hi` es un índice guardado en state; si `series` cambia entre renders `flat` puede achicarse
  // y dejarlo apuntando afuera — guard real (no `!`), no es un invariante de un solo render.
  const hiFlat = hi !== null ? flat[hi] : undefined;

  return (
    <>
      <div className="chart-wrap">
        <ChartMarca />
        <svg viewBox={`0 0 ${W} ${H}`} className="cv" role="img" aria-label={tituloAria}>
          {yTicks.map((t, k) => (
            <g key={`y${k}`}>
              <line className="cv-grid" x1={pad.l} y1={Y(t)} x2={W - pad.r} y2={Y(t)} />
              <text className="cv-axis" x={pad.l - 7} y={Y(t) + 3} textAnchor="end">{nfmt(t, 0)}</text>
            </g>
          ))}
          {xTicks.map((t, k) => (
            <text key={`x${k}`} className="cv-axis" x={X(t)} y={H - 9} textAnchor="middle">{fmtDia(t)}</text>
          ))}
          {series.map((s) => {
            const pts = s.puntos;
            if (pts.length === 0) return null;
            const d = pts.map((p, i) => `${i ? "L" : "M"}${X(epoch(p.fecha)).toFixed(1)},${Y(p.cantidad).toFixed(1)}`).join(" ");
            return (
              <g key={s.key} className={`evo-serie ${colorClassPrefix}${s.key}`}>
                <path d={d} className="evo-line" />
                {pts.map((p, i) => (
                  <circle key={i} cx={X(epoch(p.fecha))} cy={Y(p.cantidad)} r={2.2} className="evo-dot" />
                ))}
                <circle cx={X(epoch(pts[pts.length - 1]!.fecha))} cy={Y(pts[pts.length - 1]!.cantidad)} r={4} className="evo-end" />
              </g>
            );
          })}
          {hiFlat && (
            <g className={`${colorClassPrefix}${hiFlat.key}`}>
              <line className="cv-cross" x1={X(hiFlat.ms)} y1={pad.t} x2={X(hiFlat.ms)} y2={pad.t + ih} />
              <circle className="evo-focus" cx={X(hiFlat.ms)} cy={Y(hiFlat.valor)} r={5} />
            </g>
          )}
          <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" style={{ cursor: "crosshair" }} onPointerMove={onMove} onPointerLeave={() => setHi(null)} />
        </svg>
        {hiFlat && (
          <div className="cv-tip" style={{ left: `${(X(hiFlat.ms) / W) * 100}%`, top: `${(Y(hiFlat.valor) / H) * 100}%` }}>
            <span className="tt-x">{hiFlat.display}</span> · {nfmt(hiFlat.valor, 0)} camiones
            <span className="cv-tip-sub">{fmtFecha(hiFlat.fecha)}</span>
          </div>
        )}
        <div className="cv-legend">
          {series.map((s) => (
            <span className={`lk ${colorClassPrefix}${s.key}`} key={s.key}>
              <span className="sw evo-sw" />
              {s.display}
              <span className="lk-val">{s.puntos.length ? nfmt(s.puntos[s.puntos.length - 1]!.cantidad, 0) : "—"}</span>
            </span>
          ))}
        </div>
      </div>
      <ChartTabla
        columnas={tabla.columnas}
        filas={tabla.filas}
        nota="Una fila por día con dato; cantidad de CAMIONES (no toneladas)."
        colapsable={tablaColapsable}
        abierta={tablaAbierta}
        onToggleAbierta={onToggleTabla}
      />
    </>
  );
}
