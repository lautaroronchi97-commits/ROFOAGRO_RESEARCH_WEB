"use client";

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
import { useTheme } from "next-themes";
import { Panel, PanelHead } from "@/components/panel";
import { ChartTabla, type ChartTablaColumna, type ChartTablaFila } from "@/components/chart-tabla";
import { RfChart } from "@/charts/RfChart";
import { paletteFor } from "@/charts/rofoTheme";

/**
 * Panel de condición de cultivos BCBA-PAS (C27, docs/PLAN_PAS_ZONAS.md §6): 3 charts semanales
 * por campaña — condición de cultivo (Buena+Excelente), condición hídrica (Adecuada+Óptima) y
 * fenología (multi-etapa) — con el eje SIEMPRE "semana de campaña" (el origen no publica fechas).
 * Recibe las filas YA traídas por la página server (`getPasCondicion`, RLS solo-admin).
 */

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
  const { resolvedTheme } = useTheme();
  const p = paletteFor(resolvedTheme === "dark" ? "dark" : "light");

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

  return (
    <>
      <h3 className="lu-h3">{titulo}</h3>
      <p className="lu-nota">{nota}</p>
      <RfChart
        ariaLabel={titulo}
        exportName={exportCsv}
        xTitle="Semana de campaña"
        yTitle="% del área"
        valueFormatter={(v) => `${nfmt(v, 1)}%`}
        option={{
          xAxis: { type: "category", data: semanas.map((s) => String(s)) },
          yAxis: { type: "value", min: 0, axisLabel: { formatter: (v: number) => `${nfmt(v, 0)}%` } },
          // Patrón "emphasis" (skill dataviz): la campaña elegida en color pleno + más gruesa,
          // el resto en gris de fondo — no categórico (son referencia histórica, no entidades a
          // distinguir entre sí una de otra).
          series: series.map((s) => {
            const esActual = s.campania === campaniaSeleccionada;
            return {
              name: s.campania,
              type: "line",
              symbol: "none",
              data: semanas.map((sem) => valorPorCampania.get(s.campania)?.get(sem) ?? null),
              itemStyle: { color: esActual ? p.brandDeep : p.ink3 },
              lineStyle: { color: esActual ? p.brandDeep : p.ink3, width: esActual ? 2.4 : 1.3, opacity: esActual ? 1 : 0.45 },
              z: esActual ? 10 : 1,
            };
          }),
        }}
      />
      <ChartTabla columnas={columnas} filas={filasTabla} exportCsv={exportCsv} nota="% por semana de campaña; una columna por campaña." colapsable />
    </>
  );
}

function FenologiaChart({ grano, ciclo, campania, filas }: { grano: string; ciclo: string; campania: string; filas: FilaCondicionDB[] }) {
  const series = useMemo(() => fenologiaCampania(filas, grano, ciclo, campania), [filas, grano, ciclo, campania]);
  const semanas = useMemo(() => semanasUniverso(series), [series]);

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
      <RfChart
        ariaLabel="Fenología por etapa"
        exportName={`pas-condicion-fenologia-${grano}-${ciclo}-${campania.replace("/", "-")}`}
        xTitle="Semana de campaña"
        yTitle="% del área"
        valueFormatter={(v) => `${nfmt(v, 1)}%`}
        option={{
          xAxis: { type: "category", data: semanas.map((s) => String(s)) },
          yAxis: { type: "value", min: 0, max: 100, axisLabel: { formatter: (v: number) => `${v}%` } },
          series: series.map((s) => ({
            name: s.etapa,
            type: "line",
            symbol: "none",
            data: s.puntos.map((pt) => pt.pct),
          })),
        }}
      />
      <ChartTabla columnas={columnas} filas={filasTabla} exportCsv={`pas-condicion-fenologia-${grano}-${ciclo}-${campania.replace("/", "-")}`} nota="% del área en cada etapa fenológica, por semana de campaña." colapsable />
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
          <a href="/admin/datos/pas-condicion">/admin/datos</a> (un archivo por cultivo).
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
