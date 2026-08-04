import type { Impacto } from "@/lib/interpretaciones";

const GRANO_LABEL: Record<string, string> = { soja: "Soja", maiz: "Maíz", trigo: "Trigo" };

/**
 * Badges de impacto por grano de una interpretación (V3, `interpretaciones.impacto`) —
 * `{"soja":"alcista"|"neutral"|"bajista", ...}`, solo los granos que el reporte toca. No
 * renderiza nada si `impacto` está vacío (interpretaciones de V2 o anteriores, o mientras E2
 * todavía no lo escribe).
 */
export function ImpactoBadges({ impacto }: { impacto: Impacto | null | undefined }) {
  const entradas = Object.entries(impacto ?? {}).filter((e): e is [string, NonNullable<(typeof e)[1]>] => !!e[1]);
  if (entradas.length === 0) return null;
  return (
    <div className="impacto-badges">
      {entradas.map(([grano, valor]) => (
        <span key={grano} className={`impacto-badge ${valor}`}>
          {GRANO_LABEL[grano] ?? grano} {valor === "alcista" ? "▲" : valor === "bajista" ? "▼" : "="}
        </span>
      ))}
    </div>
  );
}
