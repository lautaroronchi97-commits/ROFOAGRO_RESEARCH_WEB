import "server-only";
import { cache } from "react";
import { sbSelect } from "./supabase";
import type { Meta } from "./market";
import { familiaDe, type Familia } from "./djve-familias";

export { ORDEN_FAMILIAS, type Familia } from "./djve-familias";

/**
 * DJVE — Declaraciones Juradas de Ventas al Exterior (Ley 21.453), desde MAGyP.
 * Se leen de la matview `djve_resumen` (agregado por producto: acumulado del año
 * en curso + ventanas de 7 y 30 días; refrescada 2x/día por `refresh_lineup_visitas()`,
 * ver 20260807140000_djve_resumen_matview.sql). Datos históricos guardados en Supabase.
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

export type DjveDelDiaRow = { producto: string; familia: Familia; toneladas: number; registros: number };
export type DjveDelDiaData = { fecha: string | null; productos: DjveDelDiaRow[]; total: number };

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

/**
 * DJVE del día (feedback 07/08/2026: "agregame las djve del día") — sobre la tabla cruda
 * `djve` (no la vista `djve_resumen`, que solo agrega ventanas de 7/30 días/año). Dos queries:
 * el último `fecha_registro` con dato, y las filas de ese día agregadas por producto. El
 * "día" es el ÚLTIMO día con registros (puede tener rezago) — se muestra la fecha real, nunca
 * se etiqueta como "hoy" si no lo es.
 */
export const getDjveDelDia = cache(async (): Promise<DjveDelDiaData> => {
  const ultima = await sbSelect("djve?select=fecha_registro&order=fecha_registro.desc.nullslast&limit=1", 900);
  const fecha = ultima.ok && Array.isArray(ultima.data) && ultima.data[0]
    ? ((ultima.data[0] as { fecha_registro: string | null }).fecha_registro ?? null)
    : null;
  if (!fecha) return { fecha: null, productos: [], total: 0 };

  const res = await sbSelect(
    `djve?select=producto,toneladas&fecha_registro=eq.${encodeURIComponent(fecha)}`,
    900,
  );
  if (!res.ok || !Array.isArray(res.data)) return { fecha, productos: [], total: 0 };

  const porProducto = new Map<string, { toneladas: number; registros: number }>();
  for (const r of res.data as { producto: string | null; toneladas: number | null }[]) {
    if (!r.producto) continue;
    const acc = porProducto.get(r.producto) ?? { toneladas: 0, registros: 0 };
    acc.toneladas += r.toneladas ?? 0;
    acc.registros += 1;
    porProducto.set(r.producto, acc);
  }

  const productos: DjveDelDiaRow[] = [...porProducto.entries()]
    .map(([producto, v]) => ({ producto, familia: familiaDe(producto), toneladas: v.toneladas, registros: v.registros }))
    .sort((a, b) => b.toneladas - a.toneladas);
  const total = productos.reduce((s, p) => s + p.toneladas, 0);

  return { fecha, productos, total };
});
