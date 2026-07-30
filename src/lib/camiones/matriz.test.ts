import { describe, it, expect } from "vitest";
import {
  sumarZonas,
  seriesPorZona,
  agruparPorCampana,
  ultimasCampanas,
  campanasDisponibles,
  calcularKpis,
  type PuntoZP,
} from "./matriz";
import { ZONA_DISPLAY } from "./config";

// Maíz: campaña arranca 1/marzo (lineup/campanas.ts CAMPANA_CONFIG.MAIZE = 3).
const PUNTOS: PuntoZP[] = [
  { fecha: "2024-03-01", zona: "ROSARIO_ALEDANOS", producto: "MAIZE", cantidad: 100 },
  { fecha: "2024-03-01", zona: "BAHIA_BLANCA", producto: "MAIZE", cantidad: 50 },
  { fecha: "2025-03-01", zona: "ROSARIO_ALEDANOS", producto: "MAIZE", cantidad: 120 },
  { fecha: "2025-03-01", zona: "BAHIA_BLANCA", producto: "MAIZE", cantidad: 60 },
  { fecha: "2025-03-02", zona: "ROSARIO_ALEDANOS", producto: "MAIZE", cantidad: 130 },
  { fecha: "2025-03-02", zona: "BAHIA_BLANCA", producto: "MAIZE", cantidad: 70 },
];

describe("camiones/matriz.ts — sumarZonas", () => {
  it("suma las zonas elegidas por fecha, para un solo producto", () => {
    const r = sumarZonas(PUNTOS, "MAIZE", ["ROSARIO_ALEDANOS", "BAHIA_BLANCA"]);
    expect(r).toEqual([
      { fecha: "2024-03-01", cantidad: 150 },
      { fecha: "2025-03-01", cantidad: 180 },
      { fecha: "2025-03-02", cantidad: 200 },
    ]);
  });

  it("con una sola zona elegida, no suma la otra", () => {
    const r = sumarZonas(PUNTOS, "MAIZE", ["BAHIA_BLANCA"]);
    expect(r).toEqual([
      { fecha: "2024-03-01", cantidad: 50 },
      { fecha: "2025-03-01", cantidad: 60 },
      { fecha: "2025-03-02", cantidad: 70 },
    ]);
  });
});

describe("camiones/matriz.ts — seriesPorZona", () => {
  it("una línea por zona elegida (modo calendario, sin sumar entre zonas)", () => {
    const r = seriesPorZona(PUNTOS, "MAIZE", ["ROSARIO_ALEDANOS"], ZONA_DISPLAY);
    expect(r).toHaveLength(1);
    expect(r[0]!.key).toBe("ROSARIO_ALEDANOS");
    expect(r[0]!.puntos.map((p) => p.cantidad)).toEqual([100, 120, 130]);
  });
});

describe("camiones/matriz.ts — agruparPorCampana + campanasDisponibles", () => {
  const sumada = sumarZonas(PUNTOS, "MAIZE", ["ROSARIO_ALEDANOS", "BAHIA_BLANCA"]);

  it("re-agrupa por campaña con el día de campaña como eje", () => {
    const r = agruparPorCampana(sumada, "MAIZE", ["2024/25", "2025/26"]);
    expect(r).toEqual([
      { campana: "2024/25", puntos: [{ dia: 1, fecha: "2024-03-01", cantidad: 150 }] },
      {
        campana: "2025/26",
        puntos: [
          { dia: 1, fecha: "2025-03-01", cantidad: 180 },
          { dia: 2, fecha: "2025-03-02", cantidad: 200 },
        ],
      },
    ]);
  });

  it("omite campañas sin dato en el rango pedido", () => {
    const r = agruparPorCampana(sumada, "MAIZE", ["2020/21", "2025/26"]);
    expect(r.map((s) => s.campana)).toEqual(["2025/26"]);
  });

  it("campanasDisponibles lista lo que hay, más nueva primero", () => {
    expect(campanasDisponibles(sumada, "MAIZE")).toEqual(["2025/26", "2024/25"]);
  });
});

describe("camiones/matriz.ts — ultimasCampanas", () => {
  it("vigente + n anteriores, más nueva primero", () => {
    // 15/03/2025 >= 1/marzo → campaña vigente 2025/26.
    const r = ultimasCampanas("MAIZE", new Date("2025-03-15T00:00:00Z"), 1);
    expect(r).toEqual(["2025/26", "2024/25"]);
  });
});

describe("camiones/matriz.ts — calcularKpis", () => {
  it("serie vacía → todo null", () => {
    expect(calcularKpis([])).toEqual({
      fecha: null,
      total: null,
      fechaAyer: null,
      totalAyer: null,
      deltaAyer: null,
      deltaSemana: null,
      deltaInteranual: null,
    });
  });

  it("calcula día anterior (≤4d), semana e interanual (ventana ±7d)", () => {
    const sumada = [
      { fecha: "2024-03-04", cantidad: 150 }, // 2025-03-02 − 364d = 2024-03-03; a 1 día, dentro de ±7
      { fecha: "2025-02-23", cantidad: 170 }, // exactamente 7 días antes de 2025-03-02
      { fecha: "2025-03-01", cantidad: 180 },
      { fecha: "2025-03-02", cantidad: 200 },
    ];
    const k = calcularKpis(sumada);
    expect(k.fecha).toBe("2025-03-02");
    expect(k.total).toBe(200);
    expect(k.fechaAyer).toBe("2025-03-01");
    expect(k.totalAyer).toBe(180);
    expect(k.deltaAyer).toBe(20);
    expect(k.deltaSemana).toBe(30);
    expect(k.deltaInteranual?.fecha).toBe("2024-03-04");
    expect(k.deltaInteranual?.valor).toBe(50);
    expect(k.deltaInteranual?.pct).toBeCloseTo((200 / 150 - 1) * 100, 6);
  });

  it("sin día anterior contiguo (hueco >4d), deltaAyer queda null", () => {
    const sumada = [
      { fecha: "2025-01-01", cantidad: 100 },
      { fecha: "2025-03-02", cantidad: 200 },
    ];
    const k = calcularKpis(sumada);
    expect(k.deltaAyer).toBeNull();
    expect(k.fechaAyer).toBeNull();
  });
});
