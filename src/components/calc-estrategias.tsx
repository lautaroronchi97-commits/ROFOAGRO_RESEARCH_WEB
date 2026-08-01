"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Panel, PanelHead } from "./panel";
import { RfChart } from "@/charts/RfChart";
import { paletteFor } from "@/charts/rofoTheme";
import { CurvaPicker } from "./curva-picker";
import { nfmt, sfmt } from "@/lib/format";
import {
  PRESETS,
  CATEGORIAS,
  payoffTotal,
  serieEscenarios,
  breakevens,
  costoEstrategia,
  describirPata,
  type Pata,
  type Tipo,
  type Lado,
  type Escenario,
  type Categoria,
} from "@/lib/estrategias";
import type { Persona } from "@/lib/costos";
import type { GranoCurva } from "@/lib/curva-types";

function IconStrat() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 11c2 0 3-6 5-6s2 3 4 3 3-2 3-2" />
      <path d="M2 13.5h12" />
    </svg>
  );
}

type PataStr = { tipo: Tipo; lado: Lado; cttos: string; strike: string; prima: string };
const num = (v: string) => { const n = Number(v.replace(",", ".")); return Number.isFinite(n) ? n : NaN; };
const toStr = (p: Pata): PataStr => ({ tipo: p.tipo, lado: p.lado, cttos: String(p.cttos), strike: String(p.strike), prima: String(p.prima) });
const toNum = (p: PataStr): Pata => ({
  tipo: p.tipo,
  lado: p.lado,
  cttos: Number.isFinite(num(p.cttos)) ? num(p.cttos) : 0,
  strike: num(p.strike),
  prima: p.tipo === "futuro" ? 0 : Number.isFinite(num(p.prima)) ? num(p.prima) : 0,
});

const PRESET0 = PRESETS.find((p) => p.id === "collar") ?? PRESETS[0]!; // catálogo hardcodeado (~27), nunca vacío
const CATS_TODAS: (Categoria | "Todas")[] = ["Todas", ...CATEGORIAS];

/** Glosario previo (relevamiento web R5, punto 45): qué es y para qué sirve cada estrategia,
 *  para leer ANTES de simular — agrupado por la misma categoría del selector de abajo. */
function Glosario() {
  return (
    <details className="strat-gloss">
      <summary>Glosario de estrategias — qué es y para qué sirve cada una</summary>
      <div className="strat-gloss-body">
        {CATEGORIAS.map((cat) => (
          <div className="strat-gloss-grp" key={cat}>
            <h4>{cat}</h4>
            <dl>
              {PRESETS.filter((p) => p.categoria === cat).map((p) => (
                <div className="strat-gloss-item" key={p.id}>
                  <dt>{p.nombre}</dt>
                  <dd>{p.explicacion}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </details>
  );
}

/**
 * Gráfico de payoff: resultado por tonelada vs precio final. Serie única → RfChart la
 * pinta en verde institucional; el precio base es una línea de referencia punteada
 * (`markLine`) y los breakeven son puntos de acento dorado sobre la curva (`markPoint`
 * — uso válido del dorado: es UN acento sobre una serie única, no una 2ª serie
 * compitiendo por atención). El eje Y siempre incluye el cero aunque toda la curva
 * quede de un solo lado (mismo criterio que la versión SVG: un payoff sin la línea de
 * cero a la vista no se puede leer).
 */
function PayoffChart({ serie, B, bes }: { serie: Escenario[]; B: number; bes: number[] }) {
  const { resolvedTheme } = useTheme();
  const p = paletteFor(resolvedTheme === "dark" ? "dark" : "light");
  if (serie.length < 2) return null;
  const xs = serie.map((s) => s.P);
  const loX = Math.min(...xs);
  const hiX = Math.max(...xs);
  const conBase = Number.isFinite(B) && B >= loX && B <= hiX;

  return (
    <RfChart
      ariaLabel="Gráfico de payoff de la estrategia: resultado por tonelada según el precio final"
      exportName="estrategia-payoff"
      xTitle="Precio final (USD)"
      yTitle="Resultado (USD/t)"
      height={260}
      valueFormatter={(v) => sfmt(v, 2)}
      option={{
        xAxis: { type: "value" },
        yAxis: {
          type: "value",
          min: (v: { min: number }) => Math.min(0, v.min),
          max: (v: { max: number }) => Math.max(0, v.max),
        },
        series: [
          {
            type: "line",
            symbol: "none",
            data: serie.map((s) => [s.P, s.resultado]),
            markLine: conBase
              ? {
                  silent: true,
                  symbol: "none",
                  lineStyle: { type: "dashed", color: p.ink3, width: 1 },
                  label: { show: false },
                  data: [{ xAxis: B }],
                }
              : undefined,
            markPoint: bes.length
              ? {
                  symbol: "circle",
                  symbolSize: 7,
                  itemStyle: { color: p.gold },
                  label: {
                    show: true,
                    position: "top",
                    color: p.ink3,
                    fontFamily: "var(--font-mono)",
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- coord no está tipado en MarkPointDataItemOption público
                    formatter: (pr: any) => nfmt(Number(pr.data.coord[0]), 0),
                  },
                  data: bes.map((be) => ({ name: "Breakeven", coord: [be, 0] })),
                }
              : undefined,
          },
        ],
      }}
    />
  );
}

export function CalcEstrategias({ granos = [] }: { granos?: GranoCurva[] }) {
  const [base, setBase] = React.useState("320");
  const [paso, setPaso] = React.useState("15");
  const [catFiltro, setCatFiltro] = React.useState<Categoria | "Todas">("Todas");
  const [estId, setEstId] = React.useState(PRESET0.id);
  const [patas, setPatas] = React.useState<PataStr[]>(() => PRESET0.patas(320, 15).map(toStr));
  const [conCostos, setConCostos] = React.useState(false);
  const [persona, setPersona] = React.useState<Persona>("juridica");
  const [iva, setIva] = React.useState("21");

  const B = num(base), S = num(paso);
  const preset = PRESETS.find((p) => p.id === estId);
  const presetsFiltrados = catFiltro === "Todas" ? PRESETS : PRESETS.filter((p) => p.categoria === catFiltro);

  const cambiar = (id: string) => {
    setEstId(id);
    const p = PRESETS.find((x) => x.id === id);
    if (p && Number.isFinite(B) && Number.isFinite(S)) setPatas(p.patas(B, S).map(toStr));
  };
  const elegirCategoria = (cat: Categoria | "Todas") => {
    setCatFiltro(cat);
    const lista = cat === "Todas" ? PRESETS : PRESETS.filter((p) => p.categoria === cat);
    if (!lista.some((p) => p.id === estId) && lista[0]) cambiar(lista[0].id);
  };
  const recargar = () => {
    if (preset && Number.isFinite(B) && Number.isFinite(S)) setPatas(preset.patas(B, S).map(toStr));
  };
  // Precio base sugerido de A3 (punto 45): al traer una posición real, las opciones
  // del preset elegido se rearman sobre ESE precio (no solo se actualiza el número).
  const traerDeA3 = (pos: { precio: number }) => {
    setBase(String(pos.precio));
    if (preset && Number.isFinite(S)) setPatas(preset.patas(pos.precio, S).map(toStr));
  };
  const setPata = (i: number, campo: keyof PataStr, val: string) =>
    setPatas((ps) => ps.map((p, j) => (j === i ? { ...p, [campo]: val } : p)));
  const agregar = () => setPatas((ps) => [...ps, { tipo: "call", lado: "compra", cttos: "1", strike: base, prima: "5" }]);
  const quitar = (i: number) => setPatas((ps) => ps.filter((_, j) => j !== i));

  const patasNum = patas.map(toNum).filter((p) => Number.isFinite(p.strike));
  const okRange = Number.isFinite(B) && Number.isFinite(S) && S > 0;
  // "Estrategia personalizada" (punto 45): las patas ya no coinciden con las que
  // generaría el preset elegido a este B/S — el usuario las tocó a mano.
  const personalizada =
    !!preset && okRange && JSON.stringify(patasNum) !== JSON.stringify(preset.patas(B, S));
  const ivaPct = num(iva);
  const costos = conCostos && Number.isFinite(ivaPct) ? costoEstrategia(patasNum, persona, ivaPct) : 0;
  const serieBruta = okRange && patasNum.length ? serieEscenarios(patasNum, B, S) : [];
  // Los costos son un cargo fijo (se pagan al operar, no dependen del precio final) — se
  // restan por igual a cada punto, mismo tratamiento que ya recibía la prima neta.
  const serie: Escenario[] = costos > 0 ? serieBruta.map((s) => ({ P: s.P, resultado: s.resultado - costos })) : serieBruta;
  const bes = breakevens(serie);
  const ys = serie.map((s) => s.resultado);
  // Extremos REALES, no los del borde del rango graficado (auditoría E2, 21/07/2026):
  // hacia abajo el extremo exacto es el payoff en P=0; hacia arriba, si la pendiente del
  // último tramo no es nula, la ganancia/pérdida sigue creciendo → "ilimitada".
  const EPS = 1e-9;
  const pendienteSup =
    ys.length >= 2 ? (ys[ys.length - 1] ?? 0) - (ys[ys.length - 2] ?? 0) : 0;
  const candidatos = ys.length ? [...ys, payoffTotal(0, patasNum) - costos] : [];
  const gananciaIlimitada = pendienteSup > EPS;
  const perdidaIlimitada = pendienteSup < -EPS;
  const maxG = candidatos.length ? Math.max(...candidatos) : NaN;
  const maxP = candidatos.length ? Math.min(...candidatos) : NaN;
  const neta = patasNum.reduce((a, p) => (p.tipo === "futuro" ? a : a + (p.lado === "compra" ? p.prima * p.cttos : -p.prima * p.cttos)), 0);
  const claves = Array.from(new Set([...patasNum.map((p) => p.strike), Number.isFinite(B) ? B : NaN]))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);

  return (
    <Panel id="calc-estrategias">
      <PanelHead glyph={<IconStrat />} title="Calculadora — estrategias con opciones" />

      <div className="calc">
        <Glosario />

        <div className="calc-field">
          <span>Categoría</span>
        </div>
        <div className="fg-bar" role="toolbar" aria-label="Categoría de estrategia">
          {CATS_TODAS.map((c) => (
            <button key={c} type="button" className="fg-chip" aria-pressed={catFiltro === c} onClick={() => elegirCategoria(c)}>
              {c}
            </button>
          ))}
        </div>

        <div className="calc-grid">
          <label className="calc-field">
            <span>Estrategia</span>
            <select value={estId} onChange={(e) => cambiar(e.target.value)}>
              {presetsFiltrados.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className="calc-field">
            <span>Precio base / ATM (USD)</span>
            <input inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} />
          </label>
          <label className="calc-field">
            <span>Paso entre strikes (USD)</span>
            <input inputMode="decimal" value={paso} onChange={(e) => setPaso(e.target.value)} />
          </label>
        </div>
        <CurvaPicker granos={granos} onPick={traerDeA3} label="Precio base sugerido de A3" />

        {preset && (
          <div className="strat-exp-main">
            <span className="k">{personalizada ? "Estrategia personalizada" : preset.view}</span>
            {personalizada
              ? "Modificaste las patas del preset — ya no es la combinación original, es tuya. El resumen y el gráfico de abajo reflejan exactamente lo que armaste."
              : preset.explicacion}
            {!personalizada && (
              <ul className="strat-implica">
                {preset.patas(Number.isFinite(B) ? B : 0, Number.isFinite(S) ? S : 1).map((p, i) => (
                  <li key={i}>{describirPata(p)}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="strat-exp">
          <span className="k">Primas estimativas</span> Las patas se precargan con primas estimadas (decaen con
          la distancia al ATM) para poder jugar rápido — cargá las primas reales de la cadena antes de cotizar.
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={conCostos} onChange={(e) => setConCostos(e.target.checked)} />
          <span>Incluir costos (A3/Cocos)</span>
        </label>
        <div className="calc-grid">
          {conCostos && (
            <>
              <label className="calc-field">
                <span>Tipo de cuenta</span>
                <select value={persona} onChange={(e) => setPersona(e.target.value as Persona)}>
                  <option value="humana">Persona humana</option>
                  <option value="juridica">Persona jurídica</option>
                </select>
              </label>
              <label className="calc-field">
                <span>IVA (%)</span>
                <input inputMode="decimal" value={iva} onChange={(e) => setIva(e.target.value)} />
              </label>
            </>
          )}
        </div>
        {conCostos && (
          <div className="strat-exp">
            <span className="k">Costos</span> Tarifario A3/Cocos (comisión + derechos + IVA, panel &quot;Costos de
            operar&quot;) sobre prima × cttos en opciones, strike × cttos en futuro — no hay tamaño de contrato por
            mercado todavía, así que se toma cttos como toneladas equivalentes, igual que el resto de esta calc. Se
            resta una sola vez (como la prima neta), no por cada punto del vencimiento.
          </div>
        )}

        <PayoffChart serie={serie} B={B} bes={bes} />

        <div className="strat-resumen">
          <div className="strat-resumen-item">
            <span className="strat-resumen-lbl">Máx. ganancia</span>
            <span className="strat-resumen-val pos">{gananciaIlimitada ? "ilimitada" : Number.isFinite(maxG) ? sfmt(maxG, 1) : "—"}</span>
          </div>
          <div className="strat-resumen-item">
            <span className="strat-resumen-lbl">Máx. pérdida</span>
            <span className="strat-resumen-val neg">{perdidaIlimitada ? "ilimitada" : Number.isFinite(maxP) ? sfmt(maxP, 1) : "—"}</span>
          </div>
          <div className="strat-resumen-item">
            <span className="strat-resumen-lbl">Prima neta</span>
            <span className="strat-resumen-val">{sfmt(neta, 1)} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-3)" }}>{neta > 0 ? "(costo)" : neta < 0 ? "(ingreso)" : ""}</span></span>
          </div>
          {conCostos && (
            <div className="strat-resumen-item">
              <span className="strat-resumen-lbl">Costos (A3/Cocos)</span>
              <span className="strat-resumen-val">{nfmt(costos, 1)}</span>
            </div>
          )}
          <div className="strat-resumen-item">
            <span className="strat-resumen-lbl">Breakeven(s)</span>
            <span className="strat-resumen-val">{bes.length ? bes.map((b) => nfmt(b, 1)).join(" · ") : "—"}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="tbl" style={{ minWidth: 540 }}>
            <thead>
              <tr>
                <th className="l" scope="col">Instrumento</th>
                <th className="l" scope="col">Lado</th>
                <th scope="col">Cttos</th>
                <th scope="col">Strike / entrada</th>
                <th scope="col">Prima</th>
                <th scope="col" aria-label="quitar" />
              </tr>
            </thead>
            <tbody>
              {patas.map((p, i) => (
                <tr key={i}>
                  <td className="l">
                    <select className="cell-in" value={p.tipo} onChange={(e) => setPata(i, "tipo", e.target.value)}>
                      <option value="futuro">Futuro</option><option value="call">Call</option><option value="put">Put</option>
                    </select>
                  </td>
                  <td className="l">
                    <select className="cell-in" value={p.lado} onChange={(e) => setPata(i, "lado", e.target.value)}>
                      <option value="compra">Compra</option><option value="venta">Venta</option>
                    </select>
                  </td>
                  <td><input className="cell-in num" inputMode="numeric" value={p.cttos} onChange={(e) => setPata(i, "cttos", e.target.value)} /></td>
                  <td><input className="cell-in num" inputMode="decimal" value={p.strike} onChange={(e) => setPata(i, "strike", e.target.value)} /></td>
                  <td><input className="cell-in num" inputMode="decimal" value={p.prima} disabled={p.tipo === "futuro"} onChange={(e) => setPata(i, "prima", e.target.value)} /></td>
                  <td><button type="button" className="cell-del" onClick={() => quitar(i)} aria-label="Quitar pata">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="calc-btns">
          <button type="button" className="calc-add" onClick={agregar}>+ pata</button>
          <button type="button" className="calc-add" onClick={recargar}>↺ recargar preset</button>
        </div>

        <div className="table-scroll">
          <table className="tbl" style={{ minWidth: 340 }}>
            <thead><tr><th className="l" scope="col">Precio final</th><th scope="col">Resultado</th></tr></thead>
            <tbody>
              {claves.map((P) => {
                const r = payoffTotal(P, patasNum) - costos;
                return (
                  <tr key={P}>
                    <td className="l sym">{nfmt(P, 1)}</td>
                    <td className={r > 0 ? "pos" : r < 0 ? "neg" : "neu2"}>{sfmt(r, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel-note">
        <span>
          <span className="k">Payoff</span> Resultado por tonelada al vencimiento = suma de las patas (futuro +
          calls + puts). Elegí una estrategia del menú (se precarga con strikes al paso elegido) y ajustá las
          patas a mano. La línea punteada es el precio base; los puntos, los breakeven. Catálogo y fórmulas en
          <code> docs/ESTRATEGIAS_CATALOGO.md</code>.
        </span>
      </div>
    </Panel>
  );
}
