import { getSinteticos } from "@/lib/market";
import { nfmt, pfmt } from "@/lib/format";
import { Panel, PanelHead } from "./panel";
import { SourceStamp } from "./source-stamp";
import { InfoTip } from "./infotip";
import { QueEsEsto } from "./que-es-esto";

function IconSint() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h6M3 8h10M3 12h7" />
      <circle cx="12.5" cy="4" r="1.4" />
    </svg>
  );
}

const cls = (v: number | null) => (v == null ? "neu2" : v > 0 ? "pos" : v < 0 ? "neg" : "neu2");

export async function SinteticosPanel() {
  const { rows, meta } = await getSinteticos();

  return (
    <Panel id="sinteticos">
      <PanelHead
        glyph={<IconSint />}
        title="Sintéticos · LECAPs y BONCAPs"
        sub="Tasa de armar un dólar a término con la letra/bono"
        stamp={<SourceStamp meta={meta} />}
      />

      <div className="table-scroll">
        <table className="tbl" style={{ minWidth: 480 }}>
          <thead>
            <tr>
              <th className="l" scope="col">Letra/Bono</th>
              <th scope="col">
                <InfoTip term="DLR">Posición de dólar futuro con el mismo vencimiento que la letra/bono.</InfoTip>
              </th>
              <th scope="col">Precio</th>
              <th scope="col">
                <InfoTip term="Pago final">Importe que paga la letra/bono al vencimiento (VN 100). Se fija en la emisión.</InfoTip>
              </th>
              <th scope="col">
                <InfoTip term="Sintético">
                  Dólar a término armado con la letra/bono: spot × (pago final / precio). Es el tipo de cambio
                  que te queda si lo comprás hoy y lo cobrás al vencimiento.
                </InfoTip>
              </th>
              <th scope="col">
                <InfoTip term="TNA">TNA en USD del sintético, anualizada por los días al vencimiento del futuro (act/365).</InfoTip>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.letra}>
                <td className="l sym">{r.letra}</td>
                <td className="sym dim">{r.posicion ?? "—"}</td>
                <td>{nfmt(r.letraPx, 2)}</td>
                <td>{r.pagoFinal != null ? nfmt(r.pagoFinal, 3) : "—"}</td>
                <td>{r.sinteticoAFinish != null ? nfmt(r.sinteticoAFinish, 2) : "—"}</td>
                <td className={cls(r.tnaPct)}>{r.tnaPct != null ? pfmt(r.tnaPct, 1) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="l dim" colSpan={6}>
                  Sin sintéticos para mostrar — falta el precio de las letras/bonos o el dólar futuro, o el
                  pago final no está cargado (se carga en <code>/admin/datos</code>).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <QueEsEsto
        paraQue="Cuánto rinde en dólares armar un dólar a término con una LECAP o un BONCAP: comprarla hoy y cobrar su pago final al vencimiento, comparado contra el dólar spot de hoy."
        comoSeCalcula="Sintético = dólar spot × (pago final de la letra/bono / precio de hoy). Tasa directa = sintético / dólar futuro de la posición emparejada − 1. TNA = directa × 365 / días al vencimiento del FUTURO (no de la letra). El pago final (importe al vencimiento) se carga a mano; el precio de la letra/bono y el dólar futuro se actualizan solos. De cada mes se muestra la letra/bono con vencimiento más cercano a fin de mes (la más comparable con el dólar futuro, que siempre vence fin de mes)."
      />
    </Panel>
  );
}
