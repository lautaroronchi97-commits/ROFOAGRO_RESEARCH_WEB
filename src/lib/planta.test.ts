import { describe, it, expect } from "vitest";
import { calcularPlanta, VALOR_PUNTO_FIJO } from "./planta";

describe("calcularPlanta", () => {
  it("modo fijo: secada = puntos × VALOR_PUNTO_FIJO", () => {
    const r = calcularPlanta({
      arranque: 300,
      flete: 5,
      secadaModo: "fijo",
      puntos: 2,
      valorPunto: VALOR_PUNTO_FIJO,
      valoresPorPunto: [],
      pctMerma: 0.3,
      paritaria: 4.5,
      embolsado: 0,
      otros: [],
    });
    expect(r.dSecada).toBe(10); // 2 × 5
    expect(r.dMerma).toBeCloseTo(0.9, 6); // 300 × 0.3%
    expect(r.totalGastos).toBeCloseTo(5 + 10 + 0.9 + 4.5 + 0, 6);
    expect(r.final).toBeCloseTo(300 - r.totalGastos, 6);
  });

  it("modo libre: cada punto con su propio valor (relevamiento web punto 47)", () => {
    const r = calcularPlanta({
      arranque: 300,
      flete: 0,
      secadaModo: "libre",
      puntos: 3,
      valorPunto: 0, // no se usa en este modo
      valoresPorPunto: [6, 5, 4], // 1º más caro que el 3º, caso real de secada
      pctMerma: 0,
      paritaria: 0,
      embolsado: 0,
      otros: [],
    });
    expect(r.dSecada).toBe(15); // 6+5+4, NO 3×algo único
    expect(r.final).toBeCloseTo(300 - 15, 6);
  });

  it("modo libre ignora valores no finitos (input vacío)", () => {
    const r = calcularPlanta({
      arranque: 300,
      flete: 0,
      secadaModo: "libre",
      puntos: 2,
      valorPunto: 0,
      valoresPorPunto: [6, NaN],
      pctMerma: 0,
      paritaria: 0,
      embolsado: 0,
      otros: [],
    });
    expect(r.dSecada).toBe(6);
  });

  it("otros repetibles se suman todos", () => {
    const r = calcularPlanta({
      arranque: 300,
      flete: 0,
      secadaModo: "fijo",
      puntos: 0,
      valorPunto: VALOR_PUNTO_FIJO,
      valoresPorPunto: [],
      pctMerma: 0,
      paritaria: 0,
      embolsado: 0,
      otros: [
        { label: "Sanidad", valor: 2 },
        { label: "Análisis", valor: 1.5 },
      ],
    });
    expect(r.dOtros).toBeCloseTo(3.5, 6);
    expect(r.totalGastos).toBeCloseTo(3.5, 6);
    expect(r.final).toBeCloseTo(300 - 3.5, 6);
  });

  it("arranque inválido (0 o no numérico) → final NaN, merma 0", () => {
    const r = calcularPlanta({
      arranque: 0,
      flete: 5,
      secadaModo: "fijo",
      puntos: 1,
      valorPunto: VALOR_PUNTO_FIJO,
      valoresPorPunto: [],
      pctMerma: 0.3,
      paritaria: 0,
      embolsado: 0,
      otros: [],
    });
    expect(r.dMerma).toBe(0);
    expect(Number.isNaN(r.final)).toBe(true);
  });
});
