"use client";

import * as React from "react";
import * as echarts from "echarts";
import { useTheme } from "next-themes";
import { nfmt } from "@/lib/format";
import { rofoLight, rofoDark, paletteFor } from "./rofoTheme";

// `ThemeOption` no está exportado en los tipos públicos de echarts (limitación
// conocida del paquete) — el objeto es estructuralmente válido igual, se registra tal cual.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
echarts.registerTheme("rofoLight", rofoLight as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
echarts.registerTheme("rofoDark", rofoDark as any);

/** Resuelve `var(--font-mono)`/`var(--font-ui)` al string real que generó next/font
 *  (con hash de build) — no hay forma de copiarlo como literal sin arriesgar que
 *  quede desactualizado en cada build. Cacheado a nivel de módulo: es el mismo
 *  valor para toda la sesión, no hace falta recalcularlo por cada chart. */
let cachedFonts: { mono: string; ui: string } | null = null;
function resolveFonts(): { mono: string; ui: string } {
  if (cachedFonts) return cachedFonts;
  if (typeof document === "undefined") return { mono: "monospace", ui: "sans-serif" };
  const probe = document.createElement("span");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  document.body.appendChild(probe);
  probe.style.fontFamily = "var(--font-mono)";
  const mono = getComputedStyle(probe).fontFamily || "monospace";
  probe.style.fontFamily = "var(--font-ui)";
  const ui = getComputedStyle(probe).fontFamily || "sans-serif";
  document.body.removeChild(probe);
  cachedFonts = { mono, ui };
  return cachedFonts;
}

/** Merge profundo simple: objetos planos se combinan recursivamente: arrays y
 *  primitivos del `override` reemplazan entero al valor de `base` (dos ejes en
 *  un array de 2, p.ej., se reemplazan completos — no tiene sentido mezclar
 *  arrays de configuración de ECharts posición por posición). */
function deepMerge<T>(base: T, override: unknown): T {
  if (override === undefined) return base;
  if (Array.isArray(base) || Array.isArray(override) || typeof base !== "object" || base === null) {
    return override as T;
  }
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(override as Record<string, unknown>)) {
    const ov = (override as Record<string, unknown>)[key];
    const bv = result[key];
    result[key] =
      bv && typeof bv === "object" && !Array.isArray(bv) && ov && typeof ov === "object" && !Array.isArray(ov)
        ? deepMerge(bv, ov)
        : ov;
  }
  return result as T;
}

/** Aplica `name`/`nameLocation`/`nameGap` a un eje (objeto único o array de 2,
 *  para charts de doble eje) sin pisar lo que el caller ya haya puesto. Tipado
 *  laxo a propósito: xAxis/yAxis son estructuralmente iguales para este fin,
 *  pero ECharts les da tipos nominales incompatibles entre sí. */
function conNombre<T>(eje: T, titulos: string | [string, string] | undefined, gapDefault: number): T {
  if (!titulos || !eje) return eje;
  const arr = Array.isArray(titulos) ? titulos : [titulos];
  if (Array.isArray(eje)) {
    return eje.map((e: Record<string, unknown>, i: number) => ({
      ...e,
      name: arr[i] ?? e.name,
      nameLocation: e.nameLocation ?? "middle",
      nameGap: e.nameGap ?? gapDefault,
    })) as T;
  }
  const e = eje as Record<string, unknown>;
  return { ...e, name: arr[0], nameLocation: "middle", nameGap: e.nameGap ?? gapDefault } as T;
}

/** Margen derecho del grid: más ancho en mobile (<560px, mismo corte que el resto
 *  del sitio) para que el endLabel (nombre de la serie) no quede cortado. */
function rightMarginFor(containerWidth: number): number {
  return containerWidth < 560 ? 60 : 24;
}

export type RfValueFormatter = (value: number, seriesName: string) => string;

export type RfChartProps = {
  /** Config específica del chart: xAxis/yAxis/series (y dataset/legend si hace falta).
   *  RfChart la fusiona con sus defaults de tema/tooltip/toolbox/marca de agua —
   *  cualquier campo que el caller pase acá (ej. `tooltip.formatter` propio) gana. */
  option: echarts.EChartsOption;
  ariaLabel: string;
  /** Título del eje X, con la unidad entre paréntesis. Obligatorio. */
  xTitle: string;
  /** Título del eje Y (o [izq, der] si el chart tiene doble eje). Obligatorio. */
  yTitle: string | [string, string];
  height?: number;
  watermarkSize?: "normal" | "chico";
  /** Nombre de archivo (sin extensión) para el botón "Guardar imagen" del toolbox. */
  exportName?: string;
  /** dataZoom deslizable inferior — SOLO series diarias largas (>~90 puntos, Fase 2 regla 7). */
  dataZoom?: boolean;
  valueFormatter?: RfValueFormatter;
  className?: string;
};

export function RfChart({
  option,
  ariaLabel,
  xTitle,
  yTitle,
  height = 320,
  watermarkSize = "normal",
  exportName = "grafico-rofoagro",
  dataZoom = false,
  valueFormatter,
  className,
}: RfChartProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const chartRef = React.useRef<echarts.ECharts | null>(null);
  const mountedOnceRef = React.useRef(false);
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const fmt = React.useMemo<RfValueFormatter>(() => valueFormatter ?? ((v: number) => nfmt(v, 2)), [valueFormatter]);

  const buildWatermark = React.useCallback(
    (containerWidth: number): echarts.EChartsOption["graphic"] => {
      const chico = watermarkSize === "chico";
      const min = chico ? 110 : 170;
      const max = chico ? 200 : 440;
      const w = Math.min(max, Math.max(min, containerWidth * (chico ? 0.32 : 0.55)));
      return {
        elements: [
          {
            id: "rf-watermark",
            type: "image",
            style: {
              image: mode === "dark" ? "/rofoagro-logo-marca-oscuro.svg" : "/rofoagro-logo-marca-claro.svg",
              width: w,
              height: w,
              opacity: mode === "dark" ? 0.22 : 0.2,
            },
            left: "center",
            top: "middle",
            silent: true,
            z: -10,
          },
        ],
      } as echarts.EChartsOption["graphic"];
    },
    [mode, watermarkSize],
  );

  const buildOption = React.useCallback(
    (containerWidth: number): echarts.EChartsOption => {
      const { mono, ui } = resolveFonts();
      const p = paletteFor(mode);
      const defaults: echarts.EChartsOption = {
        animationDuration: 700,
        textStyle: { fontFamily: ui },
        grid: { right: rightMarginFor(containerWidth) },
        xAxis: { nameTextStyle: { fontFamily: ui }, axisLabel: { fontFamily: mono } },
        yAxis: { nameTextStyle: { fontFamily: ui }, axisLabel: { fontFamily: mono } },
        tooltip: {
          trigger: "axis",
          axisPointer: {
            type: "cross",
            label: {
              backgroundColor: p.tipBg,
              color: p.tipInk,
              fontFamily: mono,
              borderColor: p.tipEdge,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- LabelFormatterParams de echarts no expone axisDimension de forma utilizable en su firma pública
              formatter: (params: any) =>
                params.axisDimension === "y" ? fmt(Number(params.value), "") : String(params.value),
            },
            crossStyle: { color: p.gridStrong },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          textStyle: { fontFamily: mono, fontSize: 11.5, fontWeight: 600 },
          padding: [6, 10],
          formatter: (params: unknown) => {
            const arr = (Array.isArray(params) ? params : [params]) as Array<{
              axisValueLabel?: string;
              seriesName: string;
              value: unknown;
              color: string;
              marker: string;
            }>;
            if (arr.length === 0) return "";
            const filas = arr
              .filter((p2) => p2.value !== undefined && p2.value !== null)
              .map((p2) => {
                const raw = Array.isArray(p2.value) ? p2.value[p2.value.length - 1] : p2.value;
                const num = Number(raw);
                return { ...p2, num: Number.isFinite(num) ? num : -Infinity };
              })
              .sort((a, b) => b.num - a.num)
              .map(
                (p2) =>
                  `<div style="display:flex;justify-content:space-between;gap:14px;padding:1.5px 0;">
                    <span>${p2.marker}${p2.seriesName}</span>
                    <b style="margin-left:10px">${Number.isFinite(p2.num) ? fmt(p2.num, p2.seriesName) : "—"}</b>
                  </div>`,
              )
              .join("");
            const header = arr[0]?.axisValueLabel;
            return `${header ? `<div style="color:${p.gold};font-weight:700;margin-bottom:3px">${header}</div>` : ""}${filas}`;
          },
        },
        toolbox: {
          show: true,
          right: 8,
          bottom: 0,
          itemSize: 13,
          iconStyle: { borderColor: p.ink3 },
          emphasis: { iconStyle: { borderColor: p.ink } },
          feature: {
            dataZoom: { title: { zoom: "Zoom", back: "Restablecer" }, yAxisIndex: "none" as const },
            saveAsImage: {
              title: "Guardar imagen",
              name: exportName,
              backgroundColor: p.panel,
              pixelRatio: 2,
            },
          },
        },
        dataZoom: dataZoom
          ? [
              { type: "inside", filterMode: "none" },
              {
                type: "slider",
                height: 16,
                bottom: 26,
                borderColor: "transparent",
                backgroundColor: "transparent",
                fillerColor:
                  mode === "dark" ? "rgba(239,191,46,.12)" : "rgba(158,120,16,.10)",
                handleStyle: { color: p.gold, borderColor: p.gold },
                textStyle: { color: p.ink3, fontFamily: mono, fontSize: 9.5 },
                filterMode: "none",
              },
            ]
          : undefined,
        graphic: buildWatermark(containerWidth),
      };
      const withAxes: echarts.EChartsOption = {
        ...option,
        xAxis: conNombre(option.xAxis, xTitle, 30),
        yAxis: conNombre(option.yAxis, yTitle, Array.isArray(yTitle) ? 52 : 46),
      };
      return deepMerge(defaults, withAxes);
    },
    [mode, option, xTitle, yTitle, dataZoom, exportName, fmt, buildWatermark],
  );

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = echarts.init(el, mode === "dark" ? "rofoDark" : "rofoLight");
    chartRef.current = chart;
    chart.setOption(buildOption(el.clientWidth));
    mountedOnceRef.current = true;

    const ro = new ResizeObserver(() => {
      chart.resize();
      // Solo lo que depende del ANCHO, sin tocar el resto de la option (evita
      // reaplicar un `option`/`xTitle` de closure viejo si cambiaron mientras
      // tanto — esos ya los mantiene al día el effect de abajo).
      chart.setOption(
        { grid: { right: rightMarginFor(el.clientWidth) }, graphic: buildWatermark(el.clientWidth) },
        false,
      );
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
      mountedOnceRef.current = false;
    };
    // Re-crea la instancia al cambiar de tema: el theme de ECharts se fija en el
    // init, no se puede "recolorear" en caliente con setOption.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  React.useEffect(() => {
    if (!mountedOnceRef.current || !chartRef.current || !containerRef.current) return;
    // Update silencioso (sin animación): Fase 2 regla 8, solo el montaje inicial anima.
    chartRef.current.setOption({ ...buildOption(containerRef.current.clientWidth), animation: false }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option, xTitle, yTitle, dataZoom]);

  return (
    <div className={`chart-wrap rf-chart${className ? ` ${className}` : ""}`} role="img" aria-label={ariaLabel}>
      <div ref={containerRef} className="rf-chart-canvas" style={{ width: "100%", height }} />
    </div>
  );
}
