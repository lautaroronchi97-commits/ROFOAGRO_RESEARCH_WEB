import "server-only";
import { cache } from "react";
import { sbSelectAll } from "../supabase";
import type { Meta } from "../market";
import { PRODUCTO_DISPLAY, type ProductoCamiones } from "./config";
import type { ProductoAgroentregas } from "./agroentregas";

/**
 * plantas.ts — Capa de datos del feed diario de camiones de **Agroentregas** (C24 del backlog
 * maestro), tabla `camiones_plantas`. Research: docs/negocio/10_fuente_camiones_agroentregas.md.
 *
 * ⚠️ Universo distinto al de `camiones.ts` (Williams Entregas): acá son las ~28 plantas de Up River
 * y del Paraná bonaerense que atiende Agroentregas — SIN Bahía Blanca ni Necochea. Su total NO es
 * el nacional y no se compara con el de Williams. Lo que aporta y ninguna otra fuente da: el
 * detalle por PLANTA y por EMPRESA, y la frescura diaria automática.
 *
 * Los comparativos interanuales (mismo día de la semana de hace 1 y 2 años) los guarda la propia
 * ingesta, así que el delta interanual sale de la tabla como cualquier otro día — sin caso especial.
 */

const SOURCE = "Agroentregas";
const REVALIDATE = 1800; // 30 min (la fuente actualiza durante el día; el cron escribe 2 veces)

type Row = { fecha: string; planta_id: string; planta: string; empresa: string; producto: string; cantidad: number };

/** Nombre lindo de cada grano; OTROS solo existe en esta fuente, el resto reusa el del módulo. */
const DISPLAY: Record<ProductoAgroentregas, string> = {
  ...(PRODUCTO_DISPLAY as Record<ProductoCamiones, string>),
  OTROS: "Otros",
};

/** Orden de exposición: los granos que más mueven primero, OTROS al final. */
const ORDEN: ProductoAgroentregas[] = ["SBS", "MAIZE", "WHEAT", "SFSEED", "SORGHUM", "BARLEY", "OTROS"];

export type SeriePlantas = { key: string; display: string; puntos: { fecha: string; cantidad: number }[] };

export type FilaEmpresa = {
  empresa: string;
  cantidad: number;
  share: number; // % del total del día
  plantas: { planta: string; cantidad: number }[];
  granoLider: { display: string; cantidad: number } | null;
  /** Apertura por grano (mayor a menor) — sostiene el filtro "por grano" de la tabla/histograma. */
  porGrano: { cod: ProductoAgroentregas; display: string; cantidad: number }[];
};

export type PlantasData = {
  fecha: string | null;
  totalDia: number | null;
  deltaDiaAnterior: number | null;
  /** vs el mismo día de la semana del año pasado — el comparativo que publica la propia fuente. */
  deltaInteranual: { valor: number; pct: number; fecha: string } | null;
  granoLider: { display: string; cantidad: number } | null;
  plantasReportadas: number | null;
  porGrano: SeriePlantas[];
  /** Solo mesa: quién recibió camiones hoy, por empresa (con sus plantas). */
  porEmpresa: FilaEmpresa[];
  meta: Meta;
};

const vacia = (problema: string): PlantasData => ({
  fecha: null,
  totalDia: null,
  deltaDiaAnterior: null,
  deltaInteranual: null,
  granoLider: null,
  plantasReportadas: null,
  porGrano: [],
  porEmpresa: [],
  meta: { source: SOURCE, updatedAt: null, status: "parcial", problemas: [problema] },
});

/** ISO − n días, en UTC (las fechas de la tabla son días calendario sin hora). */
function menosDias(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
}

export const getCamionesPlantas = cache(async (): Promise<PlantasData> => {
  const res = await sbSelectAll(
    "camiones_plantas?select=fecha,planta_id,planta,empresa,producto,cantidad&order=fecha.asc",
    REVALIDATE,
  );
  if (!res.ok) {
    return vacia(res.reason === "unconfigured" ? "Supabase sin configurar" : "Tabla camiones_plantas no disponible");
  }
  const rows = res.data as Row[];
  if (rows.length === 0) return vacia("Sin datos todavía — la ingesta diaria arranca al mergear");

  // --- Total por día (suma de las filas TOTAL de cada planta) ---
  const totalPorFecha = new Map<string, number>();
  const plantasPorFecha = new Map<string, number>();
  for (const r of rows) {
    if (r.producto !== "TOTAL") continue;
    totalPorFecha.set(r.fecha, (totalPorFecha.get(r.fecha) ?? 0) + Number(r.cantidad));
    plantasPorFecha.set(r.fecha, (plantasPorFecha.get(r.fecha) ?? 0) + 1);
  }
  const fechas = [...totalPorFecha.keys()].sort();
  const fecha = fechas[fechas.length - 1] ?? null;
  if (fecha === null) return vacia("Sin filas de total por planta");

  // --- Serie por grano (una serie por grano con movimiento, ordenada por relevancia) ---
  const porGranoMap = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (r.producto === "TOTAL") continue;
    if (!porGranoMap.has(r.producto)) porGranoMap.set(r.producto, new Map());
    const m = porGranoMap.get(r.producto)!;
    m.set(r.fecha, (m.get(r.fecha) ?? 0) + Number(r.cantidad));
  }
  const porGrano: SeriePlantas[] = ORDEN.filter((p) => porGranoMap.has(p)).map((p) => ({
    key: p,
    display: DISPLAY[p],
    puntos: [...porGranoMap.get(p)!.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([f, cantidad]) => ({ fecha: f, cantidad })),
  }));

  const totalDia = totalPorFecha.get(fecha) ?? null;

  // --- Delta vs el día anterior CON DATO (no vs "ayer" calendario: la serie tiene huecos por
  //     diseño, los comparativos interanuales son islas de una sola fecha) ---
  let deltaDiaAnterior: number | null = null;
  const idx = fechas.indexOf(fecha);
  if (idx > 0 && totalDia != null) {
    const previa = fechas[idx - 1]!;
    // Solo tiene sentido comparar contra un día REALMENTE contiguo (≤4 días atrás cubre un fin de
    // semana largo); si el anterior con dato es de hace un año, no es un "día anterior".
    if (Date.parse(`${fecha}T00:00:00Z`) - Date.parse(`${previa}T00:00:00Z`) <= 4 * 86_400_000) {
      deltaDiaAnterior = totalDia - (totalPorFecha.get(previa) ?? 0);
    }
  }

  // --- Delta interanual: el bloque comparativo que trae la fuente es el mismo día de la SEMANA del
  //     año pasado (52 semanas = 364 días en el caso verificado del 28/07/2026), pero según cómo
  //     caiga el calendario puede ser 371. Se busca el día con dato más cercano a un año atrás
  //     dentro de esa ventana de ±1 semana, en vez de clavar 364 y quedarse sin comparativo. ---
  let deltaInteranual: PlantasData["deltaInteranual"] = null;
  if (totalDia != null) {
    const objetivo = Date.parse(`${menosDias(fecha, 364)}T00:00:00Z`);
    let mejor: string | null = null;
    for (const f of fechas) {
      const dist = Math.abs(Date.parse(`${f}T00:00:00Z`) - objetivo);
      if (dist > 7 * 86_400_000) continue;
      if (mejor === null || dist < Math.abs(Date.parse(`${mejor}T00:00:00Z`) - objetivo)) mejor = f;
    }
    const totalAnterior = mejor === null ? null : totalPorFecha.get(mejor);
    if (mejor !== null && totalAnterior != null && totalAnterior > 0) {
      deltaInteranual = {
        valor: totalDia - totalAnterior,
        pct: (totalDia / totalAnterior - 1) * 100,
        fecha: mejor,
      };
    }
  }

  // --- Grano líder del día ---
  let granoLider: PlantasData["granoLider"] = null;
  for (const s of porGrano) {
    const v = s.puntos.find((p) => p.fecha === fecha)?.cantidad;
    if (v != null && (granoLider == null || v > granoLider.cantidad)) {
      granoLider = { display: s.display, cantidad: v };
    }
  }

  // --- Apertura por empresa del último día (solo mesa) ---
  const delDia = rows.filter((r) => r.fecha === fecha);
  const porEmpresaMap = new Map<string, { cantidad: number; plantas: Map<string, number>; granos: Map<string, number> }>();
  for (const r of delDia) {
    if (!porEmpresaMap.has(r.empresa)) {
      porEmpresaMap.set(r.empresa, { cantidad: 0, plantas: new Map(), granos: new Map() });
    }
    const e = porEmpresaMap.get(r.empresa)!;
    if (r.producto === "TOTAL") {
      e.cantidad += Number(r.cantidad);
      e.plantas.set(r.planta, (e.plantas.get(r.planta) ?? 0) + Number(r.cantidad));
    } else {
      e.granos.set(r.producto, (e.granos.get(r.producto) ?? 0) + Number(r.cantidad));
    }
  }
  const porEmpresa: FilaEmpresa[] = [...porEmpresaMap.entries()]
    .map(([empresa, e]) => {
      let lider: FilaEmpresa["granoLider"] = null;
      const porGrano: FilaEmpresa["porGrano"] = [];
      for (const [cod, cantidad] of e.granos) {
        const display = DISPLAY[cod as ProductoAgroentregas] ?? cod;
        porGrano.push({ cod: cod as ProductoAgroentregas, display, cantidad });
        if (lider == null || cantidad > lider.cantidad) lider = { display, cantidad };
      }
      porGrano.sort((a, b) => b.cantidad - a.cantidad);
      return {
        empresa,
        cantidad: e.cantidad,
        share: totalDia && totalDia > 0 ? (e.cantidad / totalDia) * 100 : 0,
        plantas: [...e.plantas.entries()]
          .map(([planta, cantidad]) => ({ planta, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad),
        granoLider: lider,
        porGrano,
      };
    })
    .sort((a, b) => b.cantidad - a.cantidad);

  return {
    fecha,
    totalDia,
    deltaDiaAnterior,
    deltaInteranual,
    granoLider,
    plantasReportadas: plantasPorFecha.get(fecha) ?? null,
    porGrano,
    porEmpresa,
    meta: { source: SOURCE, updatedAt: null, status: "real", problemas: [] },
  };
});
