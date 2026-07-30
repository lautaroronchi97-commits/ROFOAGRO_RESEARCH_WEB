"use client";

import * as React from "react";

/**
 * Tabla de datos del gráfico: muestra, SIEMPRE visible debajo de cada chart,
 * los datos que lo componen (decisión de Lautaro: doble lectura gráfico + tabla,
 * sin toggle).
 *
 * Contrato (integradores):
 *   - El FORMATEO de números lo hace el caller (cada chart ya tiene sus
 *     formatters es-AR): la tabla recibe strings ya formateados (o números) y
 *     los muestra tal cual. `null`/faltante → "—".
 *   - `columnas[].align` default "right" (números); usar "left" para etiquetas
 *     (fecha, posición, etc.).
 *   - Series largas: scroll vertical propio (max-height ~320px) con header
 *     sticky; muchas columnas: scroll horizontal interno (nunca rompe el layout
 *     de la página).
 *   - `exportCsv` (opt-in, P6 del backlog maestro): agrega un botón "↓ CSV" que
 *     baja EXACTAMENTE lo que se ve en la tabla (mismos valores ya formateados).
 *     Sin esta prop la tabla queda 100% igual a como estaba (server-safe en la
 *     práctica: no agrega UI ni cambia nada en las páginas que no la pasan).
 *   - `maxFilas`/`orden` (opt-in, relevamiento web R6 punto 32 — SOLO los 5 charts
 *     de `/dolar`): `maxFilas` recorta a las N filas MÁS RECIENTES (asume `filas`
 *     en orden cronológico ascendente, la convención del resto del sitio);
 *     `orden="desc"` invierte el resultado para mostrar la más reciente primero.
 *     Sin estas props, la tabla sigue mostrando TODO en el orden que llega (el
 *     resto de los ~11 consumidores no cambia).
 *   - `colapsable` (opt-in, relevamiento web R9 punto 53): arranca cerrada, con un
 *     botón para expandir. Sin `abierta`/`onToggleAbierta` el estado es interno;
 *     pasando ambos, el PADRE controla qué tabla está abierta (varias `ChartTabla`
 *     coordinando "máx una abierta a la vez"). Sin `colapsable`, sigue igual.
 */

export type ChartTablaColumna = {
  key: string;
  label: string;
  align?: "left" | "right";
};

export type ChartTablaFila = Record<string, string | number | null>;

export type ChartTablaProps = {
  /** Encabezado chico arriba de la tabla (default "Datos del gráfico"). */
  titulo?: string;
  columnas: ChartTablaColumna[];
  filas: ChartTablaFila[];
  /** Nota al pie (fuente, aclaración), opcional. */
  nota?: string;
  /** Nombre de archivo (sin extensión) para el botón de export CSV. Omitir = sin botón. */
  exportCsv?: string;
  /** Recorta a las últimas N filas (las más recientes). Sin esto: todas. */
  maxFilas?: number;
  /** "desc" = la más reciente primero. Default "asc" (igual que llega `filas`). */
  orden?: "asc" | "desc";
  /** Marca una fila como destacada (recuadro/color) — el caller decide cuál según sus propios
   *  datos (relevamiento web R7 punto 48: la fila de "hoy" en el eje días-al-vto de
   *  `spread-chart.tsx`). Se evalúa sobre las filas ya recortadas/ordenadas. */
  destacada?: (fila: ChartTablaFila, i: number) => boolean;
  /** Opt-in: arranca cerrada, con botón para expandir/colapsar. */
  colapsable?: boolean;
  /** Estado controlado (junto con `onToggleAbierta`) para coordinar varias tablas. */
  abierta?: boolean;
  onToggleAbierta?: () => void;
};

function descargarCsv(columnas: ChartTablaColumna[], filas: ChartTablaFila[], filename: string) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [
    columnas.map((c) => esc(c.label)).join(","),
    ...filas.map((fila) => columnas.map((c) => esc(fila[c.key])).join(",")),
  ];
  const blob = new Blob(["﻿" + lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ChartTabla({
  titulo = "Datos del gráfico",
  columnas,
  filas,
  nota,
  exportCsv,
  maxFilas,
  orden = "asc",
  destacada,
  colapsable = false,
  abierta,
  onToggleAbierta,
}: ChartTablaProps) {
  const [abiertaInterna, setAbiertaInterna] = React.useState(false);
  const controlada = abierta !== undefined && onToggleAbierta !== undefined;
  const estaAbierta = !colapsable || (controlada ? abierta : abiertaInterna);
  const toggle = controlada ? onToggleAbierta : () => setAbiertaInterna((v) => !v);

  let vista = filas;
  if (maxFilas != null && vista.length > maxFilas) vista = vista.slice(-maxFilas);
  if (orden === "desc") vista = [...vista].reverse();

  return (
    <div className="ct">
      <div className="ct-hd">
        {colapsable ? (
          <button type="button" className="ct-toggle" aria-expanded={estaAbierta} onClick={toggle}>
            <span className="ct-toggle-ico">{estaAbierta ? "▾" : "▸"}</span> {titulo}
          </button>
        ) : (
          <span>{titulo}</span>
        )}
        {vista.length > 0 && (
          <span className="ct-n">
            {vista.length} {vista.length === 1 ? "fila" : "filas"}
          </span>
        )}
        {exportCsv && vista.length > 0 && (
          <button
            type="button"
            className="ct-csv"
            onClick={() => descargarCsv(columnas, vista, exportCsv)}
          >
            ↓ CSV
          </button>
        )}
      </div>
      {!estaAbierta ? null : (
      <>
      <div className="ct-scroll" tabIndex={0}>
        <table className="tbl">
          <thead>
            <tr>
              {columnas.map((c) => (
                <th key={c.key} className={c.align === "left" ? "l" : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vista.length === 0 ? (
              <tr>
                <td className="ct-vacio" colSpan={columnas.length}>
                  Sin datos para mostrar
                </td>
              </tr>
            ) : (
              vista.map((fila, i) => (
                <tr key={i} className={destacada?.(fila, i) ? "ct-hoy" : undefined}>
                  {columnas.map((c) => {
                    const v = fila[c.key];
                    return (
                      <td key={c.key} className={c.align === "left" ? "l" : undefined}>
                        {v === null || v === undefined || v === "" ? "—" : v}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {nota && <p className="ct-nota">{nota}</p>}
      </>
      )}
    </div>
  );
}
