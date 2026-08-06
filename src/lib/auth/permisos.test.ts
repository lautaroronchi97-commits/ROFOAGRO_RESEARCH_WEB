import { describe, it, expect } from "vitest";
import { itemPermitido, normalizarItems, type GrupoConfigurable } from "./permisos";

describe("permisos.ts — itemPermitido", () => {
  it("admin ve todo, incluso con la sección apagada", () => {
    expect(itemPermitido(true, false, ["/a"], "/b")).toBe(true);
  });

  it("sección no visible → nada de ella, aunque el href esté en el whitelist", () => {
    expect(itemPermitido(false, false, undefined, "/a")).toBe(false);
  });

  it("sin restricción explícita (undefined) → todos los ítems de la sección", () => {
    expect(itemPermitido(false, true, undefined, "/lo-que-sea")).toBe(true);
  });

  it("con restricción → solo los hrefs listados", () => {
    expect(itemPermitido(false, true, ["/a", "/b"], "/a")).toBe(true);
    expect(itemPermitido(false, true, ["/a", "/b"], "/c")).toBe(false);
  });

  it("restricción vacía ([]) → ningún ítem, aunque la sección esté visible", () => {
    expect(itemPermitido(false, true, [], "/a")).toBe(false);
  });
});

describe("permisos.ts — normalizarItems", () => {
  const GRUPOS: GrupoConfigurable[] = [
    { key: "granos", items: [{ href: "/granos/arbitrajes" }, { href: "/granos/pases" }, { href: "/granos/caja" }] },
    { key: "dolar", items: [{ href: "/dolar/futuro" }, { href: "/dolar/oficial" }] },
    { key: "noticias", items: [] },
    { key: "graficos", items: [{ href: "/graficos" }] },
  ];

  it("tildar TODOS los ítems de una sección = sin restricción (se omite la clave)", () => {
    const out = normalizarItems(GRUPOS, ["granos"], () => [
      "/granos/arbitrajes",
      "/granos/pases",
      "/granos/caja",
    ]);
    expect(out).toEqual({});
  });

  it("tildar un subconjunto queda explícito", () => {
    const out = normalizarItems(GRUPOS, ["granos"], (k) =>
      k === "granos" ? ["/granos/arbitrajes"] : []
    );
    expect(out).toEqual({ granos: ["/granos/arbitrajes"] });
  });

  it("tildar cero ítems de una sección activa guarda un array vacío (sin acceso a ítems, pero la sección sigue prendida)", () => {
    const out = normalizarItems(GRUPOS, ["granos"], () => []);
    expect(out).toEqual({ granos: [] });
  });

  it("ignora secciones que no están activas, aunque vengan marcados en el form", () => {
    const out = normalizarItems(GRUPOS, ["dolar"], (k) =>
      k === "granos" ? ["/granos/arbitrajes"] : ["/dolar/futuro"]
    );
    expect(out).toEqual({ dolar: ["/dolar/futuro"] });
  });

  it("ignora hrefs que no pertenecen a la sección (basura del form)", () => {
    const out = normalizarItems(GRUPOS, ["dolar"], () => ["/dolar/futuro", "/no-existe"]);
    expect(out).toEqual({ dolar: ["/dolar/futuro"] });
  });

  it("secciones sin ítems configurables (ej. noticias) nunca aparecen en el mapa", () => {
    const out = normalizarItems(GRUPOS, ["noticias"], () => []);
    expect(out).toEqual({});
  });

  it("secciones con exactamente 1 ítem configurable (ej. gráficos) tampoco se restringen — el árbol no les muestra checkboxes", () => {
    const out = normalizarItems(GRUPOS, ["graficos"], () => []);
    expect(out).toEqual({});
  });

  it("varias secciones activas: cada una se normaliza por separado", () => {
    const out = normalizarItems(GRUPOS, ["granos", "dolar"], (k) => {
      if (k === "granos") return ["/granos/arbitrajes", "/granos/pases", "/granos/caja"]; // todos → sin restricción
      if (k === "dolar") return ["/dolar/futuro"]; // subconjunto
      return [];
    });
    expect(out).toEqual({ dolar: ["/dolar/futuro"] });
  });
});
