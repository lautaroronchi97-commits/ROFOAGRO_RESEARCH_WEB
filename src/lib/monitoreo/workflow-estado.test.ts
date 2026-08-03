import { describe, it, expect } from "vitest";
import { estadoWorkflow } from "./workflow-estado";
import type { Workflow } from "./catalogo";
import type { RunWorkflow } from "./github-runs";
import type { ChequeoFrescura } from "./frescura";

const W: Workflow = {
  archivo: "ingest-x",
  nombre: "Ingesta X",
  horarioArt: "10:00",
  checkNombres: ["x"],
  tieneSchedule: true,
};

const W_SIN_CHECK: Workflow = { ...W, archivo: "ingest-y", checkNombres: [] };
const W_MANUAL: Workflow = { ...W_SIN_CHECK, archivo: "cargar-y", tieneSchedule: false };

function check(estado: ChequeoFrescura["estado"], nombre = "x"): ChequeoFrescura {
  return { nombre, tabla: "t", col: "c", maxDias: 7, cadencia: "diario", fecha: "2026-08-01", dias: 2, estado, error: null };
}

function run(estado: RunWorkflow["estado"]): RunWorkflow {
  return { ...W, estado, fecha: "2026-08-03T10:00:00Z", urlRun: "https://x" };
}

describe("workflow-estado.ts — estadoWorkflow", () => {
  it("run falló → rojo, sin importar el estado del dato", () => {
    expect(estadoWorkflow(W, run("failure"), [check("ok")])).toEqual({ color: "rojo", texto: "Último run falló" });
  });

  it("run en curso → dorado", () => {
    expect(estadoWorkflow(W, run("en-curso"), [])).toEqual({ color: "dorado", texto: "Corriendo" });
  });

  it("run OK + dato al día → verde", () => {
    expect(estadoWorkflow(W, run("success"), [check("ok")])).toEqual({ color: "verde", texto: "OK" });
  });

  it("run OK + dato atrasado → dorado 'Run OK, dato atrasado' (el caso CONAB: cron sano, fuente atrasada)", () => {
    expect(estadoWorkflow(W, run("success"), [check("atrasado")])).toEqual({
      color: "dorado",
      texto: "Run OK, dato atrasado",
    });
  });

  it("run OK + check en error → también cuenta como dato atrasado", () => {
    expect(estadoWorkflow(W, run("success"), [check("error")])).toEqual({
      color: "dorado",
      texto: "Run OK, dato atrasado",
    });
  });

  it("run desconocido → neutro", () => {
    expect(estadoWorkflow(W, run("desconocido"), [])).toEqual({ color: "neutro", texto: "Sin runs todavía" });
  });

  it("sin run (sin token de GitHub) pero con checks propios al día → verde 'Dato al día'", () => {
    expect(estadoWorkflow(W, undefined, [check("ok")])).toEqual({ color: "verde", texto: "Dato al día" });
  });

  it("sin run, con checks propios atrasados → rojo 'Dato atrasado'", () => {
    expect(estadoWorkflow(W, undefined, [check("atrasado")])).toEqual({ color: "rojo", texto: "Dato atrasado" });
  });

  it("sin run, sin checks propios, con schedule → neutro 'falta el token'", () => {
    expect(estadoWorkflow(W_SIN_CHECK, undefined, [check("ok")])).toEqual({
      color: "neutro",
      texto: "Sin señal (falta el token)",
    });
  });

  it("sin run, sin checks propios, dispatch-only → neutro 'Manual'", () => {
    expect(estadoWorkflow(W_MANUAL, undefined, [])).toEqual({ color: "neutro", texto: "Manual" });
  });

  it("checks de OTRO workflow no cuentan (filtra por checkNombres)", () => {
    expect(estadoWorkflow(W, run("success"), [check("atrasado", "otro-check")])).toEqual({
      color: "verde",
      texto: "OK",
    });
  });
});
