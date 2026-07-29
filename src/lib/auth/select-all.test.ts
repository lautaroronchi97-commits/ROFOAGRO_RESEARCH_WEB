import { describe, it, expect, vi } from "vitest";
import { selectAllPaginado } from "./select-all";

/**
 * Regresión del bug real del 29/07/2026: `getPasZonas`/`getPasCondicion` truncaban en silencio
 * a las 1.000 filas (default de PostgREST) por no paginar — el panel mostraba solo hasta la
 * campaña donde caía el corte, sin ningún error visible. Estos tests fijan el comportamiento de
 * paginación con un mock del cliente de Supabase (sin red real).
 */

function mockQuery(total: number) {
  const calls: { from: number; to: number }[] = [];
  const query = vi.fn((from: number, to: number) => {
    calls.push({ from, to });
    const pagina = Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => from + i);
    return Promise.resolve({ data: pagina, error: null });
  });
  return { query, calls };
}

describe("selectAllPaginado", () => {
  it("trae todo en una sola página cuando hay menos de 1000 filas", async () => {
    const { query, calls } = mockQuery(42);
    const r = await selectAllPaginado(query);
    expect(r.error).toBeNull();
    expect(r.filas.length).toBe(42);
    expect(calls.length).toBe(1);
  });

  it("pagina más allá de 1.000 filas (el bug real: 1.837 y 1.872 filas)", async () => {
    for (const total of [1837, 1872, 1000, 1001]) {
      const { query, calls } = mockQuery(total);
      const r = await selectAllPaginado(query);
      expect(r.error).toBeNull();
      expect(r.filas.length).toBe(total);
      // Nº de páginas esperado: ceil(total/1000), +1 si total es múltiplo exacto (la última
      // página vacía es la que confirma que no hay más).
      const esperadas = total % 1000 === 0 ? total / 1000 + 1 : Math.ceil(total / 1000);
      expect(calls.length).toBe(esperadas);
    }
  });

  it("no pierde ni duplica filas en el borde exacto de una página (1000 filas)", async () => {
    const { query } = mockQuery(1000);
    const r = await selectAllPaginado(query);
    expect(r.filas.length).toBe(1000);
    expect(new Set(r.filas).size).toBe(1000); // sin duplicados
  });

  it("propaga el error de una página que falle a mitad de camino, sin reintentar infinito", async () => {
    let n = 0;
    const query = vi.fn(() => {
      n++;
      if (n === 1) return Promise.resolve({ data: Array.from({ length: 1000 }, (_, i) => i), error: null });
      return Promise.resolve({ data: null, error: { message: "boom" } });
    });
    const r = await selectAllPaginado(query as never);
    expect(r.error).toBe("boom");
    expect(n).toBe(2); // la 1ra página llena (1000) fuerza a pedir la 2da, que es la que falla
    expect(r.filas.length).toBe(1000); // las filas de la 1ra página no se pierden al fallar la 2da
  });

  it("corta con el backstop anti-loop si la fuente nunca devuelve menos de 1000 (defensivo)", async () => {
    const query = vi.fn(() => Promise.resolve({ data: Array.from({ length: 1000 }, (_, i) => i), error: null }));
    const r = await selectAllPaginado(query);
    expect(r.filas.length).toBeGreaterThan(200_000);
    expect(r.error).toBeNull();
  });
});
