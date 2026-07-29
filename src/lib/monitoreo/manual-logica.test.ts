import { describe, it, expect } from "vitest";
import { esHabil, isoMenosDias, huecosHabiles } from "./manual-logica";

describe("manual-logica.ts — esHabil", () => {
  it("lunes a viernes son hábiles", () => {
    expect(esHabil("2026-07-27")).toBe(true); // lunes
    expect(esHabil("2026-07-28")).toBe(true); // martes
    expect(esHabil("2026-07-29")).toBe(true); // miércoles
    expect(esHabil("2026-07-30")).toBe(true); // jueves
    expect(esHabil("2026-07-31")).toBe(true); // viernes
  });

  it("sábado y domingo NO son hábiles", () => {
    expect(esHabil("2026-07-25")).toBe(false); // sábado
    expect(esHabil("2026-07-26")).toBe(false); // domingo
  });
});

describe("manual-logica.ts — isoMenosDias", () => {
  it("resta días dentro del mismo mes", () => {
    expect(isoMenosDias("2026-07-29", 1)).toBe("2026-07-28");
    expect(isoMenosDias("2026-07-29", 14)).toBe("2026-07-15");
  });

  it("cruza el límite de mes correctamente", () => {
    expect(isoMenosDias("2026-08-01", 1)).toBe("2026-07-31");
  });
});

describe("manual-logica.ts — huecosHabiles", () => {
  // Ventana [15/07 .. 28/07] (excluye hoy 29/07): hábiles reales = 15,16,17,20,21,22,23,24,27,28
  // (18-19 y 25-26 son fin de semana).
  const HABILES_VENTANA = ["2026-07-15", "2026-07-16", "2026-07-17", "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24", "2026-07-27", "2026-07-28"];

  it("sin huecos si todos los días hábiles de la ventana tienen dato", () => {
    expect(huecosHabiles("2026-07-29", 14, new Set(HABILES_VENTANA))).toEqual([]);
  });

  it("detecta exactamente el día hábil sin dato, en orden cronológico", () => {
    const conDato = new Set(HABILES_VENTANA.filter((d) => d !== "2026-07-27"));
    expect(huecosHabiles("2026-07-29", 14, conDato)).toEqual(["2026-07-27"]);
  });

  it("ignora fines de semana aunque no tengan dato (no son huecos)", () => {
    // Ningún sábado/domingo de la ventana está en `conDato` y aun así no aparecen en el resultado.
    expect(huecosHabiles("2026-07-29", 14, new Set(HABILES_VENTANA))).not.toContain("2026-07-25");
    expect(huecosHabiles("2026-07-29", 14, new Set(HABILES_VENTANA))).not.toContain("2026-07-26");
  });

  it("con el Set vacío devuelve TODOS los hábiles de la ventana", () => {
    expect(huecosHabiles("2026-07-29", 14, new Set())).toEqual(HABILES_VENTANA);
  });
});
