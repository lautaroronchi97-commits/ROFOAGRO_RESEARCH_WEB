import {
  PRODUCTOS,
  PRODUCTOS_CON_FUTURO,
  TIPO_LABEL,
  CONDICION_LABEL,
  PRECIO_MODO_LABEL,
  type OperacionLado,
  type OperacionProducto,
  type OperacionTipo,
  type OperacionCondicion,
  type PrecioModo,
  type Moneda,
} from "./tipos";

/**
 * Lib PURA de "Operaciones diarias de clientes" (C31, docs/PLAN_OPERACIONES_CLIENTES.md
 * §8): normalización de volumen, validación de una operación (mismos checks que el
 * DDL, para errores amigables antes de pegar a la base), campañas del selector (§7.7)
 * y resolución del precio "pizarra" en lectura (§5.4). Sin `server-only`: se testea
 * directo, y la usan tanto server actions como componentes.
 */

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// ============================================================================
// Volumen (§1.10): TN con 2 decimales, carga en tn o kg.
// ============================================================================

export function normalizarVolumen(valor: number, unidad: "tn" | "kg"): number {
  const tn = unidad === "kg" ? valor / 1000 : valor;
  return Math.round(tn * 100) / 100;
}

// ============================================================================
// Campañas del selector (§7.7): las 3 vigentes alrededor de hoy, rotan solas.
// Convención genérica (no por producto, a diferencia de lineup/campanas.ts, que
// tiene un mes de inicio propio por grano): el corte se puso en OCTUBRE (arranque
// de la siembra gruesa) porque es la evidencia real que tenemos — al contestar la
// pregunta 9 el 05/08/2026, Lautoro escribió como ejemplo "25/26 ; 26/27", es
// decir que en esa fecha la campaña "actual" para él seguía siendo 25/26, no
// 26/27. El campo también acepta cualquier "AA/AA" escrito a mano.
// ============================================================================

function pad2(n: number): string {
  return String(((n % 100) + 100) % 100).padStart(2, "0");
}

/** Año de inicio (4 dígitos) de la campaña vigente en la fecha dada. */
export function campaniaActualIniYear(hoyISO: string): number {
  const [y, m] = hoyISO.split("-").map(Number);
  return (m ?? 1) >= 10 ? (y ?? 0) : (y ?? 0) - 1;
}

/** "2025" → "25/26". */
export function campaniaLabel(anioInicio: number): string {
  return `${pad2(anioInicio)}/${pad2(anioInicio + 1)}`;
}

/** Las 3 campañas del selector, en orden cronológico (anterior, actual, siguiente). */
export function campaniasVigentes(hoyISO: string): string[] {
  const actual = campaniaActualIniYear(hoyISO);
  return [actual - 1, actual, actual + 1].map(campaniaLabel);
}

/** "25/26" válido (regex de la constraint `campania` del DDL). */
export function campaniaValida(s: string): boolean {
  return /^[0-9]{2}\/[0-9]{2}$/.test(s);
}

// ============================================================================
// Validación de una operación (§4.2 en TS, mismos checks que el DDL).
// ============================================================================

export type OperacionInputRaw = {
  fecha: string;
  lado: string;
  producto: string;
  tipo: string;
  condicion: string; // "" = sin condición
  campania: string;
  /** Ya convertido a TN por el caller (`normalizarVolumen`). */
  volumen: number | null;
  precioModo: string;
  precio: number | null;
  moneda: string; // "" = sin moneda
  descuentoPct: number | null;
  descuentoMonto: number | null;
  entregaDesde: string; // "" = sin fecha
  entregaHasta: string; // "" = sin fecha
  posicionA3: string; // "" = sin posición
  contraparte: string;
  nroContrato: string;
  observaciones: string;
};

export type OperacionValidada = {
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
};

export type ValidacionResultado = { ok: true; data: OperacionValidada } | { ok: false; error: string };

export function validarOperacion(input: OperacionInputRaw): ValidacionResultado {
  if (!FECHA_RE.test(input.fecha)) return { ok: false, error: "Elegí la fecha de la operación." };
  if (input.lado !== "compra" && input.lado !== "venta") {
    return { ok: false, error: "Elegí compra o venta." };
  }
  if (!PRODUCTOS.includes(input.producto as OperacionProducto)) {
    return { ok: false, error: "Elegí un producto válido." };
  }
  if (!(input.tipo in TIPO_LABEL)) return { ok: false, error: "Elegí el tipo de negocio." };
  const tipo = input.tipo as OperacionTipo;

  let condicion: OperacionCondicion | null = null;
  if (input.condicion) {
    if (!(input.condicion in CONDICION_LABEL)) return { ok: false, error: "Condición inválida." };
    condicion = input.condicion as OperacionCondicion;
  }

  if (!campaniaValida(input.campania)) {
    return { ok: false, error: "La campaña debe tener el formato AA/AA (ej. 25/26)." };
  }

  if (input.volumen == null || !(input.volumen > 0)) {
    return { ok: false, error: "Ingresá un volumen mayor a cero." };
  }

  if (!(input.precioModo in PRECIO_MODO_LABEL)) return { ok: false, error: "Elegí el modo de precio." };
  const precio_modo = input.precioModo as PrecioModo;

  let moneda: Moneda | null = null;
  if (input.moneda) {
    if (input.moneda !== "usd" && input.moneda !== "ars") return { ok: false, error: "Moneda inválida." };
    moneda = input.moneda;
  }

  let precio: number | null = null;
  if (precio_modo === "manual") {
    if (input.precio == null || !(input.precio > 0)) return { ok: false, error: "Ingresá el precio de la operación." };
    if (!moneda) return { ok: false, error: "Elegí la moneda del precio." };
    precio = input.precio;
  } else if (precio_modo === "pizarra") {
    if (!moneda) return { ok: false, error: "Elegí en qué moneda mostrar la pizarra." };
  }
  // sin_precio: precio queda null pase lo que pase.

  if (tipo === "fijacion" && precio_modo !== "manual") {
    return { ok: false, error: 'Una fijación siempre tiene precio (no puede ser "pizarra" ni "sin precio").' };
  }

  // Pedido de Lautaro 06/08/2026: un negocio con condición "a fijar" va SIN
  // precio — justamente el precio llega después, con la fijación. Solo aplica a
  // los físicos (disponible/forward): la fijación misma y el futuro A3 llevan
  // precio manual por definición (checks de arriba).
  if (condicion === "a_fijar" && (tipo === "disponible" || tipo === "forward") && precio_modo !== "sin_precio") {
    return { ok: false, error: 'Un negocio "a fijar" va sin precio — el precio se genera después con la fijación.' };
  }

  const descuento_pct = input.descuentoPct != null && input.descuentoPct > 0 ? input.descuentoPct : null;
  if (descuento_pct != null && (descuento_pct < 0 || descuento_pct > 100)) {
    return { ok: false, error: "El descuento en % debe estar entre 0 y 100." };
  }
  const descuento_monto = input.descuentoMonto != null && input.descuentoMonto > 0 ? input.descuentoMonto : null;
  if (descuento_monto != null && descuento_monto < 0) {
    return { ok: false, error: "El descuento en monto no puede ser negativo." };
  }

  const entrega_desde: string | null = input.entregaDesde || null;
  const entrega_hasta: string | null = input.entregaHasta || null;
  if (entrega_desde && !FECHA_RE.test(entrega_desde)) return { ok: false, error: "Fecha de entrega (desde) inválida." };
  if (entrega_hasta && !FECHA_RE.test(entrega_hasta)) return { ok: false, error: "Fecha de entrega (hasta) inválida." };
  if (tipo === "forward" && !entrega_desde) {
    return { ok: false, error: "Un forward necesita la fecha de inicio de entrega." };
  }
  if (entrega_desde && entrega_hasta && entrega_hasta < entrega_desde) {
    return { ok: false, error: 'La entrega "hasta" no puede ser anterior a "desde".' };
  }

  let posicion_a3: string | null = input.posicionA3 ? input.posicionA3.toUpperCase() : null;
  if (tipo === "futuro_a3") {
    if (!posicion_a3) return { ok: false, error: "Elegí la posición de A3 (ej. NOV26)." };
    if (!/^[A-Z]{3}\d{2}$/.test(posicion_a3)) {
      return { ok: false, error: "Posición de A3 inválida (formato ej. NOV26)." };
    }
    if (precio_modo !== "manual") {
      return { ok: false, error: "Un futuro A3 necesita el precio de ejecución (modo Precio fijo)." };
    }
    if (!PRODUCTOS_CON_FUTURO.includes(input.producto as OperacionProducto)) {
      return { ok: false, error: "Ese producto no tiene futuro A3." };
    }
  } else {
    posicion_a3 = null;
  }

  return {
    ok: true,
    data: {
      fecha: input.fecha,
      lado: input.lado,
      producto: input.producto as OperacionProducto,
      tipo,
      condicion,
      campania: input.campania,
      volumen_tn: input.volumen,
      precio_modo,
      precio,
      moneda,
      descuento_pct,
      descuento_monto,
      entrega_desde,
      entrega_hasta,
      posicion_a3,
      contraparte: input.contraparte.trim() || null,
      nro_contrato: input.nroContrato.trim() || null,
      observaciones: input.observaciones.trim() || null,
    },
  };
}

// ============================================================================
// Precio "pizarra": resolución en LECTURA, cero proceso manual (§5.4). La
// referencia es la pizarra del DÍA SIGUIENTE a la operación (decisión de
// Lautoro §7.3: "la pizarra refleja el mercado del día anterior"), con un tope
// de 7 días corridos para no agarrar una pizarra lejana si el cron no corrió.
// ============================================================================

const TOPE_DIAS_PIZARRA = 7;

/** "YYYY-MM-DD" + n días corridos (aritmética pura UTC, sin husos horarios). */
export function sumarDiasISO(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export type PizarraFila = { fecha: string; precio_ars: number | null; precio_usd: number | null };

/**
 * Primera pizarra con fecha POSTERIOR a la de la operación, dentro de los 7 días
 * corridos siguientes. `null` si ninguna aplica todavía (fin de semana/feriado
 * largo, o el cron de hoy no corrió) — el caller muestra "Pizarra (pendiente)",
 * nunca inventa un valor lejano.
 */
export function elegirPizarraSiguiente(fechaOperacion: string, candidatas: PizarraFila[]): PizarraFila | null {
  const limite = sumarDiasISO(fechaOperacion, TOPE_DIAS_PIZARRA);
  const validas = candidatas
    .filter((p) => p.fecha > fechaOperacion && p.fecha <= limite)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  return validas[0] ?? null;
}

/** `base × (1 − pct/100) − monto` — primero el %, después el monto fijo (§7.4). */
export function aplicarDescuentos(base: number, pct: number | null, monto: number | null): number {
  const conPct = pct ? base * (1 - pct / 100) : base;
  return monto ? conPct - monto : conPct;
}

export type PrecioResuelto =
  | { estado: "manual"; valor: number }
  | { estado: "pizarra_resuelta"; valor: number; fechaPizarra: string }
  | { estado: "pizarra_pendiente" }
  | { estado: "sin_precio" };

/** Precio final a mostrar de una operación, dado su modo y (si aplica) la pizarra siguiente ya elegida. */
export function resolverPrecio(
  op: {
    precio_modo: PrecioModo;
    precio: number | null;
    moneda: Moneda | null;
    descuento_pct: number | null;
    descuento_monto: number | null;
  },
  pizarraSiguiente: PizarraFila | null,
): PrecioResuelto {
  if (op.precio_modo === "sin_precio") return { estado: "sin_precio" };
  if (op.precio_modo === "manual") {
    if (op.precio == null) return { estado: "sin_precio" };
    return { estado: "manual", valor: aplicarDescuentos(op.precio, op.descuento_pct, op.descuento_monto) };
  }
  // pizarra
  if (!pizarraSiguiente) return { estado: "pizarra_pendiente" };
  const base = op.moneda === "usd" ? pizarraSiguiente.precio_usd : pizarraSiguiente.precio_ars;
  if (base == null) return { estado: "pizarra_pendiente" };
  return {
    estado: "pizarra_resuelta",
    valor: aplicarDescuentos(base, op.descuento_pct, op.descuento_monto),
    fechaPizarra: pizarraSiguiente.fecha,
  };
}
