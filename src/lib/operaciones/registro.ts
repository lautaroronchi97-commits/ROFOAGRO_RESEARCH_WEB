import {
  PRODUCTOS,
  PRODUCTOS_CON_FUTURO,
  TIPO_LABEL,
  CONDICION_LABEL,
  CONDICIONES_POR_TIPO,
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
  condicion: string; // "" = sin condición (solo válido en futuro A3, que no la usa)
  campania: string;
  /** Ya convertido a TN por el caller (`normalizarVolumen`). */
  volumen: number | null;
  precio: number | null;
  moneda: string; // "" = sin moneda
  descuentoPct: number | null;
  descuentoMonto: number | null;
  /** Comisión % del negocio (independiente del descuento — ej. mesa vs. flete/pizarra). */
  comisionPct: number | null;
  /** Confirma un precio de magnitud "rara" para la moneda elegida (ver `precioMonedaSospechoso`). */
  forzarMoneda: boolean;
  entregaDesde: string; // "" = sin fecha
  entregaHasta: string; // "" = sin fecha
  /** Período de fijación (solo condición "a_fijar"). */
  fijacionDesde: string; // "" = sin fecha
  fijacionHasta: string; // "" = sin fecha (libre/abierto)
  posicionA3: string; // "" = sin posición
  esCanje: boolean;
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
  comision_pct: number | null;
  entrega_desde: string | null;
  entrega_hasta: string | null;
  fijacion_desde: string | null;
  fijacion_hasta: string | null;
  posicion_a3: string | null;
  es_canje: boolean;
  contraparte: string | null;
  nro_contrato: string | null;
  observaciones: string | null;
};

export type ValidacionResultado = { ok: true; data: OperacionValidada } | { ok: false; error: string };

/**
 * El "Precio" ya no es un campo que el usuario elige: sale SIEMPRE de la
 * condición (pedido de Lautoro 06/08/2026) — "a fijar" no tiene precio
 * (llega con la fijación), "pizarra" lo resuelve el scraping del día
 * siguiente (§5.4), y "a precio"/"pago anticipado" son las 2 formas de
 * cargarlo a mano. El futuro A3 no usa condición: siempre es manual (precio
 * de ejecución), aparte de esta función.
 */
export function precioModoDeCondicion(condicion: OperacionCondicion): PrecioModo {
  if (condicion === "a_fijar") return "sin_precio";
  if (condicion === "pizarra") return "pizarra";
  return "manual"; // a_precio | pago_anticipado
}

// ============================================================================
// Guard de magnitud precio↔moneda (pedido de Lautoro 07/08/2026): "si el
// precio es 505.000 por supuesto son pesos, si el precio es 190 por supuesto
// son USD". Un precio de grano en USD/tn casi nunca llega a 5 cifras (soja/
// maíz/trigo rondan 150-350; aceite/expeller son más caros pero igual muy por
// debajo del umbral) — y un precio en pesos por tonelada nunca baja de varios
// miles. Un solo umbral separa los dos casos con margen amplio de los dos
// lados. Mismo patrón "bloquea salvo forzar" que el guard de unidades del
// uploader de compras (`src/app/admin/datos/actions.ts`).
// ============================================================================

export const UMBRAL_PRECIO_MAGNITUD = 10000;

export function precioMonedaSospechoso(precio: number, moneda: Moneda): boolean {
  return moneda === "usd" ? precio > UMBRAL_PRECIO_MAGNITUD : precio < UMBRAL_PRECIO_MAGNITUD;
}

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

  // Condición: qué valores admite este tipo (§ arriba, CONDICIONES_POR_TIPO).
  // Array vacío (futuro A3) = no usa condición, tiene que venir vacía.
  const condicionesPermitidas = CONDICIONES_POR_TIPO[tipo];
  let condicion: OperacionCondicion | null = null;
  if (condicionesPermitidas.length === 0) {
    if (input.condicion) return { ok: false, error: "Un futuro A3 no usa condición (el precio siempre es manual)." };
  } else {
    if (!input.condicion) return { ok: false, error: "Elegí la condición del negocio." };
    if (!(input.condicion in CONDICION_LABEL) || !condicionesPermitidas.includes(input.condicion as OperacionCondicion)) {
      return {
        ok: false,
        error:
          tipo === "fijacion"
            ? 'Una fijación solo admite condición "Pizarra" o "A precio".'
            : "Condición inválida.",
      };
    }
    condicion = input.condicion as OperacionCondicion;
  }

  if (!campaniaValida(input.campania)) {
    return { ok: false, error: "La campaña debe tener el formato AA/AA (ej. 25/26)." };
  }

  if (input.volumen == null || !(input.volumen > 0)) {
    return { ok: false, error: "Ingresá un volumen mayor a cero." };
  }

  // Precio: derivado de la condición (o siempre manual, en futuro A3 — el
  // check de más abajo lo reafirma junto con la posición).
  const precio_modo: PrecioModo = condicion ? precioModoDeCondicion(condicion) : "manual";

  let moneda: Moneda | null = null;
  if (input.moneda) {
    if (input.moneda !== "usd" && input.moneda !== "ars") return { ok: false, error: "Moneda inválida." };
    moneda = input.moneda;
  }

  let precio: number | null = null;
  if (precio_modo === "manual") {
    if (input.precio == null || !(input.precio > 0)) return { ok: false, error: "Ingresá el precio de la operación." };
    if (!moneda) return { ok: false, error: "Elegí la moneda del precio." };
    if (precioMonedaSospechoso(input.precio, moneda) && !input.forzarMoneda) {
      return {
        ok: false,
        error:
          moneda === "usd"
            ? `USD ${input.precio} parece un precio en pesos, no en dólares. Si es correcto, tildá "Confirmo el precio y la moneda".`
            : `$ ${input.precio} parece un precio en dólares, no en pesos. Si es correcto, tildá "Confirmo el precio y la moneda".`,
      };
    }
    precio = input.precio;
  } else if (precio_modo === "pizarra") {
    if (!moneda) return { ok: false, error: "Elegí en qué moneda mostrar la pizarra." };
  }
  // sin_precio: precio queda null pase lo que pase.

  const descuento_pct = input.descuentoPct != null && input.descuentoPct > 0 ? input.descuentoPct : null;
  if (descuento_pct != null && (descuento_pct < 0 || descuento_pct > 100)) {
    return { ok: false, error: "El descuento en % debe estar entre 0 y 100." };
  }
  const descuento_monto = input.descuentoMonto != null && input.descuentoMonto > 0 ? input.descuentoMonto : null;
  if (descuento_monto != null && descuento_monto < 0) {
    return { ok: false, error: "El descuento en monto no puede ser negativo." };
  }

  const comision_pct = input.comisionPct != null && input.comisionPct > 0 ? input.comisionPct : null;
  if (comision_pct != null && (comision_pct < 0 || comision_pct > 100)) {
    return { ok: false, error: "La comisión en % debe estar entre 0 y 100." };
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

  // Período de fijación (§ pedido de Lautoro 06/08/2026): solo cuando la
  // condición es "a fijar" — el "desde" es obligatorio (el form lo prellena
  // con el inicio de entrega/la fecha de la operación, pero queda editable);
  // el "hasta" es libre — sin fecha = fijación abierta, sin límite.
  let fijacion_desde: string | null = null;
  let fijacion_hasta: string | null = null;
  if (condicion === "a_fijar") {
    fijacion_desde = input.fijacionDesde || null;
    if (!fijacion_desde) return { ok: false, error: 'Un negocio "a fijar" necesita el inicio del período de fijación.' };
    if (!FECHA_RE.test(fijacion_desde)) return { ok: false, error: "Fecha de fijación (desde) inválida." };
    fijacion_hasta = input.fijacionHasta || null;
    if (fijacion_hasta) {
      if (!FECHA_RE.test(fijacion_hasta)) return { ok: false, error: "Fecha de fijación (hasta) inválida." };
      if (fijacion_hasta < fijacion_desde) {
        return { ok: false, error: 'El período de fijación "hasta" no puede ser anterior a "desde".' };
      }
    }
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
      comision_pct,
      entrega_desde,
      entrega_hasta,
      fijacion_desde,
      fijacion_hasta,
      posicion_a3,
      es_canje: input.esCanje === true,
      contraparte: input.contraparte.trim() || null,
      nro_contrato: input.nroContrato.trim() || null,
      observaciones: input.observaciones.trim() || null,
    },
  };
}

// ============================================================================
// Precio "pizarra": resolución en LECTURA, cero proceso manual (§5.4). La fila
// de `pizarra_historico` está fechada por el DÍA DE MERCADO que refleja, no por
// el día en que CAC la publica — CAC suele publicarla recién a la mañana
// siguiente (de ahí "la pizarra refleja el mercado del día anterior" §7.3: lo
// que sale publicado hoy es la de ayer). Aclarado con Lautoro 07/08/2026 sobre
// un caso real: un negocio del 06/08 resuelve con la fila fecha=2026-08-06 en
// cuanto esa fila se carga (aunque eso pase recién la mañana del 07/08) — NO
// con una fila fechada 07/08. Tope de 7 días corridos hacia adelante para
// cubrir el caso borde de que falte el día exacto (fin de semana/feriado de
// mercado) sin agarrar una pizarra lejana si el cron no corrió.
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
 * Primera pizarra con fecha IGUAL o posterior a la de la operación, dentro de
 * los 7 días corridos siguientes — preferí siempre la del mismo día si ya está
 * cargada. `null` si ninguna aplica todavía (CAC no publicó ni ese día ni uno
 * posterior dentro de la ventana) — el caller muestra "Pizarra (pendiente)",
 * nunca inventa un valor lejano.
 */
export function elegirPizarraSiguiente(fechaOperacion: string, candidatas: PizarraFila[]): PizarraFila | null {
  const limite = sumarDiasISO(fechaOperacion, TOPE_DIAS_PIZARRA);
  const validas = candidatas
    .filter((p) => p.fecha >= fechaOperacion && p.fecha <= limite)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  return validas[0] ?? null;
}

/** `base × (1 − pct/100) × (1 − comisiónPct/100) − monto` — descuento % y comisión %
 *  se aplican como 2 reducciones independientes (§7.4), el monto fijo al final. */
export function aplicarDescuentos(
  base: number,
  pct: number | null,
  monto: number | null,
  comisionPct: number | null = null,
): number {
  const conPct = pct ? base * (1 - pct / 100) : base;
  const conComision = comisionPct ? conPct * (1 - comisionPct / 100) : conPct;
  return monto ? conComision - monto : conComision;
}

export type PrecioResuelto =
  | { estado: "manual"; valor: number; base: number }
  | { estado: "pizarra_resuelta"; valor: number; base: number; fechaPizarra: string }
  | { estado: "pizarra_pendiente" }
  | { estado: "sin_precio" };

/**
 * Precio final a mostrar de una operación, dado su modo y (si aplica) la pizarra
 * siguiente ya elegida. Además del `valor` final (con descuento/comisión/monto ya
 * aplicados), expone el `base` (precio sin tocar — manual o pizarra) para que la
 * UI pueda mostrar el desglose completo (pedido de Lautoro 07/08/2026).
 */
export function resolverPrecio(
  op: {
    precio_modo: PrecioModo;
    precio: number | null;
    moneda: Moneda | null;
    descuento_pct: number | null;
    descuento_monto: number | null;
    comision_pct: number | null;
  },
  pizarraSiguiente: PizarraFila | null,
): PrecioResuelto {
  if (op.precio_modo === "sin_precio") return { estado: "sin_precio" };
  if (op.precio_modo === "manual") {
    if (op.precio == null) return { estado: "sin_precio" };
    return {
      estado: "manual",
      base: op.precio,
      valor: aplicarDescuentos(op.precio, op.descuento_pct, op.descuento_monto, op.comision_pct),
    };
  }
  // pizarra
  if (!pizarraSiguiente) return { estado: "pizarra_pendiente" };
  const base = op.moneda === "usd" ? pizarraSiguiente.precio_usd : pizarraSiguiente.precio_ars;
  if (base == null) return { estado: "pizarra_pendiente" };
  return {
    estado: "pizarra_resuelta",
    base,
    valor: aplicarDescuentos(base, op.descuento_pct, op.descuento_monto, op.comision_pct),
    fechaPizarra: pizarraSiguiente.fecha,
  };
}
