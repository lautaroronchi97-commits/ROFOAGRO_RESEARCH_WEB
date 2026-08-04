import type { Metadata } from "next";
import { datosDiario, getBorrador } from "@/lib/informe-diario-datos";
import {
  buildDesfasaje,
  buildTnaImplicita,
  buildTresCifras,
  buildReferenciaPizarra,
  buildVolumenA3,
  buildComplejoSoja,
  chicagoDeGrano,
  GRANOS_INFO,
} from "@/lib/informe-research";
import { otrosMercadosRelevantes } from "@/lib/informe-v3-calc";
import { DesfasajeChart, TnaChart } from "@/components/informe-research-charts";
import { hoyCordobaISO } from "@/lib/dates";
import { tokenValido, esFechaValida } from "@/lib/informe-auth";
import { nfmt, pfmt, horaCordoba } from "@/lib/format";

/**
 * Plantilla "Research" del informe diario — one-pager tipo research de ALyC
 * (Claude Design "Informe Research P2", 30/07/2026). REORGANIZADA por producto
 * SOJA→MAÍZ→TRIGO con local/internacional SIEMPRE separados (N8 de
 * PLAN_INFORMES_V3.md §3/§5.1, requisito del Word de Lautaro), etapa E3.
 * Todo lo de la placa anterior sigue presente — nada se pierde, solo cambia el
 * formato (condición del 30/07). Página standalone (sin header/nav del sitio),
 * gateada por el mismo `INFORME_TOKEN` que `/api/informes/datos`. Paleta
 * SIEMPRE oscura (fija, no depende del tema del sitio: el screenshot es
 * headless). La prosa (tesis + "lo que se lee acá" + los campos manuales de la
 * mesa — pizarra estimada/volumen físico/condicionales) sale del MISMO
 * borrador `informes_generados` (tipo=diario) que arma el Paso 2/3 del skill
 * `informe-diario` — ver ese SKILL.md para el detalle de qué escribe. Los
 * datos automáticos salen de `datosDiario()` (`informe-diario-datos.ts`), la
 * MISMA función que usa `/api/informes/datos` — cero query duplicada.
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

/** Clave de `pizarra_historico`/`variacionPizarra` (minúscula, sin acento) por underlying. */
const GRANO_KEY: Record<string, string> = { SOJ: "soja", MAI: "maiz", TRI: "trigo" };

function toneColor(tono: "pos" | "neg" | "gold"): string {
  return tono === "pos" ? "#37D982" : tono === "neg" ? "#FF5C5C" : GOLD;
}
function toneOf(n: number | null | undefined): "pos" | "neg" | "gold" {
  return n == null ? "gold" : n >= 0 ? "pos" : "neg";
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: ".14em",
        color: GOLD,
        marginBottom: 8,
        paddingTop: 12,
        borderTop: `1px solid ${LINE_GOLD}`,
      }}
    >
      {children}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontFamily: MONO, fontSize: 10 }}>
      <span style={{ color: INK3 }}>{label}</span>
      <span style={{ color: color ?? INK }}>{value}</span>
    </div>
  );
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

  const [datos, borrador] = await Promise.all([datosDiario(fecha), getBorrador(fecha)]);
  const {
    cierres,
    arbitrajes,
    pizarra,
    dolarFuturo,
    chicago,
    noticias,
    agenda,
    color,
    bcra,
    informesHoy,
    interpretaciones,
    volumenCambiario,
    variacionPizarra,
    top3PorGrano,
  } = datos;

  const copy = borrador?.prosa ?? null;
  const desfasaje = buildDesfasaje(cierres, chicago);
  const tna = buildTnaImplicita(arbitrajes, dolarFuturo);
  const tresCifras = buildTresCifras(chicago, dolarFuturo);
  const referenciaPizarra = buildReferenciaPizarra(pizarra);
  const volumenA3 = buildVolumenA3(cierres);
  const complejoSoja = buildComplejoSoja(chicago);
  const otrosMercados = otrosMercadosRelevantes(chicago.macro);
  const eventos = agenda.slice(0, 3);
  const titulares = noticias.destacados.slice(0, 3);
  const volumenMaeUsd = volumenCambiario.cats.reduce((s, c) => s + c.volumenUsd, 0);

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
          gap: 14,
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
            paddingBottom: 14,
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
                fontSize: 25,
                lineHeight: 1.14,
                letterSpacing: "-.015em",
              }}
            >
              {copy?.tesisTitulo ?? "Sin tesis cargada todavía para hoy"}
            </h1>
            <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: INK2 }}>
              {copy?.tesisParrafo ??
                "Esta edición es un prototipo del formato Research: la tesis del día todavía no se redactó a mano. Los datos de abajo (por producto, local e internacional) son en vivo."}
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

        {/* ================= LOCAL ================= */}
        <SectionLabel>Local — por producto</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {GRANOS_INFO.map((g) => {
            const pzGrano = pizarra.granos[g.underlying];
            const deltaPz = variacionPizarra.find((v) => v.grano === GRANO_KEY[g.underlying]);
            const estimada = copy?.pizarraEstimada?.[g.underlying];
            const volFisico = copy?.volumenFisico?.[g.underlying];
            const top3 = top3PorGrano.find((t) => t.underlying === g.underlying);
            const tnaGrano = tna.find((t) => t.tono === "grano" && t.key === g.underlying);

            return (
              <div
                key={g.underlying}
                style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 7 }}
              >
                <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 13.5, fontVariant: "small-caps", color: INK }}>
                  {g.nombre}
                </div>

                <StatRow
                  label="Pizarra CAC USD"
                  value={pzGrano?.usd != null ? `US$${nfmt(pzGrano.usd, 1)}` : "—"}
                  color={deltaPz?.usd.deltaPct != null ? toneColor(toneOf(deltaPz.usd.deltaPct)) : undefined}
                />
                <StatRow
                  label="Δ pizarra $/USD"
                  value={
                    deltaPz && (deltaPz.ars.deltaPct != null || deltaPz.usd.deltaPct != null)
                      ? `${pfmt(deltaPz.ars.deltaPct, 1)} / ${pfmt(deltaPz.usd.deltaPct, 1)}`
                      : "—"
                  }
                />
                <StatRow
                  label="Estimada mesa"
                  value={
                    estimada?.usd != null
                      ? `US$${nfmt(estimada.usd, 1)}${estimada.deltaUsdPct != null ? ` (${pfmt(estimada.deltaUsdPct, 1)})` : ""}`
                      : "—"
                  }
                  color={estimada?.deltaUsdPct != null ? toneColor(toneOf(estimada.deltaUsdPct)) : undefined}
                />
                <StatRow
                  label="TNA impl. ref."
                  value={tnaGrano ? pfmt(tnaGrano.valor, 1) : "—"}
                  color={tnaGrano ? GOLD : undefined}
                />
                <StatRow label="Volumen físico" value={volFisico != null ? nfmt(volFisico, 0) : "—"} />

                <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 6, marginTop: 2 }}>
                  <div style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", color: INK3, marginBottom: 4 }}>
                    Top 3 posiciones A3
                  </div>
                  {top3 && top3.top3.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {top3.top3.map((f) => (
                        <div key={f.posicion} style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 9 }}>
                          <span style={{ color: INK2 }}>{f.posicion}</span>
                          <span style={{ color: INK }}>{f.ajuste != null ? nfmt(f.ajuste, 1) : "—"}</span>
                          <span style={{ color: f.deltaPct != null ? toneColor(toneOf(f.deltaPct)) : INK3 }}>{pfmt(f.deltaPct, 1)}</span>
                          <span style={{ color: INK3 }}>{f.volumen != null ? nfmt(f.volumen, 0) : "—"}</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 9, marginTop: 2, paddingTop: 2, borderTop: "1px solid rgba(168,198,160,.1)" }}>
                        <span style={{ color: INK3 }}>Total prod.</span>
                        <span style={{ color: BRAND_AGRO }}>{top3.volumenTotal != null ? nfmt(top3.volumenTotal, 0) : "—"}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 9, color: INK3 }}>Sin operado en vivo — fuera de rueda.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* LOCAL — transversal */}
        <SectionLabel>Local — transversal</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em", color: INK3, marginBottom: 2 }}>
              TC oficial mayorista
            </div>
            <StatRow
              label="Nivel"
              value={volumenCambiario.oficial != null ? nfmt(volumenCambiario.oficial, 2) : "—"}
            />
            <StatRow
              label="Δ del día"
              value={pfmt(volumenCambiario.oficialVarPct, 2)}
              color={volumenCambiario.oficialVarPct != null ? toneColor(toneOf(volumenCambiario.oficialVarPct)) : undefined}
            />
            <StatRow label="Vol. MAE USD" value={volumenMaeUsd > 0 ? `US$${nfmt(volumenMaeUsd / 1e6, 1)}M` : "—"} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em", color: INK3, marginBottom: 2 }}>
              Compras BCRA (MULC)
            </div>
            <StatRow
              label="Del día"
              value={bcra ? `US$${nfmt(bcra.monto_musd, 1)}M` : "—"}
              color={bcra ? BRAND_AGRO : undefined}
            />
            {copy?.condicionalDjve && (
              <p style={{ margin: "6px 0 0", fontSize: 9.5, color: INK2, lineHeight: 1.4 }}>
                <b style={{ color: INK }}>DJVE.</b> {copy.condicionalDjve}
              </p>
            )}
            {copy?.condicionalCamiones && (
              <p style={{ margin: "4px 0 0", fontSize: 9.5, color: INK2, lineHeight: 1.4 }}>
                <b style={{ color: INK }}>Camiones.</b> {copy.condicionalCamiones}
              </p>
            )}
          </div>
          <div>
            <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em", color: INK3, marginBottom: 6 }}>
              Dónde rinde el tiempo — TNA implícita (grano + carry USD)
            </div>
            <div style={{ background: PANEL_2, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px" }}>
              <TnaChart filas={tna} />
            </div>
          </div>
        </div>

        {/* ================= INTERNACIONAL ================= */}
        <SectionLabel>Internacional</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {GRANOS_INFO.map((g) => {
            const row = chicagoDeGrano(chicago, g.nombre);
            return (
              <div key={g.underlying} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 13px", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 12.5, fontVariant: "small-caps", color: INK }}>
                  {g.nombre} · Chicago
                </div>
                <StatRow label="Cierre USD/tn" value={row?.usdTn != null ? nfmt(row.usdTn, 1) : "—"} />
                <StatRow
                  label="Δ del día"
                  value={pfmt(row?.deltaPct ?? null, 2)}
                  color={row?.deltaPct != null ? toneColor(toneOf(row.deltaPct)) : undefined}
                />
                {g.underlying === "SOJ" && (
                  <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 6, marginTop: 2, display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", color: INK3 }}>
                      Complejo
                    </div>
                    {complejoSoja.map((c) => (
                      <div key={c.nombre} style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 9 }}>
                        <span style={{ color: INK3 }}>{c.nombre}</span>
                        <span style={{ color: c.deltaPct != null ? toneColor(toneOf(c.deltaPct)) : INK2 }}>{pfmt(c.deltaPct, 2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: otrosMercados.length > 0 ? "1fr 1fr" : "1fr", gap: 22 }}>
          {color?.chicago_bcr && (
            <div>
              <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em", color: INK3, marginBottom: 6 }}>
                Contexto Chicago (según BCR)
              </div>
              <p style={{ margin: 0, fontSize: 9.5, lineHeight: 1.45, color: INK2 }}>{color.chicago_bcr}</p>
            </div>
          )}
          {otrosMercados.length > 0 && (
            <div>
              <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em", color: INK3, marginBottom: 6 }}>
                Otros mercados (±3% o más)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, fontFamily: MONO, fontSize: 10 }}>
                {otrosMercados.map((r) => (
                  <div key={r.yahoo} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: INK2 }}>{r.nombre}</span>
                    <span style={{ color: toneColor(toneOf(r.deltaPct)) }}>{pfmt(r.deltaPct, 2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* El desfasaje (se mantiene: compara local vs internacional de un vistazo) */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8, paddingTop: 12, borderTop: `1px solid ${LINE_GOLD}` }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", color: INK2 }}>
              El desfasaje — variación del último ajuste A3 contra el último cierre de Chicago
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

        {/* Franja de referencia (volumen/pizarra) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
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
        </div>

        {/* La lectura de la mesa */}
        {(informesHoy.length > 0 || interpretaciones.length > 0) && (
          <div style={{ paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
            <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em", color: INK3, marginBottom: 6 }}>
              La lectura de la mesa
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {informesHoy.map((inf: (typeof informesHoy)[number]) => {
                const interp = interpretaciones.find(
                  (i: (typeof interpretaciones)[number]) => i.organismo === inf.organismo,
                );
                return (
                  <div key={inf.organismo} style={{ fontSize: 9.5, lineHeight: 1.4, color: INK2 }}>
                    · <b style={{ color: INK }}>{inf.organismo}</b> — {inf.informe}:{" "}
                    {inf.cambios.slice(0, 2).map((c, i) => (
                      <span key={i}>
                        {i > 0 && " · "}
                        {c.grano} {c.pais} {nfmt(c.antes, 1)}→{nfmt(c.ahora, 1)} {c.unidad}
                      </span>
                    ))}
                    {interp && (
                      <>
                        {" — "}
                        {interp.publicado_md}
                        {interp.impacto && Object.keys(interp.impacto).length > 0 && (
                          <span style={{ marginLeft: 6 }}>
                            {Object.entries(interp.impacto as Record<string, string>).map(([gr, imp]) => (
                              <span
                                key={gr}
                                style={{
                                  fontFamily: MONO,
                                  fontSize: 8.5,
                                  fontWeight: 700,
                                  marginRight: 4,
                                  color: imp === "alcista" ? "#37D982" : imp === "bajista" ? "#FF5C5C" : INK3,
                                }}
                              >
                                {gr} {imp === "alcista" ? "▲" : imp === "bajista" ? "▼" : "="}
                              </span>
                            ))}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Noticias 24hs + Lo que se lee acá */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
          <div>
            <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em", color: INK3, marginBottom: 6 }}>
              En la noticia · últimas 24 hs
            </div>
            {titulares.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {titulares.map((t) => (
                  <div key={t.link} style={{ fontSize: 9.5, lineHeight: 1.4, color: INK2 }}>
                    · {t.titulo} <span style={{ color: INK3 }}>({t.fuente})</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 9.5, color: INK3 }}>Nada realmente relevante en las últimas 24 hs.</p>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em", color: INK3 }}>
              Lo que se lee acá
            </div>
            {copy?.lectura && copy.lectura.length > 0 ? (
              copy.lectura.map((l, i) => (
                <p key={i} style={{ margin: 0, fontSize: 10.5, lineHeight: 1.5, color: INK2 }}>
                  <span style={{ fontFamily: SERIF, fontVariant: "small-caps", fontWeight: 600, fontSize: 12, color: INK }}>
                    {l.titulo}.{" "}
                  </span>
                  {l.texto}
                </p>
              ))
            ) : (
              <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.5, color: INK3 }}>
                Sin prosa cargada todavía — los datos de arriba son reales.
              </p>
            )}
          </div>
        </div>

        {/* Agenda */}
        {eventos.length > 0 && (
          <div style={{ paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", color: INK2, marginBottom: 8 }}>
              Próximos informes · desde {diaLegible(fecha)}
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
            Fuentes: Matba/A3, CME/CBOT, MAE (dólar mayorista y futuros), CAC-BCR, BCRA, SAGyP. Research
            informativo de{" "}
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
