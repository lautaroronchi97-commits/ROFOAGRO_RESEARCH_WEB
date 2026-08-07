import { describe, it, expect } from "vitest";
import {
  normalizarVolumen,
  campaniaActualIniYear,
  campaniaLabel,
  campaniasVigentes,
  campaniaValida,
  validarOperacion,
  precioModoDeCondicion,
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
  condicion: "a_precio",
  campania: "25/26",
  volumen: 100,
  precio: 320,
  moneda: "usd",
  descuentoPct: null,
  descuentoMonto: null,
  comisionPct: null,
  entregaDesde: "",
  entregaHasta: "",
  fijacionDesde: "",
  fijacionHasta: "",
  posicionA3: "",
  esCanje: false,
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

describe("precioModoDeCondicion (pedido de Lautoro 06/08/2026)", () => {
  it("a_fijar → sin_precio", () => {
    expect(precioModoDeCondicion("a_fijar")).toBe("sin_precio");
  });
  it("pizarra → pizarra", () => {
    expect(precioModoDeCondicion("pizarra")).toBe("pizarra");
  });
  it("a_precio y pago_anticipado → manual", () => {
    expect(precioModoDeCondicion("a_precio")).toBe("manual");
    expect(precioModoDeCondicion("pago_anticipado")).toBe("manual");
  });
});

describe("validarOperacion — casos base", () => {
  it("acepta una operación disponible a precio manual", () => {
    const r = validarOperacion(BASE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.volumen_tn).toBe(100);
      expect(r.data.precio).toBe(320);
      expect(r.data.precio_modo).toBe("manual");
      expect(r.data.condicion).toBe("a_precio");
      expect(r.data.posicion_a3).toBeNull();
      expect(r.data.es_canje).toBe(false);
      expect(r.data.fijacion_desde).toBeNull();
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

  it("es_canje pasa a data.es_canje tal cual", () => {
    const r = validarOperacion({ ...BASE, esCanje: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.es_canje).toBe(true);
  });
});

describe("validarOperacion — condición (pedido de Lautoro 06/08/2026)", () => {
  it("disponible admite cualquiera de las 4 condiciones", () => {
    for (const condicion of ["a_fijar", "a_precio", "pago_anticipado", "pizarra"]) {
      const base = condicion === "a_fijar" ? { precio: null, moneda: "", fijacionDesde: "2026-08-05" } : {};
      const r = validarOperacion({ ...BASE, condicion, ...base });
      expect(r.ok, `disponible + ${condicion}`).toBe(true);
    }
  });
  it("forward admite cualquiera de las 4 condiciones", () => {
    for (const condicion of ["a_fijar", "a_precio", "pago_anticipado", "pizarra"]) {
      const base = condicion === "a_fijar" ? { precio: null, moneda: "", fijacionDesde: "2026-08-05" } : {};
      const r = validarOperacion({ ...BASE, tipo: "forward", entregaDesde: "2026-11-01", condicion, ...base });
      expect(r.ok, `forward + ${condicion}`).toBe(true);
    }
  });

  it("rechaza un disponible/forward sin condición", () => {
    const r = validarOperacion({ ...BASE, condicion: "" });
    expect(r.ok).toBe(false);
  });

  it("rechaza una condición desconocida", () => {
    const r = validarOperacion({ ...BASE, condicion: "carta_garantia" });
    expect(r.ok).toBe(false);
  });

  it('condición "pizarra": sin precio manual, exige moneda', () => {
    const r = validarOperacion({ ...BASE, condicion: "pizarra", precio: null, moneda: "usd" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.precio_modo).toBe("pizarra");
      expect(r.data.precio).toBeNull();
    }
  });
  it('condición "pizarra" sin moneda se rechaza', () => {
    const r = validarOperacion({ ...BASE, condicion: "pizarra", precio: null, moneda: "" });
    expect(r.ok).toBe(false);
  });

  it('condición "pago_anticipado" se comporta como "a_precio" (precio manual)', () => {
    const r = validarOperacion({ ...BASE, condicion: "pago_anticipado" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.precio_modo).toBe("manual");
  });
});

describe('validarOperacion — condición "a fijar" (pedido 06/08/2026, ampliado)', () => {
  it('condición "a_fijar" ignora cualquier precio/moneda que venga en el input — el precio SIEMPRE sale null', () => {
    const r = validarOperacion({ ...BASE, condicion: "a_fijar", fijacionDesde: "2026-08-05" }); // BASE trae precio:320/moneda:usd
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.precio_modo).toBe("sin_precio");
      expect(r.data.precio).toBeNull();
    }
  });
  it("un disponible a fijar sin precio ni moneda pasa, y exige fijación desde", () => {
    const r = validarOperacion({ ...BASE, condicion: "a_fijar", precio: null, moneda: "", fijacionDesde: "" });
    expect(r.ok).toBe(false); // falta fijacionDesde
  });
  it("con fijación desde, pasa — sin precio, con el período guardado", () => {
    const r = validarOperacion({
      ...BASE, condicion: "a_fijar", precio: null, moneda: "", fijacionDesde: "2026-08-05", fijacionHasta: "2026-09-30",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.precio_modo).toBe("sin_precio");
      expect(r.data.fijacion_desde).toBe("2026-08-05");
      expect(r.data.fijacion_hasta).toBe("2026-09-30");
    }
  });
  it("fijación hasta es libre (opcional) — sin ella, queda null (abierta)", () => {
    const r = validarOperacion({
      ...BASE, condicion: "a_fijar", precio: null, moneda: "", fijacionDesde: "2026-08-05", fijacionHasta: "",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.fijacion_hasta).toBeNull();
  });
  it("rechaza fijación hasta anterior a desde", () => {
    const r = validarOperacion({
      ...BASE, condicion: "a_fijar", precio: null, moneda: "", fijacionDesde: "2026-08-20", fijacionHasta: "2026-08-01",
    });
    expect(r.ok).toBe(false);
  });
});

describe("validarOperacion — fijación (§1.2/§7.1, restringida a pizarra/a_precio desde 06/08/2026)", () => {
  it("una fijación con condición a_precio exige precio manual", () => {
    const r = validarOperacion({ ...BASE, tipo: "fijacion", condicion: "a_precio" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.precio_modo).toBe("manual");
  });
  it("una fijación con condición pizarra AHORA se acepta (antes se rechazaba siempre)", () => {
    const r = validarOperacion({ ...BASE, tipo: "fijacion", condicion: "pizarra", precio: null, moneda: "usd" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.precio_modo).toBe("pizarra");
  });
  it("rechaza una fijación con condición a_fijar o pago_anticipado", () => {
    expect(validarOperacion({ ...BASE, tipo: "fijacion", condicion: "a_fijar" }).ok).toBe(false);
    expect(validarOperacion({ ...BASE, tipo: "fijacion", condicion: "pago_anticipado" }).ok).toBe(false);
  });
  it("rechaza una fijación sin condición", () => {
    const r = validarOperacion({ ...BASE, tipo: "fijacion", condicion: "" });
    expect(r.ok).toBe(false);
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
  it("no usa condición — mandarla se rechaza", () => {
    const r = validarOperacion({ ...BASE, tipo: "futuro_a3", condicion: "a_precio", posicionA3: "NOV26" });
    expect(r.ok).toBe(false);
  });
  it("exige posición y precio manual", () => {
    expect(validarOperacion({ ...BASE, tipo: "futuro_a3", condicion: "" }).ok).toBe(false);
  });
  it("rechaza girasol/sorgo (sin futuro A3)", () => {
    const r = validarOperacion({ ...BASE, producto: "girasol", tipo: "futuro_a3", condicion: "", posicionA3: "NOV26" });
    expect(r.ok).toBe(false);
  });
  it("rechaza expeller de soja/aceite de soja (sin futuro A3)", () => {
    expect(
      validarOperacion({ ...BASE, producto: "expeller_soja", tipo: "futuro_a3", condicion: "", posicionA3: "NOV26" }).ok,
    ).toBe(false);
    expect(
      validarOperacion({ ...BASE, producto: "aceite_soja", tipo: "futuro_a3", condicion: "", posicionA3: "NOV26" }).ok,
    ).toBe(false);
  });
  it("acepta soja/maíz/trigo con posición válida", () => {
    const r = validarOperacion({ ...BASE, tipo: "futuro_a3", condicion: "", posicionA3: "nov26" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.posicion_a3).toBe("NOV26"); // normaliza a mayúscula
      expect(r.data.condicion).toBeNull();
      expect(r.data.precio_modo).toBe("manual");
    }
  });
});

describe("validarOperacion — descuentos combinables (§7.4)", () => {
  it("acepta % y monto a la vez", () => {
    const r = validarOperacion({
      ...BASE, condicion: "pizarra", precio: null, descuentoPct: 10, descuentoMonto: 38000, moneda: "ars",
    });
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
  it("acepta comisión % junto con los descuentos", () => {
    const r = validarOperacion({ ...BASE, descuentoPct: 10, descuentoMonto: 38000, comisionPct: 1.5 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.comision_pct).toBe(1.5);
  });
  it("rechaza comisión % fuera de rango", () => {
    const r = validarOperacion({ ...BASE, comisionPct: 150 });
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
  it("comisión %: se aplica como reducción independiente, antes del monto fijo", () => {
    // 100 −10% = 90; 90 −1,5% comisión = 88,65; 88,65 − 5 = 83,65
    expect(aplicarDescuentos(100, 10, 5, 1.5)).toBeCloseTo(83.65, 5);
  });
  it("solo comisión, sin descuento ni monto", () => {
    expect(aplicarDescuentos(100, null, null, 2)).toBe(98);
  });
});

describe("resolverPrecio", () => {
  it("manual: aplica descuentos sobre el precio cargado y expone el base", () => {
    const r = resolverPrecio(
      { precio_modo: "manual", precio: 320, moneda: "usd", descuento_pct: 10, descuento_monto: null, comision_pct: null },
      null,
    );
    expect(r).toEqual({ estado: "manual", base: 320, valor: 288 });
  });
  it("manual con comisión: se descuenta junto con el % y el monto", () => {
    const r = resolverPrecio(
      { precio_modo: "manual", precio: 320, moneda: "usd", descuento_pct: null, descuento_monto: null, comision_pct: 1.5 },
      null,
    );
    expect(r).toEqual({ estado: "manual", base: 320, valor: 320 * (1 - 1.5 / 100) });
  });
  it("sin_precio: siempre 'sin_precio'", () => {
    expect(
      resolverPrecio(
        { precio_modo: "sin_precio", precio: null, moneda: null, descuento_pct: null, descuento_monto: null, comision_pct: null },
        null,
      ),
    ).toEqual({ estado: "sin_precio" });
  });
  it("pizarra sin fila siguiente todavía: pendiente", () => {
    const r = resolverPrecio(
      { precio_modo: "pizarra", precio: null, moneda: "usd", descuento_pct: null, descuento_monto: null, comision_pct: null },
      null,
    );
    expect(r).toEqual({ estado: "pizarra_pendiente" });
  });
  it("pizarra resuelta: toma la moneda elegida, aplica descuentos y expone el base", () => {
    const pizarra = { fecha: "2026-08-06", precio_ars: 300000, precio_usd: 320 };
    const r = resolverPrecio(
      { precio_modo: "pizarra", precio: null, moneda: "usd", descuento_pct: 10, descuento_monto: null, comision_pct: null },
      pizarra,
    );
    expect(r).toEqual({ estado: "pizarra_resuelta", base: 320, valor: 288, fechaPizarra: "2026-08-06" });
  });
});
