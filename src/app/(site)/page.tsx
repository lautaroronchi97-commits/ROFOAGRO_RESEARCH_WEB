import Link from "next/link";
import { getCintaData } from "@/lib/market";
import { getPizarra } from "@/lib/pizarra";
import { getNoticias, type NoticiaItem } from "@/lib/noticias";
import { getInterpretacionesPublicadas } from "@/lib/interpretaciones";
import { ORG_LABEL, type Organismo } from "@/lib/calendario";
import { hoyCordobaISO, fechaCordobaISO } from "@/lib/dates";
import { nfmt } from "@/lib/format";
import { Cinta } from "@/components/cinta";
import { CountUp } from "@/components/count-up";
import { MercadoHoy } from "@/components/mercado-hoy";
import { InformesPanel } from "@/components/informes-panel";
import { EstimacionesMini } from "@/components/estimaciones-mini";
import { AUTH_ENFORCED } from "@/lib/auth/config";
import { getAcceso } from "@/lib/auth/dal";

/** Titular sintético de una interpretación publicada hoy (MP4) — se suma a las
 * novedades del día como CUALQUIER otra noticia, pero apunta adentro del Sitio. */
type Titular = NoticiaItem & { interno?: true };

// Revalida la cinta, los titulares y "el mercado hoy" cada 60s (caché corto).
export const revalidate = 60;

// Tarjetas del tablero: una por sección (con su clave), con "para qué sirve".
const SECCIONES: { key: string; href: string; nombre: string; desc: string }[] = [
  { key: "granos", href: "/granos", nombre: "Granos", desc: "Arbitrajes, pases, capacidad de pago y la mejor salida para hacer caja." },
  { key: "dolar", href: "/dolar", nombre: "Dólar y tasas", desc: "Dólar futuro, linked, tasas implícitas y el panel cambiario." },
  { key: "comercio", href: "/comercio", nombre: "Comercio exterior", desc: "Declaraciones de venta al exterior de granos y subproductos." },
  { key: "calculadoras", href: "/calculadoras", nombre: "Calculadoras", desc: "Cotizadores para operar: a fijar, pases, carry, costos y más." },
  { key: "graficos", href: "/graficos", nombre: "Gráficos", desc: "Spreads entre cosechas, con las campañas superpuestas." },
  { key: "produccion", href: "/produccion", nombre: "Producción", desc: "Calendario de informes y estimaciones por país y grano." },
  { key: "noticias", href: "/noticias", nombre: "Noticias", desc: "El portal del agro: granos, dólar, clima y exportaciones." },
  { key: "informes", href: "/informes", nombre: "Informes", desc: "El informe diario de la mesa: research y color de la rueda." },
];

export default async function Home() {
  // getPizarra() está cache()ada y getCintaData() ya la llama adentro → pedirla
  // acá de nuevo NO agrega ningún request: es la misma promesa deduplicada.
  // Alimenta la placa del hero (pizarra soja = el número que todo productor conoce).
  const [cinta, pizarra] = await Promise.all([getCintaData(), getPizarra()]);
  const [noticias, interpretaciones] = await Promise.all([getNoticias(), getInterpretacionesPublicadas()]);

  // Toda interpretación de informe (MP4) que Lautaro PUBLICÓ hoy (no la fecha del informe
  // original — un WASDE del 10/07 puede aprobarse recién el 23/07) va a la cabecera de
  // "Novedades del día", antes que las noticias — es contenido propio de la mesa, más
  // relevante que un titular externo. Al día siguiente `editado_en` ya no es hoy y
  // desaparece sola (mismo criterio "day-scoped" que `mesa_color`/`informesHoy`).
  const hoy = hoyCordobaISO();
  const interpHoy: Titular[] = interpretaciones
    .filter((i) => fechaCordobaISO(i.editado_en) === hoy)
    .map((i) => ({
      titulo: `La lectura de la mesa: ${i.informe} (${ORG_LABEL[i.organismo as Organismo] ?? i.organismo})`,
      fuente: "ROFO AGRO",
      link: "/informes#lectura-mesa",
      fechaMs: null,
      nMedios: 1,
      sinFecha: true,
      interno: true,
    }));

  const titulares: Titular[] = [...interpHoy, ...noticias.destacados].slice(0, 8);
  const [destacado, ...resto] = titulares;

  // Con el login prendido la home filtra por permisos: la grilla del tablero
  // muestra solo las secciones permitidas (los admin ven las 7), y los bloques
  // de datos aparecen solo si el usuario tiene la sección de origen. Con el flag
  // apagado (producción hoy) se muestra todo y no se lee la sesión.
  let secciones = SECCIONES;
  let puedeGranos = true;
  let puedeProduccion = true;
  if (AUTH_ENFORCED) {
    const acceso = await getAcceso();
    if (acceso && !acceso.esAdmin) {
      secciones = SECCIONES.filter((s) => acceso.visibles.includes(s.key));
      puedeGranos = acceso.visibles.includes("granos");
      puedeProduccion = acceso.visibles.includes("produccion");
    }
  }

  // Fecha larga del kicker del hero ("martes 28 de julio de 2026" → capitalizada).
  const fechaLargaRaw = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Cordoba",
  }).format(new Date());
  const fechaLarga = fechaLargaRaw.charAt(0).toUpperCase() + fechaLargaRaw.slice(1);

  // La placa del hero: pizarra soja como número protagonista (misma getPizarra()
  // deduplicada que ya usa la cinta), con maíz/trigo + mayorista como contexto.
  // Es dato de la sección "granos" → respeta el mismo permiso que "El mercado hoy".
  const soja = pizarra.granos.SOJ ?? null;
  const maiz = pizarra.granos.MAI ?? null;
  const trigo = pizarra.granos.TRI ?? null;
  const mayorista = cinta.items.find((i) => i.label === "Mayorista")?.value ?? null;
  const conPlaca = puedeGranos && soja !== null;

  return (
    <>
      <h1 className="sr">ROFO AGRO — Pizarra electrónica de granos</h1>
      <Cinta data={cinta} />
      <main className="wrap">
        <div className="col">
          {destacado && (
            <section className={`hero-dia${conPlaca ? "" : " sin-placa"}`} aria-label="Novedades del día">
              <div className="hero-main">
                <div className="hero-kicker">
                  <span>Novedades del día · {fechaLarga}</span>
                  <Link href="/noticias" className="hub-hoy-more">
                    Ver todas →
                  </Link>
                </div>

                {destacado.interno ? (
                  <Link className="hero-headline" href={destacado.link}>
                    {destacado.titulo}
                  </Link>
                ) : (
                  <a className="hero-headline" href={destacado.link} target="_blank" rel="noopener noreferrer">
                    {destacado.titulo}
                  </a>
                )}
                <div className="hero-meta">
                  <span className="ht-fuente">{destacado.fuente}</span>
                  {!destacado.interno && destacado.nMedios > 1 && (
                    <span className="ht-medios">{destacado.nMedios} medios</span>
                  )}
                </div>

                {resto.length > 0 && (
                  <ul className="hero-subheads">
                    {resto.slice(0, 5).map((t, i) =>
                      t.interno ? (
                        <li key={`${t.link}-${i}`}>
                          <Link href={t.link}>
                            <span className="ht-titulo">{t.titulo}</span>
                            <span className="ht-fuente">{t.fuente}</span>
                          </Link>
                        </li>
                      ) : (
                        <li key={t.link}>
                          <a href={t.link} target="_blank" rel="noopener noreferrer">
                            <span className="ht-titulo">{t.titulo}</span>
                            <span className="ht-fuente">{t.fuente}</span>
                          </a>
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </div>

              {puedeGranos && soja && (
                <aside className="hero-placa" aria-label="Pizarra Rosario — soja disponible">
                  <div className="hp-lbl">
                    Pizarra Rosario · Soja
                    {soja.estimativo && (
                      <span className="pz-estim" title="Valor estimado (CAC sin publicar todavía)">
                        est.
                      </span>
                    )}
                  </div>
                  <div className="hp-big">
                    <CountUp value={soja.usd} decimals={1} />
                    <small> US$/tn</small>
                  </div>
                  <p className="hp-ctx">
                    Maíz <b>{maiz ? nfmt(maiz.usd, 1) : "—"}</b> · Trigo <b>{trigo ? nfmt(trigo.usd, 1) : "—"}</b>
                    {mayorista !== null && (
                      <>
                        {" "}
                        · Mayorista <b>$ {nfmt(mayorista, 2)}</b>
                      </>
                    )}
                  </p>
                  <Link href="/granos" className="hp-link">
                    Arbitrajes y pases →
                  </Link>
                </aside>
              )}
            </section>
          )}

          <div className="home-panels">
            {puedeGranos && <MercadoHoy />}
            {puedeProduccion && <InformesPanel />}
            {puedeProduccion && <EstimacionesMini />}
          </div>

          <h2 className="sec-title">Explorá el sitio</h2>
          <nav className="hub-grid hub-grid--compact" aria-label="Secciones del sitio">
            {secciones.map((s) => (
              <Link key={s.href} href={s.href} className="hub-card">
                <span className="hub-card-name">{s.nombre}</span>
                <span className="hub-card-desc">{s.desc}</span>
                <span className="hub-card-go" aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </nav>
        </div>
      </main>
    </>
  );
}
