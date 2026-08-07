import { describe, it, expect } from "vitest";
import {
  elegirPosicionT0,
  medirVentana,
  esAcierto,
  confianzaAProbabilidad,
  brierDeVentana,
  calcularScorecardView,
  calcularScorecard,
  type FuturoCierreRow,
} from "./views-scorecard";
import type { ViewMercado } from "./views-mercado";

function fila(posicion: string, fecha: string, settlement: number, underlying = "SOJ"): FuturoCierreRow {
  return { underlying, posicion, fecha, settlement };
}

describe("elegirPosicionT0", () => {
  it("elige la posición viva más cercana a t0, en la rueda más cercana <= t0", () => {
    const rows = [fila("JUL26", "2026-07-10", 300), fila("AGO26", "2026-07-10", 305)];
    expect(elegirPosicionT0(rows, "2026-07-10")).toEqual({ posicion: "JUL26", settlement: 300 });
  });

  it("usa la rueda más cercana <= t0 si t0 cae un día sin cierre (fin de semana)", () => {
    const rows = [fila("JUL26", "2026-07-10", 300)];
    // 2026-07-11 es sábado: no hay fila ese día, toma la del viernes 10.
    expect(elegirPosicionT0(rows, "2026-07-11")).toEqual({ posicion: "JUL26", settlement: 300 });
  });

  it("descarta posiciones ya vencidas al momento de t0", () => {
    const rows = [fila("JUL26", "2026-08-05", 300), fila("AGO26", "2026-08-05", 310)];
    // JUL26 vence 2026-07-31, ya pasó para t0=2026-08-05 → debe elegir AGO26.
    expect(elegirPosicionT0(rows, "2026-08-05")).toEqual({ posicion: "AGO26", settlement: 310 });
  });

  it("null si no hay ninguna fila en o antes de t0", () => {
    const rows = [fila("JUL26", "2026-08-01", 300)];
    expect(elegirPosicionT0(rows, "2026-07-01")).toBeNull();
  });
});

describe("medirVentana — contrato fijado en t0, nunca re-elegido", () => {
  const rows = [
    fila("JUL26", "2026-07-10", 300),
    fila("JUL26", "2026-07-17", 310),
    fila("JUL26", "2026-07-31", 325),
    fila("AGO26", "2026-08-07", 340), // otra posición: NUNCA debe usarse para medir JUL26
  ];

  it("mide el retorno de la MISMA posición cuando sigue viva en la ventana", () => {
    const v = medirVentana(rows, "JUL26", 300, "2026-07-10", 7);
    expect(v.motivo).toBe("ok");
    expect(v.retorno).toBeCloseTo(310 / 300 - 1, 10);
    expect(v.fechaObjetivo).toBe("2026-07-17");
  });

  it("degrada a null (contrato_vencido) si la posición fijada ya venció antes de la ventana — caso de rolleo", () => {
    // Ventana de 28 días desde 2026-07-10 → objetivo 2026-08-07, pero JUL26 vence 2026-07-31: el
    // scorecard NO debe saltar a AGO26 (que sí tiene dato en 2026-08-07) — degrada a null.
    const v = medirVentana(rows, "JUL26", 300, "2026-07-10", 28);
    expect(v.motivo).toBe("contrato_vencido");
    expect(v.retorno).toBeNull();
  });

  it("degrada a null (sin_dato_aun) si todavía no hay cierre para esa fecha (view muy reciente)", () => {
    const rowsCortas = [fila("JUL26", "2026-07-10", 300), fila("JUL26", "2026-07-13", 302)];
    const v = medirVentana(rowsCortas, "JUL26", 300, "2026-07-10", 14); // objetivo 07-24, sin datos
    expect(v.motivo).toBe("sin_dato_aun");
    expect(v.retorno).toBeNull();
  });
});

describe("esAcierto", () => {
  it("alcista acierta con retorno positivo", () => {
    expect(esAcierto("alcista", 0.05)).toBe(true);
    expect(esAcierto("alcista", -0.01)).toBe(false);
  });
  it("bajista acierta con retorno negativo", () => {
    expect(esAcierto("bajista", -0.02)).toBe(true);
    expect(esAcierto("bajista", 0.01)).toBe(false);
  });
  it("neutral acierta dentro de la banda de 1%", () => {
    expect(esAcierto("neutral", 0.005)).toBe(true);
    expect(esAcierto("neutral", 0.02)).toBe(false);
  });
  it("null si no hay retorno medido", () => {
    expect(esAcierto("alcista", null)).toBeNull();
  });

  // V3, N2/§7.1: "levemente_X" cuenta como la misma dirección que X para el hit-rate.
  it("levemente_alcista acierta igual que alcista (misma dirección, menor convicción)", () => {
    expect(esAcierto("levemente_alcista", 0.05)).toBe(true);
    expect(esAcierto("levemente_alcista", -0.01)).toBe(false);
  });
  it("levemente_bajista acierta igual que bajista", () => {
    expect(esAcierto("levemente_bajista", -0.02)).toBe(true);
    expect(esAcierto("levemente_bajista", 0.01)).toBe(false);
  });
});

describe("confianzaAProbabilidad / brierDeVentana", () => {
  it("direcciones plenas: mapea 1→0.55 y 5→0.95 linealmente", () => {
    expect(confianzaAProbabilidad(1, "alcista")).toBeCloseTo(0.55, 10);
    expect(confianzaAProbabilidad(5, "alcista")).toBeCloseTo(0.95, 10);
    expect(confianzaAProbabilidad(3, "alcista")).toBeCloseTo(0.75, 10);
    expect(confianzaAProbabilidad(3, "neutral")).toBeCloseTo(0.75, 10);
  });

  it("direcciones leves: mapeo más chato, 1→0.55 y 5→0.75 (V3, N2/§7.1)", () => {
    expect(confianzaAProbabilidad(1, "levemente_alcista")).toBeCloseTo(0.55, 10);
    expect(confianzaAProbabilidad(5, "levemente_alcista")).toBeCloseTo(0.75, 10);
    expect(confianzaAProbabilidad(3, "levemente_bajista")).toBeCloseTo(0.65, 10);
  });

  it("Brier bajo cuando acierta con alta confianza, alto cuando falla con alta confianza", () => {
    const acierta = brierDeVentana("alcista", 5, 0.05)!;
    const falla = brierDeVentana("alcista", 5, -0.05)!;
    expect(acierta).toBeCloseTo((0.95 - 1) ** 2, 10);
    expect(falla).toBeCloseTo((0.95 - 0) ** 2, 10);
    expect(falla).toBeGreaterThan(acierta);
  });

  it("Brier de una dirección leve usa el techo 0.75, no 0.95, aun con confianza 5", () => {
    const acierta = brierDeVentana("levemente_alcista", 5, 0.05)!;
    expect(acierta).toBeCloseTo((0.75 - 1) ** 2, 10);
  });

  it("null si la ventana no tiene retorno", () => {
    expect(brierDeVentana("alcista", 3, null)).toBeNull();
  });
});

describe("calcularScorecardView — integración con rolleo", () => {
  // View escrito una semana antes del vto de JUL26 (vence 2026-07-31): la ventana de 14
  // días cae después del vencimiento y debe degradar, nunca saltar a AGO26.
  const rows = [
    fila("JUL26", "2026-07-24", 300),
    fila("JUL26", "2026-07-31", 310),
    fila("AGO26", "2026-08-07", 500), // señuelo: no debe filtrarse a la ventana de 14d
  ];
  const view = { id: "v1", grano: "soja" as const, fecha: "2026-07-24", direccion: "alcista" as const, confianza: 4 };

  it("fija JUL26 en t0 y mide 7d ok, 14d contrato_vencido (sin mezclar con AGO26)", () => {
    const sc = calcularScorecardView(view, rows);
    expect(sc.posicionT0).toBe("JUL26");
    expect(sc.settlementT0).toBe(300);
    expect(sc.ventanas).toHaveLength(2);
    const [w7, w14] = sc.ventanas;
    expect(w7!.motivo).toBe("ok");
    expect(w7!.acierto).toBe(true); // 310 > 300
    expect(w14!.motivo).toBe("contrato_vencido");
    expect(w14!.retorno).toBeNull();
    expect(w14!.acierto).toBeNull();
  });
});

describe("calcularScorecard — resumen por grano (hit-rate, Brier, racha)", () => {
  const rowsSoja: FuturoCierreRow[] = [
    fila("JUL26", "2026-07-01", 300),
    fila("JUL26", "2026-07-15", 330), // +10% → acierto alcista
    fila("AGO26", "2026-08-01", 300),
    fila("AGO26", "2026-08-15", 280), // -6.7% → falla alcista
  ];
  const views: Pick<ViewMercado, "id" | "grano" | "fecha" | "direccion" | "confianza">[] = [
    { id: "v-jul", grano: "soja", fecha: "2026-07-01", direccion: "alcista", confianza: 4 },
    { id: "v-ago", grano: "soja", fecha: "2026-08-01", direccion: "alcista", confianza: 3 },
  ];

  it("computa hit-rate a 14 días, Brier promedio y racha desde el más reciente", () => {
    const sc = calcularScorecard(views, rowsSoja);
    const soja = sc.porGrano.soja;
    expect(soja.nMedidos).toBe(2);
    expect(soja.hitRate).toBeCloseTo(0.5, 10); // 1 de 2
    expect(soja.brier).not.toBeNull();
    // El más reciente (v-ago, 08/01) falló → racha de error de largo 1 (v-jul antes acertó).
    expect(soja.racha).toEqual({ tipo: "error", largo: 1 });
    expect(sc.porView["v-jul"]!.ventanas.find((w) => w.dias === 14)!.acierto).toBe(true);
    expect(sc.porView["v-ago"]!.ventanas.find((w) => w.dias === 14)!.acierto).toBe(false);
  });

  it("granos sin views medidas devuelven resumen vacío, no error", () => {
    const sc = calcularScorecard(views, rowsSoja);
    expect(sc.porGrano.maiz).toEqual({ grano: "maiz", nMedidos: 0, hitRate: null, brier: null, racha: null });
  });
});

describe("calcularScorecard — direcciones leves (V3, N2/§7.1) cuentan como su extremo", () => {
  const rowsMaiz: FuturoCierreRow[] = [
    fila("JUL26", "2026-07-01", 200, "MAI"),
    fila("JUL26", "2026-07-15", 220, "MAI"), // +10% → acierto para levemente_alcista
  ];
  const views: Pick<ViewMercado, "id" | "grano" | "fecha" | "direccion" | "confianza">[] = [
    { id: "v-leve", grano: "maiz", fecha: "2026-07-01", direccion: "levemente_alcista", confianza: 5 },
  ];

  it("un view levemente_alcista que sube acierta igual que uno alcista pleno", () => {
    const sc = calcularScorecard(views, rowsMaiz);
    const w14 = sc.porView["v-leve"]!.ventanas.find((w) => w.dias === 14)!;
    expect(w14.acierto).toBe(true);
    expect(sc.porGrano.maiz.nMedidos).toBe(1);
    expect(sc.porGrano.maiz.hitRate).toBe(1);
    // Brier con el techo 0.75 de las direcciones leves (confianza 5): (0.75-1)^2, no (0.95-1)^2.
    expect(sc.porGrano.maiz.brier).toBeCloseTo((0.75 - 1) ** 2, 10);
  });
});
