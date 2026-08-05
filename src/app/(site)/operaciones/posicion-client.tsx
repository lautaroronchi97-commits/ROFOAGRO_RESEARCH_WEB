"use client";

import { useState } from "react";
import { ChartTabla } from "@/components/chart-tabla";
import { FiltroGrano, type GranoFiltroValue } from "@/components/filtro-grano";
import type { Heatmap, Matriz } from "@/lib/operaciones/posicion";
import { matrizAColumnas, matrizAFilas, esFilaTotal, columnasSignoDe, COLUMNA_ESTADO } from "@/lib/operaciones/matriz-vista";
import type { FuturoValorizado } from "@/lib/operaciones/futuros-valorizados";
import { GRANO_PRODUCTO } from "@/lib/operaciones/tipos";
import { EmpresaSelector } from "./empresa-selector";
import { PosicionFecha } from "./posicion-fecha";
import { PosicionHeatmap } from "./heatmap";
import { FuturosValorizadosPanel } from "./futuros-panel";

/**
 * "Mi posición" — Fase 2 completa (docs/PLAN_OPERACIONES_CLIENTES.md §5.6):
 * las 3 matrices producto × período — **Total primero, después Físico y
 * Futuros A3** (pedido de Lautaro, 05/08/2026: la lectura rápida es el total,
 * el desglose viene después) — con selector "Posición al [fecha]", el heatmap
 * comprado/vendido y el panel de futuros valorizado. La matriz de Futuros A3
 * solo lista `PRODUCTOS_CON_FUTURO` (soja/maíz/trigo): girasol y sorgo no
 * cotizan futuro en A3, así que no tiene sentido mostrarles una fila vacía.
 */
export function PosicionClient({
  empresaId,
  empresas,
  hoy,
  fechaCorte,
  fisico,
  futuros,
  total,
  heatmap,
  futurosValorizados,
  esAdmin,
}: {
  empresaId: string;
  empresas: { id: string; nombre: string }[] | null;
  hoy: string;
  fechaCorte: string | null;
  fisico: Matriz;
  futuros: Matriz;
  total: Matriz;
  heatmap: Heatmap;
  futurosValorizados: FuturoValorizado[];
  esAdmin: boolean;
}) {
  const [filtro, setFiltro] = useState<GranoFiltroValue>("todos");
  const productoFiltro = filtro === "todos" ? undefined : GRANO_PRODUCTO[filtro];

  return (
    <>
      <div className="op-controles">
        {empresas && <EmpresaSelector empresas={empresas} empresaId={empresaId} />}
        <PosicionFecha fecha={fechaCorte} hoy={hoy} empresaId={esAdmin ? empresaId : undefined} />
      </div>
      <FiltroGrano value={filtro} onChange={setFiltro} />

      {fechaCorte && (
        <p className="dim" role="status">
          Mostrando la posición reconstruida al {fechaCorte.split("-").reverse().join("/")} — el heatmap y los
          futuros valorizados siguen relativos a hoy.
        </p>
      )}

      <h3 className="op-matriz-tit">Total (físico + futuros)</h3>
      <ChartTabla
        columnas={matrizAColumnas(total)}
        filas={matrizAFilas(total, productoFiltro)}
        destacada={esFilaTotal}
        exportCsv="mi-posicion-total"
        columnasSigno={columnasSignoDe(total)}
        columnasEstado={COLUMNA_ESTADO}
      />

      <h3 className="op-matriz-tit">Físico (disponible + forward)</h3>
      <ChartTabla
        columnas={matrizAColumnas(fisico)}
        filas={matrizAFilas(fisico, productoFiltro)}
        destacada={esFilaTotal}
        exportCsv="mi-posicion-fisico"
        columnasSigno={columnasSignoDe(fisico)}
        columnasEstado={COLUMNA_ESTADO}
      />

      <h3 className="op-matriz-tit">Futuros A3</h3>
      <ChartTabla
        columnas={matrizAColumnas(futuros)}
        filas={matrizAFilas(futuros, productoFiltro)}
        destacada={esFilaTotal}
        exportCsv="mi-posicion-futuros"
        columnasSigno={columnasSignoDe(futuros)}
        columnasEstado={COLUMNA_ESTADO}
      />

      <h3 className="op-matriz-tit">Heatmap comprado/vendido</h3>
      <PosicionHeatmap heatmap={heatmap} productoFiltro={productoFiltro} empresaId={empresaId} esAdmin={esAdmin} />

      <h3 className="op-matriz-tit">Posición de futuros valorizada</h3>
      <FuturosValorizadosPanel filas={futurosValorizados} productoFiltro={productoFiltro} />
    </>
  );
}
