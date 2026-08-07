import { describe, it, expect } from "vitest";
import { POSICIONES_AR_REF, resolverPosicionViva } from "./mercado-hoy-posiciones";
import type { ArbRow } from "./arbitrajes-cierres";

function fila(pos: string): ArbRow {
  return {
    pos,
    symbol: `MAI.ROS/${pos}`,
    ajuste: 100,
    variacion: 1,
    spread: 0,
    directa: 0,
    dias: 30,
    tna: 0,
    volume: 0,
    openInterest: 0,
  };
}

describe("mercado-hoy-posiciones", () => {
  // Bug real 07/08/2026: "Maíz JUL26" quedó hardcodeada con año fijo, venció y la
  // fila de la home quedó en "—" para siempre porque getArbitrajes() ya no lista
  // posiciones vencidas. Esto prueba que la resolución NUNCA puede volver a
  // congelarse en un año: siempre elige de las filas VIVAS que se le pasan.
  it("elige la posición viva cuyo mes coincide, sin importar el año", () => {
    const rows = [fila("SEP26"), fila("DIC26"), fila("MAR27")];
    expect(resolverPosicionViva("DIC", rows)?.pos).toBe("DIC26");
  });

  it("si el mes configurado no está listado hoy, cae a la posición viva más próxima en vez de quedar vacía", () => {
    const rows = [fila("SEP26"), fila("DIC26")];
    expect(resolverPosicionViva("JUL", rows)?.pos).toBe("SEP26");
  });

  it("nunca devuelve una posición que no esté en las filas vivas recibidas (no puede fabricar un año)", () => {
    // Simula exactamente el bug: la posición configurada (JUL) ya venció y
    // getArbitrajes() dejó de listarla — acá directamente no llega en `rows`.
    const rows: ArbRow[] = [];
    expect(resolverPosicionViva("JUL", rows)).toBeNull();
  });

  it("sin filas vivas para el grano, no null-crashea (la home debe poder mostrar '—')", () => {
    expect(resolverPosicionViva("NOV", [])).toBeNull();
  });

  it("POSICIONES_AR_REF configura mes de referencia, nunca un año fijo (guard anti-regresión)", () => {
    for (const p of POSICIONES_AR_REF) {
      expect(p.mes).toMatch(/^[A-Z]{3}$/); // 3 letras, sin dígitos de año pegados
    }
  });
});
