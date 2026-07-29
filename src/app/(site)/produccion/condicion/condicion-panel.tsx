"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { nfmt } from "@/lib/format";
import {
  GRANO_CONDICION_LABEL,
  granosPresentes,
  ciclosDeGrano,
  campaniasDeGranoCiclo,
  campaniaDefaultCondicion,
  overlayBuenaExcelente,
  overlayAdecuadaOptima,
  fenologiaCampania,
  type FilaCondicionDB,
  type GranoCondicion,
  type SerieCampania,
} from "@/lib/pas-condicion-calc";
import { Panel, PanelHead } from "@/components/panel";
import { ChartTabla, type ChartTablaColumna, type ChartTablaFila } from "@/components/chart-tabla";
import { useCrosshair, SvgLineChartBase } from "@/components/chart-svg-base";

/**
 * Panel de condición de cultivos BCBA-PAS (C27, docs/PLAN_PAS_ZONAS.md §6): 3 charts semanales
 * por campaña — condición de cultivo (Buena+Excelente), condición hídrica (Adecuada+Óptima) y
 * fenología (multi-etapa) — con el eje SIEMPRE "semana de campaña" (el origen no publica fechas).
 * Recibe las filas YA traídas por la página server (`getPasCondicion`, RLS solo-admin).
 */

const COLOR_ACTUAL = "#4E9C3A";
const COLOR_PREVIA = "var(--ink-3)";
const PALETA_ETAPAS = ["#4E9C3A", "#3E86A0", "#C08A2E", "#8A6D9E", "#B06A4A", "#7E8C74"];

const W = 660;
const H = 260;
const pad = { l: 40, r: 16, t: 16, b: 26 };
const iw = W - pad.l - pad.r;
const ih = H - pad.t - pad.b;

/** Universo de semanas (unión, ascendente) presentes en cualquiera de las series — el eje es
 * por ÍNDICE (no valor crudo), mismo criterio que la evolución de participación de zonas: tolera
 * huecos (semanas sin dato no aparecen en el archivo) sin distorsionar el espaciado. */
function semanasUniverso(series: { puntos: { semana: number }[] }[]): number[] {
  return [...new Set(series.flatMap((s) => s.puntos.map((p) => p.semana)))].sort((a, b) => a - b);
}

function OverlayChart({
  titulo,
  series,
  campaniaSeleccionada,
  exportCsv,
  nota,
}: {
  titulo: string;
  series: SerieCampania[];
  campaniaSeleccionada: string;
  exportCsv: string;
  nota: string;
}) {
  const semanas = useMemo(() => semanasUniverso(series), [series]);
  const valorPorCampania = useMemo(() => {
    const m = new Map<string, Map<number, number | null>>();
    for (const s of series) m.set(s.campania, new Map(s.puntos.map((p) => [p.semana, p.valor])));
    return m;
  }, [series]);

  const X = (i: number) => (semanas.length <= 1 ? pad.l + iw / 2 : pad.l + (i / (semanas.length - 1)) * iw);
  let yMax = 10;
  for (const s of series) for (const p of s.puntos) if (p.valor != null && p.valor > yMax) yMax = p.valor;
  yMax = Math.min(100, Math.ceil((yMax + 5) / 10) * 10);
  const Y = (v: number) => pad.t + (1 - v / yMax) * ih;
  const yTicks = Array.from({ length: 5 }, (_, k) => (yMax * k) / 4);

  const { hi, onPointerMove, onPointerLeave } = useCrosshair(W, H, (px) => {
    if (semanas.length === 0) return null;
    const idx = Math.round(((px - pad.l) / iw) * (semanas.length - 1));
    return Math.min(semanas.length - 1, Math.max(0, idx));
  });

  const MAX_TICKS = 9;
  const tickIndices =
    semanas.length <= MAX_TICKS
      ? semanas.map((_, i) => i)
      : [...new Set(Array.from({ length: MAX_TICKS }, (_, k) => Math.round((k * (semanas.length - 1)) / (MAX_TICKS - 1))))];

  const columnas: ChartTablaColumna[] = [
    { key: "semana", label: "Semana", align: "left" },
    ...series.map((s) => ({ key: s.campania, label: `${s.campania} (%)` })),
  ];
  const filasTabla: ChartTablaFila[] = semanas.map((sem) => {
    const fila: ChartTablaFila = { semana: sem };
    for (const s of series) {
      const v = valorPorCampania.get(s.campania)?.get(sem) ?? null;
      fila[s.campania] = v == null ? "—" : nfmt(v, 1);
    }
    return fila;
  });

  if (semanas.length === 0) {
    return <div className="chart-wrap chart-empty">Sin datos para este cultivo/ciclo.</div>;
  }

  // Otras campañas primero (grises, atrás) y la seleccionada al final (color pleno, adelante).
  const otras = series.filter((s) => s.campania !== campaniaSeleccionada);
  const actual = series.find((s) => s.campania === campaniaSeleccionada);
  const ordenDibujo = actual ? [...otras, actual] : otras;

  return (
    <>
      <h3 className="lu-h3">{titulo}</h3>
      <p className="lu-nota">{nota}</p>
      <SvgLineChartBase
        w={W}
        h={H}
        inner={{ x: pad.l, y: pad.t, width: iw, height: ih }}
        ariaLabel={titulo}
        yTicks={yTicks.map((t) => ({ valor: t, y: Y(t), label: `${nfmt(t, 0)}%` }))}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        after={
          <>
            {hi !== null && (
              <div className="cv-tip" style={{ left: `${(X(hi) / W) * 100}%`, top: "8px" }}>
                <span className="tt-x">Semana {semanas[hi]}</span>
                <div>{campaniaSeleccionada}: {(() => { const v = valorPorCampania.get(campaniaSeleccionada)?.get(semanas[hi]!); return v == null ? "—" : `${nfmt(v, 1)}%`; })()}</div>
              </div>
            )}
          </>
        }
      >
        {tickIndices.map((i) => (
          <text key={i} className="cv-axis" x={X(i)} y={H - 8} textAnchor="middle">
            {semanas[i]}
          </text>
        ))}
        {ordenDibujo.map((s) => {
          const esActual = s.campania === campaniaSeleccionada;
          const puntosPorSemana = new Map(s.puntos.map((p) => [p.semana, p.valor]));
          const segmentos: string[] = [];
          let trazoAbierto = false;
          semanas.forEach((sem, i) => {
            const v = puntosPorSemana.get(sem);
            if (v == null) {
              trazoAbierto = false;
              return;
            }
            segmentos.push(`${trazoAbierto ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
            trazoAbierto = true;
          });
          return (
            <g
              key={s.campania}
              className="evo-serie"
              style={{ "--org-c": esActual ? COLOR_ACTUAL : COLOR_PREVIA, opacity: esActual ? 1 : 0.45 } as React.CSSProperties}
            >
              <path d={segmentos.join(" ")} className="evo-line" strokeWidth={esActual ? 2.4 : 1.3} />
            </g>
          );
        })}
        {hi !== null && <line className="cv-cross" x1={X(hi)} y1={pad.t} x2={X(hi)} y2={pad.t + ih} />}
      </SvgLineChartBase>
      <ChartTabla columnas={columnas} filas={filasTabla} exportCsv={exportCsv} nota="% por semana de campaña; una columna por campaña." />
    </>
  );
}

function FenologiaChart({ grano, ciclo, campania, filas }: { grano: string; ciclo: string; campania: string; filas: FilaCondicionDB[] }) {
  const series = useMemo(() => fenologiaCampania(filas, grano, ciclo, campania), [filas, grano, ciclo, campania]);
  const semanas = useMemo(() => semanasUniverso(series), [series]);

  const X = (i: number) => (semanas.length <= 1 ? pad.l + iw / 2 : pad.l + (i / (semanas.length - 1)) * iw);
  const Y = (v: number) => pad.t + (1 - v / 100) * ih;
  const yTicks = [0, 25, 50, 75, 100];

  const { hi, onPointerMove, onPointerLeave } = useCrosshair(W, H, (px) => {
    if (semanas.length === 0) return null;
    const idx = Math.round(((px - pad.l) / iw) * (semanas.length - 1));
    return Math.min(semanas.length - 1, Math.max(0, idx));
  });

  const MAX_TICKS = 9;
  const tickIndices =
    semanas.length <= MAX_TICKS
      ? semanas.map((_, i) => i)
      : [...new Set(Array.from({ length: MAX_TICKS }, (_, k) => Math.round((k * (semanas.length - 1)) / (MAX_TICKS - 1))))];

  const columnas: ChartTablaColumna[] = [
    { key: "semana", label: "Semana", align: "left" },
    ...series.map((s) => ({ key: s.etapa, label: `${s.etapa} (%)` })),
  ];
  const filasTabla: ChartTablaFila[] = semanas.map((sem, i) => {
    const fila: ChartTablaFila = { semana: sem };
    for (const s of series) fila[s.etapa] = s.puntos[i]?.pct == null ? "—" : nfmt(s.puntos[i]!.pct!, 1);
    return fila;
  });

  if (semanas.length === 0 || series.length === 0) {
    return <div className="chart-wrap chart-empty">Sin datos de fenología para {campania}.</div>;
  }

  return (
    <>
      <SvgLineChartBase
        w={W}
        h={H}
        inner={{ x: pad.l, y: pad.t, width: iw, height: ih }}
        ariaLabel="Fenología por etapa"
        yTicks={yTicks.map((t) => ({ valor: t, y: Y(t), label: `${t}%` }))}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        after={
          <>
            {hi !== null && (
              <div className="cv-tip" style={{ left: `${(X(hi) / W) * 100}%`, top: "8px" }}>
                <span className="tt-x">Semana {semanas[hi]}</span>
                {series.map((s) => (
                  <div key={s.etapa}>{s.etapa}: {s.puntos[hi]?.pct == null ? "—" : `${nfmt(s.puntos[hi]!.pct!, 1)}%`}</div>
                ))}
              </div>
            )}
            <div className="cv-legend">
              {series.map((s, i) => (
                <span className="lk" key={s.etapa} style={{ "--org-c": PALETA_ETAPAS[i % PALETA_ETAPAS.length] } as React.CSSProperties}>
                  <span className="sw evo-sw" />
                  {s.etapa}
                </span>
              ))}
            </div>
          </>
        }
      >
        {tickIndices.map((i) => (
          <text key={i} className="cv-axis" x={X(i)} y={H - 8} textAnchor="middle">
            {semanas[i]}
          </text>
        ))}
        {series.map((s, i) => {
          const color = PALETA_ETAPAS[i % PALETA_ETAPAS.length]!;
          const segmentos: string[] = [];
          let abierto = false;
          s.puntos.forEach((p, k) => {
            if (p.pct == null) {
              abierto = false;
              return;
            }
            segmentos.push(`${abierto ? "L" : "M"}${X(k).toFixed(1)},${Y(p.pct).toFixed(1)}`);
            abierto = true;
          });
          return (
            <g key={s.etapa} className="evo-serie" style={{ "--org-c": color } as React.CSSProperties}>
              <path d={segmentos.join(" ")} className="evo-line" />
            </g>
          );
        })}
        {hi !== null && <line className="cv-cross" x1={X(hi)} y1={pad.t} x2={X(hi)} y2={pad.t + ih} />}
      </SvgLineChartBase>
      <ChartTabla columnas={columnas} filas={filasTabla} exportCsv={`pas-condicion-fenologia-${grano}-${ciclo}-${campania.replace("/", "-")}`} nota="% del área en cada etapa fenológica, por semana de campaña." />
    </>
  );
}

export function CondicionPanel({ filas, error }: { filas: FilaCondicionDB[]; error: string | null }) {
  const granos = useMemo(() => granosPresentes(filas), [filas]);
  const [granoSel, setGranoSel] = useState<string>(granos[0] ?? "soja");
  const grano = granos.includes(granoSel as GranoCondicion) ? granoSel : (granos[0] ?? granoSel);

  const ciclos = useMemo(() => ciclosDeGrano(filas, grano), [filas, grano]);
  const [cicloManual, setCicloManual] = useState<string | null>(null);
  const ciclo = cicloManual && ciclos.includes(cicloManual) ? cicloManual : (ciclos[0] ?? "total");

  const campanias = useMemo(() => campaniasDeGranoCiclo(filas, grano, ciclo), [filas, grano, ciclo]);
  const [campManual, setCampManual] = useState<string | null>(null);
  const campania = campManual && campanias.includes(campManual) ? campManual : (campaniaDefaultCondicion(filas, grano, ciclo) ?? campanias.at(-1) ?? "");

  const overlayCC = useMemo(() => overlayBuenaExcelente(filas, grano, ciclo), [filas, grano, ciclo]);
  const overlayCH = useMemo(() => overlayAdecuadaOptima(filas, grano, ciclo), [filas, grano, ciclo]);

  if (error) {
    return (
      <Panel id="produccion-condicion">
        <PanelHead title="Condición de cultivos" sub="BCBA-PAS · solo mesa" />
        <p className="dim" style={{ padding: "8px 2px" }}>No se pudo cargar (probá recargar en un rato).</p>
      </Panel>
    );
  }

  if (filas.length === 0) {
    return (
      <Panel id="produccion-condicion">
        <PanelHead title="Condición de cultivos" sub="BCBA-PAS · solo mesa" />
        <p className="dim" style={{ padding: "8px 2px" }}>
          Todavía no hay datos cargados. Subí el export de condición desde{" "}
          <a href="/admin/datos#pas-condicion">/admin/datos</a> (un archivo por cultivo).
        </p>
      </Panel>
    );
  }

  return (
    <Panel id="produccion-condicion">
      <PanelHead title="Condición de cultivos" sub="BCBA-PAS · condición semanal + fenología · solo mesa" />

      <div className="estim-sels">
        <label className="estim-sel">
          <span>Cultivo</span>
          <select value={grano} onChange={(e) => { setGranoSel(e.target.value); setCicloManual(null); setCampManual(null); }}>
            {granos.map((g) => (
              <option key={g} value={g}>{GRANO_CONDICION_LABEL[g as GranoCondicion] ?? g}</option>
            ))}
          </select>
        </label>
        {ciclos.length > 1 && (
          <label className="estim-sel">
            <span>Ciclo</span>
            <select value={ciclo} onChange={(e) => { setCicloManual(e.target.value); setCampManual(null); }}>
              {ciclos.map((c) => (
                <option key={c} value={c}>{c === "total" ? "Total" : c}</option>
              ))}
            </select>
          </label>
        )}
        <label className="estim-sel">
          <span>Campaña</span>
          <select value={campania} onChange={(e) => setCampManual(e.target.value)}>
            {[...campanias].reverse().map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="lu-nota">
        Eje = semana de campaña (el origen de BCBA-PAS no publica fechas). La campaña elegida se
        destaca en color pleno; las anteriores quedan en gris de fondo como referencia histórica.
      </p>

      <OverlayChart
        titulo="Condición de cultivo (Buena + Excelente)"
        series={overlayCC}
        campaniaSeleccionada={campania}
        exportCsv={`pas-condicion-cultivo-${grano}-${ciclo}`}
        nota="% del área en condición Buena o Excelente."
      />

      <OverlayChart
        titulo="Condición hídrica (Adecuada + Óptima)"
        series={overlayCH}
        campaniaSeleccionada={campania}
        exportCsv={`pas-condicion-hidrica-${grano}-${ciclo}`}
        nota="% del área con humedad Adecuada u Óptima."
      />

      <h3 className="lu-h3">Fenología · {campania}</h3>
      <FenologiaChart grano={grano} ciclo={ciclo} campania={campania} filas={filas} />
    </Panel>
  );
}
