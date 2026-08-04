import type { Metadata } from "next";
import { datosSemanal } from "@/lib/informe-semanal-datos";
import { deltaCondicionReciente, type DeltaCondicion } from "@/lib/pas-condicion-calc";
import { tasaDirecta, tnaUSD } from "@/lib/arbitraje";
import { hoyCordobaISO } from "@/lib/dates";
import { sbSelect } from "@/lib/supabase";
import { tokenValido, esFechaValida } from "@/lib/informe-auth";
import { nfmt, pfmt, horaCordoba } from "@/lib/format";
import { VariacionBarras, type ItemVariacion } from "@/components/variacion-barras";
import { DolarOficialChart } from "@/components/dolar-oficial-chart";
import { DolarOficialVolatilidadChart } from "@/components/dolar-oficial-volatilidad-chart";
import { BcraMulcChart } from "@/components/bcra-mulc-chart";
import { ImpactoBadges } from "@/components/impacto-badges";
import type { Impacto } from "@/lib/interpretaciones";

/**
 * Placa del informe SEMANAL (MP2 de docs/PLAN_INFORMES.md, ampliada por V3 de
 * docs/PLAN_INFORMES_V2.md §6.3, REESTRUCTURADA por producto en E4 de
 * docs/PLAN_INFORMES_V3.md §6) — PDF A4, flujo libre SIN límite de páginas (N1: revoca las 5
 * páginas duras de V2/V3), tema SIEMPRE claro (impreso). Standalone (sin header/nav), gateada
 * por token en searchParam — mismo patrón que la plantilla diaria.
 *
 * Estructura (§6.1): tapa → "la semana en números" (transversal) → UNA SECCIÓN POR PRODUCTO
 * (SOJA→MAÍZ→TRIGO, local/internacional siempre separados dentro de cada una — N8) → "Dólar y
 * macro local" → "Contexto internacional" → "Comercio exterior transversal" → "Cierre". Todo
 * sale de `datosSemanal()` (`informe-semanal-datos.ts`) — la MISMA función que consume
 * `/api/informes/datos?tipo=semanal`, cero query duplicada entre las 2 superficies.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const GRANO_LABEL: Record<string, string> = { SOJ: "Soja", MAI: "Maíz", TRI: "Trigo" };
const GRANO_EMOJI: Record<string, string> = { SOJ: "🌱", MAI: "🌽", TRI: "🌾" };

/** Producto por producto (N8): underlying (A3) · key (pizarra/Chicago/view/PAS/estimaciones,
 *  siempre en minúscula sin tilde) · nombre (familia DJVE/empresas, con tilde) · cod (negociado
 *  SIO Granos). Orden fijo SOJA→MAÍZ→TRIGO en todo el informe. */
const PRODUCTOS = [
  { underlying: "SOJ", key: "soja", nombre: "Soja", cod: "SBS" },
  { underlying: "MAI", key: "maiz", nombre: "Maíz", cod: "MAIZE" },
  { underlying: "TRI", key: "trigo", nombre: "Trigo", cod: "WHEAT" },
] as const;

type ProsaSemanal = {
  titulo?: string;
  resumen_ejecutivo?: string[];
  /** Prosa por producto (E4 — reemplaza el único `granos_texto` de V2/V3). */
  soja_texto?: string;
  maiz_texto?: string;
  trigo_texto?: string;
  /** Dólar/macro local. */
  local_texto?: string;
  /** Chicago + "el mundo esta semana" + otros mercados. */
  internacional_texto?: string;
  /** V3 (PLAN_INFORMES_V2.md §6.3): "El mundo esta semana" — 3-4 bullets del research
   *  acotado (COT/Crop Progress/Brasil/clima), cada uno con su fuente citada EN el texto.
   *  Vacío/ausente = "sin lectura externa esta semana" (degradación honesta, P7). */
  mundo_bullets?: string[];
  comex_texto?: string;
  cierre?: string;
  /** Canal de la pizarra estimada del viernes (§6.1): la skill la extrae del color de la mesa
   *  y la persiste acá, keyed por underlying A3 (mismo criterio que `pizarraEstimada` del
   *  diario) — la plantilla la usa para recalcular la tabla de tasas implícitas. Sin este
   *  campo, esa tabla usa la pizarra OFICIAL que ya trae `arbitrajes`. */
  pizarra_estimada?: Partial<Record<"SOJ" | "MAI" | "TRI", { usd: number | null; ars?: number | null }>>;
};

type Datos = Awaited<ReturnType<typeof datosSemanal>>;

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

/** Suma tolerante a `null`: si ningún elemento tiene valor, `null` (nunca "0" fantasma). */
function sumaOpc(valores: (number | null | undefined)[]): number | null {
  const conocidos = valores.filter((v): v is number => v != null);
  if (conocidos.length === 0) return null;
  return conocidos.reduce((a, b) => a + b, 0);
}

/** Tolera los 5 estados del view (N2, migración ya aplicada en E1 — la réplica TS de E5 sigue
 *  pendiente): "levemente_alcista"/"levemente_bajista" se pintan con el mismo tono que su
 *  extremo, la etiqueta se humaniza sin depender de un mapa fijo de 3 valores. */
function direccionTono(direccion: string): "alcista" | "bajista" | "neutral" {
  if (direccion.includes("alcista")) return "alcista";
  if (direccion.includes("bajista")) return "bajista";
  return "neutral";
}
function direccionLabel(direccion: string): string {
  return direccion.replace(/_/g, " ").toUpperCase();
}

function DirBadge({ direccion }: { direccion: string }) {
  return <span className={`sem-badge-dir ${direccionTono(direccion)}`}>{direccionLabel(direccion)}</span>;
}

function Stat({ label, value, tono }: { label: string; value: string; tono?: "pos" | "neg" | "neu" }) {
  const color = tono === "pos" ? "var(--pos)" : tono === "neg" ? "var(--neg)" : undefined;
  return (
    <div className="sem-stat-row">
      <span className="l">{label}</span>
      <span style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}

function tonoDe(n: number | null | undefined): "pos" | "neg" | "neu" {
  return n == null ? "neu" : n > 0 ? "pos" : n < 0 ? "neg" : "neu";
}

/* ---------------- Bloque por producto (§6.1) ---------------- */

type Producto = (typeof PRODUCTOS)[number];

function seccionProducto(p: Producto, datos: Datos, prosa: ProsaSemanal) {
  const {
    variacionGranos, variacionPizarra, variacionChicago, negociado, djveResumen, empresas,
    arbitrajes, pases, informesSemana, pasCondicion, interpretacionesSemana, viewsMercado,
  } = datos;

  // --- Precios ---
  const local = variacionGranos.filter((v) => v.underlying === p.underlying);
  const pizarraDelta = variacionPizarra.find((v) => v.grano === p.key) ?? null;
  const chicagoDelta = variacionChicago.filter((v) => v.grano === p.key);

  // --- Volúmenes + comercial (negociado SIO, activas del producto, ambos sectores) ---
  const filasProducto = negociado.filas.filter((f) => f.activa && f.cod === p.cod);
  const semanal = sumaOpc(filasProducto.map((f) => f.semanal));
  const semanalPrev = sumaOpc(filasProducto.map((f) => f.semanalPrev));
  const acumulado = sumaOpc(filasProducto.map((f) => f.acumulado));
  const precioHecho = sumaOpc(filasProducto.map((f) => f.precioHecho));
  const fijado = sumaOpc(filasProducto.map((f) => f.fijado));
  const saldoAFijar = sumaOpc(filasProducto.map((f) => f.saldoAFijar));
  const deltaNegociadoPct = semanal != null && semanalPrev != null && semanalPrev !== 0 ? (semanal / semanalPrev - 1) * 100 : null;
  const pctDelTotal = semanal != null && negociado.totalSemanal ? (semanal / negociado.totalSemanal) * 100 : null;
  const priceado = sumaOpc([precioHecho, fijado]);
  const pctPriceado = priceado != null && acumulado != null && acumulado > 0 ? (priceado / acumulado) * 100 : null;

  const volA3 = datos.volumenA3Semanal.find((v) => v.underlying === p.underlying) ?? null;

  const djveTon7d = sumaOpc(djveResumen.productos.filter((d) => d.familia === p.nombre).map((d) => d.ton7d));

  const gaps = empresas.productos.filter((g) => g.familia === p.nombre);
  const declarado60d = gaps.reduce((s, g) => s + g.declarado60d, 0);
  const originado60d = gaps.reduce((s, g) => s + g.originado60d, 0);
  const ratioGap = gaps.length > 0 && declarado60d > 0 ? originado60d / declarado60d : null;

  // --- Tasas implícitas: pizarra estimada del viernes si la cargaron, si no la oficial ---
  const arbGrano = arbitrajes.granos.find((g) => g.underlying === p.underlying) ?? null;
  const paseGrano = pases.granos.find((g) => g.underlying === p.underlying) ?? null;
  const estimadaUsd = prosa.pizarra_estimada?.[p.underlying]?.usd ?? null;
  const filasArb = (arbGrano?.rows ?? []).map((r) => {
    if (estimadaUsd != null && r.ajuste != null && r.dias != null) {
      return { ...r, directa: tasaDirecta(r.ajuste, estimadaUsd), tna: tnaUSD(r.ajuste, estimadaUsd, r.dias) };
    }
    return r;
  });
  const rotuloPizarra = estimadaUsd != null
    ? "Cálculo con pizarra estimada de la mesa (viernes)"
    : arbitrajes.pizarraFecha
      ? `Pizarra oficial del ${fechaLegible(arbitrajes.pizarraFecha)}${arbGrano?.pizarraEstimativa ? " (estimativa)" : ""}`
      : "Sin pizarra disponible esta semana";

  // --- Producción: informes de organismos + Δ de condición reciente ---
  const cambiosProducto = informesSemana.flatMap((inf) =>
    inf.cambios.filter((c) => c.grano === p.key).map((c) => ({ ...c, organismo: inf.organismo, informe: inf.informe })),
  );
  const deltaCondicion: DeltaCondicion | null = deltaCondicionReciente(pasCondicion, p.key, "total");

  // --- La semana según la mesa: interpretaciones que tocan al producto + view vigente ---
  const interpProducto = interpretacionesSemana.filter(
    (i) => i.granos?.includes(p.key) || Object.keys(i.impacto ?? {}).includes(p.key),
  );
  const view = viewsMercado.find((v) => v.grano === p.key) ?? null;

  const textoProducto = p.key === "soja" ? prosa.soja_texto : p.key === "maiz" ? prosa.maiz_texto : prosa.trigo_texto;

  return {
    local, pizarraDelta, chicagoDelta,
    semanal, semanalPrev, acumulado, saldoAFijar, deltaNegociadoPct, pctDelTotal, pctPriceado,
    volA3, djveTon7d, declarado60d, originado60d, ratioGap, gapDefinido: gaps.length > 0,
    filasArb, rotuloPizarra, pasesProducto: paseGrano?.spreads ?? [],
    cambiosProducto, deltaCondicion, interpProducto, view, textoProducto,
  };
}

function SeccionProductoUI({ p, datos, prosa, n }: { p: Producto; datos: Datos; prosa: ProsaSemanal; n: number }) {
  const b = seccionProducto(p, datos, prosa);
  return (
    <section className="sem-hoja">
      <div className="sem-hd">
        <span className="sem-hd-tit">{GRANO_EMOJI[p.underlying]} {p.nombre}</span>
        <span className="sem-hd-pag">{n}</span>
      </div>

      <p className="sem-sec-tit" style={{ marginTop: 0 }}>Local</p>
      <div className="sem-grid-3" style={{ marginBottom: 18 }}>
        <div className="sem-card">
          <p className="sem-card-tit">Precios — A3 (3 posiciones)</p>
          {b.local.length > 0 ? (
            b.local.map((v) => (
              <Stat key={v.posicion} label={v.posicion} value={pfmt(v.deltaPct, 1)} tono={tonoDe(v.deltaPct)} />
            ))
          ) : (
            <p className="sem-texto" style={{ margin: 0, fontSize: 12 }}>Sin posiciones vivas con operado esta semana.</p>
          )}
          <p className="sem-mini-tit">Pizarra CAC-BCR (USD/tn)</p>
          <Stat label="Δ semanal" value={pfmt(b.pizarraDelta?.deltaPct ?? null, 1)} tono={tonoDe(b.pizarraDelta?.deltaPct)} />
        </div>

        <div className="sem-card">
          <p className="sem-card-tit">Volúmenes de la semana</p>
          <Stat label="Físico (SIO, t)" value={b.semanal != null ? nfmt(b.semanal, 0) : "—"} />
          <Stat label="Δ vs sem. prev." value={pfmt(b.deltaNegociadoPct, 1)} tono={tonoDe(b.deltaNegociadoPct)} />
          <Stat label="A3 (contratos)" value={b.volA3?.volumen != null ? nfmt(b.volA3.volumen, 0) : "—"} />
          <Stat label="% del total negociado" value={b.pctDelTotal != null ? pfmt(b.pctDelTotal, 1) : "—"} />
        </div>

        <div className="sem-card">
          <p className="sem-card-tit">Comercial</p>
          <Stat label="Acumulado campaña (t)" value={b.acumulado != null ? nfmt(b.acumulado, 0) : "—"} />
          <Stat label="% priceado" value={b.pctPriceado != null ? pfmt(b.pctPriceado, 1) : "—"} />
          <Stat label="Saldo a fijar (t)" value={b.saldoAFijar != null ? nfmt(b.saldoAFijar, 0) : "—"} />
          <Stat label="DJVE últimos 7d (t)" value={b.djveTon7d != null ? nfmt(b.djveTon7d, 0) : "—"} />
          <Stat
            label="Gap cobertura 60d"
            value={b.gapDefinido ? (b.ratioGap != null ? nfmt(b.ratioGap, 2) : "—") : "Sin datos"}
            tono={b.ratioGap != null ? (b.ratioGap >= 1 ? "pos" : "neg") : undefined}
          />
        </div>
      </div>

      <p className="sem-sec-tit">Tasas implícitas del producto</p>
      <p className="sem-texto" style={{ fontSize: 11.5, marginBottom: 8 }}>{b.rotuloPizarra}</p>
      <div className="table-scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th className="l" scope="col">Posición</th>
              <th scope="col">Ajuste</th>
              <th scope="col">Directa</th>
              <th scope="col">Días</th>
              <th scope="col">TNA</th>
              <th scope="col">Vol.</th>
            </tr>
          </thead>
          <tbody>
            {b.filasArb.map((r) => (
              <tr key={r.pos}>
                <td className="l">{r.pos}</td>
                <td>{r.ajuste != null ? nfmt(r.ajuste, 1) : "—"}</td>
                <td>{pfmt(r.directa, 2)}</td>
                <td>{r.dias ?? "—"}</td>
                <td>{pfmt(r.tna, 1)}</td>
                <td>{r.volume != null ? nfmt(r.volume, 0) : "—"}</td>
              </tr>
            ))}
            {b.filasArb.length === 0 && (
              <tr><td className="l dim" colSpan={6}>Sin arbitrajes disponibles.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {b.pasesProducto.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <p className="sem-mini-tit" style={{ marginTop: 0 }}>Pases</p>
          <VariacionBarras
            items={b.pasesProducto.map((s): ItemVariacion => ({ label: s.label, deltaPct: s.tna }))}
          />
        </div>
      )}

      <p className="sem-sec-tit">Producción</p>
      {b.cambiosProducto.length > 0 ? (
        <ul className="sem-resumen" style={{ marginBottom: 8 }}>
          {b.cambiosProducto.map((c, i) => (
            <li key={i} style={{ fontSize: 13 }}>
              <b>{c.organismo}</b> ({c.informe}) — {c.pais} {c.campania}: {nfmt(c.antes, 1)}→{nfmt(c.ahora, 1)} {c.unidad}
            </li>
          ))}
        </ul>
      ) : (
        <p className="sem-texto" style={{ fontSize: 13 }}>Sin informes de organismos publicados esta semana para este producto.</p>
      )}
      {b.deltaCondicion && Math.abs(b.deltaCondicion.deltaPts) >= 8 && (
        <p className="sem-texto" style={{ fontSize: 13 }}>
          BCBA-PAS — condición de cultivo (buena+excelente, campaña {b.deltaCondicion.campania}):{" "}
          {nfmt(b.deltaCondicion.valorPrevio, 1)}%→{nfmt(b.deltaCondicion.valorActual, 1)}% entre las semanas{" "}
          {b.deltaCondicion.semanaPrevia} y {b.deltaCondicion.semanaActual}
          {" "}({b.deltaCondicion.deltaPts >= 0 ? "+" : ""}{nfmt(b.deltaCondicion.deltaPts, 1)} pts).
        </p>
      )}

      <p className="sem-sec-tit">La semana según la mesa</p>
      {b.view ? (
        <div className="sem-card" style={{ marginBottom: 8 }}>
          <DirBadge direccion={b.view.direccion} />
          <span style={{ marginLeft: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-3)" }}>
            confianza {b.view.confianza}/5 · {fechaLegible(b.view.fecha)}
          </span>
          <p className="sem-texto" style={{ marginTop: 8 }}>{b.view.tesis_md.replace(/\*\*/g, "")}</p>
        </div>
      ) : (
        <p className="sem-texto" style={{ fontSize: 13 }}>Sin view de mercado vigente para este producto.</p>
      )}
      {b.interpProducto.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {b.interpProducto.map((i, idx) => (
            <div key={idx}>
              <p className="sem-texto" style={{ margin: 0, fontSize: 13 }}>
                <b>{i.organismo}</b> — {i.informe}: {i.publicado_md}
              </p>
              <ImpactoBadges impacto={i.impacto as Impacto} />
            </div>
          ))}
        </div>
      )}

      {b.textoProducto && <p className="sem-texto">{b.textoProducto}</p>}
    </section>
  );
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
  const [datos, borrador] = await Promise.all([datosSemanal(fecha), getBorrador(fecha)]);
  const { desdeSemana } = datos;

  const prosa: ProsaSemanal = borrador?.prosa ?? {};
  const titulo = borrador?.titulo || prosa.titulo || "Informe semanal";
  const resumen = prosa.resumen_ejecutivo ?? [];
  const agenda = datos.agenda.filter((e) => e.fechaISO > fecha).slice(0, 8);

  const barrasGranos = datos.variacionGranos.map((v) => ({
    label: `${GRANO_LABEL[v.underlying] ?? v.underlying} ${v.posicion}`,
    deltaPct: v.deltaPct,
    sub: v.fechaActual ? `(${v.fechaActual})` : undefined,
  }));
  const barrasChicago = datos.variacionChicago.map((v) => ({
    label: `${PRODUCTOS.find((p) => p.key === v.grano)?.nombre ?? v.grano} ${v.posicion}`,
    deltaPct: v.deltaPct,
    sub: v.fechaActual ? `(${v.fechaActual})` : undefined,
  }));
  const mundoBullets = prosa.mundo_bullets ?? [];
  const otrosMercados = datos.variacionMacro.filter((m) => m.delta.deltaPct != null && Math.abs(m.delta.deltaPct) >= 5);

  // "La semana según la mesa" ya se reparte por producto — el view completo por grano se lee ahí.
  const camionesTotalActual = sumaOpc([datos.camionesSemana.williams.totalActual, datos.camionesSemana.agroentregas.totalActual]);
  const camionesTotalPrevio = sumaOpc([datos.camionesSemana.williams.totalPrevio, datos.camionesSemana.agroentregas.totalPrevio]);
  const camionesDeltaPct = camionesTotalActual != null && camionesTotalPrevio != null && camionesTotalPrevio !== 0
    ? (camionesTotalActual / camionesTotalPrevio - 1) * 100
    : null;

  let contador = 1;

  return (
    <div className="sem-page">
      {/* Tapa — resumen ejecutivo */}
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

      {/* La semana en números — transversal, corta */}
      <section className="sem-hoja">
        <div className="sem-hd">
          <span className="sem-hd-tit">La semana en números</span>
          <span className="sem-hd-pag">{++contador}</span>
        </div>
        <div className="sem-sec">
          <p className="sem-sec-tit">A3 (Matba Rofex) — Δ semanal</p>
          <VariacionBarras items={barrasGranos} />
        </div>
        <div className="sem-sec">
          <p className="sem-sec-tit">Pizarra CAC-BCR (USD/tn) — Δ semanal</p>
          <VariacionBarras
            items={datos.variacionPizarra.map((v) => ({
              label: PRODUCTOS.find((p) => p.key === v.grano)?.nombre ?? v.grano,
              deltaPct: v.deltaPct,
            }))}
          />
        </div>
        <div className="sem-sec">
          <p className="sem-sec-tit">Chicago (USD/tn) — Δ semanal</p>
          <VariacionBarras items={barrasChicago} />
        </div>
        <div className="sem-sec">
          <p className="sem-sec-tit">Volumen de la semana</p>
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="l" scope="col">Producto</th>
                  <th scope="col">A3 (contratos)</th>
                  <th scope="col">Físico SIO (t)</th>
                </tr>
              </thead>
              <tbody>
                {PRODUCTOS.map((p) => {
                  const a3 = datos.volumenA3Semanal.find((v) => v.underlying === p.underlying);
                  const fisico = sumaOpc(
                    datos.negociado.filas.filter((f) => f.activa && f.cod === p.cod).map((f) => f.semanal),
                  );
                  return (
                    <tr key={p.underlying}>
                      <td className="l">{p.nombre}</td>
                      <td>{a3?.volumen != null ? nfmt(a3.volumen, 0) : "—"}</td>
                      <td>{fisico != null ? nfmt(fisico, 0) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Una sección por producto (N8) */}
      {PRODUCTOS.map((p) => (
        <SeccionProductoUI key={p.underlying} p={p} datos={datos} prosa={prosa} n={++contador} />
      ))}

      {/* Dólar y macro local */}
      <section className="sem-hoja">
        <div className="sem-hd">
          <span className="sem-hd-tit">Dólar y macro local</span>
          <span className="sem-hd-pag">{++contador}</span>
        </div>
        <div className="sem-sec">
          <p className="sem-sec-tit">Dólar oficial (BCRA A3500)</p>
          <DolarOficialChart serie={datos.variacionDolarOficial.serie} sinTabla />
        </div>
        <div className="sem-sec">
          <p className="sem-sec-tit">Volatilidad</p>
          <DolarOficialVolatilidadChart
            semanal={datos.volatilidadDolar.volatilidadSemanal}
            diaria={datos.volatilidadDolar.volatilidadDiaria}
          />
        </div>
        <div className="sem-sec">
          <p className="sem-sec-tit">Compras BCRA (MULC) — acumulado de la semana</p>
          <div className="sem-grid-2" style={{ marginBottom: 8 }}>
            <Stat
              label="Total"
              value={datos.comprasBcraSemana.totalActual != null ? `US$${nfmt(datos.comprasBcraSemana.totalActual, 0)}M` : "—"}
            />
            <Stat label="Δ vs sem. prev." value={pfmt(datos.comprasBcraSemana.deltaPct, 1)} tono={tonoDe(datos.comprasBcraSemana.deltaPct)} />
          </div>
          <BcraMulcChart serie={datos.comprasBcra.serie} />
        </div>
        <div className="sem-sec">
          <p className="sem-sec-tit">Dólar linked — TNA/TEA por especie</p>
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="l" scope="col">Bono</th>
                  <th scope="col">Px</th>
                  <th scope="col">TC implícito</th>
                  <th scope="col">Días</th>
                  <th scope="col">TNA</th>
                </tr>
              </thead>
              <tbody>
                {datos.dolarLinked.bonos.map((b) => (
                  <tr key={b.symbol}>
                    <td className="l">{b.symbol}</td>
                    <td>{nfmt(b.px, 2)}</td>
                    <td>{nfmt(b.tcImpl, 2)}</td>
                    <td>{b.dias ?? "—"}</td>
                    <td>{pfmt(b.tnaPct, 1)}</td>
                  </tr>
                ))}
                {datos.dolarLinked.bonos.length === 0 && (
                  <tr><td className="l dim" colSpan={5}>Sin dólar linked disponible.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="sem-sec">
          <p className="sem-sec-tit">Carry en dólar futuro</p>
          <VariacionBarras
            items={datos.dolarFuturo.posiciones.slice(0, 2).map((pos) => ({ label: pos.label, deltaPct: pos.tnaPct }))}
          />
        </div>
        {prosa.local_texto && <p className="sem-texto">{prosa.local_texto}</p>}
      </section>

      {/* Contexto internacional */}
      <section className="sem-hoja">
        <div className="sem-hd">
          <span className="sem-hd-tit">Contexto internacional</span>
          <span className="sem-hd-pag">{++contador}</span>
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
        {otrosMercados.length > 0 && (
          <div className="sem-sec">
            <p className="sem-sec-tit">Otros mercados (Δ semanal ≥5%)</p>
            <VariacionBarras
              items={otrosMercados.map((m) => ({ label: m.nombre, deltaPct: m.delta.deltaPct }))}
            />
          </div>
        )}
        {prosa.internacional_texto && <p className="sem-texto">{prosa.internacional_texto}</p>}
      </section>

      {/* Comercio exterior transversal */}
      <section className="sem-hoja">
        <div className="sem-hd">
          <span className="sem-hd-tit">Comercio exterior</span>
          <span className="sem-hd-pag">{++contador}</span>
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
                {datos.embarques.cumplimiento.map((c, i) => (
                  <tr key={i}>
                    <td className="l">{c.display}</td>
                    <td>{c.declarado != null ? nfmt(c.declarado, 0) : "—"}</td>
                    <td>{c.embarcado != null ? nfmt(c.embarcado, 0) : "—"}</td>
                    <td>{c.buques ?? "—"}</td>
                    <td>{c.ratio != null ? pfmt(c.ratio * 100, 0) : "—"}</td>
                  </tr>
                ))}
                {datos.embarques.cumplimiento.length === 0 && (
                  <tr><td className="l dim" colSpan={5}>Sin datos de cumplimiento disponibles.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="sem-grid-2">
          <div className="sem-card">
            <p className="sem-card-tit">Camiones de la semana (Williams + Agroentregas)</p>
            <Stat label="Total" value={camionesTotalActual != null ? nfmt(camionesTotalActual, 0) : "—"} />
            <Stat label="Δ vs sem. prev." value={pfmt(camionesDeltaPct, 1)} tono={tonoDe(camionesDeltaPct)} />
          </div>
          <div className="sem-card">
            <p className="sem-card-tit">Line-up / embarques</p>
            {datos.embarques.pico ? (
              <p className="sem-texto" style={{ margin: 0, fontSize: 12.5 }}>
                Mayor programa: <b>{datos.embarques.pico.display}</b> {datos.embarques.pico.label} —{" "}
                {nfmt(datos.embarques.pico.ton, 0)} t.
              </p>
            ) : (
              <p className="sem-texto" style={{ margin: 0, fontSize: 12.5 }}>Sin pico de programa detectado.</p>
            )}
          </div>
        </div>
        {prosa.comex_texto && <p className="sem-texto">{prosa.comex_texto}</p>}
      </section>

      {/* Cierre */}
      <section className="sem-hoja">
        <div className="sem-hd">
          <span className="sem-hd-tit">Cierre — qué mirar la semana que viene</span>
          <span className="sem-hd-pag">{++contador}</span>
        </div>
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
