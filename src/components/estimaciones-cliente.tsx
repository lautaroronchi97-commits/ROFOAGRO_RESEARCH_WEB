"use client";

import { useMemo, useState } from "react";
import { nfmt, sfmt } from "@/lib/format";
import { ORG_LABEL } from "@/lib/calendario";
import {
  construirPizarra,
  construirCambios,
  construirSerie,
  campaniasDe,
  paisesDe,
  GRANO_LABEL,
  PAIS_LABEL,
  VAR_LABEL,
  type EstimRow,
  type Variable,
} from "@/lib/estimaciones";
import type { InterpretacionPublica } from "@/lib/interpretaciones";
import { EvolucionChart } from "./evolucion-chart";
import { MdLite } from "./md-lite";

const UNIDAD: Record<Variable, string> = { produccion: "Mt", area: "Mha", rinde: "tn/ha" };

/** Campaña (para grano+país) con más puntos totales — el mejor default para el gráfico. */
function campaniaMasRica(rows: EstimRow[], grano: string, pais: string): string {
  const camps = campaniasDe(rows, grano, pais);
  let best = camps[0] ?? "";
  let bestN = -1;
  for (const c of camps) {
    const n = rows.filter((r) => r.grano === grano && r.pais === pais && r.campania === c && r.variable === "produccion").length;
    if (n > bestN) {
      bestN = n;
      best = c;
    }
  }
  return best;
}

export function EstimacionesCliente({
  rows,
  granos,
  organismos,
  interpretaciones,
}: {
  rows: EstimRow[];
  granos: string[];
  organismos: string[];
  interpretaciones: InterpretacionPublica[];
}) {
  /* ---------- Pizarra (con filtros) ---------- */
  // Semántica de filtro (relevamiento web R7, punto 50): click en un chip deja SOLO ese valor;
  // re-click vuelve a mostrar todos — misma semántica que el calendario (punto 49), y ahora
  // también en organismo/país/campaña, no solo grano.
  const [granoSolo, setGranoSolo] = useState<string | null>(null);
  const [orgSolo, setOrgSolo] = useState<string | null>(null);
  const [paisSolo, setPaisSolo] = useState<string | null>(null);
  const [campSolo, setCampSolo] = useState<string | null>(null);
  const pizarra = useMemo(() => construirPizarra(rows), [rows]);
  const orgsDisp = useMemo(() => [...new Set(pizarra.map((c) => c.organismo))], [pizarra]);
  const paisesDisp = useMemo(() => [...new Set(pizarra.map((c) => c.pais))], [pizarra]);
  const campsDisp = useMemo(() => [...new Set(pizarra.map((c) => c.campania))].sort(), [pizarra]);
  const pizarraFilt = useMemo(
    () =>
      pizarra.filter(
        (c) =>
          (granoSolo === null || c.grano === granoSolo) &&
          (orgSolo === null || c.organismo === orgSolo) &&
          (paisSolo === null || c.pais === paisSolo) &&
          (campSolo === null || c.campania === campSolo),
      ),
    [pizarra, granoSolo, orgSolo, paisSolo, campSolo],
  );

  /* ---------- Gráfico de evolución (selectores) ---------- */
  // `granos[0]`/`paisesIni[0]` pueden ser undefined solo si `rows` viene vacío (sin estimaciones
  // cargadas todavía) — fallback a un valor por defecto en vez de un `!` que asumiría no-vacío.
  const granoIni = granos.includes("soja") ? "soja" : (granos[0] ?? "soja");
  const paisesIni = paisesDe(rows, granoIni);
  const paisIni = paisesIni.includes("brasil") ? "brasil" : (paisesIni[0] ?? "argentina");
  const [gGrano, setGGrano] = useState(granoIni);
  const [gPais, setGPais] = useState(paisIni);
  const [gVar, setGVar] = useState<Variable>("produccion");

  const paisesGrano = useMemo(() => paisesDe(rows, gGrano), [rows, gGrano]);
  // Fallback a gPais (no a un default ajeno) si paisesGrano viene vacío — conserva la selección
  // del usuario en vez de saltar a otro país cuando ese grano no tiene datos todavía.
  const paisEfectivo = paisesGrano.includes(gPais) ? gPais : (paisesGrano[0] ?? gPais);
  const campanias = useMemo(() => campaniasDe(rows, gGrano, paisEfectivo), [rows, gGrano, paisEfectivo]);
  const [gCampManual, setGCampManual] = useState<string | null>(null);
  const gCamp = gCampManual && campanias.includes(gCampManual) ? gCampManual : campaniaMasRica(rows, gGrano, paisEfectivo);

  const serie = useMemo(
    () => construirSerie(rows, gGrano, paisEfectivo, gCamp, gVar),
    [rows, gGrano, paisEfectivo, gCamp, gVar],
  );

  /* ---------- Cambios del último informe ---------- */
  const cambiosPorOrg = useMemo(
    () => organismos.map((o) => construirCambios(rows, o)).filter((c) => c.fecha),
    [rows, organismos],
  );

  return (
    <div className="estim">
      {/* ---- Pizarra ---- */}
      <div className="estim-block">
        <div className="cal-filters" role="group" aria-label="Filtrar por grano">
          {granos.map((g) => (
            <button
              key={g}
              type="button"
              className={`cal-fchip ${granoSolo !== null && granoSolo !== g ? "is-off" : ""}`}
              aria-pressed={granoSolo === g}
              onClick={() => setGranoSolo((prev) => (prev === g ? null : g))}
            >
              {GRANO_LABEL[g] ?? g}
            </button>
          ))}
        </div>
        <div className="cal-filters" role="group" aria-label="Filtrar por organismo">
          {orgsDisp.map((o) => (
            <button
              key={o}
              type="button"
              className={`cal-fchip org-${o} ${orgSolo !== null && orgSolo !== o ? "is-off" : ""}`}
              aria-pressed={orgSolo === o}
              onClick={() => setOrgSolo((prev) => (prev === o ? null : o))}
            >
              {ORG_LABEL[o as keyof typeof ORG_LABEL] ?? o}
            </button>
          ))}
        </div>
        <div className="cal-filters" role="group" aria-label="Filtrar por país">
          {paisesDisp.map((p) => (
            <button
              key={p}
              type="button"
              className={`cal-fchip ${paisSolo !== null && paisSolo !== p ? "is-off" : ""}`}
              aria-pressed={paisSolo === p}
              onClick={() => setPaisSolo((prev) => (prev === p ? null : p))}
            >
              {PAIS_LABEL[p] ?? p}
            </button>
          ))}
        </div>
        <div className="cal-filters" role="group" aria-label="Filtrar por campaña">
          {campsDisp.map((c) => (
            <button
              key={c}
              type="button"
              className={`cal-fchip ${campSolo !== null && campSolo !== c ? "is-off" : ""}`}
              aria-pressed={campSolo === c}
              onClick={() => setCampSolo((prev) => (prev === c ? null : c))}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="estim-tbl-wrap">
          <table className="estim-tbl">
            <thead>
              <tr>
                <th className="l">Grano</th>
                <th className="l">País</th>
                <th className="l">Organismo</th>
                <th className="r">Producción</th>
                <th className="r">Δ ant.</th>
                <th className="r">Área</th>
                <th className="r">Rinde</th>
                <th className="l">Campaña · dato</th>
              </tr>
            </thead>
            <tbody>
              {pizarraFilt.map((c, i) => (
                <tr key={`${c.grano}-${c.pais}-${c.organismo}-${i}`}>
                  <td className="l estim-grano">{GRANO_LABEL[c.grano] ?? c.grano}</td>
                  <td className="l">{PAIS_LABEL[c.pais] ?? c.pais}</td>
                  <td className="l">
                    <span className={`cal-org org-${c.organismo}`}>{ORG_LABEL[c.organismo as keyof typeof ORG_LABEL] ?? c.organismo}</span>
                  </td>
                  <td className="r num strong">{c.produccion != null ? `${nfmt(c.produccion, 2)}` : "—"}</td>
                  <td className="r num">
                    {c.deltaProd != null && c.deltaProd !== 0 ? (
                      <span className={`chip ${c.deltaProd > 0 ? "up" : "down"}`}>
                        <span className="ar">{c.deltaProd > 0 ? "▲" : "▼"}</span>
                        {sfmt(c.deltaProd, 2)}
                      </span>
                    ) : c.deltaProd === 0 ? (
                      <span className="estim-flat">=</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="r num">{c.area != null ? nfmt(c.area, 2) : "—"}</td>
                  <td className="r num">{c.rinde != null ? nfmt(c.rinde, 2) : "—"}</td>
                  <td className="l estim-vint">
                    <span className="estim-camp">{c.campania}</span>
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="estim-inf">
                        {c.informe} ↗
                      </a>
                    ) : (
                      <span className="estim-inf">{c.informe}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="estim-units">
          Producción en <b>Mt</b> (millones de t) · Área en <b>Mha</b> · Rinde en <b>tn/ha</b>. El Δ compara
          con la publicación anterior del mismo organismo y campaña. En Argentina, BCR y SAGyP se pueden
          mirar lado a lado.
        </p>
      </div>

      {/* ---- Evolución ---- */}
      <div className="estim-block">
        <h3 className="estim-h3">Evolución de la estimación</h3>
        <div className="estim-sels">
          <label className="estim-sel">
            <span>Grano</span>
            <select value={gGrano} onChange={(e) => { setGGrano(e.target.value); setGCampManual(null); }}>
              {granos.map((g) => (
                <option key={g} value={g}>{GRANO_LABEL[g] ?? g}</option>
              ))}
            </select>
          </label>
          <label className="estim-sel">
            <span>País</span>
            <select value={paisEfectivo} onChange={(e) => { setGPais(e.target.value); setGCampManual(null); }}>
              {paisesGrano.map((p) => (
                <option key={p} value={p}>{PAIS_LABEL[p] ?? p}</option>
              ))}
            </select>
          </label>
          <label className="estim-sel">
            <span>Campaña</span>
            <select value={gCamp} onChange={(e) => setGCampManual(e.target.value)}>
              {campanias.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="estim-sel">
            <span>Variable</span>
            <select value={gVar} onChange={(e) => setGVar(e.target.value as Variable)}>
              {(["produccion", "area", "rinde"] as Variable[]).map((v) => (
                <option key={v} value={v}>{VAR_LABEL[v]}</option>
              ))}
            </select>
          </label>
        </div>
        <EvolucionChart series={serie} unidad={UNIDAD[gVar]} variableLabel={VAR_LABEL[gVar]} />
        <p className="estim-units">
          {GRANO_LABEL[gGrano] ?? gGrano} · {PAIS_LABEL[paisEfectivo] ?? paisEfectivo} · campaña {gCamp} —{" "}
          {VAR_LABEL[gVar]} de cada organismo, publicación a publicación. Cada punto es un vintage guardado.
        </p>
      </div>

      {/* ---- Cambios del último informe ---- */}
      <div className="estim-block">
        <h3 className="estim-h3">Cambios del último informe</h3>
        <div className="estim-cambios">
          {cambiosPorOrg.length === 0 && <div className="cal-empty">Todavía no hay dos publicaciones para comparar.</div>}
          {cambiosPorOrg.map((c) => {
            const lectura = interpretaciones.find(
              (i) => i.organismo === c.organismo && i.fecha_publicacion === c.fecha,
            );
            return (
            <div className="estim-cam-card" key={c.organismo + c.fecha}>
              <div className="estim-cam-hd">
                <span className={`cal-org org-${c.organismo}`}>
                  {ORG_LABEL[c.organismo as keyof typeof ORG_LABEL] ?? c.organismo}
                </span>
                <span className="estim-cam-inf">{c.informe}</span>
                <span className="estim-cam-fecha">{c.fecha}</span>
              </div>
              {c.cambios.length === 0 ? (
                <div className="estim-cam-none">Sin cambios de producción (o primer registro).</div>
              ) : (
                <ul className="estim-cam-list">
                  {c.cambios.slice(0, 6).map((ch, i) => (
                    <li key={i}>
                      <span className="estim-cam-lbl">
                        {GRANO_LABEL[ch.grano] ?? ch.grano} · {PAIS_LABEL[ch.pais] ?? ch.pais} <span className="estim-cam-camp">{ch.campania}</span>
                      </span>
                      <span className="estim-cam-vals">
                        {nfmt(ch.antes, 2)} → <b>{nfmt(ch.ahora, 2)}</b>
                        {ch.delta !== 0 ? (
                          <span className={`chip ${ch.delta > 0 ? "up" : "down"}`}>
                            <span className="ar">{ch.delta > 0 ? "▲" : "▼"}</span>
                            {sfmt(ch.delta, 2)}
                          </span>
                        ) : (
                          <span className="estim-flat">=</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {lectura && (
                <details className="estim-lectura">
                  <summary>La lectura de la mesa</summary>
                  <MdLite md={lectura.publicado_md} className="estim-lectura-body" />
                </details>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
