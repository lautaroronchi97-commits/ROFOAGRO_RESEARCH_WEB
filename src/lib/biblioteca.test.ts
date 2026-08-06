import { describe, it, expect } from "vitest";
import { BIBLIOTECA, BIBLIOTECA_PERMISOS, itemsConfigurables } from "./biblioteca";

describe("biblioteca.ts — itemsConfigurables / BIBLIOTECA_PERMISOS", () => {
  it("BIBLIOTECA_PERMISOS tiene un grupo por cada sección de BIBLIOTECA, mismo orden", () => {
    expect(BIBLIOTECA_PERMISOS.map((g) => g.key)).toEqual(BIBLIOTECA.map((g) => g.key));
  });

  it("nunca incluye ítems soloMesa (esos siempre son requireAdmin, no dependen de la empresa)", () => {
    for (const g of BIBLIOTECA) {
      const configurables = new Set(itemsConfigurables(g).map((it) => it.href));
      for (const it of g.items) {
        if (it.soloMesa) expect(configurables.has(it.href.split("?")[0]!)).toBe(false);
      }
    }
  });

  it("dedupea por pathname: Gráficos (Campañas + Período comparten /graficos) queda en 1 ítem", () => {
    const graficos = BIBLIOTECA_PERMISOS.find((g) => g.key === "graficos")!;
    expect(graficos.items).toHaveLength(1);
    expect(graficos.items[0]!.href).toBe("/graficos");
  });

  it("Informes (3 anclas al mismo pathname) dedupea a 1 ítem", () => {
    const informes = BIBLIOTECA_PERMISOS.find((g) => g.key === "informes")!;
    expect(informes.items).toHaveLength(1);
    expect(informes.items[0]!.href).toBe("/informes");
  });

  it("Comercio expone solo los 2 ítems públicos (DJVE + camiones), no los 6 soloMesa", () => {
    const comercio = BIBLIOTECA_PERMISOS.find((g) => g.key === "comercio")!;
    expect(comercio.items.map((it) => it.href).sort()).toEqual(["/comercio/camiones", "/comercio/djve"]);
  });

  it("Calculadoras no incluye 'costos' (soloMesa hasta cerrar el tarifario)", () => {
    const calc = BIBLIOTECA_PERMISOS.find((g) => g.key === "calculadoras")!;
    expect(calc.items.some((it) => it.href === "/calculadoras/costos")).toBe(false);
    expect(calc.items.length).toBeGreaterThan(1);
  });

  it("Noticias no tiene ítems configurables", () => {
    const noticias = BIBLIOTECA_PERMISOS.find((g) => g.key === "noticias")!;
    expect(noticias.items).toEqual([]);
  });

  it("Operaciones expone sus 3 ítems configurables (Evolución es soloMesa, no entra)", () => {
    const operaciones = BIBLIOTECA_PERMISOS.find((g) => g.key === "operaciones")!;
    expect(operaciones.items.map((it) => it.href).sort()).toEqual([
      "/operaciones",
      "/operaciones/acumulada",
      "/operaciones/registro",
    ]);
  });
});
