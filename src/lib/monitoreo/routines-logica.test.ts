import { describe, it, expect } from "vitest";
import { fechaEsperadaMasReciente, ventanaEsperada, evaluarInforme, evaluarView, evaluarPorTelemetria } from "./routines-logica";
import type { RoutineDef } from "./catalogo";

const INFORME_DIARIO: RoutineDef = { id: "informe-diario", nombre: "Informe diario", horarioArt: "18:30 (L-V)", diasSemana: [1, 2, 3, 4, 5] };
const VIEW_MERCADO: RoutineDef = { id: "view-mercado", nombre: "View de mercado", horarioArt: "viernes 09:00", diasSemana: [5] };
const INTERPRETACIONES: RoutineDef = { id: "interpretaciones", nombre: "Interpretaciones", horarioArt: "9:00 + cierre 18:20 (L-V)", diasSemana: [1, 2, 3, 4, 5] };

describe("routines-logica.ts — fechaEsperadaMasReciente", () => {
  it("si hoy matchea un día programado, devuelve hoy", () => {
    // 2026-07-29 es miércoles (3), incluido en L-V.
    expect(fechaEsperadaMasReciente([1, 2, 3, 4, 5], "2026-07-29")).toBe("2026-07-29");
  });

  it("si hoy no matchea, retrocede al día programado más reciente", () => {
    // 2026-07-29 es miércoles; el viernes más reciente ≤ hoy es 2026-07-24.
    expect(fechaEsperadaMasReciente([5], "2026-07-29")).toBe("2026-07-24");
  });

  it("si hoy ES el día programado (viernes), devuelve hoy mismo", () => {
    expect(fechaEsperadaMasReciente([5], "2026-07-31")).toBe("2026-07-31");
  });
});

describe("routines-logica.ts — ventanaEsperada", () => {
  it("informe diario: hoy hábil, después del horario+margen → vencida", () => {
    const r = ventanaEsperada(INFORME_DIARIO, "2026-07-29", 20 * 60); // 20:00, umbral 18:30+45=19:15
    expect(r).toEqual({ fechaEsperada: "2026-07-29", vencio: true });
  });

  it("informe diario: hoy hábil, antes del horario+margen → todavía no vence", () => {
    const r = ventanaEsperada(INFORME_DIARIO, "2026-07-29", 16 * 60 + 40); // 16:40
    expect(r).toEqual({ fechaEsperada: "2026-07-29", vencio: false });
  });

  it("view de mercado: hoy no es viernes → la ventana esperada es un día pasado, siempre vencida", () => {
    const r = ventanaEsperada(VIEW_MERCADO, "2026-07-29", 8 * 60); // miércoles a la mañana
    expect(r).toEqual({ fechaEsperada: "2026-07-24", vencio: true });
  });

  it("view de mercado: hoy es viernes, antes de las 9:45 → no vencida", () => {
    const r = ventanaEsperada(VIEW_MERCADO, "2026-07-31", 8 * 60 + 20);
    expect(r).toEqual({ fechaEsperada: "2026-07-31", vencio: false });
  });

  it("view de mercado: hoy es viernes, después de las 9:45 → vencida", () => {
    const r = ventanaEsperada(VIEW_MERCADO, "2026-07-31", 10 * 60);
    expect(r).toEqual({ fechaEsperada: "2026-07-31", vencio: true });
  });
});

describe("routines-logica.ts — evaluarInforme", () => {
  it("sin fila y sin vencer → pendiente, todavía no le toca", () => {
    expect(evaluarInforme(undefined, false)).toEqual({ estado: "pendiente", detalle: "Todavía no le toca correr hoy." });
  });

  it("sin fila y vencida → atrasado, no corrió", () => {
    expect(evaluarInforme(undefined, true)).toEqual({ estado: "atrasado", detalle: "No corrió." });
  });

  it("fila en borrador y vencida → atrasado, se cortó a mitad", () => {
    const fila = { fecha: "2026-07-29", estado: "borrador" as const, path_png: null, path_pdf: null };
    expect(evaluarInforme(fila, true).estado).toBe("atrasado");
  });

  it("fila en borrador y sin vencer → pendiente (todavía en curso)", () => {
    const fila = { fecha: "2026-07-29", estado: "borrador" as const, path_png: null, path_pdf: null };
    expect(evaluarInforme(fila, false).estado).toBe("pendiente");
  });

  it("fila enviada → ok, sin importar si venció", () => {
    const fila = { fecha: "2026-07-29", estado: "enviado" as const, path_png: "x.png", path_pdf: null };
    expect(evaluarInforme(fila, true).estado).toBe("ok");
    expect(evaluarInforme(fila, false).estado).toBe("ok");
  });
});

describe("routines-logica.ts — evaluarView", () => {
  it("3 filas → ok (los 3 granos)", () => {
    expect(evaluarView(3, true).estado).toBe("ok");
  });

  it("1-2 filas y vencida → atrasado, corrida parcial", () => {
    const r = evaluarView(2, true);
    expect(r.estado).toBe("atrasado");
    expect(r.detalle).toContain("2/3");
  });

  it("1-2 filas y sin vencer → pendiente (todavía en curso)", () => {
    expect(evaluarView(1, false).estado).toBe("pendiente");
  });

  it("0 filas y vencida → atrasado, no corrió", () => {
    expect(evaluarView(0, true)).toEqual({ estado: "atrasado", detalle: "No corrió." });
  });

  it("0 filas y sin vencer → pendiente, todavía no le toca", () => {
    expect(evaluarView(0, false)).toEqual({ estado: "pendiente", detalle: "Todavía no le toca correr hoy." });
  });
});

describe("routines-logica.ts — evaluarPorTelemetria (interpretaciones, N13)", () => {
  it("≥1 corrida → ok, sin importar si venció (un día sin reportes es un día legítimo sin filas)", () => {
    expect(evaluarPorTelemetria(1, true).estado).toBe("ok");
    expect(evaluarPorTelemetria(3, false).estado).toBe("ok");
  });

  it("0 corridas y vencida (después del cierre) → atrasado, no corrió", () => {
    expect(evaluarPorTelemetria(0, true)).toEqual({ estado: "atrasado", detalle: "No corrió." });
  });

  it("0 corridas y sin vencer (antes del cierre) → pendiente, todavía no le toca", () => {
    expect(evaluarPorTelemetria(0, false)).toEqual({ estado: "pendiente", detalle: "Todavía no le toca correr hoy." });
  });

  it("ventanaEsperada de interpretaciones vence recién después de las 18:20+45", () => {
    // 2026-07-29 es miércoles (hábil); a las 17:00 el cierre (18:20) todavía no pasó.
    expect(ventanaEsperada(INTERPRETACIONES, "2026-07-29", 17 * 60)).toEqual({ fechaEsperada: "2026-07-29", vencio: false });
    // A las 19:10 ya pasó el cierre + margen (18:20+45=19:05).
    expect(ventanaEsperada(INTERPRETACIONES, "2026-07-29", 19 * 60 + 10)).toEqual({ fechaEsperada: "2026-07-29", vencio: true });
  });
});
