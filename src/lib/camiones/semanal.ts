import "server-only";
import { cache } from "react";
import { getCamiones, type CamionesData } from "./camiones";
import { getCamionesPlantas, type PlantasData } from "./plantas";
import { sumaVentana, type PuntoValor, type VentanaSuma } from "../informe-v3-calc";

/**
 * camiones/semanal.ts — camiones de la semana (E1 de docs/PLAN_INFORMES_V3.md §6.1: "camiones en
 * puerto de la semana"), agregación nacional Williams (4 zonas) + Agroentregas (Up River) sobre
 * las series diarias que `getCamiones()`/`getCamionesPlantas()` ya traen — sin query nueva.
 * Universos DISTINTOS (ver camiones/plantas.ts): nunca se suman entre sí, cada fuente reporta su
 * propio total + Δ vs la semana previa.
 */

function serieNacional(porSerie: { puntos: { fecha: string; cantidad: number }[] }[]): PuntoValor[] {
  const porFecha = new Map<string, number>();
  for (const serie of porSerie) {
    for (const p of serie.puntos) porFecha.set(p.fecha, (porFecha.get(p.fecha) ?? 0) + p.cantidad);
  }
  return [...porFecha.entries()].map(([fecha, valor]) => ({ fecha, valor }));
}

export type CamionesSemana = { williams: VentanaSuma; agroentregas: VentanaSuma };

function vacio(): CamionesSemana {
  const v: VentanaSuma = { totalActual: null, totalPrevio: null, deltaPct: null, nActual: 0, nPrevio: 0 };
  return { williams: v, agroentregas: v };
}

export const getCamionesSemana = cache(async (hastaISO: string): Promise<CamionesSemana> => {
  const [williams, plantas]: [CamionesData, PlantasData] = await Promise.all([
    getCamiones(),
    getCamionesPlantas(),
  ]);
  if (williams.porZona.length === 0 && plantas.porGrano.length === 0) return vacio();
  return {
    williams: sumaVentana(serieNacional(williams.porZona), hastaISO, 7),
    agroentregas: sumaVentana(serieNacional(plantas.porGrano), hastaISO, 7),
  };
});
