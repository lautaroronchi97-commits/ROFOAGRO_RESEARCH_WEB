import { describe, expect, it } from "vitest";
import { esPosicionLiquida } from "./liquidez-posicion";

describe("esPosicionLiquida", () => {
  it("OI alto: siempre líquida, haya operado o no", () => {
    expect(esPosicionLiquida({ openInterest: 500, operoHoy: false })).toBe(true);
    expect(esPosicionLiquida({ openInterest: 500, operoHoy: true })).toBe(true);
  });

  it("OI bajo (<100) sin operar hoy: no líquida", () => {
    expect(esPosicionLiquida({ openInterest: 42, operoHoy: false })).toBe(false);
  });

  it("OI bajo (<100) pero operó hoy: líquida igual", () => {
    expect(esPosicionLiquida({ openInterest: 42, operoHoy: true })).toBe(true);
  });

  it("sin dato de OI: nunca se oculta (criterio conservador)", () => {
    expect(esPosicionLiquida({ openInterest: null, operoHoy: false })).toBe(true);
    expect(esPosicionLiquida({ openInterest: null, operoHoy: true })).toBe(true);
  });

  it("umbral exacto (100): líquida sin necesitar haber operado", () => {
    expect(esPosicionLiquida({ openInterest: 100, operoHoy: false })).toBe(true);
  });
});
