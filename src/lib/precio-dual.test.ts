import { describe, it, expect } from "vitest";
import { tcImplicito, arsDesdeUsd, usdDesdeArs } from "./precio-dual";

describe("tcImplicito", () => {
  it("calcula ars/usd cuando hay los dos valores", () => {
    expect(tcImplicito(505500, 339.49)).toBeCloseTo(1489.0, 1);
  });
  it("null si falta ars", () => {
    expect(tcImplicito(null, 339.49)).toBeNull();
  });
  it("null si falta usd", () => {
    expect(tcImplicito(505500, null)).toBeNull();
  });
  it("null si usd es 0", () => {
    expect(tcImplicito(505500, 0)).toBeNull();
  });
});

describe("arsDesdeUsd / usdDesdeArs", () => {
  it("cruzan ida y vuelta (redondeo a 2 decimales)", () => {
    const tc = 1487.51;
    const usd = 999;
    const ars = arsDesdeUsd(usd, tc);
    expect(ars).toBeCloseTo(1486022.49, 2);
    expect(usdDesdeArs(ars, tc)).toBeCloseTo(usd, 1);
  });
});
