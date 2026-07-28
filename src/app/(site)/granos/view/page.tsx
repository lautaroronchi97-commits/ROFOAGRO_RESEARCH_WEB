import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { Panel, PanelHead } from "@/components/panel";
import { QueEsEsto } from "@/components/que-es-esto";
import {
  getViewsMercado,
  GRANOS_VIEW,
  GRANO_VIEW_LABEL,
  DIRECCION_VIEW_LABEL,
  type ViewMercado,
  type DireccionView,
} from "@/lib/views-mercado";
import { ViewFeedback } from "./view-feedback";
import { PageHead } from "@/components/page-head";

/**
 * Granos · View de mesa (MP3 de docs/PLAN_INFORMES.md). Research direccional
 * semanal por grano, generado por la sesión de research (skill view-mercado) y
 * calificado por Lautaro acá (loop de calibración). Protegido SIEMPRE con
 * requireAdmin (interno mesa, como /comercio/*): se abre a clientes recién
 * cuando la calidad convenza.
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
const GRANO_EMOJI: Record<string, string> = { soja: "🌱", maiz: "🌽", trigo: "🌾" };

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

function ViewCard({ v }: { v: ViewMercado }) {
  const color = DIR_COLOR[v.direccion];
  return (
    <article className="vw-card" style={{ borderTopColor: color }}>
      <header className="vw-hd">
        <span className="vw-grano">
          {GRANO_EMOJI[v.grano]} {GRANO_VIEW_LABEL[v.grano]}
        </span>
        <span className="vw-dir" style={{ color }}>
          {DIR_GLIFO[v.direccion]} {DIRECCION_VIEW_LABEL[v.direccion]}
        </span>
        <span className="vw-meta dim">
          <Confianza n={v.confianza} /> · {v.horizonte} · view del {fechaAR(v.fecha)}
        </span>
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

      <ViewFeedback id={v.id} actual={v.feedback_lautaro} />
    </article>
  );
}

export default async function ViewMesaPage() {
  await requireAdmin();
  const { vigentes, historial, error } = await getViewsMercado();
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
                  indicado, con los argumentos y — igual de importante — qué lo invalidaría. Tu
                  feedback en cada view lo lee la sesión de research siguiente: es el loop de
                  calibración. Contexto operativo:{" "}
                  <Link href="/comercio/temperatura">calor de mercadería</Link> ·{" "}
                  <Link href="/comercio/senal">señal físico→precio</Link>.
                </>
              }
              comoSeCalcula={
                <>
                  Lo produce la sesión de research semanal (skill <code>view-mercado</code>) usando
                  SOLO datos que la web ya computa: índice MESA y sus patas, cobertura DJVE↔line-up,
                  programa de embarques, negociado y % priceado, estimaciones de producción y sus
                  revisiones, curva A3 y pases, FAS teórico vs pizarra y Chicago. Cada argumento cita
                  su número exacto; nada se inventa.
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
                return v ? <ViewCard key={g} v={v} /> : null;
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
                      <th>Conf.</th>
                      <th>Horizonte</th>
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
                        <td className="num">{v.confianza}/5</td>
                        <td>{v.horizonte}</td>
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
