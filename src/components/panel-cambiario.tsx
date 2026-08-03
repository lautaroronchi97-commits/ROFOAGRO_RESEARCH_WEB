import * as React from "react";
import Link from "next/link";
import { getVolumenCambiario } from "@/lib/market";
import { getComprasBcra } from "@/lib/bcra-mulc";
import { nfmt, pfmt, dirOf, arrowOf } from "@/lib/format";
import { Panel, PanelHead } from "./panel";
import { SourceStamp } from "./source-stamp";
import { QueEsEsto } from "./que-es-esto";
import { BcraMulcChart } from "./bcra-mulc-chart";

function IconFx() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 6h9l-2-2" />
      <path d="M13.5 10h-9l2 2" />
    </svg>
  );
}

const GRUPOS = ["Monedas"];
const barColor = () => "var(--gold)";

function ddmm(iso: string | null): string {
  if (!iso) return "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function fmtNominal(v: number | null): string {
  if (v == null) return "—";
  return nfmt(v / 1e6, 0);
}

function fmtMusd(v: number | null): string {
  if (v == null) return "—";
  const s = v >= 0 ? "+" : "";
  return `${s}${nfmt(v, 1)}`;
}

export async function PanelCambiario() {
  const [data, bcra] = await Promise.all([getVolumenCambiario(), getComprasBcra()]);
  const d = data.oficialVarPct == null ? null : dirOf(data.oficialVarPct);
  const byGrupo = GRUPOS.map((g) => ({
    grupo: g,
    items: data.cats.filter((c) => c.grupo === g),
  })).filter((x) => x.items.length > 0);

  return (
    <Panel id="cambiario">
      <PanelHead
        glyph={<IconFx />}
        title="Panel cambiario"
        sub="Volumen de rueda por segmento (MAE · USD)"
        stamp={<SourceStamp meta={data.meta} revalidateSeg={60} />}
      />
      <div className="cbo-head">
        <span className="cbo-kpi">
          <span className="k">Oficial mayorista MAE</span>
          <span className="v mono">{nfmt(data.oficial, 2)}</span>
          {d && (
            <span className={`rd ${d}`}>
              {arrowOf(d)} {pfmt(data.oficialVarPct, 2)}
            </span>
          )}
        </span>
        <span className="cbo-kpi">
          <span className="k">Volumen dólar linked</span>
          <span className="v mono">{fmtNominal(data.volumenLinkedNominal)} M (nominal)</span>
        </span>
      </div>
      <div className="table-scroll">
        <table className="tbl" style={{ minWidth: 460 }}>
          <thead>
            <tr>
              <th className="l" scope="col">Segmento</th>
              <th scope="col">Vol. (M USD)</th>
              <th className="l" scope="col" style={{ width: "44%" }}>Participación</th>
            </tr>
          </thead>
          <tbody>
            {byGrupo.map((g) => (
              <React.Fragment key={g.grupo}>
                <tr className="grp">
                  <td className="l" colSpan={3}>
                    <span className="grp-cell">
                      <span className="gname">{g.grupo}</span>
                    </span>
                  </td>
                </tr>
                {g.items.map((c) => (
                  <tr key={c.nombre}>
                    <td className="l sym">{c.nombre}</td>
                    <td>{nfmt(c.volumenUsd / 1e6, 0)}</td>
                    <td className="l">
                      <span className="volcell">
                        <span className="vbar" aria-hidden="true">
                          <i style={{ width: `${Math.min(100, c.share)}%`, background: barColor() }} />
                        </span>
                        <span className="vpct">{nfmt(c.share, 1)}%</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
            {data.cats.length === 0 && (
              <tr>
                <td className="l dim" colSpan={3}>
                  Sin datos de MAE en este momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="lu-h3">Compras netas BCRA (MULC)</h3>
      {bcra.ultimo === null ? (
        <p className="dim" style={{ padding: "8px 2px" }}>
          Sin datos todavía. {bcra.meta.problemas[0] ?? ""}
        </p>
      ) : (
        <>
          <div className="lu-kpis">
            <div className="lu-kpi">
              <span className="lu-kpi-v">{fmtMusd(bcra.ultimo.montoMusd)}</span>
              <span className="lu-kpi-l">
                M USD el {ddmm(bcra.ultimo.fecha)}{bcra.ultimo.fuente === "manual" ? " (manual)" : ""}
              </span>
            </div>
            <div className="lu-kpi">
              <span className="lu-kpi-v">{fmtMusd(bcra.acumuladoMes)}</span>
              <span className="lu-kpi-l">acumulado del mes ({bcra.filasMes} {bcra.filasMes === 1 ? "día" : "días"})</span>
            </div>
            <div className="lu-kpi">
              <span className="lu-kpi-v">{fmtMusd(bcra.acumuladoAnio)}</span>
              <span className="lu-kpi-l">acumulado del año ({bcra.filasAnio} {bcra.filasAnio === 1 ? "día" : "días"})</span>
            </div>
          </div>
          <BcraMulcChart serie={bcra.serie} />
        </>
      )}

      <QueEsEsto
        paraQue={
          <>
            Muestra el volumen operado en el mercado de cambios (cuánto se movió en el contado y en
            el dólar futuro) y las <strong>compras netas de divisas del Banco Central</strong> en el
            MULC (mercado de cambios): cuánto compró (o vendió) el BCRA al sector privado cada día.
          </>
        }
        comoSeCalcula={
          <>
            El volumen de Monedas sale del contado de cambios de MAE; el volumen de dólar linked es
            el nominal operado, sumando todas las letras/bonos linked al dólar oficial que están
            cotizando. Las compras netas BCRA salen del <strong>Banco Central</strong> — el dato
            oficial llega con ~3-4 días hábiles de rezago, así que el día más reciente suele
            completarse con una <strong>carga manual</strong> desde{" "}
            <Link href="/admin/datos">/admin/datos</Link> hasta que llega la cifra oficial (se pisa
            sola). El acumulado es por mes/año calendario.
          </>
        }
      />
    </Panel>
  );
}
