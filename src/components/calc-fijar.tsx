"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Panel, PanelHead } from "./panel";
import { RfChart } from "@/charts/RfChart";
import { paletteFor } from "@/charts/rofoTheme";
import { sfmt, rfmt, nfmt, numDeInput as num } from "@/lib/format";
import { evaluarFijar, type Lado, type FilaFijar } from "@/lib/fijar";
import { hoyCordoba, parseYmd } from "@/lib/habiles";
import { posicionDeFecha, hoyVencKey } from "@/lib/dates";
import { posicionesCanonicasVivas, precioFuturoConVivo, type PuntasVivo } from "@/lib/fijar-canon";
import { PickerPizarra } from "./precio-dual";
import { usePrecioDual, type GranoPizarraDual } from "./use-precio-dual";
import type { GranoCurva } from "@/lib/curva-types";

function IconFijar() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 13h12" />
      <path d="M4 13V8M7 13V5M10 13V9M13 13V6" />
    </svg>
  );
}

function mesCorto(iso: string): string {
  if (!/^\d{4}-\d{2}/.test(iso)) return iso || "—";
  return posicionDeFecha(iso);
}

type FilaCurva = { vto: string; precio: string; estimado: boolean };

/**
 * Gráfico COMBINADO delta (barras verde/roja, eje izq. USD) + TNA implícita
 * (línea dorada, eje der. %) por plazo — mismo patrón de "1 acento + contexto"
 * que `DolarOficialSemanalChart` (bar=contexto pos/neg · line=la curva
 * principal, por eso el dorado acá SÍ es válido — no es 2 series categóricas
 * compitiendo por atención). Labels siempre visibles (no solo al hover): son
 * pocos puntos (4-6 posiciones, uso de calculadora) y el pedido original era
 * poder comparar todas de un vistazo.
 */
function DeltaTnaChart({ filas }: { filas: FilaFijar[] }) {
  const { resolvedTheme } = useTheme();
  const p = paletteFor(resolvedTheme === "dark" ? "dark" : "light");
  if (filas.length === 0) return null;

  return (
    <RfChart
      ariaLabel="Gráfico combinado: delta por plazo y curva de TNA implícita"
      exportName="fijar-delta-tna"
      xTitle="Vencimiento"
      yTitle={["Delta (USD)", "TNA implícita (%)"]}
      watermarkSize="chico"
      height={300}
      valueFormatter={(v, name) => (name === "TNA implícita (%)" ? rfmt(v, 1) : sfmt(v, 1))}
      option={{
        xAxis: { type: "category", data: filas.map((f) => mesCorto(f.vto)) },
        yAxis: [{ type: "value" }, { type: "value", scale: true }],
        series: [
          {
            name: "Delta (USD)",
            type: "bar",
            yAxisIndex: 0,
            // itemStyle a nivel serie: SOLO decide el swatch de la leyenda (cada barra ya
            // trae su propio itemStyle pos/neg abajo, que siempre gana) — sin esto ECharts
            // le asigna el próximo color de la paleta categórica, que no dice nada de un
            // bar pos/neg.
            itemStyle: { color: p.pos },
            data: filas.map((f) => ({
              value: f.delta,
              itemStyle: { color: f.delta >= 0 ? p.pos : p.neg, opacity: 0.85 },
              label: { show: true, position: f.delta >= 0 ? "top" : "bottom", formatter: () => sfmt(f.delta, 1) },
            })),
          },
          {
            name: "TNA implícita (%)",
            type: "line",
            yAxisIndex: 1,
            symbolSize: 7,
            connectNulls: true,
            itemStyle: { color: p.goldText },
            lineStyle: { color: p.goldText, width: 2.5 },
            label: {
              show: true,
              position: "top",
              fontWeight: 700,
              color: p.goldText,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CallbackDataParams tipa `value` como unión amplia sin discriminar por eje
              formatter: (pr: any) => rfmt(Number(pr.value), 1),
            },
            data: filas.map((f) => (Number.isFinite(f.tna) ? f.tna : null)),
          },
        ],
      }}
    />
  );
}

export function CalcFijar({
  granos = [],
  pizarraDual = [],
  tcBna = null,
  live = {},
}: {
  granos?: GranoCurva[];
  pizarraDual?: GranoPizarraDual[];
  tcBna?: number | null;
  live?: Record<string, PuntasVivo>;
}) {
  const pd = usePrecioDual(tcBna);
  const [lado, setLado] = React.useState<Lado>("compro");
  const [tasa, setTasa] = React.useState("10");
  const [curva, setCurva] = React.useState<FilaCurva[]>([]);

  const elegirGrano = (g: GranoPizarraDual) => {
    pd.elegir(g);
    const grano = granos.find((x) => x.underlying === g.underlying);
    if (!grano) return;
    const canonicas = posicionesCanonicasVivas(g.underlying, grano.posiciones, hoyVencKey());
    setCurva(
      canonicas.map((p) => {
        const { precio, estimado } = precioFuturoConVivo(p.precio, live[p.symbol]);
        return { vto: p.vto, precio: String(precio), estimado };
      }),
    );
  };

  const setFila = (i: number, campo: "vto" | "precio", val: string) =>
    setCurva((c) => c.map((f, j) => (j === i ? { ...f, [campo]: val, ...(campo === "precio" ? { estimado: false } : {}) } : f)));
  const agregar = () => setCurva((c) => [...c, { vto: "", precio: "", estimado: false }]);
  const quitar = (i: number) => setCurva((c) => c.filter((_, j) => j !== i));

  const disponible = num(pd.usd);
  const tasaComp = num(tasa);
  const hoyMs = parseYmd(hoyCordoba()).getTime();
  const vtoMs = (vto: string) => (vto ? parseYmd(vto).getTime() : null);

  // Fila alineada a cada renglón de la curva (null si el renglón es inválido).
  const filas = curva.map((f) => {
    const precio = num(f.precio);
    if (!f.vto || !Number.isFinite(precio) || precio <= 0) return null;
    const [r] = evaluarFijar(disponible, lado, tasaComp, [{ vto: f.vto, precio }], hoyMs, vtoMs);
    return r ?? null;
  });
  const validas = filas.filter((f): f is FilaFijar => f !== null);

  return (
    <Panel id="calc-fijar">
      <PanelHead glyph={<IconFijar />} title="Cotizador — negocios a fijar" sub="Delta disponible vs curva de futuros" />

      <div className="calc">
        <PickerPizarra granos={pizarraDual} onPick={elegirGrano} label="Grano (disponible + curva canónica)" />
        <div className="calc-grid">
          <label className="calc-field">
            <span>Disponible (USD)</span>
            <span className="cell-wrap">
              <input inputMode="decimal" className={pd.editado ? "manual" : ""} value={pd.usd} onChange={(e) => pd.setUsd(e.target.value)} />
              {pd.editado && <button type="button" className="pz-reset" title="Volver a la pizarra" onClick={pd.reset}>↺</button>}
            </span>
          </label>
          <label className="calc-field">
            <span>Disponible (ARS)</span>
            <input inputMode="decimal" className={pd.editado ? "manual" : ""} value={pd.ars} onChange={(e) => pd.setArs(e.target.value)}
              disabled={pd.tc == null} title={pd.tc == null ? "Sin tipo de cambio del día para convertir" : undefined} />
          </label>
          <label className="calc-field">
            <span>Negocio</span>
            <select value={lado} onChange={(e) => setLado(e.target.value as Lado)}>
              <option value="compro">Compro a fijar</option>
              <option value="vendo">Vendo a fijar</option>
            </select>
          </label>
          <label className="calc-field">
            <span>Tasa comparación (TNA %)</span>
            <input inputMode="decimal" value={tasa} onChange={(e) => setTasa(e.target.value)} />
          </label>
        </div>

        <DeltaTnaChart filas={validas} />

        <div className="table-scroll">
          <table className="tbl" style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th className="l" scope="col">Vencimiento</th>
                <th scope="col">Futuro</th>
                <th scope="col">Días</th>
                <th scope="col">Delta</th>
                <th scope="col">TNA impl.</th>
                <th scope="col">Resultado</th>
                <th scope="col">Precio a tu tasa</th>
                <th scope="col" aria-label="quitar" />
              </tr>
            </thead>
            <tbody>
              {curva.map((f, i) => {
                const r = filas[i];
                const bateTasa = r && Number.isFinite(r.tna) && r.tna > tasaComp;
                return (
                  <tr key={i}>
                    <td className="l">
                      <input className="cell-in" type="date" value={f.vto} onChange={(e) => setFila(i, "vto", e.target.value)} />
                    </td>
                    <td>
                      <span className="cell-wrap">
                        <input className="cell-in num" inputMode="decimal" value={f.precio} onChange={(e) => setFila(i, "precio", e.target.value)} />
                        {f.estimado && (
                          <span className="pz-estim" title="A3 todavía no operó esta posición hoy: es el promedio comprador/vendedor en vivo, no un precio operado.">
                            estimado
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="dim">{r ? r.dias : "—"}</td>
                    <td className="dim">{r ? sfmt(r.delta, 2) : "—"}</td>
                    <td className={bateTasa ? "pos" : "dim"}>{r ? rfmt(r.tna, 1) : "—"}</td>
                    <td className={r ? (r.favorable ? "pos" : "neg") : "dim"}>{r ? sfmt(r.resultado, 2) : "—"}</td>
                    <td className="dim">{r && Number.isFinite(r.precioTasa) ? nfmt(r.precioTasa, 2) : "—"}</td>
                    <td>
                      <button type="button" className="cell-del" onClick={() => quitar(i)} aria-label="Quitar posición">×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className="calc-add" onClick={agregar}>+ posición</button>
      </div>

      <div className="panel-note">
        <span>
          <span className="k">A fijar</span> Delta = disponible − futuro (sin costo de oportunidad) · TNA impl. =
          (futuro/disponible − 1) × 365/días · Resultado = compro a fijar → futuro − disponible; vendo a fijar →
          disponible − futuro (verde = a favor). <b>Comparador</b>: la TNA impl. se pinta verde cuando supera tu
          tasa; «Precio a tu tasa» = futuro teórico si el carry rindiera exactamente esa tasa. Al elegir un grano
          se cargan sus posiciones canónicas con el precio en vivo de A3 (o el promedio comprador/vendedor,
          marcado «estimado», si todavía no operó); podés editar cualquier campo o agregar posiciones sueltas.
          Toma el precio de <b>futuros</b>, que puede diferir del spot al fijar (riesgo de base).
        </span>
      </div>
    </Panel>
  );
}
