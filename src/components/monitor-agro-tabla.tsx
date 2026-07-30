"use client";

import * as React from "react";
import { nfmt, pfmt } from "@/lib/format";
import { GlyphSoja, GlyphMaiz, GlyphTrigo } from "./icons";
import { FiltroGrano, type GranoFiltroValue, type GranoKey } from "./filtro-grano";
import type { MonitorRow } from "@/lib/monitor-mercados";

function glyphFor(g: MonitorRow["glyph"]) {
  if (g === "soja") return <GlyphSoja />;
  if (g === "maiz") return <GlyphMaiz />;
  if (g === "trigo") return <GlyphTrigo />;
  return null;
}
function glyphColor(g: MonitorRow["glyph"]) {
  if (g === "soja") return "var(--brand-agro)";
  if (g === "maiz") return "var(--gold-text)";
  return "var(--brand-deep)";
}
function deltaClass(d: number | null) {
  return d == null ? "neu2" : d > 0 ? "pos" : d < 0 ? "neg" : "neu2";
}

const GRANO_DE_GLYPH: Record<string, GranoKey> = { soja: "SOJ", maiz: "MAI", trigo: "TRI" };

export function MonitorAgroTabla({ rows }: { rows: MonitorRow[] }) {
  const [filtro, setFiltro] = React.useState<GranoFiltroValue>("todos");
  const presentes = [...new Set(rows.map((r) => (r.glyph ? GRANO_DE_GLYPH[r.glyph] : null)).filter(Boolean))] as GranoKey[];
  const visibles = filtro === "todos" ? rows : rows.filter((r) => r.glyph && GRANO_DE_GLYPH[r.glyph] === filtro);

  return (
    <div>
      <FiltroGrano value={filtro} onChange={setFiltro} presentes={presentes} />
      <div className="table-scroll">
        <table className="tbl mon-tbl" style={{ minWidth: 460 }}>
          <thead>
            <tr>
              <th className="l" scope="col">Producto</th>
              <th scope="col">USD/tn</th>
              <th scope="col">Día</th>
              <th scope="col">Chicago</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => (
              <tr key={r.yahoo}>
                <td className="l">
                  <span className="grp-cell">
                    <span className="gglyph" style={{ color: glyphColor(r.glyph) }}>{glyphFor(r.glyph)}</span>
                    <span className="gemoji" aria-hidden="true">{r.emoji}</span>
                    <span className="gname">{r.nombre}</span>
                    {r.pos && <span className="gmeta">{r.pos}</span>}
                  </span>
                </td>
                <td className="mon-tn">{r.usdTn != null ? nfmt(r.usdTn, 1) : "—"}</td>
                <td className={deltaClass(r.deltaPct)}>{pfmt(r.deltaPct, 2)}</td>
                <td className="dim">
                  {r.ultimo != null ? `${nfmt(r.ultimo, r.unidadDec)} ${r.unidad}` : "—"}
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td className="l dim" colSpan={4}>Sin datos para este grano.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
