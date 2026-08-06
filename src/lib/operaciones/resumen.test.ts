import { describe, it, expect } from "vitest";
import { construirMatrizPricing } from "./posicion";
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
    fijacion_desde: null,
    fijacion_hasta: null,
    posicion_a3: null,
    es_canje: false,
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

function armar(operaciones: Operacion[]) {
  return resumenPosicion(construirMatrizPricing(operaciones, HOY));
}

describe("resumenPosicion (pedido de Lautaro 06/08/2026, vuelta 4: refleja el PRICING)", () => {
  it("sin operaciones: sin productos", () => {
    expect(armar([]).productos).toEqual([]);
  });

  it("suma físico con precio + fijaciones + futuros, excluye a fijar", () => {
    const r = armar([
      op({ producto: "soja", lado: "compra", volumen_tn: 200, precio_modo: "manual", precio: 320, moneda: "usd" }),
      op({ producto: "soja", lado: "venta", volumen_tn: 60, precio_modo: "sin_precio", condicion: "a_fijar" }), // NO cuenta
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
      op({ producto: "trigo", lado: "venta", volumen_tn: 50, precio_modo: "pizarra", moneda: "usd" }),
    ]);

    expect(r.productos.map((p) => p.producto)).toEqual(["soja", "trigo"]);
    const soja = r.productos[0]!;
    expect(soja.totalTn).toBe(500); // 200 + 300 (el a fijar de 60 no suma)
    expect(soja.estado).toBe("COMPRADOS");
    expect(r.productos[1]).toMatchObject({ producto: "trigo", totalTn: -50, estado: "VENDIDOS" });
  });

  it("un producto calzado entre períodos (total 0) aparece igual, en NEUTRO", () => {
    const r = armar([
      op({
        producto: "maiz",
        tipo: "forward",
        lado: "compra",
        volumen_tn: 100,
        entrega_desde: "2026-10-15",
        precio_modo: "manual",
        precio: 180,
        moneda: "usd",
      }),
      op({
        producto: "maiz",
        tipo: "forward",
        lado: "venta",
        volumen_tn: 100,
        entrega_desde: "2026-12-15",
        precio_modo: "manual",
        precio: 190,
        moneda: "usd",
      }),
    ]);
    expect(r.productos).toHaveLength(1);
    expect(r.productos[0]).toMatchObject({ producto: "maiz", totalTn: 0, estado: "NEUTRO" });
  });

  it("las anuladas y los a fijar sin nada más no cuentan actividad", () => {
    expect(armar([op({ producto: "girasol", volumen_tn: 80, anulada: true, precio_modo: "manual", precio: 300, moneda: "usd" })]).productos).toEqual([]);
    expect(armar([op({ producto: "girasol", volumen_tn: 80, precio_modo: "sin_precio", condicion: "a_fijar" })]).productos).toEqual([]);
  });
});
