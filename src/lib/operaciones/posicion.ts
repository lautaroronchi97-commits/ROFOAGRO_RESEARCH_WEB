import { MESES_ES, vtoDePosicion } from "@/lib/dates";
import { sumarDiasISO } from "./registro";
import { PRODUCTOS, PRODUCTOS_CON_FUTURO, type Operacion, type OperacionProducto } from "./tipos";

/**
 * Lib PURA de la posición (§5.1-§5.2, docs/PLAN_OPERACIONES_CLIENTES.md): la matriz
 * producto × período de entrega, con las columnas rodantes (Disponible + próximos 8
 * meses + Más adelante) de la planilla de Mauro. Sin `server-only`: opera sobre
 * `Operacion[]` ya traídas por `datos.ts`, testeable directo.
 */

export type ColumnaPeriodo = { key: string; label: string };

/** "sep" → "Sep" (las etiquetas de columna van con mayúscula inicial, ej. "Sep-26"). */
function capitalizar(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

/**
 * Las 10 columnas rodantes: Disponible · [mes actual+1 … mes actual+8] · Más
 * adelante — siempre relativas a `hoyISO`, tal como la hoja Posición de Mauro
 * (las columnas de mes "rotan solas").
 */
export function columnasPeriodo(hoyISO: string): ColumnaPeriodo[] {
  const [y, m] = hoyISO.split("-").map(Number);
  const cols: ColumnaPeriodo[] = [{ key: "disponible", label: "Disponible" }];
  for (let i = 1; i <= 8; i++) {
    const total = (m ?? 1) - 1 + i;
    const anio = (y ?? 0) + Math.floor(total / 12);
    const mes = (total % 12) + 1;
    const key = `${anio}-${String(mes).padStart(2, "0")}`;
    cols.push({ key, label: `${capitalizar(MESES_ES[mes - 1] ?? "")}-${String(anio).slice(2)}` });
  }
  cols.push({ key: "mas_adelante", label: "Más adelante" });
  return cols;
}

/**
 * Bucket de una operación FÍSICA (disponible/forward) — regla de Mauro elegida por
 * Lautoro en §7.2: un forward con entrega dentro de los próximos 30 días figura
 * "Disponible" (la posición migra sola de columna con el paso de los días); si no,
 * va al mes de `entrega_desde`; si ese mes cae fuera de la ventana de 8 meses, va a
 * "Más adelante".
 */
export function bucketFisico(
  op: Pick<Operacion, "tipo" | "entrega_desde">,
  hoyISO: string,
  columnas: ColumnaPeriodo[],
): string {
  if (op.tipo === "disponible") return "disponible";
  if (!op.entrega_desde) return "mas_adelante"; // defensivo (la constraint del DDL ya exige entrega_desde en forward)
  const limiteDisponible = sumarDiasISO(hoyISO, 30);
  if (op.entrega_desde <= limiteDisponible) return "disponible";
  const mesKey = op.entrega_desde.slice(0, 7);
  return columnas.some((c) => c.key === mesKey) ? mesKey : "mas_adelante";
}

/** Bucket de un futuro A3: el mes de su posición (`NOV26` → `2026-11`). */
export function bucketFuturo(posicionA3: string, columnas: ColumnaPeriodo[]): string {
  const vto = vtoDePosicion(posicionA3);
  const mesKey = vto.slice(0, 7);
  return vto && columnas.some((c) => c.key === mesKey) ? mesKey : "mas_adelante";
}

export type Estado = "COMPRADOS" | "VENDIDOS" | "NEUTRO";

export type FilaMatriz = {
  producto: OperacionProducto;
  porColumna: Record<string, number>;
  total: number;
  estado: Estado;
};

export type Matriz = {
  columnas: ColumnaPeriodo[];
  filas: FilaMatriz[];
  totalPorColumna: Record<string, number>;
  totalGeneral: number;
};

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

function estadoDe(total: number): Estado {
  return total > 0 ? "COMPRADOS" : total < 0 ? "VENDIDOS" : "NEUTRO";
}

function construirMatriz(
  ops: Operacion[],
  columnas: ColumnaPeriodo[],
  bucketFn: (op: Operacion) => string,
  productos: readonly OperacionProducto[] = PRODUCTOS,
): Matriz {
  const acumulado = new Map<OperacionProducto, Record<string, number>>();
  for (const p of productos) acumulado.set(p, Object.fromEntries(columnas.map((c) => [c.key, 0])));

  for (const op of ops) {
    const rec = acumulado.get(op.producto);
    if (!rec) continue; // producto fuera de la lista de esta matriz (ej. girasol/sorgo en Futuros — no tienen A3)
    const signo = op.lado === "compra" ? 1 : -1;
    const key = bucketFn(op);
    rec[key] = (rec[key] ?? 0) + signo * op.volumen_tn;
  }

  const totalPorColumna: Record<string, number> = Object.fromEntries(columnas.map((c) => [c.key, 0]));
  const filas: FilaMatriz[] = productos.map((p) => {
    const porColumna = acumulado.get(p)!;
    let total = 0;
    for (const c of columnas) {
      const v = redondear(porColumna[c.key] ?? 0);
      porColumna[c.key] = v;
      total += v;
      totalPorColumna[c.key] = redondear((totalPorColumna[c.key] ?? 0) + v);
    }
    total = redondear(total);
    return { producto: p, porColumna, total, estado: estadoDe(total) };
  });

  const totalGeneral = redondear(filas.reduce((a, f) => a + f.total, 0));
  return { columnas, filas, totalPorColumna, totalGeneral };
}

/**
 * Matriz FÍSICA (disponible + forward). Excluye anuladas y fijaciones — las
 * fijaciones NO suman volumen (§1.2/§5.1): son un registro que solo genera precio.
 * Los 5 productos (girasol/sorgo también operan físico).
 */
export function construirMatrizFisico(operaciones: Operacion[], hoyISO: string): Matriz {
  const columnas = columnasPeriodo(hoyISO);
  const vivas = operaciones.filter((o) => !o.anulada && (o.tipo === "disponible" || o.tipo === "forward"));
  return construirMatriz(vivas, columnas, (op) => bucketFisico(op, hoyISO, columnas));
}

// ============================================================================
// Físico segmentado por CAMPAÑA (pedido de Lautaro 06/08/2026): "no hace falta
// que todo se calce en la misma campaña — solo para la mercadería física sí,
// el pricing no". La mercadería física de dos campañas distintas no es
// fungible entre sí (una compra 25/26 y una venta 26/27 no son la "misma
// soja"), así que netearlas en una sola celda mentiría sobre el calce real —
// el pricing, en cambio, mide exposición en $/USD, donde sí tiene sentido
// seguir sumando todas las campañas juntas (sin cambios ahí).
// ============================================================================

/**
 * Campañas presentes entre las operaciones FÍSICAS (disponible/forward, no
 * anuladas) del conjunto dado — determina cuántas tablas de físico segmentado
 * hay que mostrar. Detectadas de los datos reales (no de una lista fija de
 * campañas vigentes): así una operación cargada con una campaña vieja/futura
 * sigue apareciendo en algún lado, nunca desaparece en silencio.
 */
export function campaniasFisicasPresentes(operaciones: Operacion[]): string[] {
  const set = new Set(
    operaciones.filter((o) => !o.anulada && (o.tipo === "disponible" || o.tipo === "forward")).map((o) => o.campania),
  );
  return [...set].sort();
}

/**
 * Builder de matriz física acotado a UNA campaña — reusa `construirMatrizFisico`
 * filtrando antes por `campania`, así comparte 100% de la lógica de buckets/
 * neteo (y sirve directo como `builder` de `construirMatrizDia`).
 */
export function construirMatrizFisicoDeCampania(campania: string): (ops: Operacion[], hoyISO: string) => Matriz {
  return (ops, hoyISO) => construirMatrizFisico(ops.filter((o) => o.campania === campania), hoyISO);
}

/**
 * Matriz de FUTUROS A3 — separada del físico (§1.3: calzar físico con futuro es cobertura).
 * Solo `PRODUCTOS_CON_FUTURO` (soja/maíz/trigo): girasol y sorgo no tienen futuro en A3
 * (pedido de Lautaro, 05/08/2026 — mismo criterio que ya usan `pizarra.ts`/"Negocios de
 * planta"), así que no tiene sentido mostrarles una fila siempre vacía acá.
 */
export function construirMatrizFuturos(operaciones: Operacion[], hoyISO: string): Matriz {
  const columnas = columnasPeriodo(hoyISO);
  const vivas = operaciones.filter((o) => !o.anulada && o.tipo === "futuro_a3" && o.posicion_a3);
  return construirMatriz(vivas, columnas, (op) => bucketFuturo(op.posicion_a3!, columnas), PRODUCTOS_CON_FUTURO);
}

/**
 * ¿La operación YA genera precio? (pedido de Lautaro 06/08/2026 — la tabla de
 * "pricing"): físicos a precio (manual o pizarra, que resuelve sola §5.4),
 * fijaciones (SON la generación de precio de un a-fijar) y futuros A3. Lo único
 * que queda afuera es el negocio a fijar (`sin_precio`).
 */
export function esOperacionConPrecio(
  op: Pick<Operacion, "tipo" | "precio_modo">,
): boolean {
  if (op.tipo === "futuro_a3" || op.tipo === "fijacion") return true;
  return op.precio_modo !== "sin_precio";
}

/**
 * Matriz de PRICING (pedido de Lautaro 06/08/2026): la mercadería CON precio —
 * físicos a precio + fijaciones + futuros A3 — producto × período. A diferencia
 * de la matriz física, acá las fijaciones SÍ suman volumen: miden cuánta
 * mercadería ya tiene precio (una fijación es exactamente eso), y los futuros
 * van en el mes de su posición. Una fijación sin entrega cae en "Disponible".
 */
export function construirMatrizPricing(operaciones: Operacion[], hoyISO: string): Matriz {
  const columnas = columnasPeriodo(hoyISO);
  const vivas = operaciones.filter((o) => !o.anulada && esOperacionConPrecio(o));
  return construirMatriz(vivas, columnas, (op) => {
    if (op.tipo === "futuro_a3" && op.posicion_a3) return bucketFuturo(op.posicion_a3, columnas);
    if (op.tipo === "fijacion" && !op.entrega_desde) return "disponible";
    return bucketFisico(op, hoyISO, columnas);
  });
}

/**
 * Matriz TOTAL = físico + futuros, columna a columna (misma forma que las dos anteriores,
 * siempre los 5 productos porque parte de `fisico`). Empareja por `producto`, NO por índice
 * — `futuros` puede tener menos filas que `fisico` (girasol/sorgo sin fila de futuros).
 */
export function combinarMatrices(fisico: Matriz, futuros: Matriz): Matriz {
  const filas: FilaMatriz[] = fisico.filas.map((f) => {
    const u = futuros.filas.find((x) => x.producto === f.producto);
    const porColumna: Record<string, number> = {};
    for (const c of fisico.columnas) {
      porColumna[c.key] = redondear((f.porColumna[c.key] ?? 0) + (u?.porColumna[c.key] ?? 0));
    }
    const total = redondear(f.total + (u?.total ?? 0));
    return { producto: f.producto, porColumna, total, estado: estadoDe(total) };
  });
  const totalPorColumna: Record<string, number> = {};
  for (const c of fisico.columnas) {
    totalPorColumna[c.key] = redondear((fisico.totalPorColumna[c.key] ?? 0) + (futuros.totalPorColumna[c.key] ?? 0));
  }
  const totalGeneral = redondear(fisico.totalGeneral + futuros.totalGeneral);
  return { columnas: fisico.columnas, filas, totalPorColumna, totalGeneral };
}

/**
 * Neto del día (§5.6 registro, la 3ª matriz de la hoja diaria de Mauro): solo
 * físico (disponible + forward), filtrado a las operaciones de UN día — las
 * columnas de período siguen siendo relativas a HOY (no al día que se está
 * mirando), igual que el resto de la posición.
 */
export function construirNetoDelDia(operacionesDelDia: Operacion[], hoyISO: string): Matriz {
  return construirMatrizFisico(operacionesDelDia, hoyISO);
}

/**
 * "Posición al [fecha]" (Fase 2, §5.6 item 6 / §5.1): reconstruye un cierre
 * pasado filtrando `fecha <= fechaCorte` — el resto del cálculo (columnas
 * relativas a HOY, buckets, matrices) no cambia, es el MISMO pipeline que la
 * posición de hoy, solo con menos operaciones adentro (un libro mayor no
 * necesita una fórmula nueva para "cómo estaba tal día", alcanza con no contar
 * lo que todavía no había pasado).
 */
export function filtrarHasta(operaciones: Operacion[], fechaCorte: string): Operacion[] {
  return operaciones.filter((o) => o.fecha <= fechaCorte);
}

// ============================================================================
// "Posición del día" (pedido de Lautaro 06/08/2026): los movimientos de UN día
// con su POSICIÓN INICIAL (lo acumulado hasta el día anterior, con el mismo
// criterio de la matriz — pricing con pricing, físico con físico) y el total
// resultante. Integridad por construcción: total = inicial + neto del día, y
// como inicial y día salen del MISMO builder sobre el mismo array, el total
// coincide EXACTO con la matriz acumulada hasta ese día (testeado aparte contra
// el camino independiente `builder(filtrarHasta(ops, dia))`).
// ============================================================================

export type FilaMatrizDia = {
  producto: OperacionProducto;
  /** Acumulado hasta el día ANTERIOR (la "posición inicial" del día). */
  inicial: number;
  /** Movimientos del día, por columna de período (relativa a HOY, como todo). */
  porColumna: Record<string, number>;
  /** Neto del día (suma de `porColumna`). */
  netoDia: number;
  /** inicial + netoDia = acumulado al cierre del día. */
  total: number;
  estado: Estado;
};

export type MatrizDia = {
  columnas: ColumnaPeriodo[];
  filas: FilaMatrizDia[];
  inicialTotal: number;
  totalPorColumna: Record<string, number>;
  netoDiaGeneral: number;
  totalGeneral: number;
};

export function construirMatrizDia(
  operaciones: Operacion[],
  diaISO: string,
  hoyISO: string,
  builder: (ops: Operacion[], hoy: string) => Matriz,
): MatrizDia {
  const inicial = builder(operaciones.filter((o) => o.fecha < diaISO), hoyISO);
  const dia = builder(operaciones.filter((o) => o.fecha === diaISO), hoyISO);

  const filas: FilaMatrizDia[] = dia.filas.map((f) => {
    const ini = inicial.filas.find((x) => x.producto === f.producto)?.total ?? 0;
    const total = redondear(ini + f.total);
    return { producto: f.producto, inicial: ini, porColumna: f.porColumna, netoDia: f.total, total, estado: estadoDe(total) };
  });

  return {
    columnas: dia.columnas,
    filas,
    inicialTotal: inicial.totalGeneral,
    totalPorColumna: dia.totalPorColumna,
    netoDiaGeneral: dia.totalGeneral,
    totalGeneral: redondear(inicial.totalGeneral + dia.totalGeneral),
  };
}

// ============================================================================
// Evolución de la posición física en el tiempo (pedido de Lautaro 06/08/2026,
// "en otra solapa"): la curva de cómo se fue construyendo el físico acumulado,
// publicación a publicación (fecha de la operación) — mismo alcance de UNA
// campaña por vez que el resto del físico segmentado de arriba (netear entre
// campañas mentiría igual acá).
// ============================================================================

export type PuntoEvolucion = { fecha: string; acumulado: number };
export type SerieEvolucionProducto = { producto: OperacionProducto; puntos: PuntoEvolucion[] };

/**
 * Curva acumulada por producto, de UNA campaña, ordenada por fecha. Un solo
 * punto por fecha (si hubo varias operaciones el mismo día, se funden en el
 * acumulado de ese día — igual que "neto del día"). Solo devuelve productos
 * con al menos una operación física en esa campaña.
 */
export function evolucionFisico(operaciones: Operacion[], campania: string): SerieEvolucionProducto[] {
  const vivas = operaciones
    .filter((o) => !o.anulada && (o.tipo === "disponible" || o.tipo === "forward") && o.campania === campania)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));

  const porProducto = new Map<OperacionProducto, Map<string, number>>();
  for (const op of vivas) {
    let porFecha = porProducto.get(op.producto);
    if (!porFecha) {
      porFecha = new Map();
      porProducto.set(op.producto, porFecha);
    }
    const signo = op.lado === "compra" ? 1 : -1;
    porFecha.set(op.fecha, (porFecha.get(op.fecha) ?? 0) + signo * op.volumen_tn);
  }

  const series: SerieEvolucionProducto[] = [];
  for (const producto of PRODUCTOS) {
    const porFecha = porProducto.get(producto);
    if (!porFecha || porFecha.size === 0) continue;
    const fechas = [...porFecha.keys()].sort();
    let acumulado = 0;
    const puntos: PuntoEvolucion[] = fechas.map((fecha) => {
      acumulado = redondear(acumulado + (porFecha.get(fecha) ?? 0));
      return { fecha, acumulado };
    });
    series.push({ producto, puntos });
  }
  return series;
}

// ============================================================================
// Heatmap comprado/vendido (§1.23/§5.6 item 5, Fase 2): calendario producto ×
// día. Deliberadamente solo FÍSICO (disponible + forward) — mismo alcance que
// "neto del día" arriba: un futuro_a3 es cobertura, no el patrón de compra/
// venta que el heatmap quiere mostrar de un vistazo (documentado también en la
// bitácora de la sesión, tal como pide el prompt de Fase 2).
// ============================================================================

export type HeatmapFila = { producto: OperacionProducto; porDia: Record<string, number> };
export type Heatmap = { dias: string[]; filas: HeatmapFila[] };

/**
 * `ventanaDias` días terminando HOY (incluido), más viejo primero. Cada celda es
 * el neto físico (compra +, venta −) de las operaciones CONCERTADAS ese día
 * (`operacion.fecha`, no la entrega) — igual que la hoja diaria de Mauro.
 */
export function construirHeatmap(operaciones: Operacion[], hoyISO: string, ventanaDias: number): Heatmap {
  const dias: string[] = [];
  for (let i = ventanaDias - 1; i >= 0; i--) dias.push(sumarDiasISO(hoyISO, -i));
  const diasSet = new Set(dias);

  const acumulado = new Map<OperacionProducto, Record<string, number>>();
  for (const p of PRODUCTOS) acumulado.set(p, Object.fromEntries(dias.map((d) => [d, 0])));

  const fisicas = operaciones.filter(
    (o) => !o.anulada && (o.tipo === "disponible" || o.tipo === "forward") && diasSet.has(o.fecha),
  );
  for (const op of fisicas) {
    const signo = op.lado === "compra" ? 1 : -1;
    const rec = acumulado.get(op.producto)!;
    rec[op.fecha] = redondear((rec[op.fecha] ?? 0) + signo * op.volumen_tn);
  }

  const filas: HeatmapFila[] = PRODUCTOS.map((p) => ({ producto: p, porDia: acumulado.get(p)! }));
  return { dias, filas };
}
