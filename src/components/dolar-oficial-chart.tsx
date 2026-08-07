"use client";

import { nfmt } from "@/lib/format";
import { RfChart } from "@/charts/RfChart";
import { ChartTabla, type ChartTablaColumna, type ChartTablaFila } from "./chart-tabla";

function fmtFecha(fechaISO: string): string {
  const [, m, d] = fechaISO.split("-");
  return `${d}/${m}`;
}

export type PuntoDolar = { fecha: string; valor: number };

/**
 * Variación semanal del dólar OFICIAL (BCRA A3500, variable 5) — ítem 13 del backlog viejo /
 * P2 de PLAN_BACKLOG.md, resuelto de paso al construir MP2 (informe semanal). Reusado en
 * `/dolar` (vivo) y en la plantilla del informe semanal (mismo componente, mismos datos).
 *
 * OJO fuente: es el tipo de cambio de referencia de BCRA (Comunicación A 3500), NO el spot
 * `UST$T` de MAE que usa el resto de la web para "oficial mayorista" — ese spot no tiene
 * historial en ningún lado (ver `src/lib/informe-semanal.ts`). Trae el spread bancario
 * implícito; se muestra igual, con la fuente aclarada, por decisión de Lautaro (23/07).
 *
 * `sinTabla` (V3, PLAN_INFORMES_V2.md §6.3): la plantilla del informe semanal la usa para
 * omitir el `ChartTabla` de acá abajo — es el recorte elegido en la página de dólar/Chicago
 * para hacerle lugar a "El mundo esta semana" sin pasar de 5 páginas (la tabla es una
 * relectura del mismo gráfico; el dato completo sigue disponible en vivo en `/dolar`). Default
 * `false`: `/dolar` (la página en vivo) no pasa la prop y queda exactamente como estaba.
 *
 * `colapsable` (feedback 07/08/2026): la página en vivo la pasa `true` para que la tabla
 * arranque cerrada. La plantilla del informe (PNG/PDF vía Playwright) NUNCA la pasa — un
 * screenshot no puede clickear para abrir, así que ahí la tabla debe seguir tal cual estaba
 * (además va con `sinTabla`, así que ni siquiera se renderiza).
 */
export function DolarOficialChart({
  serie,
  sinTabla = false,
  colapsable = false,
}: {
  serie: PuntoDolar[];
  sinTabla?: boolean;
  colapsable?: boolean;
}) {
  if (serie.length < 2) {
    return <div className="chart-wrap chart-empty">Sin suficiente historial todavía para el gráfico semanal.</div>;
  }

  const columnas: ChartTablaColumna[] = [
    { key: "fecha", label: "Fecha", align: "left" },
    { key: "valor", label: "$ oficial (BCRA A3500)" },
  ];
  const filas: ChartTablaFila[] = serie.map((p) => ({ fecha: fmtFecha(p.fecha), valor: nfmt(p.valor, 2) }));

  return (
    <>
      <RfChart
        ariaLabel="Dólar oficial (BCRA A3500), últimos días"
        exportName="dolar-oficial"
        xTitle="Fecha"
        yTitle="$ oficial (BCRA A3500)"
        valueFormatter={(v) => `$ ${nfmt(v, 2)}`}
        option={{
          xAxis: { type: "category", data: serie.map((p) => fmtFecha(p.fecha)) },
          yAxis: { type: "value" },
          series: [{ name: "Oficial mayorista (BCRA A3500)", type: "line", areaStyle: {}, data: serie.map((p) => p.valor) }],
        }}
      />
      {!sinTabla && (
        <ChartTabla
          columnas={columnas}
          filas={filas}
          maxFilas={5}
          orden="desc"
          colapsable={colapsable}
          nota="BCRA A3500 (Comunicación 3500) — no es el spot UST$T de MAE que usa el resto de la web para el oficial mayorista; se usa acá por ser la única fuente con historial diario real."
        />
      )}
    </>
  );
}
