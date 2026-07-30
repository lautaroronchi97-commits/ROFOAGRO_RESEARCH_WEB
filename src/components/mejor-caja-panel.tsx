import { getArbitrajes } from "@/lib/arbitrajes-cierres";
import { pfmt, sfmt } from "@/lib/format";
import { Panel, PanelHead } from "./panel";
import { GlyphSoja, GlyphMaiz, GlyphTrigo } from "./icons";
import { InfoTip } from "./infotip";
import { SourceStamp } from "./source-stamp";
import { QueEsEsto } from "./que-es-esto";

function glyphFor(u: string) {
  if (u === "SOJ") return <GlyphSoja />;
  if (u === "MAI") return <GlyphMaiz />;
  return <GlyphTrigo />;
}
function glyphColor(u: string) {
  if (u === "SOJ") return "var(--brand-agro)";
  if (u === "MAI") return "var(--gold-text)";
  return "var(--brand-deep)";
}

function IconCaja() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 5.5 8 2.5l5.5 3v5L8 13.5 2.5 10.5z" />
      <path d="M2.5 5.5 8 8.5l5.5-3M8 8.5v5" />
    </svg>
  );
}

type Fila = {
  underlying: string;
  nombre: string;
  pos: string;
  tna: number | null;
  dias: number | null;
  spread: number | null;
};

/** Plazo comparable por grano (relevamiento 29/07, punto 27): mismo mes de entrega
 *  para los 3, así se comparan tasas de plazos parecidos, no cualquier posición. */
const MES_COMPARABLE: Record<string, string> = { SOJ: "NOV", MAI: "DIC", TRI: "DIC" };

export async function MejorCajaPanel() {
  const data = await getArbitrajes();

  // Por grano, la posición del mes comparable — si hay más de una campaña viva
  // (ej. NOV26 y NOV27), la más cercana (menor días al vto). Cierres + último
  // ajuste solamente (sin la diaria del mercado, ya viene así de getArbitrajes).
  const filas: Fila[] = [];
  for (const g of data.granos) {
    const mes = MES_COMPARABLE[g.underlying];
    if (!mes) continue;
    const candidatas = g.rows.filter((r) => r.pos.startsWith(mes));
    const elegida = candidatas.sort((a, b) => (a.dias ?? Infinity) - (b.dias ?? Infinity))[0];
    if (elegida) {
      filas.push({
        underlying: g.underlying,
        nombre: g.nombre,
        pos: elegida.pos,
        tna: elegida.tna,
        dias: elegida.dias,
        spread: elegida.spread,
      });
    }
  }

  const conTna = filas.filter((f) => f.tna != null);
  const menorTna = conTna.length > 0 ? Math.min(...conTna.map((f) => f.tna as number)) : null;

  return (
    <Panel id="mejor-caja">
      <PanelHead
        glyph={<IconCaja />}
        title="Mejor para hacer caja"
        sub="Soja NOV · Maíz DIC · Trigo DIC — plazos comparables"
        stamp={<SourceStamp meta={data.meta} />}
      />
      <div className="table-scroll">
        <table className="tbl" style={{ minWidth: 480 }}>
          <thead>
            <tr>
              <th className="l" scope="col">Grano</th>
              <th scope="col">Posición</th>
              <th scope="col">
                <InfoTip term="Spread US$">
                  Diferencia entre el futuro (ajuste) y la pizarra del disponible.
                </InfoTip>
              </th>
              <th scope="col">
                <InfoTip term="Tasa implícita">
                  La TNA en USD entre el disponible y esta posición. Cuanto más baja, menos rinde
                  esperar → conviene vender el disponible para hacer caja.
                </InfoTip>
              </th>
              <th scope="col">Días</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.underlying} className={f.tna != null && f.tna === menorTna ? "mc-win" : undefined}>
                <td className="l">
                  <span className="grp-cell">
                    <span className="gglyph" style={{ color: glyphColor(f.underlying) }}>
                      {glyphFor(f.underlying)}
                    </span>
                    <span className="gname">{f.nombre}</span>
                    {f.tna != null && f.tna === menorTna && <span className="mc-badge">mejor para caja</span>}
                  </span>
                </td>
                <td className="sym">{f.pos}</td>
                <td className={f.spread == null ? "neu2" : f.spread > 0 ? "pos" : f.spread < 0 ? "neg" : "neu2"}>
                  {sfmt(f.spread, 2)}
                </td>
                <td className={f.tna == null ? "neu2" : f.tna > 0 ? "pos" : f.tna < 0 ? "neg" : "neu2"}>
                  {f.tna != null ? pfmt(f.tna, 1) : "—"}
                </td>
                <td className="dim">{f.dias != null ? f.dias : "—"}</td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td className="l dim" colSpan={5}>
                  Sin datos para el ranking todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <QueEsEsto
        paraQue="Te dice cuál de los 3 granos te conviene más vender hoy si lo que necesitás es hacer caja: compara la misma familia de plazos (soja noviembre, maíz y trigo diciembre) para que sea una comparación justa."
        comoSeCalcula="Para cada grano toma la posición del mes comparable (la más cercana, si hay más de una campaña viva) y calcula la tasa anual en dólares entre el disponible y esa posición. El de menor tasa es el que menos rendimiento resigna al vender hoy — queda destacado."
      />
    </Panel>
  );
}
