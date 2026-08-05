import { MESES_ES, vtoDePosicion } from "@/lib/dates";
import { sumarDiasISO } from "./registro";
import { PRODUCTOS, type Operacion, type OperacionProducto } from "./tipos";

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
): Matriz {
  const acumulado = new Map<OperacionProducto, Record<string, number>>();
  for (const p of PRODUCTOS) acumulado.set(p, Object.fromEntries(columnas.map((c) => [c.key, 0])));

  for (const op of ops) {
    const signo = op.lado === "compra" ? 1 : -1;
    const key = bucketFn(op);
    const rec = acumulado.get(op.producto)!;
    rec[key] = (rec[key] ?? 0) + signo * op.volumen_tn;
  }

  const totalPorColumna: Record<string, number> = Object.fromEntries(columnas.map((c) => [c.key, 0]));
  const filas: FilaMatriz[] = PRODUCTOS.map((p) => {
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
 */
export function construirMatrizFisico(operaciones: Operacion[], hoyISO: string): Matriz {
  const columnas = columnasPeriodo(hoyISO);
  const vivas = operaciones.filter((o) => !o.anulada && (o.tipo === "disponible" || o.tipo === "forward"));
  return construirMatriz(vivas, columnas, (op) => bucketFisico(op, hoyISO, columnas));
}

/** Matriz de FUTUROS A3 — separada del físico (§1.3: calzar físico con futuro es cobertura). */
export function construirMatrizFuturos(operaciones: Operacion[], hoyISO: string): Matriz {
  const columnas = columnasPeriodo(hoyISO);
  const vivas = operaciones.filter((o) => !o.anulada && o.tipo === "futuro_a3" && o.posicion_a3);
  return construirMatriz(vivas, columnas, (op) => bucketFuturo(op.posicion_a3!, columnas));
}

/** Matriz TOTAL = físico + futuros, columna a columna (misma forma que las dos anteriores). */
export function combinarMatrices(fisico: Matriz, futuros: Matriz): Matriz {
  const filas: FilaMatriz[] = fisico.filas.map((f, i) => {
    const u = futuros.filas[i]!;
    const porColumna: Record<string, number> = {};
    for (const c of fisico.columnas) porColumna[c.key] = redondear((f.porColumna[c.key] ?? 0) + (u.porColumna[c.key] ?? 0));
    const total = redondear(f.total + u.total);
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
