import { getDjveResumen, ORDEN_FAMILIAS, type DjveRow, type Familia } from "@/lib/djve";
import { nfmt, fechaHoraCordoba } from "@/lib/format";
import { Panel, PanelHead } from "./panel";
import { SourceStamp } from "./source-stamp";
import { QueEsEsto } from "./que-es-esto";

function IconExport() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 10V2.5" />
      <path d="M5.4 5 8 2.4 10.6 5" />
      <path d="M3 9.5v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}

/** Familias con al menos un producto, ordenadas por volumen agregado (desc) — no por el
 *  orden fijo de `ORDEN_FAMILIAS` (relevamiento web R8, punto 52: "orden siempre por volumen"). */
function agruparPorFamilia(productos: DjveRow[]): { familia: Familia; total: number; filas: DjveRow[] }[] {
  const grupos = ORDEN_FAMILIAS.map((familia) => {
    const filas = productos.filter((p) => p.familia === familia);
    const total = filas.reduce((s, p) => s + (p.tonAnio ?? 0), 0);
    return { familia, total, filas };
  }).filter((g) => g.filas.length > 0);
  return grupos.sort((a, b) => b.total - a.total);
}

export async function DjvePanel() {
  const data = await getDjveResumen();
  // E3 H7: ocultar los productos sin actividad en el año (todo "—") — eran ~70 filas de ruido.
  // La nota "N ocultos" se sacó (punto 52): ya no aporta, solo generaba una pregunta sin acción.
  const productos = data.productos.filter((p) => (Number(p.tonAnio) || 0) > 0);
  const grupos = agruparPorFamilia(productos);

  return (
    <Panel id="djve">
      <PanelHead
        glyph={<IconExport />}
        title="DJVE — Ventas al exterior"
        sub={`Toneladas declaradas${data.anio ? ` · acumulado ${data.anio}` : ""}`}
        stamp={<SourceStamp meta={data.meta} />}
      />
      <div className="djve-head">
        {data.meta.updatedAt !== null && (
          <p className="djve-updated">
            Última actualización: {fechaHoraCordoba(new Date(data.meta.updatedAt))} hs
          </p>
        )}
        {productos.length > 0 && (
          <p className="djve-total">
            Total {data.anio ?? ""} <b>{nfmt(data.totalAnio, 0)} t</b>
          </p>
        )}
      </div>
      {grupos.map((g) => (
        <div className="djve-familia" key={g.familia}>
          <h3 className="djve-familia-h">
            {g.familia} <span className="djve-familia-tot">{nfmt(g.total, 0)} t</span>
          </h3>
          <div className="table-scroll">
            <table className="tbl" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th className="l" scope="col">Producto</th>
                  <th scope="col">Acum. año (t)</th>
                  <th scope="col">Últ. 30 días</th>
                  <th scope="col">Últ. 7 días</th>
                  <th scope="col">DJVE 7d</th>
                </tr>
              </thead>
              <tbody>
                {g.filas.map((p) => (
                  <tr key={p.producto}>
                    <td className="l sym">{p.producto}</td>
                    <td>{nfmt(p.tonAnio, 0)}</td>
                    <td className="dim">{nfmt(p.ton30d, 0)}</td>
                    <td className={p.ton7d ? "pos" : "dim"}>{nfmt(p.ton7d, 0)}</td>
                    <td className="dim">{p.n7d || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {productos.length === 0 && <p className="dim">Sin datos de DJVE disponibles.</p>}
      <QueEsEsto
        paraQue="Muestra las declaraciones de venta al exterior (DJVE) de granos y subproductos: cuánto se anotó para exportar, un termómetro de la demanda externa."
        comoSeCalcula="Suma las toneladas registradas en el año en curso, con ventanas de los últimos 7 y 30 días por fecha de registro, agrupadas por familia de producto."
      />
    </Panel>
  );
}
