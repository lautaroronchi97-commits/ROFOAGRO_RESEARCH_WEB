"use client";

import * as React from "react";
import { Panel, PanelHead } from "./panel";
import { ChartMarca } from "./chart-marca";
import { sfmt, rfmt, nfmt, numDeInput as num } from "@/lib/format";
import { evaluarFijar, type Lado, type FilaFijar } from "@/lib/fijar";
import { hoyCordoba, parseYmd } from "@/lib/habiles";
import { posicionDeFecha, hoyVencKey } from "@/lib/dates";
import { posicionesCanonicasVivas, precioFuturoConVivo, type PuntasVivo } from "@/lib/fijar-canon";
import { PickerPizarra } from "./precio-dual";
import { usePrecioDual, type GranoPizarraDual } from "./use-precio-dual";
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

/**
 * Gráfico COMBINADO delta (barras, eje izq. USD) + TNA implícita (línea, eje
 * der. %) por plazo — un solo chart, dos escalas independientes sobre el mismo
 * eje X. Se intentó primero (pedido explícito del relevamiento: "estaría bueno
 * el gráfico combinado, si no queda legible por separado") y con 4-6 posiciones
 * queda legible: menos elementos repetidos en la página, menos superficie para
 * que la marca de agua choque con los datos.
 */
function DeltaTnaChart({ filas }: { filas: FilaFijar[] }) {
  if (filas.length === 0) return null;
  const W = Math.max(640, filas.length * 160);
  const H = 300;
  const padT = 32;
  const padB = 34;
  const h = H - padT - padB;
  const bw = W / filas.length;

  const deltaVals = filas.map((f) => f.delta);
  const dMax = Math.max(0, ...deltaVals);
  const dMin = Math.min(0, ...deltaVals);
  const dRange = dMax - dMin || 1;
  const yDelta = (v: number) => padT + ((dMax - v) / dRange) * h;
  const zeroY = yDelta(0);

  // La línea de TNA se queda en la franja SUPERIOR del chart (top 42%), sin
  // compartir el resto del alto con las barras — evita que su etiqueta choque
  // con la etiqueta del delta cuando, para alguna posición, ambos valores caen
  // cerca del mismo punto vertical (encontrado en la verificación real con datos
  // de maíz: la TNA más baja coincidía con la barra más negativa).
  const tnaVals = filas.filter((f) => Number.isFinite(f.tna)).map((f) => f.tna);
  const tMax = tnaVals.length ? Math.max(...tnaVals, 0) : 1;
  const tMin = tnaVals.length ? Math.min(...tnaVals, 0) : 0;
  const tRange = tMax - tMin || 1;
  const hTna = h * 0.42;
  const yTna = (v: number) => padT + ((tMax - v) / tRange) * hTna;

  const pts = filas
    .map((f, i) => (Number.isFinite(f.tna) ? { cx: i * bw + bw / 2, cy: yTna(f.tna), f } : null))
    .filter((p): p is { cx: number; cy: number; f: FilaFijar } => p !== null);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.cx},${p.cy}`).join(" ");

  return (
    <div className="chart-wrap">
      <ChartMarca tamano="chico" />
      <div className="dt-legend">
        <span><i className="dt-sw dt-sw-bar" /> Delta (USD)</span>
        <span><i className="dt-sw dt-sw-line" /> TNA implícita (%)</span>
      </div>
      <svg className="cv" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gráfico combinado: delta por plazo y curva de TNA implícita">
        <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="var(--line-2)" strokeWidth={1} />
        {filas.map((f, i) => {
          const cx = i * bw + bw / 2;
          const barW = Math.min(38, bw * 0.36);
          const yv = yDelta(f.delta);
          const top = Math.min(zeroY, yv);
          const height = Math.max(1, Math.abs(yv - zeroY));
          const pos = f.delta >= 0;
          return (
            <g key={i}>
              <rect x={cx - barW / 2} y={top} width={barW} height={height} rx={2}
                fill={pos ? "var(--pos)" : "var(--neg)"} opacity={0.85} />
              <text x={cx} y={pos ? top - 6 : top + height + 14} textAnchor="middle" fontSize={11}
                fill="var(--ink-2)" fontFamily="var(--font-mono)">{sfmt(f.delta, 1)}</text>
              <text x={cx} y={H - 7} textAnchor="middle" fontSize={10} fill="var(--ink-3)"
                fontFamily="var(--font-mono)">{mesCorto(f.vto)}</text>
            </g>
          );
        })}
        {path && <path d={path} fill="none" stroke="var(--gold-text)" strokeWidth={2.5} />}
        {pts.map((p, i) => (
          <g key={`t${i}`}>
            <circle cx={p.cx} cy={p.cy} r={4} fill="var(--gold-text)" stroke="var(--panel)" strokeWidth={1.5} />
            <text x={p.cx} y={p.cy - 11} textAnchor="middle" fontSize={11} fontWeight={700}
              fill="var(--gold-text)" fontFamily="var(--font-mono)">{rfmt(p.f.tna, 1)}</text>
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
  const pd = usePrecioDual(tcBna);
  const [lado, setLado] = React.useState<Lado>("compro");
  const [tasa, setTasa] = React.useState("10");
  const [curva, setCurva] = React.useState<FilaCurva[]>([]);

  const elegirGrano = (g: GranoPizarraDual) => {
    pd.elegir(g);
    const grano = granos.find((x) => x.underlying === g.underlying);
    if (!grano) return;
    const canonicas = posicionesCanonicasVivas(g.underlying, grano.posiciones, hoyVencKey());
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

  const disponible = num(pd.usd);
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
        <PickerPizarra granos={pizarraDual} onPick={elegirGrano} label="Grano (disponible + curva canónica)" />
        <div className="calc-grid">
          <label className="calc-field">
            <span>Disponible (USD)</span>
            <span className="cell-wrap">
              <input inputMode="decimal" className={pd.editado ? "manual" : ""} value={pd.usd} onChange={(e) => pd.setUsd(e.target.value)} />
              {pd.editado && <button type="button" className="pz-reset" title="Volver a la pizarra" onClick={pd.reset}>↺</button>}
            </span>
          </label>
          <label className="calc-field">
            <span>Disponible (ARS)</span>
            <input inputMode="decimal" className={pd.editado ? "manual" : ""} value={pd.ars} onChange={(e) => pd.setArs(e.target.value)}
              disabled={pd.tc == null} title={pd.tc == null ? "Sin tipo de cambio del día para convertir" : undefined} />
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

        <DeltaTnaChart filas={validas} />

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
