"use client";

import { useMemo, useState } from "react";
import { nfmt } from "@/lib/format";
import type { BuqueRow } from "@/lib/lineup/foto";
import { totalesPorZona } from "@/lib/lineup/foto-empresas";

/**
 * Tabla de buques de la última rueda, filtrable por producto y zona + búsqueda
 * libre (buque/empresa/destino), con export a CSV. Client component: los filtros
 * corren en el navegador sobre las filas que ya vienen del server.
 *
 * Relevamiento web R10 (punto 54): orden por defecto pasó de toneladas desc a **ETB
 * ascendente** (el buque que carga hace más tiempo primero — "no barco por barco"
 * pedía dejar de listar por tamaño). Con cualquier filtro activo (producto/zona/
 * búsqueda) se suma un renglón de **total por zona** sobre lo filtrado — el buscador
 * en sí no cambió, solo lo que se muestra arriba del resultado.
 */
function etbMs(iso: string | null): number {
  // Sin ETB: al final (no "primero" — un buque sin fecha conocida no es "el más viejo").
  return iso ? Date.parse(iso) : Infinity;
}
export function BuquesTabla({ buques, fecha }: { buques: BuqueRow[]; fecha: string | null }) {
  const [producto, setProducto] = useState("todos");
  const [zona, setZona] = useState("todas");
  const [q, setQ] = useState("");

  const productos = useMemo(
    () => [...new Set(buques.map((b) => b.producto))],
    [buques],
  );
  const zonas = useMemo(() => [...new Set(buques.map((b) => b.zona))], [buques]);

  const filtradas = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return buques
      .filter((b) => producto === "todos" || b.producto === producto)
      .filter((b) => zona === "todas" || b.zona === zona)
      .filter(
        (b) =>
          !needle ||
          b.vessel.toLowerCase().includes(needle) ||
          b.empresa.toLowerCase().includes(needle) ||
          (b.destino ?? "").toLowerCase().includes(needle),
      )
      .sort((a, b) => etbMs(a.etb) - etbMs(b.etb));
  }, [buques, producto, zona, q]);

  const totTon = filtradas.reduce((s, b) => s + (b.toneladas ?? 0), 0);
  const hayFiltro = producto !== "todos" || zona !== "todas" || q.trim() !== "";
  const porZona = useMemo(() => (hayFiltro ? totalesPorZona(filtradas) : []), [hayFiltro, filtradas]);

  function exportarCsv() {
    // Orden feedback 07/08/2026: producto/empresa/zona primero (lo que importa), buque al final.
    const cols = ["Producto", "Empresa", "Zona", "Muelle", "Toneladas", "ETB", "Destino", "Buque"];
    const esc = (v: string | number | null) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lineas = [
      cols.join(","),
      ...filtradas.map((b) =>
        [b.producto, b.empresa, b.zona, b.muelle ?? "", b.toneladas ?? "", b.etb ?? "", b.destino ?? "", b.vessel]
          .map(esc)
          .join(","),
      ),
    ];
    const blob = new Blob(["﻿" + lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `line-up-${fecha ?? "buques"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="lu-tabla">
      <div className="lu-filtros">
        <label className="lu-field">
          <span>Producto</span>
          <select value={producto} onChange={(e) => setProducto(e.target.value)}>
            <option value="todos">Todos</option>
            {productos.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="lu-field">
          <span>Zona</span>
          <select value={zona} onChange={(e) => setZona(e.target.value)}>
            <option value="todas">Todas</option>
            {zonas.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </label>
        <label className="lu-field lu-grow">
          <span>Buscar</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buque, empresa o destino…"
          />
        </label>
        <button type="button" className="lu-csv" onClick={exportarCsv} disabled={filtradas.length === 0}>
          ↓ CSV
        </button>
      </div>

      <div className="lu-cuenta">
        {filtradas.length} {filtradas.length === 1 ? "operación" : "operaciones"} · {nfmt(totTon, 0)} t
      </div>

      {porZona.length > 0 && (
        <div className="lu-totzona">
          {porZona.map((z) => (
            <span key={z.zona} className="lu-totzona-item">
              <b>{z.zona}</b> {nfmt(z.buques, 0)} buques · {nfmt(z.toneladas, 0)} t
            </span>
          ))}
        </div>
      )}

      <div className="table-scroll">
        <table className="tbl" style={{ minWidth: 820 }}>
          <thead>
            <tr>
              {/* Orden feedback 07/08/2026: "destacá el grano, el puerto y el comprador, no me
                  importa tanto el nombre del buque" — producto/empresa/zona primero en peso
                  normal, buque al final en `.dim`. */}
              <th className="l" scope="col">Producto</th>
              <th className="l" scope="col">Empresa</th>
              <th className="l" scope="col">Zona</th>
              <th className="l" scope="col">Muelle</th>
              <th scope="col">Toneladas</th>
              <th scope="col">ETB</th>
              <th className="l" scope="col">Destino</th>
              <th className="l" scope="col">Buque</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((b, i) => (
              <tr key={`${b.vessel}-${b.producto}-${b.muelle ?? ""}-${i}`}>
                <td className="l sym">{b.producto}</td>
                <td className="l">{b.empresa}</td>
                <td className="l">{b.zona}</td>
                <td className="l dim">{b.muelle ?? "—"}</td>
                <td>{nfmt(b.toneladas, 0)}</td>
                <td className="dim">{b.etb ? b.etb.slice(8, 10) + "/" + b.etb.slice(5, 7) : "—"}</td>
                <td className="l dim">{b.destino ?? "—"}</td>
                <td className="l dim">{b.vessel}</td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td className="l dim" colSpan={8}>Sin buques para este filtro.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
