/**
 * Lógica PURA de `routines.ts` (ventana esperada + veredicto), separada a propósito en un
 * módulo sin `import "server-only"` para que sea testeable con Vitest — mismo motivo que
 * `manual-logica.ts`.
 */

import { isoMenosDias } from "./manual-logica";
import type { RoutineDef } from "./catalogo";

export type EstadoRoutine = "ok" | "pendiente" | "atrasado";

/** Horario programado de cada Routine, en minutos desde medianoche (ART) — para saber si ya
 *  "le tocaba" correr hoy. Separado de `horarioArt` (texto humano) porque acá hace falta el
 *  número para comparar contra la hora actual. */
export const HORA_MIN: Record<RoutineDef["id"], number> = {
  "informe-diario": 18 * 60 + 30,
  "informe-semanal": 19 * 60,
  "view-mercado": 9 * 60,
};

/** Margen tras el horario programado antes de considerar la ventana "vencida" — una Routine
 *  puede tardar unos minutos en terminar, no hay que marcarla en rojo apenas pasa la hora en punto. */
export const MARGEN_MIN = 45;

export function diaSemanaISO(iso: string): number {
  return new Date(`${iso}T12:00:00-03:00`).getUTCDay();
}

/** Fecha (ISO, Córdoba) del día programado más reciente ≤ hoy, buscando hacia atrás hasta 7 días. */
export function fechaEsperadaMasReciente(diasSemana: number[], hoyISO: string): string {
  for (let i = 0; i < 7; i++) {
    const candidata = isoMenosDias(hoyISO, i);
    if (diasSemana.includes(diaSemanaISO(candidata))) return candidata;
  }
  return hoyISO; // no debería pasar (diasSemana siempre tiene al menos 1 día)
}

/** Dado el catálogo + el reloj actual (inyectado), calcula qué fecha le tocaba a la Routine y
 *  si esa ventana ya venció (para no marcar "atrasado" algo que todavía no le tocó correr hoy). */
export function ventanaEsperada(
  routine: RoutineDef,
  hoyISO: string,
  ahoraMin: number,
): { fechaEsperada: string; vencio: boolean } {
  const fechaEsperada = fechaEsperadaMasReciente(routine.diasSemana, hoyISO);
  const esHoy = fechaEsperada === hoyISO;
  const vencio = !esHoy || ahoraMin >= HORA_MIN[routine.id] + MARGEN_MIN;
  return { fechaEsperada, vencio };
}

export type InformeRow = { fecha: string; estado: "borrador" | "enviado"; path_png: string | null; path_pdf: string | null };

/** Evalúa el estado de un informe (diario/semanal) dada su fila esperada (o su ausencia). */
export function evaluarInforme(fila: InformeRow | undefined, vencio: boolean): { estado: EstadoRoutine; detalle: string } {
  if (fila?.estado === "enviado") return { estado: "ok", detalle: `Enviado (${fila.fecha}).` };
  if (fila) return { estado: vencio ? "atrasado" : "pendiente", detalle: `En borrador desde ${fila.fecha} — se cortó a mitad de camino.` };
  return vencio ? { estado: "atrasado", detalle: "No corrió." } : { estado: "pendiente", detalle: "Todavía no le toca correr hoy." };
}

/** Evalúa el view de mercado por la cantidad de filas (una por grano, 3 esperadas). */
export function evaluarView(nFilas: number, vencio: boolean): { estado: EstadoRoutine; detalle: string } {
  if (nFilas >= 3) return { estado: "ok", detalle: "Los 3 granos generados." };
  if (nFilas > 0) return { estado: vencio ? "atrasado" : "pendiente", detalle: `Corrida parcial: ${nFilas}/3 granos.` };
  return vencio ? { estado: "atrasado", detalle: "No corrió." } : { estado: "pendiente", detalle: "Todavía no le toca correr hoy." };
}
