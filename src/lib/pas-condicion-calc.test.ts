import { describe, it, expect } from "vitest";
import {
  GRANOS_CONDICION,
  granosPresentes,
  ciclosDeGrano,
  campaniasDeGranoCiclo,
  campaniaDefaultCondicion,
  overlayBuenaExcelente,
  overlayAdecuadaOptima,
  fenologiaCampania,
  deltaCondicionReciente,
  type FilaCondicionDB,
} from "./pas-condicion-calc";

function fila(
  grano: string,
  ciclo: string,
  campania: string,
  semana: number,
  ccBuena: number | null,
  ccExcelente: number | null,
  chAdecuada: number | null,
  chOptima: number | null,
  fenologia: { etapa: string; pct: number | null }[] = [],
): FilaCondicionDB {
  return {
    grano, ciclo, zona: "TOTAL", campania, semana,
    siembra_pct: 100,
    cc_mala: 0, cc_regular: 0, cc_normal: 0, cc_buena: ccBuena, cc_excelente: ccExcelente,
    ch_sequia: 0, ch_regular: 0, ch_adecuada: chAdecuada, ch_optima: chOptima, ch_exceso: 0,
    fenologia,
  };
}

describe("granosPresentes / ciclosDeGrano / campaniasDeGranoCiclo", () => {
  const filas: FilaCondicionDB[] = [
    fila("trigo", "total", "2024/25", 10, 60, 20, 40, 30),
    fila("soja", "total", "2024/25", 5, 50, 10, 30, 20),
    fila("soja", "1ra", "2024/25", 5, 55, 12, 32, 22),
    fila("soja", "2da", "2024/25", 5, 45, 8, 28, 18),
    fila("soja", "total", "2023/24", 5, 40, 5, 25, 15),
  ];

  it("lista los granos presentes en el orden de exhibición soja/maíz/trigo/girasol, nunca cebada/sorgo", () => {
    expect(granosPresentes(filas)).toEqual(["soja", "trigo"]);
    expect(GRANOS_CONDICION).not.toContain("cebada");
    expect(GRANOS_CONDICION).not.toContain("sorgo");
  });

  it("deriva los ciclos de los datos reales — soja trae 1ra/2da, trigo no", () => {
    expect(ciclosDeGrano(filas, "soja")).toEqual(["total", "1ra", "2da"]);
    expect(ciclosDeGrano(filas, "trigo")).toEqual(["total"]);
  });

  it("campañas ascendentes por grano+ciclo, y el default es la más reciente", () => {
    expect(campaniasDeGranoCiclo(filas, "soja", "total")).toEqual(["2023/24", "2024/25"]);
    expect(campaniaDefaultCondicion(filas, "soja", "total")).toBe("2024/25");
  });
});

describe("overlayBuenaExcelente / overlayAdecuadaOptima — una serie por campaña, nunca fecha calendario", () => {
  const filas: FilaCondicionDB[] = [
    fila("maiz", "total", "2023/24", 1, 40, 10, 30, 20),
    fila("maiz", "total", "2023/24", 2, 45, 12, 32, 22),
    fila("maiz", "total", "2024/25", 1, 50, 15, 35, 25),
    fila("maiz", "total", "2024/25", 2, null, null, 38, 28), // bloque CC null (pre-emergencia o descarte)
  ];

  it("una serie por campaña, con el eje siendo la semana (nunca una fecha)", () => {
    const overlay = overlayBuenaExcelente(filas, "maiz", "total");
    expect(overlay.map((s) => s.campania)).toEqual(["2023/24", "2024/25"]);
    expect(overlay[0]!.puntos).toEqual([
      { semana: 1, valor: 50 },
      { semana: 2, valor: 57 },
    ]);
  });

  it("propaga null cuando el bloque CC/CH de origen es null (no inventa 0)", () => {
    const overlay = overlayBuenaExcelente(filas, "maiz", "total");
    const c2425 = overlay.find((s) => s.campania === "2024/25")!;
    expect(c2425.puntos.find((p) => p.semana === 2)!.valor).toBeNull();
  });

  it("condición hídrica (Adecuada+Óptima) es una métrica independiente de la de cultivo", () => {
    const overlay = overlayAdecuadaOptima(filas, "maiz", "total");
    expect(overlay[0]!.puntos).toEqual([
      { semana: 1, valor: 50 },
      { semana: 2, valor: 54 },
    ]);
  });
});

describe("fenologiaCampania — multi-etapa, orden real del header", () => {
  const etapasTrigo = [
    { etapa: "Macollaje", pct: 40 },
    { etapa: "Encañazón", pct: 10 },
    { etapa: "Espigazón", pct: 0 },
  ];
  const filas: FilaCondicionDB[] = [
    fila("trigo", "total", "2024/25", 5, 60, 20, 40, 30, etapasTrigo),
    fila("trigo", "total", "2024/25", 6, 55, 25, 38, 32, [
      { etapa: "Macollaje", pct: 30 },
      { etapa: "Encañazón", pct: 20 },
      { etapa: "Espigazón", pct: 5 },
    ]),
  ];

  it("una serie por etapa, en el mismo orden literal del header (Macollaje·Encañazón·Espigazón)", () => {
    const series = fenologiaCampania(filas, "trigo", "total", "2024/25");
    expect(series.map((s) => s.etapa)).toEqual(["Macollaje", "Encañazón", "Espigazón"]);
    expect(series[0]!.puntos).toEqual([
      { semana: 5, pct: 40 },
      { semana: 6, pct: 30 },
    ]);
  });

  it("campaña sin datos para ese grano/ciclo devuelve series vacías (sin fantasma)", () => {
    expect(fenologiaCampania(filas, "trigo", "total", "2020/21")).toEqual([]);
  });
});

describe("deltaCondicionReciente — Δ de Buena+Excelente entre las 2 últimas semanas (E4, informe semanal)", () => {
  it("compara las 2 últimas semanas CON DATO de la campaña vigente (la más reciente)", () => {
    const filas: FilaCondicionDB[] = [
      fila("soja", "total", "2023/24", 50, 40, 5, 25, 15),
      fila("soja", "total", "2024/25", 5, 50, 10, 30, 20),
      fila("soja", "total", "2024/25", 6, 55, 12, 32, 22),
      fila("soja", "total", "2024/25", 7, 50, 10, 28, 20),
    ];
    expect(deltaCondicionReciente(filas, "soja", "total")).toEqual({
      campania: "2024/25",
      semanaActual: 7,
      semanaPrevia: 6,
      valorActual: 60,
      valorPrevio: 67,
      deltaPts: -7,
    });
  });

  it("salta semanas con valor null en vez de compararlas (huecos del corte semanal)", () => {
    const filas: FilaCondicionDB[] = [
      fila("trigo", "total", "2024/25", 5, 60, 20, 40, 30),
      fila("trigo", "total", "2024/25", 6, null, null, 40, 30),
      fila("trigo", "total", "2024/25", 7, 65, 25, 40, 30),
    ];
    expect(deltaCondicionReciente(filas, "trigo", "total")).toEqual({
      campania: "2024/25",
      semanaActual: 7,
      semanaPrevia: 5,
      valorActual: 90,
      valorPrevio: 80,
      deltaPts: 10,
    });
  });

  it("null si el grano no tiene datos, o la campaña vigente tiene menos de 2 semanas con valor", () => {
    const filas: FilaCondicionDB[] = [fila("soja", "total", "2024/25", 5, 50, 10, 30, 20)];
    expect(deltaCondicionReciente(filas, "soja", "total")).toBeNull();
    expect(deltaCondicionReciente(filas, "girasol", "total")).toBeNull();
  });
});
