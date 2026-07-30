"use client";

import * as React from "react";
import { Panel, PanelHead } from "./panel";
import { ChartMarca } from "./chart-marca";
import { sfmt, rfmt, nfmt, numDeInput as num } from "@/lib/format";
import { evaluarFijar, type Lado, type FilaFijar } from "@/lib/fijar";
import { hoyCordoba, parseYmd } from "@/lib/habiles";
import { posicionDeFecha, hoyVencKey } from "@/lib/dates";
import { posicionesCanonicasVivas, precioFuturoConVivo, type PuntasVivo } from "@/lib/fijar-canon";
import { PrecioDual, type GranoPizarraDual } from "./precio-dual";
import type { GranoCurva } from "@/lib/curva-types";

function IconFijar() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 13h12" />
      <path d="M4 13V8M7 13V5M10 13V9M13 13V6" />
    </svg>
  );
}

function mesCorto(iso: string): string {
  if (!/^\d{4}-\d{2}/.test(iso)) return iso || "—";
  return posicionDeFecha(iso);
}

type FilaCurva = { vto: string; precio: string; estimado: boolean };

/** Gráfico de barras del delta (disponible − futuro) por plazo. */
function DeltaChart({ filas }: { filas: FilaFijar[] }) {
  if (filas.length === 0) return null;
  const W = Math.max(640, filas.length * 140);
  const H = 240;
  const padT = 18;
  const padB = 34;
  const h = H - padT - padB;
  const vals = filas.map((f) => f.delta);
  const maxV = Math.max(0, ...vals);
  const minV = Math.min(0, ...vals);
  const range = maxV - minV || 1;
  const y = (v: number) => padT + ((maxV - v) / range) * h;
  const zeroY = y(0);
  const bw = W / filas.length;

  return (
    <div className="chart-wrap">
      <ChartMarca />
      <svg className="cv" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gráfico del delta por plazo">
        <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="var(--line-2)" strokeWidth={1} />
        {filas.map((f, i) => {
          const cx = i * bw + bw / 2;
          const barW = Math.min(40, bw * 0.5);
          const yv = y(f.delta);
          const top = Math.min(zeroY, yv);
          const height = Math.max(1, Math.abs(yv - zeroY));
          const pos = f.delta >= 0;
          return (
            <g key={i}>
              <rect x={cx - barW / 2} y={top} width={barW} height={height} rx={2}
                fill={pos ? "var(--pos)" : "var(--neg)"} opacity={0.85} />
              <text x={cx} y={pos ? top - 5 : top + height + 12} textAnchor="middle" fontSize={11}
                fill="var(--ink-2)" fontFamily="var(--font-mono)">{sfmt(f.delta, 1)}</text>
              <text x={cx} y={H - 7} textAnchor="middle" fontSize={10} fill="var(--ink-3)"
                fontFamily="var(--font-mono)">{mesCorto(f.vto)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Curva de TNA implícita por posición — SEPARADA del delta (unidades distintas,
 *  USD vs %; combinarlas en un solo eje las volvía ilegibles con datos reales). */
function TnaChart({ filas }: { filas: FilaFijar[] }) {
  const validas = filas.filter((f) => Number.isFinite(f.tna));
  if (validas.length === 0) return null;
  const W = Math.max(640, filas.length * 140);
  const H = 180;
  const padT = 20;
  const padB = 28;
  const h = H - padT - padB;
  const vals = validas.map((f) => f.tna);
  const maxV = Math.max(...vals, 0);
  const minV = Math.min(...vals, 0);
  const range = maxV - minV || 1;
  const y = (v: number) => padT + ((maxV - v) / range) * h;
  const bw = W / filas.length;
  const pts = filas
    .map((f, i) => (Number.isFinite(f.tna) ? { cx: i * bw + bw / 2, cy: y(f.tna), f } : null))
    .filter((p): p is { cx: number; cy: number; f: FilaFijar } => p !== null);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.cx},${p.cy}`).join(" ");

  return (
    <div className="chart-wrap">
      <ChartMarca />
      <svg className="cv" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Curva de TNA implícita por posición">
        <path d={path} fill="none" stroke="var(--brand-deep)" strokeWidth={2} />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.cx} cy={p.cy} r={3} fill="var(--brand-deep)" />
            <text x={p.cx} y={p.cy - 8} textAnchor="middle" fontSize={11} fill="var(--ink-2)" fontFamily="var(--font-mono)">
              {rfmt(p.f.tna, 1)}
            </text>
            <text x={p.cx} y={H - 7} textAnchor="middle" fontSize={10} fill="var(--ink-3)" fontFamily="var(--font-mono)">
              {mesCorto(p.f.vto)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function CalcFijar({
  granos = [],
  pizarraDual = [],
  tcBna = null,
  live = {},
}: {
  granos?: GranoCurva[];
  pizarraDual?: GranoPizarraDual[];
  tcBna?: number | null;
  live?: Record<string, PuntasVivo>;
}) {
  const [disp, setDisp] = React.useState("");
  const [lado, setLado] = React.useState<Lado>("compro");
  const [tasa, setTasa] = React.useState("10");
  const [curva, setCurva] = React.useState<FilaCurva[]>([]);

  const cargarGrano = (underlying: string) => {
    const g = granos.find((x) => x.underlying === underlying);
    if (!g) return;
    const canonicas = posicionesCanonicasVivas(underlying, g.posiciones, hoyVencKey());
    setCurva(
      canonicas.map((p) => {
        const { precio, estimado } = precioFuturoConVivo(p.precio, live[p.symbol]);
        return { vto: p.vto, precio: String(precio), estimado };
      }),
    );
  };

  const setFila = (i: number, campo: "vto" | "precio", val: string) =>
    setCurva((c) => c.map((f, j) => (j === i ? { ...f, [campo]: val, ...(campo === "precio" ? { estimado: false } : {}) } : f)));
  const agregar = () => setCurva((c) => [...c, { vto: "", precio: "", estimado: false }]);
  const quitar = (i: number) => setCurva((c) => c.filter((_, j) => j !== i));

  const disponible = num(disp);
  const tasaComp = num(tasa);
  const hoyMs = parseYmd(hoyCordoba()).getTime();
  const vtoMs = (vto: string) => (vto ? parseYmd(vto).getTime() : null);

  // Fila alineada a cada renglón de la curva (null si el renglón es inválido).
  const filas = curva.map((f) => {
    const precio = num(f.precio);
    if (!f.vto || !Number.isFinite(precio) || precio <= 0) return null;
    const [r] = evaluarFijar(disponible, lado, tasaComp, [{ vto: f.vto, precio }], hoyMs, vtoMs);
    return r ?? null;
  });
  const validas = filas.filter((f): f is FilaFijar => f !== null);

  return (
    <Panel id="calc-fijar">
      <PanelHead glyph={<IconFijar />} title="Cotizador — negocios a fijar" sub="Delta disponible vs curva de futuros" />

      <div className="calc">
        <PrecioDual
          granos={pizarraDual}
          tcBna={tcBna}
          valorUsd={disp}
          onValorUsd={setDisp}
          onGranoChange={cargarGrano}
          label="Grano (disponible + curva canónica)"
        />
        <div className="calc-grid">
          <label className="calc-field">
            <span>Disponible (USD)</span>
            <input inputMode="decimal" value={disp} onChange={(e) => setDisp(e.target.value)} />
          </label>
          <label className="calc-field">
            <span>Negocio</span>
            <select value={lado} onChange={(e) => setLado(e.target.value as Lado)}>
              <option value="compro">Compro a fijar</option>
              <option value="vendo">Vendo a fijar</option>
            </select>
          </label>
          <label className="calc-field">
            <span>Tasa comparación (TNA %)</span>
            <input inputMode="decimal" value={tasa} onChange={(e) => setTasa(e.target.value)} />
          </label>
        </div>

        <DeltaChart filas={validas} />
        <TnaChart filas={validas} />

        <div className="table-scroll">
          <table className="tbl" style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th className="l" scope="col">Vencimiento</th>
                <th scope="col">Futuro</th>
                <th scope="col">Días</th>
                <th scope="col">Delta</th>
                <th scope="col">TNA impl.</th>
                <th scope="col">Resultado</th>
                <th scope="col">Precio a tu tasa</th>
                <th scope="col" aria-label="quitar" />
              </tr>
            </thead>
            <tbody>
              {curva.map((f, i) => {
                const r = filas[i];
                const bateTasa = r && Number.isFinite(r.tna) && r.tna > tasaComp;
                return (
                  <tr key={i}>
                    <td className="l">
                      <input className="cell-in" type="date" value={f.vto} onChange={(e) => setFila(i, "vto", e.target.value)} />
                    </td>
                    <td>
                      <span className="cell-wrap">
                        <input className="cell-in num" inputMode="decimal" value={f.precio} onChange={(e) => setFila(i, "precio", e.target.value)} />
                        {f.estimado && (
                          <span className="pz-estim" title="A3 todavía no operó esta posición hoy: es el promedio comprador/vendedor en vivo, no un precio operado.">
                            estimado
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="dim">{r ? r.dias : "—"}</td>
                    <td className="dim">{r ? sfmt(r.delta, 2) : "—"}</td>
                    <td className={bateTasa ? "pos" : "dim"}>{r ? rfmt(r.tna, 1) : "—"}</td>
                    <td className={r ? (r.favorable ? "pos" : "neg") : "dim"}>{r ? sfmt(r.resultado, 2) : "—"}</td>
                    <td className="dim">{r && Number.isFinite(r.precioTasa) ? nfmt(r.precioTasa, 2) : "—"}</td>
                    <td>
                      <button type="button" className="cell-del" onClick={() => quitar(i)} aria-label="Quitar posición">×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className="calc-add" onClick={agregar}>+ posición</button>
      </div>

      <div className="panel-note">
        <span>
          <span className="k">A fijar</span> Delta = disponible − futuro (sin costo de oportunidad) · TNA impl. =
          (futuro/disponible − 1) × 365/días · Resultado = compro a fijar → futuro − disponible; vendo a fijar →
          disponible − futuro (verde = a favor). <b>Comparador</b>: la TNA impl. se pinta verde cuando supera tu
          tasa; «Precio a tu tasa» = futuro teórico si el carry rindiera exactamente esa tasa. Al elegir un grano
          se cargan sus posiciones canónicas con el precio en vivo de A3 (o el promedio comprador/vendedor,
          marcado «estimado», si todavía no operó); podés editar cualquier campo o agregar posiciones sueltas.
          Toma el precio de <b>futuros</b>, que puede diferir del spot al fijar (riesgo de base).
        </span>
      </div>
    </Panel>
  );
}
