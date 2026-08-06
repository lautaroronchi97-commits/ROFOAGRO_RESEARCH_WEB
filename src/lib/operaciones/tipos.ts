import type { GranoKey } from "@/components/filtro-grano";

/**
 * Tipos compartidos de "Operaciones diarias de clientes" (C31, client-safe: sin
 * `server-only`). Espejo 1:1 de las columnas/checks de la tabla `operaciones`
 * (docs/PLAN_OPERACIONES_CLIENTES.md §4.2) — si se toca un check acá, tocar la
 * migración también, y viceversa.
 */

export type OperacionLado = "compra" | "venta";
export type OperacionProducto = "soja" | "maiz" | "trigo" | "girasol" | "sorgo" | "expeller_soja" | "aceite_soja";
export type OperacionTipo = "disponible" | "forward" | "fijacion" | "futuro_a3";
export type OperacionCondicion = "a_fijar" | "a_precio" | "pago_anticipado" | "pizarra";
export type PrecioModo = "manual" | "pizarra" | "sin_precio";
export type Moneda = "usd" | "ars";

export const PRODUCTOS: readonly OperacionProducto[] = [
  "soja",
  "maiz",
  "trigo",
  "girasol",
  "sorgo",
  "expeller_soja",
  "aceite_soja",
];

export const PRODUCTO_LABEL: Record<OperacionProducto, string> = {
  soja: "Soja",
  maiz: "Maíz",
  trigo: "Trigo",
  girasol: "Girasol",
  sorgo: "Sorgo",
  expeller_soja: "Expeller de soja",
  aceite_soja: "Aceite de soja",
};

/**
 * Código de 3 letras (para reusar `FiltroGrano`/`pizarra.ts`/`CurvaPicker`, que hablan así).
 * `expeller_soja`/`aceite_soja` no cotizan en A3 (nunca entran a `PRODUCTOS_CON_FUTURO`, ver
 * abajo) — el código EXP/ACE solo alimenta el chip propio de `FiltroGrano`, `CurvaPicker`
 * nunca lo consulta para ellos.
 */
export const PRODUCTO_GRANO: Record<OperacionProducto, GranoKey> = {
  soja: "SOJ",
  maiz: "MAI",
  trigo: "TRI",
  girasol: "GIR",
  sorgo: "SOR",
  expeller_soja: "EXP",
  aceite_soja: "ACE",
};

export const GRANO_PRODUCTO: Record<GranoKey, OperacionProducto> = {
  SOJ: "soja",
  MAI: "maiz",
  TRI: "trigo",
  GIR: "girasol",
  SOR: "sorgo",
  EXP: "expeller_soja",
  ACE: "aceite_soja",
};

// Solo soja/maíz/trigo tienen futuro A3 — girasol/sorgo/expeller de soja/aceite de soja
// son solo físico (pizarra.ts:29-31, misma restricción que "Negocios de planta"; expeller
// y aceite tampoco tienen pizarra CAC — su modo "pizarra" degrada honesto a "pendiente",
// mismo criterio que cualquier producto sin cotización).
export const PRODUCTOS_CON_FUTURO: readonly OperacionProducto[] = ["soja", "maiz", "trigo"];

export const TIPO_LABEL: Record<OperacionTipo, string> = {
  disponible: "Disponible (entrega inmediata)",
  forward: "Forward (entrega futura)",
  fijacion: "Fijación",
  futuro_a3: "Futuro A3",
};

export const CONDICION_LABEL: Record<OperacionCondicion, string> = {
  a_fijar: "A fijar",
  a_precio: "A precio",
  pago_anticipado: "Pago anticipado",
  pizarra: "Pizarra",
};

/**
 * Qué condiciones admite cada tipo de negocio (pedido de Lautaro 06/08/2026):
 * disponible/forward admiten las 4 · fijación SOLO pizarra o a precio (el
 * precio de una fijación no puede quedar "a fijar" — sería circular — ni ser
 * "pago anticipado", que es una condición del físico) · futuro A3 no usa
 * condición (precio siempre manual, posición sugerida por A3, ver
 * `PRODUCTOS_CON_FUTURO`/`CurvaPicker`) — array vacío = campo oculto/no aplica.
 */
export const CONDICIONES_POR_TIPO: Record<OperacionTipo, readonly OperacionCondicion[]> = {
  disponible: ["a_fijar", "a_precio", "pago_anticipado", "pizarra"],
  forward: ["a_fijar", "a_precio", "pago_anticipado", "pizarra"],
  fijacion: ["pizarra", "a_precio"],
  futuro_a3: [],
};

export const MONEDA_LABEL: Record<Moneda, string> = { usd: "USD", ars: "$" };

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
  /** Período de fijación (solo condición "a_fijar") — desde/hasta de cuándo se puede fijar el precio. */
  fijacion_desde: string | null;
  fijacion_hasta: string | null;
  posicion_a3: string | null;
  es_canje: boolean;
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
