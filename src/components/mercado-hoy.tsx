import Link from "next/link";
import { getMonitorMercados, type MonitorRow } from "@/lib/monitor-mercados";
import { getArbitrajes } from "@/lib/arbitrajes-cierres";
import { getFuturosLive } from "@/lib/a3-live";
import { ruedaAgroCorrioHoy } from "@/lib/rueda";
import { hoyCordobaISO } from "@/lib/dates";
import { esModoOperado, referenciaDeFila } from "@/lib/referencia-futuro";
import { POSICIONES_AR_REF, resolverPosicionViva } from "@/lib/mercado-hoy-posiciones";
import { nfmt, pfmt, sfmt } from "@/lib/format";
import { Panel, PanelHead } from "./panel";
import { GlyphSoja, GlyphMaiz, GlyphTrigo } from "./icons";
import { SourceStamp } from "./source-stamp";

function IconMonitor() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 13h12M4 11V7M7 11V4M10 11V8M13 11V5" />
    </svg>
  );
}

function glyphFor(g: MonitorRow["glyph"] | "soja" | "maiz" | "trigo" | null) {
  if (g === "soja") return <GlyphSoja />;
  if (g === "maiz") return <GlyphMaiz />;
  if (g === "trigo") return <GlyphTrigo />;
  return null;
}
function glyphColor(g: MonitorRow["glyph"] | "soja" | "maiz" | "trigo" | null) {
  if (g === "soja") return "var(--brand-agro)";
  if (g === "maiz") return "var(--gold-text)";
  return "var(--brand-deep)";
}
function deltaClass(d: number | null) {
  return d == null ? "neu2" : d > 0 ? "pos" : d < 0 ? "neg" : "neu2";
}

type FilaAr = {
  key: string;
  nombre: string;
  glyph: "soja" | "maiz" | "trigo";
  pos: string;
  valor: number | null;
  variacion: number | null; // US$ vs ajuste anterior
  refMode: "operado" | "ajuste";
  vivo: boolean;
};

/**
 * "El mercado hoy" de la home, en dos bloques (relevamiento 29/07, punto 20):
 *   - ARGENTINA: las posiciones de referencia de A3 (Maíz JUL26 · Soja NOV26 y
 *     MAY27 · Trigo DIC26) con la MISMA regla de referencia que Arbitrajes —
 *     último operado del WebSocket si operó, sino el último ajuste
 *     (`referencia-futuro.ts`, sin lógica duplicada).
 *   - CHICAGO: los 5 de siempre en USD/tn (`getMonitorMercados()`).
 * Ambas fuentes ya están cache()adas por render (la cinta también las usa).
 */
export async function MercadoHoy() {
  const [data, arb, live] = await Promise.all([getMonitorMercados(), getArbitrajes(), getFuturosLive()]);

  const ruedaCorrio = ruedaAgroCorrioHoy();
  const hoy = hoyCordobaISO();
  const liveOk = live.respondidos > 0;

  const filasAr: FilaAr[] = POSICIONES_AR_REF.map(({ underlying, mes, nombre, glyph }) => {
    const g = arb.granos.find((x) => x.underlying === underlying) ?? null;
    const r = resolverPosicionViva(mes, g?.rows ?? []);
    const p = r ? live.puntas.get(r.symbol) : undefined;
    const modoOperado = esModoOperado({ ruedaCorrio, ajusteEsDeHoy: g?.fecha === hoy, liveOk });
    const rf = referenciaDeFila({
      modoOperado,
      last: p?.last ?? null,
      ajuste: r?.ajuste ?? null,
      variacionCierre: r?.variacion ?? null,
      volLive: p?.vol ?? null,
    });
    return {
      key: `${underlying}-${mes}`,
      nombre,
      glyph,
      pos: r?.pos ?? mes,
      valor: rf.ref,
      variacion: rf.variacion,
      refMode: rf.refMode,
      vivo: rf.vivo,
    };
  });

  return (
    <Panel id="mercado-hoy">
      <PanelHead
        glyph={<IconMonitor />}
        title="El mercado hoy"
        sub="Argentina (A3) y Chicago en USD/tn"
        stamp={<SourceStamp meta={data.meta} />}
      />

      <div className="mh-sub-hd">Argentina — Matba Rofex</div>
      <div className="mh-grid">
        {filasAr.map((f) => (
          <div className="mh-cell" key={f.key}>
            <div className="mh-hd">
              <span className="mh-glyph" style={{ color: glyphColor(f.glyph) }}>{glyphFor(f.glyph)}</span>
              <span className="mh-name">{f.nombre}</span>
              <span className="mh-pos">
                {f.pos}
                {f.vivo && <span className="mh-vivo" title="Último operado en vivo" aria-label="en vivo" />}
              </span>
            </div>
            <div className="mh-val">
              {f.valor != null ? nfmt(f.valor, 1) : "—"}
              <span className="mh-unit">USD/tn</span>
            </div>
            <div className={`mh-delta ${deltaClass(f.variacion)}`} title={f.refMode === "operado" ? "vs ajuste anterior (en rueda)" : "vs cierre anterior"}>
              {f.variacion != null ? `${sfmt(f.variacion, 2)} US$` : "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="mh-sub-hd">Chicago — CBOT · futuros demorados ~10 min</div>
      <div className="mh-grid">
        {data.agro.map((r) => (
          <div className="mh-cell" key={r.yahoo}>
            <div className="mh-hd">
              <span className="mh-glyph" style={{ color: glyphColor(r.glyph) }}>{glyphFor(r.glyph)}</span>
              <span className="mh-name">{r.nombre}</span>
              {r.pos && <span className="mh-pos">{r.pos}</span>}
            </div>
            <div className="mh-val">
              {r.usdTn != null ? nfmt(r.usdTn, 1) : "—"}
              <span className="mh-unit">USD/tn</span>
            </div>
            <div className={`mh-delta ${deltaClass(r.deltaPct)}`}>{pfmt(r.deltaPct, 2)}</div>
          </div>
        ))}
      </div>

      <div className="panel-note">
        <span>
          <span className="k">Referencia</span> Argentina: futuro A3 (último operado en rueda, ajuste fuera de rueda) —
          el detalle está en <Link href="/granos/arbitrajes" className="cal-inline-link">Arbitrajes</Link>. Chicago: el precio
          que marca a tu grano, en dólares por tonelada — el detalle (posición operada, petróleo, oro, real, S&amp;P) está en{" "}
          <Link href="/granos/monitor" className="cal-inline-link">el monitor</Link>.
        </span>
      </div>
    </Panel>
  );
}
