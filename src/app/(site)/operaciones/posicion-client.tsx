"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartTabla } from "@/components/chart-tabla";
import { FiltroGrano, type GranoFiltroValue } from "@/components/filtro-grano";
import { Panel, PanelHead } from "@/components/panel";
import type { MatrizDia } from "@/lib/operaciones/posicion";
import { matrizDiaAColumnas, matrizDiaAFilas, COLUMNA_ESTADO, columnasSignoDia } from "@/lib/operaciones/matriz-vista";
import type { FuturoValorizado } from "@/lib/operaciones/futuros-valorizados";
import type { ResumenPosicion as ResumenPosicionData } from "@/lib/operaciones/resumen";
import { GRANO_PRODUCTO } from "@/lib/operaciones/tipos";
import { EmpresaSelector } from "./empresa-selector";
import { PosicionDia } from "./posicion-dia";
import { FuturosValorizadosPanel } from "./futuros-panel";
import { PosicionResumen } from "./posicion-resumen";

/**
 * "Posición diaria" (pedido de Lautaro 06/08/2026, vuelta 4 — reestructura de
 * "Mi posición" en dos páginas separadas): SOLO los movimientos del día —
 * pricing del día (todo lo que YA tiene precio, fijaciones y futuros A3
 * incluidos — solo quedan afuera los negocios a fijar) con su POSICIÓN INICIAL
 * desde lo acumulado a precio, sumando todas las campañas (es exposición en $,
 * no identidad de grano) · futuros del día valorizados. Sin la fila de TOTAL al
 * pie de la tabla ("no me interesan los totales por columna") y sin Físico del
 * día ni el heatmap (sacados de la vista a pedido explícito — el código sigue
 * en el repo). El historial completo/acumulado vive en `/operaciones/acumulada`.
 * Verde = comprado / rojo = vendido en todas las columnas numéricas y Estado.
 */
export function PosicionDiaClient({
  empresaId,
  empresas,
  hoy,
  dia,
  pricingDia,
  futurosDia,
  resumen,
  sinOperaciones,
  esAdmin,
}: {
  empresaId: string;
  empresas: { id: string; nombre: string }[] | null;
  hoy: string;
  dia: string;
  pricingDia: MatrizDia;
  futurosDia: FuturoValorizado[];
  resumen: ResumenPosicionData;
  sinOperaciones: boolean;
  esAdmin: boolean;
}) {
  const [filtro, setFiltro] = useState<GranoFiltroValue>("todos");
  const productoFiltro = filtro === "todos" ? undefined : GRANO_PRODUCTO[filtro];

  const registroHref = esAdmin ? `/operaciones/registro?empresa=${empresaId}` : "/operaciones/registro";
  const acumuladaHref = esAdmin ? `/operaciones/acumulada?empresa=${empresaId}` : "/operaciones/acumulada";
  const diaLabel = dia.split("-").reverse().join("/");

  // Empresa sin NINGUNA operación cargada: en vez de tablas en cero, un
  // arranque claro hacia la carga (la primera experiencia de un cliente nuevo).
  if (sinOperaciones) {
    return (
      <Panel id="op-posicion">
        <PanelHead title="Posición diaria" sub="se arma sola a partir del registro diario" />
        <div className="op-panel-bd">
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
        </div>
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
        <PanelHead title="Posición diaria" sub="movimientos del día sobre la posición inicial acumulada" stamp={
          <Link href={acumuladaHref} className="op-nav-link">
            Posición acumulada →
          </Link>
        } />
        <div className="op-panel-bd">
          <div className="op-controles">
            <PosicionDia dia={dia} hoy={hoy} />
          </div>

          <h3 className="op-matriz-tit">Pricing del día (mercadería con precio, futuros A3 incluidos)</h3>
          <ChartTabla
            columnas={matrizDiaAColumnas(pricingDia)}
            filas={matrizDiaAFilas(pricingDia, productoFiltro)}
            exportCsv={`pricing-dia-${dia}`}
            columnasSigno={columnasSignoDia(pricingDia)}
            columnasEstado={COLUMNA_ESTADO}
            nota="Posición inicial = pricing acumulado hasta el día anterior. Incluye fijaciones y físicos a precio o pizarra; los negocios a fijar no suman hasta fijarse."
          />

          <h3 className="op-matriz-tit">Futuros A3 del día (valorizados)</h3>
          {futurosDia.length === 0 ? (
            <p className="dim">Sin futuros A3 operados el {diaLabel}.</p>
          ) : (
            <FuturosValorizadosPanel filas={futurosDia} productoFiltro={productoFiltro} />
          )}
        </div>
      </Panel>
    </>
  );
}
