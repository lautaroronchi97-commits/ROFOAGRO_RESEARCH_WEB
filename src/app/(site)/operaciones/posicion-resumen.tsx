"use client";

import { fmtNeto } from "@/lib/operaciones/matriz-vista";
import { PRODUCTO_LABEL } from "@/lib/operaciones/tipos";
import type { ResumenPosicion, ResumenProducto } from "@/lib/operaciones/resumen";
import type { Estado } from "@/lib/operaciones/posicion";

/**
 * Resumen ejecutivo de "Posición diaria" (mejora post-C31, 06/08/2026 — vuelta
 * 4): la lectura de un vistazo ANTES de las matrices — neto TOTAL por producto
 * (físico + futuros acumulados a hoy, no solo el movimiento del día) con
 * desglose físico/futuros. Muestra los MISMOS números que las tablas de abajo
 * (lib pura `resumen.ts`, cero fórmula nueva); las clases de signo
 * (`ct-pos`/`ct-neg`) son las de `ChartTabla`, para que verde/rojo signifique
 * lo mismo en toda la página. Sin el KPI de "Resultado futuros (hoy)" (pedido
 * de Lautaro 06/08/2026: solo los KPI por producto) — `resumen.ts` sigue
 * calculando ese resultado para el panel de futuros de abajo.
 */

const ESTADO_LABEL: Record<Estado, string> = {
  COMPRADOS: "Comprado",
  VENDIDOS: "Vendido",
  NEUTRO: "Calzado",
};

function claseSigno(n: number): string | undefined {
  return n > 0 ? "ct-pos" : n < 0 ? "ct-neg" : undefined;
}

/** Texto de cobertura (% calzado) para mostrar junto al desglose físico/futuros — `null` si no aplica. */
function textoCobertura(p: ResumenProducto): { texto: string; alerta: boolean } | null {
  switch (p.coberturaEstado) {
    case "cubierto":
      return { texto: `Calzado ${p.pctCalzado}%`, alerta: false };
    case "sobre_cubierto":
      return { texto: `Sobre-cubierto (${p.pctCalzado}%)`, alerta: true };
    case "sin_cobertura":
      // Solo alerta si hay futuros en la MISMA dirección que el físico (exposición
      // que se suma en vez de cubrirse) — si no hay futuros, no hay nada que decir acá.
      return p.futurosTn !== 0 ? { texto: "Sin cobertura — misma dirección", alerta: true } : null;
    case "sin_fisico":
      return null;
  }
}

function KpiProducto({ p }: { p: ResumenProducto }) {
  const hayDesglose = p.futurosTn !== 0;
  const cobertura = textoCobertura(p);
  return (
    <div className="op-kpi">
      <span className="op-kpi-l">{PRODUCTO_LABEL[p.producto]}</span>
      <span className={`op-kpi-v ${claseSigno(p.totalTn) ?? ""}`.trim()}>
        {fmtNeto(p.totalTn) === "—" ? "0,00" : fmtNeto(p.totalTn)} <small>tn</small>
      </span>
      <span className={`op-kpi-estado ${claseSigno(p.totalTn) ?? "dim"}`.trim()}>{ESTADO_LABEL[p.estado]}</span>
      {hayDesglose && (
        <span className="op-kpi-sub">
          Físico {fmtNeto(p.fisicoTn)} · Futuros {fmtNeto(p.futurosTn)}
        </span>
      )}
      {cobertura && (
        <span className={`op-kpi-sub${cobertura.alerta ? " op-kpi-alerta" : ""}`}>{cobertura.texto}</span>
      )}
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
