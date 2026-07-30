/**
 * Tema ECharts único del sitio: `rofoLight` y `rofoDark`.
 *
 * Los colores son copia LITERAL de los tokens de `src/app/globals.css` (bloques
 * `:root` y `:root[data-theme="dark"]`, líneas ~28-92) — no se inventa ninguna
 * paleta nueva. Si esos tokens cambian, hay que reflejarlo acá también (no hay
 * forma de leer custom properties CSS dentro de un theme de ECharts, que es un
 * objeto JS plano registrado una sola vez al cargar el módulo).
 *
 * La tipografía SÍ se resuelve en runtime (`resolveFonts` en `RfChart.tsx`),
 * porque `next/font` genera nombres de clase con hash en build — no hay un
 * string estático que copiar acá sin arriesgarse a que quede desactualizado.
 *
 * Paleta de series (orden fijo, Fase 2 del prompt de migración):
 *   1) verde institucional (`--brand-deep`) · 2) dorado (`--gold-text`) ·
 *   3) gris neutro (`--neu`) · 4-11) los 8 colores de campaña `--camp-2020..2027`
 *   ya usados en los charts multi-año existentes (williams-chart, condicion-panel).
 */

export interface RofoPalette {
  bg: string;
  panel: string;
  panel2: string;
  ink: string;
  ink2: string;
  ink3: string;
  gold: string;
  goldText: string;
  goldHair: string;
  pos: string;
  neg: string;
  neu: string;
  grid: string;
  gridStrong: string;
  tipBg: string;
  tipInk: string;
  tipEdge: string;
  brandDeep: string;
  camp: string[];
}

const light: RofoPalette = {
  bg: "#EDF2E3",
  panel: "#FCFDF8",
  panel2: "#F4F8EB",
  ink: "#17251B",
  ink2: "#44553D",
  ink3: "#5B6C51",
  gold: "#EFBF2E",
  goldText: "#8A6608",
  goldHair: "rgba(158,120,16,.38)",
  pos: "#16A34A",
  neg: "#DC2626",
  neu: "#7E8C74",
  grid: "rgba(47,74,42,.16)",
  gridStrong: "rgba(47,74,42,.30)",
  tipBg: "#17251B",
  tipInk: "#F4F8EB",
  tipEdge: "rgba(239,191,46,.35)",
  brandDeep: "#2F6E34",
  camp: ["#2A78D6", "#D96A2A", "#0891B2", "#B45309", "#DB5A9B", "#9333EA", "#0F9E8C", "#7C4FD0"],
};

const dark: RofoPalette = {
  bg: "#050807",
  panel: "#0C130D",
  panel2: "#111A12",
  ink: "#EDF4E7",
  ink2: "#ADBFA6",
  ink3: "#86987E",
  gold: "#EFBF2E",
  goldText: "#EFBF2E",
  goldHair: "rgba(239,191,46,.30)",
  pos: "#37D982",
  neg: "#FF5C5C",
  neu: "#8B9E85",
  grid: "rgba(168,198,160,.13)",
  gridStrong: "rgba(168,198,160,.28)",
  tipBg: "#111A12",
  tipInk: "#EDF4E7",
  tipEdge: "rgba(239,191,46,.30)",
  brandDeep: "#98CE66",
  camp: ["#3987E5", "#D95926", "#0AA2C0", "#BE6A1C", "#DB639E", "#A55BEA", "#0FA38E", "#9085E9"],
};

function buildTheme(p: RofoPalette) {
  const axisCommon = {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: p.ink3, fontSize: 10.5 },
    splitLine: { show: false },
    nameTextStyle: { color: p.ink3, fontSize: 11 },
  };
  return {
    color: [p.brandDeep, p.goldText, p.neu, ...p.camp],
    backgroundColor: "transparent",
    textStyle: { color: p.ink },
    grid: { left: 48, right: 24, top: 28, bottom: 56, containLabel: true },
    categoryAxis: axisCommon,
    valueAxis: {
      ...axisCommon,
      splitLine: { show: true, lineStyle: { color: p.grid, type: [1, 5] as [number, number] } },
    },
    line: { itemStyle: { borderWidth: 1.8 }, lineStyle: { width: 1.8 }, symbol: "circle", symbolSize: 6 },
    bar: { itemStyle: { borderRadius: 0 } },
    legend: { textStyle: { color: p.ink2 } },
    tooltip: {
      backgroundColor: p.tipBg,
      borderColor: p.tipEdge,
      borderWidth: 1,
      textStyle: { color: p.tipInk },
      extraCssText: "box-shadow:0 2px 6px -2px rgba(0,0,0,.35),0 12px 26px -10px rgba(0,0,0,.55); border-radius:6px;",
    },
  };
}

export const rofoLight = buildTheme(light);
export const rofoDark = buildTheme(dark);

export const rofoPaletteLight = light;
export const rofoPaletteDark = dark;

export function paletteFor(mode: "light" | "dark"): RofoPalette {
  return mode === "dark" ? dark : light;
}
