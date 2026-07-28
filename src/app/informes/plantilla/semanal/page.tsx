import type { Metadata } from "next";
import { getVariacionSemanalGranos, getVariacionSemanalChicago, getVariacionSemanalPizarra, getVariacionSemanalDolarOficial, getViewMercadoVigentePorGrano } from "@/lib/informe-semanal";
import { getNegociado } from "@/lib/compras/negociado";
import { getMesaEmbarque } from "@/lib/lineup/embarque";
import { getEmpresas } from "@/lib/lineup/empresas";
import { getEventos } from "@/lib/calendario";
import { hoyCordobaISO } from "@/lib/dates";
import { sbSelect } from "@/lib/supabase";
import { tokenValido, esFechaValida } from "@/lib/informe-auth";
import { nfmt, pfmt, horaCordoba } from "@/lib/format";
import { VariacionBarras } from "@/components/variacion-barras";
import { DolarOficialChart } from "@/components/dolar-oficial-chart";

/**
 * Placa del informe SEMANAL (MP2 de docs/PLAN_INFORMES.md, ampliada por V3 de
 * docs/PLAN_INFORMES_V2.md §6.3) — PDF A4 de 5 páginas, tema SIEMPRE claro (impreso).
 * Standalone (sin header/nav), gateada por token en searchParam (Playwright la
 * screenshotea/imprime con un simple page.goto — mismo patrón que la plantilla diaria de
 * MP1). Excluida de SECCIONES_META/nav; noindex.
 *
 * V3 sumó "El mundo esta semana" (página 3, research externo acotado) sin agregar hoja: el
 * `ChartTabla` bajo `DolarOficialChart` se omite acá (`sinTabla`) porque es una relectura del
 * mismo gráfico — la tabla completa sigue disponible en vivo en `/dolar`.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const GRANO_LABEL: Record<string, string> = { SOJ: "Soja", MAI: "Maíz", TRI: "Trigo", soja: "Soja", maiz: "Maíz", trigo: "Trigo" };
const GRANO_EMOJI: Record<string, string> = { SOJ: "🌱", MAI: "🌽", TRI: "🌾", soja: "🌱", maiz: "🌽", trigo: "🌾" };

type ProsaSemanal = {
  titulo?: string;
  resumen_ejecutivo?: string[];
  granos_texto?: string;
  dolar_texto?: string;
  /** V3 (PLAN_INFORMES_V2.md §6.3): "El mundo esta semana" — 3-4 bullets del research
   *  acotado (COT/Crop Progress/Brasil/clima), cada uno con su fuente citada EN el texto.
   *  Vacío/ausente = "sin lectura externa esta semana" (degradación honesta, P7). */
  mundo_bullets?: string[];
  comex_texto?: string;
  cierre?: string;
};

async function getBorrador(fecha: string): Promise<{ titulo: string | null; prosa: ProsaSemanal | null } | null> {
  const res = await sbSelect(
    `informes_generados?tipo=eq.semanal&fecha=eq.${fecha}&select=titulo,prosa&limit=1`,
    0,
  );
  if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) return null;
  return res.data[0] as { titulo: string | null; prosa: ProsaSemanal | null };
}

function fechaLegible(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export default async function PlantillaSemanalPage({
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
  const desdeSemana = new Date(new Date(`${fecha}T12:00:00Z`).getTime() - 6 * 86_400_000).toISOString().slice(0, 10);
  const semanaProxima = new Date(new Date(`${fecha}T12:00:00Z`).getTime() + 7 * 86_400_000).toISOString().slice(0, 10);

  const [variacionGranos, variacionChicago, variacionPizarra, variacionDolar, viewsMercado, negociado, embarques, empresas, borrador] =
    await Promise.all([
      getVariacionSemanalGranos(fecha),
      getVariacionSemanalChicago(fecha),
      getVariacionSemanalPizarra(fecha),
      getVariacionSemanalDolarOficial(fecha),
      getViewMercadoVigentePorGrano(),
      getNegociado(),
      getMesaEmbarque(),
      getEmpresas(),
      getBorrador(fecha),
    ]);

  const prosa: ProsaSemanal = borrador?.prosa ?? {};
  const titulo = borrador?.titulo || prosa.titulo || "Informe semanal";
  const resumen = prosa.resumen_ejecutivo ?? [];
  const agenda = getEventos(fecha, semanaProxima).slice(0, 8);

  const barrasGranos = variacionGranos.map((v) => ({
    label: `${GRANO_LABEL[v.underlying] ?? v.underlying} ${v.posicion}`,
    deltaPct: v.deltaPct,
    sub: v.fechaActual ? `(${v.fechaActual})` : undefined,
  }));
  const barrasChicago = variacionChicago.map((v) => ({
    label: `${GRANO_LABEL[v.grano] ?? v.grano} ${v.posicion}`,
    deltaPct: v.deltaPct,
    sub: v.fechaActual ? `(${v.fechaActual})` : undefined,
  }));
  const negociadoActivas = negociado.filas.filter((f) => f.activa && f.semanal != null).slice(0, 14);
  const mundoBullets = prosa.mundo_bullets ?? [];

  return (
    <div className="sem-page">
      {/* Página 1 — Tapa + resumen ejecutivo */}
      <section className="sem-hoja sem-tapa">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático de /public, no contenido para <Image>. */}
        <img className="sem-tapa-logo" src="/rofoagro-logo.svg" alt="ROFO AGRO" />
        <h1 className="sem-tapa-tit">&ldquo;{titulo}&rdquo;</h1>
        <p className="sem-tapa-sub">
          Informe semanal de research · {fechaLegible(desdeSemana)} – {fechaLegible(fecha)}
        </p>
        {resumen.length > 0 ? (
          <ul className="sem-resumen">
            {resumen.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        ) : (
          <p className="sem-texto">Resumen ejecutivo pendiente de redacción.</p>
        )}
        <p className="sem-pie">
          Research informativo de ROFO AGRO, no constituye recomendación de inversión. Datos de
          fuentes públicas y de mercado, sujetos a revisión. Generado {horaCordoba(new Date(), true)}.
        </p>
      </section>

      {/* Página 2 — Granos: variación semanal + negociado SIO */}
      <section className="sem-hoja">
        <div className="sem-hd">
          <span className="sem-hd-tit">Granos — variación semanal</span>
          <span className="sem-hd-pag">2/5</span>
        </div>
        <div className="sem-sec">
          <p className="sem-sec-tit">A3 (Matba Rofex)</p>
          <VariacionBarras items={barrasGranos} />
        </div>
        <div className="sem-sec">
          <p className="sem-sec-tit">Pizarra CAC-BCR (USD/tn)</p>
          <VariacionBarras
            items={variacionPizarra.map((v) => ({ label: GRANO_LABEL[v.grano] ?? v.grano, deltaPct: v.deltaPct }))}
          />
        </div>
        {prosa.granos_texto && <p className="sem-texto">{prosa.granos_texto}</p>}
        <div className="sem-sec">
          <p className="sem-sec-tit">Negociado de la semana (SIO Granos)</p>
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="l" scope="col">Producto</th>
                  <th className="l" scope="col">Sector</th>
                  <th scope="col">Semanal (t)</th>
                  <th scope="col">Semana prev. (t)</th>
                  <th scope="col">Acumulado (t)</th>
                </tr>
              </thead>
              <tbody>
                {negociadoActivas.map((f, i) => (
                  <tr key={i}>
                    <td className="l">{f.display}</td>
                    <td className="l">{f.sector}</td>
                    <td>{nfmt(f.semanal, 0)}</td>
                    <td>{f.semanalPrev != null ? nfmt(f.semanalPrev, 0) : "—"}</td>
                    <td>{f.acumulado != null ? nfmt(f.acumulado, 0) : "—"}</td>
                  </tr>
                ))}
                {negociadoActivas.length === 0 && (
                  <tr>
                    <td className="l dim" colSpan={5}>Sin datos de negociado esta semana.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Página 3 — Dólar/tasas + Chicago */}
      <section className="sem-hoja">
        <div className="sem-hd">
          <span className="sem-hd-tit">Dólar y Chicago — variación semanal</span>
          <span className="sem-hd-pag">3/5</span>
        </div>
        <div className="sem-sec">
          <p className="sem-sec-tit">Dólar oficial (BCRA A3500)</p>
          <DolarOficialChart serie={variacionDolar.serie} sinTabla />
        </div>
        <div className="sem-sec">
          <p className="sem-sec-tit">Chicago (CBOT, USD/tn)</p>
          <VariacionBarras items={barrasChicago} />
        </div>
        <div className="sem-sec">
          <p className="sem-sec-tit">El mundo esta semana</p>
          {mundoBullets.length > 0 ? (
            <ul className="sem-resumen">
              {mundoBullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : (
            <p className="sem-texto">Sin lectura de research externo esta semana.</p>
          )}
        </div>
        {prosa.dolar_texto && <p className="sem-texto">{prosa.dolar_texto}</p>}
      </section>

      {/* Página 4 — Comercio exterior */}
      <section className="sem-hoja">
        <div className="sem-hd">
          <span className="sem-hd-tit">Comercio exterior</span>
          <span className="sem-hd-pag">4/5</span>
        </div>
        <div className="sem-sec">
          <p className="sem-sec-tit">Cumplimiento del mes en curso (declarado vs line-up)</p>
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="l" scope="col">Producto</th>
                  <th scope="col">Declarado (t)</th>
                  <th scope="col">Embarcado (t)</th>
                  <th scope="col">Buques</th>
                  <th scope="col">Ratio</th>
                </tr>
              </thead>
              <tbody>
                {embarques.cumplimiento.map((c, i) => (
                  <tr key={i}>
                    <td className="l">{c.display}</td>
                    <td>{c.declarado != null ? nfmt(c.declarado, 0) : "—"}</td>
                    <td>{c.embarcado != null ? nfmt(c.embarcado, 0) : "—"}</td>
                    <td>{c.buques ?? "—"}</td>
                    <td>{c.ratio != null ? pfmt(c.ratio * 100, 0) : "—"}</td>
                  </tr>
                ))}
                {embarques.cumplimiento.length === 0 && (
                  <tr>
                    <td className="l dim" colSpan={5}>Sin datos de cumplimiento disponibles.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="sem-sec">
          <p className="sem-sec-tit">Gap de cobertura por producto (foto forward 60d)</p>
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="l" scope="col">Producto</th>
                  <th scope="col">Declarado 60d (t)</th>
                  <th scope="col">Originado 60d (t)</th>
                  <th scope="col">Ratio</th>
                </tr>
              </thead>
              <tbody>
                {empresas.productos.map((p, i) => (
                  <tr key={i}>
                    <td className="l">{p.display}</td>
                    <td>{p.declarado60d != null ? nfmt(p.declarado60d, 0) : "—"}</td>
                    <td>{p.originado60d != null ? nfmt(p.originado60d, 0) : "—"}</td>
                    <td>{p.ratio != null ? nfmt(p.ratio, 2) : "—"}</td>
                  </tr>
                ))}
                {empresas.productos.length === 0 && (
                  <tr>
                    <td className="l dim" colSpan={4}>Sin datos de cobertura disponibles.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {prosa.comex_texto && <p className="sem-texto">{prosa.comex_texto}</p>}
      </section>

      {/* Página 5 — View de mercado + agenda + cierre */}
      <section className="sem-hoja">
        <div className="sem-hd">
          <span className="sem-hd-tit">View de mesa + agenda</span>
          <span className="sem-hd-pag">5/5</span>
        </div>
        {viewsMercado.length > 0 ? (
          <div className="sem-sec">
            <p className="sem-sec-tit">View direccional de la mesa (research MP3)</p>
            {viewsMercado.map((v) => (
              <div key={v.grano} style={{ marginBottom: 14 }}>
                <p className="sem-texto" style={{ fontWeight: 700, color: "var(--ink)" }}>
                  {GRANO_EMOJI[v.grano] ?? ""} {GRANO_LABEL[v.grano] ?? v.grano} — {v.direccion.toUpperCase()} (confianza {v.confianza}/5)
                </p>
                <p className="sem-texto">{v.tesis_md.replace(/\*\*/g, "")}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="sem-texto">Todavía no hay view de mercado generado (MP3).</p>
        )}
        <div className="sem-sec">
          <p className="sem-sec-tit">Agenda de la semana próxima</p>
          {agenda.length > 0 ? (
            <ul className="sem-resumen">
              {agenda.map((e, i) => (
                <li key={i}>
                  {e.organismo} — {e.informe} ({fechaLegible(e.fechaISO)})
                </li>
              ))}
            </ul>
          ) : (
            <p className="sem-texto">Sin informes de organismos agendados para la semana próxima.</p>
          )}
        </div>
        {prosa.cierre && <p className="sem-texto">{prosa.cierre}</p>}
        <p className="sem-pie sem-pie-flow">
          Research informativo de ROFO AGRO, no constituye recomendación de inversión. Datos de
          fuentes públicas y de mercado, sujetos a revisión.
        </p>
      </section>
    </div>
  );
}
