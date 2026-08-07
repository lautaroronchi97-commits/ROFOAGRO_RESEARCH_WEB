"use client";

import * as React from "react";

/**
 * Wrapper genérico para colapsar cualquier tabla "a mano" (que no pasa por
 * `ChartTabla`) — mismo patrón visual (`.ct-hd`/`.ct-toggle`) que `ChartTabla`
 * usa, para que el toggle se vea y se comporte igual en toda la web.
 * Feedback 07/08/2026: "que las tablas sean desplegables tipo pop up, que solo
 * se desplieguen si uno hace click y quiere ver los datos".
 */
export function TablaColapsable({
  titulo,
  children,
  abiertaPorDefault = false,
}: {
  titulo: string;
  children: React.ReactNode;
  abiertaPorDefault?: boolean;
}) {
  const [abierta, setAbierta] = React.useState(abiertaPorDefault);
  return (
    <div className="ct">
      <div className="ct-hd">
        <button
          type="button"
          className="ct-toggle"
          aria-expanded={abierta}
          onClick={() => setAbierta((v) => !v)}
        >
          <span className="ct-toggle-ico">{abierta ? "▾" : "▸"}</span> {titulo}
        </button>
      </div>
      {abierta && children}
    </div>
  );
}
