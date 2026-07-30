import type { Metadata } from "next";
import { getCierresGranos } from "@/lib/futuros";
import { getPizarra } from "@/lib/pizarra";
import { getDolarFuturo } from "@/lib/market";
import { getMonitorMercados } from "@/lib/monitor-mercados";
import { getArbitrajes } from "@/lib/arbitrajes-cierres";
import { getEventos } from "@/lib/calendario";
import { hoyCordobaISO } from "@/lib/dates";
import { tokenValido, esFechaValida } from "@/lib/informe-auth";
import { nfmt, pfmt, horaCordoba } from "@/lib/format";
import {
  buildDesfasaje,
  buildTnaImplicita,
  buildTresCifras,
  buildReferenciaPizarra,
  buildVolumenA3,
  buildComplejoSoja,
} from "@/lib/informe-research";
import { getCopyResearch } from "@/lib/informe-research-copy";
import { DesfasajeChart, TnaChart } from "@/components/informe-research-charts";

/**
 * Plantilla "Research" del informe diario — formato one-pager tipo research
 * de ALyC (Claude Design "Informe Research P2", implementado 30/07/2026,
 * prototipo a pedido de Lautaro). Página standalone (sin header/nav del
 * sitio), gateada por el mismo `INFORME_TOKEN` que `/informes/plantilla/diario`
 * y `/api/informes/datos`. Paleta SIEMPRE oscura (fija, no depende del tema
 * del sitio ni de next-themes: el screenshot es headless).
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const INK = "#EDF4E7";
const INK2 = "#ADBFA6";
const INK3 = "#86987E";
const GOLD = "#EFBF2E";
const BRAND_RF = "#6FB544";
const BRAND_AGRO = "#98CE66";
const LINE = "rgba(168,198,160,.14)";
const LINE_GOLD = "rgba(239,191,46,.3)";
const PANEL = "#0C130D";
const PANEL_2 = "#111A12";

const SANS = "'Source Sans 3',system-ui,sans-serif";
const SERIF = "'Source Serif 4',Georgia,serif";
const MONO = "'Source Code Pro',monospace";

function toneColor(tono: "pos" | "neg" | "gold"): string {
  return tono === "pos" ? "#37D982" : tono === "neg" ? "#FF5C5C" : GOLD;
}

function diaLegible(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00-03:00`);
  const s = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Cordoba",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function PlantillaResearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  if (!tokenValido(token, process.env.INFORME_TOKEN ?? "")) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui" }}>
        <p>No autorizado.</p>
      </main>
    );
  }

  const hoy = hoyCordobaISO();
  const fechaParam = typeof sp.fecha === "string" ? sp.fecha : "";
  const fecha = esFechaValida(fechaParam) ? fechaParam : hoy;
  const [d, m, a] = fecha.split("-");
  const fechaCorta = `${d}.${m}.${a}`;

  const [cierres, pizarra, dolarFuturo, chicago, arbitrajes] = await Promise.all([
    getCierresGranos(),
    getPizarra(),
    getDolarFuturo(),
    getMonitorMercados(),
    getArbitrajes(),
  ]);

  const desfasaje = buildDesfasaje(cierres, chicago);
  const tna = buildTnaImplicita(arbitrajes, dolarFuturo);
  const tresCifras = buildTresCifras(chicago, dolarFuturo);
  const referenciaPizarra = buildReferenciaPizarra(pizarra);
  const volumenA3 = buildVolumenA3(cierres);
  const complejoSoja = buildComplejoSoja(chicago);
  const eventos = getEventos(fecha, fecha).slice(0, 3);

  const copy = getCopyResearch(fecha);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        background: "#11150f",
        minHeight: "100vh",
      }}
    >
      <section
        style={{
          width: 816,
          minHeight: 1056,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: "30px 38px 24px",
          background: "#050807",
          color: INK,
          fontFamily: SANS,
          fontSize: 11,
          lineHeight: 1.45,
          boxSizing: "border-box",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático, no <Image> en una plantilla standalone. */}
            <img src="/rofoagro-isotipo.svg" alt="ROFO AGRO" style={{ height: 26, width: "auto", display: "block" }} />
            <span
              style={{
                fontFamily: SERIF,
                fontWeight: 600,
                fontSize: 17,
                fontVariant: "small-caps",
                letterSpacing: ".01em",
                lineHeight: 1,
              }}
            >
              <span style={{ color: BRAND_RF }}>Rofo</span> <span style={{ color: BRAND_AGRO }}>Agro</span>
            </span>
            <span
              style={{
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: ".14em",
                color: INK3,
                fontWeight: 700,
                paddingLeft: 9,
                borderLeft: "1px solid rgba(168,198,160,.2)",
              }}
            >
              Research · mercado de granos
            </span>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 9.5, color: INK3, letterSpacing: ".06em" }}>{fechaCorta}</span>
        </div>

        {/* Tesis del día + Las tres cifras */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.55fr 1fr",
            gap: 30,
            alignItems: "start",
            paddingBottom: 16,
            borderBottom: `1px solid ${LINE_GOLD}`,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: ".18em",
                color: GOLD,
                marginBottom: 11,
              }}
            >
              La tesis del día
            </div>
            <h1
              style={{
                margin: "0 0 10px",
                fontFamily: SERIF,
                fontWeight: 600,
                fontSize: 26,
                lineHeight: 1.14,
                letterSpacing: "-.015em",
              }}
            >
              {copy?.tesisTitulo ?? "Sin tesis cargada todavía para hoy"}
            </h1>
            <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: INK2 }}>
              {copy?.tesisParrafo ??
                "Esta edición es un prototipo del formato Research: la tesis del día todavía no se redactó a mano. Los datos de abajo (desfasaje A3/Chicago, TNA implícita, pizarra, volumen) son en vivo."}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 9,
              padding: "14px 16px",
              background: PANEL,
              border: `1px solid ${LINE}`,
              borderRadius: 10,
            }}
          >
            <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".14em", color: INK3 }}>
              Las tres cifras
            </div>
            {tresCifras.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                  paddingBottom: i < tresCifras.length - 1 ? 8 : 0,
                  borderBottom: i < tresCifras.length - 1 ? "1px solid rgba(168,198,160,.1)" : "none",
                }}
              >
                <span style={{ fontSize: 9.5, color: INK2 }}>{c.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: toneColor(c.tono) }}>
                  {pfmt(c.pct, 2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico 1: el desfasaje */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", color: INK2 }}>
              1 · El desfasaje — variación del último ajuste A3 contra el último cierre de Chicago
            </span>
            <span style={{ display: "flex", gap: 12, fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: INK3 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 12, height: 8, background: BRAND_AGRO, borderRadius: 2, display: "inline-block" }} />
                Matba/A3
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 12, height: 8, background: "#4E7C52", borderRadius: 2, display: "inline-block" }} />
                Chicago
              </span>
            </span>
          </div>
          <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 14px" }}>
            <DesfasajeChart filas={desfasaje} />
          </div>
        </div>

        {/* Gráfico 2 + lectura */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", color: INK2, marginBottom: 8 }}>
              2 · Dónde rinde el tiempo — TNA implícita
            </div>
            <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 14px" }}>
              <TnaChart filas={tna} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", color: INK2 }}>
              Lo que se lee acá
            </div>
            {copy && copy.lectura.length > 0 ? (
              copy.lectura.map((l, i) => (
                <p key={i} style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: INK2 }}>
                  <span style={{ fontFamily: SERIF, fontVariant: "small-caps", fontWeight: 600, fontSize: 12.5, color: INK }}>
                    {l.titulo}.{" "}
                  </span>
                  {l.texto}
                </p>
              ))
            ) : (
              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: INK3 }}>
                Sin prosa cargada todavía — los números de arriba y de la franja de abajo son reales.
              </p>
            )}
          </div>
        </div>

        {/* Franja de referencia */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
          <div>
            <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em", color: INK3, marginBottom: 6 }}>
              Referencia · pizarra CAC
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, fontFamily: MONO, fontSize: 10, color: INK2 }}>
              {referenciaPizarra.map((r) => (
                <div key={r.nombre} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{r.nombre}</span>
                  <span style={{ color: INK }}>{r.usd != null ? `US$${nfmt(r.usd, 1)}` : "—"}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em", color: INK3, marginBottom: 6 }}>
              Volumen A3 · contratos
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, fontFamily: MONO, fontSize: 10, color: INK2 }}>
              {volumenA3.map((v) => (
                <div key={v.nombre} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{v.nombre}</span>
                  <span style={{ color: v.destacado ? BRAND_AGRO : INK }}>
                    {v.contratos != null ? nfmt(v.contratos, 0) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em", color: INK3, marginBottom: 6 }}>
              Complejo soja · Chicago
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, fontFamily: MONO, fontSize: 10, color: INK2 }}>
              {complejoSoja.map((c) => (
                <div key={c.nombre} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{c.nombre}</span>
                  <span style={{ color: c.deltaPct != null ? toneColor(c.deltaPct >= 0 ? "pos" : "neg") : INK2 }}>
                    {pfmt(c.deltaPct, 2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Agenda */}
        {eventos.length > 0 && (
          <div style={{ paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", color: INK2, marginBottom: 8 }}>
              Qué puede mover la pizarra · {diaLegible(fecha)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(eventos.length, 3)},1fr)`, gap: 12 }}>
              {eventos.map((e, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 12px",
                    background: PANEL_2,
                    borderLeft: `2px solid ${i === 0 ? GOLD : `rgba(239,191,46,${0.55 - i * 0.2})`}`,
                    borderRadius: "0 7px 7px 0",
                  }}
                >
                  <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: GOLD }}>{e.horaArg ?? "—"}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2 }}>{e.organismo}</div>
                  <div style={{ fontSize: 9.5, color: INK3, lineHeight: 1.35 }}>{e.informe}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: 12,
            borderTop: `1px solid ${LINE_GOLD}`,
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <p style={{ margin: 0, fontSize: 9, color: INK3, lineHeight: 1.4, maxWidth: "74ch" }}>
            Fuentes: Matba/A3, CME/CBOT, MAE (dólar mayorista y futuros), CAC-BCR. Research informativo de{" "}
            <span style={{ fontVariant: "small-caps", fontFamily: SERIF, fontWeight: 600, fontSize: 10.5, color: BRAND_AGRO }}>
              Rofo Agro
            </span>{" "}
            — no constituye recomendación de inversión.
          </p>
          <span style={{ fontFamily: MONO, fontSize: 9, color: INK3, whiteSpace: "nowrap" }}>
            Datos al {horaCordoba(new Date(), false)}
          </span>
        </div>
      </section>
    </div>
  );
}
