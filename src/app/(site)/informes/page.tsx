import type { Metadata } from "next";
import { requireSeccion } from "@/lib/auth/dal";
import { sbSelect } from "@/lib/supabase";
import { getInterpretacionesPublicadas } from "@/lib/interpretaciones";
import { ORG_LABEL } from "@/lib/calendario";
import { Panel, PanelHead } from "@/components/panel";
import { QueEsEsto } from "@/components/que-es-esto";
import { MdLite } from "@/components/md-lite";
import { PageHead } from "@/components/page-head";

export const metadata: Metadata = {
  title: "Informes · ROFO AGRO",
  description: "El informe diario de la mesa ROFO AGRO: research del día con datos de mercado y color de la rueda.",
};

type Informe = {
  id: string;
  fecha: string;
  titulo: string | null;
  path_png: string | null;
};

type InformeSemanal = {
  id: string;
  fecha: string;
  titulo: string | null;
  path_pdf: string | null;
};

async function signedUrl(path: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || !path) return null;
  try {
    const res = await fetch(`${url}/storage/v1/object/sign/informes/${path}`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ expiresIn: 3600 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { signedURL?: string };
    return typeof data.signedURL === "string" ? `${url}/storage/v1${data.signedURL}` : null;
  } catch {
    return null;
  }
}

function ddmmaaaa(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/**
 * Informes de la mesa (MP1 de docs/PLAN_INFORMES.md): histórico del informe diario
 * (placa PNG). RLS de `informes_generados` ya filtra a `estado=enviado` para
 * anon/authenticated — acá solo se listan, sin volver a chequear el estado. Las URLs
 * son firmadas con la service key (bucket privado); sin ella (local sin configurar)
 * la página lista igual pero sin imagen, degrada sin romper.
 */
export default async function InformesPage() {
  await requireSeccion("informes");

  const [res, resSemanal] = await Promise.all([
    sbSelect(
      "informes_generados?tipo=eq.diario&select=id,fecha,titulo,path_png&order=fecha.desc&limit=20",
      0,
    ),
    sbSelect(
      "informes_generados?tipo=eq.semanal&select=id,fecha,titulo,path_pdf&order=fecha.desc&limit=12",
      0,
    ),
  ]);
  const filas = res.ok ? (res.data as Informe[]) : [];
  const [destacado, ...resto] = filas;
  const urlDestacado = destacado?.path_png ? await signedUrl(destacado.path_png) : null;
  const filasSemanal = resSemanal.ok ? (resSemanal.data as InformeSemanal[]) : [];
  const semanales = await Promise.all(
    filasSemanal.map(async (f) => ({ ...f, url: f.path_pdf ? await signedUrl(f.path_pdf) : null })),
  );
  const lecturas = (await getInterpretacionesPublicadas()).slice(0, 8);

  return (
    <>
      <main className="wrap">
        <div className="col">
          <PageHead kicker="Research de la mesa" title="Informes" lede="El informe diario, el semanal y la lectura de los informes de organismos." />
          <Panel id="informe-diario">
            <PanelHead title="Informe diario" sub="research del día · mesa ROFO AGRO" />
            <QueEsEsto
              paraQue={
                <>
                  El resumen diario de la rueda: los datos de la web (granos, dólar, Chicago,
                  noticias) más el color que dejó la mesa ese día, redactado como research propio.
                </>
              }
              comoSeCalcula={
                <>
                  Se genera solo, post-cierre, con los mismos datos que ya ves en{" "}
                  <code>/granos</code>, <code>/dolar</code> y <code>/noticias</code>. Nada se
                  inventa: si un dato faltó ese día, el informe lo omite.
                </>
              }
            />

            {!res.ok && (
              <p className="dim" style={{ padding: 12 }}>
                No se pudo cargar el histórico en este momento. Probá recargar en un rato.
              </p>
            )}
            {res.ok && filas.length === 0 && (
              <p className="dim" style={{ padding: 12 }}>
                Todavía no hay informes publicados. El primero sale post-cierre del próximo día
                hábil.
              </p>
            )}

            {destacado && (
              <div style={{ padding: "0 4px 8px" }}>
                <p className="dim" style={{ margin: "0 0 8px" }}>
                  {ddmmaaaa(destacado.fecha)} — {destacado.titulo ?? "Mesa de operaciones"}
                </p>
                {urlDestacado ? (
                  // eslint-disable-next-line @next/next/no-img-element -- placa PNG servida por signed URL, no un asset estático de /public.
                  <img
                    src={urlDestacado}
                    alt={`Informe diario ${ddmmaaaa(destacado.fecha)}`}
                    style={{ width: "100%", maxWidth: 480, borderRadius: 12, border: "1px solid var(--line)" }}
                  />
                ) : (
                  <p className="dim">Imagen no disponible en este momento.</p>
                )}
              </div>
            )}

            {resto.length > 0 && (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="l">Fecha</th>
                      <th className="l">Título</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resto.map((f) => (
                      <tr key={f.id}>
                        <td className="num">{ddmmaaaa(f.fecha)}</td>
                        <td className="l">{f.titulo ?? "Mesa de operaciones"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {semanales.length > 0 && (
            <Panel id="informe-semanal">
              <PanelHead title="Informe semanal" sub="research de la semana · mesa ROFO AGRO" />
              <QueEsEsto
                paraQue={
                  <>
                    El resumen de research de la semana en PDF: la semana en números (granos,
                    dólar, Chicago, comercio exterior) más una interpretación larga, con la
                    misma marca de la web.
                  </>
                }
                comoSeCalcula={
                  <>
                    Se genera solo, los viernes post-cierre, con los mismos datos que ya ves en{" "}
                    <code>/granos</code>, <code>/dolar</code> y <code>/comercio</code>.
                  </>
                }
              />
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="l">Semana</th>
                      <th className="l">Título</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {semanales.map((f) => (
                      <tr key={f.id}>
                        <td className="num">{ddmmaaaa(f.fecha)}</td>
                        <td className="l">{f.titulo ?? "Informe semanal"}</td>
                        <td className="l">
                          {f.url ? (
                            <a href={f.url} target="_blank" rel="noopener noreferrer">
                              Descargar PDF
                            </a>
                          ) : (
                            <span className="dim">No disponible</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {lecturas.length > 0 && (
            <Panel id="lectura-mesa">
              <PanelHead title="La lectura de la mesa" sub="interpretación de los informes de organismos" />
              <QueEsEsto
                paraQue="Cuando USDA, CONAB, BCR-GEA o SAGyP-DEA publican un informe nuevo, acá va la lectura de la mesa en criollo: qué cambió y qué implica."
                comoSeCalcula="Se genera un borrador solo, con los números exactos del informe; Lautaro lo revisa y recién ahí lo publica."
              />
              <div className="estim-cambios" style={{ padding: "0 4px 10px" }}>
                {lecturas.map((l) => (
                  <div className="estim-cam-card" key={`${l.organismo}-${l.informe}-${l.fecha_publicacion}`}>
                    <div className="estim-cam-hd">
                      <span className={`cal-org org-${l.organismo}`}>
                        {ORG_LABEL[l.organismo as keyof typeof ORG_LABEL] ?? l.organismo}
                      </span>
                      <span className="estim-cam-inf">{l.informe}</span>
                      <span className="estim-cam-fecha">{ddmmaaaa(l.fecha_publicacion)}</span>
                    </div>
                    <MdLite md={l.publicado_md} className="estim-lectura-body" />
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </main>
    </>
  );
}
