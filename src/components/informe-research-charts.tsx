import { pfmt, nfmt } from "@/lib/format";
import { nicePercentDomain, type DesfasajeFila, type TnaBarra } from "@/lib/informe-research";

/**
 * Gráficos SVG a mano de la plantilla "Research" del informe diario — mismo
 * espíritu que los charts del sitio (`evolucion-chart.tsx` etc.), pero
 * standalone: esta plantilla es una página aislada para screenshotear, sin
 * el tema claro/oscuro del sitio (paleta fija oscura, igual al diseño).
 */

const A3_COLOR = "#98CE66";
const CHI_COLOR = "#4E7C52";
const GRID = "rgba(168,198,160,.13)";
const ZERO_LINE = "rgba(239,191,46,.55)";
const MUTED = "#86987E";
const INK = "#EDF4E7";
const POS = "#37D982";
const NEG = "#FF5C5C";
const FONT_MONO = "'Source Code Pro',monospace";
const FONT_UI = "'Source Sans 3',sans-serif";

function colorDe(v: number | null): string {
  if (v == null || v === 0) return MUTED;
  return v > 0 ? POS : NEG;
}

/** Gráfico 1 — "El desfasaje": barras divergentes A3 (ayer) vs Chicago (hoy) por grano. */
export function DesfasajeChart({ filas }: { filas: DesfasajeFila[] }) {
  const valores = filas.flatMap((f) => [f.a3Pct, f.chiPct]).filter((v): v is number => v != null);
  const maxAbs = valores.length > 0 ? Math.max(...valores.map(Math.abs)) : 2;
  const domain = nicePercentDomain(maxAbs);

  const width = 700;
  const cx = 330;
  const halfWidth = 190;
  const scale = halfWidth / domain;
  const bandTop = (i: number) => 14 + i * 50;
  const height = bandTop(filas.length - 1) + 44 + 14;
  const ticks = [-domain, -domain / 2, 0, domain / 2, domain];

  const barra = (val: number | null) => {
    if (val == null) return null;
    const w = Math.abs(val) * scale;
    const x = val >= 0 ? cx : cx - w;
    return { x, w };
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <g fontFamily={FONT_MONO} fontSize={9} fill={MUTED}>
        {ticks.map((t, i) => (
          <text key={i} x={cx + (t / domain) * halfWidth} y={height - 6} textAnchor="middle">
            {t === 0 ? "0" : pfmt(t, 0)}
          </text>
        ))}
      </g>
      <g stroke={GRID} strokeDasharray="1 5" strokeLinecap="round">
        {ticks
          .filter((t) => t !== 0)
          .map((t, i) => {
            const x = cx + (t / domain) * halfWidth;
            return <line key={i} x1={x} y1={10} x2={x} y2={height - 24} />;
          })}
      </g>
      <line x1={cx} y1={6} x2={cx} y2={height - 20} stroke={ZERO_LINE} strokeWidth={1} />

      {filas.map((f, i) => {
        const top = bandTop(i);
        const a3 = barra(f.a3Pct);
        const chi = barra(f.chiPct);
        return (
          <g key={f.underlying}>
            <text x={0} y={top + 12} fontFamily={FONT_UI} fontSize={11} fontWeight={700} fill={INK}>
              {f.nombre.toUpperCase()}
            </text>
            <text x={0} y={top + 25} fontFamily={FONT_MONO} fontSize={8.5} fill={MUTED}>
              {f.posLabel ?? "—"}
            </text>

            {a3 && (
              <>
                <rect x={a3.x} y={top} width={a3.w} height={13} fill={A3_COLOR} rx={2} />
                <text
                  x={f.a3Pct! >= 0 ? a3.x + a3.w + 8 : a3.x - 8}
                  y={top + 10}
                  textAnchor={f.a3Pct! >= 0 ? "start" : "end"}
                  fontFamily={FONT_MONO}
                  fontSize={9.5}
                  fontWeight={700}
                  fill={colorDe(f.a3Pct)}
                >
                  {pfmt(f.a3Pct, 2)}
                </text>
              </>
            )}
            {chi && (
              <>
                <rect x={chi.x} y={top + 17} width={chi.w} height={13} fill={CHI_COLOR} rx={2} />
                <text
                  x={f.chiPct! >= 0 ? chi.x + chi.w + 8 : chi.x - 8}
                  y={top + 27}
                  textAnchor={f.chiPct! >= 0 ? "start" : "end"}
                  fontFamily={FONT_MONO}
                  fontSize={9.5}
                  fontWeight={700}
                  fill={colorDe(f.chiPct)}
                >
                  {pfmt(f.chiPct, 2)}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Gráfico 2 — "Dónde rinde el tiempo": TNA implícita, barras horizontales grano + USD. */
export function TnaChart({ filas }: { filas: TnaBarra[] }) {
  const width = 330;
  const leftPad = 98;
  const rightPad = 20;
  const chartW = width - leftPad - rightPad;
  const maxVal = filas.length > 0 ? Math.max(...filas.map((f) => f.valor)) : 10;
  const domain = nicePercentDomain(maxVal);
  const scale = chartW / domain;
  const bandTop = (i: number) => 12 + i * 29;
  const height = bandTop(Math.max(filas.length - 1, 0)) + 12 + 30;
  const ticks = [domain / 2, domain];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <g stroke={GRID} strokeDasharray="1 5" strokeLinecap="round">
        {ticks.map((t, i) => {
          const x = leftPad + t * scale;
          return <line key={i} x1={x} y1={6} x2={x} y2={height - 24} />;
        })}
      </g>
      <g fontFamily={FONT_MONO} fontSize={8.5} fill={MUTED}>
        {ticks.map((t, i) => (
          <text key={i} x={leftPad + t * scale} y={height - 8} textAnchor="middle">
            {nfmt(t, 0)}%
          </text>
        ))}
      </g>
      <line x1={leftPad} y1={6} x2={leftPad} y2={height - 20} stroke="rgba(168,198,160,.2)" />

      {filas.map((f, i) => {
        const top = bandTop(i);
        const w = Math.min(f.valor, domain) * scale;
        const fill = f.tono === "usd" ? "#EFBF2E" : CHI_COLOR;
        const labelFill = f.tono === "usd" ? "#EFBF2E" : A3_COLOR;
        const nameFill = f.tono === "usd" ? "#EFBF2E" : "#ADBFA6";
        return (
          <g key={f.key}>
            <text x={0} y={top + 8} fontFamily={FONT_MONO} fontSize={9} fill={nameFill}>
              {f.label.toUpperCase()}
            </text>
            <rect x={leftPad} y={top} width={w} height={12} fill={fill} rx={2} opacity={f.tono === "usd" ? 0.85 : 1} />
            <text
              x={leftPad + w + 8}
              y={top + 9}
              fontFamily={FONT_MONO}
              fontSize={9.5}
              fontWeight={700}
              fill={labelFill}
            >
              {nfmt(f.valor, 2)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
