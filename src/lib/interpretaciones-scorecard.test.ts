import { describe, it, expect } from "vitest";
import {
  calcularScorecardInterpretacion,
  resumirScorecardInterpretaciones,
  type ScorecardInterpretacion,
} from "./interpretaciones-scorecard";
import type { FuturoCierreRow } from "./views-scorecard";

function fila(posicion: string, fecha: string, settlement: number, underlying: string): FuturoCierreRow {
  return { underlying, posicion, fecha, settlement };
}

describe("calcularScorecardInterpretacion", () => {
  const rows: FuturoCierreRow[] = [
    fila("JUL26", "2026-07-10", 300, "SOJ"),
    fila("JUL26", "2026-07-17", 315, "SOJ"), // +5% a 7d -> alcista acierta
    fila("JUL26", "2026-07-24", 297, "SOJ"), // -1% a 14d -> alcista falla
    fila("JUL26", "2026-07-10", 200, "MAI"),
    fila("JUL26", "2026-07-17", 199, "MAI"), // -0.5% a 7d -> neutral acierta (banda 1%)
  ];

  it("mide cada grano del impacto contra SU underlying, t0 fijado en fecha_publicacion", () => {
    const interp = { id: "i1", fecha_publicacion: "2026-07-10", impacto: { soja: "alcista" as const, maiz: "neutral" as const } };
    const sc = calcularScorecardInterpretacion(interp, rows);
    expect(sc.porGrano).toHaveLength(2);

    const soja = sc.porGrano.find((g) => g.grano === "soja")!;
    expect(soja.posicionT0).toBe("JUL26");
    expect(soja.settlementT0).toBe(300);
    const w7 = soja.ventanas.find((v) => v.dias === 7)!;
    expect(w7.motivo).toBe("ok");
    expect(w7.acierto).toBe(true);
    const w14 = soja.ventanas.find((v) => v.dias === 14)!;
    expect(w14.motivo).toBe("ok");
    expect(w14.acierto).toBe(false); // 297/300 - 1 = -1% -> alcista falla

    const maiz = sc.porGrano.find((g) => g.grano === "maiz")!;
    const w7m = maiz.ventanas.find((v) => v.dias === 7)!;
    expect(w7m.acierto).toBe(true); // -0.5% dentro de la banda neutral
  });

  it("solo mide 7 y 14 días (no 28, a diferencia del scorecard del view)", () => {
    const interp = { id: "i1", fecha_publicacion: "2026-07-10", impacto: { soja: "alcista" as const } };
    const sc = calcularScorecardInterpretacion(interp, rows);
    const dias = sc.porGrano[0]!.ventanas.map((v) => v.dias).sort((a, b) => a - b);
    expect(dias).toEqual([7, 14]);
  });

  it("ignora granos con impacto null/vacío y claves que no son soja/maiz/trigo", () => {
    const interp = {
      id: "i1",
      fecha_publicacion: "2026-07-10",
      impacto: { soja: "alcista" as const, sorgo: "alcista" as const },
    };
    const sc = calcularScorecardInterpretacion(interp, rows);
    expect(sc.porGrano.map((g) => g.grano)).toEqual(["soja"]);
  });

  it("sin filas del underlying (grano sin datos) -> ventanas degradan a null sin romper", () => {
    const interp = { id: "i1", fecha_publicacion: "2026-07-10", impacto: { trigo: "bajista" as const } };
    const sc = calcularScorecardInterpretacion(interp, rows);
    const trigo = sc.porGrano.find((g) => g.grano === "trigo")!;
    expect(trigo.posicionT0).toBeNull();
    expect(trigo.ventanas.every((v) => v.acierto === null)).toBe(true);
  });
});

describe("resumirScorecardInterpretaciones", () => {
  it("agrega hit-rate por ventana across interpretaciones y granos", () => {
    const rows: FuturoCierreRow[] = [
      fila("JUL26", "2026-07-01", 300, "SOJ"),
      fila("JUL26", "2026-07-08", 315, "SOJ"), // +5% a 7d
      fila("JUL26", "2026-07-01", 300, "MAI"),
      fila("JUL26", "2026-07-08", 285, "MAI"), // -5% a 7d
    ];
    const scorecards: ScorecardInterpretacion[] = [
      calcularScorecardInterpretacion({ id: "a", fecha_publicacion: "2026-07-01", impacto: { soja: "alcista" } }, rows),
      calcularScorecardInterpretacion({ id: "b", fecha_publicacion: "2026-07-01", impacto: { maiz: "alcista" } }, rows),
    ];
    const resumen = resumirScorecardInterpretaciones(scorecards);
    expect(resumen.n7).toBe(2);
    expect(resumen.hitRate7).toBeCloseTo(0.5, 10); // soja acierta, maíz falla
  });

  it("sin ventanas medidas -> hitRate null, n en 0 (nunca undefined/NaN)", () => {
    const resumen = resumirScorecardInterpretaciones([]);
    expect(resumen).toEqual({ n7: 0, hitRate7: null, n14: 0, hitRate14: null });
  });
});
