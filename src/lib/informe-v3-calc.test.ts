import { describe, it, expect } from "vitest";
import {
  restarDiasISO,
  calcularDeltaSerie,
  elegirTop3PorVolumen,
  sumaVentana,
  volumenPorUnderlying,
  calcularDesacople,
  type FilaVolumen,
} from "./informe-v3-calc";

describe("informe-v3-calc — restarDiasISO", () => {
  it("resta días calendario cruzando de mes", () => {
    expect(restarDiasISO("2026-08-01", 1)).toBe("2026-07-31");
    expect(restarDiasISO("2026-08-04", 7)).toBe("2026-07-28");
  });
});

describe("informe-v3-calc — calcularDeltaSerie", () => {
  it("Δ vs ayer con datos consecutivos", () => {
    const r = calcularDeltaSerie(
      [
        { fecha: "2026-08-03", valor: 340 },
        { fecha: "2026-08-04", valor: 350 },
      ],
      "2026-08-04",
      1,
    );
    expect(r.actual).toBe(350);
    expect(r.previo).toBe(340);
    expect(r.deltaPct).toBeCloseTo(((350 / 340 - 1) * 100));
    expect(r.fechaActual).toBe("2026-08-04");
    expect(r.fechaPrevia).toBe("2026-08-03");
  });

  it("salta el fin de semana: el viernes sigue siendo la comparación de un lunes", () => {
    const r = calcularDeltaSerie(
      [
        { fecha: "2026-07-31", valor: 100 }, // viernes
        { fecha: "2026-08-03", valor: 110 }, // lunes
      ],
      "2026-08-03",
      1,
    );
    expect(r.previo).toBe(100);
    expect(r.fechaPrevia).toBe("2026-07-31");
  });

  it("sin punto previo: delta null, nunca inventa un valor", () => {
    const r = calcularDeltaSerie([{ fecha: "2026-08-04", valor: 350 }], "2026-08-04", 1);
    expect(r.actual).toBe(350);
    expect(r.previo).toBeNull();
    expect(r.deltaPct).toBeNull();
  });

  it("serie vacía: todo null", () => {
    expect(calcularDeltaSerie([], "2026-08-04", 1)).toEqual({
      actual: null,
      previo: null,
      deltaPct: null,
      fechaActual: null,
      fechaPrevia: null,
    });
  });

  it("Δ semanal (diasAtras=7) elige el punto más cercano a 7 días atrás, no el más viejo", () => {
    const r = calcularDeltaSerie(
      [
        { fecha: "2026-07-20", valor: 90 },
        { fecha: "2026-07-28", valor: 95 }, // el más cercano a 7 días antes del 04/08
        { fecha: "2026-08-04", valor: 100 },
      ],
      "2026-08-04",
      7,
    );
    expect(r.previo).toBe(95);
    expect(r.fechaPrevia).toBe("2026-07-28");
  });
});

describe("informe-v3-calc — elegirTop3PorVolumen", () => {
  const filas: (FilaVolumen & { underlying: string })[] = [
    { underlying: "SOJ", posicion: "NOV26", ajuste: 340, ajusteFuente: "vivo", deltaPct: 1, volumen: 500 },
    { underlying: "SOJ", posicion: "ENE27", ajuste: 342, ajusteFuente: "vivo", deltaPct: 0.5, volumen: 1200 },
    { underlying: "SOJ", posicion: "MAY27", ajuste: 345, ajusteFuente: "cierre_anterior", deltaPct: null, volumen: null },
    { underlying: "SOJ", posicion: "JUL26", ajuste: 338, ajusteFuente: "vivo", deltaPct: 0.2, volumen: 300 },
    { underlying: "MAI", posicion: "JUL26", ajuste: 180, ajusteFuente: "vivo", deltaPct: -1, volumen: 900 },
  ];

  it("agrupa por underlying: un grupo por grano, en el orden en que aparecen", () => {
    const porGrano = elegirTop3PorVolumen(filas);
    expect(porGrano.map((g) => g.underlying)).toEqual(["SOJ", "MAI"]);
  });

  it("volumenTotal suma TODAS las posiciones con volumen, no solo el top 3", () => {
    const porGrano = elegirTop3PorVolumen(filas);
    const soj = porGrano.find((g) => g.underlying === "SOJ")!;
    expect(soj.top3.map((f) => f.posicion)).toEqual(["ENE27", "NOV26", "JUL26"]);
    expect(soj.volumenTotal).toBe(500 + 1200 + 300);
    expect(soj.top3).toHaveLength(3);
  });

  it("grano sin ninguna posición con volumen: volumenTotal null", () => {
    const porGrano = elegirTop3PorVolumen([
      { underlying: "TRI", posicion: "DIC26", ajuste: 200, ajusteFuente: "cierre_anterior", deltaPct: null, volumen: null },
    ]);
    expect(porGrano[0]!.volumenTotal).toBeNull();
  });
});

describe("informe-v3-calc — sumaVentana", () => {
  it("suma los últimos 7 días vs los 7 anteriores", () => {
    const puntos = [
      { fecha: "2026-07-22", valor: 100 },
      { fecha: "2026-07-25", valor: 200 }, // semana previa (15-21 jul... ver rango exacto abajo)
      { fecha: "2026-07-29", valor: 50 },
      { fecha: "2026-08-01", valor: 80 },
    ];
    // hastaISO=2026-08-04 → actual = [29/07 jul, 08/01] (rango 29/07-04/08), previo = [22/07-28/07]
    const r = sumaVentana(puntos, "2026-08-04", 7);
    expect(r.totalActual).toBe(50 + 80);
    expect(r.totalPrevio).toBe(100 + 200);
    expect(r.nActual).toBe(2);
    expect(r.nPrevio).toBe(2);
    expect(r.deltaPct).toBeCloseTo(((130 / 300 - 1) * 100));
  });

  it("sin datos en la ventana previa: delta null", () => {
    const r = sumaVentana([{ fecha: "2026-08-01", valor: 80 }], "2026-08-04", 7);
    expect(r.totalActual).toBe(80);
    expect(r.totalPrevio).toBeNull();
    expect(r.deltaPct).toBeNull();
  });
});

describe("informe-v3-calc — volumenPorUnderlying", () => {
  it("suma volumen de las últimas N ruedas de CADA underlying (calendario propio, no global)", () => {
    const filas = [
      { underlying: "SOJ", fecha: "2026-07-24", volume: 999 }, // rueda más vieja, se excluye (ruedas=5)
      { underlying: "SOJ", fecha: "2026-07-27", volume: 100 },
      { underlying: "SOJ", fecha: "2026-07-28", volume: 150 },
      { underlying: "SOJ", fecha: "2026-07-29", volume: 200 },
      { underlying: "SOJ", fecha: "2026-07-30", volume: 90 },
      { underlying: "SOJ", fecha: "2026-07-31", volume: 110 },
      { underlying: "MAI", fecha: "2026-07-31", volume: 50 },
    ];
    const r = volumenPorUnderlying(filas, "2026-08-04", 5);
    const soj = r.find((x) => x.underlying === "SOJ")!;
    expect(soj.volumen).toBe(100 + 150 + 200 + 90 + 110);
    expect(soj.nRuedas).toBe(5);
    const mai = r.find((x) => x.underlying === "MAI")!;
    expect(mai.volumen).toBe(50);
    expect(mai.nRuedas).toBe(1);
  });

  it("fila con volume null no rompe la suma del resto", () => {
    const r = volumenPorUnderlying(
      [
        { underlying: "TRI", fecha: "2026-08-03", volume: null },
        { underlying: "TRI", fecha: "2026-08-04", volume: 40 },
      ],
      "2026-08-04",
      5,
    );
    expect(r.find((x) => x.underlying === "TRI")!.volumen).toBe(40);
  });
});

describe("informe-v3-calc — calcularDesacople", () => {
  const a3 = [
    { fecha: "2026-07-07", valor: 340 },
    { fecha: "2026-07-28", valor: 345 },
    { fecha: "2026-08-04", valor: 350 },
  ];
  const cbot = [
    { fecha: "2026-07-07", valor: 330 },
    { fecha: "2026-07-28", valor: 332 },
    { fecha: "2026-08-04", valor: 340 },
  ];

  it("premio hoy = a3 − cbot del mismo día", () => {
    const r = calcularDesacople(a3, cbot, "2026-08-04");
    expect(r.hoy.premioUsdTn).toBe(10);
    expect(r.hace7d.premioUsdTn).toBe(13);
    expect(r.hace28d.premioUsdTn).toBe(10);
  });

  it("sin dato de uno de los dos lados: premio null, no inventa", () => {
    const r = calcularDesacople(a3, [], "2026-08-04");
    expect(r.hoy.premioUsdTn).toBeNull();
    expect(r.hoy.a3).toBe(350);
    expect(r.hoy.cbot).toBeNull();
  });
});
