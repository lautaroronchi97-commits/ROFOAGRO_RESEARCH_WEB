"use client";

import * as React from "react";
import { nfmt, sfmt } from "@/lib/format";
import { MESES_ES } from "@/lib/dates";
import { ZONA_CLAVES, ZONA_DISPLAY, type ZonaCamiones, type ProductoSerie } from "@/lib/camiones/config";
import {
  sumarZonas,
  seriesPorZona,
  agruparPorCampana,
  ultimasCampanas,
  campanasDisponibles,
  calcularKpis,
  type PuntoZP,
  type SerieNombrada,
  type SerieCampana,
} from "@/lib/camiones/matriz";
import { fechasDeCampana } from "@/lib/lineup/campanas";
import { useCrosshair, SvgLineChartBase } from "@/components/chart-svg-base";
import { ChartTabla, type ChartTablaColumna, type ChartTablaFila } from "@/components/chart-tabla";

/**
 * Gráfico único de Williams Entregas (relevamiento web R9, punto 53): reemplaza los 2 charts
 * separados de zona/producto por UNO — grano (llega ya elegido por el filtro de toda la página,
 * ver `camiones-client.tsx`) + zonas todas/elegidas, con un **modo campaña** que reagrupa la
 * serie 2018→hoy en líneas superpuestas por campaña ("evita la línea larga y pesada" del pedido).
 * El modo campaña necesita un producto real (mes de arranque de campaña) — con el filtro en
 * "Todos" se deshabilita y el chart se queda en modo calendario (zona × TOTAL, como hoy).
 */

const W = 660;
const H = 280;
const pad = { l: 48, r: 16, t: 16, b: 30 };
const iw = W - pad.l - pad.r;
const ih = H - pad.t - pad.b;

const FALLBACK_CAMP_COLORS = ["#2A78D6", "#D96A2A", "#0891B2", "#B45309", "#DB5A9B", "#9333EA", "#0F9E8C", "#7C4FD0"];

/** Mismo patrón que `graficos-client.tsx::useCampColors` (variables `--camp-{año}`, theme-aware),
 *  acá keyado por etiqueta de campaña ("2025/26") en vez de año de posición. */
function useCampanaColors(campanas: string[]): Record<string, string> {
  const key = campanas.join(",");
  const [colors, setColors] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      const m: Record<string, string> = {};
      campanas.forEach((c, i) => {
        const anio = parseInt(c.split("/")[0] ?? "", 10);
        const v = cs.getPropertyValue(`--camp-${anio}`).trim();
        m[c] = v || FALLBACK_CAMP_COLORS[i % FALLBACK_CAMP_COLORS.length] || "#888";
      });
      setColors(m);
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return colors;
}

function epoch(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}
function fmtDiaCorto(ms: number): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit" }).format(new Date(ms));
}
function fmtFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

function ZonaChips({ value, onChange }: { value: ZonaCamiones[]; onChange: (v: ZonaCamiones[]) => void }) {
  const todas = value.length === ZONA_CLAVES.length;
  return (
    <div className="fg-bar" role="toolbar" aria-label="Filtrar por zona">
      <button type="button" className="fg-chip" aria-pressed={todas} onClick={() => onChange([...ZONA_CLAVES])}>
        Todas
      </button>
      {ZONA_CLAVES.map((z) => {
        const on = value.includes(z);
        return (
          <button
            key={z}
            type="button"
            className="fg-chip"
            aria-pressed={on}
            onClick={() => {
              const next = on ? value.filter((v) => v !== z) : [...value, z];
              if (next.length > 0) onChange(next);
            }}
          >
            {ZONA_DISPLAY[z]}
          </button>
        );
      })}
    </div>
  );
}

function CampanaChips({
  disponibles,
  value,
  onChange,
  colors,
}: {
  disponibles: string[];
  value: string[];
  onChange: (v: string[]) => void;
  colors: Record<string, string>;
}) {
  return (
    <div className="gx-chips">
      <span className="gx-chips-lbl">Campañas</span>
      {disponibles.map((c) => {
        const on = value.includes(c);
        return (
          <button
            key={c}
            type="button"
            className="gx-chip"
            aria-pressed={on}
            style={{ ["--c" as string]: colors[c] ?? "#888" }}
            onClick={() => onChange(on ? value.filter((v) => v !== c) : [...value, c])}
          >
            <span className="sw" /> {c}
          </button>
        );
      })}
    </div>
  );
}

function fmtKpiDelta(v: number | null): string {
  return v == null ? "—" : sfmt(v, 0);
}
function clsDelta(v: number | null): string {
  if (v == null || v === 0) return "";
  return v > 0 ? "pos" : "neg";
}

export function WilliamsChart({
  puntos,
  puntosTotal,
  producto,
  productoDisplay,
  liderHoy,
  tablaAbierta,
  onToggleTabla,
}: {
  /** Matriz cruda zona×producto (excluye TOTAL) de toda la web. */
  puntos: PuntoZP[];
  /** Serie zona×TOTAL ya armada (equivalente a "todos los productos"), para el filtro "Todos". */
  puntosTotal: PuntoZP[];
  /** "TOTAL" (filtro de página en "Todos") o un producto real. */
  producto: ProductoSerie;
  productoDisplay: string;
  /** Producto líder nacional del último día (solo se muestra con el filtro en "Todos"). */
  liderHoy: { display: string; cantidad: number } | null;
  tablaAbierta: boolean;
  onToggleTabla: () => void;
}) {
  const esTotal = producto === "TOTAL";
  const fuente = esTotal ? puntosTotal : puntos;
  const [zonas, setZonas] = React.useState<ZonaCamiones[]>([...ZONA_CLAVES]);
  const [modo, setModo] = React.useState<"calendario" | "campana">("calendario");

  const sumada = React.useMemo(() => sumarZonas(fuente, producto, zonas), [fuente, producto, zonas]);
  // Universo de campañas disponibles: SIEMPRE sobre las 4 zonas (no las elegidas) — así
  // alternar zonas no le mueve el piso a las chips de campaña ya elegidas por el usuario.
  const campDisp = React.useMemo(
    () => (esTotal ? [] : campanasDisponibles(sumarZonas(fuente, producto, ZONA_CLAVES), producto)),
    [esTotal, fuente, producto],
  );
  const defaultCamp = React.useMemo(
    () => (esTotal ? [] : ultimasCampanas(producto, new Date(), 2).filter((c) => campDisp.includes(c))),
    [esTotal, producto, campDisp],
  );
  const [campSel, setCampSel] = React.useState<string[]>(defaultCamp);
  // Reinicia la selección de campañas cuando cambia el GRANO (nuevo calendario de campaña) —
  // ajuste de estado durante el render en vez de useEffect (patrón recomendado por React para
  // "adjusting state when a prop changes", evita el round-trip extra de un efecto).
  const [productoPrevio, setProductoPrevio] = React.useState(producto);
  if (producto !== productoPrevio) {
    setProductoPrevio(producto);
    setCampSel(defaultCamp);
  }

  // Mismo patrón: si el filtro de página vuelve a "Todos" estando en modo campaña, cae solo a
  // calendario (no hay calendario de campaña sin un grano real elegido).
  if (esTotal && modo === "campana") {
    setModo("calendario");
  }

  const colors = useCampanaColors(campDisp);
  const kpis = calcularKpis(sumada);

  return (
    <>
      <KpisWilliams kpis={kpis} liderHoy={esTotal ? liderHoy : null} />
      {modo === "campana" && !esTotal ? (
        <ChartCampana
          productoDisplay={productoDisplay}
          producto={producto}
          sumada={sumada}
          campDisp={campDisp}
          campSel={campSel}
          setCampSel={setCampSel}
          colors={colors}
          zonas={zonas}
          setZonas={setZonas}
          modo={modo}
          setModo={setModo}
          esTotal={esTotal}
          tablaAbierta={tablaAbierta}
          onToggleTabla={onToggleTabla}
        />
      ) : (
        <ChartCalendario
          productoDisplay={productoDisplay}
          seriesZona={seriesPorZona(fuente, producto, zonas, ZONA_DISPLAY)}
          zonas={zonas}
          setZonas={setZonas}
          modo={modo}
          setModo={setModo}
          esTotal={esTotal}
          tablaAbierta={tablaAbierta}
          onToggleTabla={onToggleTabla}
        />
      )}
    </>
  );
}

function ddmm(iso: string | null): string {
  if (!iso) return "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function KpisWilliams({
  kpis,
  liderHoy,
}: {
  kpis: ReturnType<typeof calcularKpis>;
  liderHoy: { display: string; cantidad: number } | null;
}) {
  return (
    <div className="lu-kpis">
      <div className="lu-kpi">
        <span className="lu-kpi-v">{kpis.total == null ? "—" : nfmt(kpis.total, 0)}</span>
        <span className="lu-kpi-l">camiones el {ddmm(kpis.fecha)}</span>
      </div>
      <div className="lu-kpi">
        <span className="lu-kpi-v">{kpis.totalAyer == null ? "—" : nfmt(kpis.totalAyer, 0)}</span>
        <span className="lu-kpi-l">camiones el {ddmm(kpis.fechaAyer)} (día anterior)</span>
      </div>
      <div className="lu-kpi">
        <span className={`lu-kpi-v ${clsDelta(kpis.deltaAyer)}`}>{fmtKpiDelta(kpis.deltaAyer)}</span>
        <span className="lu-kpi-l">vs día anterior</span>
      </div>
      <div className="lu-kpi">
        <span className={`lu-kpi-v ${clsDelta(kpis.deltaSemana)}`}>{fmtKpiDelta(kpis.deltaSemana)}</span>
        <span className="lu-kpi-l">vs semana pasada</span>
      </div>
      <div className="lu-kpi">
        <span className={`lu-kpi-v ${clsDelta(kpis.deltaInteranual?.valor ?? null)}`}>
          {kpis.deltaInteranual ? `${kpis.deltaInteranual.pct >= 0 ? "+" : ""}${nfmt(kpis.deltaInteranual.pct, 1)}%` : "—"}
        </span>
        <span className="lu-kpi-l">
          {kpis.deltaInteranual ? `vs mismo día de ${kpis.deltaInteranual.fecha.slice(0, 4)}` : "vs año pasado"}
        </span>
      </div>
      {liderHoy && (
        <div className="lu-kpi">
          <span className="lu-kpi-v">{liderHoy.display}</span>
          <span className="lu-kpi-l">producto líder ({nfmt(liderHoy.cantidad, 0)})</span>
        </div>
      )}
    </div>
  );
}

function ModoToggle({
  modo,
  setModo,
  esTotal,
}: {
  modo: "calendario" | "campana";
  setModo: (m: "calendario" | "campana") => void;
  esTotal: boolean;
}) {
  return (
    <div className="fg-bar" role="toolbar" aria-label="Modo del gráfico">
      <button type="button" className="fg-chip" aria-pressed={modo === "calendario"} onClick={() => setModo("calendario")}>
        Calendario
      </button>
      <button
        type="button"
        className="fg-chip"
        aria-pressed={modo === "campana"}
        disabled={esTotal}
        title={esTotal ? "Elegí un grano para superponer campañas" : undefined}
        onClick={() => setModo("campana")}
      >
        Por campaña
      </button>
    </div>
  );
}

function ChartCalendario({
  productoDisplay,
  seriesZona,
  zonas,
  setZonas,
  modo,
  setModo,
  esTotal,
  tablaAbierta,
  onToggleTabla,
}: {
  productoDisplay: string;
  seriesZona: SerieNombrada[];
  zonas: ZonaCamiones[];
  setZonas: (v: ZonaCamiones[]) => void;
  modo: "calendario" | "campana";
  setModo: (m: "calendario" | "campana") => void;
  esTotal: boolean;
  tablaAbierta: boolean;
  onToggleTabla: () => void;
}) {
  type Flat = { key: string; display: string; ms: number; valor: number; fecha: string };
  const flat: Flat[] = [];
  seriesZona.forEach((s) => s.puntos.forEach((p) => flat.push({ key: s.key, display: s.display, ms: epoch(p.fecha), valor: p.cantidad, fecha: p.fecha })));

  const xs = flat.map((f) => f.ms);
  const ys = flat.map((f) => f.valor);
  let xMin = flat.length ? Math.min(...xs) : 0;
  let xMax = flat.length ? Math.max(...xs) : 1;
  if (xMin === xMax) {
    xMin -= 15 * 86400000;
    xMax += 15 * 86400000;
  }
  const yMin = 0;
  let yMax = flat.length ? Math.max(...ys) : 1;
  yMax += (yMax - yMin) * 0.1 || 1;

  function X(ms: number) {
    return pad.l + ((ms - xMin) / (xMax - xMin)) * iw;
  }
  function Y(v: number) {
    return pad.t + (1 - (v - yMin) / (yMax - yMin)) * ih;
  }

  const { hi, onPointerMove, onPointerLeave } = useCrosshair(W, H, (px, py) => {
    if (flat.length === 0) return null;
    let best = 0;
    let bd = Infinity;
    flat.forEach((f, i) => {
      const d = (X(f.ms) - px) ** 2 + (Y(f.valor) - py) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  });

  if (flat.length === 0) {
    return (
      <div className="williams-chart">
        <div className="cam-toolbar">
          <ModoToggle modo={modo} setModo={setModo} esTotal={esTotal} />
          <ZonaChips value={zonas} onChange={setZonas} />
        </div>
        <div className="chart-wrap chart-empty">Sin datos para {productoDisplay.toLowerCase()} en las zonas elegidas.</div>
      </div>
    );
  }

  const yTicks = Array.from({ length: 5 }, (_, k) => yMin + ((yMax - yMin) * k) / 4);
  const xTicks = Array.from({ length: 5 }, (_, k) => xMin + ((xMax - xMin) * k) / 4);
  const hiFlat = hi !== null ? flat[hi] : undefined;

  const columnas: ChartTablaColumna[] = [
    { key: "fecha", label: "Fecha", align: "left" },
    ...seriesZona.map((s) => ({ key: s.key, label: `${s.display} (camiones)` })),
  ];
  const porFecha = new Map<string, ChartTablaFila>();
  for (const s of seriesZona) {
    for (const p of s.puntos) {
      let fila = porFecha.get(p.fecha);
      if (!fila) {
        fila = { fecha: fmtFecha(p.fecha) };
        porFecha.set(p.fecha, fila);
      }
      fila[s.key] = nfmt(p.cantidad, 0);
    }
  }
  const filas = [...porFecha.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, f]) => f);

  return (
    <div className="williams-chart">
      <div className="cam-toolbar">
        <ModoToggle modo={modo} setModo={setModo} esTotal={esTotal} />
        <ZonaChips value={zonas} onChange={setZonas} />
      </div>
      <SvgLineChartBase
        w={W}
        h={H}
        inner={{ x: pad.l, y: pad.t, width: iw, height: ih }}
        ariaLabel={`Camiones diarios por zona — ${productoDisplay}`}
        yTicks={yTicks.map((t) => ({ valor: t, y: Y(t), label: nfmt(t, 0) }))}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        after={
          <>
            {hiFlat && (
              <div className="cv-tip" style={{ left: `${(X(hiFlat.ms) / W) * 100}%`, top: `${(Y(hiFlat.valor) / H) * 100}%` }}>
                <span className="tt-x">{hiFlat.display}</span> · {nfmt(hiFlat.valor, 0)} camiones
                <span className="cv-tip-sub">{fmtFecha(hiFlat.fecha)}</span>
              </div>
            )}
            <div className="cv-legend">
              {seriesZona.map((s) => (
                <span className={`lk cam-${s.key}`} key={s.key}>
                  <span className="sw evo-sw" />
                  {s.display}
                  <span className="lk-val">{s.puntos.length ? nfmt(s.puntos[s.puntos.length - 1]!.cantidad, 0) : "—"}</span>
                </span>
              ))}
            </div>
          </>
        }
      >
        {xTicks.map((t, k) => (
          <text key={`x${k}`} className="cv-axis" x={X(t)} y={H - 9} textAnchor="middle">
            {fmtDiaCorto(t)}
          </text>
        ))}
        {seriesZona.map((s) => {
          const p = s.puntos;
          if (p.length === 0) return null;
          const d = p.map((pt, i) => `${i ? "L" : "M"}${X(epoch(pt.fecha)).toFixed(1)},${Y(pt.cantidad).toFixed(1)}`).join(" ");
          return (
            <g key={s.key} className={`evo-serie cam-${s.key}`}>
              <path d={d} className="evo-line" />
              <circle cx={X(epoch(p[p.length - 1]!.fecha))} cy={Y(p[p.length - 1]!.cantidad)} r={4} className="evo-end" />
            </g>
          );
        })}
        {hiFlat && (
          <g className={`cam-${hiFlat.key}`}>
            <line className="cv-cross" x1={X(hiFlat.ms)} y1={pad.t} x2={X(hiFlat.ms)} y2={pad.t + ih} />
            <circle className="evo-focus" cx={X(hiFlat.ms)} cy={Y(hiFlat.valor)} r={5} />
          </g>
        )}
      </SvgLineChartBase>
      <ChartTabla
        titulo="Datos del gráfico"
        columnas={columnas}
        filas={filas}
        nota="Una fila por día con dato; cantidad de CAMIONES (no toneladas)."
        maxFilas={60}
        orden="desc"
        colapsable
        abierta={tablaAbierta}
        onToggleAbierta={onToggleTabla}
      />
    </div>
  );
}

function ChartCampana({
  productoDisplay,
  producto,
  sumada,
  campDisp,
  campSel,
  setCampSel,
  colors,
  zonas,
  setZonas,
  modo,
  setModo,
  esTotal,
  tablaAbierta,
  onToggleTabla,
}: {
  productoDisplay: string;
  producto: string;
  sumada: { fecha: string; cantidad: number }[];
  campDisp: string[];
  campSel: string[];
  setCampSel: (v: string[]) => void;
  colors: Record<string, string>;
  zonas: ZonaCamiones[];
  setZonas: (v: ZonaCamiones[]) => void;
  modo: "calendario" | "campana";
  setModo: (m: "calendario" | "campana") => void;
  esTotal: boolean;
  tablaAbierta: boolean;
  onToggleTabla: () => void;
}) {
  const series: SerieCampana[] = agruparPorCampana(sumada, producto, campSel);

  type Flat = { campana: string; dia: number; valor: number; fecha: string };
  const flat: Flat[] = [];
  series.forEach((s) => s.puntos.forEach((p) => flat.push({ campana: s.campana, dia: p.dia, valor: p.cantidad, fecha: p.fecha })));

  const diaMax = flat.length ? Math.max(...flat.map((f) => f.dia)) : 1;
  const yMin = 0;
  let yMax = flat.length ? Math.max(...flat.map((f) => f.valor)) : 1;
  yMax += (yMax - yMin) * 0.1 || 1;

  function X(dia: number) {
    return pad.l + (dia / diaMax) * iw;
  }
  function Y(v: number) {
    return pad.t + (1 - (v - yMin) / (yMax - yMin)) * ih;
  }

  const { hi, onPointerMove, onPointerLeave } = useCrosshair(W, H, (px, py) => {
    if (flat.length === 0) return null;
    let best = 0;
    let bd = Infinity;
    flat.forEach((f, i) => {
      const d = (X(f.dia) - px) ** 2 + (Y(f.valor) - py) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  });

  const toolbar = (
    <div className="cam-toolbar">
      <ModoToggle modo={modo} setModo={setModo} esTotal={esTotal} />
      <ZonaChips value={zonas} onChange={setZonas} />
      <CampanaChips disponibles={campDisp} value={campSel} onChange={setCampSel} colors={colors} />
    </div>
  );

  if (flat.length === 0) {
    return (
      <div className="williams-chart">
        {toolbar}
        <div className="chart-wrap chart-empty">Elegí al menos una campaña para superponer.</div>
      </div>
    );
  }

  const yTicks = Array.from({ length: 5 }, (_, k) => yMin + ((yMax - yMin) * k) / 4);
  // Ticks de mes calculados sobre la primera campaña elegida (fechasDeCampana.inicio + k meses) —
  // los 12 arranques de mes caen en un día-de-campaña prácticamente idéntico año a año.
  const campRef = campSel[0] ?? campDisp[0];
  const xTicks: { dia: number; label: string }[] = [];
  if (campRef) {
    const { inicio } = fechasDeCampana(producto, campRef);
    for (let m = 0; m < 12; m++) {
      const d = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + m, 1));
      const dia = Math.round((d.getTime() - inicio.getTime()) / 86_400_000) + 1;
      if (dia <= diaMax + 5) xTicks.push({ dia, label: MESES_ES[d.getUTCMonth()] ?? "" });
    }
  }

  const hiFlat = hi !== null ? flat[hi] : undefined;

  const columnas: ChartTablaColumna[] = [
    { key: "dia", label: "Día de campaña", align: "left" },
    ...series.map((s) => ({ key: s.campana, label: `${s.campana} (camiones)` })),
  ];
  const porDia = new Map<number, ChartTablaFila>();
  for (const s of series) {
    for (const p of s.puntos) {
      let fila = porDia.get(p.dia);
      if (!fila) {
        fila = { dia: p.dia };
        porDia.set(p.dia, fila);
      }
      fila[s.campana] = nfmt(p.cantidad, 0);
    }
  }
  const filas = [...porDia.entries()].sort(([a], [b]) => b - a).map(([, f]) => f);

  return (
    <div className="williams-chart">
      {toolbar}
      <SvgLineChartBase
        w={W}
        h={H}
        inner={{ x: pad.l, y: pad.t, width: iw, height: ih }}
        ariaLabel={`Camiones por campaña, superpuestas — ${productoDisplay}`}
        yTicks={yTicks.map((t) => ({ valor: t, y: Y(t), label: nfmt(t, 0) }))}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        after={
          <>
            {hiFlat && (
              <div className="cv-tip" style={{ left: `${(X(hiFlat.dia) / W) * 100}%`, top: `${(Y(hiFlat.valor) / H) * 100}%` }}>
                <span className="tt-x">{hiFlat.campana}</span> · {nfmt(hiFlat.valor, 0)} camiones
                <span className="cv-tip-sub">{fmtFecha(hiFlat.fecha)}</span>
              </div>
            )}
            <div className="cv-legend">
              {series.map((s) => (
                <span className="lk" key={s.campana} style={{ ["--org-c" as string]: colors[s.campana] ?? "#888" }}>
                  <span className="sw evo-sw" />
                  {s.campana}
                  <span className="lk-val">{s.puntos.length ? nfmt(s.puntos[s.puntos.length - 1]!.cantidad, 0) : "—"}</span>
                </span>
              ))}
            </div>
          </>
        }
      >
        {xTicks.map((t, k) => (
          <text key={`x${k}`} className="cv-axis" x={X(t.dia)} y={H - 9} textAnchor="middle">
            {t.label}
          </text>
        ))}
        {series.map((s) => {
          const p = s.puntos;
          if (p.length === 0) return null;
          const d = p.map((pt, i) => `${i ? "L" : "M"}${X(pt.dia).toFixed(1)},${Y(pt.cantidad).toFixed(1)}`).join(" ");
          return (
            <g key={s.campana} style={{ ["--org-c" as string]: colors[s.campana] ?? "#888" }} className="evo-serie">
              <path d={d} className="evo-line" />
              <circle cx={X(p[p.length - 1]!.dia)} cy={Y(p[p.length - 1]!.cantidad)} r={4} className="evo-end" />
            </g>
          );
        })}
        {hiFlat && (
          <g style={{ ["--org-c" as string]: colors[hiFlat.campana] ?? "#888" }}>
            <line className="cv-cross" x1={X(hiFlat.dia)} y1={pad.t} x2={X(hiFlat.dia)} y2={pad.t + ih} />
            <circle className="evo-focus" cx={X(hiFlat.dia)} cy={Y(hiFlat.valor)} r={5} />
          </g>
        )}
      </SvgLineChartBase>
      <ChartTabla
        titulo="Datos del gráfico"
        columnas={columnas}
        filas={filas}
        nota="Día 1 = arranque de campaña para este producto; cantidad de CAMIONES (no toneladas)."
        maxFilas={90}
        colapsable
        abierta={tablaAbierta}
        onToggleAbierta={onToggleTabla}
      />
    </div>
  );
}

