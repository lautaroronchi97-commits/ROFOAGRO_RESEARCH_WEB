import { describe, it, expect } from "vitest";
import { WORKFLOWS, CHECKS, CARGAS_MANUALES } from "./catalogo";

// Slugs reales de las páginas src/app/admin/datos/<slug>/page.tsx (ver secciones.ts). Si se
// renombra uno acá, hay que renombrarlo también ahí — este test avisa si se desincronizan.
const SLUGS_ADMIN_DATOS = new Set(["agrochat", "camiones", "mesa-color", "bcra-manual", "dea", "pas", "pas-zonas", "pas-condicion", "lecap"]);

describe("catalogo.ts — consistencia interna", () => {
  it("todo WORKFLOWS[].checkNombres referencia un CHECKS[].nombre real", () => {
    const nombres = new Set(CHECKS.map((c) => c.nombre));
    for (const w of WORKFLOWS) {
      for (const cn of w.checkNombres) {
        expect(nombres.has(cn), `${w.archivo} referencia un check inexistente: "${cn}"`).toBe(true);
      }
    }
  });

  it("todo CargaManual con href a /admin/datos/ apunta a una página real", () => {
    for (const c of CARGAS_MANUALES) {
      if (c.href.startsWith("/admin/datos/")) {
        const slug = c.href.slice("/admin/datos/".length);
        expect(SLUGS_ADMIN_DATOS.has(slug), `${c.id} apunta a una página inexistente: "${slug}"`).toBe(true);
      }
    }
  });

  it("CARGAS_MANUALES no tiene ids duplicados", () => {
    const ids = CARGAS_MANUALES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("WORKFLOWS no tiene archivos duplicados", () => {
    const archivos = WORKFLOWS.map((w) => w.archivo);
    expect(new Set(archivos).size).toBe(archivos.length);
  });

  it("CHECKS no tiene nombres duplicados", () => {
    const nombres = CHECKS.map((c) => c.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
  });
});
