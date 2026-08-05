import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSeccion } from "@/lib/auth/dal";
import { datosDiario, getBorrador } from "@/lib/informe-diario-datos";
import {
  buildDesfasaje,
  buildTnaImplicita,
  buildComplejoSoja,
  chicagoDeGrano,
  GRANOS_INFO,
} from "@/lib/informe-research";
import { otrosMercadosRelevantes } from "@/lib/informe-v3-calc";
import { DesfasajeChart, TnaChart } from "@/components/informe-research-charts";
import { esFechaValida } from "@/lib/informe-auth";
import { nfmt, pfmt } from "@/lib/format";
import { PageHead } from "@/components/page-head";
import { Panel, PanelHead } from "@/components/panel";
import { QueEsEsto } from "@/components/que-es-esto";
import { ImpactoBadges } from "@/components/impacto-badges";

/** Clave de `pizarra_historico`/`variacionPizarra` (minúscula, sin acento) por underlying. */
const GRANO_KEY: Record<string, string> = { SOJ: "soja", MAI: "maiz", TRI: "trigo" };

function ddmmaaaa(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function toneVar(n: number | null | undefined): string {
  return n == null ? "var(--ink-3)" : n >= 0 ? "var(--pos)" : "var(--neg)";
}

/**
 * Fila label/valor compacta — deliberadamente NO usa `<table className="tbl">` (esa clase
 * fija `min-width:640px`, pensada para las tablas de mercado a todo el ancho del panel; adentro
 * de una tarjeta angosta de `.informe-grano-grid` desborda y el contenido se solapa con la
 * tarjeta vecina, confirmado con Playwright en la verificación de esta página).
 */
function StatLine({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="informe-stat-row">
      <span className="dim">{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", color }}>{value}</span>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ fecha: string }>;
}): Promise<Metadata> {
  const { fecha } = await params;
  return { title: `Informe diario ${fecha} · ROFO AGRO` };
}

/**
 * Informe diario COMPLETO como página web (N6/§5.4 de PLAN_INFORMES_V3.md, etapa E3). Misma
 * data que la placa PNG (`datosDiario()`, la MISMA función que usa el route de token) — acá se
 * ve TODO, incluido lo que la placa haya recortado por el objetivo de 1-2 páginas (N17). **Sin
 * puerta pública** (decisión de Lautaro, 05/08/2026: "no dejamos ningún informe en link
 * online") — gate normal de la sección `informes` únicamente (sesión + permiso, o admin); si no
 * abre, `requireSeccion` redirige, mismo comportamiento que el resto del sitio.
 */
export default async function InformeDiarioPage({
  params,
}: {
  params: Promise<{ fecha: string }>;
}) {
  const { fecha } = await params;
  if (!esFechaValida(fecha)) notFound();

  await requireSeccion("informes");

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
  const complejoSoja = buildComplejoSoja(chicago);
  const otrosMercados = otrosMercadosRelevantes(chicago.macro);
  const volumenMaeUsd = volumenCambiario.cats.reduce((s, c) => s + c.volumenUsd, 0);

  return (
    <main className="wrap">
      <div className="col">
        <PageHead
          kicker={`Research diario · ${ddmmaaaa(fecha)}`}
          title={copy?.tesisTitulo ?? "Informe diario"}
          lede={copy?.tesisParrafo ?? "Todavía no se redactó la prosa de este día."}
        />

        <Panel>
          <PanelHead title="Local — por producto" sub="pizarra CAC · pizarra estimada de la mesa · top 3 A3 · TNA implícita" />
          <div className="informe-grano-grid">
            {GRANOS_INFO.map((g) => {
              const pzGrano = pizarra.granos[g.underlying];
              const deltaPz = variacionPizarra.find((v) => v.grano === GRANO_KEY[g.underlying]);
              const estimada = copy?.pizarraEstimada?.[g.underlying];
              const volFisico = copy?.volumenFisico?.[g.underlying];
              const top3 = top3PorGrano.find((tg) => tg.underlying === g.underlying);
              const tnaGrano = tna.find((x) => x.tono === "grano" && x.key === g.underlying);

              return (
                <div key={g.underlying} className="informe-grano-card">
                  <h3>{g.nombre}</h3>
                  <StatLine label="Pizarra CAC USD" value={pzGrano?.usd != null ? `US$${nfmt(pzGrano.usd, 1)}` : "—"} />
                  <StatLine
                    label="Δ pizarra $ / USD"
                    value={deltaPz ? `${pfmt(deltaPz.ars.deltaPct, 1)} / ${pfmt(deltaPz.usd.deltaPct, 1)}` : "—"}
                    color={toneVar(deltaPz?.usd.deltaPct)}
                  />
                  <StatLine
                    label="Estimada mesa"
                    value={
                      estimada?.usd != null
                        ? `US$${nfmt(estimada.usd, 1)}${estimada.deltaUsdPct != null ? ` (${pfmt(estimada.deltaUsdPct, 1)})` : ""}`
                        : "—"
                    }
                    color={toneVar(estimada?.deltaUsdPct)}
                  />
                  <StatLine label="TNA impl. de referencia" value={tnaGrano ? pfmt(tnaGrano.valor, 1) : "—"} />
                  <StatLine label="Volumen físico" value={volFisico != null ? nfmt(volFisico, 0) : "—"} />

                  <p className="dim" style={{ fontSize: 11, margin: "10px 0 4px", textTransform: "uppercase", letterSpacing: ".08em" }}>
                    Top 3 posiciones A3
                  </p>
                  {top3 && top3.top3.length > 0 ? (
                    <div className="informe-top3">
                      <div className="informe-top3-row informe-top3-hd dim">
                        <span>Pos.</span>
                        <span>Ajuste</span>
                        <span>Δ%</span>
                        <span>Vol.</span>
                      </div>
                      {top3.top3.map((f) => (
                        <div key={f.posicion} className="informe-top3-row">
                          <span>{f.posicion}</span>
                          <span>{f.ajuste != null ? nfmt(f.ajuste, 1) : "—"}</span>
                          <span style={{ color: toneVar(f.deltaPct) }}>{pfmt(f.deltaPct, 1)}</span>
                          <span>{f.volumen != null ? nfmt(f.volumen, 0) : "—"}</span>
                        </div>
                      ))}
                      <div className="informe-top3-row informe-top3-total dim">
                        <span>Total producto</span>
                        <span style={{ gridColumn: "span 3", textAlign: "right", color: "var(--ink)" }}>
                          {top3.volumenTotal != null ? nfmt(top3.volumenTotal, 0) : "—"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="dim" style={{ fontSize: 12 }}>Sin operado en vivo — fuera de rueda.</p>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Local — transversal" sub="TC oficial · compras BCRA · carry en dólar futuro · condicionales" />
          <div className="informe-transversal-grid">
            <div>
              <StatLine label="TC oficial mayorista" value={volumenCambiario.oficial != null ? nfmt(volumenCambiario.oficial, 2) : "—"} />
              <StatLine
                label="Δ del día"
                value={pfmt(volumenCambiario.oficialVarPct, 2)}
                color={toneVar(volumenCambiario.oficialVarPct)}
              />
              <StatLine
                label="Volumen MAE especies USD"
                value={volumenMaeUsd > 0 ? `US$${nfmt(volumenMaeUsd / 1e6, 1)}M` : "—"}
              />
              <StatLine
                label="Compras BCRA (MULC)"
                value={bcra ? `US$${nfmt(bcra.monto_musd, 1)}M` : "—"}
                color={bcra ? "var(--pos)" : undefined}
              />
              {(copy?.condicionalDjve || copy?.condicionalCamiones) && (
                <div style={{ marginTop: 10 }}>
                  {copy?.condicionalDjve && (
                    <p style={{ margin: "0 0 4px", fontSize: 12.5 }}>
                      <b>DJVE.</b> {copy.condicionalDjve}
                    </p>
                  )}
                  {copy?.condicionalCamiones && (
                    <p style={{ margin: 0, fontSize: 12.5 }}>
                      <b>Camiones.</b> {copy.condicionalCamiones}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div>
              <p className="dim" style={{ fontSize: 11, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: ".08em" }}>
                Dónde rinde el tiempo — TNA implícita (grano + carry USD)
              </p>
              <div style={{ background: "#0C130D", border: "1px solid rgba(168,198,160,.14)", borderRadius: 10, padding: "10px 12px" }}>
                <TnaChart filas={tna} />
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Internacional" sub="Chicago por producto · contexto BCR · otros mercados" />
          <div className="informe-grano-grid">
            {GRANOS_INFO.map((g) => {
              const row = chicagoDeGrano(chicago, g.nombre);
              return (
                <div key={g.underlying} className="informe-grano-card">
                  <h3>{g.nombre} · Chicago</h3>
                  <StatLine label="Cierre USD/tn" value={row?.usdTn != null ? nfmt(row.usdTn, 1) : "—"} />
                  <StatLine label="Δ del día" value={pfmt(row?.deltaPct ?? null, 2)} color={toneVar(row?.deltaPct)} />
                  {g.underlying === "SOJ" &&
                    complejoSoja.map((c) => (
                      <StatLine key={c.nombre} label={c.nombre} value={pfmt(c.deltaPct, 2)} color={toneVar(c.deltaPct)} />
                    ))}
                </div>
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: otrosMercados.length > 0 ? "1fr 1fr" : "1fr", gap: 18, marginTop: 14 }}>
            {color?.chicago_bcr && (
              <div>
                <p className="dim" style={{ fontSize: 11, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Contexto Chicago (según BCR)
                </p>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{color.chicago_bcr}</p>
              </div>
            )}
            {otrosMercados.length > 0 && (
              <div>
                <p className="dim" style={{ fontSize: 11, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Otros mercados (±3% o más)
                </p>
                {otrosMercados.map((r) => (
                  <StatLine key={r.yahoo} label={r.nombre} value={pfmt(r.deltaPct, 2)} color={toneVar(r.deltaPct)} />
                ))}
              </div>
            )}
          </div>
          <p className="dim" style={{ fontSize: 11, margin: "14px 0 6px", textTransform: "uppercase", letterSpacing: ".08em" }}>
            El desfasaje — A3 vs Chicago
          </p>
          <div style={{ background: "#0C130D", border: "1px solid rgba(168,198,160,.14)", borderRadius: 10, padding: "10px 12px" }}>
            <DesfasajeChart filas={desfasaje} />
          </div>
        </Panel>

        {(informesHoy.length > 0 || interpretaciones.length > 0) && (
          <Panel>
            <PanelHead title="La lectura de la mesa" sub="informes de organismos del día" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {informesHoy.map((inf) => {
                const interp = interpretaciones.find((i) => i.organismo === inf.organismo);
                return (
                  <div key={inf.organismo}>
                    <p style={{ margin: "0 0 2px" }}>
                      <b>{inf.organismo}</b> — {inf.informe}:{" "}
                      {inf.cambios.slice(0, 3).map((c, i) => (
                        <span key={i}>
                          {i > 0 && " · "}
                          {c.grano} {c.pais} {nfmt(c.antes, 1)}→{nfmt(c.ahora, 1)} {c.unidad}
                        </span>
                      ))}
                    </p>
                    {interp && (
                      <>
                        <ImpactoBadges impacto={interp.impacto} />
                        <p className="dim" style={{ margin: "4px 0 0" }}>{interp.publicado_md}</p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        <Panel>
          <PanelHead title="Noticias · últimas 24 hs" />
          {noticias.destacados.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {noticias.destacados.map((t) => (
                <li key={t.link} style={{ marginBottom: 4 }}>
                  {t.titulo} <span className="dim">({t.fuente})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dim">Nada realmente relevante en las últimas 24 hs.</p>
          )}
        </Panel>

        <Panel>
          <PanelHead title="Lo que se lee acá" />
          {copy?.lectura && copy.lectura.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {copy.lectura.map((l, i) => (
                <p key={i} style={{ margin: 0 }}>
                  <b>{l.titulo}.</b> {l.texto}
                </p>
              ))}
            </div>
          ) : (
            <p className="dim">Sin prosa cargada todavía.</p>
          )}
        </Panel>

        {agenda.length > 0 && (
          <Panel>
            <PanelHead title="Próximos informes" sub="los próximos 7 días" />
            <div className="table-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="l">Fecha</th>
                    <th className="l">Hora ART</th>
                    <th className="l">Organismo</th>
                    <th className="l">Informe</th>
                  </tr>
                </thead>
                <tbody>
                  {agenda.map((e, i) => (
                    <tr key={i}>
                      <td className="l">{ddmmaaaa(e.fechaISO)}</td>
                      <td className="num">{e.horaArg ?? "—"}</td>
                      <td className="l">{e.organismo}</td>
                      <td className="l">{e.informe}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        <Panel>
          <QueEsEsto
            paraQue="La versión web completa del informe diario — incluye todo lo que la placa PNG haya recortado por su objetivo de 1-2 páginas."
            comoSeCalcula="Mismos datos que la placa PNG: se generan solos, post-cierre, sin ningún número inventado."
          />
        </Panel>
      </div>
    </main>
  );
}
