import { describe, it, expect } from "vitest";
import { familiaDe } from "./djve-familias";

// Fixture: los 18 productos reales de djve_resumen con tonelaje >0 hoy (relevamiento
// web R8, punto 52) + un caso de "no encaja en ninguna familia nombrada" (sorgo).
describe("familiaDe", () => {
  it("agrupa maíz y todo lo relacionado", () => {
    expect(familiaDe("MAIZ")).toBe("Maíz");
    expect(familiaDe("MAIZ FLINT")).toBe("Maíz");
    expect(familiaDe("MAIZ PARTIDO")).toBe("Maíz");
    expect(familiaDe("ACEITE DE MAIZ")).toBe("Maíz");
  });

  it("agrupa soja y subproductos", () => {
    expect(familiaDe("SOJA")).toBe("Soja");
    expect(familiaDe("SUBPRODUCTOS DE SOJA")).toBe("Soja");
    expect(familiaDe("ACEITE DE SOJA")).toBe("Soja");
    expect(familiaDe("SOJA DESACTIVADA")).toBe("Soja");
  });

  it("agrupa trigo y subproductos", () => {
    expect(familiaDe("TRIGO PAN")).toBe("Trigo");
    expect(familiaDe("TRIGO CANDEAL")).toBe("Trigo");
    expect(familiaDe("HARINA DE TRIGO")).toBe("Trigo");
  });

  it("agrupa girasol y subproductos", () => {
    expect(familiaDe("GIRASOL")).toBe("Girasol");
    expect(familiaDe("SUBPRODUCTOS DE GIRASOL")).toBe("Girasol");
    expect(familiaDe("ACEITE DE GIRASOL")).toBe("Girasol");
  });

  it("agrupa cebada y malta en una sola familia (pedido explícito)", () => {
    expect(familiaDe("CEBADA FORRAJERA")).toBe("Cebada y malta");
    expect(familiaDe("CEBADA CERVECERA")).toBe("Cebada y malta");
    expect(familiaDe("MALTA")).toBe("Cebada y malta");
  });

  it("sorgo y el resto de los productos sin familia nombrada caen en Otros", () => {
    expect(familiaDe("SORGO")).toBe("Otros");
    expect(familiaDe("ARVEJAS")).toBe("Otros");
    expect(familiaDe("ALGODÓN")).toBe("Otros");
  });
});
