import { describe, it, expect } from "vitest";
import {
  columnasPeriodo,
  bucketFisico,
  bucketFuturo,
  construirMatrizFisico,
  construirMatrizFuturos,
  combinarMatrices,
  construirNetoDelDia,
} from "./posicion";
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

describe("columnasPeriodo", () => {
  it("10 columnas: Disponible + 8 meses + Más adelante, rotando desde hoy", () => {
    const cols = columnasPeriodo(HOY);
    expect(cols).toHaveLength(10);
    expect(cols[0]).toEqual({ key: "disponible", label: "Disponible" });
    expect(cols[1]).toEqual({ key: "2026-09", label: "Sep-26" });
    expect(cols[8]).toEqual({ key: "2027-04", label: "Abr-27" });
    expect(cols[9]).toEqual({ key: "mas_adelante", label: "Más adelante" });
  });

  it("cruza el año nuevo correctamente (diciembre)", () => {
    const cols = columnasPeriodo("2026-12-01");
    expect(cols[1]).toEqual({ key: "2027-01", label: "Ene-27" });
  });
});

describe("bucketFisico — regla de Mauro (§5.2/§7.2, hoy+30 exacto)", () => {
  const cols = columnasPeriodo(HOY);
  it("tipo disponible: siempre Disponible", () => {
    expect(bucketFisico({ tipo: "disponible", entrega_desde: null }, HOY, cols)).toBe("disponible");
  });
  it("forward con entrega justo en el borde hoy+30: Disponible", () => {
    // hoy 2026-08-05 + 30 = 2026-09-04
    expect(bucketFisico({ tipo: "forward", entrega_desde: "2026-09-04" }, HOY, cols)).toBe("disponible");
  });
  it("forward un día después del borde: va a su mes", () => {
    expect(bucketFisico({ tipo: "forward", entrega_desde: "2026-09-05" }, HOY, cols)).toBe("2026-09");
  });
  it("forward con entrega ya pasada: Disponible (la entrega ya arrancó)", () => {
    expect(bucketFisico({ tipo: "forward", entrega_desde: "2026-07-01" }, HOY, cols)).toBe("disponible");
  });
  it("forward más allá de 8 meses: Más adelante", () => {
    expect(bucketFisico({ tipo: "forward", entrega_desde: "2027-08-01" }, HOY, cols)).toBe("mas_adelante");
  });
});

describe("bucketFuturo", () => {
  const cols = columnasPeriodo(HOY);
  it("mapea la posición A3 a su mes", () => {
    expect(bucketFuturo("NOV26", cols)).toBe("2026-11");
  });
  it("posición fuera de ventana: Más adelante", () => {
    expect(bucketFuturo("DIC27", cols)).toBe("mas_adelante");
  });
});

describe("construirMatrizFisico — reglas del neto (§5.1)", () => {
  it("compra suma, venta resta, por producto y columna", () => {
    const ops = [
      op({ lado: "compra", producto: "soja", volumen_tn: 100, tipo: "disponible" }),
      op({ lado: "venta", producto: "soja", volumen_tn: 40, tipo: "disponible" }),
    ];
    const m = construirMatrizFisico(ops, HOY);
    const soja = m.filas.find((f) => f.producto === "soja")!;
    expect(soja.porColumna.disponible).toBe(60);
    expect(soja.total).toBe(60);
    expect(soja.estado).toBe("COMPRADOS");
  });

  it("las anuladas se excluyen del todo", () => {
    const ops = [op({ lado: "venta", volumen_tn: 250, tipo: "disponible", anulada: true })];
    const m = construirMatrizFisico(ops, HOY);
    const soja = m.filas.find((f) => f.producto === "soja")!;
    expect(soja.total).toBe(0);
    expect(soja.estado).toBe("NEUTRO");
  });

  it("las fijaciones NO suman volumen (§1.2)", () => {
    const ops = [op({ lado: "compra", volumen_tn: 500, tipo: "fijacion", precio_modo: "manual", precio: 320, moneda: "usd" })];
    const m = construirMatrizFisico(ops, HOY);
    const soja = m.filas.find((f) => f.producto === "soja")!;
    expect(soja.total).toBe(0);
  });

  it("un futuro_a3 no aparece en la matriz física", () => {
    const ops = [op({ lado: "compra", volumen_tn: 300, tipo: "futuro_a3", posicion_a3: "NOV26", precio_modo: "manual", precio: 320, moneda: "usd" })];
    const m = construirMatrizFisico(ops, HOY);
    expect(m.filas.every((f) => f.total === 0)).toBe(true);
  });

  it("carga retroactiva: una operación con fecha vieja igual pesa en la posición acumulada", () => {
    const ops = [op({ lado: "venta", volumen_tn: 70, tipo: "disponible", fecha: "2026-07-01" })];
    const m = construirMatrizFisico(ops, HOY);
    const soja = m.filas.find((f) => f.producto === "soja")!;
    expect(soja.total).toBe(-70);
    expect(soja.estado).toBe("VENDIDOS");
  });

  it("VENDIDOS cuando el neto da negativo, NEUTRO en 0", () => {
    const ops = [op({ lado: "venta", volumen_tn: 10 })];
    const soja = construirMatrizFisico(ops, HOY).filas.find((f) => f.producto === "soja")!;
    expect(soja.estado).toBe("VENDIDOS");
    expect(construirMatrizFisico([], HOY).filas.find((f) => f.producto === "soja")!.estado).toBe("NEUTRO");
  });
});

describe("construirMatrizFuturos + combinarMatrices (§1.3)", () => {
  it("futuros quedan separados del físico y se combinan en el total", () => {
    const ops = [
      op({ lado: "compra", producto: "maiz", volumen_tn: 200, tipo: "disponible" }),
      op({ lado: "venta", producto: "maiz", volumen_tn: 100, tipo: "futuro_a3", posicion_a3: "JUL26", precio_modo: "manual", precio: 180, moneda: "usd" }),
    ];
    const fisico = construirMatrizFisico(ops, HOY);
    const futuros = construirMatrizFuturos(ops, HOY);
    const maizFisico = fisico.filas.find((f) => f.producto === "maiz")!;
    const maizFuturo = futuros.filas.find((f) => f.producto === "maiz")!;
    expect(maizFisico.total).toBe(200);
    expect(maizFuturo.total).toBe(-100);

    const total = combinarMatrices(fisico, futuros);
    const maizTotal = total.filas.find((f) => f.producto === "maiz")!;
    expect(maizTotal.total).toBe(100);
  });
});

describe("construirNetoDelDia", () => {
  it("es la matriz física acotada a las operaciones del día que se le pasen", () => {
    const delDia = [op({ lado: "compra", volumen_tn: 150, tipo: "disponible" })];
    const m = construirNetoDelDia(delDia, HOY);
    expect(m.filas.find((f) => f.producto === "soja")!.total).toBe(150);
  });
});
