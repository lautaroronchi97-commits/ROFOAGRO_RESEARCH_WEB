import { describe, it, expect } from "vitest";
import { empresasPorProducto, empresasPorZona, totalesPorZona } from "./foto-empresas";
import type { BuqueRow } from "./foto";

const BUQUES: BuqueRow[] = [
  { vessel: "A", empresa: "CARGILL", producto: "Maíz", familia: "Maíz", toneladas: 40000, zona: "Up River Norte", muelle: null, destino: null, etb: "2026-08-01" },
  { vessel: "B", empresa: "CARGILL", producto: "Maíz", familia: "Maíz", toneladas: 30000, zona: "Up River Norte", muelle: null, destino: null, etb: "2026-08-03" },
  { vessel: "C", empresa: "LDC", producto: "Maíz", familia: "Maíz", toneladas: 50000, zona: "Up River Sur", muelle: null, destino: null, etb: "2026-08-02" },
  { vessel: "D", empresa: "LDC", producto: "Soja", familia: "Soja", toneladas: 45000, zona: "Up River Sur", muelle: null, destino: null, etb: "2026-08-04" },
  { vessel: "E", empresa: "ADM", producto: "Soja", familia: "Soja", toneladas: 20000, zona: "Bahía Blanca", muelle: null, destino: null, etb: "2026-08-05" },
];

describe("lineup/foto-empresas.ts — empresasPorProducto", () => {
  it("agrega toneladas por empresa, un producto, ordenado desc por toneladas", () => {
    const r = empresasPorProducto(BUQUES, "Maíz");
    expect(r).toEqual([
      { empresa: "CARGILL", buques: 2, toneladas: 70000 },
      { empresa: "LDC", buques: 1, toneladas: 50000 },
    ]);
  });

  it("producto sin buques da vacío", () => {
    expect(empresasPorProducto(BUQUES, "Trigo")).toEqual([]);
  });
});

describe("lineup/foto-empresas.ts — empresasPorZona", () => {
  it("agrega por empresa dentro de una zona, ambos productos incluidos", () => {
    const r = empresasPorZona(BUQUES, "Up River Sur");
    expect(r).toEqual([
      { empresa: "LDC", buques: 2, toneladas: 95000 },
    ]);
  });
});

describe("lineup/foto-empresas.ts — totalesPorZona", () => {
  it("suma buques y toneladas por zona sobre el subconjunto filtrado", () => {
    const soloLdc = BUQUES.filter((b) => b.empresa === "LDC");
    const r = totalesPorZona(soloLdc);
    expect(r).toEqual([{ zona: "Up River Sur", buques: 2, toneladas: 95000 }]);
  });

  it("array vacío da vacío", () => {
    expect(totalesPorZona([])).toEqual([]);
  });
});
