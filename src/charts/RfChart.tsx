"use client";

import * as React from "react";
import * as echarts from "echarts";
import { useTheme } from "next-themes";
import { nfmt } from "@/lib/format";
import { rofoLight, rofoDark, paletteFor } from "./rofoTheme";
import { ROFO_LOCALE_ID } from "./rofoLocale";

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

/** Ancho real (px) del endLabel más largo entre las series que lo tengan activado —
 *  corre el mismo formatter que va a dibujar ECharts, sobre el último punto de cada
 *  serie, y mide con la tipografía real. Sin esto, un endLabel más largo que el
 *  margen fijo del grid queda cortado (no es hipotético: "USDA 172,00" no entra en
 *  24px). 0 si ninguna serie tiene endLabel o no hay `document` (SSR). */
function medirAnchoEndLabels(series: unknown, fontFamily: string): number {
  if (!Array.isArray(series) || typeof document === "undefined") return 0;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return 0;
  ctx.font = `12px ${fontFamily}`;
  let max = 0;
  for (const raw of series) {
    const s = raw as {
      name?: string;
      data?: unknown[];
      endLabel?: { show?: boolean; formatter?: string | ((p: unknown) => string) };
    };
    if (!s?.endLabel?.show) continue;
    const data = Array.isArray(s.data) ? s.data : [];
    const value = data[data.length - 1];
    let texto = s.name ?? "";
    const formatter = s.endLabel.formatter;
    if (typeof formatter === "function") {
      try {
        texto = formatter({ seriesName: s.name, value, data: value });
      } catch {
        // el formatter puede esperar una forma de params más rica (CallbackDataParams
        // real) que este mock parcial no cubre — degradamos al nombre de la serie.
      }
    } else if (typeof formatter === "string") {
      texto = formatter.replace("{a}", s.name ?? "");
    }
    const w = ctx.measureText(texto).width;
    if (w > max) max = w;
  }
  return max;
}

/** Margen derecho del grid: el mayor entre el mínimo por ancho de pantalla (más
 *  ancho en mobile, <560px, mismo corte que el resto del sitio) y lo que realmente
 *  necesitan los endLabel para no cortarse. */
function rightMarginFor(containerWidth: number, series: unknown, fontFamily: string): number {
  const base = containerWidth < 560 ? 60 : 24;
  const porLabels = medirAnchoEndLabels(series, fontFamily) + 16;
  return Math.max(base, porLabels);
}

function hexConAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  const grupo = m?.[1];
  if (!grupo) return hex;
  const n = parseInt(grupo, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 1 sola serie sin color propio → verde institucional (`brandDeep`), igual que
 *  TODOS los charts SVG a mano existentes (`.cv-line`). La paleta categórica del
 *  tema (los 8 colores de campaña, validados con `dataviz/validate_palette.js`)
 *  es para 2+ series — mezclarla con brandDeep como "serie 1" rompía el chequeo
 *  de contraste en modo oscuro (medido), así que el caso de 1 serie se resuelve
 *  acá, no en el theme. Si ya trae `itemStyle`/`lineStyle` propios, no se toca. */
function aplicarColorSerieUnica(series: unknown, brandDeep: string): unknown {
  if (!Array.isArray(series) || series.length !== 1) return series;
  const s = series[0] as Record<string, unknown>;
  if (s?.itemStyle || s?.lineStyle) return series;
  const conArea = s?.areaStyle !== undefined;
  return [
    {
      ...s,
      itemStyle: { color: brandDeep },
      lineStyle: s.type === "line" ? { color: brandDeep, width: 2 } : undefined,
      ...(conArea
        ? {
            areaStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: hexConAlpha(brandDeep, 0.2) },
                  { offset: 1, color: hexConAlpha(brandDeep, 0) },
                ],
              },
            },
          }
        : {}),
    },
  ];
}

/** La label del axisPointer de un eje `type:'time'` llega como epoch en ms (no
 *  como Date ni como string ya formateado — `LabelFormatterParams` de ECharts no
 *  expone el tipo de eje). Un ms reciente son ~1,7-1,8×10¹²; nada de lo que
 *  grafica este sitio (precios, tasas, toneladas) se acerca a 10¹¹, así que la
 *  magnitud alcanza para distinguir "es una fecha" sin más información. */
function formatearValorEje(value: unknown): string {
  const n = Number(value);
  if (Number.isFinite(n) && n > 1e11) {
    return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(
      new Date(n),
    );
  }
  return String(value);
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
  // `option` de la última vez que de verdad se aplicó un setOption — no un simple
  // flag "ya montó": React corre los 2 effects de abajo en el MISMO commit inicial,
  // así que un flag booleano seteado dentro del 1º ya lee `true` en el 2º del mismo
  // pase, y el 2º dispara igual (2 setOption casi simultáneos en cada montaje). No
  // era la causa del artefacto de la marca de agua (ver `buildWatermark` más abajo),
  // pero sigue siendo un setOption redundante real — vale la pena evitarlo igual.
  const lastAppliedOptionRef = React.useRef<echarts.EChartsOption | null>(null);
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const fmt = React.useMemo<RfValueFormatter>(() => valueFormatter ?? ((v: number) => nfmt(v, 2)), [valueFormatter]);

  // PNG pre-rasterizado, NO el .svg del logo: el artefacto gris relleno adentro de
  // la "A" (y potencialmente otras letras con contorno hueco) es un bug real de
  // Chromium, confirmado aislado de React/ECharts-lifecycle por completo — un
  // `echarts.init()` mínimo, sin líneas, con un solo `setOption` de un `graphic`
  // tipo imagen apuntando al .svg a opacity:0.22, reproduce el mismo relleno de
  // forma NO determinística (5 corridas idénticas, ~1 de cada 2-3 con el defecto) —
  // a opacity:1 nunca aparece. Es el decodificador SVG-a-canvas de Chromium
  // rasterizando mal un path compuesto (el hueco triangular de la "A" es una
  // sub-path del mismo `<path>`, no un elemento aparte) cuando además tiene que
  // componer alpha — no tiene nada que ver con el timing de los effects de acá
  // arriba. Un intento anterior de esta misma sesión ya había probado un PNG y
  // "no arregló nada" porque ese PNG salió de rasterizar el propio SVG con
  // Chromium (captura/canvas) — heredaba el mismo bug ya horneado en los píxeles.
  // Este PNG sale de `sharp`/librsvg (offline, sin Chromium de por medio) — 5/5
  // corridas limpias una vez cambiado. Los `.svg` siguen vivos para `chart-marca.tsx`
  // (un `<img>` común, no pasa por canvas — no le aplica este bug).
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
              image: mode === "dark" ? "/rofoagro-logo-marca-oscuro.png" : "/rofoagro-logo-marca-claro.png",
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
      const series = Array.isArray(option.series) ? option.series : option.series ? [option.series] : [];
      // Legend siempre presente para 2+ series (regla no-negociable de la skill
      // dataviz) — ninguna para 1 sola serie, ahí el título ya dice qué es.
      const conLegend = series.length >= 2;
      // yAxis con zoom al rango real de los datos (nunca forzado a arrancar en 0)
      // salvo que haya una serie de barras, donde el 0 es honesto/necesario para
      // no falsear la comparación de longitudes.
      const soloLineas = series.length > 0 && series.every((s) => (s as { type?: string })?.type !== "bar");
      const defaults: echarts.EChartsOption = {
        animationDuration: 700,
        textStyle: { fontFamily: ui },
        grid: { right: rightMarginFor(containerWidth, option.series, mono), top: conLegend ? 44 : 28 },
        xAxis: { nameTextStyle: { fontFamily: ui }, axisLabel: { fontFamily: mono, hideOverlap: true } },
        yAxis: {
          scale: soloLineas,
          nameTextStyle: { fontFamily: ui },
          axisLabel: { fontFamily: mono, hideOverlap: true },
        },
        legend: conLegend
          ? {
              top: 6,
              left: "center",
              icon: "roundRect",
              itemWidth: 14,
              itemHeight: 3,
              itemGap: 18,
              textStyle: { color: p.ink2, fontFamily: ui, fontSize: 11.5 },
            }
          : undefined,
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
                params.axisDimension === "y" ? fmt(Number(params.value), "") : formatearValorEje(params.value),
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
                  // Line-key (rayita), no el marker circular default de ECharts: mismo
                  // lenguaje que `.cv-legend .sw` (14px×2.5px) en todo el resto del sitio.
                  `<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;padding:1.5px 0;">
                    <span style="display:inline-flex;align-items:center;gap:6px">
                      <span style="display:inline-block;width:12px;height:2.5px;border-radius:2px;background:${p2.color}"></span>
                      ${p2.seriesName}
                    </span>
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
          // Sutil por default (no compite con los datos), full al pasar el mouse.
          iconStyle: { borderColor: p.ink3, opacity: 0.45 },
          emphasis: { iconStyle: { borderColor: p.ink, opacity: 1 } },
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
      // `deepMerge` reemplaza arrays enteros (no los mergea elemento a elemento) — un yAxis de
      // doble eje (array de 2, charts combinados $+%) perdería enteros los defaults compartidos
      // (fuente mono, hideOverlap, scale) si no se los inyecta ACÁ, antes del merge de más abajo.
      const yAxisConDefaults = Array.isArray(option.yAxis)
        ? option.yAxis.map((e) => deepMerge(defaults.yAxis as Record<string, unknown>, e))
        : option.yAxis;
      const withAxes: echarts.EChartsOption = {
        ...option,
        xAxis: conNombre(option.xAxis, xTitle, 30),
        yAxis: conNombre(yAxisConDefaults, yTitle, Array.isArray(yTitle) ? 52 : 46),
        series: aplicarColorSerieUnica(option.series, p.brandDeep) as echarts.EChartsOption["series"],
      };
      return deepMerge(defaults, withAxes);
    },
    [mode, option, xTitle, yTitle, dataZoom, exportName, fmt, buildWatermark],
  );

  // Siempre apunta al `buildOption` más nuevo — lo usan el ResizeObserver y el
  // montaje inicial, que viven dentro de un effect con deps propias ([mode]) y
  // no pueden depender de `option`/`xTitle`/etc. sin recrear la instancia entera.
  const buildOptionRef = React.useRef(buildOption);
  React.useLayoutEffect(() => {
    buildOptionRef.current = buildOption;
  });

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = echarts.init(el, mode === "dark" ? "rofoDark" : "rofoLight", { locale: ROFO_LOCALE_ID });
    chartRef.current = chart;
    chart.setOption(buildOptionRef.current(el.clientWidth));
    mountedOnceRef.current = true;
    lastAppliedOptionRef.current = option;

    // ResizeObserver dispara su callback inicial ni bien arranca `observe()`
    // (comportamiento estándar, reporta el tamaño que ya tenías) — ese primer
    // disparo es 100% redundante con el `setOption` del montaje de arriba (mismo
    // ancho, mismo option). Ignorarlo evita un `setOption(..., notMerge:true)` de
    // más en cada montaje (no era la causa del artefacto de la marca de agua — eso
    // era el bug de Chromium documentado en `buildWatermark` — pero sigue siendo
    // trabajo innecesario real, vale la pena evitarlo igual).
    let primerDisparo = true;
    const ro = new ResizeObserver(() => {
      if (primerDisparo) {
        primerDisparo = false;
        return;
      }
      chart.resize();
      // Reconstruye entera (silenciosa): grid.right y la marca de agua dependen
      // del ancho, y así nunca queda un `option` de closure vieja.
      chart.setOption({ ...buildOptionRef.current(el.clientWidth), animation: false }, true);
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
      mountedOnceRef.current = false;
    };
    // Re-crea la instancia al cambiar de tema: el theme de ECharts se fija en el
    // init, no se puede "recolorear" en caliente con setOption. `option` se lee
    // solo para guardar la referencia en `lastAppliedOptionRef` (no dispara nada
    // si cambia) — deliberadamente afuera de las deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  React.useEffect(() => {
    if (!mountedOnceRef.current || !chartRef.current || !containerRef.current) return;
    // El mount/cambio de tema (effect de arriba) ya aplicó ESTE mismo `option` en
    // el mismo commit — sin este check se dispara un 2º setOption casi inmediato
    // (ver comentario en `lastAppliedOptionRef`).
    if (option === lastAppliedOptionRef.current) return;
    lastAppliedOptionRef.current = option;
    // Update silencioso (sin animación): Fase 2 regla 8, solo el montaje inicial anima.
    // Deps explícitas (no `buildOption` entero): un cambio de `mode` ya dispara el
    // efecto de arriba (dispose+init con animación) — repetirlo acá lo pisaría.
    chartRef.current.setOption({ ...buildOption(containerRef.current.clientWidth), animation: false }, true);
    // `buildOption` deliberadamente afuera: cambia también cuando cambia `mode`, y ese
    // caso ya lo maneja el effect de arriba (dispose+init con animación) — sumarlo acá
    // dispararía un 2º setOption silencioso inmediatamente después que pisaría esa
    // animación de entrada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option, xTitle, yTitle, dataZoom]);

  return (
    <div className={`chart-wrap rf-chart${className ? ` ${className}` : ""}`} role="img" aria-label={ariaLabel}>
      <div ref={containerRef} className="rf-chart-canvas" style={{ width: "100%", height }} />
    </div>
  );
}
