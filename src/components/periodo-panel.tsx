"use client";

import * as React from "react";
import type { SerieCat, SeriePuntos, Fuente } from "@/lib/series-types";
import { joinFfill, metricaDiaria, mediaMovil, posCalendario } from "@/lib/derivadas";
import { MESES_ES, mesIndice, hoyCordobaISO } from "@/lib/dates";
import { nombreArchivo } from "@/lib/chart-export";
import { SpreadChart, type CampLine } from "./spread-chart";

/**
 * Modo Período del panel de gráficos: una BASE (pizarra o una posición) contra
 * VARIAS posiciones de un grano, sobre un año, en eje calendario real. Cada línea
 * es el spread base − posición y corre hasta donde esa posición tiene datos
 * (su vencimiento). Muestra las dos cosechas que cotizan en el período; un filtro
 * permite apagar posiciones. Decisión de Lautaro (11/07): "todas las que cotizan".
 *
 * Persistencia en la URL (P6 del backlog maestro): mismo patrón que el modo
 * Campañas (`graficos-client.tsx`) — cada panel lee/escribe SOLO sus propias
 * claves (acá `pf/pg/pm/pa/po`), mergeando con lo que ya haya en la querystring
 * (el modo `mc` y las claves de Campañas viven ahí y no se tocan).
 */

type EstadoPeriodo = { baseFuente: Fuente; grano: string; baseMon: string; anio: number; ocultas: string[] };

function leerURLPeriodo(anioActual: number): EstadoPeriodo {
  if (typeof window === "undefined") {
    return { baseFuente: "pizarra", grano: "maiz", baseMon: "JUL", anio: anioActual, ocultas: [] };
  }
  const q = new URLSearchParams(window.location.search);
  const baseFuente: Fuente = q.get("pf") === "a3" ? "a3" : "pizarra";
  const grano = q.get("pg") || "maiz";
  const baseMon = q.get("pm") || "JUL";
  const anioQ = Number(q.get("pa"));
  const anio = Number.isFinite(anioQ) && anioQ >= 2020 && anioQ <= 2100 ? anioQ : anioActual;
  const ocultas = (q.get("po") ?? "").split(",").filter(Boolean);
  return { baseFuente, grano, baseMon, anio, ocultas };
}

function escribirURLPeriodo(e: EstadoPeriodo) {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  q.set("pf", e.baseFuente);
  q.set("pg", e.grano);
  q.set("pm", e.baseMon);
  q.set("pa", String(e.anio));
  if (e.ocultas.length) q.set("po", e.ocultas.join(",")); else q.delete("po");
  window.history.replaceState(null, "", `?${q.toString()}`);
}

const GRANO_NOMBRE: Record<string, string> = {
  soja: "Soja", maiz: "Maíz", trigo: "Trigo", girasol: "Girasol", sorgo: "Sorgo",
};
// Paleta por posición (no por campaña): hasta 12 targets.
const POS_COLORS = [
  "#2A78D6","#D96A2A","#0891B2","#B45309","#DB5A9B","#9333EA",
  "#0F9E8C","#7C4FD0","#C2410C","#4D7C0F","#0E7490","#BE123C",
];
/** Color de paleta por índice, con módulo — siempre en rango (arreglo no vacío). */
function posColor(i: number): string {
  return POS_COLORS[i % POS_COLORS.length] ?? "#2A78D6";
}

type Target = { serieId: string; posicion: string; mon: string; yy: number; venc: string | null };

/** Vencida = tiene vto real y ya pasó. Sin vto conocido, se asume viva (no se esconde nada
 *  por falta de dato). */
function estaVencida(t: Target, hoyISO: string): boolean {
  return t.venc != null && t.venc < hoyISO;
}

/**
 * Fecha límite para cortar una línea (fix 07/08/2026, "la posición julio26 ya estaba
 * expirada" — el join con ffill seguía arrastrando el último precio conocido de la pata
 * vencida contra una base que se seguía moviendo, "delirando" el spread). El límite es el
 * MENOR de los dos vencimientos (base y target) que exista — después de eso, ninguna de
 * las dos patas tiene un precio real, así que la línea no debe seguir.
 */
function limiteVenc(baseVenc: string | null, targetVenc: string | null): string | null {
  if (baseVenc && targetVenc) return baseVenc < targetVenc ? baseVenc : targetVenc;
  return baseVenc ?? targetVenc ?? null;
}

/**
 * Default de posiciones visibles (fix 07/08/2026: antes arrancaban TODAS tildadas) — solo la
 * posición viva más próxima al vencimiento. Si ninguna está viva (año pasado, todas vencidas),
 * no oculta nada: mejor mostrar lo que hay que dejar el gráfico vacío.
 */
function ocultasPorDefecto(targets: Target[], hoyISO: string): Set<string> {
  const vivas = targets.filter((t) => !estaVencida(t, hoyISO));
  if (vivas.length === 0) return new Set();
  const masCercana = [...vivas].sort((a, b) => (a.venc ?? "9999-99-99").localeCompare(b.venc ?? "9999-99-99"))[0]!;
  return new Set(targets.filter((t) => t.serieId !== masCercana.serieId).map((t) => t.serieId));
}

/** Posiciones A3 .ROS del grano que cotizan en el año (su [desde,hasta] lo cruza). */
function targetsDelAnio(cat: SerieCat[], grano: string, anio: number): Target[] {
  const from = `${anio}-01-01`;
  const to = `${anio}-12-31`;
  return cat
    .filter((c) => c.fuente === "a3" && c.grano === grano && c.posicion && c.desde <= to && c.hasta >= from)
    .map((c) => ({
      serieId: c.serieId,
      posicion: c.posicion!,
      mon: c.posicion!.slice(0, 3),
      yy: 2000 + Number(c.posicion!.slice(3)),
      venc: c.vencimiento,
    }))
    .sort((a, b) => (a.yy - b.yy) || (mesIndice(a.mon) - mesIndice(b.mon)));
}

/* ---------------- presets de pizarra ---------------- */

// Labels con el grano capitalizado (relevamiento web R7, punto 48: "mayúscula donde
// falte" — quedaban en minúscula acá, a diferencia de los presets de graficos-client.tsx).
const PRESETS_PIZARRA: { grano: string; label: string; meses: string[] }[] = [
  { grano: "maiz", label: "Pizarra Maíz", meses: ["ABR", "JUL", "DIC"] },
  { grano: "soja", label: "Pizarra Soja", meses: ["MAY", "JUL", "NOV"] },
  { grano: "trigo", label: "Pizarra Trigo", meses: ["DIC", "ENE", "MAR", "JUL"] },
];

export function PeriodoPanel({ catalogo, anioActual }: { catalogo: SerieCat[]; anioActual: number }) {
  const granosPizarra = React.useMemo(
    () => [...new Set(catalogo.filter((c) => c.fuente === "pizarra").map((c) => c.grano))].sort(),
    [catalogo],
  );
  const granosA3 = React.useMemo(
    () => [...new Set(catalogo.filter((c) => c.fuente === "a3").map((c) => c.grano))].sort(),
    [catalogo],
  );

  const inicial = React.useMemo(() => leerURLPeriodo(anioActual), [anioActual]);
  const [baseFuente, setBaseFuente] = React.useState<Fuente>(inicial.baseFuente);
  const [grano, setGrano] = React.useState<string>(inicial.grano);
  const [baseMon, setBaseMon] = React.useState<string>(inicial.baseMon); // solo si base = a3
  const [anio, setAnio] = React.useState<number>(inicial.anio);
  // Default (fix 07/08/2026): sin `?po=` en la URL, solo la posición viva más próxima —
  // antes arrancaban TODAS tildadas. Con `?po=` explícito (link compartido), se respeta tal cual.
  const [ocultas, setOcultas] = React.useState<Set<string>>(() =>
    inicial.ocultas.length > 0
      ? new Set(inicial.ocultas)
      : ocultasPorDefecto(targetsDelAnio(catalogo, inicial.grano, inicial.anio), hoyCordobaISO()),
  );

  const [series, setSeries] = React.useState<Record<string, SeriePuntos>>({});
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // P6: mismas opciones que el modo Campañas — "en %" y media móvil.
  const [pct, setPct] = React.useState(false);
  const [verMA, setVerMA] = React.useState(false);
  const [ventanaMA, setVentanaMA] = React.useState(5);

  const targets = React.useMemo(() => targetsDelAnio(catalogo, grano, anio), [catalogo, grano, anio]);

  // Persistir en la URL (P6: "Período ya lo hace igual que Campañas").
  React.useEffect(() => {
    escribirURLPeriodo({ baseFuente, grano, baseMon, anio, ocultas: [...ocultas] });
  }, [baseFuente, grano, baseMon, anio, ocultas]);

  // serieId de la base + su vencimiento (null = pizarra, no vence).
  const [baseId, baseVenc] = React.useMemo((): [string | null, string | null] => {
    if (baseFuente === "pizarra") return [`pizarra:${grano}`, null];
    // a3: buscar la posición del grano+mes del año (o la del año siguiente si no está).
    const c = catalogo.find((x) => x.fuente === "a3" && x.grano === grano && x.posicion === `${baseMon}${String(anio % 100).padStart(2, "0")}`);
    return [c?.serieId ?? null, c?.vencimiento ?? null];
  }, [baseFuente, grano, baseMon, anio, catalogo]);

  // Traer base + targets sobre el período.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!baseId || targets.length === 0) { setSeries({}); return; }
    const ids = [baseId, ...targets.map((t) => t.serieId)];
    const from = `${anio}-01-01`;
    const to = `${anio}-12-31`;
    let cancel = false;
    setCargando(true);
    setError(null);
    fetch(`/api/series?ids=${encodeURIComponent(ids.join(","))}&from=${from}&to=${to}`)
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
  }, [baseId, targets, anio]);

  const hoyISO = hoyCordobaISO();

  // Líneas: spread base − posición por target, eje calendario real.
  const lines = React.useMemo<CampLine[]>(() => {
    const base = baseId ? series[baseId] : null;
    if (!base) return [];
    const out: CampLine[] = [];
    targets.forEach((t, i) => {
      if (ocultas.has(t.serieId)) return;
      const st = series[t.serieId];
      if (!st) return;
      const join = joinFfill(st, base); // va = target, vb = base → spread = base − target
      const met = metricaDiaria(join, "spread", pct);
      // Corte por vencimiento (fix 07/08/2026): sin esto, el ffill de `joinFfill` seguía
      // arrastrando el último precio conocido de una pata ya vencida.
      const limite = limiteVenc(baseVenc, t.venc);
      const data = met
        .filter((p) => !limite || p.f <= limite)
        .map((p) => ({ x: posCalendario(p.f), y: p.y, f: p.f }));
      if (data.length === 0) return;
      out.push({
        key: t.serieId,
        label: t.posicion,
        color: posColor(i),
        vigente: false,
        parcial: data[data.length - 1]!.f === hoyISO, // data.length===0 ya salió arriba
        data,
      });
    });
    return out;
  }, [series, baseId, baseVenc, targets, ocultas, pct, hoyISO]);

  // Media móvil (P6): overlay por cada posición visible, sobre el spread ya calculado.
  const maLines = React.useMemo<CampLine[]>(() => {
    if (!verMA) return [];
    const base = baseId ? series[baseId] : null;
    if (!base) return [];
    const out: CampLine[] = [];
    targets.forEach((t, i) => {
      if (ocultas.has(t.serieId)) return;
      const st = series[t.serieId];
      if (!st) return;
      const met = metricaDiaria(joinFfill(st, base), "spread", pct);
      const ma = mediaMovil(met, ventanaMA);
      const limite = limiteVenc(baseVenc, t.venc);
      const data = ma
        .filter((p) => !limite || p.f <= limite)
        .map((p) => ({ x: posCalendario(p.f), y: p.y, f: p.f }));
      if (data.length === 0) return;
      out.push({
        key: `${t.serieId}-ma`,
        label: `${t.posicion} · MA${ventanaMA}`,
        color: posColor(i),
        vigente: false,
        dash: true,
        data,
      });
    });
    return out;
  }, [verMA, series, baseId, baseVenc, targets, ocultas, pct, ventanaMA]);

  const aplicarPreset = (p: { grano: string; meses: string[] }) => {
    setBaseFuente("pizarra");
    setGrano(p.grano);
    // ocultar las posiciones cuyo mes no está en el preset (se recalcula al cambiar targets).
    const ts = targetsDelAnio(catalogo, p.grano, anio);
    setOcultas(new Set(ts.filter((t) => !p.meses.includes(t.mon)).map((t) => t.serieId)));
  };

  const anios = React.useMemo(() => {
    const ys: number[] = [];
    for (let y = anioActual; y >= 2020; y--) ys.push(y);
    return ys;
  }, [anioActual]);

  const baseLabel = baseFuente === "pizarra"
    ? `Pizarra ${GRANO_NOMBRE[grano] ?? grano}`
    : `${GRANO_NOMBRE[grano] ?? grano} ${baseMon}`;

  return (
    <>
      <div className="gx-preset-groups">
        <div className="gx-preset-row">
          <span className="gx-preset-glabel">Pizarra</span>
          {PRESETS_PIZARRA.map((p) => {
            const on = baseFuente === "pizarra" && grano === p.grano;
            return (
              <button key={p.grano} type="button" className={`gx-preset${on ? " on" : ""}`}
                onClick={() => aplicarPreset(p)}>
                {p.label} · {p.meses.join("/")}
              </button>
            );
          })}
        </div>
      </div>

      <div className="gx-build">
        <div className="gx-pata">
          <span className="gx-pata-lbl">Base</span>
          <div className="gx-selrow">
            <select value={baseFuente} onChange={(e) => setBaseFuente(e.target.value as Fuente)} aria-label="Base fuente">
              <option value="pizarra">Pizarra</option>
              <option value="a3">Futuro A3</option>
            </select>
            <select value={grano} onChange={(e) => {
              const g = e.target.value;
              setGrano(g);
              setOcultas(ocultasPorDefecto(targetsDelAnio(catalogo, g, anio), hoyCordobaISO()));
            }} aria-label="Grano">
              {(baseFuente === "pizarra" ? granosPizarra : granosA3).map((g) => (
                <option key={g} value={g}>{GRANO_NOMBRE[g] ?? g}</option>
              ))}
            </select>
            {baseFuente === "a3" && (
              <select value={baseMon} onChange={(e) => setBaseMon(e.target.value)} aria-label="Posición base">
                {MESES_ES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="gx-pata">
          <span className="gx-pata-lbl">Año</span>
          <select value={anio} onChange={(e) => {
            const a = Number(e.target.value);
            setAnio(a);
            setOcultas(ocultasPorDefecto(targetsDelAnio(catalogo, grano, a), hoyCordobaISO()));
          }} aria-label="Año del período">
            {anios.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="gx-pata">
          <span className="gx-pata-lbl">Vs posiciones de</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--ink-2)", padding: "5px 0" }}>
            {GRANO_NOMBRE[grano] ?? grano} · {targets.length} posiciones
          </span>
        </div>

        <div className="gx-pata">
          <span className="gx-pata-lbl">Opciones</span>
          <div className="gx-selrow" style={{ alignItems: "center" }}>
            <label className="gx-check">
              <input type="checkbox" checked={pct} onChange={(e) => setPct(e.target.checked)} />
              En %
            </label>
            <label className="gx-check">
              <input type="checkbox" checked={verMA} onChange={(e) => setVerMA(e.target.checked)} />
              Media móvil
            </label>
            {verMA && (
              <select value={ventanaMA} onChange={(e) => setVentanaMA(Number(e.target.value))} aria-label="Ventana de la media móvil">
                {[3, 5, 10, 20].map((v) => <option key={v} value={v}>{v} ruedas</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="gx-chips">
        <span className="gx-chips-lbl">Posiciones</span>
        {targets.map((t, i) => {
          const on = !ocultas.has(t.serieId);
          const vencida = estaVencida(t, hoyISO);
          return (
            <button key={t.serieId} type="button" className="gx-chip" aria-pressed={on}
              style={{ ["--c" as string]: posColor(i) }}
              title={vencida ? `${t.posicion}: posición vencida — la línea corta en su vencimiento` : undefined}
              onClick={() => setOcultas((prev) => {
                const n = new Set(prev);
                if (n.has(t.serieId)) n.delete(t.serieId); else n.add(t.serieId);
                return n;
              })}>
              <span className="sw" />{t.posicion}{vencida && <span className="dim"> (vencida)</span>}
            </button>
          );
        })}
        {targets.length > 0 && (
          <>
            <button type="button" className="gx-preset" onClick={() => setOcultas(new Set())}>Todas</button>
            <button type="button" className="gx-preset" onClick={() => setOcultas(new Set(targets.map((t) => t.serieId)))}>
              Ninguna
            </button>
          </>
        )}
      </div>

      <div className="gx-chart">
        {error ? (
          <div className="gx-empty">No se pudieron traer las series ({error}).</div>
        ) : lines.length === 0 ? (
          <div className="gx-empty">{cargando ? "Trayendo datos…" : "Elegí una base y un año con posiciones."}</div>
        ) : (
          <SpreadChart
            lines={lines}
            eje="cal"
            metric="spread"
            anchorMes={1}
            decimals={pct ? 1 : 2}
            modo="lineas"
            ma={maLines}
            pct={pct}
            exportName={nombreArchivo("periodo", grano, anio, baseFuente === "a3" ? baseMon : "pizarra")}
          />
        )}
      </div>

      <p className="gx-note">
        <b>{baseLabel}</b> menos cada posición de {GRANO_NOMBRE[grano] ?? grano}, en {anio}. Cada línea es el
        spread <b>base − posición</b> (positivo = la base por encima del futuro) y corre hasta donde esa
        posición cotiza (su vencimiento). Se muestran las dos cosechas que operan en el año; apagá las que
        no quieras con los chips. {lines.length > 0 && `Mostrando ${lines.length} de ${targets.length}.`}
      </p>
    </>
  );
}
