"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartTabla } from "@/components/chart-tabla";
import { FiltroGrano, type GranoFiltroValue } from "@/components/filtro-grano";
import { Panel, PanelHead } from "@/components/panel";
import type { Heatmap, Matriz, MatrizDia } from "@/lib/operaciones/posicion";
import {
  matrizAColumnas,
  matrizAFilas,
  esFilaTotal,
  columnasSignoDe,
  COLUMNA_ESTADO,
  matrizDiaAColumnas,
  matrizDiaAFilas,
  columnasSignoDia,
} from "@/lib/operaciones/matriz-vista";
import type { FuturoAcumulado, FuturoValorizado } from "@/lib/operaciones/futuros-valorizados";
import { futurosAcumuladosAColumnas, futurosAcumuladosAFilas, futuroEsFilaDestacada } from "@/lib/operaciones/futuros-vista";
import type { ResumenPosicion as ResumenPosicionData } from "@/lib/operaciones/resumen";
import { GRANO_PRODUCTO } from "@/lib/operaciones/tipos";
import { EmpresaSelector } from "./empresa-selector";
import { PosicionFecha } from "./posicion-fecha";
import { PosicionDia } from "./posicion-dia";
import { PosicionHeatmap } from "./heatmap";
import { FuturosValorizadosPanel } from "./futuros-panel";
import { PosicionResumen } from "./posicion-resumen";

/**
 * "Mis operaciones" reestructurada (pedido de Lautaro 06/08/2026) en DOS
 * bloques:
 *  - **Posición del día**: pricing del día (todo lo que YA tiene precio,
 *    fijaciones y futuros A3 incluidos — solo quedan afuera los negocios a
 *    fijar) con su POSICIÓN INICIAL desde lo acumulado a precio · físico del
 *    día (la totalidad de los negocios físicos, a precio y a fijar, sin
 *    futuros) con la inicial del físico acumulado · futuros del día
 *    valorizados · heatmap al final.
 *  - **Posición acumulada**: mismo criterio — pricing por un lado, físico por
 *    el otro — más la posición de futuros acumulada (neteo + precio promedio
 *    ponderado + valorización), con el selector "Posición al [fecha]".
 * Verde = comprado / rojo = vendido en todas las columnas numéricas y Estado.
 */
export function PosicionClient({
  empresaId,
  empresas,
  hoy,
  dia,
  fechaCorte,
  pricingDia,
  fisicoDia,
  futurosDia,
  pricingAcum,
  fisicoAcum,
  futurosAcum,
  heatmap,
  resumen,
  sinOperaciones,
  esAdmin,
}: {
  empresaId: string;
  empresas: { id: string; nombre: string }[] | null;
  hoy: string;
  dia: string;
  fechaCorte: string | null;
  pricingDia: MatrizDia;
  fisicoDia: MatrizDia;
  futurosDia: FuturoValorizado[];
  pricingAcum: Matriz;
  fisicoAcum: Matriz;
  futurosAcum: FuturoAcumulado[];
  heatmap: Heatmap;
  resumen: ResumenPosicionData;
  sinOperaciones: boolean;
  esAdmin: boolean;
}) {
  const [filtro, setFiltro] = useState<GranoFiltroValue>("todos");
  const productoFiltro = filtro === "todos" ? undefined : GRANO_PRODUCTO[filtro];

  const registroHref = esAdmin ? `/operaciones/registro?empresa=${empresaId}` : "/operaciones/registro";
  const diaLabel = dia.split("-").reverse().join("/");

  // Empresa sin NINGUNA operación cargada: en vez de tablas en cero, un
  // arranque claro hacia la carga (la primera experiencia de un cliente nuevo).
  if (sinOperaciones) {
    return (
      <Panel id="op-posicion">
        <PanelHead title="Posición" sub="se arma sola a partir del registro diario" />
        <div className="op-controles">
          {empresas && <EmpresaSelector empresas={empresas} empresaId={empresaId} />}
          <Link href={registroHref} className="op-nav-link">
            Registro diario →
          </Link>
        </div>
        <p className="dim">
          {esAdmin ? "Esta empresa todavía no tiene operaciones cargadas." : "Todavía no cargaste ninguna operación."}{" "}
          La posición se arma sola a partir del registro diario:{" "}
          <Link href={registroHref}>cargá la primera operación →</Link>
        </p>
      </Panel>
    );
  }

  return (
    <>
      <div className="op-controles">
        {empresas && <EmpresaSelector empresas={empresas} empresaId={empresaId} />}
        <Link href={registroHref} className="op-nav-link">
          Registro diario →
        </Link>
      </div>
      <PosicionResumen resumen={resumen} />
      <FiltroGrano value={filtro} onChange={setFiltro} />

      <Panel id="op-dia">
        <PanelHead title="Posición del día" sub="movimientos del día sobre la posición inicial acumulada" />
        <div className="op-controles">
          <PosicionDia dia={dia} hoy={hoy} />
        </div>

        <h3 className="op-matriz-tit">Pricing del día (mercadería con precio, futuros A3 incluidos)</h3>
        <ChartTabla
          columnas={matrizDiaAColumnas(pricingDia)}
          filas={matrizDiaAFilas(pricingDia, productoFiltro)}
          destacada={esFilaTotal}
          exportCsv={`pricing-dia-${dia}`}
          columnasSigno={columnasSignoDia(pricingDia)}
          columnasEstado={COLUMNA_ESTADO}
          nota="Posición inicial = pricing acumulado hasta el día anterior. Incluye fijaciones y físicos a precio o pizarra; los negocios a fijar no suman hasta fijarse."
        />

        <h3 className="op-matriz-tit">Físico del día (todos los negocios, a precio y a fijar)</h3>
        <ChartTabla
          columnas={matrizDiaAColumnas(fisicoDia)}
          filas={matrizDiaAFilas(fisicoDia, productoFiltro)}
          destacada={esFilaTotal}
          exportCsv={`fisico-dia-${dia}`}
          columnasSigno={columnasSignoDia(fisicoDia)}
          columnasEstado={COLUMNA_ESTADO}
          nota="Posición inicial = físico acumulado hasta el día anterior. Incluye disponible y forward (a precio y a fijar); no incluye futuros A3 ni fijaciones (la fijación pone precio, no mueve mercadería)."
        />

        <h3 className="op-matriz-tit">Futuros A3 del día (valorizados)</h3>
        {futurosDia.length === 0 ? (
          <p className="dim">Sin futuros A3 operados el {diaLabel}.</p>
        ) : (
          <FuturosValorizadosPanel filas={futurosDia} productoFiltro={productoFiltro} />
        )}

        <h3 className="op-matriz-tit">Heatmap comprado/vendido</h3>
        <PosicionHeatmap heatmap={heatmap} productoFiltro={productoFiltro} empresaId={empresaId} esAdmin={esAdmin} />
      </Panel>

      <Panel id="op-acumulada">
        <PanelHead title="Posición acumulada" sub="desde la primera operación cargada" />
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
          destacada={esFilaTotal}
          exportCsv="pricing-acumulado"
          columnasSigno={columnasSignoDe(pricingAcum)}
          columnasEstado={COLUMNA_ESTADO}
        />

        <h3 className="op-matriz-tit">Físico acumulado (todos los negocios, a precio y a fijar)</h3>
        <ChartTabla
          columnas={matrizAColumnas(fisicoAcum)}
          filas={matrizAFilas(fisicoAcum, productoFiltro)}
          destacada={esFilaTotal}
          exportCsv="fisico-acumulado"
          columnasSigno={columnasSignoDe(fisicoAcum)}
          columnasEstado={COLUMNA_ESTADO}
        />

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
      </Panel>
    </>
  );
}
