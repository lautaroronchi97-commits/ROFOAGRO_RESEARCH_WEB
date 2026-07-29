import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePasCondicion, parsePasCondicionCeldas } from "./parse-pas-condicion";

/**
 * Fixtures = los 4 exports REALES de condición de cultivos de BCBA-PAS, versionados en
 * `data/pas/` (29/07/2026, verificados a fondo en la sesión del plan — docs/PLAN_PAS_ZONAS.md
 * §2.b). Son la ÚNICA fuente para los tests de conteos/etapas/valores reales — nunca datos
 * sintéticos (regla dura del proyecto). Los caminos defensivos que estos 4 archivos NO ejercen
 * (cultivo desconocido, semana fuera de rango, bloque CC/CH que no cierra, PK duplicada,
 * zona≠TOTAL) se testean con grillas literales chicas contra `parsePasCondicionCeldas`.
 */
function leer(nombre: string) {
  return readFileSync(join(__dirname, "../../data/pas", nombre));
}

function parseArchivo(nombre: string) {
  const r = parsePasCondicion(new Uint8Array(leer(nombre)));
  if (!r.ok) throw new Error(`el fixture real no debería fallar (${nombre}): ${r.error}`);
  return r;
}

describe("parsePasCondicion — export real de girasol (250 filas, sin ciclos)", () => {
  const r = parseArchivo("reporte_condicion_girasol_2026-07-29.xlsx");

  it("carga las 250 filas fuente", () => {
    expect(r.resumen.filas).toBe(250);
    expect(r.filas.length).toBe(250);
  });

  it("un solo cultivo/ciclo: girasol, total", () => {
    expect(r.resumen.grano).toBe("girasol");
    expect(r.resumen.ciclos).toEqual(["total"]);
  });

  it("detecta las 6 etapas de fenología propias de girasol, en orden, del header", () => {
    expect(r.etapasPorCultivo["girasol"]).toEqual([
      "Expansión Foliar", "Botón Floral", "Floración", "Llenado de grano", "Madurez Fisiológica", "Cosecha",
    ]);
  });

  it("cubre 2020/21→2025/26, zona TOTAL, sin novedades de zona", () => {
    expect(r.resumen.campanias[0]).toBe("2020/21");
    expect(r.resumen.campanias.at(-1)).toBe("2025/26");
    expect(r.filas.every((f) => f.zona === "TOTAL")).toBe(true);
    expect(r.zonasNuevas).toEqual([]);
  });

  it("una fila real: semana 7 de 2025/26 con sus bloques CC/CH y fenología numérica", () => {
    const f = r.filas.find((x) => x.campania === "2025/26" && x.semana === 7);
    expect(f).toBeDefined();
    expect(f!.cc_buena).toBeCloseTo(37.29308468, 4);
    expect(f!.ch_regular).toBeCloseTo(41.73906156, 4);
    expect(f!.fenologia.find((e) => e.etapa === "Cosecha")?.pct).toBeCloseTo(29.8647211, 4);
  });

  it("descarta las 4 anomalías reales de bloque (semana 19 de 2024/25 y 33/34 de 2022/23) — aisladas, lejos de la masa 96-102%", () => {
    const bloque = r.descartes.filter((d) => d.motivo.includes("bloque"));
    expect(bloque.length).toBe(4);
    expect(bloque.every((d) => d.campania === "2024/25" || d.campania === "2022/23")).toBe(true);
  });
});

describe("parsePasCondicion — export real de soja (566 filas fuente, ciclos Soja/Soja1/Soja2)", () => {
  const r = parseArchivo("reporte_condicion_soja_2026-07-29.xlsx");

  it("560 filas cargadas: el origen trae 6 PK duplicadas (misma semana con 2 versiones), gana la última", () => {
    expect(r.filas.length).toBe(560);
    const dupPk = r.descartes.filter((d) => d.motivo.includes("PK duplicada"));
    expect(dupPk.length).toBe(6);
  });

  it("desdobla en total/1ra/2da, todo bajo grano=soja", () => {
    expect(r.resumen.grano).toBe("soja");
    expect(r.resumen.ciclos.sort()).toEqual(["1ra", "2da", "total"]);
    expect(new Set(r.filas.map((f) => f.grano))).toEqual(new Set(["soja"]));
  });

  it("etapas de fenología propias de soja (distintas de girasol)", () => {
    expect(r.etapasPorCultivo["soja"]).toEqual([
      "Expansión Foliar", "Comienzo de Floración", "Comienzo de Fructificación", "Comienzo de Llenado", "Comienzo de Madurez", "Cosecha",
    ]);
  });

  it("Soja1 semana 26 de 2025/26 (fixture real) queda con ciclo 1ra", () => {
    const f = r.filas.find((x) => x.ciclo === "1ra" && x.campania === "2025/26" && x.semana === 26);
    expect(f).toBeDefined();
    expect(f!.cc_normal).toBeCloseTo(57, 4);
    expect(f!.cc_buena).toBeCloseTo(16, 4);
    expect(f!.siembra_pct).toBe(0);
  });
});

describe("parsePasCondicion — export real de maíz (729 filas fuente, ciclos Maiz/Maiz1/Maiz2)", () => {
  const r = parseArchivo("reporte_condicion_maiz_2026-07-29.xlsx");

  it("727 filas cargadas: 2 filas de Maiz1/Maiz2 2024/25 traen Semana vacía en el origen, se descartan", () => {
    expect(r.filas.length).toBe(727);
    expect(r.descartes.filter((d) => d.motivo.includes("semana fuera de rango")).length).toBe(2);
  });

  it("etapas de fenología propias de maíz", () => {
    expect(r.etapasPorCultivo["maiz"]).toEqual([
      "Expansión Foliar", "Panojamiento", "Floración Femenina", "Grano Pastoso", "Madurez Fisiológica", "Cosecha",
    ]);
  });

  it("descarta las 2 anomalías reales de bloque (Maiz2 2da, 2024/25 semana 36, sum=54%)", () => {
    const bloque = r.descartes.filter((d) => d.motivo.includes("bloque"));
    expect(bloque.length).toBe(2);
    expect(bloque.every((d) => d.semana === 36 && d.campania === "2024/25")).toBe(true);
  });

  it("semanas pre-emergencia con bloques en null, sin descarte (todo 0 es normal)", () => {
    const preEmergencia = r.filas.filter((f) => f.cc_mala == null && f.cc_regular == null && f.cc_normal == null && f.cc_buena == null && f.cc_excelente == null);
    expect(preEmergencia.length).toBeGreaterThan(0);
  });
});

describe("parsePasCondicion — export real de trigo (335 filas, sin ciclos, campaña EN CURSO 2026/27)", () => {
  const r = parseArchivo("reporte_condicion_trigo_2026-07-29.xlsx");

  it("carga las 335 filas fuente, sin descartes (el único de los 4 sin ninguna anomalía)", () => {
    expect(r.filas.length).toBe(335);
    expect(r.descartes.length).toBe(0);
  });

  it("acepta semana 0 (no todos los archivos arrancan en 1 — trigo sí trae una semana 0 real)", () => {
    expect(r.filas.some((f) => f.semana === 0)).toBe(true);
  });

  it("sin ciclos: un solo valor 'total'", () => {
    expect(r.resumen.ciclos).toEqual(["total"]);
  });

  it("etapas de fenología propias de trigo (macollaje/encañazón/espigazón)", () => {
    expect(r.etapasPorCultivo["trigo"]).toEqual([
      "Macollaje", "Encañazón", "Espigazón", "Grano Pastoso", "Madurez Fisiológica", "Cosecha",
    ]);
  });

  it("incluye la campaña EN CURSO 2026/27 con semanas parciales, sin romper el resto del archivo", () => {
    expect(r.resumen.campanias.at(-1)).toBe("2026/27");
    const enCurso = r.filas.filter((f) => f.campania === "2026/27");
    expect(enCurso.length).toBeGreaterThan(0);
    expect(enCurso.length).toBeLessThan(53); // parcial, no la campaña completa
  });

  it("cubre desde 2018/19 (el más largo de los 4 cultivos)", () => {
    expect(r.resumen.campanias[0]).toBe("2018/19");
  });
});

describe("parsePasCondicionCeldas — caminos defensivos (grillas literales, sin .xlsx sintético)", () => {
  const FENOLOGIA = ["Macollaje(%)", "Encañazón(%)", "Espigazón(%)", "Grano Pastoso(%)", "Madurez Fisiológica(%)", "Cosecha(%)"];
  const HEADER = [
    "Cultivo", "Zona", "Campaña", "Semana", "Siembra",
    "CC_Mala(%)", "CC_Regular(%)", "CC_Normal(%)", "CC_Buena(%)", "CC_Excelente(%)",
    "CH_Sequía(%)", "CH_Regular(%)", "CH_Adecuada(%)", "CH_Óptima(%)", "CH_Exceso(%)",
    ...FENOLOGIA,
  ];
  // Fila balanceada de referencia: CC suma 100, CH suma 100.
  const FILA_OK = ["Trigo", "TOTAL", "2025/26", "10", "90", "0", "10", "30", "40", "20", "0", "5", "25", "60", "10", "0", "0", "0", "0", "0", "0"];

  it("error total si falta una columna fija obligatoria", () => {
    const r = parsePasCondicionCeldas([["Cultivo", "Zona", "Campaña", "Semana"]]);
    expect(r.ok).toBe(false);
  });

  it("error total si no hay columnas de fenología (todo lo demás mapeó a fijas)", () => {
    const r = parsePasCondicionCeldas([HEADER.slice(0, 15), FILA_OK.slice(0, 15)]);
    expect(r.ok).toBe(false);
  });

  it("error total si no hay filas de datos", () => {
    const r = parsePasCondicionCeldas([HEADER]);
    expect(r.ok).toBe(false);
  });

  it("lee las etapas de fenología dinámicamente, tal cual y en orden del header", () => {
    const r = parsePasCondicionCeldas([HEADER, FILA_OK]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.etapasPorCultivo["trigo"]).toEqual(["Macollaje", "Encañazón", "Espigazón", "Grano Pastoso", "Madurez Fisiológica", "Cosecha"]);
  });

  it("descarta visible un cultivo desconocido (sin dejar hueco para cebada/sorgo)", () => {
    const r = parsePasCondicionCeldas([
      HEADER,
      ["Cebada", "TOTAL", "2025/26", "10", "90", "0", "10", "30", "40", "20", "0", "5", "25", "60", "10", "0", "0", "0", "0", "0", "0"],
      FILA_OK,
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.descartes.some((d) => d.motivo.includes("cultivo desconocido") && d.grano === "Cebada")).toBe(true);
    expect(r.filas.some((f) => f.grano === "cebada")).toBe(false);
  });

  it("descarta visible una semana fuera de [0,53]", () => {
    const fuera = [...FILA_OK];
    fuera[3] = "54";
    const r = parsePasCondicionCeldas([HEADER, FILA_OK, fuera]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.descartes.some((d) => d.motivo.includes("semana fuera de rango"))).toBe(true);
    expect(r.filas.some((f) => f.semana === 54)).toBe(false);
  });

  it("acepta semana 0 (límite inferior real)", () => {
    const semana0 = [...FILA_OK];
    semana0[3] = "0";
    const r = parsePasCondicionCeldas([HEADER, semana0]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas[0]!.semana).toBe(0);
  });

  it("bloque CC/CH todo en cero → fila con esos bloques null, SIN descarte (pre-emergencia)", () => {
    const preEmergencia = [...FILA_OK];
    for (const i of [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) preEmergencia[i] = "0";
    const r = parsePasCondicionCeldas([HEADER, preEmergencia]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas[0]!.cc_mala).toBeNull();
    expect(r.filas[0]!.ch_sequia).toBeNull();
    expect(r.descartes.length).toBe(0);
  });

  it("bloque CC con algún valor pero suma fuera de [90,110] → bloque null + descarte visible", () => {
    const rota = [...FILA_OK];
    rota[8] = "5"; // CC_Buena 40→5: CC ahora suma 65 (bien lejos de la masa 90-110)
    const r = parsePasCondicionCeldas([HEADER, rota]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas[0]!.cc_buena).toBeNull();
    expect(r.filas[0]!.cc_mala).toBeNull();
    expect(r.descartes.some((d) => d.motivo.includes("bloque CC"))).toBe(true);
    // el bloque CH (no tocado) sigue cargado normal
    expect(r.filas[0]!.ch_optima).toBe(60);
  });

  it("zona ≠ TOTAL se carga igual pero se lista como novedad", () => {
    const otraZona = [...FILA_OK];
    otraZona[1] = "Núcleo Norte";
    const r = parsePasCondicionCeldas([HEADER, FILA_OK, otraZona]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas.some((f) => f.zona === "Núcleo Norte")).toBe(true);
    expect(r.zonasNuevas).toEqual(["Núcleo Norte"]);
  });

  it("PK duplicada dentro del archivo: gana la última + descarte visible", () => {
    const otraVersion = [...FILA_OK];
    otraVersion[8] = "35"; // CC_Buena distinto, misma PK (mismo grano/ciclo/zona/campaña/semana)
    otraVersion[9] = "25"; // ajustar CC_Excelente para que la suma siga cerrando (30+35+25+10=100 con Mala 0/Regular 10)
    const r = parsePasCondicionCeldas([HEADER, FILA_OK, otraVersion]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const trigoFilas = r.filas.filter((f) => f.grano === "trigo" && f.semana === 10);
    expect(trigoFilas.length).toBe(1);
    expect(trigoFilas[0]!.cc_buena).toBe(35); // gana la última
    expect(r.descartes.some((d) => d.motivo.includes("PK duplicada"))).toBe(true);
  });

  it("nunca inventa una fecha calendario a partir de Semana (no hay ese campo en el resultado)", () => {
    const r = parsePasCondicionCeldas([HEADER, FILA_OK]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.filas[0]!)).not.toContain("fecha");
  });
});
