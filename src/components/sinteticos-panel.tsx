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

  // "Ranking": el mejor sintético = mayor TNA (destacado arriba, además de la curva ordenada por vto).
  const conTna = rows.filter((r) => r.tnaPct !== null);
  const mejor = conTna.reduce<typeof conTna[number] | null>(
    (best, r) => (best === null || (r.tnaPct as number) > (best.tnaPct as number) ? r : best),
    null,
  );

  return (
    <Panel id="sinteticos">
      <PanelHead
        glyph={<IconSint />}
        title="Sintéticos · LECAPs y BONCAPs"
        sub="LECAP/BONCAP + dólar futuro vs futuro directo"
        stamp={<SourceStamp meta={meta} />}
      />

      {mejor && (
        <p className="dim" style={{ margin: "0 0 8px", fontSize: ".85rem" }}>
          Mejor sintético: <b className="sym">{mejor.letra}</b> (↔ {mejor.posicion}) —{" "}
          <span className={cls(mejor.tnaPct)}>TNA {pfmt(mejor.tnaPct, 1)}</span>
          {mejor.ventajaPct !== null && (
            <> · {mejor.ventajaPct >= 0 ? "gana" : "pierde"} <span className={cls(mejor.ventajaPct)}>{pfmt(Math.abs(mejor.ventajaPct), 1).replace("+", "")}</span> vs futuro directo</>
          )}
        </p>
      )}

      <div className="table-scroll">
        <table className="tbl" style={{ minWidth: 620 }}>
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
                <InfoTip term="TNA sint.">TNA en USD del sintético vs el dólar futuro de esa posición (act/365).</InfoTip>
              </th>
              <th scope="col">
                <InfoTip term="TNA fut.">TNA en USD del dólar futuro directo (Fut/Spot − 1, anualizada).</InfoTip>
              </th>
              <th scope="col">
                <InfoTip term="Ventaja">
                  Diferencia de TNA sintético − futuro directo. Positiva = conviene el sintético.
                </InfoTip>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.letra}
                style={mejor && r.letra === mejor.letra ? { background: "color-mix(in oklab, var(--gold-text, #efbf2e) 12%, transparent)" } : undefined}
              >
                <td className="l sym">{r.letra}</td>
                <td className="sym dim">{r.posicion ?? "—"}</td>
                <td>{nfmt(r.letraPx, 2)}</td>
                <td>{r.pagoFinal != null ? nfmt(r.pagoFinal, 3) : "—"}</td>
                <td>{r.sinteticoAFinish != null ? nfmt(r.sinteticoAFinish, 2) : "—"}</td>
                <td className={cls(r.tnaPct)}>{r.tnaPct != null ? pfmt(r.tnaPct, 1) : "—"}</td>
                <td className={cls(r.futTnaPct)}>{r.futTnaPct != null ? pfmt(r.futTnaPct, 1) : "—"}</td>
                <td className={cls(r.ventajaPct)}>{r.ventajaPct != null ? pfmt(r.ventajaPct, 1) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="l dim" colSpan={8}>
                  Sin sintéticos para mostrar — falta el precio de las letras/bonos o el dólar futuro, o el
                  pago final no está cargado (se carga en <code>/admin/datos</code>).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <QueEsEsto
        paraQue="Compara armar un dólar a término con una LECAP o un BONCAP (comprarlo hoy y cobrarlo al vencimiento) contra vender el dólar futuro de la misma posición. Sirve para ver cuál de los dos rinde más en dólares."
        comoSeCalcula="Sintético = dólar spot × (pago final de la letra/bono / precio de hoy). Tasa directa = sintético / dólar futuro − 1. TNA = directa × 365 / días al vencimiento. El pago final (importe al vencimiento) se carga a mano; el precio de la letra/bono y el dólar futuro se actualizan solos."
      />
    </Panel>
  );
}
