"use client";

import { fmtNeto } from "@/lib/operaciones/matriz-vista";
import { PRODUCTO_LABEL } from "@/lib/operaciones/tipos";
import type { ResumenPosicion, ResumenProducto } from "@/lib/operaciones/resumen";
import type { Estado } from "@/lib/operaciones/posicion";

/**
 * Resumen ejecutivo de "Posición diaria" (mejora post-C31, 06/08/2026 — vuelta
 * 4): la lectura de un vistazo ANTES de las matrices — neto TOTAL de pricing
 * por producto (mercadería con precio + fijaciones + futuros, no el físico).
 * Pedido explícito de Lautaro: "tiene que reflejar el número del pricing, no
 * me importa el porcentaje de calzado ni el físico" — sin desglose ni % de
 * cobertura, solo el número y el estado. Mismos números que "Pricing
 * acumulado" (lib pura `resumen.ts`, cero fórmula nueva); las clases de signo
 * (`ct-pos`/`ct-neg`) son las de `ChartTabla`, para que verde/rojo signifique
 * lo mismo en toda la página.
 */

const ESTADO_LABEL: Record<Estado, string> = {
  COMPRADOS: "Comprado",
  VENDIDOS: "Vendido",
  NEUTRO: "Calzado",
};

function claseSigno(n: number): string | undefined {
  return n > 0 ? "ct-pos" : n < 0 ? "ct-neg" : undefined;
}

function KpiProducto({ p }: { p: ResumenProducto }) {
  return (
    <div className="op-kpi">
      <span className="op-kpi-l">{PRODUCTO_LABEL[p.producto]}</span>
      <span className={`op-kpi-v ${claseSigno(p.totalTn) ?? ""}`.trim()}>
        {fmtNeto(p.totalTn) === "—" ? "0,00" : fmtNeto(p.totalTn)} <small>tn</small>
      </span>
      <span className={`op-kpi-estado ${claseSigno(p.totalTn) ?? "dim"}`.trim()}>{ESTADO_LABEL[p.estado]}</span>
    </div>
  );
}

export function PosicionResumen({ resumen }: { resumen: ResumenPosicion }) {
  const { productos } = resumen;
  if (productos.length === 0) return null;

  return (
    <div className="op-kpis" aria-label="Resumen de la posición">
      {productos.map((p) => (
        <KpiProducto key={p.producto} p={p} />
      ))}
    </div>
  );
}
