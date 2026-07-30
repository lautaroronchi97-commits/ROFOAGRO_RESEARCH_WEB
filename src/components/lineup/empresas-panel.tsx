import { getEmpresas } from "@/lib/lineup/empresas";
import { nfmt, sfmt } from "@/lib/format";
import { ratioFmt } from "@/lib/lineup/cobertura";
import { Panel, PanelHead } from "../panel";
import { SourceStamp } from "../source-stamp";
import { QueEsEsto } from "../que-es-esto";
import { EmpresasTabla } from "./empresas-tabla";

function IconEmpresa() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 14V3.5L8 1.5 13.5 3.5V14" />
      <path d="M1 14h14M5 6h2M9 6h2M5 9h2M9 9h2M5 12h2M9 12h2" />
    </svg>
  );
}

function ddmm(iso: string | null): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—";
}

function SenalBadge({ tag }: { tag: "ALCISTA FAS" | "BAJISTA" | "NEUTRO" }) {
  const cls = tag === "ALCISTA FAS" ? "sn-alcista" : tag === "BAJISTA" ? "sn-bajista" : "sn-neutro";
  const txt = tag === "ALCISTA FAS" ? "Alcista" : tag === "BAJISTA" ? "Bajista" : "Neutro";
  return <span className={`sn-badge ${cls}`}>{txt}</span>;
}

export async function EmpresasPanel() {
  const data = await getEmpresas();

  if (data.fecha === null) {
    return (
      <Panel id="comercio-empresas">
        <PanelHead glyph={<IconEmpresa />} title="Empresas exportadoras" sub="Cobertura DJVE vs line-up" stamp={<SourceStamp meta={data.meta} />} />
        <p className="dim" style={{ padding: "8px 2px" }}>Sin datos de comercio exterior disponibles.</p>
      </Panel>
    );
  }

  const { fecha, productos, empresas, transitoTotal } = data;
  const totDecl = productos.reduce((s, p) => s + p.declarado60d, 0);
  const totOrig = productos.reduce((s, p) => s + p.originado60d, 0);
  const nCortas = empresas.filter((e) => e.senal.tag === "ALCISTA FAS").length;

  return (
    <Panel id="comercio-empresas">
      <PanelHead
        glyph={<IconEmpresa />}
        title="Empresas exportadoras"
        sub={`Cumplimiento al ${ddmm(fecha)} · DJVE vs line-up`}
        stamp={<SourceStamp meta={data.meta} />}
      />

      <div className="lu-kpis">
        <div className="lu-kpi">
          <span className="lu-kpi-v">{nfmt(empresas.length, 0)}</span>
          <span className="lu-kpi-l">empresas activas</span>
        </div>
        <div className="lu-kpi">
          <span className="lu-kpi-v">{nfmt(nCortas, 0)}</span>
          <span className="lu-kpi-l">cortas (presión compradora)</span>
        </div>
        <div className="lu-kpi">
          <span className="lu-kpi-v">{ratioFmt(totOrig / (totDecl || 1))}</span>
          <span className="lu-kpi-l">cumplimiento global 60d</span>
        </div>
      </div>

      <h3 className="lu-h3">Gap de cumplimiento por producto · foto forward 60 días</h3>
      <p className="lu-nota">Lo declarado en DJVE para embarcar en los próximos 60 días vs lo que ya está en el line-up. Cumplimiento bajo = corto = presión compradora (alcista FAS).</p>
      <div className="table-scroll">
        <table className="tbl" style={{ minWidth: 620 }}>
          <thead>
            <tr>
              <th className="l" scope="col">Producto</th>
              <th scope="col">Declarado 60d</th>
              <th scope="col">Embarcado 60d</th>
              <th scope="col">Falta</th>
              <th scope="col">Cumplimiento</th>
              <th className="l" scope="col">Señal</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.cod}>
                <td className="l sym">{p.display}</td>
                <td>{nfmt(p.declarado60d, 0)}</td>
                <td>{nfmt(p.originado60d, 0)}</td>
                <td className={p.faltaCubrir > 0 ? "pos" : p.faltaCubrir < 0 ? "neg" : "dim"}>{sfmt(p.faltaCubrir, 0)}</td>
                <td className="lu-mono">{ratioFmt(p.ratio)}</td>
                <td className="l"><SenalBadge tag={p.senal.tag} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="lu-h3">Declarado de campaña · cosecha y plazo</h3>
      <p className="lu-nota">Cómo se reparte lo declarado de la campaña en curso: nueva vs vieja (por fecha de embarque) y disponible (opción 30) vs forward (opción 360). El forward marca presión declarada a futuro.</p>
      <div className="table-scroll">
        <table className="tbl" style={{ minWidth: 620 }}>
          <thead>
            <tr>
              <th className="l" scope="col">Producto</th>
              <th scope="col">Nueva</th>
              <th scope="col">Vieja</th>
              <th scope="col">Disponible</th>
              <th scope="col">Forward</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.cod}>
                <td className="l sym">{p.display}</td>
                <td title={p.campNueva}>{nfmt(p.declaradoNueva, 0)}</td>
                <td title={p.campVieja}>{nfmt(p.declaradoVieja, 0)}</td>
                <td>{nfmt(p.declaradoDisp, 0)}</td>
                <td>{nfmt(p.declaradoForward, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="lu-nota lu-mono">Nueva = campaña {productos[0]?.campNueva ?? "—"} · Vieja = {productos[0]?.campVieja ?? "—"} (varía por grano).</p>

      <h3 className="lu-h3">Empresas · cumplimiento, avance y ritmo</h3>
      <EmpresasTabla empresas={empresas} fecha={fecha} />
      {transitoTotal > 0 && (
        <p className="lu-nota">Tránsito Paraguay/Uruguay excluido del gap (no tiene DJVE argentina): <b>{nfmt(transitoTotal, 0)} t</b> en el último line-up.</p>
      )}

      <QueEsEsto
        paraQue="Muestra, por empresa exportadora, si está corta o cubierta: cuánto declaró vender al exterior (DJVE) contra cuántos barcos ya puso a cargar (line-up). Una empresa corta tiene que salir a comprar grano → presión sobre el FAS. Suma el avance de la campaña, el ritmo vs su propia historia y la mercadería de cosecha nueva vs vieja."
        comoSeCalcula="Cruza las DJVE de SAGyP (declarado) con el line-up de buques (originado), normalizando los nombres de los exportadores. La foto forward compara la ventana de los próximos 60 días; el avance de campaña acumula lo embarcado desde el arranque (estimado sobre line-up). El ritmo compara el line-up parado hoy contra el promedio de las mismas semanas de las últimas 5 campañas. El tránsito de origen Paraguay/Uruguay se excluye del ratio porque no tiene DJVE argentina."
      />
    </Panel>
  );
}
