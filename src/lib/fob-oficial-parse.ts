/**
 * Parsing puro (testeable) de la respuesta de la API de FOB oficial de SAGyP/MAGyP — separado de
 * `fob-oficial.ts` (que trae "server-only" por el fetch) para que `scripts/ingest-fas.mjs`
 * (C32/F1) pueda importar las posiciones NCM sin arrastrar el marker de server-only a un script
 * de Node plano (mismo motivo por el que existe `capacidad-bcr-parse.ts` separado de
 * `capacidad.ts`).
 */

/** Posición NCM homologada por grano — solo la variedad "estándar"/comercial de cada uno. */
export const POSICIONES_FOB: Record<string, string> = {
  SOJ: "12019000190C", // habas de soja, "los demás", a granel ≤15% embolsado
  MAI: "10059010190Y", // maíz, "los demás" (estándar), a granel ≤15% embolsado
  TRI: "10019900110W", // trigo pan, "los demás", a granel ≤15% embolsado
  SOR: "10079000100W", // sorgo granífero, "los demás", a granel ≤15% embolsado
  GIR: "12060090910Y", // semilla de girasol, uso industrial "los demás" (oleaginoso estándar, excluye confitería)
};

/**
 * Posiciones de los subproductos de la industria aceitera (soja y girasol) — para el FAS
 * Teórico INDUSTRIA (`capacidad-industria-modelo.ts`). Homologación completa (con la evidencia
 * numérica del cruce empírico) en `fob-oficial.ts`, donde vivían estas 2 constantes antes de
 * moverse acá.
 */
export const POSICIONES_FOB_INDUSTRIA: Record<string, string> = {
  SOJ_ACEITE: "15071000100Q", // aceite de soja crudo, a granel
  SOJ_HARINA: "23040010100B", // harina/pellets de soja (extracción)
  GIR_ACEITE: "15121110310E", // aceite de girasol crudo, a granel
  GIR_HARINA: "23063010310V", // harina/pellets de girasol (extracción)
};

export type PostFob = {
  fecha: string;
  circular: string;
  posicion: string;
  precio: number;
  mesDesde: number;
  añoDesde: number;
  mesHasta: number;
  añoHasta: number;
};

/**
 * Entre todas las ventanas de embarque publicadas para una posición en el día, la fila "spot"
 * es la de inicio (mesDesde/añoDesde) más cercano — la ventana de embarque en curso.
 */
export function filaSpot(posts: PostFob[], posicion: string): PostFob | null {
  const filas = posts.filter((p) => p.posicion === posicion);
  if (filas.length === 0) return null;
  return filas.reduce((min, p) => {
    const keyP = p.añoDesde * 12 + p.mesDesde;
    const keyMin = min.añoDesde * 12 + min.mesDesde;
    return keyP < keyMin ? p : min;
  });
}
