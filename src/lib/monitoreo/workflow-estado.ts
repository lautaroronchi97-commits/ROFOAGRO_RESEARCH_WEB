/**
 * Lógica PURA de "¿en qué estado está este workflow?" — extraída de `/admin/conexiones` (vivía
 * ahí como función local `estadoWorkflow()`) para que `/admin/checklist` la reuse: los dos
 * paneles necesitan el mismo veredicto (rojo = algo se rompió, dorado = corrió bien pero el
 * dato que produce está atrasado), solo cambia cómo lo presentan.
 */

import type { Color } from "@/components/admin-chip";
import type { ChequeoFrescura } from "./frescura";
import type { RunWorkflow } from "./github-runs";
import type { Workflow } from "./catalogo";

export type { Color };

export function estadoWorkflow(
  w: Workflow,
  run: RunWorkflow | undefined,
  checks: ChequeoFrescura[],
): { color: Color; texto: string } {
  const propios = checks.filter((c) => w.checkNombres.includes(c.nombre));
  const datoAtrasado = propios.some((c) => c.estado === "atrasado" || c.estado === "error");

  if (run) {
    if (run.estado === "failure") return { color: "rojo", texto: "Último run falló" };
    if (run.estado === "en-curso") return { color: "dorado", texto: "Corriendo" };
    if (run.estado === "success") {
      return datoAtrasado ? { color: "dorado", texto: "Run OK, dato atrasado" } : { color: "verde", texto: "OK" };
    }
    return { color: "neutro", texto: "Sin runs todavía" };
  }
  if (propios.length > 0) {
    return datoAtrasado ? { color: "rojo", texto: "Dato atrasado" } : { color: "verde", texto: "Dato al día" };
  }
  return { color: "neutro", texto: w.tieneSchedule ? "Sin señal (falta el token)" : "Manual" };
}
