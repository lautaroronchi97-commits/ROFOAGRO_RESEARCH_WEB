import { describe, it, expect } from "vitest";
import { nivelFrescura } from "./frescura-dot";

describe("nivelFrescura — semáforo de antigüedad (C29/Fase 2)", () => {
  const revalidateSeg = 30;

  it("fresco hasta 2x el revalidate", () => {
    expect(nivelFrescura(0, revalidateSeg)).toBe("fresco");
    expect(nivelFrescura(60_000, revalidateSeg)).toBe("fresco"); // exacto 2x
  });

  it("envejeciendo entre 2x y 6x", () => {
    expect(nivelFrescura(60_001, revalidateSeg)).toBe("envejeciendo");
    expect(nivelFrescura(180_000, revalidateSeg)).toBe("envejeciendo"); // exacto 6x
  });

  it("viejo pasado 6x", () => {
    expect(nivelFrescura(180_001, revalidateSeg)).toBe("viejo");
    expect(nivelFrescura(999_999, revalidateSeg)).toBe("viejo");
  });

  it("un revalidate más largo (baja frecuencia) corre los umbrales en proporción", () => {
    const seg = 3600;
    expect(nivelFrescura(2 * 3600 * 1000, seg)).toBe("fresco");
    expect(nivelFrescura(3 * 3600 * 1000, seg)).toBe("envejeciendo");
    expect(nivelFrescura(7 * 3600 * 1000, seg)).toBe("viejo");
  });
});
