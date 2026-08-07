"use client";

import { useMemo, useState } from "react";
import { nfmt, sfmt } from "@/lib/format";
import { DISPLAY_NEGOCIADO, PRODUCTOS_NEGOCIADO } from "@/lib/compras/negociado-productos";
import type { FilaSector } from "@/lib/compras/negociado";

/**
 * Tabla del negociado por producto (campaña activa + otras campañas con movimiento).
 * Filtro por sector (Todos / Exportación / Industria) y export CSV. Client: la
 * agregación por (producto, campaña) se rehace en el navegador según el filtro.
 *
 * % sobre cosecha: sale de la matview `compras_avance_hist` (suma sectores + limpieza
 * monótona + producción USDA AR) → solo aplica con el filtro "Todos"; filtrado por
 * sector se muestra "—" (no hay producción por sector).
 */

type Agregada = {
  cod: string;
  display: string;
  campana: string;
  activa: boolean;
  fecha: string;
  semanal: number | null;
  delta: number | null;
  acumulado: number | null;
  pctCosecha: number | null;
  pctPriceado: number | null;
  saldoAFijar: number | null;
};

function sumar(vals: (number | null)[]): number | null {
  let acc: number | null = null;
  for (const v of vals) if (v != null) acc = (acc ?? 0) + v;
  return acc;
}

export function NegociadoTabla({ filas, avance, fecha }: { filas: FilaSector[]; avance: Record<string, number>; fecha: string | null }) {
  const [sector, setSector] = useState("todos");
  const [producto, setProducto] = useState("todos");
  const [soloActiva, setSoloActiva] = useState(false);

  const agregadas = useMemo<Agregada[]>(() => {
    const filtradas = filas
      .filter((f) => sector === "todos" || f.sector === sector)
      .filter((f) => producto === "todos" || f.cod === producto)
      .filter((f) => !soloActiva || f.activa);
    const porClave = new Map<string, FilaSector[]>();
    for (const f of filtradas) {
      const k = `${f.cod}|${f.campana}`;
      if (!porClave.has(k)) porClave.set(k, []);
      porClave.get(k)!.push(f);
    }
    const out: Agregada[] = [];
    for (const [k, grupo] of porClave) {
      const base = grupo[0]!; // cada clave de porClave se creó con al menos 1 push, nunca vacío
      const semanal = sumar(grupo.map((g) => g.semanal));
      const semanalPrev = sumar(grupo.map((g) => g.semanalPrev));
      const acumulado = sumar(grupo.map((g) => g.acumulado));
      const priceado = sumar(grupo.map((g) => sumar([g.precioHecho, g.fijado])));
      out.push({
        cod: base.cod,
        display: base.display,
        campana: base.campana,
        activa: base.activa,
        fecha: base.fecha,
        semanal,
        delta: semanal != null && semanalPrev != null ? semanal - semanalPrev : null,
        acumulado,
        pctCosecha: sector === "todos" ? (avance[k] != null ? avance[k] * 100 : null) : null,
        pctPriceado: acumulado != null && acumulado > 0 && priceado != null ? (priceado / acumulado) * 100 : null,
        saldoAFijar: sumar(grupo.map((g) => g.saldoAFijar)),
      });
    }
    // Orden feedback 07/08/2026: "del dato más reciente al último" — fecha desc primero
    // (antes se preservaba el orden del server: producto → activa → campaña asc).
    return out.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.campana.localeCompare(a.campana));
  }, [filas, avance, sector, producto, soloActiva]);

  function exportarCsv() {
    const cols = ["Producto", "Campana", "Activa", "Ultimo_dato", "Semanal_t", "Delta_sem_t", "Acumulado_t", "Pct_cosecha", "Pct_priceado", "Saldo_a_fijar_t"];
    const esc = (v: string | number | null) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lineas = [
      cols.join(","),
      ...agregadas.map((a) =>
        [a.display, a.campana, a.activa ? "si" : "no", a.fecha,
         a.semanal != null ? Math.round(a.semanal) : "", a.delta != null ? Math.round(a.delta) : "",
         a.acumulado != null ? Math.round(a.acumulado) : "",
         a.pctCosecha != null ? a.pctCosecha.toFixed(1) : "", a.pctPriceado != null ? a.pctPriceado.toFixed(1) : "",
         a.saldoAFijar != null ? Math.round(a.saldoAFijar) : ""].map(esc).join(","),
      ),
    ];
    const blob = new Blob(["﻿" + lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `negociado-productos-${fecha ?? "hoy"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="lu-tabla">
      <div className="lu-filtros">
        <label className="lu-field">
          <span>Producto</span>
          <select value={producto} onChange={(e) => setProducto(e.target.value)}>
            <option value="todos">Todos</option>
            {PRODUCTOS_NEGOCIADO.map((cod) => (
              <option key={cod} value={cod}>{DISPLAY_NEGOCIADO[cod]}</option>
            ))}
          </select>
        </label>
        <label className="lu-field">
          <span>Sector</span>
          <select value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="EXPORTACION">Exportación</option>
            <option value="INDUSTRIA">Industria</option>
          </select>
        </label>
        <label className="lu-field lu-check">
          <input type="checkbox" checked={soloActiva} onChange={(e) => setSoloActiva(e.target.checked)} />
          <span>Solo campaña activa</span>
        </label>
        <span className="lu-grow" />
        <button type="button" className="lu-csv" onClick={exportarCsv} disabled={agregadas.length === 0}>↓ CSV</button>
      </div>

      <div className="lu-cuenta">
        {agregadas.length} {agregadas.length === 1 ? "campaña con movimiento" : "campañas con movimiento"}
      </div>

      <div className="table-scroll">
        <table className="tbl" style={{ minWidth: 780 }}>
          <thead>
            <tr>
              <th className="l" scope="col">Producto</th>
              <th className="l" scope="col">Campaña</th>
              <th className="l" scope="col" title="Fecha del último dato disponible">Fecha</th>
              <th scope="col" title="Compras de la última semana disponible">Semanal t</th>
              <th scope="col" title="Contra la semana anterior">Δ sem.</th>
              <th scope="col" title="Total comprado acumulado de la campaña">Acumulado t</th>
              <th scope="col" title="Acumulado / producción USDA Argentina (solo con filtro Todos)">% cosecha</th>
              <th scope="col" title="(Precio hecho + fijado) / acumulado">% priceado</th>
              <th scope="col" title="A fijar aún sin precio">Saldo a fijar t</th>
            </tr>
          </thead>
          <tbody>
            {agregadas.map((a) => (
              <tr key={`${a.cod}|${a.campana}`}>
                <td className="l sym">{a.display}</td>
                <td className="l">
                  {a.campana}
                  {a.activa && <span className="ng-activa" title="Campaña activa: la de mayor venta semanal">activa</span>}
                </td>
                <td className="l dim">{a.fecha ? `${a.fecha.slice(8, 10)}/${a.fecha.slice(5, 7)}` : "—"}</td>
                <td>{a.semanal == null ? "—" : nfmt(a.semanal, 0)}</td>
                <td className={a.delta == null ? "dim" : a.delta > 0 ? "pos" : a.delta < 0 ? "neg" : "dim"}>
                  {a.delta == null ? "—" : sfmt(a.delta, 0)}
                </td>
                <td>{a.acumulado == null ? "—" : nfmt(a.acumulado, 0)}</td>
                <td className="lu-mono">{a.pctCosecha == null ? "—" : `${nfmt(a.pctCosecha, 1)}%`}</td>
                <td className="lu-mono">{a.pctPriceado == null ? "—" : `${nfmt(a.pctPriceado, 1)}%`}</td>
                <td>{a.saldoAFijar == null ? "—" : nfmt(a.saldoAFijar, 0)}</td>
              </tr>
            ))}
            {agregadas.length === 0 && (
              <tr><td className="l dim" colSpan={9}>Sin datos para este filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
