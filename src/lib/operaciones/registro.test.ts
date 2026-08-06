import { describe, it, expect } from "vitest";
import {
  normalizarVolumen,
  campaniaActualIniYear,
  campaniaLabel,
  campaniasVigentes,
  campaniaValida,
  validarOperacion,
  sumarDiasISO,
  elegirPizarraSiguiente,
  aplicarDescuentos,
  resolverPrecio,
  type OperacionInputRaw,
} from "./registro";

const BASE: OperacionInputRaw = {
  fecha: "2026-08-05",
  lado: "compra",
  producto: "soja",
  tipo: "disponible",
  condicion: "",
  campania: "25/26",
  volumen: 100,
  precioModo: "manual",
  precio: 320,
  moneda: "usd",
  descuentoPct: null,
  descuentoMonto: null,
  entregaDesde: "",
  entregaHasta: "",
  posicionA3: "",
  contraparte: "",
  nroContrato: "",
  observaciones: "",
};

describe("normalizarVolumen", () => {
  it("tn queda igual, redondeado a 2 decimales", () => {
    expect(normalizarVolumen(150.456, "tn")).toBe(150.46);
  });
  it("kg → tn dividiendo por 1000", () => {
    expect(normalizarVolumen(28500, "kg")).toBe(28.5);
  });
});

describe("campañas (§7.7)", () => {
  it("octubre en adelante: la campaña nueva ya arrancó (siembra gruesa)", () => {
    expect(campaniaActualIniYear("2026-10-01")).toBe(2026);
    expect(campaniaActualIniYear("2026-12-15")).toBe(2026);
  });
  it("antes de octubre: sigue vigente la del año anterior (evidencia real: Lautoro" +
    ' escribió "25/26 ; 26/27" como ejemplo el 05/08/2026)', () => {
    expect(campaniaActualIniYear("2026-08-05")).toBe(2025);
    expect(campaniaActualIniYear("2026-01-15")).toBe(2025);
  });
  it("campaniaLabel formatea AA/AA", () => {
    expect(campaniaLabel(2025)).toBe("25/26");
    expect(campaniaLabel(1999)).toBe("99/00");
  });
  it("campaniasVigentes trae anterior/actual/siguiente en orden", () => {
    expect(campaniasVigentes("2026-08-05")).toEqual(["24/25", "25/26", "26/27"]);
  });
  it("campaniaValida acepta AA/AA y rechaza el resto", () => {
    expect(campaniaValida("25/26")).toBe(true);
    expect(campaniaValida("2025/26")).toBe(false);
    expect(campaniaValida("25-26")).toBe(false);
    expect(campaniaValida("")).toBe(false);
  });
});

describe("validarOperacion — casos base", () => {
  it("acepta una operación disponible con precio manual", () => {
    const r = validarOperacion(BASE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.volumen_tn).toBe(100);
      expect(r.data.precio).toBe(320);
      expect(r.data.condicion).toBeNull();
      expect(r.data.posicion_a3).toBeNull();
    }
  });

  it("rechaza fecha inválida", () => {
    const r = validarOperacion({ ...BASE, fecha: "05/08/2026" });
    expect(r.ok).toBe(false);
  });

  it("rechaza volumen <= 0", () => {
    const r = validarOperacion({ ...BASE, volumen: 0 });
    expect(r.ok).toBe(false);
  });

  it("rechaza campaña con formato inválido", () => {
    const r = validarOperacion({ ...BASE, campania: "2025/26" });
    expect(r.ok).toBe(false);
  });
});

describe("validarOperacion — fijación (§1.2/§7.1)", () => {
  it("una fijación exige precio manual", () => {
    const r = validarOperacion({ ...BASE, tipo: "fijacion", precioModo: "pizarra", moneda: "usd" });
    expect(r.ok).toBe(false);
  });
  it("fijación con precio manual pasa, y no lleva vínculo a ningún contrato (sin campo posible)", () => {
    const r = validarOperacion({ ...BASE, tipo: "fijacion" });
    expect(r.ok).toBe(true);
  });
});

describe("validarOperacion — condición a fijar sin precio (pedido 06/08/2026)", () => {
  it("un disponible a fijar con precio manual se rechaza", () => {
    const r = validarOperacion({ ...BASE, condicion: "a_fijar" });
    expect(r.ok).toBe(false);
  });
  it("un forward a fijar con pizarra se rechaza", () => {
    const r = validarOperacion({
      ...BASE, tipo: "forward", condicion: "a_fijar", entregaDesde: "2026-11-01", precioModo: "pizarra",
    });
    expect(r.ok).toBe(false);
  });
  it("un disponible a fijar SIN precio pasa", () => {
    const r = validarOperacion({ ...BASE, condicion: "a_fijar", precioModo: "sin_precio", precio: null, moneda: "" });
    expect(r.ok).toBe(true);
  });
  it("la fijación misma no se ve afectada (sigue exigiendo manual)", () => {
    const r = validarOperacion({ ...BASE, tipo: "fijacion", condicion: "a_fijar" });
    expect(r.ok).toBe(true);
  });
});

describe("validarOperacion — forward (§5.2)", () => {
  it("exige entrega_desde", () => {
    const r = validarOperacion({ ...BASE, tipo: "forward" });
    expect(r.ok).toBe(false);
  });
  it("acepta con entrega_desde, entrega_hasta opcional", () => {
    const r = validarOperacion({ ...BASE, tipo: "forward", entregaDesde: "2026-11-01" });
    expect(r.ok).toBe(true);
  });
  it("rechaza hasta anterior a desde", () => {
    const r = validarOperacion({
      ...BASE, tipo: "forward", entregaDesde: "2026-11-15", entregaHasta: "2026-11-01",
    });
    expect(r.ok).toBe(false);
  });
});

describe("validarOperacion — futuro A3", () => {
  it("exige posición y precio manual", () => {
    expect(validarOperacion({ ...BASE, tipo: "futuro_a3" }).ok).toBe(false);
    expect(
      validarOperacion({ ...BASE, tipo: "futuro_a3", posicionA3: "NOV26", precioModo: "sin_precio", precio: null }).ok,
    ).toBe(false);
  });
  it("rechaza girasol/sorgo (sin futuro A3)", () => {
    const r = validarOperacion({ ...BASE, producto: "girasol", tipo: "futuro_a3", posicionA3: "NOV26" });
    expect(r.ok).toBe(false);
  });
  it("acepta soja/maíz/trigo con posición válida", () => {
    const r = validarOperacion({ ...BASE, tipo: "futuro_a3", posicionA3: "nov26" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.posicion_a3).toBe("NOV26"); // normaliza a mayúscula
  });
});

describe("validarOperacion — descuentos combinables (§7.4)", () => {
  it("acepta % y monto a la vez", () => {
    const r = validarOperacion({ ...BASE, precioModo: "pizarra", precio: null, descuentoPct: 10, descuentoMonto: 38000, moneda: "ars" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.descuento_pct).toBe(10);
      expect(r.data.descuento_monto).toBe(38000);
    }
  });
  it("rechaza % fuera de rango", () => {
    const r = validarOperacion({ ...BASE, descuentoPct: 150 });
    expect(r.ok).toBe(false);
  });
});

describe("sumarDiasISO", () => {
  it("suma días corridos cruzando de mes", () => {
    expect(sumarDiasISO("2026-08-28", 7)).toBe("2026-09-04");
  });
});

describe("elegirPizarraSiguiente (§5.4/§7.3)", () => {
  const candidatas = [
    { fecha: "2026-08-05", precio_ars: 100, precio_usd: 10 }, // mismo día: NUNCA aplica
    { fecha: "2026-08-06", precio_ars: 101, precio_usd: 10.1 }, // el día siguiente: la buena
    { fecha: "2026-08-10", precio_ars: 105, precio_usd: 10.5 },
  ];
  it("elige la primera con fecha posterior a la operación", () => {
    const r = elegirPizarraSiguiente("2026-08-05", candidatas);
    expect(r?.fecha).toBe("2026-08-06");
  });
  it("respeta el tope de 7 días — más allá, queda pendiente", () => {
    const lejos = [{ fecha: "2026-08-20", precio_ars: 200, precio_usd: 20 }];
    expect(elegirPizarraSiguiente("2026-08-05", lejos)).toBeNull();
  });
  it("sin candidatas, pendiente", () => {
    expect(elegirPizarraSiguiente("2026-08-05", [])).toBeNull();
  });
});

describe("aplicarDescuentos", () => {
  it("aplica % y después monto fijo, en ese orden", () => {
    // 100 −10% = 90; 90 − 5 = 85
    expect(aplicarDescuentos(100, 10, 5)).toBe(85);
  });
  it("sin descuentos, devuelve la base", () => {
    expect(aplicarDescuentos(100, null, null)).toBe(100);
  });
});

describe("resolverPrecio", () => {
  it("manual: aplica descuentos sobre el precio cargado", () => {
    const r = resolverPrecio({ precio_modo: "manual", precio: 320, moneda: "usd", descuento_pct: 10, descuento_monto: null }, null);
    expect(r).toEqual({ estado: "manual", valor: 288 });
  });
  it("sin_precio: siempre 'sin_precio'", () => {
    expect(resolverPrecio({ precio_modo: "sin_precio", precio: null, moneda: null, descuento_pct: null, descuento_monto: null }, null))
      .toEqual({ estado: "sin_precio" });
  });
  it("pizarra sin fila siguiente todavía: pendiente", () => {
    const r = resolverPrecio({ precio_modo: "pizarra", precio: null, moneda: "usd", descuento_pct: null, descuento_monto: null }, null);
    expect(r).toEqual({ estado: "pizarra_pendiente" });
  });
  it("pizarra resuelta: toma la moneda elegida y aplica descuentos", () => {
    const pizarra = { fecha: "2026-08-06", precio_ars: 300000, precio_usd: 320 };
    const r = resolverPrecio({ precio_modo: "pizarra", precio: null, moneda: "usd", descuento_pct: 10, descuento_monto: null }, pizarra);
    expect(r).toEqual({ estado: "pizarra_resuelta", valor: 288, fechaPizarra: "2026-08-06" });
  });
});
