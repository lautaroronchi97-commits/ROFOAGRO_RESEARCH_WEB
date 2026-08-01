"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { nfmt } from "@/lib/format";
import {
  etiquetaCalendario, mesDeFecha, mesEnRuedasAlVto,
  type BandaPunto, type Eje, type Metric, type PuntoXY,
} from "@/lib/derivadas";
import { RfChart } from "@/charts/RfChart";
import { paletteFor } from "@/charts/rofoTheme";
import { ChartTabla, type ChartTablaColumna, type ChartTablaFila } from "./chart-tabla";

/**
 * Chart multi-campaña del panel de spreads (el motor principal de `/graficos`). Dos vistas:
 *  - "lineas": una línea por campaña, superpuestas.
 *  - "banda": las campañas históricas colapsan en una sombra min–máx + mediana,
 *    y la campaña vigente va gruesa encima (P13). Mata el spaghetti.
 * En el eje días-al-vto se muestra, además del nº de ruedas, el MES calendario
 * de la campaña vigente (pedido de Lautaro: orientarse por mes, no solo ruedas).
 *
 * `ma` (P6, media móvil): líneas overlay adicionales, ya calculadas por el
 * caller — se dibujan siempre (no participan de la banda histórica ni del KPI).
 * `pct` (P6, "ratio/base en %"): formatea los valores como porcentaje.
 * `exportName` (P6, export PNG/CSV): si viene, agrega los botones de descarga.
 *
 * Colores: cada línea trae SU PROPIO color (`CampLine.color`), resuelto por el
 * caller desde `--camp-{año}` (paleta semántica de 8 campañas, `graficos-client.tsx`)
 * o una paleta de 12 colores por posición (`periodo-panel.tsx`) — ya viene como
 * literal (`getComputedStyle(...).getPropertyValue(...)`), nunca un color de
 * RfChart. Sin legend (regla no-negociable de la skill dataviz salvo excepción
 * documentada): con hasta 8+ líneas superpuestas una leyenda aparte sería un 2º
 * lugar al que mirar — el `endLabel` de ECharts pone el nombre de la campaña en
 * la punta de cada línea, que es como ya funcionaba con `LabelList` de Recharts.
 */

export type CampLine = {
  key: string;
  label: string;
  color: string;
  vigente: boolean;
  dash?: boolean;
  /** Último punto de la serie es HOY (Córdoba): dato del día, puede cambiar (guard "parcial"). */
  parcial?: boolean;
  data: PuntoXY[];
};

type Row = { x: number } & Record<string, number | string | [number, number]>;

function mergeRows(lines: CampLine[], banda: BandaPunto[]): Row[] {
  const byX = new Map<number, Row>();
  const get = (x: number): Row => {
    let r = byX.get(x);
    if (!r) { r = { x }; byX.set(x, r); }
    return r;
  };
  for (const ln of lines) {
    for (const p of ln.data) {
      const r = get(p.x);
      r[`y${ln.key}`] = p.y;
      r[`f${ln.key}`] = p.f;
    }
  }
  for (const b of banda) {
    const r = get(b.x);
    r.brange = [b.min, b.max];
    r.bmed = b.med;
  }
  return [...byX.values()].sort((a, b) => a.x - b.x);
}

/** Params de un ítem del tooltip axis-trigger — la forma pública de ECharts (`CallbackDataParams`)
 *  no expone `axisValue`/`data.f` de forma utilizable en su firma, mismo criterio que RfChart.tsx. */
type TipItem = { seriesName: string; color: string; value: unknown; data: unknown; axisValue: number | string };

export function SpreadChart({
  lines, eje, metric, anchorMes, decimals = 2, modo = "lineas", banda = [], refVto,
  ma, pct = false, exportName, kpis,
}: {
  lines: CampLine[];
  eje: Eje;
  metric: Metric;
  anchorMes: number;
  decimals?: number;
  modo?: "lineas" | "banda";
  banda?: BandaPunto[];
  refVto?: string; // vto de la campaña vigente, para rotular los meses del eje días-al-vto
  /** Líneas de media móvil (P6), ya calculadas por el caller — se dibujan siempre, sin pasar por la banda. */
  ma?: CampLine[];
  /** Formatea los valores como porcentaje (P6, "ratio/base en %"). */
  pct?: boolean;
  /** Si viene, muestra el botón de export CSV de la tabla con este nombre de archivo. */
  exportName?: string;
  /** KPIs del caller (R7 punto 48): se renderizan ENTRE el chart y la tabla. */
  kpis?: React.ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const p = paletteFor(resolvedTheme === "dark" ? "dark" : "light");
  // En modo banda solo se dibuja la vigente como línea (la historia es la sombra);
  // la media móvil se agrega siempre encima (overlay), no participa de la banda.
  const drawnBase = modo === "banda" ? lines.filter((l) => l.vigente) : lines;
  const drawn = React.useMemo(() => [...drawnBase, ...(ma ?? [])], [drawnBase, ma]);
  const usaBanda = modo === "banda" && banda.length > 0;
  const rows = React.useMemo(() => mergeRows(drawn, usaBanda ? banda : []), [drawn, usaBanda, banda]);
  const fmtValor = React.useCallback(
    (v: number) => (pct ? `${nfmt(v, decimals)}%` : nfmt(v, decimals)),
    [pct, decimals],
  );
  // Tabla siempre descendente (R6 punto 32 / R7 punto 48, patrón general del sitio) — y en el
  // eje días-al-vto, la fila de "hoy" (el último dato REAL de la campaña vigente, que en
  // general no llega hasta x=0 porque el vto todavía no pasó) va primera y recuadrada, en vez
  // de que x=0 (el vto de campañas YA vencidas) encabece la tabla. Se calcula ANTES del early
  // return de abajo (rules-of-hooks: los hooks no pueden quedar después de un return condicional).
  const vigenteKey = lines.find((l) => l.vigente)?.key ?? null;
  const hoyX = React.useMemo(() => {
    if (eje !== "vto" || !vigenteKey) return null;
    let m: number | null = null;
    for (const r of rows) {
      if (typeof r[`y${vigenteKey}`] === "number" && (m === null || r.x > m)) m = r.x;
    }
    return m;
  }, [eje, vigenteKey, rows]);
  const filasOrdenadas = React.useMemo(() => {
    const desc = [...rows].sort((a, b) => b.x - a.x);
    if (hoyX == null) return desc;
    const i = desc.findIndex((r) => r.x === hoyX);
    if (i <= 0) return desc;
    const [hoyRow] = desc.splice(i, 1);
    return hoyRow ? [hoyRow, ...desc] : desc;
  }, [rows, hoyX]);
  if (rows.length === 0) return null;

  // Mes en cada x del eje días-al-vto: proyectado desde el vencimiento de la
  // campaña vigente (x=0 = vto). Si no hay refVto, cae al mes del último dato.
  const ref = lines.find((l) => l.vigente) ?? lines[0];
  // ref.data.length chequeado en la misma condición → ref.data[0] existe.
  const ultFecha = ref && ref.data.length ? ref.data.reduce((m, p2) => (p2.x > m.x ? p2 : m), ref.data[0]!).f : null;
  const mesEnX = (x: number): string => {
    if (refVto) return mesEnRuedasAlVto(refVto, Math.max(0, Math.round(-x)));
    return ultFecha ? mesDeFecha(ultFecha) : "";
  };

  // Tabla de datos (doble lectura): EXACTAMENTE los mismos puntos que dibuja el
  // chart (`rows` = líneas + banda mergeadas por x), con el mismo formateo que
  // usa el tooltip (nfmt + decimals). Una fila por valor de x, en orden descendente.
  const columnas: ChartTablaColumna[] = [
    { key: "x", label: eje === "vto" ? "Ruedas al vto" : "Fecha", align: "left" },
    ...drawn.map((ln) => ({ key: `y${ln.key}`, label: ln.label })),
    ...(usaBanda
      ? [
          { key: "bmin", label: "Historia mín" },
          { key: "bmed", label: "Mediana histórica" },
          { key: "bmax", label: "Historia máx" },
        ]
      : []),
  ];
  const filas: ChartTablaFila[] = filasOrdenadas.map((r) => {
    const fila: ChartTablaFila = {};
    if (eje === "vto") {
      // Igual que el encabezado del tooltip: nº de ruedas + mes de referencia.
      fila.x = `${-Math.round(r.x)} · ${mesEnX(r.x)}`;
    } else {
      // Eje calendario: si todas las líneas comparten la fecha a esa altura
      // (modo Período / una sola campaña) se muestra la fecha real; con varias
      // campañas superpuestas se rotula el mes (como el eje).
      const fs = drawn
        .map((ln) => r[`f${ln.key}`])
        .filter((v): v is string => typeof v === "string");
      fila.x = fs.length > 0 && fs.every((f) => f === fs[0]) ? fs[0]! : etiquetaCalendario(r.x, anchorMes);
    }
    for (const ln of drawn) {
      const y = r[`y${ln.key}`];
      fila[`y${ln.key}`] = typeof y === "number" ? fmtValor(y) : null;
    }
    if (usaBanda) {
      const br = r.brange as [number, number] | undefined;
      fila.bmin = br ? fmtValor(br[0]) : null;
      fila.bmax = br ? fmtValor(br[1]) : null;
      fila.bmed = typeof r.bmed === "number" ? fmtValor(r.bmed) : null;
    }
    return fila;
  });
  const puntosParciales = drawnBase.filter((ln) => ln.parcial && ln.data.length > 0);
  const hayParcial = puntosParciales.length > 0;
  const notaTabla =
    (eje === "vto"
      ? "Los mismos puntos que dibuja el gráfico, por rueda hábil al vencimiento (con el mes de referencia de la campaña vigente). «—» = sin dato a esa altura. La fila recuadrada es HOY."
      : "Los mismos puntos que dibuja el gráfico, en eje calendario. Con varias campañas superpuestas la fila se rotula por mes. «—» = sin dato a esa altura.") +
    (hayParcial ? " El punto marcado con ⊚ es el dato de HOY: provisorio, puede cambiar." : "");

  const axisDecimals = pct ? 1 : metric === "ratio" ? 3 : 0;

  // ---- series ECharts ----
  // Cada línea es una serie independiente de puntos [x,y] — a diferencia de Recharts, ECharts
  // no exige que todas compartan un único array de filas por x; `rows`/`mergeRows` de arriba
  // sigue existiendo solo para la tabla, no para el chart.
  const seriesLineas = drawn.map((ln, i) => {
    const ordenados = [...ln.data].sort((a, b) => a.x - b.x);
    const ultimo = ln.parcial && ordenados.length ? ordenados.reduce((m, pt) => (pt.x > m.x ? pt : m), ordenados[0]!) : null;
    return {
      name: ln.label,
      type: "line" as const,
      symbol: "none" as const,
      data: ordenados.map((pt) => ({ value: [pt.x, pt.y] as [number, number], f: pt.f })),
      lineStyle: { color: ln.color, width: ln.vigente ? 2.8 : 1.4, type: ln.dash ? ("dashed" as const) : ("solid" as const) },
      itemStyle: { color: ln.color },
      endLabel: { show: true, formatter: () => ln.label, color: ln.color, fontWeight: 700, fontSize: 10 },
      // Modo Período puede superponer hasta 14 líneas — sin esto sus endLabel quedan
      // amontonados e ilegibles donde las curvas convergen (visto en la verificación real).
      labelLayout: { hideOverlap: true, moveOverlap: "shiftY" as const },
      // Círculo hueco en el último punto si ese dato es de HOY (guard "parcial": puede cambiar).
      markPoint: ultimo
        ? {
            symbol: "emptyCircle",
            symbolSize: 10,
            itemStyle: { color: "transparent", borderColor: ln.color, borderWidth: 1.6, borderType: "dashed" as const },
            label: { show: false },
            data: [{ name: "parcial", coord: [ultimo.x, ultimo.y] }],
          }
        : undefined,
      // Línea de referencia y=0 (no aplica a "ratio", cuyo valor neutro es 1) — colgada de la
      // primera serie dibujada, `rows.length>0` de arriba garantiza que `drawn` no está vacío.
      markLine:
        i === 0 && metric !== "ratio"
          ? { silent: true, symbol: "none" as const, lineStyle: { color: p.grid, width: 1 }, label: { show: false }, data: [{ yAxis: 0 }] }
          : undefined,
    };
  });
  const seriesBanda = usaBanda
    ? [
        // Los dos de acá abajo son el truco estándar de ECharts para una banda min–máx: una
        // serie ancla invisible en `min` + una serie apilada (`max−min`) con relleno visible —
        // el área queda exactamente entre las dos curvas reales. `tooltip:{show:false}` en las
        // 3 (más el filtro por nombre en `tooltipFormatter`) las saca del tooltip: ese lo arma
        // a mano el formatter de abajo con una sola fila "historia mín–máx · mediana".
        {
          name: "__band_min",
          type: "line" as const,
          stack: "band",
          symbol: "none" as const,
          lineStyle: { opacity: 0 },
          data: banda.map((b) => [b.x, b.min]),
          tooltip: { show: false },
        },
        {
          name: "__band_fill",
          type: "line" as const,
          stack: "band",
          symbol: "none" as const,
          lineStyle: { opacity: 0 },
          areaStyle: { color: p.ink3, opacity: 0.16 },
          data: banda.map((b) => [b.x, b.max - b.min]),
          tooltip: { show: false },
        },
        {
          name: "Mediana histórica",
          type: "line" as const,
          symbol: "none" as const,
          lineStyle: { color: p.ink2, width: 1.3, type: "dashed" as const },
          data: banda.map((b) => [b.x, b.med]),
          tooltip: { show: false },
        },
      ]
    : [];

  const tooltipFormatter = (paramsRaw: unknown): string => {
    const arr = (Array.isArray(paramsRaw) ? paramsRaw : [paramsRaw]) as TipItem[];
    if (arr.length === 0) return "";
    const axisValue = Number(arr[0]?.axisValue ?? NaN);
    const head =
      eje === "vto"
        ? `${-Math.round(axisValue)} ruedas al vto · ${mesEnX(axisValue)}`
        : etiquetaCalendario(axisValue, anchorMes);
    const filasTip = arr
      .filter((it) => it.seriesName && !it.seriesName.startsWith("__band") && it.seriesName !== "Mediana histórica")
      .map((it) => {
        const val = Array.isArray(it.value) ? it.value[1] : it.value;
        const f =
          it.data && typeof it.data === "object" && "f" in (it.data as object)
            ? (it.data as { f?: string }).f
            : undefined;
        return { ...it, num: Number(val), f };
      })
      .filter((it) => Number.isFinite(it.num))
      .sort((a, b) => b.num - a.num)
      .map(
        (it) =>
          `<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;padding:1.5px 0;">
            <span style="display:inline-flex;align-items:center;gap:6px">
              <span style="display:inline-block;width:12px;height:2.5px;border-radius:2px;background:${it.color}"></span>
              ${it.seriesName}${it.f ? ` · <span style="opacity:.7">${it.f}</span>` : ""}
            </span>
            <b style="margin-left:10px">${fmtValor(it.num)}</b>
          </div>`,
      )
      .join("");
    const b = usaBanda ? banda.find((bb) => bb.x === axisValue) : undefined;
    const bandaRow = b
      ? `<div style="padding-top:3px;margin-top:3px;border-top:1px solid ${p.grid};color:${p.ink3}">
          historia ${fmtValor(b.min)}–${fmtValor(b.max)} · med ${fmtValor(b.med)}
        </div>`
      : "";
    return `<div style="color:${p.gold};font-weight:700;margin-bottom:3px">${head}</div>${filasTip}${bandaRow}`;
  };

  return (
    <>
      <RfChart
        ariaLabel={`Spread por campaña — ${eje === "vto" ? "días al vencimiento" : "eje calendario"}`}
        exportName={exportName ?? "spread"}
        xTitle={eje === "vto" ? "Ruedas al vencimiento" : "Fecha"}
        yTitle={pct ? "Valor (%)" : "Valor (USD)"}
        height={400}
        valueFormatter={(v) => fmtValor(v)}
        option={{
          // Sin legend a propósito (ver docstring del componente): el endLabel de cada línea
          // ya identifica la campaña en la punta, una leyenda aparte sería redundante con
          // hasta 8+ campañas superpuestas.
          legend: { show: false },
          grid: { top: 16 },
          xAxis: {
            type: "value",
            axisLabel: {
              formatter: (v: number) => (eje === "vto" ? `${-Math.round(v)}\n${mesEnX(v)}` : etiquetaCalendario(v, anchorMes)),
            },
          },
          yAxis: {
            type: "value",
            axisLabel: { formatter: (v: number) => `${nfmt(v, axisDecimals)}${pct ? "%" : ""}` },
          },
          tooltip: { trigger: "axis", formatter: tooltipFormatter },
          series: [...seriesLineas, ...seriesBanda],
        }}
      />
      {kpis}
      <ChartTabla
        columnas={columnas}
        filas={filas}
        nota={notaTabla}
        exportCsv={exportName}
        destacada={hoyX != null ? (_, i) => i === 0 : undefined}
      />
    </>
  );
}
