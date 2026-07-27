"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import { nfmt } from "@/lib/format";
import { PRODUCTO_SERIE_CLAVES, PRODUCTO_SERIE_DISPLAY, ZONA_DISPLAY, type ZonaCamiones } from "@/lib/camiones/config";
import { procesarCargaCamiones, type DatosCamionesState } from "./actions-camiones";

/**
 * Uploader del export de camiones en puerto (Williams Entregas vía Agrochat → tabla `camiones`).
 * Mismo patrón 2-pasos que `uploader.tsx` (compras): Previsualizar → Confirmar. Distinto de
 * compras en un punto: acá Lautoro elige la SERIE (Total o un grano puntual) con un selector,
 * porque el archivo en sí no trae esa info (Agrochat exporta un grano por vez).
 */

function ddmmaaaa(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export function UploaderCamiones() {
  const [st, dispatch, pend] = useActionState<DatosCamionesState, FormData>(procesarCargaCamiones, undefined);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [producto, setProducto] = useState<string>("TOTAL");
  const inputRef = useRef<HTMLInputElement>(null);

  const enviar = (paso: "preview" | "confirm") => {
    if (!archivo || pend) return;
    const fd = new FormData();
    fd.append("archivo", archivo);
    fd.append("producto", producto);
    fd.append("paso", paso);
    startTransition(() => dispatch(fd));
  };

  const previewVigente = st?.preview && archivo && st.preview.archivo === archivo.name && st.preview.producto === producto;
  const p = st?.preview;

  return (
    <div className="admin-card">
      <label className="admin-field">
        <span>Serie (qué representa el archivo)</span>
        <select className="admin-input" value={producto} onChange={(e) => setProducto(e.target.value)}>
          {PRODUCTO_SERIE_CLAVES.map((cod) => (
            <option key={cod} value={cod}>{PRODUCTO_SERIE_DISPLAY[cod]}</option>
          ))}
        </select>
      </label>

      <label className="admin-field" style={{ marginTop: 10 }}>
        <span>Export de camiones — Williams Entregas (CSV)</span>
        <input
          ref={inputRef}
          className="admin-input"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
        />
      </label>
      <p className="admin-sub" style={{ margin: "8px 0 12px" }}>
        Acepta 3 formatos: el <b>crudo/tidy</b> de Williams (<code>Date,Cultivo,Localidad,Puerto,Zona,Cantidad de Camiones</code>,
        una fila por terminal/día — el más confiable, la Zona ya viene explícita) · el de{" "}
        <b>zonas</b> (<code>Date,Darsenas y Bs As,Puertos de Necochea,Puertos-B.Blanca,Rosario y Zona</code>,
        fecha tipo &quot;ene 2, 2018&quot;) · o el de 33 columnas por <b>localidad</b> (deriva solo Rosario
        y aledaños + Bahía Blanca). Cantidad de <b>camiones</b>, no toneladas.
      </p>

      <div className="admin-card-acciones">
        <button type="button" className="admin-btn" disabled={!archivo || pend} onClick={() => enviar("preview")}>
          {pend ? "Procesando…" : "1 · Previsualizar"}
        </button>
        <button type="button" className="admin-btn admin-btn-ok" disabled={!previewVigente || pend} onClick={() => enviar("confirm")}>
          {pend ? "Procesando…" : "2 · Confirmar y cargar"}
        </button>
      </div>

      {st?.error && <p className="admin-msg admin-msg-err" role="alert">{st.error}</p>}

      {p && (
        <div className="admin-preview">
          <h3 className="admin-preview-h">
            Previsualización — {p.archivo} · serie {PRODUCTO_SERIE_DISPLAY[p.producto]} (no se cargó nada todavía)
          </h3>
          <div className="admin-card-facts">
            <span><b>{nfmt(p.filas, 0)}</b> filas válidas</span>
            <span><b>{ddmmaaaa(p.desde)}</b> → <b>{ddmmaaaa(p.hasta)}</b></span>
            <span>inválidas <b>{nfmt(p.filasInvalidas, 0)}</b></span>
            <span>formato <b>{p.formato}</b></span>
          </div>
          <div className="admin-chips" style={{ marginTop: 8 }}>
            {p.zonasCubiertas.map((z) => (
              <span key={z} className="admin-chip">{ZONA_DISPLAY[z as ZonaCamiones] ?? z}</span>
            ))}
          </div>
          <div className="table-scroll" style={{ marginTop: 10 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th className="l" scope="col">Fecha</th>
                  <th className="l" scope="col">Zona</th>
                  <th scope="col">Camiones</th>
                </tr>
              </thead>
              <tbody>
                {p.muestra.map((m, i) => (
                  <tr key={i}>
                    <td className="l">{ddmmaaaa(m.fecha)}</td>
                    <td className="l">{ZONA_DISPLAY[m.zona as ZonaCamiones] ?? m.zona}</td>
                    <td>{nfmt(m.cantidad, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.advertencias.length > 0 && (
            <ul className="admin-preview-warns">
              {p.advertencias.map((a, i) => <li key={i}>⚠ {a}</li>)}
            </ul>
          )}
        </div>
      )}

      {st?.ok && (
        <p className="admin-msg admin-msg-ok">
          Listo: {nfmt(st.ok.filas, 0)} filas cargadas/actualizadas. La página de Comercio se refresca sola.
        </p>
      )}
    </div>
  );
}
