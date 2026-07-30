"use client";

import type { GranoPizarraDual } from "./use-precio-dual";

export type { GranoPizarraDual } from "./use-precio-dual";

/**
 * Selector de grano → pizarra sugerida (patrón dual $/USD, R4 puntos 38-44).
 * Mismo lenguaje visual que `CurvaPicker` (caja `.curva-pick`, un select) — a
 * propósito: es el MISMO tipo de control ("elegí un origen, autocompletá campos
 * abajo"), no un widget nuevo. El padre pone los campos USD/ARS reales como
 * `.calc-field` normales (ver `usePrecioDual`), no acá — así no queda un input
 * chico duplicando uno grande para el mismo valor.
 */
export function PickerPizarra({
  granos,
  onPick,
  label = "Traer de la pizarra",
}: {
  granos: GranoPizarraDual[];
  onPick: (g: GranoPizarraDual) => void;
  label?: string;
}) {
  if (!granos || granos.length === 0) return null;
  return (
    <div className="curva-pick">
      <span className="curva-pick-lbl">{label}</span>
      <select
        aria-label="Grano"
        defaultValue=""
        onChange={(e) => {
          const g = granos[Number(e.target.value)];
          if (g) onPick(g);
          e.currentTarget.selectedIndex = 0;
        }}
      >
        <option value="" disabled>Grano…</option>
        {granos.map((g, i) => (
          <option key={g.underlying} value={i}>{g.nombre}</option>
        ))}
      </select>
    </div>
  );
}
