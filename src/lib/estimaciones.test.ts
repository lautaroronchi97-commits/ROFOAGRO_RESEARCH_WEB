import { describe, it, expect } from "vitest";
import { construirPizarra, construirCambios, type EstimRow } from "./estimaciones";

// Fixtures: docs/auditoria/E2-formulas-fichas.md, ficha 6.2 (caso real BCR/Argentina/trigo, 12/07).
describe("estimaciones.ts — ficha E2 6.2 (campaniaVigente prefiere la campaña CON producción)", () => {
  it("2026/27 solo tiene área (sin producción) — la pizarra muestra 2025/26 (29,5 Mt), no 2026/27 '—'", () => {
    const rows: EstimRow[] = [
      {
        organismo: "BCR", pais: "argentina", grano: "trigo", campania: "2026/27",
        variable: "area", valor: 6.95, unidad: "Mha", fecha_publicacion: "2026-07-08",
        informe: "GEA mensual #196", url: null, actualizado_en: null,
      },
      {
        organismo: "BCR", pais: "argentina", grano: "trigo", campania: "2025/26",
        variable: "produccion", valor: 29.5, unidad: "Mt", fecha_publicacion: "2026-05-13",
        informe: "GEA mensual #194", url: null, actualizado_en: null,
      },
      {
        organismo: "BCR", pais: "argentina", grano: "trigo", campania: "2025/26",
        variable: "produccion", valor: 29.5, unidad: "Mt", fecha_publicacion: "2026-02-11",
        informe: "GEA mensual #191", url: null, actualizado_en: null,
      },
    ];
    const pizarra = construirPizarra(rows);
    expect(pizarra).toHaveLength(1);
    expect(pizarra[0]!.campania).toBe("2025/26");
    expect(pizarra[0]!.produccion).toBe(29.5);
    expect(pizarra[0]!.deltaProd).toBeCloseTo(0, 6); // último vintage sin cambio (29,5 -> 29,5)
    expect(pizarra[0]!.fecha).toBe("2026-05-13"); // el vintage MÁS RECIENTE con producción
  });

  it("delta vs el vintage anterior de la MISMA campaña: 27,7 -> 29,5 da +1,80", () => {
    const rows: EstimRow[] = [
      {
        organismo: "BCR", pais: "argentina", grano: "trigo", campania: "2025/26",
        variable: "produccion", valor: 29.5, unidad: "Mt", fecha_publicacion: "2026-05-13",
        informe: "GEA mensual #194", url: null, actualizado_en: null,
      },
      {
        organismo: "BCR", pais: "argentina", grano: "trigo", campania: "2025/26",
        variable: "produccion", valor: 27.7, unidad: "Mt", fecha_publicacion: "2026-02-11",
        informe: "GEA mensual #191", url: null, actualizado_en: null,
      },
    ];
    const pizarra = construirPizarra(rows);
    expect(pizarra[0]!.deltaProd).toBeCloseTo(1.8, 6);
  });
});

// V2 (PLAN_INFORMES_V2.md §6.2, fix de auditoría crítico): el disparo del Paso 9 de
// informe-diario no puede depender solo de `fecha_publicacion` — BCBA-PAS se carga con la
// fecha REAL del informe (puede ser de días atrás), nunca "hoy" el día que Lautaro lo sube.
describe("construirCambios — expone actualizadoEn para el fix del disparo de BCBA-PAS", () => {
  it("actualizadoEn refleja cuándo se cargó a la base, distinto de la fecha_publicacion del informe", () => {
    const rows: EstimRow[] = [
      {
        organismo: "BCBA", pais: "argentina", grano: "soja", campania: "2025/26",
        variable: "produccion", valor: 50.3, unidad: "Mt", fecha_publicacion: "2026-07-25",
        informe: "PAS semanal", url: null, actualizado_en: "2026-07-28T14:00:00+00:00",
      },
      {
        organismo: "BCBA", pais: "argentina", grano: "soja", campania: "2025/26",
        variable: "produccion", valor: 50.0, unidad: "Mt", fecha_publicacion: "2026-07-18",
        informe: "PAS semanal", url: null, actualizado_en: "2026-07-21T14:00:00+00:00",
      },
    ];
    const cambio = construirCambios(rows, "BCBA");
    // El informe es del 25/07 (fecha_publicacion), pero se cargó a la base el 28/07
    // (actualizado_en) — el filtro de la ruta usa cualquiera de las dos para disparar.
    expect(cambio.fecha).toBe("2026-07-25");
    expect(cambio.actualizadoEn).toBe("2026-07-28T14:00:00+00:00");
    expect(cambio.cambios).toHaveLength(1);
    expect(cambio.cambios[0]!.delta).toBeCloseTo(0.3, 6);
  });

  it("actualizadoEn null si la fila no la trae (compatibilidad hacia atrás)", () => {
    const rows: EstimRow[] = [
      {
        organismo: "USDA", pais: "mundo", grano: "maiz", campania: "2026/27",
        variable: "produccion", valor: 1200, unidad: "Mt", fecha_publicacion: "2026-07-10",
        informe: "WASDE #673", url: null, actualizado_en: null,
      },
    ];
    expect(construirCambios(rows, "USDA").actualizadoEn).toBeNull();
  });
});
