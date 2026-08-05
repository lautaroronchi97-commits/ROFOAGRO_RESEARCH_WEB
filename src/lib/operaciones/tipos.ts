import type { GranoKey } from "@/components/filtro-grano";

/**
 * Tipos compartidos de "Operaciones diarias de clientes" (C31, client-safe: sin
 * `server-only`). Espejo 1:1 de las columnas/checks de la tabla `operaciones`
 * (docs/PLAN_OPERACIONES_CLIENTES.md §4.2) — si se toca un check acá, tocar la
 * migración también, y viceversa.
 */

export type OperacionLado = "compra" | "venta";
export type OperacionProducto = "soja" | "maiz" | "trigo" | "girasol" | "sorgo";
export type OperacionTipo = "disponible" | "forward" | "fijacion" | "futuro_a3";
export type OperacionCondicion = "carta_garantia" | "a_fijar" | "a_precio" | "forward";
export type PrecioModo = "manual" | "pizarra" | "sin_precio";
export type Moneda = "usd" | "ars";

export const PRODUCTOS: readonly OperacionProducto[] = ["soja", "maiz", "trigo", "girasol", "sorgo"];

export const PRODUCTO_LABEL: Record<OperacionProducto, string> = {
  soja: "Soja",
  maiz: "Maíz",
  trigo: "Trigo",
  girasol: "Girasol",
  sorgo: "Sorgo",
};

/** Código de 3 letras (para reusar `FiltroGrano`/`pizarra.ts`/`CurvaPicker`, que hablan así). */
export const PRODUCTO_GRANO: Record<OperacionProducto, GranoKey> = {
  soja: "SOJ",
  maiz: "MAI",
  trigo: "TRI",
  girasol: "GIR",
  sorgo: "SOR",
};

export const GRANO_PRODUCTO: Record<GranoKey, OperacionProducto> = {
  SOJ: "soja",
  MAI: "maiz",
  TRI: "trigo",
  GIR: "girasol",
  SOR: "sorgo",
};

// Solo soja/maíz/trigo tienen futuro A3 — girasol/sorgo son solo físico
// (pizarra.ts:29-31, misma restricción que "Negocios de planta").
export const PRODUCTOS_CON_FUTURO: readonly OperacionProducto[] = ["soja", "maiz", "trigo"];

export const TIPO_LABEL: Record<OperacionTipo, string> = {
  disponible: "Disponible (entrega inmediata)",
  forward: "Forward (entrega futura)",
  fijacion: "Fijación",
  futuro_a3: "Futuro A3",
};

export const CONDICION_LABEL: Record<OperacionCondicion, string> = {
  carta_garantia: "Carta de garantía",
  a_fijar: "A fijar",
  a_precio: "A precio",
  forward: "Forward",
};

export const MONEDA_LABEL: Record<Moneda, string> = { usd: "USD", ars: "$" };

export const PRECIO_MODO_LABEL: Record<PrecioModo, string> = {
  manual: "Precio fijo",
  pizarra: "Pizarra",
  sin_precio: "Sin precio (a fijar)",
};

/** Una fila de `operaciones`, tal como la devuelve Supabase (fechas como ISO string). */
export type Operacion = {
  id: string;
  empresa_id: string;
  fecha: string;
  lado: OperacionLado;
  producto: OperacionProducto;
  tipo: OperacionTipo;
  condicion: OperacionCondicion | null;
  campania: string;
  volumen_tn: number;
  precio_modo: PrecioModo;
  precio: number | null;
  moneda: Moneda | null;
  descuento_pct: number | null;
  descuento_monto: number | null;
  entrega_desde: string | null;
  entrega_hasta: string | null;
  posicion_a3: string | null;
  contraparte: string | null;
  nro_contrato: string | null;
  observaciones: string | null;
  anulada: boolean;
  creado_por: string | null;
  creado_en: string;
  actualizado_por: string | null;
  actualizado_en: string;
};

export type OperacionAccion = "crear" | "editar" | "anular" | "restaurar";

/** Una fila de `operaciones_log` (§4.3) — el rastro que escribe el trigger. */
export type OperacionLogEntry = {
  id: number;
  operacion_id: string;
  empresa_id: string;
  usuario_id: string | null;
  accion: OperacionAccion;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown>;
  en: string;
};
