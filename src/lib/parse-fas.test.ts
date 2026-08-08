import { describe, it, expect } from "vitest";
import { parseFasCsv, checklistFasCsv } from "./parse-fas";

/**
 * Fixture SINTÉTICA — imita el formato de cabecera/tipos del CSV real de Agrochat (§4.1 del
 * plan: `Date,Product,FAS_ARS,FAS_USD,TC_Mayorista`, coma, decimales con punto, CRLF) pero los
 * NÚMEROS no son datos de mercado reales (el CSV real todavía no llegó — C32/F1). Cubre a
 * propósito cada motivo de descarte + cada chequeo del checklist §4.3.
 */
const CSV = [
  "Date,Product,FAS_ARS,FAS_USD,TC_Mayorista",
  "2026-08-03,Soja,502500,335.00,1500", // válida, hábil (lunes)
  "2026-08-04,Maíz,255200,176.00,1450", // válida
  "2026-08-04,Maíz,255300,176.50,1450", // duplicado de fecha+producto (mismo día, mismo producto)
  "2026-08-08,Trigo Pan,300000,200.00,1500", // válida pero cae sábado (no hábil)
  "2026-08-09,Girasol,600000,999.00,1500", // válida pero USD no cierra contra ARS/TC (esperado 400)
  "2026-08-10,Producto Rarísimo,100,1,100", // producto no reconocido → descarte
  "2026-08-10,Sorgo", // columnas insuficientes → descarte
  "2026-08-10,Sorgo,-5,10,1500", // FAS_ARS ≤ 0 → descarte
  "2026-08-10,Sorgo,100000,0,1500", // FAS_USD ≤ 0 → descarte
  "2026-08-10,Sorgo,100000,66.67,0", // TC ≤ 0 → descarte
  "2026-08-10,Sorgo,100000,66.67,1500", // válida
  "2026-08-10,TRIGO PAN,300000,200.00,1500", // válida, producto case-insensitive
].join("\r\n");

describe("parseFasCsv", () => {
  const { filas, descartes } = parseFasCsv(CSV);

  it("parsea las filas válidas y mapea al producto interno (fas-catalogo.ts)", () => {
    expect(filas).toHaveLength(7);
    expect(filas[0]).toMatchObject({ fecha: "2026-08-03", productoCsv: "Soja", producto: "SBS", fasUsd: 335 });
    expect(filas.find((f) => f.fecha === "2026-08-10" && f.productoCsv === "Sorgo")?.producto).toBe("SORGHUM");
  });

  it("normaliza el nombre de producto sin distinguir mayúsculas (guarda la forma canónica)", () => {
    const wheatRows = filas.filter((f) => f.producto === "WHEAT");
    expect(wheatRows).toHaveLength(2); // "Trigo Pan" (08-08) + "TRIGO PAN" (08-10) — mismo producto
    expect(wheatRows.every((f) => f.productoCsv === "Trigo Pan")).toBe(true);
  });

  it("descarta cada motivo esperado, nunca en silencio", () => {
    expect(descartes).toHaveLength(5);
    const motivos = descartes.map((d) => d.motivo);
    expect(motivos.some((m) => m.includes("producto no reconocido"))).toBe(true);
    expect(motivos.some((m) => m.includes("columnas insuficientes"))).toBe(true);
    expect(motivos.some((m) => m.includes("FAS_ARS inválido"))).toBe(true);
    expect(motivos.some((m) => m.includes("FAS_USD inválido"))).toBe(true);
    expect(motivos.some((m) => m.includes("TC_Mayorista inválido"))).toBe(true);
  });

  it("descarta una fecha no-ISO", () => {
    const r = parseFasCsv(["Date,Product,FAS_ARS,FAS_USD,TC_Mayorista", "03/08/2026,Soja,502500,335,1500"].join("\n"));
    expect(r.filas).toHaveLength(0);
    expect(r.descartes[0]?.motivo).toContain("fecha no-ISO");
  });
});

describe("checklistFasCsv — §4.3 del plan", () => {
  const { filas } = parseFasCsv(CSV);
  const c = checklistFasCsv(filas);

  it("cuenta filas, fechas únicas y productos", () => {
    expect(c.totalFilas).toBe(7);
    expect(c.fechasUnicas).toBe(5);
    expect(c.productos).toEqual(["MAIZE", "SBS", "SFSEED", "SORGHUM", "WHEAT"]);
  });

  it("detecta el duplicado fecha+producto (punto 2)", () => {
    expect(c.duplicadosFechaProducto).toBe(1);
  });

  it("detecta las filas en fin de semana (punto 2 — 'solo días hábiles')", () => {
    expect(c.finesDeSemanaOFeriados).toBe(2); // Trigo Pan 08-08 (sáb) + Girasol 08-09 (dom)
  });

  it("detecta la inconsistencia FAS_USD ≈ FAS_ARS/TC (punto 3)", () => {
    expect(c.inconsistenciasUsdArsTc).toBe(1); // Girasol: esperado 400, vino 999
  });

  it("arma el rango de fechas por producto", () => {
    expect(c.rangoPorProducto.SBS).toEqual({ desde: "2026-08-03", hasta: "2026-08-03", filas: 1 });
    expect(c.rangoPorProducto.WHEAT).toEqual({ desde: "2026-08-08", hasta: "2026-08-10", filas: 2 });
  });

  it("un CSV limpio no dispara ninguna alerta", () => {
    const limpio = parseFasCsv(
      ["Date,Product,FAS_ARS,FAS_USD,TC_Mayorista", "2026-08-03,Soja,502500,335.00,1500"].join("\n"),
    ).filas;
    const c2 = checklistFasCsv(limpio);
    expect(c2.duplicadosFechaProducto).toBe(0);
    expect(c2.finesDeSemanaOFeriados).toBe(0);
    expect(c2.inconsistenciasUsdArsTc).toBe(0);
  });
});
