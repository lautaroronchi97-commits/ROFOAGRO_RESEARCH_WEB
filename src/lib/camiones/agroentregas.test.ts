import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAgroentregas, totalDelBloque, type BloqueDia } from "./agroentregas";

/**
 * Fixture = respuesta REAL del endpoint público de Agroentregas capturada el 28/07/2026, sin
 * retocar (sobre XML de WCF incluido). Los números de control salen de la captura de pantalla que
 * Lautaro pasó ese mismo día: GIRASOL 96 · SOJA 1460 · TRIGO 457 · MAIZ 2413 · SORGO 87 ·
 * CEBADA 47 · OTROS 0 → TOTAL 4560 camiones (145.920 tn aprox. a 32 tn/camión).
 */
const FIXTURE = readFileSync(join(__dirname, "__fixtures__/agroentregas-2026-07-28.xml"), "utf8");

function bloque(bloques: BloqueDia[], fecha: string): BloqueDia {
  const b = bloques.find((x) => x.fecha === fecha);
  if (!b) throw new Error(`falta el bloque ${fecha}`);
  return b;
}

describe("parseAgroentregas — respuesta real del 28/07/2026", () => {
  const r = parseAgroentregas(FIXTURE);
  if (!r.ok) throw new Error(`el fixture real no debería fallar: ${r.error}`);

  it("devuelve los 3 bloques: hoy + los dos comparativos interanuales", () => {
    expect(r.bloques.map((b) => b.fecha)).toEqual(["2026-07-28", "2025-07-29", "2024-07-30"]);
    expect(r.bloques.map((b) => b.comparativo)).toEqual([false, true, true]);
  });

  it("los 3 comparativos caen en el mismo día de la semana (martes), no en la misma fecha", () => {
    const dow = r.bloques.map((b) => new Date(`${b.fecha}T00:00:00Z`).getUTCDay());
    expect(new Set(dow).size).toBe(1);
    expect(dow[0]).toBe(2); // martes
  });

  it("el total del día coincide con la placa publicada (4560 camiones, 28 destinos)", () => {
    const hoy = bloque(r.bloques, "2026-07-28");
    expect(hoy.plantas).toBe(28);
    expect(totalDelBloque(hoy)).toBe(4560);
  });

  it("reproduce la apertura por grano de la placa", () => {
    const hoy = bloque(r.bloques, "2026-07-28");
    const porGrano = new Map<string, number>();
    for (const f of hoy.filas) {
      if (f.producto === "TOTAL") continue;
      porGrano.set(f.producto, (porGrano.get(f.producto) ?? 0) + f.cantidad);
    }
    expect(Object.fromEntries(porGrano)).toEqual({
      SFSEED: 96,
      SBS: 1460,
      WHEAT: 457,
      MAIZE: 2413,
      SORGHUM: 87,
      BARLEY: 47,
      // OTROS = 0 ese día → no se persiste ninguna fila (una clave ausente es 0, por diseño)
    });
  });

  it("emite una fila TOTAL por planta, incluso cuando la planta no recibió camiones", () => {
    const hoy = bloque(r.bloques, "2026-07-28");
    const totales = hoy.filas.filter((f) => f.producto === "TOTAL");
    expect(totales).toHaveLength(28);
    const sinCamiones = totales.find((f) => f.planta === "MOLINO CAÑUELAS SA - LAS PALMAS");
    expect(sinCamiones?.cantidad).toBe(0);
    // ...y esa planta no aporta ninguna fila de grano
    expect(hoy.filas.filter((f) => f.planta === "MOLINO CAÑUELAS SA - LAS PALMAS")).toHaveLength(1);
  });

  it("conserva la empresa de cada planta (el dato que no da ninguna otra fuente)", () => {
    const hoy = bloque(r.bloques, "2026-07-28");
    const t6 = hoy.filas.find((f) => f.planta === "TERMINAL 6" && f.producto === "TOTAL");
    expect(t6).toMatchObject({ empresa: "BUNGE ARGENTINA S.A.", cantidad: 440 });
    // idDp viene con padding de espacios en el origen ('4         ') → tiene que llegar limpio
    expect(hoy.filas.every((f) => f.plantaId === f.plantaId.trim() && f.plantaId !== "")).toBe(true);
  });

  it("desglosa una planta multi-grano tal cual la placa (ACA - SAN LORENZO: trigo 50, maíz 96, sorgo 45)", () => {
    const hoy = bloque(r.bloques, "2026-07-28");
    const aca = hoy.filas.filter((f) => f.planta === "ACA - SAN LORENZO");
    expect(Object.fromEntries(aca.map((f) => [f.producto, f.cantidad]))).toEqual({
      WHEAT: 50,
      MAIZE: 96,
      SORGHUM: 45,
      TOTAL: 191,
    });
  });

  it("parsea también los bloques comparativos (27 plantas cada uno)", () => {
    expect(totalDelBloque(bloque(r.bloques, "2025-07-29"))).toBe(2846);
    expect(totalDelBloque(bloque(r.bloques, "2024-07-30"))).toBe(3325);
    expect(bloque(r.bloques, "2025-07-29").plantas).toBe(27);
  });
});

describe("parseAgroentregas — guards", () => {
  it("rechaza un cuerpo que no es la respuesta esperada", () => {
    expect(parseAgroentregas("<html>error 500</html>")).toMatchObject({ ok: false });
    expect(parseAgroentregas("")).toMatchObject({ ok: false });
  });

  it("rechaza la respuesta si falta alguna colección", () => {
    const sinComparativo = FIXTURE.replace(/"Camiones6":\[[\s\S]*?\],/, '"Camiones6":[],');
    const r = parseAgroentregas(sinComparativo);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Camiones6/);
  });

  it("rechaza el día entero si el detalle por planta no cierra contra los totales de la fuente", () => {
    // Se altera UN valor del detalle (ACA - SAN LORENZO: maíz 96 → 95) dejando los totales intactos:
    // es exactamente la clase de corrupción silenciosa que un upsert ciego guardaría como un día flojo.
    const corrupto = FIXTURE.replace('"TRIGO":50,"MAIZ":96', '"TRIGO":50,"MAIZ":95');
    expect(corrupto).not.toBe(FIXTURE); // la sustitución tiene que haber ocurrido
    const r = parseAgroentregas(corrupto);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Inconsistencia en 2026-07-28: MAIZ suma 2412 .* declara 2413/);
  });
});
