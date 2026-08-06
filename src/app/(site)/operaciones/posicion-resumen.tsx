"use client";

import { fmtNeto } from "@/lib/operaciones/matriz-vista";
import { PRODUCTO_LABEL } from "@/lib/operaciones/tipos";
import type { ResumenPosicion, ResumenProducto } from "@/lib/operaciones/resumen";
import type { Estado } from "@/lib/operaciones/posicion";

/**
 * Resumen ejecutivo de "Mi posición" (mejora post-C31, 06/08/2026): la lectura
 * de un vistazo ANTES de las matrices — neto por producto con desglose
 * físico/futuros y el resultado a hoy de los futuros valorizados. Muestra los
 * MISMOS números que las tablas de abajo (lib pura `resumen.ts`, cero fórmula
 * nueva); las clases de signo (`ct-pos`/`ct-neg`) son las de `ChartTabla`, para
 * que verde/rojo signifique lo mismo en toda la página.
 */

const ESTADO_LABEL: Record<Estado, string> = {
  COMPRADOS: "Comprado",
  VENDIDOS: "Vendido",
  NEUTRO: "Calzado",
};

function claseSigno(n: number): string | undefined {
  return n > 0 ? "ct-pos" : n < 0 ? "ct-neg" : undefined;
}

function fmtUsd(n: number): string {
  const abs = Math.abs(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${abs}`;
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
  const { productos, resultadoFuturosUsd, futurosSinValorizar } = resumen;
  const hayFuturos = resultadoFuturosUsd != null || futurosSinValorizar > 0;
  if (productos.length === 0 && !hayFuturos) return null;

  return (
    <div className="op-kpis" aria-label="Resumen de la posición">
      {productos.map((p) => (
        <KpiProducto key={p.producto} p={p} />
      ))}
      {hayFuturos && (
        <div className="op-kpi op-kpi-resultado">
          <span className="op-kpi-l">Resultado futuros (hoy)</span>
          {resultadoFuturosUsd != null ? (
            <span className={`op-kpi-v ${claseSigno(resultadoFuturosUsd) ?? ""}`.trim()}>
              {fmtUsd(resultadoFuturosUsd)} <small>USD</small>
            </span>
          ) : (
            <span className="op-kpi-v dim">—</span>
          )}
          {futurosSinValorizar > 0 && (
            <span className="op-kpi-sub">
              {futurosSinValorizar} {futurosSinValorizar === 1 ? "contrato" : "contratos"} sin valorizar
            </span>
          )}
        </div>
      )}
    </div>
  );
}
