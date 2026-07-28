"use client";

import * as React from "react";
import { nfmt, sfmt, pfmt, dirOf, arrowOf } from "@/lib/format";
import { GlyphSoja, GlyphMaiz, GlyphTrigo } from "./icons";
import { InfoTip } from "./infotip";
import { FiltroGrano, type GranoFiltroValue, type GranoKey } from "./filtro-grano";

/**
 * Tabla de arbitrajes con la pizarra (disponible USD) EDITABLE por grano.
 * Arranca con el valor de CAC (pizarraDefault); al cambiarlo se recalculan en
 * vivo el spread, la tasa directa y la TNA de cada posición. Los días vienen
 * fijos (vencimiento real de la posición), así que sólo depende de la pizarra.
 */

type Row = {
  pos: string;
  ref: number | null; // referencia: último ajuste (fuera de rueda) o último operado (en rueda)
  refMode: "ajuste" | "operado";
  vivo: boolean; // operó hoy → mostrar el punto en vivo
  variacion: number | null; // variación nominal del ajuste vs el cierre previo (US$)
  dias: number | null;
  volume: number | null;
  bid: number | null; // comprador (A3 en vivo, solo lectura)
  ask: number | null; // vendedor (A3 en vivo, solo lectura)
};
export type ArbGranoClient = {
  underlying: string;
  nombre: string;
  pizarraDefault: number | null;
  pizarraArs: number | null;
  pizarraEstimativa?: boolean;
  volTotalTn: number | null; // suma de todas las posiciones vivas, en tn (vivo si operó hoy, cierre si no)
  volTotalEsVivo: boolean;
  oiTotalTn: number | null; // interés abierto total, en tn (siempre de cierre)
  rows: Row[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const cls = (v: number | null) => (v == null ? "neu2" : v > 0 ? "pos" : v < 0 ? "neg" : "neu2");

function glyphFor(u: string) {
  if (u === "SOJ") return <GlyphSoja />;
  if (u === "MAI") return <GlyphMaiz />;
  return <GlyphTrigo />;
}
function glyphColor(u: string) {
  if (u === "SOJ") return "var(--brand-agro)";
  if (u === "MAI") return "var(--gold-text)";
  return "var(--brand-deep)";
}

export function ArbitrajesEditable({ granos }: { granos: ArbGranoClient[] }) {
  const [pz, setPz] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      granos.map((g) => [g.underlying, g.pizarraDefault != null ? String(g.pizarraDefault) : ""]),
    ),
  );
  const [filtro, setFiltro] = React.useState<GranoFiltroValue>("todos");

  const setOne = (u: string, v: string) => setPz((prev) => ({ ...prev, [u]: v }));

  const visibles = filtro === "todos" ? granos : granos.filter((g) => g.underlying === filtro);

  // Durante la rueda la 1ª columna muestra el último operado; fuera de rueda, el ajuste.
  const hayOperado = granos.some((g) => g.rows.some((r) => r.refMode === "operado"));
  const hayVivo = granos.some((g) => g.rows.some((r) => r.vivo));

  return (
    <div>
      <FiltroGrano value={filtro} onChange={setFiltro} presentes={granos.map((g) => g.underlying as GranoKey)} />
      <div className="table-scroll">
      <table className="tbl" style={{ minWidth: 840 }}>
        <thead>
          <tr>
            <th className="l" scope="col">Posición</th>
            <th scope="col">
              <InfoTip
                term={
                  <span className="ref-th">
                    {hayVivo && <span className="ref-live" aria-hidden="true" />}
                    {hayOperado ? "Últ. operado" : "Ajuste"}
                  </span>
                }
              >
                Fuera de rueda: el último ajuste (settlement de cierre). En rueda: el último precio
                operado de cada posición (A3), como la pantalla de mercado, hasta que salga el próximo
                ajuste. El punto verde marca las que operaron hoy; queda en — solo si A3 no tiene último
                operado.
              </InfoTip>
            </th>
            <th scope="col">
              <InfoTip term="Var US$">
                Variación nominal en dólares vs el ajuste anterior. En rueda se recalcula en vivo
                contra el último operado (A3) cada vez que hay una operación nueva; fuera de rueda
                es la variación oficial del último cierre (Matba Rofex). — antes de la 1ª operación
                del día.
              </InfoTip>
            </th>
            <th scope="col">
              <InfoTip term="Comprador">
                Mejor punta compradora (bid) del futuro en A3, en vivo (~1 min con rueda abierta).
                — = sin puntas (p. ej. fuera de rueda).
              </InfoTip>
            </th>
            <th scope="col">
              <InfoTip term="Vendedor">
                Mejor punta vendedora (oferta/ask) del futuro en A3, en vivo.
              </InfoTip>
            </th>
            <th scope="col">
              <InfoTip term="Spread US$">
                Diferencia entre el precio del futuro (ajuste o, en rueda, último operado) y la pizarra
                del disponible.
              </InfoTip>
            </th>
            <th scope="col">
              <InfoTip term="Tasa directa">
                Ese spread como % de la pizarra (futuro/pizarra − 1), sin anualizar.
              </InfoTip>
            </th>
            <th scope="col">
              <InfoTip term="TNA USD">
                La tasa directa anualizada en dólares (× 365/días al vto). Se recalcula al editar la pizarra.
              </InfoTip>
            </th>
            <th scope="col">Días</th>
            <th scope="col">Vol</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((g) => {
            const raw = pz[g.underlying];
            const n = Number(raw);
            const pizarra = raw !== "" && Number.isFinite(n) ? n : null;
            const editada = g.pizarraDefault != null && pizarra !== g.pizarraDefault;
            return (
              <React.Fragment key={g.underlying}>
                <tr className="grp">
                  <td className="l" colSpan={10}>
                    <span className="grp-cell">
                      <span className="gglyph" style={{ color: glyphColor(g.underlying) }}>
                        {glyphFor(g.underlying)}
                      </span>
                      <span className="gname">{g.nombre}</span>
                      <span className="gmeta">
                        disponible pizarra USD{" "}
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          className="pz-input"
                          value={raw}
                          onChange={(e) => setOne(g.underlying, e.target.value)}
                          aria-label={`Pizarra USD ${g.nombre}`}
                        />
                        {g.pizarraArs ? ` · ARS ${nfmt(g.pizarraArs, 0)}` : ""}
                        {g.pizarraEstimativa && !editada && (
                          <span className="pz-estim" title="CAC no fijó pizarra ese día: es una estimación (Dto. 1058/99), no un precio firme. Editá el valor si tenés el real.">
                            estimativa
                          </span>
                        )}
                        {editada && (
                          <button
                            type="button"
                            className="pz-reset"
                            title="Volver al valor de CAC"
                            onClick={() =>
                              setOne(g.underlying, g.pizarraDefault != null ? String(g.pizarraDefault) : "")
                            }
                          >
                            ↺
                          </button>
                        )}
                      </span>
                      <span className="gmeta gvol">
                        <InfoTip term={`Vol. ${g.volTotalEsVivo ? "en vivo" : "cierre"} ${g.volTotalTn != null ? nfmt(g.volTotalTn, 0) : "—"} t`}>
                          Volumen operado de todas las posiciones vivas, sumado. En rueda es en vivo (A3);
                          fuera de rueda, el del último cierre (Matba Rofex).
                        </InfoTip>
                        {" · "}
                        <InfoTip term={`Int. abierto ${g.oiTotalTn != null ? nfmt(g.oiTotalTn, 0) : "—"} t`}>
                          Interés abierto total (contratos vigentes sin cerrar), del último cierre — Matba
                          Rofex no lo publica en vivo.
                        </InfoTip>
                      </span>
                    </span>
                  </td>
                </tr>
                {g.rows.map((r) => {
                  const spread = r.ref != null && pizarra != null ? round2(r.ref - pizarra) : null;
                  const directa =
                    r.ref != null && pizarra != null && pizarra > 0
                      ? round2((r.ref / pizarra - 1) * 100)
                      : null;
                  const tna =
                    directa != null && r.dias != null && r.dias > 0
                      ? round2((directa * 365) / r.dias)
                      : null;
                  const d = dirOf(tna);
                  return (
                    <tr key={r.pos}>
                      <td className="l sym">{r.pos}</td>
                      <td>
                        {r.vivo && <span className="ref-live" aria-hidden="true" />}
                        {nfmt(r.ref, 2)}
                      </td>
                      <td className={cls(r.variacion)}>{sfmt(r.variacion, 2)}</td>
                      <td>{nfmt(r.bid, 2)}</td>
                      <td>{nfmt(r.ask, 2)}</td>
                      <td className={cls(spread)}>{sfmt(spread, 2)}</td>
                      <td className={cls(directa)}>{pfmt(directa, 2)}</td>
                      <td>
                        {tna != null ? (
                          <span className={`chip ${d === "up" ? "up" : d === "down" ? "down" : ""}`}>
                            <span className="ar">{arrowOf(d)}</span>
                            {pfmt(tna, 1)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="dim">{r.dias != null ? r.dias : "—"}</td>
                      <td className="dim">{r.volume != null ? nfmt(r.volume, 0) : "—"}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
          {visibles.length === 0 && (
            <tr>
              <td className="l dim" colSpan={10}>
                {granos.length === 0
                  ? "Sin datos de arbitrajes todavía (faltan cierres o pizarra)."
                  : "Sin datos para este grano."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
