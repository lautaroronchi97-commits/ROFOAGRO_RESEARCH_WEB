import { describe, it, expect } from "vitest";
import { posicionesCanonicasVivas, precioFuturoConVivo } from "./fijar-canon";
import type { PosCurva } from "./curva-types";

const pos = (posicion: string, precio: number): PosCurva => ({
  symbol: `SOJ.ROS/${posicion}`,
  posicion,
  precio,
  vto: "2026-01-01",
});

describe("posicionesCanonicasVivas", () => {
  it("elige, por cada mes canónico, la posición viva más próxima", () => {
    // hoy = 202607 (jul26). SOJ canónico: JUL, SEP, NOV, ENE, MAY.
    const disponibles = [pos("JUL26", 320), pos("SEP26", 325), pos("NOV26", 330), pos("ENE27", 335), pos("MAY27", 340), pos("JUL27", 322)];
    const r = posicionesCanonicasVivas("SOJ", disponibles, 202607);
    expect(r.map((p) => p.posicion)).toEqual(["JUL26", "SEP26", "NOV26", "ENE27", "MAY27"]);
  });

  it("descarta posiciones vencidas (antes de hoy)", () => {
    const disponibles = [pos("MAY26", 310), pos("JUL26", 320)];
    const r = posicionesCanonicasVivas("SOJ", disponibles, 202607);
    expect(r.map((p) => p.posicion)).toEqual(["JUL26"]);
  });

  it("descarta más de 1 año hacia adelante", () => {
    // NOV27 = 202711, límite = 202607+100 = 202707 → fuera de rango, sin NOV26 disponible
    // esa etiqueta canónica queda directamente sin posición.
    const disponibles = [pos("JUL26", 320), pos("NOV27", 330)];
    const r = posicionesCanonicasVivas("SOJ", disponibles, 202607);
    expect(r.map((p) => p.posicion)).toEqual(["JUL26"]);
  });

  it("grano sin canónicas definidas da vacío", () => {
    expect(posicionesCanonicasVivas("GIR", [pos("JUL26", 320)], 202607)).toEqual([]);
  });
});

describe("precioFuturoConVivo", () => {
  it("prioriza el último operado del WS", () => {
    expect(precioFuturoConVivo(300, { bid: 310, ask: 312, last: 311 })).toEqual({ precio: 311, estimado: false });
  });
  it("promedia bid/ask si no operó (estimado)", () => {
    expect(precioFuturoConVivo(300, { bid: 310, ask: 312, last: null })).toEqual({ precio: 311, estimado: true });
  });
  it("cae al cierre si no hay nada del WS", () => {
    expect(precioFuturoConVivo(300, undefined)).toEqual({ precio: 300, estimado: false });
    expect(precioFuturoConVivo(300, { bid: null, ask: null, last: null })).toEqual({ precio: 300, estimado: false });
  });
});
