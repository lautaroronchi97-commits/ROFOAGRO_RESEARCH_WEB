import {
  PRODUCTO_GRANO,
  PRODUCTOS_CON_FUTURO,
  type Moneda,
  type Operacion,
  type OperacionLado,
  type OperacionProducto,
} from "./tipos";

/**
 * Lib PURA del panel "Posición de futuros" valorizada (§5.5, Fase 2 —
 * docs/PLAN_OPERACIONES_CLIENTES.md): fórmula CONFIRMADA por Lautaro el
 * 05/08/2026 contra el ejemplo numérico del plan. Sin `server-only`: recibe el
 * ajuste de hoy ya resuelto (server component vía `getCierresGranos()`,
 * `src/lib/futuros.ts`) — así se testea directo, sin red ni Supabase.
 *
 *   resultado_usd = (ajuste_hoy − precio_ejecucion) × volumen_tn × signo
 *   (signo: compra +1, venta −1)
 *
 * Ejemplo del plan: compra 300 tn SOJ NOV26 a 320,00 USD/tn; ajuste hoy 328,50
 * → (328,50 − 320,00) × 300 × (+1) = +2.550,00 USD.
 */

// Mismo valor que CONTRATO_GRANO_TN (src/lib/futuros.ts:56, verificado contra
// el CEM 23/07/2026) — no se puede importar ese archivo acá porque tiene
// `server-only`, que rompe el import apenas se lo toca desde vitest (mismo
// problema ya documentado en otras libs puras del repo).
const CONTRATO_GRANO_TN = 100;

/** Clave de lookup del ajuste de hoy: mismo par (grano A3, posición) que usa `curva.ts`/`futuros.ts`. */
export function claveAjuste(grano: string, posicion: string): string {
  return `${grano}|${posicion}`;
}

/** `Map` de ajustes de hoy, armado por el caller desde `getCierresGranos()` (server). */
export type AjusteLookup = Map<string, number | null>;

export type EstadoFuturoValorizado = "valorizado" | "sin_ajuste_vigente" | "moneda_no_usd";

export type FuturoValorizado = {
  id: string;
  producto: OperacionProducto;
  lado: OperacionLado;
  posicionA3: string;
  volumenTn: number;
  precioEjecucion: number;
  moneda: Moneda;
  fecha: string;
  ajusteHoy: number | null;
  resultadoUsd: number | null;
  estado: EstadoFuturoValorizado;
  multiploDeContrato: boolean;
};

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Valoriza TODAS las operaciones `futuro_a3` vivas (no anuladas) de la lista
 * dada. Degradación honesta (§5.5): posición ya no vigente en
 * `futuros_cierres_ultimo` (vencida o sin dato) → `sin_ajuste_vigente`, sin
 * inventar un precio; moneda en $ (la constraint del DDL no lo prohíbe, aunque
 * A3 cotiza granos en USD) → `moneda_no_usd`, sin inventar un TC — mismo
 * criterio "sin conversión" que el resto de §4.2.
 */
export function valorizarFuturos(operaciones: Operacion[], ajustes: AjusteLookup): FuturoValorizado[] {
  const vivas = operaciones.filter(
    (o): o is Operacion & { posicion_a3: string; precio: number; moneda: Moneda } =>
      !o.anulada &&
      o.tipo === "futuro_a3" &&
      o.posicion_a3 != null &&
      o.precio != null &&
      o.moneda != null &&
      PRODUCTOS_CON_FUTURO.includes(o.producto),
  );

  return vivas.map((o) => {
    const grano = PRODUCTO_GRANO[o.producto];
    const ajusteHoy = ajustes.get(claveAjuste(grano, o.posicion_a3)) ?? null;
    const signo = o.lado === "compra" ? 1 : -1;

    let estado: EstadoFuturoValorizado;
    let resultadoUsd: number | null = null;
    if (o.moneda !== "usd") {
      estado = "moneda_no_usd";
    } else if (ajusteHoy == null) {
      estado = "sin_ajuste_vigente";
    } else {
      estado = "valorizado";
      resultadoUsd = redondear((ajusteHoy - o.precio) * o.volumen_tn * signo);
    }

    return {
      id: o.id,
      producto: o.producto,
      lado: o.lado,
      posicionA3: o.posicion_a3,
      volumenTn: o.volumen_tn,
      precioEjecucion: o.precio,
      moneda: o.moneda,
      fecha: o.fecha,
      ajusteHoy,
      resultadoUsd,
      estado,
      multiploDeContrato: o.volumen_tn % CONTRATO_GRANO_TN === 0,
    };
  });
}

/** Total valorizado por producto (solo `estado: "valorizado"`; `null` si ningún contrato del producto valorizó). */
export function totalesPorProducto(filas: FuturoValorizado[]): Partial<Record<OperacionProducto, number>> {
  const totales: Partial<Record<OperacionProducto, number>> = {};
  for (const f of filas) {
    if (f.estado !== "valorizado" || f.resultadoUsd == null) continue;
    totales[f.producto] = redondear((totales[f.producto] ?? 0) + f.resultadoUsd);
  }
  return totales;
}

/** Total general valorizado (suma de `totalesPorProducto`), `null` si ninguna fila valorizó. */
export function totalGeneral(filas: FuturoValorizado[]): number | null {
  const valorizadas = filas.filter((f) => f.estado === "valorizado" && f.resultadoUsd != null);
  if (valorizadas.length === 0) return null;
  return redondear(valorizadas.reduce((acc, f) => acc + (f.resultadoUsd ?? 0), 0));
}
