import { describe, it, expect } from "vitest";
import { valorizarFuturos, totalesPorProducto, totalGeneral, claveAjuste } from "./futuros-valorizados";
import type { Operacion } from "./tipos";

const HOY = "2026-08-05";

function op(over: Partial<Operacion>): Operacion {
  return {
    id: "id-" + Math.random(),
    empresa_id: "emp-1",
    fecha: HOY,
    lado: "compra",
    producto: "soja",
    tipo: "futuro_a3",
    condicion: null,
    campania: "25/26",
    volumen_tn: 300,
    precio_modo: "manual",
    precio: 320,
    moneda: "usd",
    descuento_pct: null,
    descuento_monto: null,
    entrega_desde: null,
    entrega_hasta: null,
    posicion_a3: "NOV26",
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

describe("valorizarFuturos — fórmula confirmada por Lautoro (§5.5, ejemplo del plan)", () => {
  it("compra 300 tn SOJ NOV26 a 320,00, ajuste 328,50 → +2.550,00 USD", () => {
    const ajustes = new Map([[claveAjuste("SOJ", "NOV26"), 328.5]]);
    const [f] = valorizarFuturos([op({})], ajustes);
    expect(f!.estado).toBe("valorizado");
    expect(f!.resultadoUsd).toBe(2550);
  });

  it("la MISMA operación vendida da −2.550,00 (signo invertido)", () => {
    const ajustes = new Map([[claveAjuste("SOJ", "NOV26"), 328.5]]);
    const [f] = valorizarFuturos([op({ lado: "venta" })], ajustes);
    expect(f!.resultadoUsd).toBe(-2550);
  });

  it("posición sin ajuste vigente (vencida o sin dato) degrada honesto, sin inventar precio", () => {
    const ajustes = new Map<string, number | null>();
    const [f] = valorizarFuturos([op({})], ajustes);
    expect(f!.estado).toBe("sin_ajuste_vigente");
    expect(f!.ajusteHoy).toBeNull();
    expect(f!.resultadoUsd).toBeNull();
  });

  it("moneda en $ no se valoriza (A3 cotiza en USD, sin inventar TC)", () => {
    const ajustes = new Map([[claveAjuste("SOJ", "NOV26"), 328.5]]);
    const [f] = valorizarFuturos([op({ moneda: "ars" })], ajustes);
    expect(f!.estado).toBe("moneda_no_usd");
    expect(f!.resultadoUsd).toBeNull();
  });

  it("anuladas quedan fuera", () => {
    const ajustes = new Map([[claveAjuste("SOJ", "NOV26"), 328.5]]);
    expect(valorizarFuturos([op({ anulada: true })], ajustes)).toHaveLength(0);
  });

  it("solo entran operaciones futuro_a3 (disponible/forward/fijación quedan fuera)", () => {
    const ajustes = new Map([[claveAjuste("SOJ", "NOV26"), 328.5]]);
    const ops = [op({ tipo: "disponible", posicion_a3: null, precio_modo: "sin_precio", precio: null, moneda: null })];
    expect(valorizarFuturos(ops, ajustes)).toHaveLength(0);
  });

  it("multiploDeContrato marca cuando el volumen no es múltiplo de 100", () => {
    const ajustes = new Map([[claveAjuste("SOJ", "NOV26"), 328.5]]);
    const [f150] = valorizarFuturos([op({ volumen_tn: 150 })], ajustes);
    const [f200] = valorizarFuturos([op({ volumen_tn: 200 })], ajustes);
    expect(f150!.multiploDeContrato).toBe(false);
    expect(f200!.multiploDeContrato).toBe(true);
  });

  it("distintos granos usan su propio símbolo A3 (SOJ ≠ MAI ≠ TRI)", () => {
    const ajustes = new Map([
      [claveAjuste("SOJ", "NOV26"), 328.5],
      [claveAjuste("MAI", "JUL26"), 180],
    ]);
    const ops = [
      op({ producto: "soja", posicion_a3: "NOV26" }),
      op({ producto: "maiz", posicion_a3: "JUL26", precio: 175, volumen_tn: 200 }),
    ];
    const [soja, maiz] = valorizarFuturos(ops, ajustes);
    expect(soja!.resultadoUsd).toBe(2550);
    expect(maiz!.resultadoUsd).toBe(1000); // (180-175)*200
  });
});

describe("totalesPorProducto / totalGeneral", () => {
  it("suma solo las valorizadas, por producto y en total", () => {
    const ajustes = new Map([
      [claveAjuste("SOJ", "NOV26"), 328.5],
      [claveAjuste("MAI", "JUL26"), 180],
    ]);
    const ops = [
      op({ producto: "soja", posicion_a3: "NOV26", volumen_tn: 300, precio: 320 }), // +2550
      op({ producto: "soja", posicion_a3: "NOV26", volumen_tn: 100, precio: 330, lado: "venta" }), // (328.5-330)*100*-1=150
      op({ producto: "maiz", posicion_a3: "JUL26", volumen_tn: 200, precio: 175 }), // +1000
      op({ producto: "soja", moneda: "ars" }), // fuera, no valoriza
    ];
    const filas = valorizarFuturos(ops, ajustes);
    const totales = totalesPorProducto(filas);
    expect(totales.soja).toBe(2700);
    expect(totales.maiz).toBe(1000);
    expect(totalGeneral(filas)).toBe(3700);
  });

  it("null si ninguna fila valorizó", () => {
    const ajustes = new Map<string, number | null>();
    const filas = valorizarFuturos([op({})], ajustes);
    expect(totalGeneral(filas)).toBeNull();
  });
});
