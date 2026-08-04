import "server-only";
import { cache } from "react";
import { sbSelectAll } from "./supabase";
import { hoyCordobaISO } from "./dates";
import type { Meta } from "./market";
import { sumaVentana, type VentanaSuma } from "./informe-v3-calc";

/**
 * bcra-mulc.ts — Compras netas de divisas del BCRA en el MULC (C4 del backlog maestro, research en
 * docs/negocio/07_fuente_compras_netas_bcra.md).
 *
 * Fuente: tabla `compras_bcra` (fecha PK, monto_musd, fuente) — combina DOS orígenes en la misma
 * fila por fecha, "el que llegue último gana":
 *   - `fuente='api'`: ingesta automática diaria (scripts/ingest-bcra-mulc.mjs) desde la API v4 de
 *     monetarias del BCRA (variable 78, "Variación de reservas internacionales por compra de
 *     divisas") — dato oficial en M USD, con ~3-4 días hábiles de rezago.
 *   - `fuente='manual'`: carga a mano de Lautaro en /admin/datos (patrón "color de la rueda" de
 *     MP1) para el hueco de los días recientes que la oficial todavía no cubre. Se pisa sola
 *     cuando la ingesta automática trae el dato real de esa fecha (mismo PK, upsert).
 */

const REVALIDATE = 3600; // 1h — serie de baja frecuencia (rezago de días + carga manual esporádica)

export type PuntoBcraMulc = { fecha: string; montoMusd: number; fuente: "manual" | "api" };

export type BcraMulcData = {
  ultimo: PuntoBcraMulc | null;
  acumuladoMes: number | null;
  acumuladoAnio: number | null;
  filasMes: number;
  filasAnio: number;
  serie: PuntoBcraMulc[]; // últimos 90 puntos, para el gráfico
  meta: Meta;
};

const vacia = (problema: string): BcraMulcData => ({
  ultimo: null,
  acumuladoMes: null,
  acumuladoAnio: null,
  filasMes: 0,
  filasAnio: 0,
  serie: [],
  meta: { source: "BCRA", updatedAt: null, status: "parcial", problemas: [problema] },
});

export const getComprasBcra = cache(async (): Promise<BcraMulcData> => {
  const res = await sbSelectAll("compras_bcra?select=fecha,monto_musd,fuente&order=fecha.asc", REVALIDATE);
  if (!res.ok) {
    return vacia(res.reason === "unconfigured" ? "Supabase sin configurar" : "Tabla compras_bcra no disponible");
  }
  const rows = (res.data as { fecha: string; monto_musd: number; fuente: "manual" | "api" }[]).filter(
    (r) => r.fecha && Number.isFinite(r.monto_musd),
  );
  if (rows.length === 0) {
    return vacia("Sin datos todavía — la ingesta automática corre a diario, o cargalo a mano desde /admin/datos");
  }

  const puntos: PuntoBcraMulc[] = rows.map((r) => ({ fecha: r.fecha, montoMusd: r.monto_musd, fuente: r.fuente }));
  const ultimo = puntos[puntos.length - 1]!; // rows.length===0 ya salió arriba

  // Acumulado por mes/año CALENDARIO de hoy (no del último dato: así el acumulado del mes en curso
  // arranca en 0 el día 1, aunque la última fila cargada sea de unos días atrás por el rezago).
  const hoy = hoyCordobaISO();
  const mesHoy = hoy.slice(0, 7);
  const anioHoy = hoy.slice(0, 4);

  let acumuladoMes = 0;
  let filasMes = 0;
  let acumuladoAnio = 0;
  let filasAnio = 0;
  for (const p of puntos) {
    if (p.fecha.slice(0, 4) === anioHoy) {
      acumuladoAnio += p.montoMusd;
      filasAnio++;
      if (p.fecha.slice(0, 7) === mesHoy) {
        acumuladoMes += p.montoMusd;
        filasMes++;
      }
    }
  }

  return {
    ultimo,
    acumuladoMes: filasMes > 0 ? acumuladoMes : null,
    acumuladoAnio: filasAnio > 0 ? acumuladoAnio : null,
    filasMes,
    filasAnio,
    serie: puntos.slice(-90),
    meta: {
      source: "BCRA (API v4, var. 78) + carga manual",
      updatedAt: Date.now(),
      status: "real",
      problemas: [],
    },
  };
});

/** Acumulado semanal (últimos 7 días vs los 7 anteriores) sobre la `serie` que ya trae
 *  `getComprasBcra()` — insumo del informe semanal v3 (§6.1 "Variación del USD y compras del
 *  BCRA de la última semana"). Función aparte (no dentro de `getComprasBcra`) para no acoplar el
 *  panel `/dolar` —que no necesita esta ventana— a un cálculo que solo usa el informe. */
export function acumuladoSemanalBcra(serie: PuntoBcraMulc[], hastaISO: string): VentanaSuma {
  return sumaVentana(
    serie.map((p) => ({ fecha: p.fecha, valor: p.montoMusd })),
    hastaISO,
    7,
  );
}
