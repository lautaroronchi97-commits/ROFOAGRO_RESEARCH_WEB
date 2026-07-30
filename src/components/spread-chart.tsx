"use client";

import * as React from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot,
  ResponsiveContainer, LabelList,
} from "recharts";
import { nfmt } from "@/lib/format";
import {
  etiquetaCalendario, mesDeFecha, mesEnRuedasAlVto,
  type BandaPunto, type Eje, type Metric, type PuntoXY,
} from "@/lib/derivadas";
import { exportarSvgComoPng } from "@/lib/chart-export";
import { ChartMarca } from "./chart-marca";
import { ChartTabla, type ChartTablaColumna, type ChartTablaFila } from "./chart-tabla";

/**
 * Chart multi-campaña del panel de spreads. Dos vistas:
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
  /** Si viene, muestra los botones de export PNG/CSV con este nombre de archivo. */
  exportName?: string;
  /** KPIs del caller (R7 punto 48): se renderizan ENTRE el chart y la tabla. */
  kpis?: React.ReactNode;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
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

  /** Label de campaña en el extremo (último punto real) de cada línea — R7 punto 48. */
  function labelExtremo(dataKey: string, color: string, texto: string) {
    let lastIdx = -1;
    rows.forEach((r, i) => { if (typeof r[dataKey] === "number") lastIdx = i; });
    function EtiquetaExtremo(props: { x?: string | number; y?: string | number; index?: number }) {
      const { x, y, index } = props;
      if (index !== lastIdx || x == null || y == null) return null;
      return (
        <text x={Number(x) + 6} y={Number(y)} dy={3} fontSize={10} fontFamily="var(--font-mono)" fontWeight={700} fill={color}>
          {texto}
        </text>
      );
    }
    return EtiquetaExtremo;
  }

  return (
    <>
      {exportName && (
        <div className="gx-chart-toolbar">
          <button
            type="button"
            className="gx-preset"
            onClick={() => exportarSvgComoPng(wrapRef.current, `${exportName}.png`)}
          >
            ↓ PNG
          </button>
        </div>
      )}
      {/* El wrapper relativo ancla la marca de agua al área del chart. */}
      <div style={{ position: "relative" }} ref={wrapRef}>
        <ChartMarca />
        <ResponsiveContainer width="100%" height={param(400)}>
          {/* right:40 (no 16) — deja lugar a la etiqueta de campaña en el extremo de cada
              línea (R7 punto 48); con 16 quedaba cortada contra el borde del SVG. */}
          <ComposedChart data={rows} margin={{ top: 8, right: 40, bottom: 30, left: 4 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" />
            <XAxis
              dataKey="x"
              type="number"
              domain={["dataMin", "dataMax"]}
              height={eje === "vto" ? 40 : 28}
              tick={<GxXTick eje={eje} anchorMes={anchorMes} mesEnX={mesEnX} />}
              stroke="var(--line-2)"
            />
            <YAxis
              tickFormatter={(v: number) => `${nfmt(v, axisDecimals)}${pct ? "%" : ""}`}
              tick={{ fill: "var(--ink-3)", fontSize: 11 }}
              stroke="var(--line-2)"
              width={52}
            />
            {metric !== "ratio" && <ReferenceLine y={0} stroke="var(--line-2)" />}
            <Tooltip
              content={<GxTooltip lines={drawn} eje={eje} anchorMes={anchorMes} fmtValor={fmtValor} usaBanda={usaBanda} mesEnX={mesEnX} />}
              isAnimationActive={false}
            />
            {usaBanda && (
              <Area
                dataKey="brange"
                stroke="none"
                fill="var(--ink-3)"
                fillOpacity={0.16}
                connectNulls
                isAnimationActive={false}
                activeDot={false}
                legendType="none"
              />
            )}
            {usaBanda && (
              <Line
                dataKey="bmed"
                name="Mediana histórica"
                stroke="var(--ink-2)"
                strokeWidth={1.3}
                strokeDasharray="5 4"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            {drawn.map((ln) => (
              <Line
                key={ln.key}
                type="monotone"
                dataKey={`y${ln.key}`}
                name={ln.label}
                stroke={ln.color}
                strokeWidth={ln.vigente ? 2.8 : 1.4}
                strokeDasharray={ln.dash ? "4 3" : undefined}
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls
                isAnimationActive={false}
              >
                <LabelList dataKey={`y${ln.key}`} content={labelExtremo(`y${ln.key}`, ln.color, ln.label)} />
              </Line>
            ))}
            {puntosParciales.map((p) => (
              <ReferenceDot
                key={`parcial-${p.key}`}
                x={p.x}
                y={p.y}
                r={5}
                fill="none"
                stroke={p.color}
                strokeWidth={1.6}
                strokeDasharray="2 2"
                ifOverflow="visible"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
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

function param(n: number): number {
  return n;
}

/* ---------------- tick del eje X (nº de ruedas + mes) ---------------- */

type TickProps = {
  x?: number;
  y?: number;
  payload?: { value: number };
  eje: Eje;
  anchorMes: number;
  mesEnX: (x: number) => string;
};

function GxXTick({ x = 0, y = 0, payload, eje, anchorMes, mesEnX }: TickProps) {
  const v = payload?.value ?? 0;
  if (eje === "cal") {
    return (
      <text x={x} y={y} dy={14} textAnchor="middle" fill="var(--ink-3)" fontSize={11}>
        {etiquetaCalendario(v, anchorMes)}
      </text>
    );
  }
  // Días al vto: nº de ruedas arriba, mes de referencia abajo.
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={13} textAnchor="middle" fill="var(--ink-3)" fontSize={11}>
        {-Math.round(v)}
      </text>
      <text x={0} y={0} dy={26} textAnchor="middle" fill="var(--ink-3)" fontSize={9.5} opacity={0.85}>
        {mesEnX(v)}
      </text>
    </g>
  );
}

/* ---------------- tooltip ---------------- */

type TipProps = {
  active?: boolean;
  lines: CampLine[];
  eje: Eje;
  anchorMes: number;
  fmtValor: (v: number) => string;
  usaBanda: boolean;
  mesEnX: (x: number) => string;
  payload?: Array<{ payload: Row }>;
};

function GxTooltip({ active, payload, lines, eje, anchorMes, fmtValor, usaBanda, mesEnX }: TipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]!.payload; // payload.length===0 ya salió arriba
  const x = Number(row.x);
  const head =
    eje === "vto"
      ? `${-Math.round(x)} ruedas al vto · ${mesEnX(x)}`
      : etiquetaCalendario(x, anchorMes);
  const items = lines
    .map((ln) => ({ ln, y: row[`y${ln.key}`], f: row[`f${ln.key}`] }))
    .filter((it) => typeof it.y === "number")
    .sort((a, b) => (b.y as number) - (a.y as number));
  const brange = row.brange as [number, number] | undefined;
  const bmed = row.bmed as number | undefined;
  if (items.length === 0 && !brange) return null;
  return (
    <div className="gx-tip">
      <div className="gx-tip-h">{head}</div>
      {items.map((it) => (
        <div className="gx-tip-row" key={it.ln.key}>
          <span className="sw" style={{ background: it.ln.color }} />
          <b>{it.ln.label}</b>
          <span>{fmtValor(it.y as number)}</span>
          {typeof it.f === "string" && <span style={{ color: "var(--ink-3)" }}>· {it.f}</span>}
        </div>
      ))}
      {usaBanda && brange && (
        <div className="gx-tip-row" style={{ color: "var(--ink-3)" }}>
          <span className="sw" style={{ background: "var(--ink-3)" }} />
          historia {fmtValor(brange[0])}–{fmtValor(brange[1])}
          {typeof bmed === "number" ? ` · med ${fmtValor(bmed)}` : ""}
        </div>
      )}
    </div>
  );
}
