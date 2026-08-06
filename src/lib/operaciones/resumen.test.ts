import { describe, it, expect } from "vitest";
import { construirMatrizFisico, construirMatrizFuturos, combinarMatrices } from "./posicion";
import { valorizarFuturos, claveAjuste, type AjusteLookup } from "./futuros-valorizados";
import { resumenPosicion } from "./resumen";
import type { Operacion } from "./tipos";

const HOY = "2026-08-05";

function op(over: Partial<Operacion>): Operacion {
  return {
    id: "id-" + Math.random(),
    empresa_id: "emp-1",
    fecha: HOY,
    lado: "compra",
    producto: "soja",
    tipo: "disponible",
    condicion: null,
    campania: "25/26",
    volumen_tn: 100,
    precio_modo: "sin_precio",
    precio: null,
    moneda: null,
    descuento_pct: null,
    descuento_monto: null,
    entrega_desde: null,
    entrega_hasta: null,
    posicion_a3: null,
    contraparte: null,
    nro_contrato: null,
    observaciones: null,
    anulada: false,
    creado_por: null,
    creado_en: HOY,
    actualizado_por: null,
    actualizado_en: HOY,
    ...over,
  };
}

function armar(operaciones: Operacion[], ajustes: AjusteLookup = new Map()) {
  const fisico = construirMatrizFisico(operaciones, HOY);
  const futuros = construirMatrizFuturos(operaciones, HOY);
  const total = combinarMatrices(fisico, futuros);
  return resumenPosicion(fisico, total, valorizarFuturos(operaciones, ajustes));
}

describe("resumenPosicion", () => {
  it("sin operaciones: sin productos, sin resultado de futuros", () => {
    const r = armar([]);
    expect(r.productos).toEqual([]);
    expect(r.resultadoFuturosUsd).toBeNull();
    expect(r.futurosSinValorizar).toBe(0);
  });

  it("desglosa físico y futuros por producto y solo lista los que tienen actividad", () => {
    const ajustes: AjusteLookup = new Map([[claveAjuste("SOJ", "NOV26"), 347.4]]);
    const r = armar(
      [
        op({ producto: "soja", lado: "compra", volumen_tn: 200 }),
        op({ producto: "soja", lado: "venta", volumen_tn: 60 }),
        op({
          producto: "soja",
          tipo: "futuro_a3",
          lado: "compra",
          volumen_tn: 300,
          posicion_a3: "NOV26",
          precio_modo: "manual",
          precio: 320,
          moneda: "usd",
        }),
        op({ producto: "trigo", lado: "venta", volumen_tn: 50 }),
      ],
      ajustes,
    );

    expect(r.productos.map((p) => p.producto)).toEqual(["soja", "trigo"]);
    const soja = r.productos[0]!;
    expect(soja.fisicoTn).toBe(140);
    expect(soja.futurosTn).toBe(300);
    expect(soja.totalTn).toBe(440);
    expect(soja.estado).toBe("COMPRADOS");
    expect(r.productos[1]).toMatchObject({ producto: "trigo", totalTn: -50, estado: "VENDIDOS" });
    // (347,40 − 320,00) × 300 = +8.220,00 — el mismo ejemplo confirmado del plan §5.5
    expect(r.resultadoFuturosUsd).toBe(8220);
    expect(r.futurosSinValorizar).toBe(0);
  });

  it("un producto calzado entre períodos (total 0) aparece igual, en NEUTRO", () => {
    const r = armar([
      op({ producto: "maiz", tipo: "forward", lado: "compra", volumen_tn: 100, entrega_desde: "2026-10-15" }),
      op({ producto: "maiz", tipo: "forward", lado: "venta", volumen_tn: 100, entrega_desde: "2026-12-15" }),
    ]);
    expect(r.productos).toHaveLength(1);
    expect(r.productos[0]).toMatchObject({ producto: "maiz", totalTn: 0, estado: "NEUTRO" });
  });

  it("cuenta los futuros que no valorizaron (sin ajuste vigente / moneda ≠ USD)", () => {
    const r = armar([
      op({
        producto: "soja",
        tipo: "futuro_a3",
        lado: "compra",
        volumen_tn: 100,
        posicion_a3: "NOV26",
        precio_modo: "manual",
        precio: 320,
        moneda: "usd",
      }),
      op({
        producto: "maiz",
        tipo: "futuro_a3",
        lado: "venta",
        volumen_tn: 100,
        posicion_a3: "DIC26",
        precio_modo: "manual",
        precio: 180,
        moneda: "ars",
      }),
    ]);
    // ajustes vacíos: el de soja queda sin_ajuste_vigente, el de maíz moneda_no_usd
    expect(r.resultadoFuturosUsd).toBeNull();
    expect(r.futurosSinValorizar).toBe(2);
  });

  it("las anuladas no cuentan actividad", () => {
    const r = armar([op({ producto: "girasol", volumen_tn: 80, anulada: true })]);
    expect(r.productos).toEqual([]);
  });
});
