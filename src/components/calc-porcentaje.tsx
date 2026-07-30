"use client";

import * as React from "react";
import { Panel, PanelHead } from "./panel";
import { nfmt, rfmt, numDeInput as num, fmtInputDate as fmtInput } from "@/lib/format";
import { porcentaje, precioDesdePct } from "@/lib/porcentaje";
import { hoyCordoba, parseYmd, diasCorridos, sumarCorridos, fmtFecha } from "@/lib/habiles";
import { CurvaPicker } from "./curva-picker";
import { PickerPizarra } from "./precio-dual";
import { usePrecioDual, type GranoPizarraDual } from "./use-precio-dual";
import type { GranoCurva } from "@/lib/curva-types";

function IconPct() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12 12 4" /><circle cx="5" cy="5" r="1.4" /><circle cx="11" cy="11" r="1.4" />
    </svg>
  );
}

type Modo = "pct" | "precio";

export function CalcPorcentaje({
  granos = [],
  pizarraDual = [],
  tcBna = null,
}: {
  granos?: GranoCurva[];
  pizarraDual?: GranoPizarraDual[];
  tcBna?: number | null;
}) {
  const [modo, setModo] = React.useState<Modo>("pct");
  const pd = usePrecioDual(tcBna, "205");
  const [precioRef, setPrecioRef] = React.useState("180");
  const [pct, setPct] = React.useState("114");
  const [aforo, setAforo] = React.useState("2");
  const [fechaRef, setFechaRef] = React.useState(() => fmtInput(sumarCorridos(parseYmd(hoyCordoba()), 120)));

  const dias = fechaRef ? Math.max(0, diasCorridos(parseYmd(hoyCordoba()), parseYmd(fechaRef))) : NaN;

  let resultado = "—";
  let resSub = "";
  let clienteTxt = "";
  if (modo === "pct") {
    const lleno = porcentaje(num(pd.usd), num(precioRef));
    if (Number.isFinite(lleno)) {
      resultado = rfmt(lleno, 1);
      resSub = `${nfmt(num(pd.usd), 2)} ÷ ${nfmt(num(precioRef), 2)}`;
      // Aforo en % RELATIVO del lleno (decisión de Lautaro, auditoría E2 21/07/2026):
      // 183,8% con aforo 2 → 183,8 × 0,98 = 180,2 (antes restaba puntos: 181,8).
      const af = num(aforo);
      if (Number.isFinite(af)) clienteTxt = rfmt(lleno * (1 - af / 100), 1);
    }
  } else {
    const v = precioDesdePct(num(pct), num(precioRef));
    if (Number.isFinite(v)) {
      resultado = nfmt(v, 2);
      resSub = `${rfmt(num(pct), 1)} de ${nfmt(num(precioRef), 2)}`;
    }
  }

  return (
    <Panel id="calc-porcentaje">
      <PanelHead glyph={<IconPct />} title="Cotizador — negocios por porcentaje" sub="Fijar por relación a otra posición" />
      <div className="calc">
        <label className="calc-field calc-mode">
          <span>Calcular</span>
          <select value={modo} onChange={(e) => setModo(e.target.value as Modo)}>
            <option value="pct">Porcentaje lleno</option>
            <option value="precio">Precio del negocio</option>
          </select>
        </label>
        {modo === "pct" && (
          <PickerPizarra granos={pizarraDual} onPick={pd.elegir} label="Vendida desde pizarra" />
        )}
        <CurvaPicker granos={granos} label="Fijación desde A3" onPick={(p) => { setPrecioRef(String(p.precio)); setFechaRef(p.vto); }} />
        <div className="calc-grid">
          {modo === "pct" ? (
            <>
              <label className="calc-field">
                <span>Precio posición vendida (USD)</span>
                <span className="cell-wrap">
                  <input inputMode="decimal" className={pd.editado ? "manual" : ""}
                    value={pd.usd} onChange={(e) => pd.setUsd(e.target.value)} />
                  {pd.editado && <button type="button" className="pz-reset" title="Volver a la pizarra" onClick={pd.reset}>↺</button>}
                </span>
              </label>
              {pd.grano && (
                <label className="calc-field">
                  <span>Precio posición vendida (ARS)</span>
                  <input inputMode="decimal" className={pd.editado ? "manual" : ""} value={pd.ars} onChange={(e) => pd.setArs(e.target.value)}
                    disabled={pd.tc == null} title={pd.tc == null ? "Sin tipo de cambio del día para convertir" : undefined} />
                </label>
              )}
            </>
          ) : (
            <label className="calc-field"><span>Porcentaje (%)</span>
              <input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} /></label>
          )}
          <label className="calc-field"><span>Precio posición de fijación</span>
            <input inputMode="decimal" value={precioRef} onChange={(e) => setPrecioRef(e.target.value)} /></label>
          {modo === "pct" && (
            <label className="calc-field"><span>Aforo a cliente (%)</span>
              <input inputMode="decimal" value={aforo} onChange={(e) => setAforo(e.target.value)} /></label>
          )}
          <label className="calc-field"><span>Vencimiento del período de fijación</span>
            <input type="date" suppressHydrationWarning value={fechaRef} onChange={(e) => setFechaRef(e.target.value)} /></label>
        </div>
        <div className="calc-out">
          <div className="calc-res">
            <span className="calc-res-lbl">{modo === "pct" ? "Porcentaje lleno" : "Precio del negocio"}</span>
            <span className="calc-res-val">{resultado}</span>
            {resSub && <span className="calc-res-sub">{resSub}</span>}
          </div>
          {modo === "pct" && clienteTxt && (
            <div className="calc-res">
              <span className="calc-res-lbl">Porcentaje para cliente (−aforo)</span>
              <span className="calc-res-val rojo">{clienteTxt}</span>
            </div>
          )}
        </div>
        <div className="calc-meta calc-meta-hl">
          <span>Plazo estimado: <b>{Number.isFinite(dias) ? `${dias} días` : "—"}</b></span>
          <span>Vencimiento del período de fijación: <b>{fechaRef ? fmtFecha(parseYmd(fechaRef)) : "—"}</b></span>
        </div>
      </div>
      <div className="panel-note">
        <span>
          <span className="k">Por relación</span> Porcentaje lleno = precio de la posición vendida ÷ precio de la
          posición de fijación (ej. 114% maíz julio). El <b>aforo</b> es un % relativo que descuenta al lleno para
          cotizar a clientes (lleno × (1 − aforo/100)). El plazo se estima del vencimiento de la fijación. Precios a
          mano; la vendida sale de la pizarra del día, la de fijación de la curva A3.
        </span>
      </div>
    </Panel>
  );
}
