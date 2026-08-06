"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { GranoCurva } from "@/lib/curva-types";
import { PRODUCTO_LABEL, GRANO_PRODUCTO, type Operacion, type OperacionLogEntry } from "@/lib/operaciones/tipos";
import type { PrecioResuelto } from "@/lib/operaciones/registro";
import { FiltroGrano, type GranoFiltroValue } from "@/components/filtro-grano";
import { RegistroForm } from "./registro-form";
import { RegistroFila } from "./registro-fila";
import { FechaNav } from "./fecha-nav";
import { EmpresaSelector } from "../empresa-selector";

function descargarCsvDia(operaciones: Operacion[], fecha: string) {
  const cols = ["Lado", "Producto", "Tipo", "Condición", "Campaña", "Volumen (TN)", "Precio", "Moneda", "Entrega desde", "Entrega hasta", "Fijación desde", "Fijación hasta", "Posición A3", "Canje", "Contraparte", "N° Ctto", "Observaciones", "Anulada"];
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const filas = operaciones.map((o) => [
    o.lado, PRODUCTO_LABEL[o.producto], o.tipo, o.condicion ?? "", o.campania, o.volumen_tn,
    o.precio ?? "", o.moneda ?? "", o.entrega_desde ?? "", o.entrega_hasta ?? "",
    o.fijacion_desde ?? "", o.fijacion_hasta ?? "", o.posicion_a3 ?? "", o.es_canje ? "sí" : "no",
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
 * Carga de negocios (§5.6, docs/PLAN_OPERACIONES_CLIENTES.md §8 — renombrada de
 * "Registro diario" 06/08/2026, vuelta 4): orquesta el
 * formulario de carga/edición y los listados de compras/ventas del día — solo
 * lo que se va realizando, sin tablas de posición (pedido de Lautaro
 * 06/08/2026: el neto/posición vive en /operaciones, acá se CARGA). Todo el
 * estado de interacción (qué operación se edita/duplica, filtro de grano,
 * mostrar anuladas) vive acá; los datos ya vienen resueltos del server.
 */
export function RegistroClient({
  empresaId,
  empresas,
  fecha,
  operaciones,
  historial,
  precios,
  curva,
  campanias,
}: {
  empresaId: string;
  empresas: { id: string; nombre: string }[] | null;
  fecha: string;
  operaciones: Operacion[];
  historial: Record<string, OperacionLogEntry[]>;
  precios: Record<string, PrecioResuelto>;
  curva: GranoCurva[];
  campanias: string[];
}) {
  const [filtro, setFiltro] = useState<GranoFiltroValue>("todos");
  const [editando, setEditando] = useState<Operacion | null>(null);
  const [plantilla, setPlantilla] = useState<Operacion | null>(null);
  const [mostrarAnuladas, setMostrarAnuladas] = useState(false);
  const formWrapRef = useRef<HTMLDivElement>(null);

  const visibles = filtro === "todos" ? operaciones : operaciones.filter((o) => GRANO_PRODUCTO[filtro] === o.producto);
  const compras = visibles.filter((o) => o.lado === "compra" && (mostrarAnuladas || !o.anulada));
  const ventas = visibles.filter((o) => o.lado === "venta" && (mostrarAnuladas || !o.anulada));

  // Editar y duplicar arrancan desde una fila de las listas de abajo, pero el
  // formulario vive arriba — sin este scroll el click parecía no hacer nada.
  function irAlForm() {
    formWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function editar(o: Operacion) {
    setPlantilla(null);
    setEditando(o);
    irAlForm();
  }
  function duplicar(o: Operacion) {
    setEditando(null);
    setPlantilla(o);
    irAlForm();
  }

  return (
    <>
      <div className="op-controles">
        <FechaNav fecha={fecha} empresaId={empresas ? empresaId : undefined} />
        {empresas && <EmpresaSelector empresas={empresas} empresaId={empresaId} fecha={fecha} />}
        <Link href={empresas ? `/operaciones?empresa=${empresaId}` : "/operaciones"} className="op-nav-link">
          Ver mi posición →
        </Link>
      </div>
      <FiltroGrano value={filtro} onChange={setFiltro} />

      <div ref={formWrapRef}>
        <RegistroForm
          key={editando?.id ?? (plantilla ? `dup-${plantilla.id}` : "nueva")}
          empresaId={empresaId}
          fecha={fecha}
          campanias={campanias}
          curva={curva}
          operacion={editando}
          plantilla={plantilla}
          onDone={() => {
            setEditando(null);
            setPlantilla(null);
          }}
        />
      </div>

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
                onEditar={() => editar(o)}
                onDuplicar={() => duplicar(o)}
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
                onEditar={() => editar(o)}
                onDuplicar={() => duplicar(o)}
              />
            ))}
          </ul>
        </div>
      </div>

    </>
  );
}
