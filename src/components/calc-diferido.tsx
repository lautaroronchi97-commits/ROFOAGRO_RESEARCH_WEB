"use client";

import * as React from "react";
import { Panel, PanelHead } from "./panel";
import { nfmt, rfmt, numDeInput as num, fmtInputDate as fmtInput } from "@/lib/format";
import {
  precioDiferido,
  precioConPago,
  tasaImplicita,
  diasDesdeTasa,
} from "@/lib/diferido";
import {
  hoyCordoba,
  parseYmd,
  sumarHabiles,
  sumarCorridos,
  diasCorridos,
  fmtFecha,
} from "@/lib/habiles";
import { PickerPizarra } from "./precio-dual";
import { usePrecioDual, type GranoPizarraDual } from "./use-precio-dual";

function IconCalc() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="2" width="10" height="12" rx="1.5" />
      <path d="M5.5 5h5" />
      <path d="M5.5 8h0M8 8h0M10.5 8h0M5.5 10.5h0M8 10.5h0M10.5 10.5h0" />
    </svg>
  );
}

type Calc = "diferido" | "conpago" | "tasa" | "dia";

const LABELS: Record<Calc, string> = {
  diferido: "Precio diferido",
  conpago: "Precio con pago",
  tasa: "Tasa implícita",
  dia: "Fecha de pago",
};

export function CalcDiferido({
  pizarraDual = [],
  tcBna = null,
}: {
  pizarraDual?: GranoPizarraDual[];
  tcBna?: number | null;
}) {
  const [calc, setCalc] = React.useState<Calc>("diferido");
  // Fechas por defecto = hoy (Córdoba) y hoy + 5 hábiles + 30 corridos. Init perezoso;
  // los inputs llevan suppressHydrationWarning por si build y cliente caen en días distintos.
  const [fechaNeg, setFechaNeg] = React.useState(hoyCordoba);
  const [habiles, setHabiles] = React.useState("5");
  const [fechaDif, setFechaDif] = React.useState(() =>
    fmtInput(sumarCorridos(sumarHabiles(parseYmd(hoyCordoba()), 5), 30)),
  );
  const pd = usePrecioDual(tcBna, "", "320");
  const conPago = pd.ars;
  const [diferido, setDiferido] = React.useState("322");
  const [tasa, setTasa] = React.useState("8");

  // Fecha de pago estándar (N días hábiles desde el negocio)
  const nHabiles = Math.max(0, Math.round(num(habiles)) || 0);
  const fechaEstandar =
    fechaNeg ? sumarHabiles(parseYmd(fechaNeg), nHabiles) : null;

  // Días de financiación (excedente sobre el pago estándar)
  let diasFin = NaN;
  let fechaPago: Date | null = null;

  if (calc === "dia") {
    // días es OUTPUT: se despeja de precios + tasa
    diasFin = diasDesdeTasa(num(conPago), num(diferido), num(tasa));
    if (fechaEstandar && Number.isFinite(diasFin)) {
      fechaPago = sumarCorridos(fechaEstandar, Math.round(diasFin));
    }
  } else if (fechaEstandar && fechaDif) {
    diasFin = Math.max(0, diasCorridos(fechaEstandar, parseYmd(fechaDif)));
    fechaPago = parseYmd(fechaDif);
  }

  // Resultado principal
  let resultado = "—";
  let resSub = "";
  if (calc === "diferido") {
    const v = precioDiferido(num(conPago), num(tasa), diasFin);
    if (Number.isFinite(v)) {
      resultado = nfmt(v, 2);
      resSub = `sobreprecio +${nfmt(v - num(conPago), 2)} vs con pago`;
    }
  } else if (calc === "conpago") {
    const v = precioConPago(num(diferido), num(tasa), diasFin);
    if (Number.isFinite(v)) {
      resultado = nfmt(v, 2);
      resSub = `descuento −${nfmt(num(diferido) - v, 2)} vs diferido`;
    }
  } else if (calc === "tasa") {
    const v = tasaImplicita(num(conPago), num(diferido), diasFin);
    if (Number.isFinite(v)) {
      resultado = rfmt(v, 2);
      resSub = `sobre ${Math.round(diasFin)} días de financiación`;
    }
  } else {
    // dia
    if (fechaPago && Number.isFinite(diasFin)) {
      resultado = fmtFecha(fechaPago);
      resSub = `${Math.round(diasFin)} días corridos después del pago estándar`;
    }
  }

  const showConPago = calc !== "conpago";
  const showDiferido = calc !== "diferido";
  const showTasa = calc !== "tasa";
  const showFechaDif = calc !== "dia";

  return (
    <Panel id="calc-diferido">
      <PanelHead glyph={<IconCalc />} title="Calculadora — pago diferido" sub="Negocios en pesos · diferido vs con pago · tasa pesos · fecha de pago" />

      <div className="calc">
        <label className="calc-field calc-mode">
          <span>Calcular</span>
          <select value={calc} onChange={(e) => setCalc(e.target.value as Calc)}>
            {(Object.keys(LABELS) as Calc[]).map((k) => (
              <option key={k} value={k}>{LABELS[k]}</option>
            ))}
          </select>
        </label>

        {showConPago && <PickerPizarra granos={pizarraDual} onPick={pd.elegir} label="Disponible desde pizarra" />}

        <div className="calc-grid">
          {showConPago && (
            <>
              <label className="calc-field">
                <span>Precio con pago (ARS)</span>
                <span className="cell-wrap">
                  <input inputMode="decimal" className={pd.editado ? "manual" : ""} value={conPago} onChange={(e) => pd.setArs(e.target.value)} />
                  {pd.editado && <button type="button" className="pz-reset" title="Volver a la pizarra" onClick={pd.reset}>↺</button>}
                </span>
              </label>
              {pd.grano && (
                <label className="calc-field">
                  <span>Precio con pago (USD)</span>
                  <input inputMode="decimal" className={pd.editado ? "manual" : ""} value={pd.usd} onChange={(e) => pd.setUsd(e.target.value)} />
                </label>
              )}
            </>
          )}
          {showDiferido && (
            <label className="calc-field">
              <span>Precio diferido (ARS)</span>
              <input inputMode="decimal" value={diferido} onChange={(e) => setDiferido(e.target.value)} />
            </label>
          )}
          {showTasa && (
            <label className="calc-field">
              <span>Tasa pesos anual (%)</span>
              <input inputMode="decimal" value={tasa} onChange={(e) => setTasa(e.target.value)} />
            </label>
          )}

          <label className="calc-field">
            <span>Fecha del negocio</span>
            <input type="date" suppressHydrationWarning value={fechaNeg} onChange={(e) => setFechaNeg(e.target.value)} />
          </label>
          <label className="calc-field">
            <span>Pago estándar (días hábiles)</span>
            <input inputMode="numeric" value={habiles} onChange={(e) => setHabiles(e.target.value)} />
          </label>
          {showFechaDif && (
            <label className="calc-field">
              <span>Fecha de pago diferida</span>
              <input type="date" suppressHydrationWarning value={fechaDif} onChange={(e) => setFechaDif(e.target.value)} />
            </label>
          )}
        </div>

        <div className="calc-out">
          <div className="calc-res">
            <span className="calc-res-lbl">{LABELS[calc]}</span>
            <span className="calc-res-val">{resultado}</span>
            {resSub && <span className="calc-res-sub">{resSub}</span>}
          </div>
        </div>
        <div className="calc-meta calc-meta-hl">
          {fechaEstandar && <span>Pago estándar: <b className="calc-hi">{fmtFecha(fechaEstandar)}</b></span>}
          {Number.isFinite(diasFin) && <span>Financiación: <b>{Math.round(diasFin)} días</b> (excedente sobre {nHabiles} hábiles)</span>}
        </div>
      </div>

      <div className="panel-note">
        <span>
          Negocios en pesos. Diferido = con pago × (1 + tasa × días/365), interés simple. El pago (cobro
          anticipado) descuenta; los días son solo el excedente por encima del pago estándar de {nHabiles}
          hábiles. El disponible sugerido sale de la pizarra del día (dolarizada con el BNA), siempre editable.
          Feriados AR editables en <code>habiles.ts</code>.
        </span>
      </div>
    </Panel>
  );
}
