import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { Panel, PanelHead } from "@/components/panel";
import { QueEsEsto } from "@/components/que-es-esto";
import {
  getViewsMercado,
  getScorecard,
  GRANOS_VIEW,
  GRANO_VIEW_LABEL,
  DIRECCION_VIEW_LABEL,
  type ViewMercado,
  type DireccionView,
  type RelacionPrevia,
} from "@/lib/views-mercado";
import type { ResumenGrano } from "@/lib/views-scorecard";
import { ViewFeedback } from "./view-feedback";
import { ViewExportButton } from "@/components/view-export-button";
import type { ViewExportData } from "@/lib/chart-export";
import { PageHead } from "@/components/page-head";

/**
 * Granos · View de mesa (V1 de docs/PLAN_INFORMES_V2.md, sucesor de MP3). Research
 * direccional semanal por grano con pipeline F0-F6, generado por la sesión de research
 * (skill view-mercado) y calificado por Lautaro acá (loop de calibración: feedback +
 * nota 1-5 + scorecard). Protegido SIEMPRE con requireAdmin (interno mesa, como
 * /comercio/*): se abre a clientes recién cuando la calidad convenza.
 */
export const metadata: Metadata = {
  title: "View de mesa · Granos · ROFO AGRO",
  description: "Research direccional semanal por grano: dirección, argumentos con datos y qué invalidaría la tesis.",
  robots: { index: false, follow: false },
};

const DIR_COLOR: Record<DireccionView, string> = {
  alcista: "var(--pos)",
  bajista: "var(--neg)",
  neutral: "var(--neu)",
};
const DIR_GLIFO: Record<DireccionView, string> = { alcista: "▲", bajista: "▼", neutral: "◆" };
const DIR_COLOR_VAR: Record<DireccionView, string> = { alcista: "--pos", bajista: "--neg", neutral: "--neu" };
const GRANO_EMOJI: Record<string, string> = { soja: "🌱", maiz: "🌽", trigo: "🌾" };

const RELACION_LABEL: Record<RelacionPrevia, string> = {
  inicial: "INICIAL",
  confirma: "CONFIRMA",
  ajusta: "AJUSTA",
  switch: "SWITCH",
  cumplida: "CUMPLIDA",
};
const RELACION_COLOR: Record<RelacionPrevia, string> = {
  inicial: "var(--neu)",
  confirma: "var(--pos)",
  ajusta: "var(--neu)",
  switch: "var(--neg)",
  cumplida: "var(--neu)",
};

function fechaAR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Párrafos del markdown simple de la tesis (doble salto = párrafo; **negrita**). */
function Tesis({ md }: { md: string }) {
  const parrafos = md.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="vw-tesis">
      {parrafos.map((p, i) => (
        <p key={i}>
          {p.split(/\*\*(.+?)\*\*/g).map((seg, j) => (j % 2 === 1 ? <strong key={j}>{seg}</strong> : seg))}
        </p>
      ))}
    </div>
  );
}

function Confianza({ n }: { n: number }) {
  return (
    <span className="vw-conf" title={`Confianza ${n}/5`} aria-label={`Confianza ${n} de 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} className={i < n ? "on" : ""} />
      ))}
    </span>
  );
}

/** Fila de scorecard del grano: hit-rate a 4 semanas, N medidos, racha (§5 UI del plan V1). */
function ScorecardFila({ r }: { r: ResumenGrano }) {
  if (r.nMedidos === 0) {
    return <p className="dim vw-score">Scorecard: todavía sin views con 4 semanas de vida para medir.</p>;
  }
  const pct = Math.round(r.hitRate! * 100);
  const rachaTxt = r.racha ? `racha de ${r.racha.largo} ${r.racha.tipo === "acierto" ? "aciertos" : "errores"}` : "—";
  return (
    <p className="vw-score">
      <span className="k">Scorecard (4 semanas)</span> {pct}% de acierto sobre {r.nMedidos} view
      {r.nMedidos === 1 ? "" : "s"} medido{r.nMedidos === 1 ? "" : "s"} · {rachaTxt}
      {r.brier != null && <> · Brier {r.brier.toFixed(3)}</>}
    </p>
  );
}

/**
 * Estado de los invalidadores vigentes. Solo distingue 🟢 vigente / 🔴 disparado
 * (`disparado_en` seteado) — la tercera lectura del plan (🟡 "cerca") necesitaría que
 * `dato_ref`/`condicion` fueran machine-checkable (hoy son texto libre que escribe el
 * research F0); no se fabrica esa cercanía sin un umbral real que evaluar.
 */
function Invalidadores({ v }: { v: ViewMercado }) {
  if (v.invalidadores.length === 0) return null;
  return (
    <div className="vw-inval">
      <h4>Qué la invalidaría (chequeo mecánico F0)</h4>
      <ul>
        {v.invalidadores.map((inv, i) => (
          <li key={i}>
            <span>{inv.disparado_en ? "🔴" : "🟢"}</span> {inv.condicion}
            {inv.umbral && <span className="dim"> ({inv.umbral})</span>}
            {inv.disparado_en && <span className="dim"> — disparó el {fechaAR(inv.disparado_en.slice(0, 10))}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ViewCard({ v, scorecard, esAdmin }: { v: ViewMercado; scorecard: ResumenGrano; esAdmin: boolean }) {
  const color = DIR_COLOR[v.direccion];
  const datosExport: ViewExportData = {
    granoLabel: GRANO_VIEW_LABEL[v.grano],
    granoEmoji: GRANO_EMOJI[v.grano] ?? "",
    direccionLabel: DIRECCION_VIEW_LABEL[v.direccion],
    colorVar: DIR_COLOR_VAR[v.direccion],
    confianza: v.confianza,
    horizonte: v.horizonte,
    fechaLabel: fechaAR(v.fecha),
    tesis: v.tesis_md.replace(/\n{2,}/g, " "),
    aFavor: v.argumentos.a_favor,
    enContra: v.argumentos.en_contra,
    accion: v.argumentos.accion,
    invalidacion: v.invalidacion,
  };
  return (
    <article className="vw-card" style={{ borderTopColor: color }}>
      <header className="vw-hd">
        <span className="vw-grano">
          {GRANO_EMOJI[v.grano]} {GRANO_VIEW_LABEL[v.grano]}
        </span>
        <span className="vw-dir" style={{ color }}>
          {DIR_GLIFO[v.direccion]} {DIRECCION_VIEW_LABEL[v.direccion]}
        </span>
        {v.relacion_previa && (
          <span className="vw-rel" style={{ color: RELACION_COLOR[v.relacion_previa] }}>
            {RELACION_LABEL[v.relacion_previa]}
          </span>
        )}
        <span className="vw-meta dim">
          <Confianza n={v.confianza} /> · {v.horizonte} · view del {fechaAR(v.fecha)}
        </span>
        <ViewExportButton grano={v.grano} fecha={v.fecha} datos={datosExport} />
      </header>

      <Tesis md={v.tesis_md} />

      <div className="vw-args">
        {v.argumentos.a_favor.length > 0 && (
          <div>
            <h4>A favor de la tesis</h4>
            <ul>
              {v.argumentos.a_favor.map((a, i) => (
                <li key={i}>
                  <strong>{a.titulo}.</strong> <span className="dim">{a.dato}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {v.argumentos.en_contra.length > 0 && (
          <div>
            <h4>Juega en contra</h4>
            <ul>
              {v.argumentos.en_contra.map((a, i) => (
                <li key={i}>
                  <strong>{a.titulo}.</strong> <span className="dim">{a.dato}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {v.argumentos.accion && (
        <p className="vw-accion">
          <span className="k">Acción sugerida</span> {v.argumentos.accion}
        </p>
      )}
      <p className="vw-invalida">
        <span className="k">Qué me haría cambiar de opinión</span> {v.invalidacion}
      </p>
      <Invalidadores v={v} />
      <ScorecardFila r={scorecard} />

      {v.evidencia_externa.length > 0 && (
        <div className="vw-evidencia">
          <h4>Evidencia externa citada</h4>
          <ul>
            {v.evidencia_externa.map((e, i) => (
              <li key={i}>
                <strong>{e.dato}.</strong>{" "}
                <a href={e.url} target="_blank" rel="noopener noreferrer nofollow">
                  fuente
                </a>{" "}
                <span className="dim">({fechaAR(e.fecha_pub)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Solo admins ven/cargan el feedback (relevamiento 29/07, punto 30) — hoy la
          página entera ya es admin-only, así que esto no cambia nada visible; el
          día que se abra a clientes, el feedback queda oculto automáticamente sin
          tocar nada más acá. */}
      {esAdmin && <ViewFeedback id={v.id} actual={v.feedback_lautaro} actualNota={v.nota_lautaro} />}
    </article>
  );
}

export default async function ViewMesaPage() {
  await requireAdmin();
  // La página entera ya es admin-only (arriba); esAdmin=true siempre hoy. Se pasa
  // explícito para que, el día que se saque el requireAdmin() de la página, el
  // feedback siga oculto sin tocar ViewCard (ver el comentario ahí).
  const esAdmin = true;
  const [{ vigentes, historial, error }, scorecard] = await Promise.all([getViewsMercado(), getScorecard()]);
  const hayAlguno = GRANOS_VIEW.some((g) => vigentes[g] !== null);

  return (
    <>
      <main className="wrap">
        <div className="col">
          <PageHead kicker="Research direccional · solo mesa" title="View de mesa por grano" />
          <Panel id="view-mesa">
            <PanelHead
              title="View semanal por grano"
              sub="research direccional · interno mesa"
              stamp={<span className="st-badge st-parcial">SOLO MESA</span>}
            />
            <QueEsEsto
              paraQue={
                <>
                  Es el view direccional de la mesa: hacia dónde vemos cada grano en el horizonte
                  indicado, con los argumentos y — igual de importante — qué lo invalidaría. Cada
                  corrida reconcilia contra la tesis de la semana anterior (badge CONFIRMA/AJUSTA/
                  SWITCH/CUMPLIDA) en vez de escribir de cero. Tu feedback y tu nota en cada view los
                  lee la sesión de research siguiente: es el loop de calibración. Contexto operativo:{" "}
                  <Link href="/comercio/temperatura">calor de mercadería</Link> ·{" "}
                  <Link href="/comercio/senal">señal físico→precio</Link>.
                </>
              }
              comoSeCalcula={
                <>
                  Lo produce la sesión de research semanal (skill <code>view-mercado</code>, pipeline
                  F0→F6) usando SOLO datos que la web ya computa + research externo con pasaporte
                  verificado (URL + fecha + cita). Cada argumento cita su número exacto; nada se
                  inventa. El scorecard mide el acierto real contra <code>futuros_cierres</code> a 1,
                  2 y 4 semanas, con la posición fijada el día del view (nunca re-elegida).
                </>
              }
            />

            {error && (
              <p className="dim vw-vacio">
                No se pudieron cargar los views en este momento. Probá recargar en un rato.
              </p>
            )}
            {!error && !hayAlguno && (
              <p className="dim vw-vacio">
                Todavía no hay views generados. El primero aparece cuando corre la sesión semanal de
                research (viernes a la mañana) o al disparla a mano con la skill{" "}
                <code>view-mercado</code>.
              </p>
            )}

            <div className="vw-grid">
              {GRANOS_VIEW.map((g) => {
                const v = vigentes[g];
                return v ? <ViewCard key={g} v={v} scorecard={scorecard.porGrano[g]} esAdmin={esAdmin} /> : null;
              })}
            </div>
          </Panel>

          {historial.length > 0 && (
            <Panel id="view-historial">
              <PanelHead title="Views anteriores" sub="historial con tu feedback" />
              <div className="tbl-wrap">
                <table className="tbl vw-hist">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Grano</th>
                      <th>Dirección</th>
                      <th>Relación</th>
                      <th>Conf.</th>
                      <th>Horizonte</th>
                      <th>Nota</th>
                      <th>Tu feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((v) => (
                      <tr key={v.id}>
                        <td className="num">{fechaAR(v.fecha)}</td>
                        <td>{GRANO_VIEW_LABEL[v.grano]}</td>
                        <td style={{ color: DIR_COLOR[v.direccion] }}>
                          {DIR_GLIFO[v.direccion]} {DIRECCION_VIEW_LABEL[v.direccion]}
                        </td>
                        <td>
                          {v.relacion_previa ? (
                            <span style={{ color: RELACION_COLOR[v.relacion_previa] }}>
                              {RELACION_LABEL[v.relacion_previa]}
                            </span>
                          ) : (
                            <span className="dim">—</span>
                          )}
                        </td>
                        <td className="num">{v.confianza}/5</td>
                        <td>{v.horizonte}</td>
                        <td className="num">{v.nota_lautaro ?? <span className="dim">—</span>}</td>
                        <td className="vw-hist-fb">{v.feedback_lautaro ?? <span className="dim">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>
      </main>
    </>
  );
}
