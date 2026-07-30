/**
 * Familias de producto DJVE (relevamiento web R8, punto 52): agrupar por palabra clave
 * en el nombre real del producto de `djve_resumen` — cubre "todo lo relacionado" con
 * cada grano (aceites, subproductos, variantes orgánicas), no solo el grano en limpio.
 * Construido y verificado contra los 88 productos reales de la vista (18 con tonelaje
 * >0 hoy): sorgo no entra en ninguna de las 5 familias que pidió Lautoro → "Otros".
 *
 * Módulo puro (sin `server-only`) para que sea testeable con Vitest sin el resto de
 * `djve.ts` (que sí importa `server-only` y rompería el test apenas se lo importara).
 */

export type Familia = "Maíz" | "Soja" | "Trigo" | "Girasol" | "Cebada y malta" | "Otros";
export const ORDEN_FAMILIAS: Familia[] = ["Maíz", "Soja", "Trigo", "Girasol", "Cebada y malta", "Otros"];

export function familiaDe(producto: string): Familia {
  const p = producto.toUpperCase();
  if (p.includes("MAIZ") || p.includes("MAÍZ")) return "Maíz";
  if (p.includes("SOJA")) return "Soja";
  if (p.includes("TRIGO")) return "Trigo";
  if (p.includes("GIRASOL")) return "Girasol";
  if (p.includes("CEBADA") || p.includes("MALTA")) return "Cebada y malta";
  return "Otros";
}
