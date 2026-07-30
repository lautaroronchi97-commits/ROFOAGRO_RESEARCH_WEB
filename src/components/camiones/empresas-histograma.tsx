"use client";

import { useMemo } from "react";
import { nfmt } from "@/lib/format";
import type { FilaEmpresa } from "@/lib/camiones/plantas";
import type { ProductoSerie } from "@/lib/camiones/config";

/**
 * Histograma horizontal "quién recibe" (relevamiento web R9, punto 53): un dato por empresa,
 * mismo filtro de grano que `EmpresasTabla`. Barras a mano (SVG), sin depender de Recharts —
 * el resto de los charts "a mano" del sitio sigue este mismo criterio de simplicidad.
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

  const max = Math.max(1, ...filas.map((f) => f.cantidad));

  return (
    <div className="emp-histo">
      {filas.map((f) => (
        <div className="emp-histo-fila" key={f.empresa}>
          <span className="emp-histo-nombre">{f.empresa}</span>
          <span className="emp-histo-barra-wrap">
            <span className="emp-histo-barra" style={{ width: `${Math.max(2, (f.cantidad / max) * 100)}%` }} />
          </span>
          <span className="emp-histo-valor">{nfmt(f.cantidad, 0)}</span>
        </div>
      ))}
    </div>
  );
}
