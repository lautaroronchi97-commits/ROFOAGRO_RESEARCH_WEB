import { getDolarFuturo } from "@/lib/market";
import { nfmt, pfmt, rfmt, dirOf, arrowOf } from "@/lib/format";
import { Panel, PanelHead } from "./panel";
import { DolarFuturoChart } from "./dolar-futuro-chart";
import { SourceStamp } from "./source-stamp";
import { QueEsEsto } from "./que-es-esto";

function IconCurve() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12l3.5-4L8 9.5 14 3" />
      <circle cx="14" cy="3" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

const cls = (v: number | null) => (v == null ? "neu2" : v > 0 ? "pos" : v < 0 ? "neg" : "neu2");

export async function DolarFuturoPanel() {
  const data = await getDolarFuturo();
  const points = [
    ...(data.spot ? [{ label: "SPOT", value: data.spot }] : []),
    ...data.posiciones.map((p) => ({ label: p.label, value: p.ultimo })),
  ];

  return (
    <Panel id="dolar-futuro">
      <PanelHead
        glyph={<IconCurve />}
        title="Dólar futuro"
        sub="Curva + tasas implícitas (A3 · spot mayorista)"
        stamp={<SourceStamp meta={data.meta} revalidateSeg={60} />}
      />
      <div className="df-stack">
        <div className="df-table">
          <div className="table-scroll">
            <table className="tbl" style={{ minWidth: 460 }}>
              <thead>
                <tr>
                  <th className="l" scope="col">Pos.</th>
                  <th scope="col">Último</th>
                  <th scope="col">Var</th>
                  <th scope="col">Días</th>
                  <th scope="col">TNA</th>
                  <th scope="col">TEM</th>
                  <th scope="col">TEA</th>
                  <th scope="col">Vol.</th>
                </tr>
              </thead>
              <tbody>
                {data.posiciones.map((p) => {
                  const d = dirOf(p.varPct);
                  return (
                    <tr key={p.ticker}>
                      <td className="l sym">{p.label}</td>
                      <td>{nfmt(p.ultimo, 2)}</td>
                      <td className={cls(p.varPct)}>
                        {arrowOf(d)} {pfmt(p.varPct, 2)}
                      </td>
                      <td className="dim">{p.dias ?? "—"}</td>
                      <td className={cls(p.tnaPct)}>{rfmt(p.tnaPct, 1)}</td>
                      <td className="dim">{rfmt(p.temPct, 2)}</td>
                      <td className={cls(p.teaPct)}>{rfmt(p.teaPct, 1)}</td>
                      <td className="dim">{nfmt(p.volumen, 0)}</td>
                    </tr>
                  );
                })}
                {data.posiciones.length === 0 && (
                  <tr>
                    <td className="l dim" colSpan={8}>
                      Sin datos de MAE en este momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="df-chart">
          {points.length > 1 && <DolarFuturoChart points={points} />}
          <div className="cv-legend">
            <span className="lk">
              <span className="sw" aria-hidden="true" />
              Último por posición
            </span>
            {data.spot && (
              <span className="lk">
                <span className="sw g" aria-hidden="true" />
                Spot may. {nfmt(data.spot, 2)}
              </span>
            )}
          </div>
        </div>
      </div>

      <QueEsEsto
        paraQue="Muestra los contratos de dólar futuro y qué tasa en pesos implica cada uno: cuánto rinde comprar dólar a futuro frente al mayorista de hoy."
        comoSeCalcula="Compara cada precio futuro contra el dólar mayorista de hoy; de esa relación salen la tasa nominal anual, la efectiva anual y la mensual, según los días hasta el vencimiento."
      />
    </Panel>
  );
}
