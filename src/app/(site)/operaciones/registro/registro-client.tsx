"use client";

import { useState } from "react";
import type { GranoCurva } from "@/lib/curva-types";
import { PRODUCTO_LABEL, GRANO_PRODUCTO, type Operacion, type OperacionLogEntry } from "@/lib/operaciones/tipos";
import type { PrecioResuelto } from "@/lib/operaciones/registro";
import { construirNetoDelDia } from "@/lib/operaciones/posicion";
import { matrizAColumnas, matrizAFilas, esFilaTotal, columnasSignoDe, COLUMNA_ESTADO } from "@/lib/operaciones/matriz-vista";
import { ChartTabla } from "@/components/chart-tabla";
import { FiltroGrano, type GranoFiltroValue } from "@/components/filtro-grano";
import { RegistroForm } from "./registro-form";
import { RegistroFila } from "./registro-fila";
import { FechaNav } from "./fecha-nav";
import { EmpresaSelector } from "../empresa-selector";

function descargarCsvDia(operaciones: Operacion[], fecha: string) {
  const cols = ["Lado", "Producto", "Tipo", "Condición", "Campaña", "Volumen (TN)", "Precio", "Moneda", "Entrega desde", "Entrega hasta", "Posición A3", "Contraparte", "N° Ctto", "Observaciones", "Anulada"];
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const filas = operaciones.map((o) => [
    o.lado, PRODUCTO_LABEL[o.producto], o.tipo, o.condicion ?? "", o.campania, o.volumen_tn,
    o.precio ?? "", o.moneda ?? "", o.entrega_desde ?? "", o.entrega_hasta ?? "", o.posicion_a3 ?? "",
    o.contraparte ?? "", o.nro_contrato ?? "", o.observaciones ?? "", o.anulada ? "sí" : "no",
  ]);
  const lineas = [cols.map(esc).join(","), ...filas.map((f) => f.map(esc).join(","))];
  const blob = new Blob(["﻿" + lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `registro-${fecha}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Registro diario (§5.6, docs/PLAN_OPERACIONES_CLIENTES.md §8): orquesta el
 * formulario de carga/edición, los listados de compras/ventas del día y el neto
 * del día. Todo el estado de interacción (qué operación se edita, filtro de
 * grano, mostrar anuladas) vive acá; los datos ya vienen resueltos del server.
 */
export function RegistroClient({
  empresaId,
  empresas,
  fecha,
  hoy,
  operaciones,
  historial,
  precios,
  curva,
  campanias,
}: {
  empresaId: string;
  empresas: { id: string; nombre: string }[] | null;
  fecha: string;
  hoy: string;
  operaciones: Operacion[];
  historial: Record<string, OperacionLogEntry[]>;
  precios: Record<string, PrecioResuelto>;
  curva: GranoCurva[];
  campanias: string[];
}) {
  const [filtro, setFiltro] = useState<GranoFiltroValue>("todos");
  const [editando, setEditando] = useState<Operacion | null>(null);
  const [mostrarAnuladas, setMostrarAnuladas] = useState(false);

  const visibles = filtro === "todos" ? operaciones : operaciones.filter((o) => GRANO_PRODUCTO[filtro] === o.producto);
  const compras = visibles.filter((o) => o.lado === "compra" && (mostrarAnuladas || !o.anulada));
  const ventas = visibles.filter((o) => o.lado === "venta" && (mostrarAnuladas || !o.anulada));
  const productoFiltro = filtro === "todos" ? undefined : GRANO_PRODUCTO[filtro];

  const neto = construirNetoDelDia(operaciones, hoy);

  return (
    <>
      <div className="op-controles">
        <FechaNav fecha={fecha} empresaId={empresas ? empresaId : undefined} />
        {empresas && <EmpresaSelector empresas={empresas} empresaId={empresaId} fecha={fecha} />}
      </div>
      <FiltroGrano value={filtro} onChange={setFiltro} />

      <RegistroForm
        key={editando?.id ?? "nueva"}
        empresaId={empresaId}
        fecha={fecha}
        campanias={campanias}
        curva={curva}
        operacion={editando}
        onDone={() => setEditando(null)}
      />

      <div className="op-listas-hd">
        <label className="op-check">
          <input type="checkbox" checked={mostrarAnuladas} onChange={(e) => setMostrarAnuladas(e.target.checked)} />
          Mostrar anuladas
        </label>
        <button type="button" className="admin-btn admin-btn-ghost" onClick={() => descargarCsvDia(visibles, fecha)}>
          ↓ CSV del día
        </button>
      </div>

      <div className="op-listas">
        <div className="op-lista-col">
          <h3 className="op-matriz-tit">Compras</h3>
          <ul className="op-lista">
            {compras.length === 0 && <li className="dim op-lista-vacia">Sin compras cargadas este día.</li>}
            {compras.map((o) => (
              <RegistroFila
                key={o.id}
                operacion={o}
                precio={precios[o.id]!}
                historial={historial[o.id] ?? []}
                onEditar={() => setEditando(o)}
              />
            ))}
          </ul>
        </div>
        <div className="op-lista-col">
          <h3 className="op-matriz-tit">Ventas</h3>
          <ul className="op-lista">
            {ventas.length === 0 && <li className="dim op-lista-vacia">Sin ventas cargadas este día.</li>}
            {ventas.map((o) => (
              <RegistroFila
                key={o.id}
                operacion={o}
                precio={precios[o.id]!}
                historial={historial[o.id] ?? []}
                onEditar={() => setEditando(o)}
              />
            ))}
          </ul>
        </div>
      </div>

      <h3 className="op-matriz-tit">Neto del día (físico)</h3>
      <ChartTabla
        columnas={matrizAColumnas(neto)}
        filas={matrizAFilas(neto, productoFiltro)}
        destacada={esFilaTotal}
        exportCsv={`neto-del-dia-${fecha}`}
        columnasSigno={columnasSignoDe(neto)}
        columnasEstado={COLUMNA_ESTADO}
      />
    </>
  );
}
