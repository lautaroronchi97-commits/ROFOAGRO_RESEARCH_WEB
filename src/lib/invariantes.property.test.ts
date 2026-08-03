import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { tnaUSD, teaUSD, spread as spreadArbitraje } from "./arbitraje";
import { pase, tnaPase } from "./pases";

/**
 * Property-based tests (C29/Fase 1, PRELAUNCH_CHECKLIST.md): invariantes matemáticos que
 * deben sostenerse para CUALQUIER precio/plazo válido, no solo para los fixtures puntuales
 * del Excel (`arbitraje.test.ts`/`pases.test.ts`, que siguen siendo la fuente de verdad de
 * los valores exactos). fast-check genera cientos de combinaciones al azar por corrida.
 *
 * Precio = número positivo finito (rangos amplios, cubren desde pizarra chica hasta
 * cotizaciones grandes). Días = entero en (0, 365] — el mismo rango en el que operan estos
 * instrumentos (arbitraje/pase dentro de una campaña); fuera de ese rango TEA puede caer
 * por debajo de TNA (ver nota de `tnaVsTea`), así que restringir el dominio no oculta un bug,
 * refleja el uso real.
 */

const PRECIO = fc.double({ min: 0.01, max: 1_000_000, noNaN: true, noDefaultInfinity: true });
const DIAS_HASTA_UN_ANIO = fc.integer({ min: 1, max: 365 });

describe("invariantes — arbitraje.ts (TEA ≥ TNA)", () => {
  it("con días ≤ 365, la TEA anualizada (compuesta) nunca es menor que la TNA (simple)", () => {
    fc.assert(
      fc.property(PRECIO, PRECIO, DIAS_HASTA_UN_ANIO, (futuro, pizarra, dias) => {
        const tna = tnaUSD(futuro, pizarra, dias);
        const tea = teaUSD(futuro, pizarra, dias);
        // Bernoulli: (1+r)^n >= 1+n*r para n>=1, r>-1 — siempre se cumple en este dominio.
        expect(tea).toBeGreaterThanOrEqual(tna - 1e-9);
      }),
      { numRuns: 500 },
    );
  });

  it("spread es antisimétrico: spread(a,b) + spread(b,a) = 0", () => {
    fc.assert(
      fc.property(PRECIO, PRECIO, (a, b) => {
        expect(spreadArbitraje(a, b) + spreadArbitraje(b, a)).toBeCloseTo(0, 9);
      }),
      { numRuns: 500 },
    );
  });
});

describe("invariantes — pases.ts (spread antisimétrico)", () => {
  it("pase(cercana, lejana) + pase(lejana, cercana) = 0 — protege el signo (bug real del 29/07)", () => {
    // El pase cambió de signo una vez en producción (relevamiento web, punto 42): esta
    // propiedad no depende de CUÁL convención se elija, solo de que sea antisimétrica —
    // si alguna vez alguien invierte solo uno de los dos argumentos por error, esto explota.
    fc.assert(
      fc.property(PRECIO, PRECIO, (cercana, lejana) => {
        expect(pase(cercana, lejana) + pase(lejana, cercana)).toBeCloseTo(0, 9);
      }),
      { numRuns: 500 },
    );
  });

  it("tnaPase mantiene el signo de la tasa directa (misma dirección que el carry)", () => {
    fc.assert(
      fc.property(PRECIO, PRECIO, DIAS_HASTA_UN_ANIO, (corta, larga, dias) => {
        const tna = tnaPase(corta, larga, dias);
        if (larga > corta) expect(tna).toBeGreaterThan(0);
        else if (larga < corta) expect(tna).toBeLessThan(0);
        else expect(tna).toBeCloseTo(0, 9);
      }),
      { numRuns: 500 },
    );
  });
});
