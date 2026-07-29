import "server-only";
import { sbSelect } from "../supabase";
import {
  CHECKS,
  FUTURO,
  MATVIEWS,
  ULTIMO_SEED_CALENDARIO,
  MIN_DIAS_SEED_CALENDARIO,
  type Check,
  type SeedFuturo,
  type MatviewCheck,
} from "./catalogo";

/**
 * Versión "en vivo" del veredicto de `scripts/healthcheck-frescura.mjs` (que corre 1×/día y
 * avisa por mail) — mismo catálogo (`./catalogo`), misma lógica de días, pero pensada para
 * mirarse en cualquier momento desde `/admin/conexiones` sin esperar al cron nocturno.
 *
 * `revalidate: 0` en cada `sbSelect`: el panel admin ya es `force-dynamic` (no cachea la
 * RUTA), pero eso no alcanza — `sbSelect` usa `next:{revalidate}` de fetch, que SÍ persiste
 * entre requests si no se pide 0 explícito. Acá la frescura tiene que ser la de ahora mismo.
 */

const REVALIDATE = 0;

/** fecha puede ser 'YYYY-MM-DD' o un timestamp ISO; se normaliza al día UTC (mismo criterio
 *  que el script de Node: no distingue huso horario, es un margen de días, no de horas). */
export function diasDesde(fecha: string, ahora: Date = new Date()): number {
  const iso = fecha.slice(0, 10);
  const d = new Date(`${iso}T00:00:00Z`);
  return Math.floor((ahora.getTime() - d.getTime()) / 86_400_000);
}

/** Última fila no-nula de `col` en `tabla` (+ filtro PostgREST opcional, ej. "&organismo=eq.DEA"). */
export async function ultimaFecha(
  tabla: string,
  col: string,
  filtro?: string,
): Promise<{ fecha: string | null; error: string | null }> {
  const path = `${tabla}?select=${col}&${col}=not.is.null&order=${col}.desc&limit=1${filtro ?? ""}`;
  const res = await sbSelect(path, REVALIDATE);
  if (!res.ok) return { fecha: null, error: res.reason };
  const rows = res.data as Record<string, unknown>[] | undefined;
  const v = rows?.[0]?.[col];
  return { fecha: v != null ? String(v) : null, error: null };
}

export type EstadoChequeo = "ok" | "atrasado" | "sin-datos" | "error";

export type ChequeoFrescura = Check & {
  fecha: string | null;
  dias: number | null;
  estado: EstadoChequeo;
  error: string | null;
};

async function evaluarCheck(c: Check): Promise<ChequeoFrescura> {
  const { fecha, error } = await ultimaFecha(c.tabla, c.col, c.filtro);
  const dias = fecha ? diasDesde(fecha) : null;
  const estado: EstadoChequeo = error ? "error" : fecha == null ? "sin-datos" : dias! > c.maxDias ? "atrasado" : "ok";
  return { ...c, fecha, dias, estado, error };
}

export type MatviewEstado = MatviewCheck & {
  mvFecha: string | null;
  baseFecha: string | null;
  rezago: number | null;
  estado: "ok" | "sin-refrescar" | "sin-datos" | "error";
  error: string | null;
};

async function evaluarMatview(m: MatviewCheck): Promise<MatviewEstado> {
  const [mv, base] = await Promise.all([ultimaFecha(m.mv, m.mvCol), ultimaFecha(m.base, m.baseCol)]);
  const error = mv.error ?? base.error;
  const rezago = !error && mv.fecha && base.fecha ? diasDesde(mv.fecha) - diasDesde(base.fecha) : null;
  const estado: MatviewEstado["estado"] = error
    ? "error"
    : mv.fecha == null
      ? "sin-datos"
      : rezago != null && rezago > 1
        ? "sin-refrescar"
        : "ok";
  return { ...m, mvFecha: mv.fecha, baseFecha: base.fecha, rezago, estado, error };
}

export type SeedEstado = SeedFuturo & {
  fecha: string | null;
  restantes: number | null;
  estado: "ok" | "por-agotarse" | "error";
  error: string | null;
};

async function evaluarSeed(f: SeedFuturo): Promise<SeedEstado> {
  const { fecha, error } = await ultimaFecha(f.tabla, f.col);
  const restantes = fecha ? -diasDesde(fecha) : null;
  const estado: SeedEstado["estado"] = error ? "error" : restantes == null || restantes < f.minDiasFuturo ? "por-agotarse" : "ok";
  return { ...f, fecha, restantes, estado, error };
}

export type FrescuraGlobal = {
  checks: ChequeoFrescura[];
  matviews: MatviewEstado[];
  futuro: SeedEstado[];
  seedCalendario: { fecha: string; restantes: number; estado: "ok" | "por-agotarse" };
  /** Cantidad total de chequeos con problema (checks + matviews + futuro + seed), para el KPI del panel. */
  nProblemas: number;
};

export async function getFrescura(): Promise<FrescuraGlobal> {
  const [checks, matviews, futuro] = await Promise.all([
    Promise.all(CHECKS.map(evaluarCheck)),
    Promise.all(MATVIEWS.map(evaluarMatview)),
    Promise.all(FUTURO.map(evaluarSeed)),
  ]);

  const restantesSeed = -diasDesde(ULTIMO_SEED_CALENDARIO);
  const seedCalendario = {
    fecha: ULTIMO_SEED_CALENDARIO,
    restantes: restantesSeed,
    estado: (restantesSeed < MIN_DIAS_SEED_CALENDARIO ? "por-agotarse" : "ok") as "ok" | "por-agotarse",
  };

  const nProblemas =
    checks.filter((c) => c.estado !== "ok").length +
    matviews.filter((m) => m.estado !== "ok").length +
    futuro.filter((f) => f.estado !== "ok").length +
    (seedCalendario.estado !== "ok" ? 1 : 0);

  return { checks, matviews, futuro, seedCalendario, nProblemas };
}
