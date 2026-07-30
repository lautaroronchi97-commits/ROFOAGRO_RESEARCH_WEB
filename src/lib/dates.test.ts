import { describe, it, expect } from "vitest";
import {
  hoyCordobaISO, diasEntre, diasHasta, hoyOperativoMs, fechaCordobaISO,
  MESES_ES, mesIndice, parsePosicion, vencKeyDePosicion, vtoDePosicion, posicionDeFecha, hoyVencKey,
} from "./dates";

// Fixtures pre-existentes (sin tocar).
describe("dates.ts", () => {
  it("hoyCordobaISO: formato YYYY-MM-DD", () => {
    expect(hoyCordobaISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("diasEntre / diasHasta ya cubiertos en habiles.test.ts (ficha 6.7)", () => {
    expect(diasEntre("2026-01-01", "2026-01-05")).toBe(4);
    expect(diasHasta(hoyCordobaISO())).toBe(0);
  });
});

/**
 * hoyOperativoMs (relevamiento web R6, punto 34, pregunta 3): sábado/domingo anclan al viernes
 * anterior — no hay rueda ese fin de semana, así que el plazo a vencimiento de los sintéticos no
 * debe "correr" solo por el paso del sábado/domingo. Fechas de referencia: 2026-08-07 es viernes,
 * 08 sábado, 09 domingo, 10 lunes.
 */
describe("dates.ts — hoyOperativoMs", () => {
  it("de lunes a viernes, es directamente hoy", () => {
    const viernes = new Date("2026-08-07T15:00:00Z");
    expect(fechaCordobaISO(new Date(hoyOperativoMs(viernes)))).toBe("2026-08-07");
    const lunes = new Date("2026-08-10T15:00:00Z");
    expect(fechaCordobaISO(new Date(hoyOperativoMs(lunes)))).toBe("2026-08-10");
  });

  it("sábado ancla al viernes anterior", () => {
    const sabado = new Date("2026-08-08T15:00:00Z");
    expect(fechaCordobaISO(new Date(hoyOperativoMs(sabado)))).toBe("2026-08-07");
  });

  it("domingo también ancla al mismo viernes (no al sábado)", () => {
    const domingo = new Date("2026-08-09T15:00:00Z");
    expect(fechaCordobaISO(new Date(hoyOperativoMs(domingo)))).toBe("2026-08-07");
  });
});

/**
 * Util única de mes/posición (lote L1, auditoría E4 hallazgo #11). Fixtures:
 * docs/auditoria/E2-formulas-fichas.md, ficha transversal "Los 6 parsers de
 * mes/posición duplicados" (batería de 17 + 22 casos, vencKey de curva.ts y
 * futuros.ts numéricamente idénticos + hoyVencKey copia idéntica + mesDePosicion
 * consistente + el borde documental "DIS24 matchea la regex → 202400").
 */
describe("dates.ts — util de mes/posición (E4 #11 / E2 ficha transversal)", () => {
  it("MESES_ES: 12 abreviaturas ENE..DIC en orden", () => {
    expect(MESES_ES).toEqual(["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]);
  });

  it("mesIndice: abreviatura -> 1..12, case-insensitive, inválido -> 0", () => {
    expect(mesIndice("ENE")).toBe(1);
    expect(mesIndice("dic")).toBe(12);
    expect(mesIndice("Jul")).toBe(7);
    expect(mesIndice("XXX")).toBe(0);
  });

  it("parsePosicion: 'JUL26' -> mon/mes/anio; case-insensitive", () => {
    expect(parsePosicion("JUL26")).toEqual({ mon: "JUL", mes: 7, anio: 2026 });
    expect(parsePosicion("abr27")).toEqual({ mon: "ABR", mes: 4, anio: 2027 });
  });

  it("parsePosicion: null/undefined/vacío/formato inválido -> null", () => {
    expect(parsePosicion(null)).toBeNull();
    expect(parsePosicion(undefined)).toBeNull();
    expect(parsePosicion("")).toBeNull();
    expect(parsePosicion("JULIO26")).toBeNull(); // más de 3 letras
    expect(parsePosicion("JUL2026")).toBeNull(); // más de 2 dígitos
  });

  it("parsePosicion: 'DIS24' matchea el patrón (3 letras + 2 dígitos) pero no es un mes válido -> mes 0 (comportamiento heredado de curva.ts/futuros.ts, ficha E2)", () => {
    expect(parsePosicion("DIS24")).toEqual({ mon: "DIS", mes: 0, anio: 2024 });
  });

  it("vencKeyDePosicion: 'JUL26' -> 202607 (idéntico al vencKey histórico de curva.ts y futuros.ts)", () => {
    expect(vencKeyDePosicion("JUL26")).toBe(202607);
    expect(vencKeyDePosicion("ENE20")).toBe(202001);
    expect(vencKeyDePosicion("DIC99")).toBe(209912);
  });

  it("vencKeyDePosicion: null/inválido -> 0 (DISPO u otros, disponible primero)", () => {
    expect(vencKeyDePosicion(null)).toBe(0);
    expect(vencKeyDePosicion(undefined)).toBe(0);
    expect(vencKeyDePosicion("DISPO")).toBe(0);
  });

  it("vencKeyDePosicion: 'DIS24' SÍ matchea -> 202400 (borde documentado en futuros.ts:53, 0 filas reales hoy)", () => {
    expect(vencKeyDePosicion("DIS24")).toBe(202400);
  });

  it("vtoDePosicion: último día calendario del mes", () => {
    expect(vtoDePosicion("JUL26")).toBe("2026-07-31");
    expect(vtoDePosicion("FEB24")).toBe("2024-02-29"); // bisiesto
    expect(vtoDePosicion("FEB25")).toBe("2025-02-28"); // no bisiesto
    expect(vtoDePosicion("ABR27")).toBe("2027-04-30");
  });

  it("vtoDePosicion: sin mes válido o sin match -> '' (mismo guard que curva.ts)", () => {
    expect(vtoDePosicion("DIS24")).toBe(""); // mes 0
    expect(vtoDePosicion("DISPO")).toBe("");
    expect(vtoDePosicion(null)).toBe("");
  });

  it("posicionDeFecha: 'YYYY-MM-DD' -> posición A3 ej. 'JUL26'", () => {
    expect(posicionDeFecha("2026-07-31")).toBe("JUL26");
    expect(posicionDeFecha("2026-01-01")).toBe("ENE26");
    expect(posicionDeFecha("2026-12-15")).toBe("DIC26");
  });

  it("vencKeyDePosicion/vtoDePosicion: paridad numérica con los valores históricos de curva.ts y futuros.ts (misma regex, misma tabla ENE..DIC, misma clave (2000+aa)*100+mm)", () => {
    for (const [pos, key, vto] of [
      ["MAY26", 202605, "2026-05-31"],
      ["NOV26", 202611, "2026-11-30"],
      ["SEP26", 202609, "2026-09-30"],
      ["DIC26", 202612, "2026-12-31"],
    ] as const) {
      expect(vencKeyDePosicion(pos)).toBe(key);
      expect(vtoDePosicion(pos)).toBe(vto);
    }
  });

  it("hoyVencKey: aaaamm de hoy en Córdoba, consistente con hoyCordobaISO", () => {
    const iso = hoyCordobaISO();
    const esperado = Number(iso.slice(0, 4)) * 100 + Number(iso.slice(5, 7));
    expect(hoyVencKey()).toBe(esperado);
  });
});
