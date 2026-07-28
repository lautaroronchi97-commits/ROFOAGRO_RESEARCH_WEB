import { getCamionesPlantas } from "@/lib/camiones/plantas";
import { nfmt } from "@/lib/format";
import { Panel, PanelHead } from "../panel";
import { SourceStamp } from "../source-stamp";
import { QueEsEsto } from "../que-es-esto";
import { CamionesChart } from "./camiones-chart";

/**
 * Panel del pulso diario de camiones de **Agroentregas** (C24 del backlog maestro), tabla
 * `camiones_plantas`. Convive con `CamionesPanel` (Williams Entregas) sin mezclarse: son universos
 * distintos —acá Up River + Paraná bonaerense, sin Bahía Blanca ni Necochea— y se dice explícito en
 * el subtítulo y en el "¿Qué es esto?".
 *
 * El bloque por EMPRESA es solo-mesa (`mostrarEmpresas`): el dato crudo es público en la web de
 * origen, pero la lectura "quién está levantando mercadería hoy" es research de mesa — mismo
 * criterio que la señal barcos-vs-camiones en esta misma página.
 */

function IconPulso() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 8.5h3l2-4 2.5 7 2-3h3.5" />
    </svg>
  );
}

function ddmm(iso: string | null): string {
  if (!iso) return "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function fmtDelta(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${nfmt(v, 0)}`;
}

function clsDelta(v: number | null | undefined): string {
  if (v == null || v === 0) return "";
  return v > 0 ? "pos" : "neg";
}

export async function CamionesPlantasPanel({ mostrarEmpresas = false }: { mostrarEmpresas?: boolean }) {
  const data = await getCamionesPlantas();

  if (data.fecha === null) {
    return (
      <Panel id="comercio-camiones-plantas">
        <PanelHead
          glyph={<IconPulso />}
          title="Pulso diario Up River"
          sub="Por planta y empresa — Agroentregas"
          stamp={<SourceStamp meta={data.meta} />}
        />
        <p className="dim" style={{ padding: "8px 2px" }}>
          Sin datos todavía. {data.meta.problemas[0] ?? ""}
        </p>
      </Panel>
    );
  }

  return (
    <Panel id="comercio-camiones-plantas">
      <PanelHead
        glyph={<IconPulso />}
        title="Pulso diario Up River"
        sub={`Día al ${ddmm(data.fecha)} · por planta y empresa`}
        stamp={<SourceStamp meta={data.meta} />}
      />

      <div className="lu-kpis">
        <div className="lu-kpi">
          <span className="lu-kpi-v">{data.totalDia == null ? "—" : nfmt(data.totalDia, 0)}</span>
          <span className="lu-kpi-l">
            camiones el {ddmm(data.fecha)}
            {data.plantasReportadas ? ` (${data.plantasReportadas} plantas)` : ""}
          </span>
        </div>
        <div className="lu-kpi">
          <span className={`lu-kpi-v ${clsDelta(data.deltaDiaAnterior)}`}>{fmtDelta(data.deltaDiaAnterior)}</span>
          <span className="lu-kpi-l">vs día anterior con dato</span>
        </div>
        <div className="lu-kpi">
          <span className={`lu-kpi-v ${clsDelta(data.deltaInteranual?.valor)}`}>
            {data.deltaInteranual ? `${data.deltaInteranual.pct >= 0 ? "+" : ""}${nfmt(data.deltaInteranual.pct, 1)}%` : "—"}
          </span>
          <span className="lu-kpi-l">
            {data.deltaInteranual ? `vs mismo día de ${data.deltaInteranual.fecha.slice(0, 4)} (${ddmm(data.deltaInteranual.fecha)})` : "vs año pasado"}
          </span>
        </div>
        <div className="lu-kpi">
          <span className="lu-kpi-v">{data.granoLider ? data.granoLider.display : "—"}</span>
          <span className="lu-kpi-l">
            grano líder{data.granoLider ? ` (${nfmt(data.granoLider.cantidad, 0)})` : ""}
          </span>
        </div>
      </div>

      {data.porGrano.length > 0 && (
        <>
          <h3 className="lu-h3">Por grano (Up River + Paraná Bs As)</h3>
          <CamionesChart series={data.porGrano} colorClassPrefix="cam-" tituloAria="Camiones diarios por grano — Agroentregas" />
        </>
      )}

      {mostrarEmpresas && data.porEmpresa.length > 0 && (
        <>
          <h3 className="lu-h3">Quién recibió camiones el {ddmm(data.fecha)} (mesa)</h3>
          <div className="table-scroll">
            <table className="tbl" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th className="l" scope="col">Empresa</th>
                  <th scope="col">Camiones</th>
                  <th scope="col">Share</th>
                  <th className="l" scope="col">Grano líder</th>
                  <th className="l" scope="col">Plantas</th>
                </tr>
              </thead>
              <tbody>
                {data.porEmpresa.map((e) => (
                  <tr key={e.empresa}>
                    <td className="l">{e.empresa}</td>
                    <td>{nfmt(e.cantidad, 0)}</td>
                    <td>{nfmt(e.share, 1)}%</td>
                    <td className="l">
                      {e.granoLider ? `${e.granoLider.display} (${nfmt(e.granoLider.cantidad, 0)})` : "—"}
                    </td>
                    <td className="l dim">
                      {e.plantas.map((p) => `${p.planta} (${nfmt(p.cantidad, 0)})`).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <QueEsEsto
        paraQue={
          <>
            Es el <strong>pulso diario</strong> de la descarga de camiones en las plantas y terminales de{" "}
            <strong>Up River y el Paraná bonaerense</strong> — el corazón del embarque argentino. A diferencia
            del panel de arriba (Williams Entregas, que cubre todo el país pero se actualiza cuando Lautaro
            sube el export), este llega <strong>solo, todos los días</strong>. Sirve para ver hoy mismo si la
            mercadería está entrando o si el productor frenó, y —en la vista de mesa— <strong>qué exportador
            está levantando</strong>: la apertura por empresa no la da ninguna otra fuente que tengamos.
          </>
        }
        comoSeCalcula={
          <>
            La fuente es <strong>Agroentregas</strong>, que publica a diario la entrada de camiones por planta,
            empresa y grano; se ingiere automáticamente dos veces por día.{" "}
            <strong>
              ⚠️ Este total NO es el nacional: no incluye Bahía Blanca ni Necochea
            </strong>{" "}
            y solo aparecen las plantas que Agroentregas atiende — por eso no se compara ni se suma con el panel
            de Williams, que sí es nacional. Los valores son <strong>cantidad de camiones</strong> (vehículos),
            no toneladas. El comparativo interanual es contra el <strong>mismo día de la semana</strong> del año
            pasado (no la misma fecha): en un flujo logístico pesa más si es martes o domingo que el número del
            día. Detalle de la fuente en <code>docs/negocio/10_fuente_camiones_agroentregas.md</code>.
          </>
        }
      />
    </Panel>
  );
}
