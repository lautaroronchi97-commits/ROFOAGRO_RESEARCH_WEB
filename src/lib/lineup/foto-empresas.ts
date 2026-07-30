import type { BuqueRow } from "./foto";
import type { Zona } from "./zonas";

/**
 * foto-empresas.ts — Drill-down por empresa sobre la foto operativa (relevamiento web R10,
 * punto 54: "corte por empresa" al hacer click en un producto o una zona). Módulo PURO: no
 * hace falta tocar `getFotoOperativa`/Supabase — `buques` YA trae producto+zona+empresa+
 * toneladas por fila, así que la agregación es aritmética de UI, no una dimensión nueva de
 * datos. Reusado por el drill-down de la tabla "Por producto" y de "Por zona".
 */

export type FilaEmpresaFoto = { empresa: string; buques: number; toneladas: number };

function agregar(rows: BuqueRow[]): FilaEmpresaFoto[] {
  const m = new Map<string, { vessels: Set<string>; toneladas: number }>();
  for (const b of rows) {
    if (!m.has(b.empresa)) m.set(b.empresa, { vessels: new Set(), toneladas: 0 });
    const e = m.get(b.empresa)!;
    e.vessels.add(b.vessel);
    e.toneladas += b.toneladas ?? 0;
  }
  return [...m.entries()]
    .map(([empresa, e]) => ({ empresa, buques: e.vessels.size, toneladas: e.toneladas }))
    .sort((a, b) => b.toneladas - a.toneladas);
}

/** Empresas con buques del producto dado (código o display — se filtra por `producto` exacto). */
export function empresasPorProducto(buques: BuqueRow[], producto: string): FilaEmpresaFoto[] {
  return agregar(buques.filter((b) => b.producto === producto));
}

/** Empresas con buques en la zona dada. */
export function empresasPorZona(buques: BuqueRow[], zona: Zona): FilaEmpresaFoto[] {
  return agregar(buques.filter((b) => b.zona === zona));
}

/** Total por zona de un subconjunto ya filtrado de buques (para el buscador de la tabla). */
export function totalesPorZona(buques: BuqueRow[]): { zona: Zona; buques: number; toneladas: number }[] {
  const m = new Map<Zona, { vessels: Set<string>; toneladas: number }>();
  for (const b of buques) {
    if (!m.has(b.zona)) m.set(b.zona, { vessels: new Set(), toneladas: 0 });
    const z = m.get(b.zona)!;
    z.vessels.add(b.vessel);
    z.toneladas += b.toneladas ?? 0;
  }
  return [...m.entries()]
    .map(([zona, z]) => ({ zona, buques: z.vessels.size, toneladas: z.toneladas }))
    .sort((a, b) => b.toneladas - a.toneladas);
}
