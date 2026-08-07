import type { ArbRow } from "./arbitrajes-cierres";

/**
 * Posiciones de referencia del bloque Argentina de "El mercado hoy" (relevamiento
 * 29/07, punto 20). Antes del 07/08/2026 esto era un año fijo por posición (ej.
 * "Maíz JUL26") que se venció sin que nadie lo notara — la fila quedó en "—" para
 * siempre porque `getArbitrajes()` ya no lista posiciones vencidas. Ahora se
 * configura solo el MES de referencia por grano; `resolverPosicionViva` lo resuelve
 * contra las posiciones VIVAS de cada render, así el año nunca se congela.
 */
export const POSICIONES_AR_REF: { underlying: string; mes: string; nombre: string; glyph: "soja" | "maiz" | "trigo" }[] = [
  { underlying: "MAI", mes: "JUL", nombre: "Maíz", glyph: "maiz" },
  { underlying: "SOJ", mes: "NOV", nombre: "Soja", glyph: "soja" },
  { underlying: "SOJ", mes: "MAY", nombre: "Soja", glyph: "soja" },
  { underlying: "TRI", mes: "DIC", nombre: "Trigo", glyph: "trigo" },
];

/**
 * Elige la fila viva de `rows` (ya filtradas a no-vencidas y ordenadas por
 * vencimiento por `getArbitrajes()`) para el mes de referencia pedido: la más
 * próxima cuya posición empieza con ese mes (resuelve el año solo); si ese mes no
 * está listado hoy (rollover), cae a la posición viva más próxima del grano en vez
 * de dejar la fila vacía — nunca devuelve una posición vencida.
 */
export function resolverPosicionViva(mes: string, rows: ArbRow[]): ArbRow | null {
  const porMes = rows.find((r) => r.pos.toUpperCase().startsWith(mes.toUpperCase()));
  return porMes ?? rows[0] ?? null;
}
