"use client";

import * as React from "react";
import { fuenteDeId, type SerieCat, type SeriePuntos, type Fuente } from "@/lib/series-types";
import {
  joinFfill, metricaDiaria, mediaMovil, alinear, mesDePosicion, mediana, percentil, zipSerie,
  type Metric, type Eje, type BandaPunto, type PuntoXY,
} from "@/lib/derivadas";
import { mesIndice, hoyCordobaISO } from "@/lib/dates";
import { nfmt } from "@/lib/format";
import { nombreArchivo } from "@/lib/chart-export";
import { SpreadChart, type CampLine } from "./spread-chart";
import { PeriodoPanel } from "./periodo-panel";
import { VolumenPanel, type VolPunto } from "./volumen-panel";

/**
 * Panel de gráficos de spreads entre cosechas (/graficos). Motor genérico:
 * pata A vs pata B (cualquier serie del catálogo) × métrica × campañas
 * superpuestas. Decisiones de Lautaro (11/07) cableadas: eje días-al-vto por
 * índice de rueda (P1), spread lejana−cercana / empate caro−barato (P7),
 * ventana 12m (P3). Todo el estado va a la URL (compartible por WhatsApp).
 */

const GRANO_NOMBRE: Record<string, string> = {
  soja: "Soja", maiz: "Maíz", trigo: "Trigo", girasol: "Girasol", sorgo: "Sorgo",
};
const FUENTE_NOMBRE: Record<Fuente, string> = { a3: "A3", cbot: "Chicago", pizarra: "Pizarra" };
const FALLBACK_COLORS = ["#2A78D6","#D96A2A","#0891B2","#B45309","#DB5A9B","#9333EA","#0F9E8C","#7C4FD0"];
/** Color de paleta por índice, con módulo — siempre en rango (arreglo no vacío) así que el `??`
 *  final nunca se ejercita en la práctica; evita el `!` en los 3 call-sites de abajo. */
function fallbackColor(i: number): string {
  return FALLBACK_COLORS[i % FALLBACK_COLORS.length] ?? "#2A78D6";
}

type Pata = { fuente: Fuente; grano: string; mon: string | null }; // mon null = pizarra
type PataResuelta = { serieId: string; vto: string | null };

/* ---------------- índice del catálogo ---------------- */

type Idx = {
  granosPorFuente: Record<Fuente, string[]>;
  monsPorGF: Map<string, string[]>; // `${fuente}:${grano}` → meses (["ABR","JUL",…])
  resolver: (p: Pata, year: number) => PataResuelta | null;
  aniosPizarra: (grano: string) => number[];
};

function construirIdx(cat: SerieCat[]): Idx {
  const granosPorFuente: Record<Fuente, Set<string>> = { a3: new Set(), cbot: new Set(), pizarra: new Set() };
  const monsPorGF = new Map<string, Set<string>>();
  // clave de resolución exacta: `${fuente}:${grano}:${mon}:${year}` → SerieCat
  const exact = new Map<string, SerieCat>();
  const pizYears = new Map<string, Set<number>>();

  for (const c of cat) {
    granosPorFuente[c.fuente].add(c.grano);
    if (c.fuente === "pizarra") {
      const y0 = Number(c.desde.slice(0, 4));
      const y1 = Number(c.hasta.slice(0, 4));
      const set = pizYears.get(c.grano) ?? new Set<number>();
      for (let y = y0; y <= y1; y++) set.add(y);
      pizYears.set(c.grano, set);
      continue;
    }
    if (!c.posicion) continue;
    const mon = c.posicion.slice(0, 3);
    const yy = Number(c.posicion.slice(3));
    const year = 2000 + yy;
    const gk = `${c.fuente}:${c.grano}`;
    const ms = monsPorGF.get(gk) ?? new Set<string>();
    ms.add(mon);
    monsPorGF.set(gk, ms);
    exact.set(`${c.fuente}:${c.grano}:${mon}:${year}`, c);
  }

  const ordMes = (a: string, b: string) => mesIndice(a) - mesIndice(b);
  const monsSorted = new Map<string, string[]>();
  for (const [k, v] of monsPorGF) monsSorted.set(k, [...v].sort(ordMes));

  return {
    granosPorFuente: {
      a3: [...granosPorFuente.a3].sort(),
      cbot: [...granosPorFuente.cbot].sort(),
      pizarra: [...granosPorFuente.pizarra].sort(),
    },
    monsPorGF: monsSorted,
    resolver: (p, year) => {
      if (p.fuente === "pizarra") return { serieId: `pizarra:${p.grano}`, vto: null };
      if (!p.mon) return null;
      const c = exact.get(`${p.fuente}:${p.grano}:${p.mon}:${year}`);
      return c ? { serieId: c.serieId, vto: c.vencimiento } : null;
    },
    aniosPizarra: (grano) => [...(pizYears.get(grano) ?? new Set<number>())].sort(),
  };
}

/* ---------------- estado en la URL ---------------- */

function pataToStr(p: Pata): string {
  return `${p.fuente}:${p.grano}:${p.mon ?? ""}`;
}
function pataFromStr(s: string | null): Pata | null {
  if (!s) return null;
  const [fuente, grano, mon] = s.split(":");
  if (!fuente || !grano) return null;
  if (fuente !== "a3" && fuente !== "cbot" && fuente !== "pizarra") return null;
  return { fuente, grano, mon: mon || null };
}

type Vista = "lineas" | "banda";
type ModoComp = "campanias" | "periodo";
type Estado = {
  a: Pata; b: Pata | null; metric: Metric; eje: Eje; ventanaMeses: number; years: number[]; vista: Vista;
};

function leerURL(): Partial<Estado> {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const a = pataFromStr(q.get("a"));
  const b = pataFromStr(q.get("b"));
  const metric = (["spread", "ratio", "crudo"] as const).find((m) => m === q.get("m"));
  const eje = (["vto", "cal"] as const).find((e) => e === q.get("eje"));
  const vista = (["lineas", "banda"] as const).find((s) => s === q.get("vista"));
  const v = Number(q.get("v"));
  const years = (q.get("c") ?? "").split(",").map(Number).filter((n) => n >= 2020 && n <= 2100);
  const out: Partial<Estado> = {};
  if (a) out.a = a;
  if (b) out.b = b;
  if (metric) out.metric = metric;
  if (eje) out.eje = eje;
  if (vista) out.vista = vista;
  if (Number.isFinite(v) && v > 0) out.ventanaMeses = v;
  if (years.length) out.years = years;
  return out;
}

/** Modo de comparación (Campañas | Período) leído/escrito en la URL (P6: persistir Período). */
function leerModo(): ModoComp {
  if (typeof window === "undefined") return "campanias";
  const q = new URLSearchParams(window.location.search);
  return q.get("mc") === "periodo" ? "periodo" : "campanias";
}

function escribirModo(modo: ModoComp) {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  q.set("mc", modo);
  window.history.replaceState(null, "", `?${q.toString()}`);
}

// Los dos escribirURL (Campañas acá, Período en periodo-panel.tsx) SOLO tocan
// sus propias claves — leen la querystring actual y la reescriben mergeada,
// para no pisarse entre sí ni pisar el modo (`mc`, que vive en este archivo).
function escribirURL(e: Estado) {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  q.set("a", pataToStr(e.a));
  if (e.b) q.set("b", pataToStr(e.b)); else q.delete("b");
  q.set("m", e.metric);
  q.set("eje", e.eje);
  q.set("vista", e.vista);
  q.set("v", String(e.ventanaMeses));
  q.set("c", e.years.join(","));
  window.history.replaceState(null, "", `?${q.toString()}`);
}

/* ---------------- presets ---------------- */

const a3Pata = (grano: string, mon: string): Pata => ({ fuente: "a3", grano, mon });
const cbotPata = (grano: string, mon: string): Pata => ({ fuente: "cbot", grano, mon });

// Presets de calendar spreads por grano (lista de Lautaro, 11/07). Avanzan
// cronológicamente en base al carry; cuando el 2º mes es menor al 1º, la pata B
// es de la campaña SIGUIENTE (lo maneja `offsetB`).
const GRUPOS_PRESET: { grano: string; label: string; pares: [string, string][] }[] = [
  { grano: "soja", label: "Soja", pares: [["MAY", "JUL"], ["MAY", "NOV"], ["JUL", "NOV"], ["NOV", "ENE"], ["NOV", "MAY"]] },
  { grano: "maiz", label: "Maíz", pares: [["ABR", "JUL"], ["JUL", "SEP"], ["JUL", "DIC"], ["DIC", "ABR"], ["DIC", "JUL"]] },
  { grano: "trigo", label: "Trigo", pares: [["DIC", "ENE"], ["DIC", "MAR"], ["ENE", "MAR"], ["MAR", "JUL"], ["JUL", "DIC"]] },
];

// Presets con patas libres: entre productos y A3 vs Chicago. El mapeo CBOT de
// cada posición local sale del análisis empírico de correlación (confirmado por
// Lautaro): la posición homónima no siempre es la más representativa (ej. soja
// NOV local ↔ CBOT JUL, maíz DIC ↔ CBOT SEP). Ver docs/sesiones.
const PARES_LIBRES: { grupo: string; label: string; a: Pata; b: Pata }[] = [
  { grupo: "Entre productos", label: "Maíz ABR / Soja MAY", a: a3Pata("maiz", "ABR"), b: a3Pata("soja", "MAY") },
  { grupo: "Entre productos", label: "Maíz JUL / Soja JUL", a: a3Pata("maiz", "JUL"), b: a3Pata("soja", "JUL") },
  { grupo: "Chicago", label: "Soja MAY", a: a3Pata("soja", "MAY"), b: cbotPata("soja", "MAY") },
  { grupo: "Chicago", label: "Soja JUL", a: a3Pata("soja", "JUL"), b: cbotPata("soja", "JUL") },
  { grupo: "Chicago", label: "Soja NOV", a: a3Pata("soja", "NOV"), b: cbotPata("soja", "JUL") },
  { grupo: "Chicago", label: "Maíz ABR", a: a3Pata("maiz", "ABR"), b: cbotPata("maiz", "MAY") },
  { grupo: "Chicago", label: "Maíz JUL", a: a3Pata("maiz", "JUL"), b: cbotPata("maiz", "MAY") },
  { grupo: "Chicago", label: "Maíz SEP", a: a3Pata("maiz", "SEP"), b: cbotPata("maiz", "DIC") },
  { grupo: "Chicago", label: "Maíz DIC", a: a3Pata("maiz", "DIC"), b: cbotPata("maiz", "SEP") },
];

const DEFAULT_A = a3Pata("maiz", "ABR");
const DEFAULT_B = a3Pata("maiz", "JUL");

/**
 * Offset de año de la pata B respecto de la campaña (anclada en la pata A):
 * +1 si el mes de B es menor al de A (el calendar spread cruza al año siguiente,
 * ej. soja NOV/MAY = Nov de una campaña vs May de la que sigue).
 * SOLO aplica a spreads del MISMO producto y mercado (calendar spread puro).
 * Entre productos (maíz vs soja) o entre mercados (A3 vs CBOT) van a la misma
 * campaña (offset 0): ahí el apareo es por año del contrato.
 */
function offsetB(a: Pata, b: Pata | null): number {
  if (!b || !a.mon || !b.mon) return 0;
  if (a.fuente !== b.fuente || a.grano !== b.grano) return 0;
  const ma = mesDePosicion(`${a.mon}00`);
  const mb = mesDePosicion(`${b.mon}00`);
  return ma > 0 && mb > 0 && mb < ma ? 1 : 0;
}

/* ---------------- colores según tema ---------------- */

function useCampColors(years: number[]): Record<number, string> {
  const key = years.join(",");
  const [colors, setColors] = React.useState<Record<number, string>>({});
  React.useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      const m: Record<number, string> = {};
      years.forEach((y, i) => {
        const v = cs.getPropertyValue(`--camp-${y}`).trim();
        m[y] = v || fallbackColor(i);
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

/* ---------------- componente ---------------- */

export function GraficosClient({ catalogo }: { catalogo: SerieCat[] }) {
  const idx = React.useMemo(() => construirIdx(catalogo), [catalogo]);
  const [mounted, setMounted] = React.useState(false);

  const inicial = React.useMemo(() => {
    const url = leerURL();
    return {
      a: url.a ?? DEFAULT_A,
      b: url.b !== undefined ? url.b : DEFAULT_B,
      metric: url.metric ?? "spread",
      eje: url.eje ?? "vto",
      vista: url.vista ?? "lineas",
      ventanaMeses: url.ventanaMeses ?? 12,
      years: url.years ?? [],
    } as Estado;
  }, []);

  const [a, setA] = React.useState<Pata>(inicial.a);
  const [b, setB] = React.useState<Pata | null>(inicial.b);
  const [metric, setMetric] = React.useState<Metric>(inicial.metric);
  const [eje, setEje] = React.useState<Eje>(inicial.eje);
  const [vista, setVista] = React.useState<Vista>(inicial.vista);
  const [ventanaMeses, setVentanaMeses] = React.useState<number>(inicial.ventanaMeses);
  const [years, setYears] = React.useState<number[]>(inicial.years);

  const [series, setSeries] = React.useState<Record<string, SeriePuntos>>({});
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [modoComp, setModoCompState] = React.useState<ModoComp>("campanias");

  // P6: métrica en % (ratio×100 / base "pizarra÷futuro−1"), media móvil (ventana
  // elegible, default 5 ruedas — P15) y subpanel de volumen/OI (solo si la pata A
  // tiene contrato operado, no pizarra). Ninguno de los tres se persiste en la URL.
  const [pct, setPct] = React.useState(false);
  const [verMA, setVerMA] = React.useState(false);
  const [ventanaMA, setVentanaMA] = React.useState(5);
  const [verVolumen, setVerVolumen] = React.useState(false);

  const setModoComp = React.useCallback((m: ModoComp) => {
    setModoCompState(m);
    escribirModo(m);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => { setMounted(true); setModoCompState(leerModo()); }, []);

  // Años disponibles = donde resuelven AMBAS patas (B con su offset de campaña).
  const aniosDisponibles = React.useMemo(() => {
    const off = offsetB(a, b);
    const cand = new Set<number>();
    for (let y = 2020; y <= 2030; y++) {
      const ra = idx.resolver(a, y);
      if (!ra) continue;
      if (b) { if (!idx.resolver(b, y + off)) continue; }
      cand.add(y);
    }
    // pizarra sola (sin pata B): años calendario disponibles de la serie continua.
    if (a.fuente === "pizarra" && !b) idx.aniosPizarra(a.grano).forEach((y) => cand.add(y));
    return [...cand].sort();
  }, [idx, a, b]);

  // Selección efectiva: lo elegido (filtrado a lo disponible) o, si está vacío, SOLO LA ÚLTIMA
  // campaña disponible (relevamiento web R7, punto 48 — antes caía a TODAS). Esto cubre a la vez
  // la visita nueva (sin `?c=` en la URL, `years` arranca en `[]`) y el caso de declickear todos
  // los chips a mano. Un link viejo compartido con `?c=2020,2021,…` sigue funcionando igual
  // (esos años entran en `years` desde `leerURL` y `valid` no queda vacío) — la única excepción
  // teórica es un `?c=` manualmente vaciado a mano, que nunca sale de `escribirURL` en la
  // práctica (siempre persiste la lista real, nunca vacía).
  const effectiveYears = React.useMemo(() => {
    const valid = years.filter((y) => aniosDisponibles.includes(y));
    if (valid.length) return valid;
    const ultima = aniosDisponibles[aniosDisponibles.length - 1];
    return ultima != null ? [ultima] : [];
  }, [years, aniosDisponibles]);

  // La banda solo aplica a métricas de valor único (spread/ratio), no a crudas.
  const modo: Vista = vista === "banda" && metric !== "crudo" ? "banda" : "lineas";

  // Sincronizar estado → URL (external sync, sin setState).
  React.useEffect(() => {
    escribirURL({ a, b, metric, eje, ventanaMeses, years: effectiveYears, vista });
  }, [a, b, metric, eje, ventanaMeses, effectiveYears, vista]);

  // Resolver campañas seleccionadas → serieIds + rango, y traer /api/series.
  React.useEffect(() => {
    if (modoComp === "periodo") return; // en modo Período no se traen campañas
    const ventanaDias = Math.round(ventanaMeses * 30.4375);
    const off = offsetB(a, b);
    const campanias = effectiveYears
      .map((year) => {
        const ra = idx.resolver(a, year);
        const rb = b ? idx.resolver(b, year + off) : null;
        if (!ra || (b && !rb)) return null;
        const vtos = [ra.vto, rb?.vto].filter((v): v is string => !!v);
        const vto = vtos.length ? vtos.reduce((m, v) => (v < m ? v : m)) : `${year}-12-31`;
        return { year, ra, rb, vto, ventanaDias };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (campanias.length === 0) { setSeries({}); return; }

    const ids = new Set<string>();
    let from = "2100-01-01";
    let to = "2000-01-01";
    for (const c of campanias) {
      ids.add(c.ra.serieId);
      if (c.rb) ids.add(c.rb.serieId);
      const desde = isoMenosDias(c.vto, c.ventanaDias);
      if (desde < from) from = desde;
      if (c.vto > to) to = c.vto;
    }

    let cancel = false;
    setCargando(true);
    setError(null);
    const url = `/api/series?ids=${encodeURIComponent([...ids].join(","))}&from=${from}&to=${to}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { series: SeriePuntos[] }) => {
        if (cancel) return;
        const map: Record<string, SeriePuntos> = {};
        for (const s of j.series ?? []) map[s.id] = s;
        setSeries(map);
      })
      .catch((e: unknown) => { if (!cancel) setError(e instanceof Error ? e.message : "error"); })
      .finally(() => { if (!cancel) setCargando(false); });
    return () => { cancel = true; };
  }, [idx, a, b, effectiveYears, ventanaMeses, modoComp]);

  const colors = useCampColors(aniosDisponibles);
  const vigenteYear = effectiveYears.length ? Math.max(...effectiveYears) : null;

  // % solo tiene sentido para spread/ratio (no para crudas, que son 2 series
  // separadas); media móvil ídem (deriva de la métrica ya calculada).
  const pctEfectivo = pct && metric !== "crudo";
  const maEfectivo = verMA && metric !== "crudo";

  // Guard "parcial" (P6): el último punto de una línea cuya fecha es HOY puede
  // seguir cambiando (rueda sin cerrar / pizarra sin la actualización del día).
  const hoyISO = hoyCordobaISO();
  const esParcial = (puntos: PuntoXY[]): boolean => {
    if (puntos.length === 0) return false;
    // length>0 recién chequeado → el último índice siempre existe.
    return puntos[puntos.length - 1]!.f === hoyISO;
  };

  // Calcular las líneas del chart a partir de las series traídas.
  const lines = React.useMemo<CampLine[]>(() => {
    const ventanaDias = Math.round(ventanaMeses * 30.4375);
    const off = offsetB(a, b);
    const out: CampLine[] = [];
    for (const year of [...effectiveYears].sort()) {
      const ra = idx.resolver(a, year);
      const rb = b ? idx.resolver(b, year + off) : null;
      if (!ra) continue;
      const sa = series[ra.serieId];
      if (!sa) continue;
      const color = colors[year] ?? fallbackColor(year);
      const vigente = year === vigenteYear;
      const vtos = [ra.vto, rb?.vto].filter((v): v is string => !!v);
      const vto = vtos.length ? vtos.reduce((m, v) => (v < m ? v : m)) : `${year}-12-31`;

      // Una sola pata → serie cruda alineada.
      if (!b || !rb) {
        const puntos = alinear(zipSerie(sa), vto, eje, ventanaDias);
        if (puntos.length) out.push({ key: String(year), label: String(year), color, vigente, parcial: esParcial(puntos), data: puntos });
        continue;
      }
      const sb = series[rb.serieId];
      if (!sb) continue;

      if (metric === "crudo") {
        const pa = alinear(zipSerie(sa), vto, eje, ventanaDias);
        const pb = alinear(zipSerie(sb), vto, eje, ventanaDias);
        if (pa.length) out.push({ key: `${year}A`, label: `${year} · A`, color, vigente, parcial: esParcial(pa), data: pa });
        if (pb.length) out.push({ key: `${year}B`, label: `${year} · B`, color, vigente, dash: true, parcial: esParcial(pb), data: pb });
        continue;
      }

      // spread / ratio → ordenar patas y calcular métrica diaria + alinear.
      const [near, far] = ordenarPatas(sa, ra, sb, rb);
      const join = joinFfill(near, far);
      const met = metricaDiaria(join, metric, pctEfectivo); // spread = far − near ; ratio = near/far
      const puntos = alinear(met, vto, eje, ventanaDias);
      if (puntos.length) out.push({ key: String(year), label: String(year), color, vigente, parcial: esParcial(puntos), data: puntos });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, effectiveYears, idx, a, b, metric, eje, ventanaMeses, colors, vigenteYear, pctEfectivo, hoyISO]);

  // Media móvil (P6, P15): overlay SOLO de la campaña vigente, sobre la métrica
  // ya calculada (5 ruedas por default). No participa de la banda ni del KPI.
  const maLines = React.useMemo<CampLine[]>(() => {
    if (!maEfectivo || vigenteYear == null) return [];
    const ventanaDias = Math.round(ventanaMeses * 30.4375);
    const off = offsetB(a, b);
    const ra = idx.resolver(a, vigenteYear);
    const rb = b ? idx.resolver(b, vigenteYear + off) : null;
    if (!ra) return [];
    const sa = series[ra.serieId];
    if (!sa) return [];
    const vtos = [ra.vto, rb?.vto].filter((v): v is string => !!v);
    const vto = vtos.length ? vtos.reduce((m, v) => (v < m ? v : m)) : `${vigenteYear}-12-31`;
    const color = colors[vigenteYear] ?? fallbackColor(vigenteYear);

    let serieDiaria: { f: string; y: number }[];
    if (!b || !rb) {
      serieDiaria = zipSerie(sa);
    } else {
      const sb = series[rb.serieId];
      if (!sb) return [];
      const [near, far] = ordenarPatas(sa, ra, sb, rb);
      serieDiaria = metricaDiaria(joinFfill(near, far), metric, pctEfectivo);
    }
    const ma = mediaMovil(serieDiaria, ventanaMA);
    const puntos = alinear(ma, vto, eje, ventanaDias);
    if (puntos.length === 0) return [];
    return [{ key: "ma", label: `MA${ventanaMA}`, color, vigente: false, dash: true, data: puntos }];
  }, [maEfectivo, metric, vigenteYear, ventanaMeses, ventanaMA, a, b, idx, series, eje, colors, pctEfectivo]);

  // Volumen/OI (P6): subpanel de la pata A de la campaña vigente. Solo A3/CBOT
  // tienen volumen (la pizarra es una referencia de precio, no un contrato operado).
  const volumenDisponible = a.fuente === "a3" || a.fuente === "cbot";
  const volumenPuntos = React.useMemo<VolPunto[]>(() => {
    if (!verVolumen || !volumenDisponible || vigenteYear == null) return [];
    const ventanaDias = Math.round(ventanaMeses * 30.4375);
    const ra = idx.resolver(a, vigenteYear);
    if (!ra) return [];
    const sa = series[ra.serieId];
    if (!sa || (!sa.vol && !sa.oi)) return [];
    const rb = b ? idx.resolver(b, vigenteYear + offsetB(a, b)) : null;
    const vtos = [ra.vto, rb?.vto].filter((v): v is string => !!v);
    const vto = vtos.length ? vtos.reduce((m, v) => (v < m ? v : m)) : `${vigenteYear}-12-31`;
    // d/v/vol/oi son arrays paralelos (mismo contrato que zipSerie) — acá se arma a mano porque
    // suma vol/oi, que zipSerie no trae.
    const raw: { f: string; y: number; vol: number | null; oi: number | null }[] = [];
    for (let i = 0; i < sa.d.length; i++) {
      const f = sa.d[i];
      const y = sa.v[i];
      if (f === undefined || y === undefined) continue;
      raw.push({ f, y, vol: sa.vol?.[i] ?? null, oi: sa.oi?.[i] ?? null });
    }
    return alinear(raw, vto, eje, ventanaDias);
  }, [verVolumen, volumenDisponible, vigenteYear, ventanaMeses, idx, a, b, series, eje]);

  const anchorMes = React.useMemo(() => {
    // Mes ancla del eje calendario = mes del vto de la pata A + 1 (aprox).
    const m = a.mon ? mesDePosicion(`${a.mon}00`) : 1;
    return (m % 12) + 1;
  }, [a.mon]);

  // Vto de la campaña vigente (min de las patas) → rotula los meses del eje días-al-vto.
  const refVto = React.useMemo(() => {
    if (vigenteYear == null) return undefined;
    const ra = idx.resolver(a, vigenteYear);
    const rb = b ? idx.resolver(b, vigenteYear + offsetB(a, b)) : null;
    const vtos = [ra?.vto, rb?.vto].filter((v): v is string => !!v);
    return vtos.length ? vtos.reduce((m, v) => (v < m ? v : m)) : undefined;
  }, [idx, a, b, vigenteYear]);

  const decimals = pctEfectivo ? 1 : metric === "ratio" ? 3 : 2;
  const fmtKpi = React.useCallback(
    (v: number) => (pctEfectivo ? `${nfmt(v, decimals)}%` : nfmt(v, decimals)),
    [pctEfectivo, decimals],
  );

  // Banda histórica (P13): a cada altura x, min–máx + mediana de las campañas
  // históricas (todas las seleccionadas MENOS la vigente). Se agrupan por x.
  const banda = React.useMemo<BandaPunto[]>(() => {
    if (modo !== "banda") return [];
    const hist = lines.filter((l) => !l.vigente);
    if (hist.length < 2) return []; // sin al menos 2 campañas no hay banda útil
    const byX = new Map<number, number[]>();
    for (const l of hist) for (const p of l.data) {
      const arr = byX.get(p.x);
      if (arr) arr.push(p.y); else byX.set(p.x, [p.y]);
    }
    return [...byX.entries()]
      .filter(([, ys]) => ys.length >= 2)
      .map(([x, ys]) => ({ x, min: Math.min(...ys), max: Math.max(...ys), med: mediana(ys) }))
      .sort((p, q) => p.x - q.x);
  }, [modo, lines]);

  // KPI de la campaña vigente: última rueda + min/máx de su ventana + percentil
  // "hoy vs historia" a la misma altura de campaña (P14).
  const kpi = React.useMemo(() => {
    const ln = lines.find((l) => l.vigente) ?? lines.at(-1);
    if (!ln || ln.data.length === 0) return null;
    const ys = ln.data.map((p) => p.y);
    // ln.data.length===0 ya devolvió null arriba → ln.data[0] siempre existe.
    const hoy = ln.data.reduce((m, p) => (p.x > m.x ? p : m), ln.data[0]!);
    // Percentil: muestra = valores de las campañas históricas a la misma x (hoy.x).
    const hist = lines.filter((l) => !l.vigente);
    const muestra: number[] = [];
    for (const l of hist) {
      const p = l.data.find((q) => q.x === hoy.x) ?? l.data.reduce<null | PuntoXY>(
        (best, q) => (Math.abs(q.x - hoy.x) < (best ? Math.abs(best.x - hoy.x) : Infinity) ? q : best),
        null,
      );
      if (p) muestra.push(p.y);
    }
    const pct = muestra.length >= 3 ? percentil(hoy.y, muestra) : null;
    return { label: ln.label, hoy: hoy.y, min: Math.min(...ys), max: Math.max(...ys), pct, nHist: muestra.length };
  }, [lines]);

  const aplicarPreset = React.useCallback((pa: Pata, pb: Pata) => {
    setA(pa);
    setB(pb);
    setMetric("spread");
    setYears([]); // = todas las campañas disponibles del par
  }, []);

  // El estado inicial sale de la URL (solo cliente) → durante SSR/hidratación el
  // server no la conoce. Se muestra un placeholder determinista hasta el mount
  // para evitar mismatch de hidratación; recién ahí se pinta el panel real.
  if (!mounted) return <div className="gx-wrap" aria-busy="true" />;

  const modoToggle = (
    <div className="gx-modo">
      <div className="gx-seg" role="group" aria-label="Modo de comparación">
        <button type="button" className={modoComp === "campanias" ? "on" : ""} onClick={() => setModoComp("campanias")}>
          Campañas
        </button>
        <button type="button" className={modoComp === "periodo" ? "on" : ""} onClick={() => setModoComp("periodo")}>
          Período
        </button>
      </div>
      <span className="gx-modo-hint">
        {modoComp === "campanias"
          ? "Una relación de 2 patas, superponiendo campañas por vencimiento."
          : "Una base vs varias posiciones sobre un año, en eje calendario."}
      </span>
    </div>
  );

  if (modoComp === "periodo") {
    return (
      <div className="gx-wrap">
        {modoToggle}
        <PeriodoPanel catalogo={catalogo} anioActual={new Date().getFullYear()} />
      </div>
    );
  }

  return (
    <div className="gx-wrap">
      {modoToggle}
      <div className="gx-preset-groups">
        {GRUPOS_PRESET.map((g) => (
          <div className="gx-preset-row" key={g.grano}>
            <span className="gx-preset-glabel">{g.label}</span>
            {g.pares.map(([monA, monB]) => {
              const on = a.fuente === "a3" && a.grano === g.grano && a.mon === monA
                && b?.fuente === "a3" && b?.grano === g.grano && b?.mon === monB;
              return (
                <button
                  key={`${monA}-${monB}`}
                  type="button"
                  className={`gx-preset${on ? " on" : ""}`}
                  onClick={() => aplicarPreset(a3Pata(g.grano, monA), a3Pata(g.grano, monB))}
                >
                  {monA}/{monB}
                </button>
              );
            })}
          </div>
        ))}
        {[...new Set(PARES_LIBRES.map((p) => p.grupo))].map((grupo) => (
          <div className="gx-preset-row" key={grupo}>
            <span className="gx-preset-glabel">{grupo}</span>
            {PARES_LIBRES.filter((p) => p.grupo === grupo).map((p) => {
              const on = a.fuente === p.a.fuente && a.grano === p.a.grano && a.mon === p.a.mon
                && b?.fuente === p.b.fuente && b?.grano === p.b.grano && b?.mon === p.b.mon;
              return (
                <button key={p.label} type="button" className={`gx-preset${on ? " on" : ""}`}
                  onClick={() => aplicarPreset(p.a, p.b)}>
                  {p.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="gx-build">
        <PataSelector legend="Pata A" idx={idx} pata={a} onChange={(p) => p && setA(p)} />
        <button type="button" className="gx-swap" title="Intercambiar patas" aria-label="Intercambiar patas"
          onClick={() => { if (b) { const t = a; setA(b); setB(t); } }}>⇄</button>
        <PataSelector legend="Pata B" idx={idx} pata={b} onChange={setB} allowNone />

        <div className="gx-pata">
          <span className="gx-pata-lbl">Métrica</span>
          <div className="gx-seg" role="group" aria-label="Métrica">
            {(["spread", "ratio", "crudo"] as Metric[]).map((m) => (
              <button key={m} type="button" className={m === metric ? "on" : ""} onClick={() => setMetric(m)}>
                {m === "spread" ? "Spread US$" : m === "ratio" ? "Ratio" : "Crudas"}
              </button>
            ))}
          </div>
        </div>

        <div className="gx-pata">
          <span className="gx-pata-lbl">Eje X</span>
          <div className="gx-seg" role="group" aria-label="Eje X">
            <button type="button" className={eje === "vto" ? "on" : ""} onClick={() => setEje("vto")}>Días al vto</button>
            <button type="button" className={eje === "cal" ? "on" : ""} onClick={() => setEje("cal")}>Calendario</button>
          </div>
        </div>

        <div className="gx-pata">
          <span className="gx-pata-lbl">Ventana</span>
          <select value={ventanaMeses} onChange={(e) => setVentanaMeses(Number(e.target.value))} aria-label="Ventana en meses">
            {[3, 6, 12, 18, 24].map((m) => <option key={m} value={m}>{m} meses</option>)}
          </select>
        </div>

        <div className="gx-pata">
          <span className="gx-pata-lbl">Vista</span>
          <div className="gx-seg" role="group" aria-label="Vista">
            <button type="button" className={vista === "lineas" ? "on" : ""} onClick={() => setVista("lineas")}>Líneas</button>
            <button
              type="button"
              className={vista === "banda" ? "on" : ""}
              disabled={metric === "crudo"}
              title={metric === "crudo" ? "La banda no aplica a series crudas" : "Sombra min–máx + mediana de las campañas históricas"}
              onClick={() => setVista("banda")}
            >
              Banda
            </button>
          </div>
        </div>

        <div className="gx-pata">
          <span className="gx-pata-lbl">Opciones</span>
          <div className="gx-selrow" style={{ alignItems: "center" }}>
            <label className="gx-check">
              <input
                type="checkbox"
                checked={pct}
                disabled={metric === "crudo"}
                onChange={(e) => setPct(e.target.checked)}
              />
              En %
            </label>
            <label className="gx-check">
              <input
                type="checkbox"
                checked={verMA}
                disabled={metric === "crudo"}
                onChange={(e) => setVerMA(e.target.checked)}
              />
              Media móvil
            </label>
            {verMA && metric !== "crudo" && (
              <select value={ventanaMA} onChange={(e) => setVentanaMA(Number(e.target.value))} aria-label="Ventana de la media móvil">
                {[3, 5, 10, 20].map((v) => <option key={v} value={v}>{v} ruedas</option>)}
              </select>
            )}
            <label className="gx-check" title={volumenDisponible ? undefined : "Solo disponible para futuros A3/Chicago (la pizarra no opera contratos)"}>
              <input
                type="checkbox"
                checked={verVolumen}
                disabled={!volumenDisponible}
                onChange={(e) => setVerVolumen(e.target.checked)}
              />
              Volumen/OI
            </label>
          </div>
        </div>
      </div>

      <div className="gx-chips">
        <span className="gx-chips-lbl">Campañas</span>
        {aniosDisponibles.map((y) => {
          const on = effectiveYears.includes(y);
          return (
            <button
              key={y}
              type="button"
              className={`gx-chip${y === vigenteYear ? " vig" : ""}`}
              aria-pressed={on}
              style={{ ["--c" as string]: colors[y] ?? "#888" }}
              onClick={() =>
                setYears(() => {
                  const base = on ? effectiveYears.filter((v) => v !== y) : [...effectiveYears, y];
                  return [...base].sort((m, n) => m - n);
                })
              }
            >
              <span className="sw" />{y}
            </button>
          );
        })}
        {aniosDisponibles.length > 0 && (() => {
          const ultima = aniosDisponibles[aniosDisponibles.length - 1];
          const ultimoAnio = ultima != null ? [ultima] : [];
          const ult3 = aniosDisponibles.slice(-3);
          const mismos = (x: number[], y: number[]) => x.length === y.length && x.every((v) => y.includes(v));
          // Punto 48: click prende (todas/últ. 3); re-click con ESE mismo estado ya
          // prendido vuelve a dejar solo la última campaña.
          const esTodas = mismos(effectiveYears, aniosDisponibles);
          const esUlt3 = mismos(effectiveYears, ult3);
          return (
            <>
              <button
                type="button"
                className={`gx-preset${esUlt3 ? " on" : ""}`}
                aria-pressed={esUlt3}
                onClick={() => setYears(esUlt3 ? ultimoAnio : ult3)}
              >
                Últ. 3
              </button>
              <button
                type="button"
                className={`gx-preset${esTodas ? " on" : ""}`}
                aria-pressed={esTodas}
                onClick={() => setYears(esTodas ? ultimoAnio : aniosDisponibles)}
              >
                Todas
              </button>
            </>
          );
        })()}
      </div>

      <div className="gx-chart">
        {!mounted ? (
          <div className="gx-empty">Cargando gráfico…</div>
        ) : error ? (
          <div className="gx-empty">No se pudieron traer las series ({error}).</div>
        ) : lines.length === 0 ? (
          <div className="gx-empty">
            {cargando ? "Trayendo datos…" : "Elegí dos patas y al menos una campaña para ver el spread."}
          </div>
        ) : (
          <SpreadChart
            lines={lines}
            eje={eje}
            metric={metric}
            anchorMes={anchorMes}
            decimals={decimals}
            modo={modo}
            banda={banda}
            refVto={refVto}
            ma={maLines}
            pct={pctEfectivo}
            exportName={nombreArchivo(a.grano, a.mon, b?.grano, b?.mon, metric, pctEfectivo ? "pct" : null)}
            kpis={
              kpi && (
                <div className="gx-kpis">
                  <div className="gx-kpi"><span className="k">Campaña {kpi.label} · última</span><span className="v">{fmtKpi(kpi.hoy)}</span></div>
                  <div className="gx-kpi"><span className="k">Mín ventana</span><span className="v">{fmtKpi(kpi.min)}</span></div>
                  <div className="gx-kpi"><span className="k">Máx ventana</span><span className="v">{fmtKpi(kpi.max)}</span></div>
                  {kpi.pct !== null && (
                    <div className="gx-kpi">
                      <span className="k">Percentil hoy vs {kpi.nHist} campañas</span>
                      <span className="v">{nfmt(kpi.pct, 0)}%</span>
                    </div>
                  )}
                </div>
              )
            }
          />
        )}
      </div>

      {verVolumen && volumenDisponible && (
        <VolumenPanel
          puntos={volumenPuntos}
          eje={eje}
          anchorMes={anchorMes}
          refVto={refVto}
          label={`${GRANO_NOMBRE[a.grano] ?? a.grano}${a.mon ? ` ${a.mon}` : ""} (pata A)`}
          exportName={nombreArchivo(a.grano, a.mon, "volumen")}
        />
      )}

      <p className="gx-note">
        <b>Spread</b> = pata lejana − pata cercana (en empate de vencimiento, cara − barata; ej. soja − maíz).
        <b> Eje días al vto</b> alinea las campañas por índice de rueda terminando en el vencimiento
        (como la planilla); debajo del nº de ruedas va el mes de referencia de la campaña vigente.
        <b> Banda</b> = sombra min–máx + mediana de las campañas históricas, con la vigente gruesa encima;
        el <b>percentil</b> ubica el valor de hoy contra esas campañas a la misma altura.
        Datos de cierre desde 2020 · Matba Rofex, Chicago (USD/tn) y pizarra.
      </p>
    </div>
  );
}

/* ---------------- selector de pata ---------------- */

function PataSelector({
  legend, idx, pata, onChange, allowNone = false,
}: {
  legend: string;
  idx: Idx;
  pata: Pata | null;
  onChange: (p: Pata | null) => void;
  allowNone?: boolean;
}) {
  const fuentes: Fuente[] = ["a3", "cbot", "pizarra"];
  const p = pata;
  const granos = p ? idx.granosPorFuente[p.fuente] : [];
  const mons = p && p.fuente !== "pizarra" ? (idx.monsPorGF.get(`${p.fuente}:${p.grano}`) ?? []) : [];

  return (
    <div className="gx-pata">
      <span className="gx-pata-lbl">{legend}</span>
      <div className="gx-selrow">
        {allowNone && (
          <select
            aria-label={`${legend} activa`}
            value={p ? "on" : "off"}
            onChange={(e) => {
              if (e.target.value === "off") onChange(null);
              else onChange({ fuente: "a3", grano: "maiz", mon: "JUL" });
            }}
          >
            <option value="on">Con pata B</option>
            <option value="off">Sin pata B</option>
          </select>
        )}
        {p && (
          <>
            <select
              aria-label={`${legend} fuente`}
              value={p.fuente}
              onChange={(e) => {
                const fuente = e.target.value as Fuente;
                const g = idx.granosPorFuente[fuente][0] ?? "soja";
                const ms = fuente === "pizarra" ? [] : idx.monsPorGF.get(`${fuente}:${g}`) ?? [];
                onChange({ fuente, grano: g, mon: fuente === "pizarra" ? null : ms[0] ?? null });
              }}
            >
              {fuentes.map((f) => <option key={f} value={f}>{FUENTE_NOMBRE[f]}</option>)}
            </select>
            <select
              aria-label={`${legend} grano`}
              value={p.grano}
              onChange={(e) => {
                const grano = e.target.value;
                const ms = p.fuente === "pizarra" ? [] : idx.monsPorGF.get(`${p.fuente}:${grano}`) ?? [];
                onChange({ ...p, grano, mon: p.fuente === "pizarra" ? null : ms[0] ?? null });
              }}
            >
              {granos.map((g) => <option key={g} value={g}>{GRANO_NOMBRE[g] ?? g}</option>)}
            </select>
            {p.fuente !== "pizarra" && (
              <select
                aria-label={`${legend} posición`}
                value={p.mon ?? ""}
                onChange={(e) => onChange({ ...p, mon: e.target.value })}
              >
                {mons.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */

/**
 * Ordena las dos patas para el spread = far − near. Convenciones de Lautaro:
 *  - Pizarra − futuro (P11): la pizarra es el minuendo (far).
 *  - A3 − CBOT (P10): la posición local (A3) es el minuendo (far).
 *  - Mismo mercado: lejana − cercana (vto mayor − menor); empate → cara − barata.
 */
function ordenarPatas(
  sa: SeriePuntos, ra: PataResuelta, sb: SeriePuntos, rb: PataResuelta,
): [SeriePuntos, SeriePuntos] {
  const fa = fuenteDeId(ra.serieId);
  const fb = fuenteDeId(rb.serieId);

  // Pizarra − futuro: pizarra = far (minuendo).
  if (fa === "pizarra" && fb !== "pizarra") return [sb, sa];
  if (fb === "pizarra" && fa !== "pizarra") return [sa, sb];

  // A3 − CBOT: A3 = far (minuendo).
  if (fa === "a3" && fb === "cbot") return [sb, sa];
  if (fb === "a3" && fa === "cbot") return [sa, sb];

  // Mismo mercado: lejana − cercana; empate → cara − barata.
  if (ra.vto && rb.vto && ra.vto !== rb.vto) {
    return ra.vto < rb.vto ? [sa, sb] : [sb, sa];
  }
  return media(sa.v) <= media(sb.v) ? [sa, sb] : [sb, sa];
}

function media(xs: number[]): number {
  return xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : 0;
}

/** Resta días a una fecha ISO. */
function isoMenosDias(iso: string, dias: number): string {
  const t = Date.parse(`${iso}T12:00:00-03:00`) - dias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
