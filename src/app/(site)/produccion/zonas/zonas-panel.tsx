"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { nfmt, pfmt, sfmt } from "@/lib/format";
import {
  GRANOS_ZONAS,
  GRANO_ZONA_LABEL,
  CAMPANIA_ZONAL_CONFIABLE,
  campaniasDeGrano,
  campaniaDefault,
  construirFotoCampania,
  evolucionParticipacion,
  type FilaZonaDB,
  type GranoZona,
} from "@/lib/pas-zonas-calc";
import { Panel, PanelHead } from "@/components/panel";
import { ChartTabla, type ChartTablaColumna, type ChartTablaFila } from "@/components/chart-tabla";
import { useCrosshair, SvgLineChartBase } from "@/components/chart-svg-base";

/**
 * Panel de producción por zona agroecológica (C23, docs/PLAN_PAS_ZONAS.md §6): foto de campaña
 * (tabla con la caída/suba descompuesta en efecto área/efecto rinde) + evolución histórica del %
 * de participación (top-6 zonas + "Resto"). Recibe las filas YA traídas por la página server
 * (`getPasZonas`, RLS solo-admin) — acá solo se agregan/renderizan, cero fetch nuevo.
 */

// Mismo set categórico de 7 colores que ya usan .org-*/.cam-* en globals.css (evolucion-chart.tsx,
// dolar-futuro-chart.tsx) — reasignado acá vía la custom property `--org-c` que esas reglas ya
// leen, sin inventar una paleta nueva ni CSS nuevo.
const PALETA_ZONAS = ["#4E9C3A", "#3E86A0", "#C08A2E", "#8A6D9E", "#B06A4A", "#7E8C74"];
const COLOR_RESTO = "var(--ink-3)";

const signCls = (v: number | null) => (v == null ? "neu2" : v > 0 ? "pos" : v < 0 ? "neg" : "neu2");

function FotoTabla({ filas, grano, campania }: { filas: FilaZonaDB[]; grano: string; campania: string }) {
  const foto = useMemo(() => construirFotoCampania(filas, grano, campania), [filas, grano, campania]);
  if (!foto) return <p className="dim" style={{ padding: "8px 2px" }}>Sin datos para esta combinación.</p>;

  const zonasOrdenadas = [...foto.zonas].sort((a, b) => (b.produccion_tn ?? -1) - (a.produccion_tn ?? -1));
  const filasTabla = foto.total ? [...zonasOrdenadas, foto.total] : zonasOrdenadas;

  return (
    <>
      {!foto.confiable && (
        <p className="lu-nota">
          ⚠ {campania} es anterior a {CAMPANIA_ZONAL_CONFIABLE}: en esa era el desglose zonal de BCBA
          no cubría todo el país (las zonas sumaban ~50% del TOTAL) — % del total y contribución no se
          calculan para no sugerir una precisión que el dato de origen no tiene.
        </p>
      )}
      {!foto.campaniaAnterior && (
        <p className="lu-nota">Primera campaña con dato para {GRANO_ZONA_LABEL[grano as GranoZona] ?? grano}: sin campaña anterior para comparar.</p>
      )}
      <div className="table-scroll">
        <table className="tbl" style={{ minWidth: 820 }}>
          <thead>
            <tr>
              <th className="l" scope="col">Zona</th>
              <th scope="col">Sembrado (ha)</th>
              <th scope="col">Perdido (ha)</th>
              <th scope="col">Cosechado (ha)</th>
              <th scope="col">Producción (t)</th>
              <th scope="col">Rinde (t/ha)</th>
              <th scope="col">% del total</th>
              <th scope="col" title="Δárea · rinde de la campaña anterior">Efecto área (t)</th>
              <th scope="col" title="Δrinde · área de esta campaña">Efecto rinde (t)</th>
              <th scope="col" title="Δ producción de la zona / TOTAL de la campaña anterior">Contrib. (pp)</th>
            </tr>
          </thead>
          <tbody>
            {filasTabla.map((z) => (
              <tr key={z.zona} style={z.zona === "TOTAL" ? { fontWeight: 700 } : undefined}>
                <td className="l sym">{z.zona}</td>
                <td>{z.sembrado_ha == null ? "—" : nfmt(z.sembrado_ha, 0)}</td>
                <td>{z.perdido_ha == null ? "—" : nfmt(z.perdido_ha, 0)}</td>
                <td>{z.cosechado_ha == null ? "—" : nfmt(z.cosechado_ha, 0)}</td>
                <td>{z.produccion_tn == null ? "—" : nfmt(z.produccion_tn, 0)}</td>
                <td>{z.rinde_tn_ha == null ? "—" : nfmt(z.rinde_tn_ha, 2)}</td>
                <td>{z.pctDelTotal == null ? "—" : `${nfmt(z.pctDelTotal, 1)}%`}</td>
                <td className={signCls(z.efectoAreaTn)}>{z.efectoAreaTn == null ? "—" : sfmt(z.efectoAreaTn, 0)}</td>
                <td className={signCls(z.efectoRindeTn)}>{z.efectoRindeTn == null ? "—" : sfmt(z.efectoRindeTn, 0)}</td>
                <td className={signCls(z.contribucionPp)}>{z.contribucionPp == null ? "—" : sfmt(z.contribucionPp, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const W = 660;
const H = 260;
const pad = { l: 40, r: 16, t: 16, b: 26 };
const iw = W - pad.l - pad.r;
const ih = H - pad.t - pad.b;

function EvolucionParticipacionChart({ filas, grano }: { filas: FilaZonaDB[]; grano: string }) {
  const { campanias, series } = useMemo(() => evolucionParticipacion(filas, grano), [filas, grano]);

  const X = (i: number) => (campanias.length <= 1 ? pad.l + iw / 2 : pad.l + (i / (campanias.length - 1)) * iw);
  let yMax = 0;
  for (const s of series) for (const p of s.puntos) if (p.pct > yMax) yMax = p.pct;
  yMax = Math.min(100, Math.ceil((yMax + 5) / 5) * 5) || 10;
  const Y = (pct: number) => pad.t + (1 - pct / yMax) * ih;
  const yTicks = Array.from({ length: 5 }, (_, k) => (yMax * k) / 4);

  const { hi, onPointerMove, onPointerLeave } = useCrosshair(W, H, (px) => {
    if (campanias.length === 0) return null;
    const idx = Math.round(((px - pad.l) / iw) * (campanias.length - 1));
    return Math.min(campanias.length - 1, Math.max(0, idx));
  });

  // Índices de etiqueta del eje X: como máximo 9, parejo en todo el rango (nunca dos adyacentes
  // — round() sobre un paso fijo puede juntar el último tick "forzado" con el anterior si no
  // caen exactos, por eso se generan los 9 de una sola pasada en vez de "cada N + el último").
  const MAX_TICKS = 9;
  const tickIndices =
    campanias.length <= MAX_TICKS
      ? campanias.map((_, i) => i)
      : [...new Set(Array.from({ length: MAX_TICKS }, (_, k) => Math.round((k * (campanias.length - 1)) / (MAX_TICKS - 1))))];

  const columnas: ChartTablaColumna[] = [
    { key: "campania", label: "Campaña", align: "left" },
    ...series.map((s) => ({ key: s.zona, label: `${s.zona} (%)` })),
  ];
  const filasTabla: ChartTablaFila[] = campanias.map((c, i) => {
    const fila: ChartTablaFila = { campania: c };
    for (const s of series) fila[s.zona] = nfmt(s.puntos[i]?.pct ?? 0, 1);
    return fila;
  });

  if (campanias.length === 0) {
    return <div className="chart-wrap chart-empty">Sin campañas confiables ({CAMPANIA_ZONAL_CONFIABLE} en adelante) para este grano.</div>;
  }

  return (
    <>
      <SvgLineChartBase
        w={W}
        h={H}
        inner={{ x: pad.l, y: pad.t, width: iw, height: ih }}
        ariaLabel="Evolución del % de participación por zona"
        yTicks={yTicks.map((t) => ({ valor: t, y: Y(t), label: `${nfmt(t, 0)}%` }))}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        after={
          <>
            {hi !== null && (
              <div className="cv-tip" style={{ left: `${(X(hi) / W) * 100}%`, top: "8px" }}>
                <span className="tt-x">{campanias[hi]}</span>
                {series.map((s) => (
                  <div key={s.zona}>{s.zona}: {nfmt(s.puntos[hi]?.pct ?? 0, 1)}%</div>
                ))}
              </div>
            )}
            <div className="cv-legend">
              {series.map((s, i) => {
                const color = s.zona === "Resto" ? COLOR_RESTO : (PALETA_ZONAS[i % PALETA_ZONAS.length] ?? PALETA_ZONAS[0]!);
                const ultimo = s.puntos[s.puntos.length - 1];
                return (
                  <span className="lk" key={s.zona} style={{ "--org-c": color } as React.CSSProperties}>
                    <span className="sw evo-sw" />
                    {s.zona}
                    <span className="lk-val">{ultimo ? nfmt(ultimo.pct, 1) : "—"}%</span>
                  </span>
                );
              })}
            </div>
          </>
        }
      >
        {tickIndices.map((i) => {
          const c = campanias[i];
          if (!c) return null;
          return (
            <text key={c} className="cv-axis" x={X(i)} y={H - 8} textAnchor="middle">
              {c}
            </text>
          );
        })}
        {series.map((s, i) => {
          const color = s.zona === "Resto" ? COLOR_RESTO : (PALETA_ZONAS[i % PALETA_ZONAS.length] ?? PALETA_ZONAS[0]!);
          const d = s.puntos.map((p, k) => `${k ? "L" : "M"}${X(k).toFixed(1)},${Y(p.pct).toFixed(1)}`).join(" ");
          return (
            <g key={s.zona} className="evo-serie" style={{ "--org-c": color } as React.CSSProperties}>
              <path d={d} className="evo-line" />
              <circle cx={X(s.puntos.length - 1)} cy={Y(s.puntos[s.puntos.length - 1]?.pct ?? 0)} r={4} className="evo-end" />
            </g>
          );
        })}
        {hi !== null && (
          <g>
            <line className="cv-cross" x1={X(hi)} y1={pad.t} x2={X(hi)} y2={pad.t + ih} />
            {series.map((s, i) => {
              const color = s.zona === "Resto" ? COLOR_RESTO : (PALETA_ZONAS[i % PALETA_ZONAS.length] ?? PALETA_ZONAS[0]!);
              return (
                <circle key={s.zona} className="evo-focus" style={{ "--org-c": color } as React.CSSProperties} cx={X(hi)} cy={Y(s.puntos[hi]?.pct ?? 0)} r={4} />
              );
            })}
          </g>
        )}
      </SvgLineChartBase>
      <ChartTabla columnas={columnas} filas={filasTabla} exportCsv={`pas-zonas-participacion-${grano}`} nota="% de la producción TOTAL de esa campaña; top-6 zonas por participación media de las últimas 5 campañas, el resto agregado en 'Resto'." />
    </>
  );
}

export function ZonasPanel({ filas, error }: { filas: FilaZonaDB[]; error: string | null }) {
  const granosPresentes = useMemo(
    () => GRANOS_ZONAS.filter((g) => filas.some((f) => f.grano === g)),
    [filas],
  );
  const [grano, setGrano] = useState<string>(granosPresentes[0] ?? "soja");
  const granoEfectivo = granosPresentes.includes(grano as GranoZona) ? grano : (granosPresentes[0] ?? grano);

  const campanias = useMemo(() => campaniasDeGrano(filas, granoEfectivo), [filas, granoEfectivo]);
  const [campManual, setCampManual] = useState<string | null>(null);
  const campEfectiva = campManual && campanias.includes(campManual) ? campManual : (campaniaDefault(filas, granoEfectivo) ?? campanias[campanias.length - 1] ?? "");

  const foto = useMemo(
    () => (campEfectiva ? construirFotoCampania(filas, granoEfectivo, campEfectiva) : null),
    [filas, granoEfectivo, campEfectiva],
  );

  if (error) {
    return (
      <Panel id="produccion-zonas">
        <PanelHead title="Producción por zona agroecológica" sub="BCBA-PAS · solo mesa" />
        <p className="dim" style={{ padding: "8px 2px" }}>No se pudo cargar (probá recargar en un rato).</p>
      </Panel>
    );
  }

  if (filas.length === 0) {
    return (
      <Panel id="produccion-zonas">
        <PanelHead title="Producción por zona agroecológica" sub="BCBA-PAS · solo mesa" />
        <p className="dim" style={{ padding: "8px 2px" }}>
          Todavía no hay datos cargados. Subí el export de zonas desde{" "}
          <a href="/admin/datos#pas-zonas">/admin/datos</a>.
        </p>
      </Panel>
    );
  }

  const zonaLider = foto?.zonas.reduce((max, z) => ((z.produccion_tn ?? -1) > (max?.produccion_tn ?? -1) ? z : max), foto.zonas[0]);
  const deltaNacionalPct =
    foto?.total?.deltaProdTn != null && foto.campaniaAnterior
      ? construirFotoCampania(filas, granoEfectivo, foto.campaniaAnterior)?.total?.produccion_tn
        ? (foto.total.deltaProdTn / construirFotoCampania(filas, granoEfectivo, foto.campaniaAnterior)!.total!.produccion_tn!) * 100
        : null
      : null;

  return (
    <Panel id="produccion-zonas">
      <PanelHead title="Producción por zona agroecológica" sub="BCBA-PAS · foto de campaña + evolución de participación · solo mesa" />

      <div className="estim-sels">
        <label className="estim-sel">
          <span>Grano</span>
          <select value={granoEfectivo} onChange={(e) => { setGrano(e.target.value); setCampManual(null); }}>
            {granosPresentes.map((g) => (
              <option key={g} value={g}>{GRANO_ZONA_LABEL[g]}</option>
            ))}
          </select>
        </label>
        <label className="estim-sel">
          <span>Campaña</span>
          <select value={campEfectiva} onChange={(e) => setCampManual(e.target.value)}>
            {[...campanias].reverse().map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      {foto?.total && (
        <div className="lu-kpis">
          <div className="lu-kpi">
            <span className="lu-kpi-v">{nfmt((foto.total.produccion_tn ?? 0) / 1e6, 1)} Mt</span>
            <span className="lu-kpi-l">producción TOTAL · {campEfectiva}</span>
          </div>
          <div className="lu-kpi">
            <span className={`lu-kpi-v ${signCls(deltaNacionalPct)}`}>{deltaNacionalPct == null ? "—" : pfmt(deltaNacionalPct, 1)}</span>
            <span className="lu-kpi-l">Δ vs. {foto.campaniaAnterior ?? "—"}</span>
          </div>
          <div className="lu-kpi">
            <span className="lu-kpi-v">{zonaLider ? zonaLider.zona : "—"}</span>
            <span className="lu-kpi-l">zona líder{zonaLider?.pctDelTotal != null ? ` (${nfmt(zonaLider.pctDelTotal, 0)}%)` : ""}</span>
          </div>
        </div>
      )}

      <h3 className="lu-h3">Foto de campaña · {campEfectiva}</h3>
      <FotoTabla filas={filas} grano={granoEfectivo} campania={campEfectiva} />

      <h3 className="lu-h3">Evolución del % de participación por zona</h3>
      <p className="lu-nota">
        Desde {CAMPANIA_ZONAL_CONFIABLE} (antes las zonas no cubrían todo el país). Top-6 zonas por
        participación media de las últimas 5 campañas + &quot;Resto&quot; agregado.
      </p>
      <EvolucionParticipacionChart filas={filas} grano={granoEfectivo} />
    </Panel>
  );
}
