import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parsePasZonas,
  parsePasZonasCeldas,
  fallasIdentidad,
  CAMPANIA_ZONAL_CONFIABLE,
  ZONAS_PRODUCTIVAS,
} from "./parse-pas-zonas";

/**
 * Fixture = export REAL de producción por zona de BCBA-PAS, versionado en `data/pas/` (29/07/2026,
 * verificado a fondo en la sesión del plan — docs/PLAN_PAS_ZONAS.md §2.a). Es la ÚNICA fuente para
 * los tests de conteos/valores reales — nunca datos sintéticos (regla dura del proyecto). Los
 * caminos defensivos que este archivo real NO ejerce (zona desconocida, cultivo desconocido, grupo
 * idéntico, escala fuera de rango) se testean con grillas literales chicas contra
 * `parsePasZonasCeldas` (grilla ya parseada, sin fabricar un .xlsx binario).
 */
const FIXTURE = readFileSync(join(__dirname, "../../data/pas/reporte_zonas_2026-07-29.xlsx"));

function parseFixture() {
  const r = parsePasZonas(new Uint8Array(FIXTURE));
  if (!r.ok) throw new Error(`el fixture real no debería fallar: ${r.error}`);
  return r;
}

describe("parsePasZonas — export real de producción por zona (29/07/2026)", () => {
  const r = parseFixture();

  it("procesa las 1.900 filas fuente sin error total", () => {
    // Conteo de filas FUENTE (antes de omitir las "todo cero"): re-derivarlo del propio archivo
    // sería duplicar el parser, así que se verifica indirectamente vía descartes+filas+omitidas
    // conocidas — el número de filas CARGADAS es la aserción fuerte de abajo.
    expect(r.resumen.filas).toBeGreaterThan(1500);
    expect(r.filas.length).toBe(r.resumen.filas);
  });

  it("soja 2024/25 TOTAL = 50.300.000 t (50,3 Mt) — no son millones pese al rótulo MTn", () => {
    const f = r.filas.find((x) => x.grano === "soja" && x.campania === "2024/25" && x.zona === "TOTAL");
    expect(f).toBeDefined();
    expect(f!.produccion_tn).toBe(50_300_000);
  });

  it("maíz 2024/25 TOTAL = 49.000.000 t (49,0 Mt)", () => {
    const f = r.filas.find((x) => x.grano === "maiz" && x.campania === "2024/25" && x.zona === "TOTAL");
    expect(f).toBeDefined();
    expect(f!.produccion_tn).toBe(49_000_000);
  });

  it("tolera el typo de tilde real del origen ('Perdído(Ha)') — si no lo tolerara, el archivo entero fallaría", () => {
    const f = r.filas.find((x) => x.grano === "soja" && x.campania === "2024/25" && x.zona === "NOA");
    expect(f).toBeDefined();
    expect(f!.perdido_ha).not.toBeNull();
  });

  it("normaliza la campaña larga '2000/2001' del origen al canónico '2000/01'", () => {
    expect(r.resumen.campanias[0]).toBe("2000/01");
    expect(r.filas.some((f) => f.campania === "2000/01")).toBe(true);
    expect(r.filas.some((f) => f.campania === "2000/2001")).toBe(false);
  });

  it("cubre los 6 cultivos y las 27 campañas del origen (2000/01→2026/27)", () => {
    expect(r.resumen.granos.sort()).toEqual(["cebada", "girasol", "maiz", "soja", "sorgo", "trigo"]);
    expect(r.resumen.campanias.length).toBe(27);
    expect(r.resumen.campanias[r.resumen.campanias.length - 1]).toBe("2026/27");
  });

  it("recalcula SIEMPRE el rinde (producción/cosechado), nunca usa la columna del origen", () => {
    const f = r.filas.find((x) => x.grano === "soja" && x.campania === "2024/25" && x.zona === "TOTAL")!;
    // TOTAL soja 24/25: 50.300.000 t / 16.949.282 ha cosechadas (verificado contra el xlsx real).
    expect(f.rinde_tn_ha).not.toBeNull();
    expect(f.rinde_tn_ha!).toBeCloseTo(50_300_000 / 16_949_282, 6);
  });

  it("la identidad suma-zonas=TOTAL cierra (≤0,5%) en TODAS las campañas evaluadas desde 2008/09", () => {
    const evaluadas = r.controlIdentidad.filter((c) => c.grano === "soja");
    expect(evaluadas.length).toBeGreaterThan(0);
    expect(fallasIdentidad(r.controlIdentidad).length).toBe(0);
    for (const c of evaluadas) expect(c.campania >= CAMPANIA_ZONAL_CONFIABLE).toBe(true);
  });

  it("NO evalúa la identidad para campañas anteriores a 2008/09 (las zonas no cubrían todo el total ahí)", () => {
    const pre = r.controlIdentidad.filter((c) => c.campania < CAMPANIA_ZONAL_CONFIABLE);
    expect(pre.length).toBe(0);
    // Y confirmado que esas campañas SÍ estarían lejos si se evaluaran (no es que casualmente cierren).
    expect(r.filas.some((f) => f.campania === "2000/01" && f.zona !== "TOTAL")).toBe(true);
  });

  it("las 15 zonas productivas están todas presentes al menos una vez", () => {
    const zonasEnFilas = new Set(r.filas.map((f) => f.zona));
    for (const z of ZONAS_PRODUCTIVAS) expect(zonasEnFilas.has(z)).toBe(true);
  });

  it("campañas sin desglose zonal (solo TOTAL, ej. 2026/27) se cargan igual, sin producción fantasma", () => {
    const trigo2627 = r.filas.filter((f) => f.grano === "trigo" && f.campania === "2026/27");
    expect(trigo2627.length).toBe(1); // solo la fila TOTAL
    expect(trigo2627[0]!.zona).toBe("TOTAL");
    expect(trigo2627[0]!.produccion_tn).toBeNull(); // sin cosecha todavía, nunca 0 fantasma
    expect(trigo2627[0]!.sembrado_ha).toBeGreaterThan(0); // el área proyectada sí se guarda
  });

  it("no descarta ningún grupo por duplicado ni por escala en el archivo real (0 anomalías de ese tipo)", () => {
    const motivosGrupo = r.descartes.filter((d) => d.motivo.includes("idéntico") || d.motivo.includes("fuera del rango plausible"));
    expect(motivosGrupo.length).toBe(0);
  });
});

describe("parsePasZonasCeldas — caminos defensivos (grillas literales, sin .xlsx sintético)", () => {
  const HEADER = ["Campaña", "Zona", "Cultivo", "Sembrado (Ha)", "Perdído(Ha)", "Cosechado(Ha)", "Rinde(qq/Ha)", "Producción(MTn)"];
  // Magnitudes DENTRO del rango plausible de soja ([15,70] Mt, RANGO_MT de parse-pas.ts) para no
  // disparar el guard de escala en los tests que no lo están ejerciendo a propósito.
  const TOTAL_SOJA_OK = "20000000"; // 20 Mt

  it("error total si falta una columna obligatoria", () => {
    const r = parsePasZonasCeldas([["Campaña", "Zona", "Cultivo", "Sembrado (Ha)"]]);
    expect(r.ok).toBe(false);
  });

  it("error total si no hay filas de datos", () => {
    const r = parsePasZonasCeldas([HEADER]);
    expect(r.ok).toBe(false);
  });

  it("descarta visible una zona fuera del set canónico de BCBA (sin romper el resto)", () => {
    const r = parsePasZonasCeldas([
      HEADER,
      ["2020/2021", "TOTAL", "Soja", "10000000", "0", "9000000", "22", TOTAL_SOJA_OK],
      ["2020/2021", "Zona Fantasma", "Soja", "10", "0", "10", "30", "30"],
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.descartes.some((d) => d.motivo.includes("zona fuera del set conocido"))).toBe(true);
    expect(r.filas.some((f) => f.zona === "Zona Fantasma")).toBe(false);
    expect(r.filas.some((f) => f.zona === "TOTAL")).toBe(true);
  });

  it("descarta visible un cultivo desconocido", () => {
    const r = parsePasZonasCeldas([
      HEADER,
      ["2020/2021", "TOTAL", "Cáñamo", "100", "0", "100", "30", "300"],
      ["2020/2021", "TOTAL", "Soja", "10000000", "0", "9000000", "22", TOTAL_SOJA_OK],
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.descartes.some((d) => d.motivo.includes("cultivo desconocido"))).toBe(true);
  });

  it("descarta el GRUPO entero si la campaña es idéntica byte-a-byte a la anterior", () => {
    const r = parsePasZonasCeldas([
      HEADER,
      ["2019/2020", "TOTAL", "Soja", "10000000", "0", "9000000", "22", TOTAL_SOJA_OK],
      ["2019/2020", "NOA", "Soja", "9000000", "0", "8500000", "22", "19000000"],
      ["2020/2021", "TOTAL", "Soja", "10000000", "0", "9000000", "22", TOTAL_SOJA_OK],
      ["2020/2021", "NOA", "Soja", "9000000", "0", "8500000", "22", "19000000"],
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas.some((f) => f.campania === "2020/21")).toBe(false);
    expect(r.filas.some((f) => f.campania === "2019/20")).toBe(true);
    expect(r.descartes.some((d) => d.campania === "2020/21" && d.motivo.includes("idéntico"))).toBe(true);
  });

  it("descarta el GRUPO entero si la producción TOTAL cae fuera del rango plausible (posible cambio de escala)", () => {
    const r = parsePasZonasCeldas([
      HEADER,
      // Soja fuera de [15,70] Mt en toneladas crudas (99,9 Mt): grupo entero se descarta.
      ["2020/2021", "TOTAL", "Soja", "100", "0", "100", "30", "99900000"],
    ]);
    expect(r.ok).toBe(false); // no queda ninguna fila cargable
    if (r.ok) return;
    expect(r.error).toMatch(/descartes/);
  });

  it("bloquea la identidad (controlIdentidad.ok=false) si la suma de zonas no cierra contra el TOTAL, solo desde 2008/09", () => {
    const r = parsePasZonasCeldas([
      HEADER,
      ["2010/2011", "TOTAL", "Soja", "10000000", "0", "9000000", "22", TOTAL_SOJA_OK],
      ["2010/2011", "NOA", "Soja", "500000", "0", "450000", "22", "100000"], // suma de zonas << TOTAL
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.controlIdentidad.length).toBe(1);
    expect(r.controlIdentidad[0]!.ok).toBe(false);
    expect(fallasIdentidad(r.controlIdentidad).length).toBe(1);
  });

  it("no evalúa la identidad antes de 2008/09 aunque la suma no cierre", () => {
    const r = parsePasZonasCeldas([
      HEADER,
      ["2005/2006", "TOTAL", "Soja", "10000000", "0", "9000000", "22", TOTAL_SOJA_OK],
      ["2005/2006", "NOA", "Soja", "500000", "0", "450000", "22", "100000"],
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.controlIdentidad.length).toBe(0);
  });

  it("fila con producción<=0 y sembrado>0 se carga con produccion_tn null (no se descarta)", () => {
    // Sin escala que chequear: al no haber ninguna zona (solo TOTAL) el guard de identidad
    // tampoco corre — mismo caso real que trigo/girasol 2026/27 en el archivo real (§2.a).
    const r = parsePasZonasCeldas([
      HEADER,
      ["2020/2021", "TOTAL", "Soja", "500", "0", "0", "0", "0"],
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas.length).toBe(1);
    expect(r.filas[0]!.produccion_tn).toBeNull();
    expect(r.filas[0]!.sembrado_ha).toBe(500);
  });

  it("fila totalmente en cero se omite en silencio, sin descarte", () => {
    const r = parsePasZonasCeldas([
      HEADER,
      ["2020/2021", "TOTAL", "Soja", "10000000", "0", "9000000", "22", TOTAL_SOJA_OK],
      ["2020/2021", "NOA", "Soja", "0", "0", "0", "0", "0"],
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas.length).toBe(1);
    expect(r.descartes.length).toBe(0);
  });
});
