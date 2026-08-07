import { describe, it, expect } from "vitest";
import { evaluarFijar } from "./fijar";

// noUncheckedIndexedAccess: `evaluarFijar(...)[0]` es `T|undefined` para TS. En los tests SÍ
// queremos que falle fuerte y claro si algún día viene vacía (bug real), no un `?? {}` silencioso.
function primera<T>(arr: T[]): T {
  const f = arr[0];
  if (!f) throw new Error("evaluarFijar: se esperaba al menos una fila");
  return f;
}

// Fixtures: docs/auditoria/E2-formulas-fichas.md, ficha 1.2 (actualizada FASE 2: vto real de `vencimientos`).
describe("fijar.ts — ficha E2 1.2", () => {
  const DISPONIBLE = 336.96; // pizarra soja CAC 17/07
  const HOY_MS = Date.parse("2026-07-21T12:00:00-03:00");
  const VTO_MS = (vto: string) => (vto === "NOV26" ? Date.parse("2026-11-20T12:00:00-03:00") : null);
  const CURVA = [{ vto: "NOV26", precio: 349.3 }]; // SOJ.ROS/NOV26, cierre 20/07

  it("delta, TNA (vto real 122 días) y precioTasa", () => {
    const fila = primera(evaluarFijar(DISPONIBLE, "compro", 10, CURVA, HOY_MS, VTO_MS));
    expect(fila.dias).toBe(122);
    expect(fila.delta).toBeCloseTo(-12.34, 6);
    expect(fila.tna).toBeCloseTo(10.956449566422286, 6);
    expect(fila.precioTasa).toBeCloseTo(348.22277260273967, 6);
  });

  it("compro: resultado = disponible - futuro (fix 07/08/2026 — futuro más caro = pierdo)", () => {
    const fila = primera(evaluarFijar(DISPONIBLE, "compro", 10, CURVA, HOY_MS, VTO_MS));
    expect(fila.resultado).toBeCloseTo(-12.34, 6);
    expect(fila.favorable).toBe(false);
  });

  it("vendo invierte el signo del resultado, no del delta", () => {
    const fila = primera(evaluarFijar(DISPONIBLE, "vendo", 10, CURVA, HOY_MS, VTO_MS));
    expect(fila.delta).toBeCloseTo(-12.34, 6);
    expect(fila.resultado).toBeCloseTo(12.34, 6);
    expect(fila.favorable).toBe(true);
  });

  it("borde: vto no resuelto por vtoMs → días=0, tna/precioTasa NaN, delta se sigue mostrando", () => {
    const fila = primera(evaluarFijar(DISPONIBLE, "compro", 10, CURVA, HOY_MS, () => null));
    expect(fila.dias).toBe(0);
    expect(fila.tna).toBeNaN();
    expect(fila.precioTasa).toBeNaN();
    expect(fila.delta).toBeCloseTo(-12.34, 6);
  });

  it("borde: precio<=0 en la curva se filtra (no entra a la fila)", () => {
    const filas = evaluarFijar(DISPONIBLE, "compro", 10, [{ vto: "NOV26", precio: 0 }], HOY_MS, VTO_MS);
    expect(filas).toHaveLength(0);
  });
});
