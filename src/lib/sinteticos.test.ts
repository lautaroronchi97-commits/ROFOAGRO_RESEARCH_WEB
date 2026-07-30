import { describe, it, expect } from "vitest";
import { calcularSintetico, emparejarSinteticos } from "./sinteticos";

/**
 * Fixture REAL del Excel de Lautaro ("REAL_TIME v2.5", hoja "DOLAR SINTETICO"), fecha 2026-07-08:
 *   dólar MAE (spot) = 1488 · DLR/JUL26 ajuste = 1498.5 · vto 2026-07-31 (23 días desde el 08/07)
 *   letra S31L6 (vto 2026-07-31): Px = 116.450 · Pago Final = 117.677
 *   → sintético = 1488 × (117.677/116.450) = 1503.678626
 *   → directa   = 1503.678626/1498.5 − 1
 *   → TNA       = directa × 365/23 = 5.4843 %
 * Los "Pago Final" del Excel coinciden 1:1 con los que publica BYMA (verificado cruzando
 * S31L6 117.677 / S14G6 108.03 / S31G6 127.064).
 */
describe("sinteticos.ts — fixture Excel DOLAR SINTETICO (S31L6, 2026-07-08)", () => {
  const SPOT = 1488;
  const PX = 116.45;
  const PAGO_FINAL = 117.677;
  const FUT = 1498.5;
  const DIAS = 23;

  it("calcularSintetico reproduce los números exactos del Excel", () => {
    const c = calcularSintetico(SPOT, PX, PAGO_FINAL, FUT, DIAS);
    expect(c.sinteticoAFinish).toBeCloseTo(1503.6786260197512, 9);
    // directa: el Excel muestra 0,34562% redondeando el sintético intermedio; la fórmula exacta
    // sobre estos inputs da 0,0034558732 → la TNA (el output que importa) cae en 5,4843% clavado.
    expect(c.tasaDirecta).toBeCloseTo(0.0034558732197205178, 12);
    expect(c.tna).toBeCloseTo(0.05484320544339082, 12);
    expect(c.tna * 100).toBeCloseTo(5.4843, 4);
  });

  it("futuro ya vencido (días ≤ 0) → TNA NaN, sintético y directa siguen", () => {
    const c = calcularSintetico(SPOT, PX, PAGO_FINAL, FUT, 0);
    expect(c.sinteticoAFinish).toBeCloseTo(1503.6786260197512, 9);
    expect(c.tasaDirecta).toBeCloseTo(0.0034558732197205178, 12);
    expect(Number.isNaN(c.tna)).toBe(true);
  });
});

describe("sinteticos.ts — emparejarSinteticos (relevamiento web R6, punto 34)", () => {
  const HOY = Date.parse("2026-07-08T12:00:00-03:00"); // misma fecha operativa del fixture del Excel
  const JUL_VTO = Date.parse("2026-07-31T12:00:00-03:00");
  const AGO14_VTO = Date.parse("2026-08-14T12:00:00-03:00");
  const AGO_VTO = Date.parse("2026-08-31T12:00:00-03:00");

  const letras = [
    { symbol: "S31L6", px: 116.45, vencMs: JUL_VTO },
    { symbol: "S14G6", px: 106.64, vencMs: AGO14_VTO }, // pierde contra S31G6: más lejos de fin de mes
    { symbol: "S31G6", px: 113.3, vencMs: AGO_VTO },
  ];
  const posiciones = [
    { label: "JUL26", precio: 1498.5, vencMs: JUL_VTO },
    { label: "AGO26", precio: 1560.0, vencMs: AGO_VTO },
  ];
  const pagoFinal = { S31L6: 117.677, S14G6: 108.03, S31G6: 127.064 };

  it("empareja cada letra con la posición DLR de su mismo mes, anualiza por los días al vto del FUTURO y calcula S31L6 = el fixture del Excel", () => {
    const rows = emparejarSinteticos(1488, letras, posiciones, pagoFinal, HOY);
    const jul = rows.find((r) => r.letra === "S31L6")!;
    expect(jul.posicion).toBe("JUL26");
    expect(jul.dias).toBe(23); // días al vto del futuro (coincide con el de la letra: mismo día)
    expect(jul.sinteticoAFinish).toBeCloseTo(1503.6786260197512, 9);
    expect(jul.tnaPct).toBeCloseTo(5.4843, 4);
  });

  it("una sola letra por posición de futuro: de S14G6/S31G6 (las 2 ↔ AGO26) queda la más cercana a fin de mes (S31G6)", () => {
    const rows = emparejarSinteticos(1488, letras, posiciones, pagoFinal, HOY);
    expect(rows).toHaveLength(2); // JUL26 (S31L6) + AGO26 (S31G6) — S14G6 se descarta
    expect(rows.find((r) => r.letra === "S14G6")).toBeUndefined();
    const ago = rows.find((r) => r.letra === "S31G6")!;
    expect(ago.posicion).toBe("AGO26");
    expect(ago.dias).toBe(54); // días al vto del futuro AGO26 desde el 08/07
  });

  it("degrada honesto: sin pago final la fila aparece pero con sintético null", () => {
    const rows = emparejarSinteticos(1488, letras, posiciones, { S31L6: 117.677 }, HOY);
    const ago = rows.find((r) => r.posicion === "AGO26")!;
    expect(ago.pagoFinal).toBeNull();
    expect(ago.sinteticoAFinish).toBeNull();
    expect(ago.tnaPct).toBeNull();
  });

  it("letra sin dólar futuro de su mismo mes se excluye (no cruza meses)", () => {
    const lejana = [{ symbol: "S30N7", px: 100, vencMs: Date.parse("2027-11-30T12:00:00-03:00") }];
    const rows = emparejarSinteticos(1488, lejana, posiciones, {}, HOY);
    expect(rows).toHaveLength(0);
    // octubre contra un panel con solo JUL/AGO tampoco empareja (no hay OCT26).
    const oct = [{ symbol: "S30O6", px: 100, vencMs: Date.parse("2026-10-30T12:00:00-03:00") }];
    expect(emparejarSinteticos(1488, oct, posiciones, {}, HOY)).toHaveLength(0);
  });

  it("ordena por vencimiento de la letra (orden de curva)", () => {
    const rows = emparejarSinteticos(1488, [...letras].reverse(), posiciones, pagoFinal, HOY);
    expect(rows.map((r) => r.letra)).toEqual(["S31L6", "S31G6"]);
  });
});
