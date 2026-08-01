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
 * Chart multi-campaña del panel de spreads (motor principal de /graficos, ECharts). Dos vistas:
 *  - "lineas": una línea por campaña, superpuestas.
 *  - "banda": las campañas históricas colapsan en una sombra min–máx + mediana (dos series `line`
 *    apiladas con `areaStyle`, técnica estándar de ECharts para bandas de rango — sin equivalente
 *    directo al `Area dataKey=[min,max]` de Recharts), y la campaña vigente va gruesa encima (P13).
 * En el eje días-al-vto se muestra, además del nº de ruedas, el MES calendario de la campaña
 * vigente vía `rich` text de dos líneas en el `axisLabel` (pedido de Lautaro: orientarse por mes).
 *
 * `ma` (P6, media móvil): líneas overlay adicionales, ya calculadas por el
 * caller — se dibujan siempre (no participan de la banda histórica ni del KPI).
 * `pct` (P6, "ratio/base en %"): formatea los valores como porcentaje.
 * `exportName` (P6, export PNG/CSV): nombre de archivo para el toolbox de RfChart + el CSV de la tabla.
 *
 * Todos los `series` se alinean a un único grid `xs` (unión ordenada de los x de todas las líneas +
 * banda, mismo criterio que `mergeRows`) con `null` explícito donde una línea no tiene dato a esa
 * altura — sin esto, en un eje numérico (`type:"value"`) cada serie snapea de forma independiente al
 * hover y el tooltip puede mostrar valores de alturas distintas por serie (nunca pasa acá: todas
 * comparten exactamente los mismos x posibles).
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

// Prefijo invisible para las series helper (banda min/rango) que dibujan el área pero no deben
// aparecer en la leyenda ni en el tooltip — se filtran por este marcador en vez de por índice,
// más robusto si el orden del array de series cambia.
const OCULTA = "​";

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
  /** Nombre de archivo (sin extensión) para el toolbox "Guardar imagen" + el CSV de la tabla. */
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
  // Marcadores "parcial" (guard, P6): último punto de las líneas cuyo dato final
  // es de HOY — puede seguir cambiando (rueda sin cerrar / pizarra sin la última
  // actualización del día). Círculo hueco en el punto + nota al pie.
  const puntosParciales = React.useMemo(
    () =>
      drawnBase
        .filter((ln) => ln.parcial && ln.data.length > 0)
        .map((ln) => {
          // filter() de arriba ya exige ln.data.length>0 → ln.data[0] existe.
          const ult = ln.data.reduce((m, p) => (p.x > m.x ? p : m), ln.data[0]!);
          return { key: ln.key, color: ln.color, x: ult.x, y: ult.y };
        }),
    [drawnBase],
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
  const ultFecha = ref && ref.data.length ? ref.data.reduce((m, p) => (p.x > m.x ? p : m), ref.data[0]!).f : null;
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
  const hayParcial = puntosParciales.length > 0;
  const notaTabla =
    (eje === "vto"
      ? "Los mismos puntos que dibuja el gráfico, por rueda hábil al vencimiento (con el mes de referencia de la campaña vigente). «—» = sin dato a esa altura. La fila recuadrada es HOY."
      : "Los mismos puntos que dibuja el gráfico, en eje calendario. Con varias campañas superpuestas la fila se rotula por mes. «—» = sin dato a esa altura.") +
    (hayParcial ? " El punto marcado con ⊚ es el dato de HOY: provisorio, puede cambiar." : "");

  const axisDecimals = pct ? 1 : metric === "ratio" ? 3 : 0;

  // Grid único de x (unión ordenada de todos los puntos, incl. banda): cada serie ECharts se
  // alinea a este mismo grid con `null` donde no tiene dato — así el tooltip (trigger:"axis")
  // muestra siempre la MISMA altura x para todas las series, igual que las `rows` de Recharts.
  const xs = rows.map((r) => r.x);
  const rowByX = new Map(rows.map((r) => [r.x, r]));

  const lineSeries = drawn.map((ln) => ({
    name: ln.label,
    type: "line" as const,
    symbol: "none" as const,
    connectNulls: true,
    z: 3,
    lineStyle: {
      color: ln.color,
      width: ln.vigente ? 2.8 : 1.4,
      type: (ln.dash ? [4, 3] : "solid") as "solid" | number[],
    },
    itemStyle: { color: ln.color },
    data: xs.map((x) => {
      const r = rowByX.get(x);
      const y = r?.[`y${ln.key}`];
      const f = r?.[`f${ln.key}`];
      return typeof y === "number" ? [x, y, typeof f === "string" ? f : ""] : null;
    }),
  }));
  if (metric !== "ratio" && lineSeries[0]) {
    (lineSeries[0] as { markLine?: unknown }).markLine = {
      symbol: ["none", "none"],
      label: { show: false },
      lineStyle: { color: p.gridStrong, type: "solid", width: 1 },
      data: [{ yAxis: 0 }],
    };
  }

  const bandSeries = usaBanda
    ? [
        {
          name: `${OCULTA}bandaMin`,
          type: "line" as const,
          stack: "banda",
          symbol: "none" as const,
          lineStyle: { opacity: 0 },
          areaStyle: { opacity: 0 },
          connectNulls: true,
          silent: true,
          tooltip: { show: false },
          z: 1,
          data: xs.map((x) => {
            const br = rowByX.get(x)?.brange as [number, number] | undefined;
            return br ? [x, br[0]] : null;
          }),
        },
        {
          name: `${OCULTA}bandaRango`,
          type: "line" as const,
          stack: "banda",
          symbol: "none" as const,
          lineStyle: { opacity: 0 },
          areaStyle: { color: p.ink3, opacity: 0.16 },
          connectNulls: true,
          silent: true,
          tooltip: { show: false },
          z: 1,
          data: xs.map((x) => {
            const br = rowByX.get(x)?.brange as [number, number] | undefined;
            return br ? [x, br[1] - br[0]] : null;
          }),
        },
        {
          name: "Mediana histórica",
          type: "line" as const,
          symbol: "none" as const,
          connectNulls: true,
          z: 2,
          lineStyle: { color: p.ink2, width: 1.3, type: [5, 4] },
          data: xs.map((x) => {
            const m = rowByX.get(x)?.bmed;
            return typeof m === "number" ? [x, m] : null;
          }),
        },
      ]
    : [];

  const parcialSeries = puntosParciales.length
    ? [
        {
          name: `${OCULTA}parcial`,
          type: "scatter" as const,
          symbol: "emptyCircle" as const,
          symbolSize: 10,
          silent: true,
          tooltip: { show: false },
          z: 6,
          data: puntosParciales.map((pp) => ({
            value: [pp.x, pp.y],
            itemStyle: { color: "transparent", borderColor: pp.color, borderWidth: 1.6, borderType: [2, 2] },
          })),
        },
      ]
    : [];

  const yTitle = pct ? "%" : metric === "ratio" ? "Ratio" : "Spread";

  return (
    <>
      <RfChart
        ariaLabel={`Spread por campaña — ${eje === "vto" ? "días al vencimiento" : "eje calendario"}`}
        exportName={exportName}
        height={400}
        xTitle={eje === "vto" ? "Ruedas al vto" : "Fecha"}
        yTitle={yTitle}
        valueFormatter={(v) => fmtValor(v)}
        option={{
          legend: {
            data: [...drawn.map((ln) => ln.label), ...(usaBanda ? ["Mediana histórica"] : [])],
          },
          xAxis: {
            type: "value",
            min: "dataMin",
            max: "dataMax",
            axisLabel:
              eje === "vto"
                ? {
                    formatter: (v: number) => `{ruedas|${-Math.round(v)}}\n{mes|${mesEnX(v)}}`,
                    rich: { ruedas: { fontSize: 11 }, mes: { fontSize: 9.5, opacity: 0.85 } },
                  }
                : { formatter: (v: number) => etiquetaCalendario(v, anchorMes) },
          },
          yAxis: {
            type: "value",
            axisLabel: { formatter: (v: number) => `${nfmt(v, axisDecimals)}${pct ? "%" : ""}` },
          },
          tooltip: {
            axisPointer: { snap: true },
            formatter: (params: unknown) => {
              const arr = (Array.isArray(params) ? params : [params]) as Array<{
                seriesName: string;
                color: string;
                value: unknown;
                axisValue?: number;
              }>;
              if (arr.length === 0) return "";
              const first = arr[0];
              const xRaw =
                typeof first?.axisValue === "number"
                  ? first.axisValue
                  : Array.isArray(first?.value)
                    ? Number((first.value as unknown[])[0])
                    : NaN;
              if (!Number.isFinite(xRaw)) return "";
              const head =
                eje === "vto" ? `${-Math.round(xRaw)} ruedas al vto · ${mesEnX(xRaw)}` : etiquetaCalendario(xRaw, anchorMes);
              const items = arr
                .filter((p2) => !p2.seriesName.startsWith(OCULTA))
                .map((p2) => {
                  const v = p2.value;
                  const y = Array.isArray(v) ? Number((v as unknown[])[1]) : NaN;
                  const f = Array.isArray(v) && typeof (v as unknown[])[2] === "string" ? ((v as unknown[])[2] as string) : "";
                  return { ...p2, y, f };
                })
                .filter((p2) => Number.isFinite(p2.y))
                .sort((a, b) => b.y - a.y);
              const filasHtml = items
                .map(
                  (it) =>
                    `<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;padding:1.5px 0;">
                      <span style="display:inline-flex;align-items:center;gap:6px">
                        <span style="display:inline-block;width:12px;height:2.5px;border-radius:2px;background:${it.color}"></span>
                        ${it.seriesName}
                      </span>
                      <b style="margin-left:10px">${fmtValor(it.y)}${it.f ? ` <span style="font-weight:400;color:${p.ink3}">· ${it.f}</span>` : ""}</b>
                    </div>`,
                )
                .join("");
              const rowX = rowByX.get(Math.round(xRaw));
              const brange = rowX?.brange as [number, number] | undefined;
              const bandaHtml =
                usaBanda && brange
                  ? `<div style="display:flex;align-items:center;gap:6px;color:${p.ink3};padding-top:2px">
                      <span style="display:inline-block;width:12px;height:2.5px;border-radius:2px;background:${p.ink3}"></span>
                      historia ${fmtValor(brange[0])}–${fmtValor(brange[1])}${typeof rowX?.bmed === "number" ? ` · med ${fmtValor(rowX.bmed)}` : ""}
                    </div>`
                  : "";
              if (items.length === 0 && !bandaHtml) return "";
              return `<div style="color:${p.gold};font-weight:700;margin-bottom:3px">${head}</div>${filasHtml}${bandaHtml}`;
            },
          },
          series: [...bandSeries, ...lineSeries, ...parcialSeries],
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
