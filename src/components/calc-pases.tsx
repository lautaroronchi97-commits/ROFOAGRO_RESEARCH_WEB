"use client";

import * as React from "react";
import { Panel, PanelHead } from "./panel";
import { sfmt, rfmt, pfmt, numDeInput as num, fmtInputDate as fmtInput } from "@/lib/format";
import { pase, tasaDirectaPase, tnaPase } from "@/lib/pases";
import { parseYmd, diasCorridos, sumarCorridos, hoyCordoba, fmtFecha } from "@/lib/habiles";
import { CurvaPicker } from "./curva-picker";
import type { GranoCurva } from "@/lib/curva-types";

function IconPase() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h8M9 4l2 2-2 2" /><path d="M13 10H5m2-2-2 2 2 2" />
    </svg>
  );
}

export function CalcPases({ granos = [] }: { granos?: GranoCurva[] }) {
  const [precioCorta, setPrecioCorta] = React.useState("323");
  const [precioLarga, setPrecioLarga] = React.useState("333");
  const [vtoCorta, setVtoCorta] = React.useState(() => fmtInput(sumarCorridos(parseYmd(hoyCordoba()), 30)));
  const [vtoLarga, setVtoLarga] = React.useState(() => fmtInput(sumarCorridos(parseYmd(hoyCordoba()), 120)));
  const [quita, setQuita] = React.useState("1");

  const pc = num(precioCorta), pl = num(precioLarga);
  const dias = vtoCorta && vtoLarga ? Math.max(0, diasCorridos(parseYmd(vtoCorta), parseYmd(vtoLarga))) : NaN;
  const p = pase(pc, pl); // spread lleno = cercana (venta) − lejana (compra)
  const q = num(quita);
  const aFijar = Number.isFinite(p) && Number.isFinite(q) ? p - q : NaN;
  const dir = tasaDirectaPase(pc, pl);
  const tna = tnaPase(pc, pl, dias);
  const enCarry = Number.isFinite(p) && p < 0;

  return (
    <Panel id="calc-pases">
      <PanelHead glyph={<IconPase />} title="Cotizador — pases" sub="Spread entre venta y compra · quita a cliente" />
      <div className="calc">
        <div className="curva-pick-row">
          <CurvaPicker granos={granos} label="Venta desde A3" onPick={(p) => { setPrecioCorta(String(p.precio)); setVtoCorta(p.vto); }} />
          <CurvaPicker granos={granos} label="Compra desde A3" onPick={(p) => { setPrecioLarga(String(p.precio)); setVtoLarga(p.vto); }} />
        </div>
        <div className="calc-grid">
          <label className="calc-field"><span>Posición vendida (cercana) — precio</span>
            <input inputMode="decimal" value={precioCorta} onChange={(e) => setPrecioCorta(e.target.value)} /></label>
          <label className="calc-field"><span>Posición vendida — vto</span>
            <input type="date" suppressHydrationWarning value={vtoCorta} onChange={(e) => setVtoCorta(e.target.value)} /></label>
          <label className="calc-field"><span>Posición comprada (lejana) — precio</span>
            <input inputMode="decimal" value={precioLarga} onChange={(e) => setPrecioLarga(e.target.value)} /></label>
          <label className="calc-field"><span>Posición comprada — vto</span>
            <input type="date" suppressHydrationWarning value={vtoLarga} onChange={(e) => setVtoLarga(e.target.value)} /></label>
          <label className="calc-field"><span>Quita a cliente (USD)</span>
            <input inputMode="decimal" value={quita} onChange={(e) => setQuita(e.target.value)} /></label>
        </div>

        {enCarry && (
          <p className="calc-warn">⚠️ Cuidado: el pase es negativo, la posición está en carry.</p>
        )}

        <div className="calc-out">
          <div className="calc-res">
            <span className="calc-res-lbl">A fijar (resultado − quita)</span>
            <span className={`calc-res-val ${Number.isFinite(aFijar) ? (aFijar >= 0 ? "" : "rojo") : ""}`}>
              {Number.isFinite(aFijar) ? sfmt(aFijar, 2) : "—"}
            </span>
          </div>
          <div className="calc-res">
            <span className="calc-res-lbl">Plazo hasta la compra</span>
            <span className="calc-res-val">{vtoLarga ? fmtFecha(parseYmd(vtoLarga)) : "—"}</span>
            <span className="calc-res-sub">{Number.isFinite(dias) ? `${dias} días` : "—"}</span>
          </div>
        </div>

        <div className="calc-meta">
          <span>Spread lleno (venta − compra): <b className={p > 0 ? "pos" : p < 0 ? "neg" : ""}>{sfmt(p, 2)}</b></span>
          <span>Tasa directa: <b>{pfmt(dir, 2)}</b></span>
          <span>TNA USD: <b>{rfmt(tna, 1)}</b></span>
          <span>{vtoCorta ? fmtFecha(parseYmd(vtoCorta)) : "—"} → {vtoLarga ? fmtFecha(parseYmd(vtoLarga)) : "—"}</span>
        </div>
      </div>
      <div className="panel-note">
        <span>
          <span className="k">Pase</span> Spread lleno = precio de la posición vendida (cercana) − precio de la
          comprada (lejana). Si es <b>negativo</b>, la posición está en carry (cuidado). La <b>quita</b> se resta
          al spread para llegar a «A fijar», lo que efectivamente se le reconoce al cliente. Tasa directa/TNA
          quedan sobre lejana/cercana − 1, informativas. Precios a mano; con la curva A3 salen por par de
          posiciones.
        </span>
      </div>
    </Panel>
  );
}
