import "server-only";
import { cache } from "react";
import { sbSelect } from "./supabase";
import type { Meta } from "./market";
import { familiaDe, type Familia } from "./djve-familias";

export { ORDEN_FAMILIAS, type Familia } from "./djve-familias";

/**
 * DJVE — Declaraciones Juradas de Ventas al Exterior (Ley 21.453), desde MAGyP.
 * Se leen de la vista `djve_resumen` (agregado por producto: acumulado del año
 * en curso + ventanas de 7 y 30 días). Datos históricos guardados en Supabase.
 */

export type DjveRow = {
  producto: string;
  familia: Familia;
  tonAnio: number | null;
  ton30d: number | null;
  ton7d: number | null;
  n7d: number;
};

export type DjveData = {
  productos: DjveRow[];
  anio: number | null;
  totalAnio: number;
  meta: Meta;
};

type RawRow = {
  producto: string;
  ult_anio: number | null;
  ton_anio: number | null;
  ton_30d: number | null;
  ton_7d: number | null;
  n_7d: number | null;
  ult_registro: string | null;
  actualizado_en: string | null;
};

const SOURCE = "SAGyP";

function tsMs(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

export const getDjveResumen = cache(async (): Promise<DjveData> => {
  const res = await sbSelect("djve_resumen?select=*&order=ton_anio.desc.nullslast", 900);

  if (!res.ok) {
    const problema =
      res.reason === "unconfigured"
        ? "Supabase sin configurar (falta SUPABASE_URL / SUPABASE_ANON_KEY)"
        : "Fuente DJVE caída";
    return { productos: [], anio: null, totalAnio: 0, meta: { source: SOURCE, updatedAt: null, status: "parcial", problemas: [problema] } };
  }

  const raw = (Array.isArray(res.data) ? res.data : []) as RawRow[];

  const productos: DjveRow[] = raw
    .filter((r) => r.producto)
    .map((r) => ({
      producto: r.producto,
      familia: familiaDe(r.producto),
      tonAnio: r.ton_anio,
      ton30d: r.ton_30d,
      ton7d: r.ton_7d,
      n7d: r.n_7d ?? 0,
    }));

  const anio = raw.reduce<number | null>((mx, r) => (r.ult_anio && (mx === null || r.ult_anio > mx) ? r.ult_anio : mx), null);
  const totalAnio = productos.reduce((s, p) => s + (p.tonAnio ?? 0), 0);
  const updatedAt = raw.reduce<number | null>((mx, r) => {
    const t = tsMs(r.actualizado_en);
    return t !== null && (mx === null || t > mx) ? t : mx;
  }, null);

  return {
    productos,
    anio,
    totalAnio,
    meta: {
      source: SOURCE,
      updatedAt,
      status: productos.length > 0 ? "real" : "parcial",
      problemas: productos.length > 0 ? [] : ["Sin registros DJVE"],
    },
  };
});
