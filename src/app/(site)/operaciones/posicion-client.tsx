"use client";

import { useState } from "react";
import { ChartTabla } from "@/components/chart-tabla";
import { FiltroGrano, type GranoFiltroValue } from "@/components/filtro-grano";
import type { Matriz } from "@/lib/operaciones/posicion";
import { matrizAColumnas, matrizAFilas, esFilaTotal } from "@/lib/operaciones/matriz-vista";
import { GRANO_PRODUCTO } from "@/lib/operaciones/tipos";
import { EmpresaSelector } from "./empresa-selector";

/**
 * "Mi posición" — Fase 1 mínima (docs/PLAN_OPERACIONES_CLIENTES.md §8 item 6):
 * las 3 matrices producto × período (Físico, Futuros, Total). El heatmap, la
 * posición-a-fecha y el panel de futuros valorizado quedan para la Fase 2.
 */
export function PosicionClient({
  empresaId,
  empresas,
  fisico,
  futuros,
  total,
}: {
  empresaId: string;
  empresas: { id: string; nombre: string }[] | null;
  fisico: Matriz;
  futuros: Matriz;
  total: Matriz;
}) {
  const [filtro, setFiltro] = useState<GranoFiltroValue>("todos");
  const productoFiltro = filtro === "todos" ? undefined : GRANO_PRODUCTO[filtro];

  return (
    <>
      {empresas && (
        <div className="op-controles">
          <EmpresaSelector empresas={empresas} empresaId={empresaId} />
        </div>
      )}
      <FiltroGrano value={filtro} onChange={setFiltro} />

      <h3 className="op-matriz-tit">Físico (disponible + forward)</h3>
      <ChartTabla
        columnas={matrizAColumnas(fisico)}
        filas={matrizAFilas(fisico, productoFiltro)}
        destacada={esFilaTotal}
        exportCsv="mi-posicion-fisico"
      />

      <h3 className="op-matriz-tit">Futuros A3</h3>
      <ChartTabla
        columnas={matrizAColumnas(futuros)}
        filas={matrizAFilas(futuros, productoFiltro)}
        destacada={esFilaTotal}
        exportCsv="mi-posicion-futuros"
      />

      <h3 className="op-matriz-tit">Total (físico + futuros)</h3>
      <ChartTabla
        columnas={matrizAColumnas(total)}
        filas={matrizAFilas(total, productoFiltro)}
        destacada={esFilaTotal}
        exportCsv="mi-posicion-total"
      />
    </>
  );
}
