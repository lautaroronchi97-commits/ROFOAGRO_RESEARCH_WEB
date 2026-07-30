"use client";

import * as React from "react";
import { Panel, PanelHead } from "./panel";
import { nfmt, pfmt, rfmt, numDeInput as num, fmtInputDate as fmtInput } from "@/lib/format";
import { tasaDirecta, tnaUSD, spread, teaUSD } from "@/lib/arbitraje";
import { hoyCordoba, parseYmd, diasCorridos, sumarCorridos, fmtFecha } from "@/lib/habiles";
import { arsDesdeUsd } from "@/lib/precio-dual";
import { CurvaPicker } from "./curva-picker";
import { PickerPizarra } from "./precio-dual";
import { usePrecioDual, type GranoPizarraDual } from "./use-precio-dual";
import type { GranoCurva } from "@/lib/curva-types";

function IconArb() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 11h5l2-6 2 6h3" />
      <path d="M11 3h3v3" />
    </svg>
  );
}

type Moneda = "usd" | "ars";

export function CalcArbitraje({
  granos = [],
  pizarraDual = [],
  tcBna = null,
}: {
  granos?: GranoCurva[];
  pizarraDual?: GranoPizarraDual[];
  tcBna?: number | null;
}) {
  const pd = usePrecioDual(tcBna, "320");
  const [futuro, setFuturo] = React.useState("330");
  const [fechaVto, setFechaVto] = React.useState(() =>
    fmtInput(sumarCorridos(parseYmd(hoyCordoba()), 90)),
  );
  const [moneda, setMoneda] = React.useState<Moneda>("usd");

  const dias = fechaVto
    ? Math.max(0, diasCorridos(parseYmd(hoyCordoba()), parseYmd(fechaVto)))
    : NaN;

  const pz = num(pd.usd);
  const ft = num(futuro);
  const dir = tasaDirecta(ft, pz) * 100;
  const tna = tnaUSD(ft, pz, dias);
  const tea = teaUSD(ft, pz, dias);
  const sp = spread(ft, pz);

  const spMostrado = moneda === "ars" && pd.tc != null && Number.isFinite(sp) ? arsDesdeUsd(sp, pd.tc) : sp;

  const signo = Number.isFinite(tna) ? (tna > 0 ? "pos" : tna < 0 ? "neg" : "neu2") : "neu2";
  const senal = !Number.isFinite(tna)
    ? ""
    : tna > 0
      ? "Comprar spot + vender diferido (capturar tasa)"
      : tna < 0
        ? "Vender spot + recomprar futuros"
        : "Sin carry";

  return (
    <Panel id="calc-arbitraje">
      <PanelHead glyph={<IconArb />} title="Calculadora — carry implícito entre dos posiciones" sub="Tasa directa · TNA USD · spread entre una posición cercana y una lejana" />

      <div className="calc">
        <PickerPizarra granos={pizarraDual} onPick={pd.elegir} label="Cercana desde pizarra" />
        <CurvaPicker granos={granos} label="Lejana desde A3" onPick={(p) => { setFuturo(String(p.precio)); setFechaVto(p.vto); }} />
        <div className="calc-grid">
          <label className="calc-field">
            <span>Posición cercana / disponible (USD)</span>
            <span className="cell-wrap">
              <input inputMode="decimal" className={pd.editado ? "manual" : ""} value={pd.usd} onChange={(e) => pd.setUsd(e.target.value)} />
              {pd.editado && <button type="button" className="pz-reset" title="Volver a la pizarra" onClick={pd.reset}>↺</button>}
            </span>
          </label>
          {pd.grano && (
            <label className="calc-field">
              <span>Posición cercana (ARS)</span>
              <input inputMode="decimal" className={pd.editado ? "manual" : ""} value={pd.ars} onChange={(e) => pd.setArs(e.target.value)}
                disabled={pd.tc == null} />
            </label>
          )}
          <label className="calc-field">
            <span>Posición lejana / futuro (USD)</span>
            <input inputMode="decimal" value={futuro} onChange={(e) => setFuturo(e.target.value)} />
          </label>
          <label className="calc-field">
            <span>Vencimiento de la lejana</span>
            <input type="date" suppressHydrationWarning value={fechaVto} onChange={(e) => setFechaVto(e.target.value)} />
          </label>
          <label className="calc-field">
            <span>Medir spread en</span>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
              <option value="usd">USD</option>
              <option value="ars">ARS</option>
            </select>
          </label>
        </div>

        <div className="calc-out">
          <div className="calc-res">
            <span className="calc-res-lbl">TNA USD</span>
            <span className={`calc-res-val ${signo}`}>{rfmt(tna, 1)}</span>
            {senal && <span className="calc-res-sub">{senal}</span>}
          </div>
          <div className="calc-res">
            <span className="calc-res-lbl">Spread ({moneda === "ars" ? "ARS" : "USD"})</span>
            <span className="calc-res-val">
              {Number.isFinite(spMostrado) ? nfmt(spMostrado, moneda === "ars" ? 0 : 2) : "—"}
            </span>
            {moneda === "ars" && pd.tc == null && <span className="calc-res-sub">elegí un grano para el TC</span>}
          </div>
        </div>
        <div className="calc-meta calc-meta-hl">
          <span>Tasa directa: <b>{pfmt(dir, 2)}</b></span>
          <span>TEA USD: <b>{rfmt(tea, 1)}</b></span>
          <span>Días al vto: <b>{Number.isFinite(dias) ? dias : "—"}</b> ({fechaVto ? fmtFecha(parseYmd(fechaVto)) : "—"})</span>
        </div>
      </div>

      <div className="panel-note">
        <span>
          <span className="k">Carry</span> entre dos posiciones: tasa directa = lejana/cercana − 1 · TNA USD =
          (lejana/cercana − 1) × 365/días · spread = lejana − cercana, medible en USD o en pesos (con el TC
          implícito del grano elegido, o el BNA confirmado de CAC). Sirve para detectar el carry entre disponible
          y un futuro, o entre dos posiciones de futuros. Precios a mano; con la pizarra y la curva A3 salen solos.
        </span>
      </div>
    </Panel>
  );
}
