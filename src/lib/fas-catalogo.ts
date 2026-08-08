/**
 * Catálogo de productos de `fas_historico` (C32/F1, docs/PLAN_CALOR_MERCADERIA.md §3.3/§4/§5
 * punto 5) — mapea el nombre de producto TAL COMO viene en la serie histórica de Agrochat ("FAS
 * Teórico Oficial SAGyP por Producto", ver §4.1 del plan) al código interno que ya usa el resto
 * del sitio para los 5 granos con fuente física en vivo (`src/lib/lineup/config.ts` — los mismos
 * códigos de `codigo_interno`/DJVE, no los de 2-3 letras de `capacidad.ts`/`pizarra.ts`), para
 * que las filas de `fas_historico` puedan cruzarse 1:1 con `lineup_gap_hist`/`getSintesis()` sin
 * un segundo mapeo escondido en otro archivo.
 *
 * Los aceites y las 2 cebadas del CSV (F4 del plan, backlog) no tienen hoy un consumidor propio
 * — se cargan IGUAL (mismo pipeline, mismo `producto` en la tabla) pero sin forzar un código de
 * `config.ts` que todavía no corresponde 1:1: "Cebada C" (cervecera) no tiene código en
 * `PRODUCTOS` (config.ts la excluye a propósito, ver su comentario "Fertilizantes y malta
 * (cebada cervecera) quedan afuera") — se guarda con un identificador propio en vez de inventarle
 * un código que no existe.
 */

export type FasProductoCsv =
  | "Soja"
  | "Maíz"
  | "Trigo Pan"
  | "Girasol"
  | "Sorgo"
  | "Aceite de Soja"
  | "Aceite de Girasol"
  | "Cebada C"
  | "Cebada F";

/**
 * CSV → `fas_historico.producto`. Los 5 primeros son los granos con pata física en
 * `lineup/config.ts` (mismos códigos que `PRODUCTOS_MESA`/DJVE); Soja mapea a **SBS** (grano
 * exportado sin procesar) — la vara industria (decisión 6 del plan, "SOJA = VARA INDUSTRIA") es
 * una lectura que arma F2 en el momento de mostrar la página, cruzando SBS con
 * `capacidad.industriaSoja`, no un producto distinto acá.
 */
export const MAPEO_PRODUCTO_FAS: Record<FasProductoCsv, string> = {
  Soja: "SBS",
  Maíz: "MAIZE",
  "Trigo Pan": "WHEAT",
  Girasol: "SFSEED",
  Sorgo: "SORGHUM",
  "Aceite de Soja": "SBO", // mismo código que lineup/config.ts (F4, sin consumidor todavía)
  "Aceite de Girasol": "SFO", // ídem
  "Cebada C": "CEBADA_C", // cervecera — sin código en lineup/config.ts (excluida a propósito ahí)
  "Cebada F": "BARLEY", // forrajera — coincide con lineup/config.ts
};

/** Los 5 productos con pata física hoy (línea-up + DJVE) — universo de la síntesis F2. */
export const PRODUCTOS_FAS_GRANO = ["SBS", "MAIZE", "WHEAT", "SFSEED", "SORGHUM"] as const;

/** Underlying de 2-3 letras (`capacidad.ts`/`pizarra.ts`) → código de producto de `fas_historico`. */
export const UNDERLYING_A_PRODUCTO_FAS: Record<string, string> = {
  SOJ: "SBS",
  MAI: "MAIZE",
  TRI: "WHEAT",
  GIR: "SFSEED",
  SOR: "SORGHUM",
};

/** Normaliza el nombre de producto del CSV (recorta espacios, tolera mayúsculas) a la clave del mapeo. */
export function normalizarProductoCsv(raw: string): FasProductoCsv | null {
  const t = raw.trim();
  const match = (Object.keys(MAPEO_PRODUCTO_FAS) as FasProductoCsv[]).find(
    (k) => k.toLowerCase() === t.toLowerCase(),
  );
  return match ?? null;
}
