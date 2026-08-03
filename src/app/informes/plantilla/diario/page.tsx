import type { Metadata } from "next";
import { getCierresGranos, volumenTotalGrano, type CierrePos } from "@/lib/futuros";
import { getPizarra } from "@/lib/pizarra";
import { getDolarFuturo } from "@/lib/market";
import { getMonitorMercados } from "@/lib/monitor-mercados";
import { getNoticias } from "@/lib/noticias";
import { getEventos } from "@/lib/calendario";
import { hoyCordobaISO } from "@/lib/dates";
import { tokenValido, esFechaValida } from "@/lib/informe-auth";
import { nfmt, pfmt, dirOf, horaCordoba } from "@/lib/format";
import {
  getBorrador,
  getInformesHoy,
  getInterpretaciones,
  getBcra,
  type ProsaDiaria,
} from "@/lib/informe-diario-datos";

/**
 * Placa del informe diario (MP1 de docs/PLAN_INFORMES.md). Página standalone
 * (sin header/nav del sitio), gateada por token en searchParam (no por header: la
 * screenshotea Playwright con un simple page.goto, y el token es el mismo secreto
 * ya usado en /api/informes/datos — E5 #12a aplica a la API JSON, no a esta página
 * de render). Excluida de SECCIONES_META/nav; noindex.
 *
 * Tema: se generaron bocetos claro/oscuro con datos reales y Lautaro eligió el
 * CLARO (22/07/2026) — queda fijo (ver constante `tema` abajo).
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const GRANOS: { underlying: string; nombre: string; emoji: string }[] = [
  { underlying: "SOJ", nombre: "Soja", emoji: "🌱" },
  { underlying: "MAI", nombre: "Maíz", emoji: "🌽" },
  { underlying: "TRI", nombre: "Trigo", emoji: "🌾" },
];

function PosChip({ p }: { p: CierrePos }) {
  const dir = dirOf(p.changePercent);
  const glifo = dir === "up" ? "🟢" : dir === "down" ? "🔴" : "🟡";
  return (
    <span className="plc-pos">
      <b>{p.posicion}</b> {nfmt(p.settlement, 1)}
      <span className={dir}>{pfmt(p.changePercent, 1)}</span>
      {glifo}
    </span>
  );
}

export default async function PlantillaDiarioPage({
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
  // Tema decidido por Lautaro con los bocetos claro/oscuro (22/07/2026): claro, fijo.
  const tema = "light";

  const manana = new Date(new Date(`${fecha}T12:00:00Z`).getTime() + 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [cierres, pizarra, dolarFuturo, chicago, noticias, borrador, informesHoy, interpretaciones, bcra] =
    await Promise.all([
      getCierresGranos(),
      getPizarra(),
      getDolarFuturo(),
      getMonitorMercados(),
      getNoticias(),
      getBorrador(fecha),
      getInformesHoy(fecha),
      getInterpretaciones(fecha),
      getBcra(fecha),
    ]);

  const prosa: ProsaDiaria = borrador?.prosa ?? {};
  const titulo = borrador?.titulo || prosa.titulo || "Mesa de operaciones";
  const comentario = prosa.comentario ?? [];
  const lineasPorGrano = prosa.lineas_por_grano ?? {};

  const agro = chicago.agro.filter((r) => ["Soja", "Maíz", "Trigo"].includes(r.nombre));
  const eventos = getEventos(fecha, manana).slice(0, 3);
  const titulares = noticias.destacados.slice(0, 3);

  const [d, m, a] = fecha.split("-");
  const fechaLegible = `${d}/${m}/${a}`;

  return (
    <div className="plc-page">
      <div className="plc" data-tema={tema}>
        <header className="plc-hd">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático de /public, no contenido para <Image>. */}
          <img src="/rofoagro-isotipo.svg" alt="" width={52} height={30} />
          <div className="plc-hd-wm">
            <span className="plc-hd-tit">Mesa de operaciones Agro 🚜👨‍🌾</span>
            <span className="plc-hd-fecha">{fechaLegible}</span>
          </div>
        </header>

        <h1 className="plc-titulo">&ldquo;{titulo}&rdquo;</h1>

        {comentario.length > 0 && (
          <ul className="plc-comentario">
            {comentario.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        )}

        <div className="plc-granos">
          {GRANOS.map((g) => {
            const grano = cierres.granos.find((c) => c.underlying === g.underlying);
            const pz = pizarra.granos[g.underlying];
            const posiciones = (grano?.posiciones ?? []).filter((p) => p.venc > 0).slice(0, 3);
            const volTotal = grano ? volumenTotalGrano(grano) : null;
            return (
              <div className="plc-grano" key={g.underlying}>
                <div className="plc-grano-hd">
                  <span className="plc-grano-nombre">{g.emoji} {g.nombre}</span>
                  <span className="plc-grano-pizarra">
                    Pizarra {pz?.usd != null ? `US$${nfmt(pz.usd, 1)}` : "—"}
                    {pz?.ars != null ? ` · $${nfmt(pz.ars, 0)}` : ""}
                    {volTotal != null ? ` · Vol. A3 ${nfmt(volTotal, 0)}` : ""}
                  </span>
                </div>
                {lineasPorGrano[g.underlying.toLowerCase()] && (
                  <p className="plc-grano-linea">{lineasPorGrano[g.underlying.toLowerCase()]}</p>
                )}
                <div className="plc-grano-pos-list">
                  {posiciones.length > 0
                    ? posiciones.map((p) => <PosChip key={p.symbol} p={p} />)
                    : <span className="plc-grano-linea">Sin cierres de futuro disponibles.</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="plc-franja">
          <div className="plc-franja-col">
            <div className="plc-franja-h">💵 Dólar mayorista</div>
            <div className="plc-franja-row">
              <span>Spot MAE</span>
              <span>{dolarFuturo.spot != null ? nfmt(dolarFuturo.spot, 1) : "—"}</span>
            </div>
            {dolarFuturo.posiciones.slice(0, 2).map((p) => (
              <div className="plc-franja-row" key={p.ticker}>
                <span>{p.label}</span>
                <span>{p.ultimo != null ? `${nfmt(p.ultimo, 1)} (TNA ${nfmt(p.tnaPct, 1)}%)` : "—"}</span>
              </div>
            ))}
            {bcra && (
              <div className="plc-franja-row">
                <span>🏦 BCRA compras netas</span>
                <span>US$ {nfmt(bcra.monto_musd, 1)}M</span>
              </div>
            )}
          </div>
          <div className="plc-franja-col">
            <div className="plc-franja-h">🌽 Chicago</div>
            {agro.slice(0, 3).map((r) => (
              <div className="plc-franja-row" key={r.yahoo}>
                <span>{r.nombre}</span>
                <span>{r.usdTn != null ? `US$${nfmt(r.usdTn, 1)}/tn (${pfmt(r.deltaPct, 1)})` : "—"}</span>
              </div>
            ))}
          </div>
        </div>

        <footer className="plc-pie">
          {titulares.length > 0 && (
            <>
              <div className="plc-pie-tit">En la noticia</div>
              {titulares.map((t) => (
                <div className="plc-pie-item" key={t.link}>· {t.titulo} ({t.fuente})</div>
              ))}
            </>
          )}
          {eventos.length > 0 && (
            <>
              <div className="plc-pie-tit">Agenda</div>
              {eventos.map((e, i) => (
                <div className="plc-pie-item" key={i}>
                  · {e.organismo} — {e.informe} ({e.fechaISO === fecha ? "hoy" : "mañana"})
                </div>
              ))}
            </>
          )}
          {informesHoy.length > 0 && (
            <>
              <div className="plc-pie-tit">Informe del día</div>
              {informesHoy.map((inf) => {
                const interp = interpretaciones.find((i) => i.organismo === inf.organismo);
                return (
                  <div className="plc-pie-item" key={inf.organismo}>
                    · <b>{inf.organismo}</b> — {inf.informe}:{" "}
                    {inf.cambios.slice(0, 3).map((c, i) => (
                      <span key={i}>
                        {i > 0 && " · "}
                        {c.grano} {c.pais} {c.campania} {nfmt(c.antes, 1)}→{nfmt(c.ahora, 1)} {c.unidad}
                        {" "}({pfmt(c.antes ? (c.delta / c.antes) * 100 : 0, 1)})
                      </span>
                    ))}
                    {interp && <span> — {interp.publicado_md}</span>}
                  </div>
                );
              })}
            </>
          )}
          <p className="plc-disclaimer">
            Research informativo de ROFO AGRO, no constituye recomendación de inversión. Datos de
            fuentes públicas y de mercado, sujetos a revisión.
          </p>
          <p className="plc-sello">datos al {horaCordoba(new Date(), false)}</p>
        </footer>
      </div>
    </div>
  );
}
