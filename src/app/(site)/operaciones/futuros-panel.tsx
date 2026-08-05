"use client";

import { ChartTabla } from "@/components/chart-tabla";
import { futurosValorizadosAColumnas, futurosValorizadosAFilas, futuroEsFilaDestacada } from "@/lib/operaciones/futuros-vista";
import type { FuturoValorizado } from "@/lib/operaciones/futuros-valorizados";
import type { OperacionProducto } from "@/lib/operaciones/tipos";

/**
 * Panel "Posición de futuros" valorizada (§5.5, Fase 2): SIEMPRE sobre el
 * conjunto COMPLETO de futuros vivos de la empresa — a diferencia de las 3
 * matrices de arriba, no respeta el selector "Posición al [fecha]": el ajuste
 * de hoy es, por definición, de HOY, así que no existe un "mark-to-market a
 * una fecha pasada" sin guardar el historial de ajustes (fuera de v1, §6).
 */
export function FuturosValorizadosPanel({
  filas,
  productoFiltro,
}: {
  filas: FuturoValorizado[];
  productoFiltro?: OperacionProducto;
}) {
  const { rows, hayNoMultiplo } = futurosValorizadosAFilas(filas, productoFiltro);

  if (filas.length === 0) {
    return <p className="dim">Sin futuros A3 cargados todavía.</p>;
  }

  return (
    <ChartTabla
      columnas={futurosValorizadosAColumnas()}
      filas={rows}
      destacada={futuroEsFilaDestacada}
      exportCsv="futuros-valorizados"
      nota={
        hayNoMultiplo
          ? "* el volumen no es múltiplo del contrato A3 (100 tn) — revisá si corresponde partirlo."
          : undefined
      }
    />
  );
}
