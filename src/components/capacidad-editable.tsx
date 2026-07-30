"use client";

import * as React from "react";
import { nfmt, sfmt, pfmt } from "@/lib/format";
import { calcularFasTeorico, diferencialVsPizarra, type CapacidadModeloCfg } from "@/lib/capacidad-modelo";
import { calcularFasIndustria, type CapacidadIndustriaCfg } from "@/lib/capacidad-industria-modelo";
import { GlyphSoja, GlyphMaiz, GlyphTrigo } from "./icons";
import { InfoTip } from "./infotip";

/**
 * Tabla de capacidad de pago con TRES lecturas (BCR | Nuestro | Pizarra) + el diferencial de
 * cada modelo teórico contra la pizarra (sobrepagado/subpagado). "Nuestro" es editable: los
 * supuestos (retenciones, reintegro, gastos portuarios/comerciales, margen de riesgo) arrancan
 * sembrados por el servidor (`capacidad.ts` — desde los propios a/b/c de BCR) y se recalculan
 * en vivo acá, sin ir al servidor, con la misma fórmula pura de `capacidad-modelo.ts`.
 *
 * Debajo, la fila "Soja (industria)" — el FAS Teórico del complejo aceite+harina (la OTRA
 * metodología de BCR, la que de verdad mueve el precio que le pagan al productor de soja en
 * Argentina) — con su propio bloque de supuestos editables, distinto en forma al de grano
 * (`capacidad-industria-modelo.ts`).
 */

export type CapGranoClient = {
  underlying: string;
  nombre: string;
  fasBcr: number | null;
  pizarra: number | null;
  fobOficial: number | null;
  cfg: CapacidadModeloCfg; // supuestos default (sembrados por el servidor)
};

export type CapIndustriaClient = {
  nombre: string;
  fasBcr: number | null;
  pizarra: number | null;
  fobMercadoAceite: number | null;
  fobOficialAceite: number | null;
  fobMercadoHarina: number | null;
  fobOficialHarina: number | null;
  cfg: CapacidadIndustriaCfg;
};

// Sorgo y girasol no tienen glifo SVG propio (solo soja/maíz/trigo tienen futuro
// A3) — llevan emoji (pedido explícito, relevamiento 29/07 punto 28), no un ícono
// SVG ajeno.
function glyphFor(u: string) {
  if (u === "SOJ") return <GlyphSoja />;
  if (u === "MAI") return <GlyphMaiz />;
  if (u === "TRI") return <GlyphTrigo />;
  if (u === "SOR") return <span className="gemoji">🌾</span>;
  if (u === "GIR") return <span className="gemoji">🌻</span>;
  return null;
}
function glyphColor(u: string) {
  if (u === "SOJ") return "var(--brand-agro)";
  if (u === "MAI") return "var(--gold-text)";
  return "var(--brand-deep)";
}
const cls = (v: number | null) => (v == null ? "neu2" : v > 0 ? "pos" : v < 0 ? "neg" : "neu2");

function FilaResultado({
  nombre,
  glyph,
  fasBcr,
  fasNuestro,
  pizarra,
}: {
  nombre: string;
  glyph: React.ReactNode;
  fasBcr: number | null;
  fasNuestro: number | null;
  pizarra: number | null;
}) {
  const diffBcr = diferencialVsPizarra(pizarra, fasBcr);
  const diffNuestro = diferencialVsPizarra(pizarra, fasNuestro);
  return (
    <tr>
      <td className="l">
        <span className="grp-cell">
          {glyph}
          <span className="gname">{nombre}</span>
        </span>
      </td>
      <td>{fasBcr != null ? nfmt(fasBcr, 2) : "—"}</td>
      <td className="b">{fasNuestro != null ? nfmt(fasNuestro, 2) : "—"}</td>
      <td className="dim">{pizarra != null ? nfmt(pizarra, 2) : "—"}</td>
      <td className={cls(diffBcr.usd)}>{diffBcr.usd != null ? `${sfmt(diffBcr.usd, 1)} (${pfmt(diffBcr.pct, 1)})` : "—"}</td>
      <td className={cls(diffNuestro.usd)}>
        {diffNuestro.usd != null ? `${sfmt(diffNuestro.usd, 1)} (${pfmt(diffNuestro.pct, 1)})` : "—"}
      </td>
    </tr>
  );
}

type CampoPct = "alicuotaDex" | "reintegro" | "gastosComercialesPct";
type CampoUsd = "gastosPortuariosUsd" | "margenRiesgoUsd";
type CampoPctIndustria = "alicuotaDexAceite" | "alicuotaDexHarina" | "rindeAceite" | "rindeHarina" | "gastosComercialesPct";
type CampoUsdIndustria = "fobbingAceiteUsd" | "fobbingHarinaUsd" | "costoIndustrializacionUsd" | "margenRiesgoUsd";

export function CapacidadEditable({ granos, industria }: { granos: CapGranoClient[]; industria?: CapIndustriaClient | null }) {
  const [cfgs, setCfgs] = React.useState<Record<string, CapacidadModeloCfg>>(() =>
    Object.fromEntries(granos.map((g) => [g.underlying, g.cfg])),
  );
  const [cfgIndustria, setCfgIndustria] = React.useState<CapacidadIndustriaCfg | null>(industria?.cfg ?? null);

  const setCampoPct = (u: string, campo: CampoPct, raw: string) => {
    const n = Number(raw.replace(",", "."));
    setCfgs((prev) => ({ ...prev, [u]: { ...prev[u]!, [campo]: Number.isFinite(n) ? n / 100 : 0 } }));
  };
  const setCampoUsd = (u: string, campo: CampoUsd, raw: string) => {
    const n = Number(raw.replace(",", "."));
    setCfgs((prev) => ({ ...prev, [u]: { ...prev[u]!, [campo]: Number.isFinite(n) ? n : 0 } }));
  };
  const resetear = (u: string, cfgDefault: CapacidadModeloCfg) =>
    setCfgs((prev) => ({ ...prev, [u]: cfgDefault }));

  const setCampoPctIndustria = (campo: CampoPctIndustria, raw: string) => {
    const n = Number(raw.replace(",", "."));
    setCfgIndustria((prev) => (prev ? { ...prev, [campo]: Number.isFinite(n) ? n / 100 : 0 } : prev));
  };
  const setCampoUsdIndustria = (campo: CampoUsdIndustria, raw: string) => {
    const n = Number(raw.replace(",", "."));
    setCfgIndustria((prev) => (prev ? { ...prev, [campo]: Number.isFinite(n) ? n : 0 } : prev));
  };

  const filas = granos.map((g) => {
    const cfg = cfgs[g.underlying] ?? g.cfg;
    const fasNuestro = calcularFasTeorico(g.fobOficial, cfg);
    const editado = JSON.stringify(cfg) !== JSON.stringify(g.cfg);
    return { g, cfg, fasNuestro, editado };
  });

  const fasNuestroIndustria =
    industria && cfgIndustria
      ? calcularFasIndustria(
          industria.fobMercadoAceite,
          industria.fobOficialAceite,
          industria.fobMercadoHarina,
          industria.fobOficialHarina,
          industria.pizarra,
          cfgIndustria,
        )
      : null;
  const industriaEditada = !!(industria && cfgIndustria && JSON.stringify(cfgIndustria) !== JSON.stringify(industria.cfg));

  return (
    <div>
      <div className="table-scroll">
        <table className="tbl" style={{ minWidth: 700 }}>
          <thead>
            <tr>
              <th className="l" scope="col">Grano</th>
              <th scope="col">
                <InfoTip term="BCR">
                  FAS teórico que publica la Bolsa de Comercio de Rosario, columna SAGyP (FOB oficial −
                  derechos de exportación − gastos portuarios − gastos comerciales).
                </InfoTip>
              </th>
              <th scope="col">
                <InfoTip term="Nuestro">
                  FAS teórico ROFO AGRO: mismo FOB oficial (fuente independiente, SAGyP/MAGyP) con
                  supuestos de gastos EDITABLES (desplegá &quot;Ajustar supuestos&quot; abajo).
                </InfoTip>
              </th>
              <th scope="col">
                <InfoTip term="Pizarra">
                  Precio del disponible en u$s (CAC) — lo que efectivamente paga hoy el mercado.
                </InfoTip>
              </th>
              <th scope="col">
                <InfoTip term="Dif. BCR">
                  Pizarra − FAS BCR. Positivo: el mercado paga por ENCIMA de lo teórico (sobrepagado,
                  bueno para el productor). Negativo: paga por DEBAJO (subpagado, hay margen sin trasladar).
                </InfoTip>
              </th>
              <th scope="col">
                <InfoTip term="Dif. Nuestro">
                  Pizarra − FAS Nuestro, misma lectura que &quot;Dif. BCR&quot; pero contra el modelo propio.
                </InfoTip>
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ g, fasNuestro }) => (
              <React.Fragment key={g.underlying}>
                <FilaResultado
                  nombre={g.nombre}
                  glyph={
                    <span className="gglyph" style={{ color: glyphColor(g.underlying) }}>
                      {glyphFor(g.underlying)}
                    </span>
                  }
                  fasBcr={g.fasBcr}
                  fasNuestro={fasNuestro}
                  pizarra={g.pizarra}
                />
                {/* Industria pegada debajo de soja común, no al final de la tabla
                    (relevamiento 29/07, punto 28). */}
                {g.underlying === "SOJ" && industria && (
                  <FilaResultado
                    nombre={industria.nombre}
                    glyph={
                      <span className="gglyph" style={{ color: glyphColor("SOJ") }}>
                        {glyphFor("SOJ")}
                      </span>
                    }
                    fasBcr={industria.fasBcr}
                    fasNuestro={fasNuestroIndustria}
                    pizarra={industria.pizarra}
                  />
                )}
              </React.Fragment>
            ))}
            {filas.length === 0 && (
              <tr>
                <td className="l dim" colSpan={6}>
                  Sin datos de capacidad de pago todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <details className="qee">
        <summary className="qee-sum">Ajustar los supuestos de &quot;Nuestro&quot; (grano)</summary>
        <div className="qee-body">
          <p>
            Retenciones (alícuota vigente por decreto), reintegro, gastos portuarios (USD/tn), gastos
            comerciales (% del FOB) y un margen de riesgo del exportador explícito (BCR no lo modela —
            acá es una perilla, no un misterio). Arrancan sembrados de la propia planilla de BCR.
          </p>
          {filas.map(({ g, cfg, editado }) => (
            <div key={g.underlying} className="cap-cfg-row">
              <span className="grp-cell">
                <span className="gglyph" style={{ color: glyphColor(g.underlying) }}>
                  {glyphFor(g.underlying)}
                </span>
                <span className="gname">{g.nombre}</span>
              </span>
              <label className="cap-cfg-field">
                Retenciones %
                <input
                  type="number" inputMode="decimal" step="0.1" className="pz-input"
                  value={round1(cfg.alicuotaDex * 100)}
                  onChange={(e) => setCampoPct(g.underlying, "alicuotaDex", e.target.value)}
                  aria-label={`Retenciones % ${g.nombre}`}
                />
              </label>
              <label className="cap-cfg-field">
                Reintegro %
                <input
                  type="number" inputMode="decimal" step="0.1" className="pz-input"
                  value={round1(cfg.reintegro * 100)}
                  onChange={(e) => setCampoPct(g.underlying, "reintegro", e.target.value)}
                  aria-label={`Reintegro % ${g.nombre}`}
                />
              </label>
              <label className="cap-cfg-field">
                Gastos puerto USD/tn
                <input
                  type="number" inputMode="decimal" step="0.1" className="pz-input"
                  value={round1(cfg.gastosPortuariosUsd)}
                  onChange={(e) => setCampoUsd(g.underlying, "gastosPortuariosUsd", e.target.value)}
                  aria-label={`Gastos portuarios USD/tn ${g.nombre}`}
                />
              </label>
              <label className="cap-cfg-field">
                Gastos comerciales %
                <input
                  type="number" inputMode="decimal" step="0.1" className="pz-input"
                  value={round1(cfg.gastosComercialesPct * 100)}
                  onChange={(e) => setCampoPct(g.underlying, "gastosComercialesPct", e.target.value)}
                  aria-label={`Gastos comerciales % ${g.nombre}`}
                />
              </label>
              <label className="cap-cfg-field">
                Margen riesgo USD/tn
                <input
                  type="number" inputMode="decimal" step="0.1" className="pz-input"
                  value={round1(cfg.margenRiesgoUsd)}
                  onChange={(e) => setCampoUsd(g.underlying, "margenRiesgoUsd", e.target.value)}
                  aria-label={`Margen de riesgo USD/tn ${g.nombre}`}
                />
              </label>
              {editado && (
                <button type="button" className="pz-reset" title="Volver a los supuestos sembrados de BCR" onClick={() => resetear(g.underlying, g.cfg)}>
                  ↺
                </button>
              )}
            </div>
          ))}
        </div>
      </details>

      {industria && cfgIndustria && (
        <details className="qee">
          <summary className="qee-sum">Ajustar los supuestos de la Industria (soja)</summary>
          <div className="qee-body">
            <p>
              Complejo aceite + harina de soja: retenciones y fobbing por producto, rindes de molienda,
              gastos comerciales (% de la pizarra/A3, así lo define este modelo — no del FOB como en el
              de grano) y costo de industrialización. Cáscara (~6% del rinde) queda afuera: no hay una
              posición de FOB oficial propia verificada para ese subproducto. Fuente de los defaults:
              modelo de un tercero, parámetros vigente 04/2026 (docs/sesiones/2026-07-24-c16-capacidad-pago.md).
            </p>
            <div className="cap-cfg-row">
              <span className="grp-cell">
                <span className="gglyph" style={{ color: glyphColor("SOJ") }}>{glyphFor("SOJ")}</span>
                <span className="gname">Aceite</span>
              </span>
              <label className="cap-cfg-field">
                Retenciones %
                <input type="number" inputMode="decimal" step="0.1" className="pz-input"
                  value={round1(cfgIndustria.alicuotaDexAceite * 100)}
                  onChange={(e) => setCampoPctIndustria("alicuotaDexAceite", e.target.value)}
                  aria-label="Retenciones % aceite de soja" />
              </label>
              <label className="cap-cfg-field">
                Fobbing USD/tn
                <input type="number" inputMode="decimal" step="0.1" className="pz-input"
                  value={round1(cfgIndustria.fobbingAceiteUsd)}
                  onChange={(e) => setCampoUsdIndustria("fobbingAceiteUsd", e.target.value)}
                  aria-label="Fobbing USD/tn aceite de soja" />
              </label>
              <label className="cap-cfg-field">
                Rinde %
                <input type="number" inputMode="decimal" step="0.1" className="pz-input"
                  value={round1(cfgIndustria.rindeAceite * 100)}
                  onChange={(e) => setCampoPctIndustria("rindeAceite", e.target.value)}
                  aria-label="Rinde % aceite de soja" />
              </label>
            </div>
            <div className="cap-cfg-row">
              <span className="grp-cell">
                <span className="gglyph" style={{ color: glyphColor("SOJ") }}>{glyphFor("SOJ")}</span>
                <span className="gname">Harina</span>
              </span>
              <label className="cap-cfg-field">
                Retenciones %
                <input type="number" inputMode="decimal" step="0.1" className="pz-input"
                  value={round1(cfgIndustria.alicuotaDexHarina * 100)}
                  onChange={(e) => setCampoPctIndustria("alicuotaDexHarina", e.target.value)}
                  aria-label="Retenciones % harina de soja" />
              </label>
              <label className="cap-cfg-field">
                Fobbing USD/tn
                <input type="number" inputMode="decimal" step="0.1" className="pz-input"
                  value={round1(cfgIndustria.fobbingHarinaUsd)}
                  onChange={(e) => setCampoUsdIndustria("fobbingHarinaUsd", e.target.value)}
                  aria-label="Fobbing USD/tn harina de soja" />
              </label>
              <label className="cap-cfg-field">
                Rinde %
                <input type="number" inputMode="decimal" step="0.1" className="pz-input"
                  value={round1(cfgIndustria.rindeHarina * 100)}
                  onChange={(e) => setCampoPctIndustria("rindeHarina", e.target.value)}
                  aria-label="Rinde % harina de soja" />
              </label>
            </div>
            <div className="cap-cfg-row">
              <span className="grp-cell">
                <span className="gname">General</span>
              </span>
              <label className="cap-cfg-field">
                Gastos comerciales % (s/pizarra)
                <input type="number" inputMode="decimal" step="0.1" className="pz-input"
                  value={round1(cfgIndustria.gastosComercialesPct * 100)}
                  onChange={(e) => setCampoPctIndustria("gastosComercialesPct", e.target.value)}
                  aria-label="Gastos comerciales % industria soja" />
              </label>
              <label className="cap-cfg-field">
                Costo industrialización USD/tn
                <input type="number" inputMode="decimal" step="0.1" className="pz-input"
                  value={round1(cfgIndustria.costoIndustrializacionUsd)}
                  onChange={(e) => setCampoUsdIndustria("costoIndustrializacionUsd", e.target.value)}
                  aria-label="Costo de industrialización USD/tn" />
              </label>
              <label className="cap-cfg-field">
                Margen riesgo USD/tn
                <input type="number" inputMode="decimal" step="0.1" className="pz-input"
                  value={round1(cfgIndustria.margenRiesgoUsd)}
                  onChange={(e) => setCampoUsdIndustria("margenRiesgoUsd", e.target.value)}
                  aria-label="Margen de riesgo USD/tn industria soja" />
              </label>
              {industriaEditada && (
                <button type="button" className="pz-reset" title="Volver a los supuestos default" onClick={() => setCfgIndustria(industria.cfg)}>
                  ↺
                </button>
              )}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
