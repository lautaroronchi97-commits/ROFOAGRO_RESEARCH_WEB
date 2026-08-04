import { requireAdmin } from "@/lib/auth/dal";
import { getInterpretacionesAdmin, getScorecardInterpretaciones } from "@/lib/interpretaciones";
import { InterpretacionEditor } from "./interpretacion-editor";

function ddmmaaaa(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function pct(x: number | null): string {
  return x === null ? "—" : `${Math.round(x * 100)}%`;
}

/**
 * Pestaña INTERPRETACIONES del panel admin (MP4 de docs/PLAN_INFORMES.md, ítem 21 — rutina y
 * skill propias desde E2 de PLAN_INFORMES_V3.md §8): los borradores que la skill
 * `interpretaciones` genera sola cuando detecta un informe de organismo nuevo (estimaciones,
 * PAS zonas/condición, CFTC COT, USDA Export Sales). Lautaro los edita y publica acá — o los deja
 * sin tocar y el cierre 18:20 ART los publica solo (N4), firmando "Mesa ROFO AGRO" en vez de su
 * firma personal (N19, columna Firma del historial).
 */
export default async function InterpretacionesPage() {
  await requireAdmin();
  const [filas, scorecard] = await Promise.all([getInterpretacionesAdmin(), getScorecardInterpretaciones()]);
  const borradores = filas.filter((f) => f.estado === "borrador");
  const historial = filas.filter((f) => f.estado !== "borrador");

  return (
    <section>
      <div className="admin-hd">
        <h1 className="admin-h1">Interpretaciones de informes</h1>
        <p className="admin-sub">
          Lectura en lenguaje llano de los informes de organismos (USDA, CONAB, BCR-GEA, DEA-SAGyP,
          BCBA-PAS, CFTC, Export Sales) que la skill <code>interpretaciones</code> genera sola cuando
          detecta una publicación nueva. Editá y publicá desde acá — la interpretación publicada
          aparece en <code>/produccion</code>, junto a los cambios del organismo correspondiente. Un
          borrador que no tocás se publica solo al cierre del día (18:20 ART), firmando
          &ldquo;Mesa ROFO AGRO&rdquo;.
        </p>
      </div>

      <div className="admin-card" style={{ marginBottom: 24 }}>
        <h3 className="admin-card-name">Scorecard — qué tan bien leemos los reportes</h3>
        <p className="admin-sub" style={{ marginTop: 4 }}>
          El impacto por grano de cada interpretación (alcista/neutral/bajista), medido contra el
          precio real a 7 y 14 días.
        </p>
        <div className="admin-card-acciones" style={{ marginTop: 8, gap: 24 }}>
          <span>
            <strong>7 días:</strong> {pct(scorecard.hitRate7)}{" "}
            <span className="dim">({scorecard.n7} medidos)</span>
          </span>
          <span>
            <strong>14 días:</strong> {pct(scorecard.hitRate14)}{" "}
            <span className="dim">({scorecard.n14} medidos)</span>
          </span>
        </div>
      </div>

      {borradores.length === 0 ? (
        <p className="admin-empty">
          No hay borradores esperando revisión. Aparecen solos el día que se publica un informe de
          organismo nuevo (post-cierre, con el resto del informe diario).
        </p>
      ) : (
        <div className="admin-cards">
          {borradores.map((it) => (
            <InterpretacionEditor key={it.id} item={it} />
          ))}
        </div>
      )}

      {historial.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 className="admin-h1" style={{ fontSize: "1.2rem" }}>Historial</h2>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="l">Fecha informe</th>
                  <th className="l">Organismo</th>
                  <th className="l">Informe</th>
                  <th className="l">Estado</th>
                  <th className="l">Firma</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((it) => (
                  <tr key={it.id}>
                    <td className="num">{ddmmaaaa(it.fecha_publicacion)}</td>
                    <td className="l">
                      <span className={`cal-org org-${it.organismo}`}>{it.organismo}</span>
                    </td>
                    <td className="l">{it.informe}</td>
                    <td className="l">{it.estado === "publicado" ? "✅ Publicada" : "descartada"}</td>
                    <td className="l">
                      {it.estado === "publicado" ? (
                        it.auto_publicado ? (
                          <span className="dim">Mesa ROFO AGRO (automática)</span>
                        ) : (
                          "Lautaro Ronchi"
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
