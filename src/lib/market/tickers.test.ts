import { describe, it, expect } from "vitest";
import { vencFromTicker } from "./tickers";

/**
 * `vencFromTicker` — vencimiento inferido del propio ticker de bonos AR (D=linked, S=LECAP,
 * T=BONCAP). Fixture real: los 4 BONCAP cargados en `lecap_pago_final` (docs/sesiones/
 * 2026-07-27-a6-uploaders-formato-crudo.md) — T15E7/T30A7/T31Y7/T30J7, verificados contra
 * `arg_bonds` de data912 (no `arg_notes`, donde sí cotizan las LECAP).
 */
describe("vencFromTicker", () => {
  it("dólar linked (D) sigue funcionando", () => {
    expect(vencFromTicker("D30S6")).toBe(new Date(2026, 8, 30).getTime());
  });

  it("LECAP (S) sigue funcionando", () => {
    expect(vencFromTicker("S31L6")).toBe(new Date(2026, 6, 31).getTime());
  });

  it("BONCAP (T) — los 4 tickers reales cargados en lecap_pago_final", () => {
    expect(vencFromTicker("T15E7")).toBe(new Date(2027, 0, 15).getTime());
    expect(vencFromTicker("T30A7")).toBe(new Date(2027, 3, 30).getTime());
    expect(vencFromTicker("T31Y7")).toBe(new Date(2027, 4, 31).getTime());
    expect(vencFromTicker("T30J7")).toBe(new Date(2027, 5, 30).getTime());
  });

  it("prefijo no reconocido -> null", () => {
    expect(vencFromTicker("X30J7")).toBeNull();
    expect(vencFromTicker("TX26D")).toBeNull(); // bono dollar-linked, no matchea el formato BONCAP
  });
});
