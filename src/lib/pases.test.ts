import { describe, it, expect } from "vitest";
import { pase, tasaDirectaPase, tnaPase } from "./pases";

// Fixtures: docs/auditoria/E2-formulas-fichas.md, ficha 1.6 (cierres 20/07) + FASE 2 (consecutivos).
// `pase()` cambió de signo (relevamiento web 29/07, punto 42: cercana − lejana, no
// lejana − cercana) — tasaDirectaPase/tnaPase quedan iguales (tasa del carry, no cambian).
describe("pases.ts — ficha E2 1.6", () => {
  it("backwardation: SOJ NOV26 (corta) → MAY27 (larga)", () => {
    const corta = 349.3;
    const larga = 337.8;
    expect(pase(corta, larga)).toBeCloseTo(11.5, 6);
    expect(tasaDirectaPase(corta, larga)).toBeCloseTo(-3.2922988834812483, 9);
    expect(tnaPase(corta, larga, 182)).toBeCloseTo(-6.602687321267339, 9);
  });

  it("contango: MAI SEP26 (corta) → DIC26 (larga)", () => {
    const corta = 190;
    const larga = 194;
    expect(pase(corta, larga)).toBeCloseTo(-4, 6);
    expect(tasaDirectaPase(corta, larga)).toBeCloseTo(2.1052631578947434, 9);
    expect(tnaPase(corta, larga, 92)).toBeCloseTo(8.35240274599545, 9);
  });

  it("consecutivos agregados (FASE 2): SOJ SEP26 (corta) → NOV26 (larga), 58 días", () => {
    const corta = 343.5;
    const larga = 349.3;
    expect(pase(corta, larga)).toBeCloseTo(-5.8, 6);
    expect(tnaPase(corta, larga, 58)).toBeCloseTo(10.62590975254735, 6);
  });

  it("bordes: corta<=0 → NaN; días<=0 → TNA NaN pero la tasa directa se sigue calculando", () => {
    expect(tasaDirectaPase(0, 337.8)).toBeNaN();
    expect(tnaPase(-1, 337.8, 182)).toBeNaN();
    expect(tnaPase(349.3, 337.8, 0)).toBeNaN();
    expect(tasaDirectaPase(349.3, 337.8)).not.toBeNaN();
  });

  it("ejemplo del relevamiento: el +10 de antes ahora da −10", () => {
    // cercana (vendida) = 100, lejana (comprada) = 110 → antes larga−corta = +10
    expect(pase(100, 110)).toBeCloseTo(-10, 6);
  });
});
