import { describe, it, expect } from "vitest";
import {
  mediana,
  madNormalizado,
  chequearSerie,
  chequearIdentidad,
  chequearDuplicados,
  ventanaEstacional,
  PERFILES,
  type Punto,
} from "./anomalias";
import { SERIES, IDENTIDADES } from "./anomalias-series";

/**
 * Fixtures REALES (no sintéticas) de los bugs que motivaron D7/L7 — números tal cual estaban en
 * la base de Supabase al momento del bug, verificados por SQL el 28/07/2026 contra `compras` y
 * `estimaciones_produccion` (docs/sesiones/2026-07-28-d7-detector-anomalias.md).
 */

describe("mediana / madNormalizado — robustos a outliers", () => {
  it("la mediana ignora un outlier de 15 órdenes de magnitud (el bug de 6,4e15)", () => {
    const serie = [180, 182, 179, 181, 6_400_000_000_000_000, 183];
    expect(mediana(serie)).toBe(181.5);
  });

  it("el promedio SÍ se destruye con ese mismo outlier — por eso no se usa", () => {
    const serie = [180, 182, 179, 181, 6_400_000_000_000_000, 183];
    const promedio = serie.reduce((a, b) => a + b, 0) / serie.length;
    expect(promedio).toBeGreaterThan(1_000_000_000_000_000);
  });

  it("MAD normalizado de una serie sin ruido es 0 (protegido en chequearSerie por minDelta)", () => {
    expect(madNormalizado([100, 100, 100, 100])).toBe(0);
  });
});

describe("chequearSerie — bug real: semana del 08/07/2026 de `compras` cargada ÷1000", () => {
  // Progresión REAL del acumulado trigo · 2025/26 · EXPORTACION, 14 semanas hasta el 01/07
  // (verificado por SQL 28/07/2026 — cumple el `minObs: 8` del perfil `acumulado`). El 08/07
  // correcto es 16.238.900; el bug real lo subió con el export de Agrochat en MILES de toneladas
  // (la cifra real "16238,9" interpretada como toneladas en vez de miles) → quedó ~16.239 t.
  const historia: Punto[] = [
    { fecha: "2026-04-01", valor: 14_192_000 },
    { fecha: "2026-04-08", valor: 14_311_300 },
    { fecha: "2026-04-15", valor: 14_474_600 },
    { fecha: "2026-04-22", valor: 14_598_800 },
    { fecha: "2026-04-29", valor: 14_775_400 },
    { fecha: "2026-05-06", valor: 14_914_800 },
    { fecha: "2026-05-13", valor: 15_121_200 },
    { fecha: "2026-05-20", valor: 15_237_800 },
    { fecha: "2026-05-27", valor: 15_320_200 },
    { fecha: "2026-06-03", valor: 15_502_400 },
    { fecha: "2026-06-10", valor: 15_683_400 },
    { fecha: "2026-06-17", valor: 15_797_200 },
    { fecha: "2026-06-24", valor: 15_952_100 },
    { fecha: "2026-07-01", valor: 16_088_400 },
  ];

  it("detecta el ÷1000 por orden de magnitud Y por monotonía (el acumulado no puede bajar)", () => {
    const bugueado: Punto[] = [{ fecha: "2026-07-08", valor: 16_238.9 }];
    const out = chequearSerie({ serie: "compras · trigo · EXPORTACION · 2025/26", perfil: PERFILES.acumulado, historia, nuevos: bugueado, unidad: "t" });
    expect(out.some((a) => a.tipo === "magnitud" && a.severidad === "alta")).toBe(true);
    expect(out.some((a) => a.tipo === "monotonia")).toBe(true);
  });

  it("el valor real (sin el bug) para la misma fecha NO dispara nada", () => {
    const sano: Punto[] = [{ fecha: "2026-07-08", valor: 16_238_900 }];
    const out = chequearSerie({ serie: "compras · trigo · EXPORTACION · 2025/26", perfil: PERFILES.acumulado, historia, nuevos: sano, unidad: "t" });
    expect(out).toHaveLength(0);
  });

  it("la semana siguiente (16.329.500, ya sin el bug) tampoco dispara nada sobre la historia sana", () => {
    const out = chequearSerie({
      serie: "compras · trigo · EXPORTACION · 2025/26",
      perfil: PERFILES.acumulado,
      historia: [...historia, { fecha: "2026-07-08", valor: 16_238_900 }],
      nuevos: [{ fecha: "2026-07-15", valor: 16_329_500 }],
      unidad: "t",
    });
    expect(out).toHaveLength(0);
  });
});

describe("chequearIdentidad — bug real: spike de 49,9 Mt en `compras` (trigo INDUSTRIA 2019/20)", () => {
  // Fila real todavía en la base (verificado por SQL 28/07/2026): el acumulado dice 49.913.000 t
  // pero precio_hecho+fijado+saldo suman 4.991.300 t — el acumulado tiene un dígito de más. La
  // matview `compras_avance_hist` ya lo clampea en silencio para que el panel no lo muestre; este
  // chequeo es el que rompe ese silencio.
  it("detecta que el acumulado no coincide con la suma de sus partes", () => {
    const out = chequearIdentidad({
      serie: "compras · trigo · INDUSTRIA · 2019/20",
      fecha: "2021-02-17",
      total: 49_913_000,
      partes: [4_106_800, 871_000, 13_500],
      ...IDENTIDADES.compras,
      unidad: "t",
    });
    expect(out).not.toBeNull();
    expect(out?.severidad).toBe("alta");
    expect(out?.mensaje).toMatch(/parser, no el mercado/);
  });

  it("el mismo total con el dígito de menos (4.991.300) SÍ concilia", () => {
    const out = chequearIdentidad({
      serie: "compras · trigo · INDUSTRIA · 2019/20",
      fecha: "2021-02-17",
      total: 4_991_300,
      partes: [4_106_800, 871_000, 13_500],
      ...IDENTIDADES.compras,
      unidad: "t",
    });
    expect(out).toBeNull();
  });

  it("un desvío chico (redondeo del origen, <2%) no dispara — evita el ruido de compras real 2022-24", () => {
    // Caso real de la base: maíz·EXPORTACION·2022/23 08/2022, partes suman 1,4% más que el total.
    const out = chequearIdentidad({
      serie: "compras · maíz · EXPORTACION · 2022/23",
      fecha: "2022-08-24",
      total: 4_080_600,
      partes: [3_500_000, 500_000, 132_900], // suma 4.132.900 (+1,3%)
      ...IDENTIDADES.compras,
      unidad: "t",
    });
    expect(out).toBeNull();
  });
});

describe("chequearIdentidad — camiones: partes no pueden superar el TOTAL del día", () => {
  // Fila real de `camiones` (verificado por SQL 28/07/2026): Bahía Blanca 06/12/2018, TOTAL=319
  // pero MAIZE+SBS+WHEAT = 733 — casi el doble. Con `partes_menor` (no `igual`): la TOTAL puede
  // incluir productos sin desglosar (documentado en `anomalias-series.ts`), así que sólo se avisa
  // si las partes SUPERAN al total, nunca si quedan por debajo.
  it("detecta que las partes superan el total (imposible)", () => {
    const out = chequearIdentidad({
      serie: "camiones · BAHIA_BLANCA",
      fecha: "2018-12-06",
      total: 319,
      partes: [16, 225, 492], // MAIZE, SBS, WHEAT
      ...IDENTIDADES.camiones,
      unidad: "camiones",
    });
    expect(out).not.toBeNull();
    expect(out?.mensaje).toMatch(/MÁS que el total/);
  });

  it("partes por debajo del total (dato real, otros productos sin desglosar) NO dispara", () => {
    const out = chequearIdentidad({
      serie: "camiones · ROSARIO_ALEDANOS",
      fecha: "2026-01-05",
      total: 2000,
      partes: [500, 600, 700], // suma 1.800 ≤ 2.000
      ...IDENTIDADES.camiones,
      unidad: "camiones",
    });
    expect(out).toBeNull();
  });
});

describe("chequearDuplicados — bug real: fila de trigo 2025/26 del PAS duplicada byte-a-byte de 2024/25", () => {
  // `parse-pas.ts` ya descarta este caso puntual en el momento del parseo (verificado en la sesión
  // de A3/PAS, 23/07/2026); este chequeo generaliza la misma defensa a CUALQUIER fuente que
  // reporte una fila nueva idéntica a otra vieja, sin depender de que cada parser lo prevea.
  it("detecta la copia exacta entre dos campañas distintas", () => {
    const previas = [{ etiqueta: "BCBA trigo 2024/25 (informe 2026-07-15)", fecha: "2026-07-15", firma: "produccion=19.5;rinde=2.87" }];
    const nuevas = [{ etiqueta: "BCBA trigo 2025/26 (informe 2026-07-15)", fecha: "2026-07-15", firma: "produccion=19.5;rinde=2.87" }];
    const out = chequearDuplicados(nuevas, previas);
    expect(out).toHaveLength(1);
    expect(out[0]?.mensaje).toMatch(/repitiendo una fila vieja/);
  });

  it("valores REALMENTE iguales entre campañas consecutivas por casualidad son raros pero se marcan igual (alta, para que un humano confirme)", () => {
    const previas = [{ etiqueta: "X 2024/25", fecha: "d", firma: "a=1" }];
    const nuevas = [{ etiqueta: "X 2025/26", fecha: "d", firma: "a=1" }];
    expect(chequearDuplicados(nuevas, previas)).toHaveLength(1);
  });

  it("NO marca dos filas de la MISMA etiqueta (una campaña comparada consigo misma)", () => {
    const previas = [{ etiqueta: "X 2024/25", fecha: "d1", firma: "a=1" }];
    const nuevas = [{ etiqueta: "X 2024/25", fecha: "d2", firma: "a=1" }];
    expect(chequearDuplicados(nuevas, previas)).toHaveLength(0);
  });

  it("firmas vacías (sin dato) nunca cuentan como duplicado", () => {
    const previas = [{ etiqueta: "X 2024/25", fecha: "d", firma: "" }];
    const nuevas = [{ etiqueta: "X 2025/26", fecha: "d", firma: "" }];
    expect(chequearDuplicados(nuevas, previas)).toHaveLength(0);
  });
});

describe("chequearSerie — orden de magnitud sobre precios (fixture del bug de num() con floats)", () => {
  // El bug de `num()` (20/07/2026) convertía floats con punto decimal ("64099.99") en valores como
  // 6,4e15. Acá se modela el mismo patrón sobre un precio: un ×1e9 es detectado por magnitud
  // (nunca por z-score, que con un outlier de ese tamaño queda destruido si se usara desvío
  // estándar — por eso mediana/MAD).
  const historia: Punto[] = Array.from({ length: 25 }, (_, i) => ({ fecha: `2026-01-${String(i + 1).padStart(2, "0")}`, valor: 340 + i * 0.2 }));

  it("un precio ×1000 (el patrón real del bug — coma decimal leída como separador de miles) se detecta por magnitud", () => {
    const out = chequearSerie({
      serie: "pizarra · soja",
      perfil: PERFILES.precio_diario,
      historia,
      nuevos: [{ fecha: "2026-02-01", valor: 344_800 }],
      rango: SERIES.pizarra_usd.rango,
      minDelta: SERIES.pizarra_usd.minDelta,
      unidad: "USD/tn",
    });
    expect(out.some((a) => a.tipo === "magnitud" && a.severidad === "alta")).toBe(true);
  });

  it("un outlier todavía más extremo (×1e9, el orden real del bug de 6,4e15) queda igual atrapado por el RANGO físico", () => {
    const out = chequearSerie({
      serie: "pizarra · soja",
      perfil: PERFILES.precio_diario,
      historia,
      nuevos: [{ fecha: "2026-02-01", valor: 344.8 * 1_000_000_000 }],
      rango: SERIES.pizarra_usd.rango, // el catálogo real sí fija un máximo (2.000 USD/tn)
      minDelta: SERIES.pizarra_usd.minDelta,
      unidad: "USD/tn",
    });
    expect(out.some((a) => a.tipo === "rango" && a.severidad === "alta")).toBe(true);
  });
});

describe("ventanaEstacional — camiones se comparan contra la MISMA época, no el promedio anual", () => {
  // ±10 días alrededor del 15/marzo de 4 años (2021-2024) + el mismo rango en agosto (valle) — para
  // superar el `minObs: 10` del perfil `conteo_estacional` la ventana de marzo necesita ≥10 puntos.
  const dias = [-10, -5, 0, 5, 10];
  const historia: Punto[] = [];
  for (const anio of [2021, 2022, 2023, 2024]) {
    for (const d of dias) {
      const base = new Date(Date.UTC(anio, 2, 15)); // marzo (cosecha) — valores altos ~4000-4300
      base.setUTCDate(base.getUTCDate() + d);
      historia.push({ fecha: base.toISOString().slice(0, 10), valor: 4000 + anio - 2021 * 1 + d * 2 });
      const valle = new Date(Date.UTC(anio, 7, 15)); // agosto (valle) — valores bajos ~20-30
      valle.setUTCDate(valle.getUTCDate() + d);
      historia.push({ fecha: valle.toISOString().slice(0, 10), valor: 20 + d });
    }
  }

  it("en marzo (cosecha) sólo entran las ventanas de marzo, no las de agosto", () => {
    const ventana = ventanaEstacional(historia, "2025-03-15", 15, 5);
    expect(ventana).toHaveLength(20); // 4 años × 5 puntos de marzo, ninguno de agosto
    expect(Math.min(...ventana.map((p) => p.valor))).toBeGreaterThan(3000);
  });

  it("un valor en línea con la cosecha (no con el valle) NO se marca como anómalo", () => {
    const out = chequearSerie({
      serie: "camiones · ROSARIO_ALEDANOS · TOTAL",
      perfil: PERFILES.conteo_estacional,
      historia: ventanaEstacional(historia, "2025-03-15", 15, 5),
      nuevos: [{ fecha: "2025-03-15", valor: 4150 }],
      minDelta: SERIES.camiones_conteo.minDelta,
    });
    expect(out).toHaveLength(0);
  });

  it("un valor de temporada BAJA (valle) en plena cosecha SÍ se marca — es exactamente lo que la ventana estacional está para agarrar", () => {
    const out = chequearSerie({
      serie: "camiones · ROSARIO_ALEDANOS · TOTAL",
      perfil: PERFILES.conteo_estacional,
      historia: ventanaEstacional(historia, "2025-03-15", 15, 5),
      nuevos: [{ fecha: "2025-03-15", valor: 25 }], // un camión de agosto colado en marzo
      minDelta: SERIES.camiones_conteo.minDelta,
    });
    expect(out.some((a) => a.tipo === "salto")).toBe(true);
  });
});

describe("SERIES / IDENTIDADES — el catálogo referencia perfiles que existen", () => {
  it("todos los `perfil` de SERIES están en PERFILES", () => {
    for (const [nombre, cfg] of Object.entries(SERIES)) {
      expect(PERFILES[cfg.perfil], `serie ${nombre}`).toBeDefined();
    }
  });

  it("los rangos declarados son coherentes (min < max cuando ambos están)", () => {
    for (const [nombre, cfg] of Object.entries(SERIES)) {
      if (cfg.rango?.min != null && cfg.rango?.max != null) {
        expect(cfg.rango.min, nombre).toBeLessThan(cfg.rango.max);
      }
    }
  });
});
