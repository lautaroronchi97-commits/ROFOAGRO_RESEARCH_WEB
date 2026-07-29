import { describe, expect, it } from "vitest";
import { esModoOperado, referenciaDeFila } from "./referencia-futuro";

describe("esModoOperado", () => {
  it("solo con rueda corrida, sin ajuste del día y con feed vivo", () => {
    expect(esModoOperado({ ruedaCorrio: true, ajusteEsDeHoy: false, liveOk: true })).toBe(true);
    expect(esModoOperado({ ruedaCorrio: false, ajusteEsDeHoy: false, liveOk: true })).toBe(false);
    expect(esModoOperado({ ruedaCorrio: true, ajusteEsDeHoy: true, liveOk: true })).toBe(false);
    expect(esModoOperado({ ruedaCorrio: true, ajusteEsDeHoy: false, liveOk: false })).toBe(false);
  });
});

describe("referenciaDeFila", () => {
  it("fuera de rueda: ajuste + variación del cierre, nunca vivo", () => {
    const r = referenciaDeFila({ modoOperado: false, last: 341, ajuste: 340, variacionCierre: 1.5, volLive: 10 });
    expect(r).toEqual({ ref: 340, refMode: "ajuste", vivo: false, variacion: 1.5 });
  });

  it("en rueda con operado: último operado + variación en vivo (last − ajuste)", () => {
    const r = referenciaDeFila({ modoOperado: true, last: 342.25, ajuste: 340, variacionCierre: 1.5, volLive: 3 });
    expect(r.ref).toBe(342.25);
    expect(r.refMode).toBe("operado");
    expect(r.vivo).toBe(true);
    expect(r.variacion).toBe(2.25);
  });

  it("en rueda sin operar todavía: referencia en blanco, sin variación fabricada", () => {
    const r = referenciaDeFila({ modoOperado: true, last: null, ajuste: 340, variacionCierre: 1.5, volLive: 0 });
    expect(r.ref).toBeNull();
    expect(r.vivo).toBe(false);
    expect(r.variacion).toBeNull();
  });

  it("en rueda con last arrastrado de otra rueda (vol 0): muestra el último operado pero NO lo marca vivo", () => {
    const r = referenciaDeFila({ modoOperado: true, last: 339.5, ajuste: 340, variacionCierre: null, volLive: 0 });
    expect(r.ref).toBe(339.5);
    expect(r.vivo).toBe(false);
    expect(r.variacion).toBe(-0.5);
  });
});
