"use client";

import * as React from "react";
import { Panel, PanelHead } from "./panel";
import { nfmt, numDeInput as num } from "@/lib/format";
import { arsDesdeUsd } from "@/lib/precio-dual";
import { usePrecioDual } from "./use-precio-dual";
import { PickerPizarra, type GranoPizarraDual } from "./precio-dual";
import { VALOR_PUNTO_FIJO, calcularPlanta, type OtroItem } from "@/lib/planta";

/** 0 si está vacío o no es válido (para los rubros que se restan). */
function n0(v: string): number {
  const n = num(v);
  return Number.isFinite(n) ? n : 0;
}

function IconPlanta() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 14h12" />
      <path d="M3 14V7l3.5 2V7l3.5 2V4.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V14" />
      <path d="M3 7V5" />
    </svg>
  );
}

type OtroStr = { label: string; valor: string };

/**
 * Calculadora "Negocios de planta" (relevamiento web R5, punto 47): patrón
 * `precio-dual` para el arranque (reusa R4) · secada fijo/no-fijo con un valor
 * por punto en modo "no fijo" (desplegable dinámico según cuántos puntos) ·
 * "otros" repetible con botón + · desglose en tarjetas visuales · resultado en
 * la moneda elegida, dolarizando/pesificando siempre con el BNA del día.
 */
export function CalcPlanta({
  pizarra = [],
  tcBna,
}: {
  pizarra?: GranoPizarraDual[];
  tcBna: number | null;
}) {
  const pd = usePrecioDual(tcBna);

  const [flete, setFlete] = React.useState("");
  const [secadaModo, setSecadaModo] = React.useState<"fijo" | "libre">("fijo");
  const [puntos, setPuntos] = React.useState("1");
  const [valorPunto, setValorPunto] = React.useState(String(VALOR_PUNTO_FIJO));
  const [porPunto, setPorPunto] = React.useState<Record<number, string>>({});
  const [merma, setMerma] = React.useState("0.3");
  const [paritaria, setParitaria] = React.useState("4.5");
  const [embolsado, setEmbolsado] = React.useState("");
  const [otros, setOtros] = React.useState<OtroStr[]>([{ label: "", valor: "" }]);
  const [moneda, setMoneda] = React.useState<"USD" | "ARS">("USD");

  const arranque = num(pd.usd);
  const nPuntos = Math.max(0, Math.round(n0(puntos)));
  const vPunto = n0(valorPunto);
  const pctMerma = n0(merma);

  const setPunto = (i: number, v: string) => setPorPunto((m) => ({ ...m, [i]: v }));
  const valoresPorPunto = Array.from({ length: nPuntos }, (_, i) => n0(porPunto[i] ?? String(VALOR_PUNTO_FIJO)));

  const setOtro = (i: number, campo: keyof OtroStr, v: string) =>
    setOtros((os) => os.map((o, j) => (j === i ? { ...o, [campo]: v } : o)));
  const agregarOtro = () => setOtros((os) => [...os, { label: "", valor: "" }]);
  const quitarOtro = (i: number) => setOtros((os) => os.filter((_, j) => j !== i));
  const otrosNum: OtroItem[] = otros.map((o) => ({ label: o.label, valor: n0(o.valor) }));

  const { dFlete, dSecada, dMerma, dParitaria, dEmbolsado, dOtros, totalGastos, final } = calcularPlanta({
    arranque,
    flete: n0(flete),
    secadaModo,
    puntos: nPuntos,
    valorPunto: vPunto,
    valoresPorPunto,
    pctMerma,
    paritaria: n0(paritaria),
    embolsado: n0(embolsado),
    otros: otrosNum,
  });

  const finalArs = Number.isFinite(final) && tcBna != null ? arsDesdeUsd(final, tcBna) : null;
  const finalMostrado = moneda === "ARS" ? finalArs : Number.isFinite(final) ? final : null;

  return (
    <Panel id="calc-planta">
      <PanelHead glyph={<IconPlanta />} title="Calculadora — negocios de planta" />
      <div className="calc">
        <PickerPizarra granos={pizarra} onPick={pd.elegir} label="Pizarra (arranque)" />

        <div className="calc-grid">
          <div className="calc-field">
            <span>
              Precio de arranque (USD)
              {pd.editado && (
                <button type="button" className="pz-reset" title="Volver a la pizarra" onClick={pd.reset}>↺</button>
              )}
            </span>
            <input
              inputMode="decimal"
              className={pd.editado ? "manual" : undefined}
              value={pd.usd}
              placeholder="—"
              aria-label="Precio de arranque (USD)"
              onChange={(e) => pd.setUsd(e.target.value)}
            />
          </div>
          <div className="calc-field">
            <span>Precio de arranque ($)</span>
            <input
              inputMode="decimal"
              className={pd.editado ? "manual" : undefined}
              value={pd.ars}
              placeholder="—"
              aria-label="Precio de arranque (pesos)"
              onChange={(e) => pd.setArs(e.target.value)}
            />
          </div>

          <label className="calc-field"><span>Contra flete (USD)</span>
            <input inputMode="decimal" value={flete} placeholder="0" onChange={(e) => setFlete(e.target.value)} /></label>

          <label className="calc-field calc-mode"><span>Secada</span>
            <select value={secadaModo} onChange={(e) => setSecadaModo(e.target.value as "fijo" | "libre")}>
              <option value="fijo">Fijo (mismo USD/punto)</option>
              <option value="libre">No fijo (un valor por cada punto)</option>
            </select></label>

          <label className="calc-field"><span>Secada — puntos</span>
            <input inputMode="decimal" value={puntos} placeholder="0" onChange={(e) => setPuntos(e.target.value)} /></label>

          {secadaModo === "fijo" && (
            <label className="calc-field"><span>USD por punto</span>
              <input inputMode="decimal" value={valorPunto} placeholder="5" onChange={(e) => setValorPunto(e.target.value)} /></label>
          )}

          <label className="calc-field"><span>Merma volátil (%)</span>
            <input inputMode="decimal" value={merma} placeholder="0,3" onChange={(e) => setMerma(e.target.value)} /></label>

          <label className="calc-field"><span>Paritaria (USD)</span>
            <input inputMode="decimal" value={paritaria} placeholder="4,5" onChange={(e) => setParitaria(e.target.value)} /></label>

          <label className="calc-field"><span>Embolsado (USD)</span>
            <input inputMode="decimal" value={embolsado} placeholder="0" onChange={(e) => setEmbolsado(e.target.value)} /></label>
        </div>

        {secadaModo === "libre" && nPuntos > 0 && (
          <div className="plt-puntos">
            {Array.from({ length: nPuntos }, (_, i) => (
              <label className="plt-punto" key={i}>
                <span>Punto {i + 1} (USD)</span>
                <input
                  inputMode="decimal"
                  value={porPunto[i] ?? ""}
                  placeholder={String(VALOR_PUNTO_FIJO)}
                  onChange={(e) => setPunto(i, e.target.value)}
                />
              </label>
            ))}
          </div>
        )}

        <div className="calc-field">
          <span>Otros conceptos</span>
        </div>
        {otros.map((o, i) => (
          <div className="plt-otros-row" key={i}>
            <label className="calc-field"><span>Concepto</span>
              <input value={o.label} placeholder="Sanidad, análisis…" onChange={(e) => setOtro(i, "label", e.target.value)} /></label>
            <label className="calc-field"><span>USD</span>
              <input inputMode="decimal" value={o.valor} placeholder="0" onChange={(e) => setOtro(i, "valor", e.target.value)} /></label>
            {otros.length > 1 && (
              <button type="button" className="cell-del" onClick={() => quitarOtro(i)} aria-label="Quitar concepto">×</button>
            )}
          </div>
        ))}
        <div className="calc-btns">
          <button type="button" className="calc-add" onClick={agregarOtro}>+ otro concepto</button>
        </div>

        <div className="calc-out">
          <div className="calc-res">
            <span className="calc-res-lbl">
              Precio final
              <span className="plt-moneda" role="group" aria-label="Moneda del resultado">
                <button type="button" aria-pressed={moneda === "USD"} onClick={() => setMoneda("USD")}>USD</button>
                <button type="button" aria-pressed={moneda === "ARS"} onClick={() => setMoneda("ARS")} disabled={tcBna == null}>$</button>
              </span>
            </span>
            <span className="calc-res-val">{finalMostrado != null ? nfmt(finalMostrado, 2) : "—"}</span>
            <span className="calc-res-sub">
              arranque − gastos{moneda === "ARS" && tcBna != null ? ` · BNA ${nfmt(tcBna, 2)}` : ""}
            </span>
          </div>
        </div>

        <div className="plt-breakdown">
          <div className="plt-item">
            <span className="plt-item-lbl">Contra flete</span>
            <span className="plt-item-val">{nfmt(dFlete, 2)}</span>
          </div>
          <div className="plt-item">
            <span className="plt-item-lbl">
              Secada ({nfmt(nPuntos, nPuntos % 1 === 0 ? 0 : 2)} {nPuntos === 1 ? "punto" : "puntos"})
            </span>
            <span className="plt-item-val">{nfmt(dSecada, 2)}</span>
          </div>
          <div className="plt-item">
            <span className="plt-item-lbl">Merma {nfmt(pctMerma, 2)}%</span>
            <span className="plt-item-val">{nfmt(dMerma, 2)}</span>
          </div>
          <div className="plt-item">
            <span className="plt-item-lbl">Paritaria</span>
            <span className="plt-item-val">{nfmt(dParitaria, 2)}</span>
          </div>
          <div className="plt-item">
            <span className="plt-item-lbl">Embolsado</span>
            <span className="plt-item-val">{nfmt(dEmbolsado, 2)}</span>
          </div>
          <div className="plt-item">
            <span className="plt-item-lbl">Otros</span>
            <span className="plt-item-val">{nfmt(dOtros, 2)}</span>
          </div>
          <div className="plt-item">
            <span className="plt-item-lbl">Total de gastos</span>
            <span className="plt-item-val tot">{nfmt(totalGastos, 2)}</span>
          </div>
        </div>
      </div>
      <div className="panel-note">
        <span>
          <span className="k">Planta</span> Precio final = arranque − (contra flete + secada + merma +
          paritaria + embolsado + otros). Secada fijo = puntos × un valor único; no fijo = un valor propio
          para cada punto. El arranque trae la pizarra del grano elegido (USD y $, editable en los dos). El
          resultado se puede ver en USD o pesificado con el BNA del día.
        </span>
      </div>
    </Panel>
  );
}
