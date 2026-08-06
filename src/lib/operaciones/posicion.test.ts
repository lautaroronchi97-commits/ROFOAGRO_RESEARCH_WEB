import { describe, it, expect } from "vitest";
import {
  columnasPeriodo,
  bucketFisico,
  bucketFuturo,
  construirMatrizFisico,
  construirMatrizFuturos,
  construirMatrizPricing,
  construirMatrizDia,
  esOperacionConPrecio,
  campaniasFisicasPresentes,
  construirMatrizFisicoDeCampania,
  evolucionFisico,
  combinarMatrices,
  construirNetoDelDia,
  filtrarHasta,
  construirHeatmap,
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

describe("columnasPeriodo", () => {
  it("8 columnas: Disponible + 6 meses + Más adelante, rotando desde hoy", () => {
    const cols = columnasPeriodo(HOY);
    expect(cols).toHaveLength(8);
    expect(cols[0]).toEqual({ key: "disponible", label: "Disponible" });
    expect(cols[1]).toEqual({ key: "2026-09", label: "Sep-26" });
    expect(cols[6]).toEqual({ key: "2027-02", label: "Feb-27" });
    expect(cols[7]).toEqual({ key: "mas_adelante", label: "Más adelante" });
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
  it("forward más allá de 6 meses: Más adelante", () => {
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

describe("construirMatrizFisico — filtro de precio (pedido 06/08/2026, Físico acumulado)", () => {
  const ops = [
    op({ lado: "compra", volumen_tn: 200, precio_modo: "manual", precio: 320, moneda: "usd" }),
    op({ lado: "venta", volumen_tn: 50, precio_modo: "sin_precio", condicion: "a_fijar" }),
  ];

  it("todos (default): suma con precio y a fijar", () => {
    const soja = construirMatrizFisico(ops, HOY).filas.find((f) => f.producto === "soja")!;
    expect(soja.total).toBe(150);
  });

  it("con_precio: solo lo que ya tiene precio", () => {
    const soja = construirMatrizFisico(ops, HOY, "con_precio").filas.find((f) => f.producto === "soja")!;
    expect(soja.total).toBe(200);
  });

  it("a_fijar: solo lo que todavía no tiene precio", () => {
    const soja = construirMatrizFisico(ops, HOY, "a_fijar").filas.find((f) => f.producto === "soja")!;
    expect(soja.total).toBe(-50);
  });

  it("construirMatrizFisicoDeCampania propaga el filtro", () => {
    const conCampania = ops.map((o) => ({ ...o, campania: "25/26" }));
    const m = construirMatrizFisicoDeCampania("25/26", "con_precio")(conCampania, HOY);
    expect(m.filas.find((f) => f.producto === "soja")!.total).toBe(200);
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

  it("girasol, sorgo, expeller de soja y aceite de soja NO tienen fila en Futuros A3 (no cotizan en A3) pero SÍ en Físico y Total", () => {
    const ops = [
      op({ lado: "compra", producto: "girasol", volumen_tn: 40, tipo: "disponible" }),
      op({ lado: "venta", producto: "sorgo", volumen_tn: 20, tipo: "disponible" }),
      op({ lado: "compra", producto: "expeller_soja", volumen_tn: 15, tipo: "disponible" }),
      op({ lado: "venta", producto: "aceite_soja", volumen_tn: 10, tipo: "disponible" }),
    ];
    const fisico = construirMatrizFisico(ops, HOY);
    const futuros = construirMatrizFuturos(ops, HOY);
    expect(fisico.filas.map((f) => f.producto)).toEqual([
      "soja",
      "maiz",
      "trigo",
      "girasol",
      "sorgo",
      "expeller_soja",
      "aceite_soja",
    ]);
    expect(futuros.filas.map((f) => f.producto)).toEqual(["soja", "maiz", "trigo"]);

    const total = combinarMatrices(fisico, futuros);
    expect(total.filas.map((f) => f.producto)).toEqual([
      "soja",
      "maiz",
      "trigo",
      "girasol",
      "sorgo",
      "expeller_soja",
      "aceite_soja",
    ]);
    expect(total.filas.find((f) => f.producto === "girasol")!.total).toBe(40);
    expect(total.filas.find((f) => f.producto === "sorgo")!.total).toBe(-20);
    expect(total.filas.find((f) => f.producto === "expeller_soja")!.total).toBe(15);
    expect(total.filas.find((f) => f.producto === "aceite_soja")!.total).toBe(-10);
  });
});

describe("construirNetoDelDia", () => {
  it("es la matriz física acotada a las operaciones del día que se le pasen", () => {
    const delDia = [op({ lado: "compra", volumen_tn: 150, tipo: "disponible" })];
    const m = construirNetoDelDia(delDia, HOY);
    expect(m.filas.find((f) => f.producto === "soja")!.total).toBe(150);
  });
});

describe("filtrarHasta — 'Posición al [fecha]' (Fase 2, §5.1)", () => {
  it("incluye operaciones con fecha <= corte, excluye las posteriores", () => {
    const ops = [
      op({ fecha: "2026-07-01" }),
      op({ fecha: "2026-08-05" }),
      op({ fecha: "2026-08-06" }),
    ];
    const hasta = filtrarHasta(ops, "2026-08-05");
    expect(hasta.map((o) => o.fecha)).toEqual(["2026-07-01", "2026-08-05"]);
  });

  it("el borde exacto (fecha === corte) queda incluido", () => {
    const ops = [op({ fecha: "2026-08-05" })];
    expect(filtrarHasta(ops, "2026-08-05")).toHaveLength(1);
  });

  it("componiendo con construirMatrizFisico reproduce un cierre pasado", () => {
    const ops = [
      op({ fecha: "2026-07-01", lado: "compra", volumen_tn: 100 }),
      op({ fecha: "2026-08-05", lado: "venta", volumen_tn: 40 }),
    ];
    const alCorte = construirMatrizFisico(filtrarHasta(ops, "2026-07-15"), HOY);
    expect(alCorte.filas.find((f) => f.producto === "soja")!.total).toBe(100);
  });
});

describe("construirHeatmap — calendario producto × día (§1.23/§5.6, Fase 2)", () => {
  it("ventana de N días terminando HOY, más viejo primero", () => {
    const hm = construirHeatmap([], HOY, 5);
    expect(hm.dias).toEqual(["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05"]);
    expect(hm.filas).toHaveLength(7); // los 7 productos, incluso sin operaciones
  });

  it("compra suma verde (+), venta resta (rojo -), por día y producto", () => {
    const ops = [
      op({ fecha: "2026-08-04", lado: "compra", producto: "soja", volumen_tn: 100 }),
      op({ fecha: "2026-08-04", lado: "venta", producto: "soja", volumen_tn: 30 }),
      op({ fecha: "2026-08-05", lado: "venta", producto: "maiz", volumen_tn: 50 }),
    ];
    const hm = construirHeatmap(ops, HOY, 7);
    const soja = hm.filas.find((f) => f.producto === "soja")!;
    const maiz = hm.filas.find((f) => f.producto === "maiz")!;
    expect(soja.porDia["2026-08-04"]).toBe(70);
    expect(maiz.porDia["2026-08-05"]).toBe(-50);
  });

  it("fuera de la ventana no cuenta", () => {
    const ops = [op({ fecha: "2026-07-01", volumen_tn: 999 })];
    const hm = construirHeatmap(ops, HOY, 5);
    const soja = hm.filas.find((f) => f.producto === "soja")!;
    expect(Object.values(soja.porDia).every((v) => v === 0)).toBe(true);
  });

  it("anuladas y fijaciones no cuentan (solo físico, mismo criterio que neto del día)", () => {
    const ops = [
      op({ fecha: HOY, volumen_tn: 200, anulada: true }),
      op({ fecha: HOY, volumen_tn: 500, tipo: "fijacion", precio_modo: "manual", precio: 320, moneda: "usd" }),
      op({ fecha: HOY, volumen_tn: 300, tipo: "futuro_a3", posicion_a3: "NOV26", precio_modo: "manual", precio: 320, moneda: "usd" }),
    ];
    const hm = construirHeatmap(ops, HOY, 3);
    const soja = hm.filas.find((f) => f.producto === "soja")!;
    expect(soja.porDia[HOY]).toBe(0);
  });

  it("cruza fin/inicio de mes correctamente", () => {
    const ops = [op({ fecha: "2026-07-31", lado: "compra", volumen_tn: 80 })];
    const hm = construirHeatmap(ops, "2026-08-02", 3);
    expect(hm.dias).toEqual(["2026-07-31", "2026-08-01", "2026-08-02"]);
    const soja = hm.filas.find((f) => f.producto === "soja")!;
    expect(soja.porDia["2026-07-31"]).toBe(80);
  });
});

describe("construirMatrizPricing (pedido 06/08/2026 — mercadería CON precio)", () => {
  it("incluye físicos a precio/pizarra, fijaciones y futuros; excluye a fijar y anuladas", () => {
    const ops = [
      op({ volumen_tn: 200, precio_modo: "manual", precio: 320, moneda: "usd" }),
      op({ volumen_tn: 50, precio_modo: "pizarra", moneda: "usd" }),
      op({ volumen_tn: 80, precio_modo: "sin_precio", condicion: "a_fijar" }), // a fijar: NO entra
      op({ volumen_tn: 120, tipo: "fijacion", precio_modo: "manual", precio: 330, moneda: "usd" }),
      op({ volumen_tn: 300, tipo: "futuro_a3", posicion_a3: "NOV26", precio_modo: "manual", precio: 320, moneda: "usd" }),
      op({ volumen_tn: 999, precio_modo: "manual", precio: 320, moneda: "usd", anulada: true }),
    ];
    const m = construirMatrizPricing(ops, HOY);
    const soja = m.filas.find((f) => f.producto === "soja")!;
    // 200 + 50 + 120 (fijación SÍ suma acá) + 300 (futuro NOV26) = 670
    expect(soja.total).toBe(670);
    expect(soja.porColumna["disponible"]).toBe(370); // 200 + 50 + fijación sin entrega
    expect(soja.porColumna["2026-11"]).toBe(300); // el futuro va al mes de su posición
    expect(soja.estado).toBe("COMPRADOS");
  });

  it("físico vs pricing: el a fijar está en físico pero no en pricing (y la fijación al revés)", () => {
    const ops = [
      op({ volumen_tn: 100, precio_modo: "sin_precio", condicion: "a_fijar" }),
      op({ volumen_tn: 100, tipo: "fijacion", precio_modo: "manual", precio: 325, moneda: "usd" }),
    ];
    const fisico = construirMatrizFisico(ops, HOY);
    const pricing = construirMatrizPricing(ops, HOY);
    expect(fisico.filas.find((f) => f.producto === "soja")!.total).toBe(100); // solo el a fijar
    expect(pricing.filas.find((f) => f.producto === "soja")!.total).toBe(100); // solo la fijación
  });

  it("esOperacionConPrecio: la pizarra cuenta como con precio", () => {
    expect(esOperacionConPrecio({ tipo: "disponible", precio_modo: "pizarra" })).toBe(true);
    expect(esOperacionConPrecio({ tipo: "disponible", precio_modo: "sin_precio" })).toBe(false);
    expect(esOperacionConPrecio({ tipo: "fijacion", precio_modo: "manual" })).toBe(true);
    expect(esOperacionConPrecio({ tipo: "futuro_a3", precio_modo: "manual" })).toBe(true);
  });
});

describe("construirMatrizDia (posición inicial + integridad entre tablas)", () => {
  const ops = [
    op({ fecha: "2026-08-01", volumen_tn: 200, precio_modo: "manual", precio: 320, moneda: "usd" }),
    op({ fecha: "2026-08-03", lado: "venta", volumen_tn: 60, precio_modo: "manual", precio: 330, moneda: "usd" }),
    op({ fecha: HOY, volumen_tn: 100, precio_modo: "manual", precio: 335, moneda: "usd" }),
    op({ fecha: HOY, producto: "maiz", tipo: "forward", volumen_tn: 80, entrega_desde: "2026-10-15", precio_modo: "sin_precio", condicion: "a_fijar" }),
  ];

  it("inicial = acumulado hasta el día anterior; total = inicial + neto del día", () => {
    const m = construirMatrizDia(ops, HOY, HOY, construirMatrizFisico);
    const soja = m.filas.find((f) => f.producto === "soja")!;
    expect(soja.inicial).toBe(140); // 200 − 60
    expect(soja.netoDia).toBe(100);
    expect(soja.total).toBe(240);
    expect(soja.estado).toBe("COMPRADOS");
    const maiz = m.filas.find((f) => f.producto === "maiz")!;
    expect(maiz.inicial).toBe(0);
    expect(maiz.netoDia).toBe(80);
    expect(m.totalGeneral).toBe(320);
  });

  it("INTEGRIDAD: el total del día coincide EXACTO con la matriz acumulada hasta ese día (camino independiente)", () => {
    for (const builder of [construirMatrizFisico, construirMatrizPricing]) {
      const dia = construirMatrizDia(ops, HOY, HOY, builder);
      const acumulada = builder(filtrarHasta(ops, HOY), HOY);
      for (const f of dia.filas) {
        const fAcum = acumulada.filas.find((x) => x.producto === f.producto)!;
        expect(f.total).toBe(fAcum.total);
        expect(f.estado).toBe(fAcum.estado);
      }
      expect(dia.totalGeneral).toBe(acumulada.totalGeneral);
    }
  });

  it("un día sin operaciones: neto 0 y total = inicial", () => {
    const m = construirMatrizDia(ops, "2026-08-04", HOY, construirMatrizFisico);
    const soja = m.filas.find((f) => f.producto === "soja")!;
    expect(soja.inicial).toBe(140);
    expect(soja.netoDia).toBe(0);
    expect(soja.total).toBe(140);
  });

  it("pricing del día: la posición inicial viene de lo acumulado A PRECIO (no del físico)", () => {
    const conAFijar = [
      op({ fecha: "2026-08-01", volumen_tn: 500, precio_modo: "sin_precio", condicion: "a_fijar" }),
      op({ fecha: "2026-08-01", volumen_tn: 200, precio_modo: "manual", precio: 320, moneda: "usd" }),
      op({ fecha: HOY, volumen_tn: 100, precio_modo: "manual", precio: 335, moneda: "usd" }),
    ];
    const pricingDia = construirMatrizDia(conAFijar, HOY, HOY, construirMatrizPricing);
    const fisicoDia = construirMatrizDia(conAFijar, HOY, HOY, construirMatrizFisico);
    expect(pricingDia.filas.find((f) => f.producto === "soja")!.inicial).toBe(200); // sin las 500 a fijar
    expect(fisicoDia.filas.find((f) => f.producto === "soja")!.inicial).toBe(700); // con ellas
  });
});

describe("físico segmentado por campaña (pedido 06/08/2026 — pricing no se toca)", () => {
  const ops = [
    op({ producto: "soja", campania: "25/26", lado: "compra", volumen_tn: 200 }),
    op({ producto: "soja", campania: "26/27", lado: "venta", volumen_tn: 60 }),
    op({ producto: "maiz", campania: "25/26", lado: "compra", volumen_tn: 80 }),
    op({ producto: "soja", campania: "25/26", tipo: "fijacion", volumen_tn: 999, precio_modo: "manual", precio: 320, moneda: "usd" }), // no es físico, no cuenta
    op({ producto: "trigo", campania: "24/25", lado: "venta", volumen_tn: 40, anulada: true }), // anulada, no cuenta
  ];

  it("campaniasFisicasPresentes: solo campañas de operaciones físicas vivas", () => {
    expect(campaniasFisicasPresentes(ops)).toEqual(["25/26", "26/27"]);
  });

  it("construirMatrizFisicoDeCampania: no netea entre campañas distintas", () => {
    const m2526 = construirMatrizFisicoDeCampania("25/26")(ops, HOY);
    const m2627 = construirMatrizFisicoDeCampania("26/27")(ops, HOY);
    // 25/26: compra soja 200 (NO la venta 60 de 26/27, que sería -60 si se mezclaran)
    expect(m2526.filas.find((f) => f.producto === "soja")!.total).toBe(200);
    expect(m2526.filas.find((f) => f.producto === "maiz")!.total).toBe(80);
    // 26/27: solo la venta de soja, sola en su propia campaña
    expect(m2627.filas.find((f) => f.producto === "soja")!.total).toBe(-60);
    expect(m2627.filas.find((f) => f.producto === "maiz")!.total).toBe(0);
  });

  it("el físico global (sin segmentar) SÍ mezcla las campañas — confirma que son cálculos distintos", () => {
    const global = construirMatrizFisico(ops, HOY);
    // 200 (25/26) − 60 (26/27) = 140: exactamente lo que NO queremos para el
    // físico segmentado (por eso construirMatrizFisicoDeCampania existe).
    expect(global.filas.find((f) => f.producto === "soja")!.total).toBe(140);
  });

  it("sirve como builder de construirMatrizDia (posición inicial también queda acotada a su campaña)", () => {
    const conHistoria = [
      op({ fecha: "2026-08-01", producto: "soja", campania: "25/26", volumen_tn: 300 }),
      op({ fecha: "2026-08-01", producto: "soja", campania: "26/27", volumen_tn: 50 }),
      op({ fecha: HOY, producto: "soja", campania: "25/26", volumen_tn: 100 }),
    ];
    const dia2526 = construirMatrizDia(conHistoria, HOY, HOY, construirMatrizFisicoDeCampania("25/26"));
    const soja = dia2526.filas.find((f) => f.producto === "soja")!;
    expect(soja.inicial).toBe(300); // no incluye la de 26/27
    expect(soja.netoDia).toBe(100);
    expect(soja.total).toBe(400);
  });
});

describe("evolucionFisico (pedido 06/08/2026 — curva acumulada en el tiempo)", () => {
  it("acumula por producto, ordenado por fecha, un punto por día", () => {
    const ops = [
      op({ fecha: "2026-08-01", producto: "soja", lado: "compra", volumen_tn: 200 }),
      op({ fecha: "2026-08-03", producto: "soja", lado: "venta", volumen_tn: 60 }),
      op({ fecha: "2026-08-02", producto: "maiz", lado: "compra", volumen_tn: 50 }),
      op({ fecha: "2026-08-01", producto: "soja", lado: "compra", volumen_tn: 40 }), // mismo día que el 1er punto
    ];
    const series = evolucionFisico(ops, "25/26");
    expect(series.map((s) => s.producto)).toEqual(["soja", "maiz"]); // orden del catálogo

    const soja = series.find((s) => s.producto === "soja")!;
    expect(soja.puntos).toEqual([
      { fecha: "2026-08-01", acumulado: 240 }, // 200 + 40, un solo punto ese día
      { fecha: "2026-08-03", acumulado: 180 }, // 240 − 60
    ]);
    const maiz = series.find((s) => s.producto === "maiz")!;
    expect(maiz.puntos).toEqual([{ fecha: "2026-08-02", acumulado: 50 }]);
  });

  it("respeta la campaña: no mezcla 25/26 con 26/27", () => {
    const ops = [
      op({ fecha: "2026-08-01", campania: "25/26", volumen_tn: 200 }),
      op({ fecha: "2026-08-02", campania: "26/27", volumen_tn: 90 }),
    ];
    const s2526 = evolucionFisico(ops, "25/26");
    expect(s2526.find((s) => s.producto === "soja")!.puntos).toEqual([{ fecha: "2026-08-01", acumulado: 200 }]);
    const s2627 = evolucionFisico(ops, "26/27");
    expect(s2627.find((s) => s.producto === "soja")!.puntos).toEqual([{ fecha: "2026-08-02", acumulado: 90 }]);
  });

  it("excluye anuladas, fijaciones y futuros_a3 (solo físico)", () => {
    const ops = [
      op({ fecha: "2026-08-01", volumen_tn: 500, anulada: true }),
      op({ fecha: "2026-08-01", volumen_tn: 500, tipo: "fijacion", precio_modo: "manual", precio: 320, moneda: "usd" }),
      op({ fecha: "2026-08-01", volumen_tn: 500, tipo: "futuro_a3", posicion_a3: "NOV26", precio_modo: "manual", precio: 320, moneda: "usd" }),
    ];
    expect(evolucionFisico(ops, "25/26")).toEqual([]);
  });

  it("sin operaciones de esa campaña: array vacío", () => {
    expect(evolucionFisico([op({ campania: "25/26" })], "26/27")).toEqual([]);
  });
});
