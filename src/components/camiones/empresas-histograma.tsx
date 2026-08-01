"use client";

import { useMemo } from "react";
import { nfmt } from "@/lib/format";
import { RfChart } from "@/charts/RfChart";
import type { FilaEmpresa } from "@/lib/camiones/plantas";
import type { ProductoSerie } from "@/lib/camiones/config";

/**
 * Histograma horizontal "quién recibe" (relevamiento web R9, punto 53): un dato por empresa,
 * mismo filtro de grano que `EmpresasTabla`. Serie única → RfChart la pinta en verde
 * institucional (antes usaba `--gold` como fill completo, la misma violación de "oro
 * solo como acento" que se corrigió en el resto de los charts de esta migración).
 */
export function EmpresasHistograma({ empresas, granoFiltro }: { empresas: FilaEmpresa[]; granoFiltro: ProductoSerie }) {
  const filas = useMemo(() => {
    return empresas
      .map((e) => {
        if (granoFiltro === "TOTAL") return { empresa: e.empresa, cantidad: e.cantidad };
        const fila = e.porGrano.find((g) => g.cod === granoFiltro);
        return fila ? { empresa: e.empresa, cantidad: fila.cantidad } : null;
      })
      .filter((x): x is { empresa: string; cantidad: number } => x !== null)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 12);
  }, [empresas, granoFiltro]);

  if (filas.length === 0) {
    return <div className="chart-wrap chart-empty">Sin empresas para este filtro.</div>;
  }

  return (
    <RfChart
      ariaLabel="Histograma de camiones recibidos por empresa, top 12"
      exportName="empresas-camiones"
      xTitle="Camiones"
      yTitle=""
      height={Math.max(180, filas.length * 28 + 40)}
      valueFormatter={(v) => nfmt(v, 0)}
      option={{
        xAxis: { type: "value" },
        // `inverse` deja el orden del array (ya descendente) de arriba hacia abajo —
        // sin esto ECharts dibuja categorías de abajo hacia arriba y el ranking sale al revés.
        yAxis: { type: "category", data: filas.map((f) => f.empresa), inverse: true },
        series: [{ type: "bar", data: filas.map((f) => f.cantidad), barMaxWidth: 18 }],
      }}
    />
  );
}
