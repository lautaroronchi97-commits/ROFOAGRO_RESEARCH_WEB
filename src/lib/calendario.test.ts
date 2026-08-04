import { describe, it, expect } from "vitest";
import { getEventos, CONAB_FECHAS } from "./calendario";

// Fixtures: docs/auditoria/E2-formulas-fichas.md, ficha 6.3 (conversiones TZ + corrimiento por feriado).
describe("calendario.ts — ficha E2 6.3", () => {
  it("WASDE 12/08/2026: 12:00 EDT -> 13:00 AR (agosto, con horario de verano EEUU)", () => {
    const eventos = getEventos("2026-08-12", "2026-08-12");
    const wasde = eventos.find((e) => e.informe === "WASDE + Crop Production");
    expect(wasde?.fechaISO).toBe("2026-08-12");
    expect(wasde?.horaArg).toBe("13:00");
  });

  it("WASDE 10/12/2026: 12:00 EST -> 14:00 AR (diciembre, sin horario de verano EEUU)", () => {
    const eventos = getEventos("2026-12-10", "2026-12-10");
    const wasde = eventos.find((e) => e.informe === "WASDE + Crop Production");
    expect(wasde?.fechaISO).toBe("2026-12-10");
    expect(wasde?.horaArg).toBe("14:00");
  });

  it("CONAB: 09:00 Brasília = 09:00 AR (Brasil sin DST desde 2019)", () => {
    const eventos = getEventos("2026-07-14", "2026-07-14");
    const conab = eventos.find((e) => e.organismo === "CONAB" && e.informe.includes("Levantamento"));
    expect(conab?.horaArg).toBe("09:00");
  });

  it("PAS (BCBA): jueves 15:00 AR, regla semanal", () => {
    const eventos = getEventos("2026-07-23", "2026-07-23"); // jueves
    const pas = eventos.find((e) => e.organismo === "BCBA");
    expect(pas?.horaArg).toBe("15:00");
    expect(pas?.fechaISO).toBe("2026-07-23");
  });

  it("nEsimoDiaDeSemana: 2do miércoles de agosto 2026 = 12/08 (coincide con el plan)", () => {
    const eventos = getEventos("2026-08-01", "2026-08-31");
    const geaMensual = eventos.find((e) => e.informe === "Estimación Mensual Nacional (GEA)");
    expect(geaMensual?.fechaISO).toBe("2026-08-12");
  });

  it("GEA semanal se ADELANTA al hábil anterior si el jueves es feriado (09/07/2026)", () => {
    // Semana del feriado 09/07/2026 (jueves, Día de la Independencia): el GEA semanal
    // corre al miércoles 08/07 en vez del jueves — verificado contra el GEA real
    // fechado 2026-07-08 "GEA mensual #196" en estimaciones_produccion (auditoría E2).
    const eventos = getEventos("2026-07-06", "2026-07-10");
    const gea = eventos.find((e) => e.informe === "Informe Semanal Zona Núcleo (GEA)");
    expect(gea?.fechaISO).toBe("2026-07-08");
  });

  it("una semana SIN feriado: el GEA semanal queda en el jueves normal", () => {
    const eventos = getEventos("2026-07-20", "2026-07-24"); // semana del 23/07, sin feriado
    const gea = eventos.find((e) => e.informe === "Informe Semanal Zona Núcleo (GEA)");
    expect(gea?.fechaISO).toBe("2026-07-23");
  });

  it("rango vacío -> sin eventos oficiales de esa fecha", () => {
    const eventos = getEventos("2020-01-01", "2020-01-01");
    expect(eventos.find((e) => e.informe === "WASDE + Crop Production")).toBeUndefined();
  });

  // L6 (auditoría E7 §6): WASDE/Grain Stocks/Crop Progress ahora salen del ICS de NASS
  // (calendario-seed-nass.json), no de arrays hardcodeados. Estas fichas fijan el contrato.
  it("NASS (seed generado): trae el WASDE de julio, que el array a mano nunca tuvo (solo 'restantes')", () => {
    // El seed viejo (WASDE_2026 hardcodeado) arrancaba en agosto porque se escribió a mitad de año
    // — el ICS real SÍ tiene el WASDE del 10/07/2026, y el generador lo trae sin filtrar por "hoy".
    const eventos = getEventos("2026-07-10", "2026-07-10");
    const wasde = eventos.find((e) => e.informe === "WASDE + Crop Production");
    expect(wasde?.fechaISO).toBe("2026-07-10");
  });

  it("NASS (seed generado): Grain Stocks trimestral completo (no solo el de septiembre)", () => {
    const marzo = getEventos("2026-03-31", "2026-03-31");
    expect(marzo.find((e) => e.informe === "Grain Stocks + Small Grains Summary")?.fechaISO).toBe(
      "2026-03-31",
    );
  });

  it("sin seed para un año (ej. 2027, NASS todavía no lo publicó) -> degrada sin romper, sin eventos NASS", () => {
    const eventos = getEventos("2027-01-01", "2027-01-31");
    // Export Sales es organismo USDA pero "regla" (jueves fijo, no depende del seed de NASS) —
    // el que sí tiene que faltar es lo que SÍ sale del ICS (tipo "oficial").
    expect(eventos.find((e) => e.organismo === "USDA" && e.tipo === "oficial")).toBeUndefined();
  });

  // E2 (docs/PLAN_INFORMES_V3.md §8.2): USDA Export Sales + NOPA + centinela CONAB.
  it("USDA Export Sales: jueves 8:30 ET -> 9:30 AR en julio (EDT, con horario de verano EEUU)", () => {
    const eventos = getEventos("2026-07-20", "2026-07-24"); // semana del jueves 23/07
    const es = eventos.find((e) => e.informe.includes("Export Sales"));
    expect(es?.fechaISO).toBe("2026-07-23");
    expect(es?.horaArg).toBe("09:30");
  });

  it("USDA Export Sales: 8:30 ET -> 10:30 AR en diciembre (EST, sin horario de verano)", () => {
    const eventos = getEventos("2026-12-07", "2026-12-11"); // semana del jueves 10/12
    const es = eventos.find((e) => e.informe.includes("Export Sales"));
    expect(es?.fechaISO).toBe("2026-12-10");
    expect(es?.horaArg).toBe("10:30");
  });

  it("NOPA Crush Report: 15/08/2026 cae sábado -> se corre al viernes 14/08", () => {
    const eventos = getEventos("2026-08-01", "2026-08-31");
    const nopa = eventos.find((e) => e.organismo === "NOPA");
    expect(nopa?.fechaISO).toBe("2026-08-14");
    expect(nopa?.horaArg).toBe("13:00"); // 12:00 ET EDT -> 13:00 AR
  });

  it("NOPA Crush Report: 15/09/2026 cae martes -> queda en el día 15 exacto", () => {
    const eventos = getEventos("2026-09-01", "2026-09-30");
    const nopa = eventos.find((e) => e.organismo === "NOPA");
    expect(nopa?.fechaISO).toBe("2026-09-15");
  });

  it("CONAB_FECHAS tiene cargado el año siguiente (obligatorio desde noviembre, mismo patrón que FERIADOS_AR)", () => {
    // CONAB publica su calendario boletín a boletín, sin ICS máquina-legible (a diferencia de NASS) —
    // el centinela avisa (falla en CI) cuando se necesita cargar el año siguiente a mano, en vez de
    // quedar en silencio con un calendario incompleto desde enero (mismo criterio que habiles.test.ts).
    const hoy = new Date();
    const esDesdeNoviembre = hoy.getUTCMonth() >= 10; // 10 = noviembre
    const anioProximo = hoy.getUTCFullYear() + 1;
    const tieneProximo = Object.keys(CONAB_FECHAS).includes(String(anioProximo));
    if (esDesdeNoviembre) expect(tieneProximo).toBe(true);
    else expect(true).toBe(true); // antes de noviembre no exige nada
  });
});
