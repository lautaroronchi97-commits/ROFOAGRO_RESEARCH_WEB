"use client";

import * as React from "react";
import { Panel, PanelHead } from "./panel";
import { ChartMarca } from "./chart-marca";
import { sfmt, rfmt, nfmt, numDeInput as num } from "@/lib/format";
import { evaluarFijar, type PosCurva, type Lado, type FilaFijar } from "@/lib/fijar";
import { hoyCordoba, parseYmd } from "@/lib/habiles";
import { posicionDeFecha } from "@/lib/dates";
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

const CURVA_INI: PosCurva[] = [
  { vto: "2026-07-31", precio: 328 },
  { vto: "2026-09-30", precio: 333 },
  { vto: "2026-12-31", precio: 340 },
  { vto: "2027-04-30", precio: 350 },
];

/** Gráfico de barras del delta (disponible − futuro) por plazo.
 * W/H fijados a la MISMA convención que el resto de los charts del sitio
 * (dolar-futuro-chart/evolucion-chart/negociado-chart: ~640×240) — el viewBox
 * chico anterior (280×150) quedaba desproporcionado al estirarse a 100% del
 * ancho real del panel (~1300px): un factor de escala ~4,4x volvía gigantes
 * los textos de 11/10px. Bug preexistente, no introducido por el rediseño;
 * encontrado al verificar visualmente esta sesión. */
function DeltaChart({ filas }: { filas: FilaFijar[] }) {
  if (filas.length === 0) return null;
  const W = Math.max(640, filas.length * 140);
  const H = 240;
  const padT = 18;
  // padB con margen extra (24→34): la etiqueta del valor de una barra negativa
  // se dibuja DEBAJO de la barra (top+height+12) — con el bug de escala
  // corregido arriba, la barra de mayor magnitud llegaba a solaparse con el
  // mes del eje (H-7). Pre-existente también (visible ya en el viewBox viejo).
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

export function CalcFijar({ granos = [] }: { granos?: GranoCurva[] }) {
  const [disp, setDisp] = React.useState("320");
  const [lado, setLado] = React.useState<Lado>("compro");
  const [tasa, setTasa] = React.useState("10");
  const [curva, setCurva] = React.useState<{ vto: string; precio: string }[]>(
    CURVA_INI.map((p) => ({ vto: p.vto, precio: String(p.precio) })),
  );

  const setFila = (i: number, campo: "vto" | "precio", val: string) =>
    setCurva((c) => c.map((f, j) => (j === i ? { ...f, [campo]: val } : f)));
  const agregar = () => setCurva((c) => [...c, { vto: "", precio: "" }]);
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
        {granos.length > 0 && (
          <div className="curva-pick">
            <span className="curva-pick-lbl">Traer curva de A3</span>
            <select
              aria-label="Grano"
              defaultValue=""
              onChange={(e) => {
                const g = granos[Number(e.target.value)];
                if (g) setCurva(g.posiciones.map((p) => ({ vto: p.vto, precio: String(p.precio) })));
                e.currentTarget.selectedIndex = 0;
              }}
            >
              <option value="" disabled>Grano…</option>
              {granos.map((g, i) => (
                <option key={g.underlying} value={i}>{g.nombre}</option>
              ))}
            </select>
          </div>
        )}
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
                      <input className="cell-in num" inputMode="decimal" value={f.precio} onChange={(e) => setFila(i, "precio", e.target.value)} />
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
          tasa; «Precio a tu tasa» = futuro teórico si el carry rindiera exactamente esa tasa. Toma el precio de
          <b> futuros</b>, que puede diferir del spot al fijar (riesgo de base).
        </span>
      </div>
    </Panel>
  );
}
