"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartTabla } from "@/components/chart-tabla";
import { FiltroGrano, type GranoFiltroValue } from "@/components/filtro-grano";
import { Panel, PanelHead } from "@/components/panel";
import { RangoChips } from "@/components/rango-chips";
import type { Matriz, FiltroPrecioFisico } from "@/lib/operaciones/posicion";
import { matrizAColumnas, matrizAFilas, COLUMNA_ESTADO, columnasSignoDe } from "@/lib/operaciones/matriz-vista";
import type { FuturoAcumulado } from "@/lib/operaciones/futuros-valorizados";
import { futurosAcumuladosAColumnas, futurosAcumuladosAFilas, futuroEsFilaDestacada } from "@/lib/operaciones/futuros-vista";
import { GRANO_PRODUCTO } from "@/lib/operaciones/tipos";
import { EmpresaSelector } from "../empresa-selector";
import { PosicionFecha } from "../posicion-fecha";

const FILTROS_PRECIO: { label: string; value: FiltroPrecioFisico }[] = [
  { label: "Todos", value: "todos" },
  { label: "Con precio", value: "con_precio" },
  { label: "A fijar", value: "a_fijar" },
];

/**
 * "Posición acumulada" (pedido de Lautaro 06/08/2026, vuelta 4 — reestructura
 * de "Mi posición" en dos páginas separadas): el historial completo desde la
 * primera operación — pricing acumulado, físico acumulado por campaña (con el
 * filtro de negocios con precio/todos/a fijar, pedido explícito) y la
 * posición de futuros acumulada (sin columna Estado, "dejala igual, quitale
 * la columna estado"). Sin fila de TOTAL al pie en pricing/físico ("no me
 * interesan los totales por columna"); la de futuros SÍ la conserva. Los
 * movimientos de HOY viven en `/operaciones` (Posición diaria).
 */
export function PosicionAcumuladaClient({
  empresaId,
  empresas,
  hoy,
  fechaCorte,
  pricingAcum,
  fisicoAcumPorCampania,
  futurosAcum,
  sinOperaciones,
  esAdmin,
}: {
  empresaId: string;
  empresas: { id: string; nombre: string }[] | null;
  hoy: string;
  fechaCorte: string | null;
  pricingAcum: Matriz;
  fisicoAcumPorCampania: { campania: string; matrices: Record<FiltroPrecioFisico, Matriz> }[];
  futurosAcum: FuturoAcumulado[];
  sinOperaciones: boolean;
  esAdmin: boolean;
}) {
  const [filtro, setFiltro] = useState<GranoFiltroValue>("todos");
  const [filtroPrecio, setFiltroPrecio] = useState<FiltroPrecioFisico>("todos");
  const productoFiltro = filtro === "todos" ? undefined : GRANO_PRODUCTO[filtro];

  const registroHref = esAdmin ? `/operaciones/registro?empresa=${empresaId}` : "/operaciones/registro";
  const diariaHref = esAdmin ? `/operaciones?empresa=${empresaId}` : "/operaciones";

  if (sinOperaciones) {
    return (
      <Panel id="op-posicion-acumulada">
        <PanelHead title="Posición acumulada" sub="se arma sola a partir de la carga de negocios" />
        <div className="op-panel-bd">
          <div className="op-controles">
            {empresas && <EmpresaSelector empresas={empresas} empresaId={empresaId} />}
            <Link href={registroHref} className="op-nav-link">
              Carga de negocios →
            </Link>
          </div>
          <p className="dim">
            {esAdmin ? "Esta empresa todavía no tiene operaciones cargadas." : "Todavía no cargaste ninguna operación."}{" "}
            La posición se arma sola a partir de la carga de negocios:{" "}
            <Link href={registroHref}>cargá la primera operación →</Link>
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <>
      <div className="op-controles">
        {empresas && <EmpresaSelector empresas={empresas} empresaId={empresaId} />}
        <Link href={registroHref} className="op-nav-link">
          Carga de negocios →
        </Link>
      </div>
      <FiltroGrano value={filtro} onChange={setFiltro} />

      <Panel id="op-acumulada">
        <PanelHead
          title="Posición acumulada"
          sub="desde la primera operación cargada"
          stamp={
            <Link href={diariaHref} className="op-nav-link">
              Posición diaria →
            </Link>
          }
        />
        <div className="op-panel-bd">
          <div className="op-controles">
            <PosicionFecha fecha={fechaCorte} hoy={hoy} />
          </div>
          {fechaCorte && (
            <p className="dim" role="status">
              Mostrando la posición reconstruida al {fechaCorte.split("-").reverse().join("/")} — la posición de
              futuros valorizada sigue relativa a hoy.
            </p>
          )}

          <h3 className="op-matriz-tit">Pricing acumulado (mercadería con precio, futuros A3 incluidos)</h3>
          <ChartTabla
            columnas={matrizAColumnas(pricingAcum)}
            filas={matrizAFilas(pricingAcum, productoFiltro)}
            exportCsv="pricing-acumulado"
            columnasSigno={columnasSignoDe(pricingAcum)}
            columnasEstado={COLUMNA_ESTADO}
          />

          {fisicoAcumPorCampania.length > 0 && (
            <RangoChips opciones={FILTROS_PRECIO} valor={filtroPrecio} onChange={setFiltroPrecio} label="Filtro de negocios (físico acumulado)" />
          )}
          {fisicoAcumPorCampania.map(({ campania, matrices }) => (
            <div key={campania}>
              <h3 className="op-matriz-tit">Físico acumulado — campaña {campania}</h3>
              <ChartTabla
                columnas={matrizAColumnas(matrices[filtroPrecio])}
                filas={matrizAFilas(matrices[filtroPrecio], productoFiltro)}
                exportCsv={`fisico-acumulado-${campania.replace("/", "-")}-${filtroPrecio}`}
                columnasSigno={columnasSignoDe(matrices[filtroPrecio])}
                columnasEstado={COLUMNA_ESTADO}
                nota="Cada campaña se calza por separado — una compra 25/26 y una venta 26/27 no son la misma mercadería."
              />
            </div>
          ))}
          {fisicoAcumPorCampania.length === 0 && <p className="dim">Sin negocios físicos cargados todavía.</p>}

          <h3 className="op-matriz-tit">Posición de futuros acumulada (precio promedio y valorización)</h3>
          {futurosAcum.length === 0 ? (
            <p className="dim">Sin futuros A3 cargados todavía.</p>
          ) : (
            <ChartTabla
              columnas={futurosAcumuladosAColumnas()}
              filas={futurosAcumuladosAFilas(futurosAcum, productoFiltro)}
              destacada={futuroEsFilaDestacada}
              exportCsv="futuros-acumulados"
              columnasSigno={["neto", "resultado"]}
              nota="Neto y precio promedio ponderado por posición; el resultado usa el ajuste de hoy. Una posición cerrada (neto 0) muestra su resultado ya fijado."
            />
          )}
        </div>
      </Panel>
    </>
  );
}
