import { describe, it, expect } from "vitest";
import {
  campaniasDeGrano,
  campaniaDefault,
  construirFotoCampania,
  evolucionParticipacion,
  CAMPANIA_ZONAL_CONFIABLE,
  ZONAS_PRODUCTIVAS,
  type FilaZonaDB,
} from "./pas-zonas-calc";

function fila(campania: string, zona: string, sembrado: number, cosechado: number, produccion: number | null): FilaZonaDB {
  return {
    grano: "soja",
    campania,
    zona,
    sembrado_ha: sembrado,
    perdido_ha: sembrado - cosechado,
    cosechado_ha: cosechado,
    produccion_tn: produccion,
    rinde_tn_ha: produccion != null && cosechado > 0 ? produccion / cosechado : null,
  };
}

describe("campaniasDeGrano / campaniaDefault", () => {
  const filas: FilaZonaDB[] = [
    fila("2020/21", "TOTAL", 1000, 900, 2700),
    fila("2020/21", "NOA", 400, 360, 1080),
    fila("2021/22", "TOTAL", 1100, 1000, 3000),
    fila("2021/22", "NOA", 450, 400, 1200),
    fila("2022/23", "TOTAL", 200, 0, null), // solo TOTAL, sin desglose zonal (campaña futura)
  ];

  it("lista las campañas ascendente, incluida la que solo tiene TOTAL", () => {
    expect(campaniasDeGrano(filas, "soja")).toEqual(["2020/21", "2021/22", "2022/23"]);
  });

  it("el default es la campaña más reciente CON desglose zonal, no la que solo tiene TOTAL", () => {
    expect(campaniaDefault(filas, "soja")).toBe("2021/22");
  });

  it("devuelve null si el grano no tiene ninguna campaña con zonas", () => {
    const soloTotal: FilaZonaDB[] = [fila("2020/21", "TOTAL", 100, 90, 270)];
    expect(campaniaDefault(soloTotal, "soja")).toBeNull();
  });
});

describe("construirFotoCampania — descomposición Δárea/Δrinde", () => {
  // 2020/21: NOA cosecha 360 ha a rinde 3,0 t/ha = 1.080 t. Resto 540 ha a rinde ~3,0 t/ha = 1.620 t. TOTAL 2.700 t / 900 ha.
  // 2021/22: NOA sube a 400 ha (Δárea +40) manteniendo rinde 3,0 (misma proporción) → cambia también el rinde a 3,5.
  const filas: FilaZonaDB[] = [
    fila("2020/21", "TOTAL", 1000, 900, 2700),
    fila("2020/21", "NOA", 400, 360, 1080),
    fila("2020/21", "Otras", 600, 540, 1620),
    fila("2021/22", "TOTAL", 1100, 1000, 3100),
    fila("2021/22", "NOA", 450, 400, 1400), // rinde pasó de 3,0 a 3,5
    fila("2021/22", "Otras", 650, 600, 1700),
  ];

  it("arma la foto con la campaña anterior real (no un año calendario asumido)", () => {
    const foto = construirFotoCampania(filas, "soja", "2021/22");
    expect(foto).not.toBeNull();
    expect(foto!.campaniaAnterior).toBe("2020/21");
    expect(foto!.confiable).toBe(true); // 2021/22 >= CAMPANIA_ZONAL_CONFIABLE
  });

  it("descompone Δprod ≈ efecto área + efecto rinde para la zona NOA", () => {
    const foto = construirFotoCampania(filas, "soja", "2021/22")!;
    const noa = foto.zonas.find((z) => z.zona === "NOA")!;
    // Δárea = 400-360=40 ha · rinde_prev = 1080/360 = 3.0 t/ha → efecto área = 120 t
    // Δrinde = (1400/400) - 3.0 = 0.5 t/ha · área_actual = 400 ha → efecto rinde = 200 t
    expect(noa.efectoAreaTn).toBeCloseTo(40 * 3.0, 6);
    expect(noa.efectoRindeTn).toBeCloseTo(0.5 * 400, 6);
    expect(noa.deltaProdTn).toBe(1400 - 1080);
    // La suma de los dos efectos reproduce el delta real (identidad exacta del shift-share).
    expect(noa.efectoAreaTn! + noa.efectoRindeTn!).toBeCloseTo(noa.deltaProdTn!, 6);
  });

  it("pctDelTotal de cada zona suma ~100% junto al resto de zonas presentes", () => {
    const foto = construirFotoCampania(filas, "soja", "2021/22")!;
    const suma = foto.zonas.reduce((s, z) => s + (z.pctDelTotal ?? 0), 0);
    expect(suma).toBeCloseTo(100, 4);
  });

  it("contribucionPp de cada zona suma el % de variación nacional del TOTAL", () => {
    const foto = construirFotoCampania(filas, "soja", "2021/22")!;
    const sumaContribuciones = foto.zonas.reduce((s, z) => s + (z.contribucionPp ?? 0), 0);
    const deltaNacionalPct = ((3100 - 2700) / 2700) * 100;
    expect(sumaContribuciones).toBeCloseTo(deltaNacionalPct, 4);
  });

  it("campaña sin anterior (la primera) no calcula Δ, pero sí carga los valores propios", () => {
    const foto = construirFotoCampania(filas, "soja", "2020/21")!;
    expect(foto.campaniaAnterior).toBeNull();
    for (const z of foto.zonas) {
      expect(z.deltaProdTn).toBeNull();
      expect(z.efectoAreaTn).toBeNull();
    }
  });

  it("campaña anterior a CAMPANIA_ZONAL_CONFIABLE marca confiable=false y no calcula pctDelTotal", () => {
    const vieja: FilaZonaDB[] = [
      fila("2005/06", "TOTAL", 1000, 900, 2700),
      fila("2005/06", "NOA", 400, 360, 1080),
    ];
    const foto = construirFotoCampania(vieja, "soja", "2005/06")!;
    expect(foto.campania < CAMPANIA_ZONAL_CONFIABLE).toBe(true);
    expect(foto.confiable).toBe(false);
    expect(foto.zonas[0]!.pctDelTotal).toBeNull();
  });

  it("devuelve null para una campaña que no existe para ese grano", () => {
    expect(construirFotoCampania(filas, "soja", "1999/00")).toBeNull();
  });
});

describe("evolucionParticipacion — top-6 + Resto", () => {
  it("con menos de 6 zonas, todas quedan como series propias (sin 'Resto')", () => {
    const filas: FilaZonaDB[] = [
      fila("2020/21", "TOTAL", 1000, 900, 3000),
      fila("2020/21", "NOA", 500, 450, 1800),
      fila("2020/21", "Otras", 500, 450, 1200),
    ];
    const { campanias, series } = evolucionParticipacion(filas, "soja");
    expect(campanias).toEqual(["2020/21"]);
    expect(series.map((s) => s.zona).sort()).toEqual(["NOA", "Otras"]);
    expect(series.some((s) => s.zona === "Resto")).toBe(false);
    const noa = series.find((s) => s.zona === "NOA")!;
    expect(noa.puntos[0]!.pct).toBeCloseTo(60, 4); // 1800/3000
  });

  it("con más de 6 zonas, agrupa las de menor participación media en 'Resto'", () => {
    // 8 zonas con participación decreciente 22,20,18,16,14,10,6,4 (suma 110... normalizamos a TOTAL real)
    const pesos = [22, 20, 18, 16, 14, 10, 6, 4];
    const zonasUsadas = ZONAS_PRODUCTIVAS.slice(0, 8);
    const total = pesos.reduce((a, b) => a + b, 0) * 10_000; // escala arbitraria en toneladas
    const filas: FilaZonaDB[] = [
      fila("2020/21", "TOTAL", 100_000, 90_000, total),
      ...zonasUsadas.map((zona, i) => fila("2020/21", zona, 10_000, 9_000, pesos[i]! * 10_000)),
    ];
    const { series } = evolucionParticipacion(filas, "soja");
    expect(series.length).toBe(7); // top-6 + Resto
    const nombres = series.map((s) => s.zona);
    expect(nombres.slice(0, 6)).toEqual(zonasUsadas.slice(0, 6)); // las 6 de mayor peso, en orden
    expect(nombres[6]).toBe("Resto");
    const resto = series.find((s) => s.zona === "Resto")!;
    // Resto = suma de las 2 últimas zonas (6 y 4) sobre el total (140) = 10/140*100
    expect(resto.puntos[0]!.pct).toBeCloseTo(((6 + 4) / pesos.reduce((a, b) => a + b, 0)) * 100, 4);
  });

  it("ignora campañas anteriores a CAMPANIA_ZONAL_CONFIABLE", () => {
    const filas: FilaZonaDB[] = [
      fila("2005/06", "TOTAL", 1000, 900, 2700),
      fila("2005/06", "NOA", 400, 360, 1080),
    ];
    const { campanias, series } = evolucionParticipacion(filas, "soja");
    expect(campanias).toEqual([]);
    expect(series).toEqual([]);
  });

  it("devuelve vacío si el grano no tiene datos", () => {
    expect(evolucionParticipacion([], "soja")).toEqual({ campanias: [], series: [] });
  });

  it("excluye del eje una campaña 'solo TOTAL' sin desglose zonal (nunca una caída falsa a 0%)", () => {
    // Mismo caso real que maíz/sorgo 2025/26 (§2.a): la campaña en curso todavía sin cosechar
    // trae SOLO la fila TOTAL, sin ninguna zona — no debe aparecer en el eje del gráfico.
    const filas: FilaZonaDB[] = [
      fila("2020/21", "TOTAL", 1000, 900, 3000),
      fila("2020/21", "NOA", 500, 450, 1800),
      fila("2020/21", "Otras", 500, 450, 1200),
      fila("2021/22", "TOTAL", 1100, 0, null), // campaña proyectada, sin cosecha ni zonas
    ];
    const { campanias, series } = evolucionParticipacion(filas, "soja");
    expect(campanias).toEqual(["2020/21"]);
    for (const s of series) for (const p of s.puntos) expect(p.campania).not.toBe("2021/22");
  });
});
