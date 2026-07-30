"use client";

import { useMemo, useState } from "react";
import { nfmt } from "@/lib/format";
import type { FilaEmpresa } from "@/lib/camiones/plantas";
import type { ProductoSerie } from "@/lib/camiones/config";

/**
 * Tabla "quién recibió camiones" de Agroentregas (relevamiento web R9, punto 53): filtrable por
 * EMPRESA (búsqueda) y por GRANO — el filtro de grano llega de arriba (`granoFiltro`, transversal
 * a toda la página); cuando hay un grano elegido, la columna "Camiones" muestra la cantidad DE ESE
 * grano para la empresa (`porGrano`), no el total del día, y las empresas sin ese grano se ocultan.
 */
export function EmpresasTabla({ empresas, granoFiltro, granoDisplay }: { empresas: FilaEmpresa[]; granoFiltro: ProductoSerie; granoDisplay: string }) {
  const [q, setQ] = useState("");

  const filtradas = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return empresas
      .map((e) => {
        if (granoFiltro === "TOTAL") return { e, cantidad: e.cantidad };
        const fila = e.porGrano.find((g) => g.cod === granoFiltro);
        return fila ? { e, cantidad: fila.cantidad } : null;
      })
      .filter((x): x is { e: FilaEmpresa; cantidad: number } => x !== null)
      .filter((x) => !needle || x.e.empresa.toLowerCase().includes(needle))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [empresas, granoFiltro, q]);

  return (
    <div className="lu-tabla">
      <div className="lu-filtros">
        <label className="lu-field lu-grow">
          <span>Buscar</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Empresa…" />
        </label>
      </div>
      <div className="lu-cuenta">
        {filtradas.length} {filtradas.length === 1 ? "empresa" : "empresas"}
        {granoFiltro !== "TOTAL" && ` con ${granoDisplay.toLowerCase()}`}
      </div>
      <div className="table-scroll">
        <table className="tbl" style={{ minWidth: 620 }}>
          <thead>
            <tr>
              <th className="l" scope="col">Empresa</th>
              <th scope="col">Camiones{granoFiltro !== "TOTAL" ? ` (${granoDisplay})` : ""}</th>
              <th scope="col">Share del total</th>
              <th className="l" scope="col">Plantas</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map(({ e, cantidad }) => (
              <tr key={e.empresa}>
                <td className="l">{e.empresa}</td>
                <td>{nfmt(cantidad, 0)}</td>
                <td>{nfmt(e.share, 1)}%</td>
                <td className="l dim">{e.plantas.map((p) => `${p.planta} (${nfmt(p.cantidad, 0)})`).join(" · ")}</td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td className="l dim" colSpan={4}>Sin empresas para este filtro.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
