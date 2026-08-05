"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { RangoChips } from "@/components/rango-chips";
import type { Heatmap as HeatmapData } from "@/lib/operaciones/posicion";
import { PRODUCTO_LABEL, type OperacionProducto } from "@/lib/operaciones/tipos";

/**
 * Heatmap comprado/vendido (§1.23/§5.6 item 5, Fase 2 —
 * docs/PLAN_OPERACIONES_CLIENTES.md): calendario producto × día, verde =
 * neto comprado / rojo = neto vendido / gris = sin movimientos, con la
 * intensidad relativa al mayor volumen visible en la ventana elegida.
 *
 * Decisión de diseño (documentada según pide el prompt de Fase 2): celdas
 * HTML/CSS en vez del motor ECharts (`RfChart`) — es una grilla chica (5
 * productos × ≤60 días) con navegación por click a `/operaciones/registro`,
 * más simple y liviana como enlaces reales que como un chart interactivo; el
 * motor ECharts se reserva para series numéricas con tooltip/zoom, que acá no
 * hacen falta.
 *
 * El heatmap se calcula UNA sola vez en el server con la ventana máxima (60
 * días, `construirHeatmap(...,60)`) — el selector de ventana acá abajo solo
 * recorta `dias` client-side (`.slice(-n)`), sin volver a pedirle nada al
 * servidor.
 */

const VENTANAS: { label: string; value: "14" | "30" | "60" }[] = [
  { label: "14 días", value: "14" },
  { label: "30 días", value: "30" },
  { label: "60 días", value: "60" },
];

function fechaCorta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function fmtTn(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function descargarCsvHeatmap(dias: string[], filas: HeatmapData["filas"]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cols = ["Producto", ...dias];
  const rows = filas.map((f) => [PRODUCTO_LABEL[f.producto], ...dias.map((d) => f.porDia[d] ?? 0)]);
  const lineas = [cols.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  const blob = new Blob(["﻿" + lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "heatmap-comprado-vendido.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function PosicionHeatmap({
  heatmap,
  productoFiltro,
  empresaId,
  esAdmin,
}: {
  heatmap: HeatmapData;
  productoFiltro?: OperacionProducto;
  empresaId: string;
  esAdmin: boolean;
}) {
  const [ventana, setVentana] = useState<"14" | "30" | "60">("30");
  const dias = heatmap.dias.slice(-Number(ventana));
  const filas = productoFiltro ? heatmap.filas.filter((f) => f.producto === productoFiltro) : heatmap.filas;

  const maxAbs = useMemo(() => {
    let m = 0;
    for (const f of filas) for (const d of dias) m = Math.max(m, Math.abs(f.porDia[d] ?? 0));
    return m || 1;
  }, [filas, dias]);

  return (
    <div className="op-heatmap-wrap">
      <div className="op-heatmap-hd">
        <RangoChips opciones={VENTANAS} valor={ventana} onChange={setVentana} label="Ventana del heatmap" />
        <button type="button" className="admin-btn admin-btn-ghost" onClick={() => descargarCsvHeatmap(dias, filas)}>
          ↓ CSV
        </button>
      </div>
      <div className="op-heatmap-scroll" tabIndex={0}>
        <div className="op-heatmap-grid" style={{ gridTemplateColumns: `88px repeat(${dias.length}, minmax(16px, 1fr))` }}>
          <div className="op-heatmap-cell op-heatmap-corner" />
          {dias.map((d) => (
            <div key={d} className="op-heatmap-cell op-heatmap-dia">
              {fechaCorta(d)}
            </div>
          ))}
          {filas.map((f) => (
            <Fragment key={f.producto}>
              <div className="op-heatmap-cell op-heatmap-label">{PRODUCTO_LABEL[f.producto]}</div>
              {dias.map((d) => {
                const v = f.porDia[d] ?? 0;
                const intensidad = v === 0 ? 0 : Math.max(0.22, Math.min(1, Math.abs(v) / maxAbs));
                const clase = v > 0 ? "op-hm-pos" : v < 0 ? "op-hm-neg" : "op-hm-neu";
                const href = `/operaciones/registro?fecha=${d}${esAdmin ? `&empresa=${empresaId}` : ""}`;
                const desc =
                  v === 0
                    ? "sin movimientos"
                    : `${v > 0 ? "comprado" : "vendido"} ${fmtTn(Math.abs(v))} tn neto`;
                return (
                  <Link
                    key={d}
                    href={href}
                    className={`op-heatmap-cell op-hm-celda ${clase}`}
                    style={v !== 0 ? { opacity: intensidad } : undefined}
                    aria-label={`${fechaCorta(d)} · ${PRODUCTO_LABEL[f.producto]}: ${desc}. Ir al registro de ese día.`}
                    title={`${fechaCorta(d)} · ${PRODUCTO_LABEL[f.producto]}: ${desc}`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <p className="dim op-heatmap-nota">
        Verde = comprado neto del día · Rojo = vendido neto del día (más intenso = más volumen) · gris = sin
        movimientos. Solo físico (disponible + forward). Click en una celda para ir al registro de ese día.
      </p>
    </div>
  );
}
