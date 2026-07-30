"use client";

import * as React from "react";
import { Panel, PanelHead } from "./panel";
import { nfmt, pfmt, numDeInput as num, fmtInputDate as fmtInput } from "@/lib/format";
import { hoyCordoba, parseYmd, sumarHabiles, sumarCorridos, diasCorridos, fmtFecha } from "@/lib/habiles";
import { precioConPago } from "@/lib/diferido";
import { CurvaPicker } from "./curva-picker";
import type { GranoCurva } from "@/lib/curva-types";

function IconPago() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="12" height="8" rx="1.5" />
      <circle cx="8" cy="8" r="1.6" />
      <path d="M4.5 6.5h0M11.5 9.5h0" />
    </svg>
  );
}

export function CalcNegociosPago({
  granos = [],
  bnaOnline = null,
  tcBna = null,
}: {
  granos?: GranoCurva[];
  bnaOnline?: number | null;
  tcBna?: number | null;
}) {
  const [futuro, setFuturo] = React.useState("340");
  const [vto, setVto] = React.useState(() => fmtInput(sumarCorridos(parseYmd(hoyCordoba()), 90)));
  const [habiles, setHabiles] = React.useState("5");
  const [tasa, setTasa] = React.useState("8");
  // TC precargado: preferimos el BNA confirmado de las 15hs (`tcBna`, CAC) y si ese
  // día no lo tenemos, el BNA online estimado (oficial mayorista − 9). Sigue editable.
  const tcDefault = tcBna ?? bnaOnline;
  const [tc, setTc] = React.useState(tcDefault != null ? String(tcDefault) : "");

  const nHabiles = Math.max(0, Math.round(num(habiles)) || 0);
  const fechaPago = sumarHabiles(parseYmd(hoyCordoba()), nHabiles);
  const dias = vto ? Math.max(0, diasCorridos(fechaPago, parseYmd(vto))) : NaN;

  const ft = num(futuro);
  const ta = num(tasa);
  const disponible =
    ft > 0 && Number.isFinite(ta) && Number.isFinite(dias) ? precioConPago(ft, ta, dias) : NaN;
  const descuento = Number.isFinite(disponible) ? ft - disponible : NaN;
  const directa = Number.isFinite(disponible) && disponible > 0 ? (ft / disponible - 1) * 100 : NaN;
  const tcv = tc.trim() ? num(tc) : NaN;
  const pesos = Number.isFinite(disponible) && Number.isFinite(tcv) ? Math.floor(disponible * tcv) : NaN;

  return (
    <Panel id="calc-negocios-pago">
      <PanelHead glyph={<IconPago />} title="Cotizador — negocios con pagos" sub="Disponible = futuro descontado al pago · pesificable por TC" />
      <div className="calc">
        <CurvaPicker granos={granos} label="Traer futuro de A3" onPick={(p) => { setFuturo(String(p.precio)); setVto(p.vto); }} />
        <div className="calc-grid">
          <label className="calc-field"><span>Precio futuro (USD)</span>
            <input inputMode="decimal" value={futuro} onChange={(e) => setFuturo(e.target.value)} /></label>
          <label className="calc-field"><span>Vencimiento de la posición</span>
            <input type="date" suppressHydrationWarning value={vto} onChange={(e) => setVto(e.target.value)} /></label>
          <label className="calc-field"><span>Pago (días de anticipo)</span>
            <input inputMode="numeric" value={habiles} onChange={(e) => setHabiles(e.target.value)} /></label>
          <label className="calc-field"><span>Tasa USD anual (%)</span>
            <input inputMode="decimal" value={tasa} onChange={(e) => setTasa(e.target.value)} /></label>
          <label className="calc-field">
            <span>TC del día (ARS)</span>
            <input inputMode="decimal" value={tc} placeholder="—" onChange={(e) => setTc(e.target.value)} />
          </label>
        </div>
        <div className="calc-out">
          <div className="calc-res">
            <span className="calc-res-lbl">Disponible (USD)</span>
            <span className="calc-res-val">{Number.isFinite(disponible) ? nfmt(disponible, 2) : "—"}</span>
            <span className="calc-res-sub">futuro descontado al pago</span>
          </div>
          <div className="calc-res">
            <span className="calc-res-lbl">Precio en pesos</span>
            <span className="calc-res-val rojo">{Number.isFinite(pesos) ? nfmt(pesos, 0) : "—"}</span>
            {!tc.trim() && <span className="calc-res-sub">cargá un TC</span>}
          </div>
        </div>
        <div className="calc-meta calc-meta-hl">
          <span>Descuento: <b>{Number.isFinite(descuento) ? nfmt(descuento, 2) : "—"} USD</b></span>
          <span>Tasa directa: <b>{pfmt(directa, 2)}</b></span>
          <span>Pago: <b className="calc-hi">{fmtFecha(fechaPago)}</b> · Días: <b>{Number.isFinite(dias) ? dias : "—"}</b></span>
        </div>
      </div>
      <div className="panel-note">
        <span>
          <span className="k">Con pago</span> Disponible USD = futuro ÷ (1 + tasa × días/365), interés simple; los
          días van del pago (hoy + {nHabiles} días de anticipo) al vencimiento. Precio en pesos = disponible × TC
          del día (redondeo hacia abajo) — el TC precarga el BNA confirmado de CAC si ya está publicado, y si no,
          el BNA online estimado (oficial mayorista − 9); siempre editable. Editables: precio futuro, vencimiento,
          días de pago, tasa y TC.
        </span>
      </div>
    </Panel>
  );
}
