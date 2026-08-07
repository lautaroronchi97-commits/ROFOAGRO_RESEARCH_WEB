"use client";

import { Fragment, useState } from "react";
import { nfmt, sfmt } from "@/lib/format";
import { empresasPorProducto, empresasPorZona, type FilaEmpresaFoto } from "@/lib/lineup/foto-empresas";
import type { FotoOperativa } from "@/lib/lineup/foto";
import { BuquesTabla } from "./buques-tabla";

/**
 * Tablero de la foto operativa (relevamiento web R10, punto 54): "qué varió" antes que
 * "barco por barco". Client component porque el drill-down por empresa (click en una fila de
 * producto o de zona) necesita estado — `foto.ts` NO cambió: `buques` ya trae producto+zona+
 * empresa+toneladas por fila, así que la agregación por empresa es aritmética de UI
 * (`foto-empresas.ts`), no una dimensión nueva de datos.
 *
 * Fusión (vs. el diseño anterior): el bloque separado "Vs hace N días" — 2 KPIs + una lista de
 * deltas por producto — se pliega en la propia tabla "Por producto" como una 2ª columna Δ
 * (día anterior YA la tenía; semana pasada es el mismo `referencia` de siempre, reindexado por
 * fila en vez de listado aparte). Nada nuevo aparece como panel/tabla suelta.
 */

/** "2026-07-16" → "16/07". */
function ddmm(iso: string | null): string {
  if (!iso) return "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function DeltaCell({ d }: { d: number | null | undefined }) {
  if (d === null || d === undefined) return <td className="dim">—</td>;
  if (Math.abs(d) < 1) return <td className="dim">=</td>;
  return <td className={d > 0 ? "pos" : "neg"}>{sfmt(d, 0)}</td>;
}

/** `colsExtra` = columnas de la tabla padre DESPUÉS de Buques/Toneladas (deltas, si las hay). */
function FilasEmpresa({ filas, colsExtra = 0 }: { filas: FilaEmpresaFoto[]; colsExtra?: number }) {
  if (filas.length === 0) {
    return (
      <tr className="lu-drill">
        <td colSpan={2 + colsExtra} className="dim">Sin empresas para este corte.</td>
      </tr>
    );
  }
  return (
    <>
      {filas.map((f) => (
        <tr key={f.empresa} className="lu-drill">
          <td className="l">{f.empresa}</td>
          <td>{nfmt(f.buques, 0)}</td>
          <td>{nfmt(f.toneladas, 0)}</td>
          {Array.from({ length: colsExtra }, (_, i) => <td key={i} />)}
        </tr>
      ))}
    </>
  );
}

export function FotoOperativaClient({ data }: { data: FotoOperativa }) {
  const { fecha, fechaPrev, productos, zonas, buques, nuevos, salidos, referencia, totalTon, totalBuques } = data;
  const [abierto, setAbierto] = useState<{ tipo: "producto" | "zona"; clave: string } | null>(null);

  function toggle(tipo: "producto" | "zona", clave: string) {
    setAbierto((v) => (v?.tipo === tipo && v.clave === clave ? null : { tipo, clave }));
  }

  const deltaSemanaPorCodigo = new Map((referencia?.productos ?? []).map((p) => [p.codigo, p.deltaTon]));

  return (
    <>
      <div className="lu-kpis">
        <div className="lu-kpi">
          <span className="lu-kpi-v">{nfmt(totalBuques, 0)}</span>
          <span className="lu-kpi-l">buques cargando</span>
        </div>
        <div className="lu-kpi">
          <span className="lu-kpi-v">{nfmt(totalTon, 0)}</span>
          <span className="lu-kpi-l">toneladas al embarque</span>
        </div>
        <div className="lu-kpi">
          <span className="lu-kpi-v">{productos.length}</span>
          <span className="lu-kpi-l">productos activos</span>
        </div>
      </div>

      {(nuevos.length > 0 || salidos.length > 0) && fechaPrev && (
        <div className="lu-cambios">
          <h3 className="lu-h3">Qué cambió vs el {ddmm(fechaPrev)}</h3>
          <ul className="lu-nuevos">
            {nuevos.map((n) => (
              <li key={`n-${n.vessel}`}>
                <span className="lu-nuevo-badge">nuevo</span>
                <b>{n.vessel}</b> · {n.empresa} · {n.productos.join(", ")} ·{" "}
                <span className="lu-mono">{nfmt(n.toneladas, 0)} t</span> · {n.zona}
                {n.etb ? ` · ETB ${ddmm(n.etb)}` : ""}
              </li>
            ))}
            {salidos.map((n) => (
              <li key={`s-${n.vessel}`}>
                <span className="lu-salido-badge">salió</span>
                <b>{n.vessel}</b> · {n.empresa} · {n.productos.join(", ")} ·{" "}
                <span className="lu-mono">{nfmt(n.toneladas, 0)} t</span> · {n.zona}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3 className="lu-h3">Por producto</h3>
      <p className="lu-nota">Click en un producto para ver qué empresas lo tienen cargando ahora.</p>
      <div className="table-scroll">
        <table className="tbl" style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th className="l" scope="col">Producto</th>
              <th scope="col">Buques</th>
              <th scope="col">Toneladas</th>
              <th scope="col">Δ vs {ddmm(fechaPrev)}</th>
              <th scope="col">Δ semana{referencia ? ` (${ddmm(referencia.fecha)})` : ""}</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <Fragment key={p.codigo}>
                <tr
                  className="lu-clickable"
                  onClick={() => toggle("producto", p.codigo)}
                  aria-expanded={abierto?.tipo === "producto" && abierto.clave === p.codigo}
                >
                  <td className="l sym">
                    <span className="lu-clic-ico">{abierto?.tipo === "producto" && abierto.clave === p.codigo ? "▾" : "▸"}</span> {p.display}
                  </td>
                  <td>{nfmt(p.buques, 0)}</td>
                  <td>{nfmt(p.toneladas, 0)}</td>
                  <DeltaCell d={p.deltaTon} />
                  <DeltaCell d={deltaSemanaPorCodigo.get(p.codigo)} />
                </tr>
                {abierto?.tipo === "producto" && abierto.clave === p.codigo && (
                  <FilasEmpresa filas={empresasPorProducto(buques, p.display)} colsExtra={2} />
                )}
              </Fragment>
            ))}
            <tr className="tot">
              <td className="l">TOTAL</td>
              <td>{nfmt(totalBuques, 0)}</td>
              <td>{nfmt(totalTon, 0)}</td>
              <td className="dim" />
              <DeltaCell d={referencia?.deltaTon} />
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="lu-h3">Por zona</h3>
      <p className="lu-nota">Click en una zona para ver qué empresas están cargando ahí.</p>
      <div className="table-scroll">
        <table className="tbl" style={{ minWidth: 380 }}>
          <thead>
            <tr>
              <th className="l" scope="col">Zona</th>
              <th scope="col">Buques</th>
              <th scope="col">Toneladas</th>
            </tr>
          </thead>
          <tbody>
            {zonas.map((z) => (
              <Fragment key={z.zona}>
                <tr
                  className="lu-clickable"
                  onClick={() => toggle("zona", z.zona)}
                  aria-expanded={abierto?.tipo === "zona" && abierto.clave === z.zona}
                >
                  <td className="l sym">
                    <span className="lu-clic-ico">{abierto?.tipo === "zona" && abierto.clave === z.zona ? "▾" : "▸"}</span> {z.zona}
                  </td>
                  <td>{nfmt(z.buques, 0)}</td>
                  <td>{nfmt(z.toneladas, 0)}</td>
                </tr>
                {abierto?.tipo === "zona" && abierto.clave === z.zona && (
                  <FilasEmpresa filas={empresasPorZona(buques, z.zona)} />
                )}
              </Fragment>
            ))}
            {/* Totales combinados (feedback 07/08/2026: "en ningún lado veo totales de up
                river") — aritmética de UI sobre `zonas`, sin tocar foto.ts. */}
            {(() => {
              const upRiver = zonas.filter((z) => z.zona.startsWith("Up River"));
              const buquesUpRiver = upRiver.reduce((s, z) => s + z.buques, 0);
              const tonUpRiver = upRiver.reduce((s, z) => s + z.toneladas, 0);
              const buquesTotal = zonas.reduce((s, z) => s + z.buques, 0);
              const tonTotal = zonas.reduce((s, z) => s + z.toneladas, 0);
              return (
                <>
                  {upRiver.length > 0 && (
                    <tr className="tot">
                      <td className="l">Up River (Norte + Sur)</td>
                      <td>{nfmt(buquesUpRiver, 0)}</td>
                      <td>{nfmt(tonUpRiver, 0)}</td>
                    </tr>
                  )}
                  <tr className="tot">
                    <td className="l">TOTAL</td>
                    <td>{nfmt(buquesTotal, 0)}</td>
                    <td>{nfmt(tonTotal, 0)}</td>
                  </tr>
                </>
              );
            })()}
          </tbody>
        </table>
      </div>

      <h3 className="lu-h3">Buques en el line-up</h3>
      <BuquesTabla buques={buques} fecha={fecha} />
    </>
  );
}
