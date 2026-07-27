"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import { nfmt } from "@/lib/format";
import { procesarCarga, type DatosState } from "./actions";

/**
 * Uploader del export de Agrochat (serie de comercialización → tabla `compras`).
 * Dos pasos con el MISMO archivo: 1) Previsualizar (parsea y resume, no escribe) →
 * 2) Confirmar y cargar (upsert por RPC + refresh del avance).
 *
 * El File elegido vive en el estado del cliente y se reenvía en cada paso (React 19
 * resetea el form tras cada action; guardándolo en estado y despachando el FormData a
 * mano con startTransition, el paso 2 no depende ni del reset del form ni de estado en
 * memoria del server — clave en serverless). Si se cambia el archivo después de
 * previsualizar, hay que previsualizar de nuevo (el botón 2 se deshabilita).
 */

function ddmmaaaa(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export function Uploader() {
  const [st, dispatch, pend] = useActionState<DatosState, FormData>(procesarCarga, undefined);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [forzar, setForzar] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const enviar = (paso: "preview" | "confirm") => {
    if (!archivo || pend) return;
    const fd = new FormData();
    fd.append("archivo", archivo);
    fd.append("paso", paso);
    if (forzar) fd.append("forzar", "1");
    startTransition(() => dispatch(fd));
  };

  // El paso 2 solo vale si la previsualización corresponde al archivo elegido.
  const previewVigente = st?.preview && archivo && st.preview.archivo === archivo.name;
  const p = st?.preview;

  return (
    <div className="admin-card">
      <label className="admin-field">
        <span>Export de Agrochat (CSV o Excel .xlsx)</span>
        <input
          ref={inputRef}
          className="admin-input"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
        />
      </label>
      <p className="admin-sub" style={{ margin: "8px 0 12px" }}>
        Acepta dos formatos: la cabecera propia{" "}
        <code>fecha,grano,sector,campaña,compras_semanales,total_comprado_acumulado,precio_hecho,a_fijar,fijado,saldo_a_fijar</code>{" "}
        (DD/MM/AAAA, toneladas enteras, sector Exportador/Industria) — o directamente el export{" "}
        <b>crudo</b> de Agrochat (<code>Date,Country,Sector,Crop,Harvest,Semanal,Total Comprado,…</code>,
        en miles de toneladas, con filas &quot;Total&quot;): la web detecta cuál es y convierte sola
        (filtra &quot;Total&quot;, pasa el grano a minúscula, ×1000 a toneladas enteras). Máximo 15 MB.
      </p>

      <div className="admin-card-acciones">
        <button type="button" className="admin-btn" disabled={!archivo || pend} onClick={() => enviar("preview")}>
          {pend ? "Procesando…" : "1 · Previsualizar"}
        </button>
        <button type="button" className="admin-btn admin-btn-ok" disabled={!previewVigente || pend} onClick={() => enviar("confirm")}>
          {pend ? "Procesando…" : "2 · Confirmar y cargar"}
        </button>
      </div>

      <label className="admin-sub" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={forzar} onChange={(e) => setForzar(e.target.checked)} />
        Forzar carga (ignorar el chequeo de unidades — solo si estás seguro de que el dato es correcto)
      </label>

      {st?.error && <p className="admin-msg admin-msg-err" role="alert">{st.error}</p>}

      {p && (
        <div className="admin-preview">
          <h3 className="admin-preview-h">Previsualización — {p.archivo} (no se cargó nada todavía)</h3>
          <div className="admin-card-facts">
            <span><b>{nfmt(p.filas, 0)}</b> filas válidas (de {nfmt(p.crudas, 0)} leídas)</span>
            <span><b>{ddmmaaaa(p.desde)}</b> → <b>{ddmmaaaa(p.hasta)}</b></span>
            <span>descartadas <b>{nfmt(p.descartadas, 0)}</b></span>
            <span>duplicadas <b>{nfmt(p.duplicadas, 0)}</b></span>
            <span>
              claves ya en la base <b>{p.existentes == null ? "?" : nfmt(p.existentes, 0)}</b> (se actualizan) · nuevas{" "}
              <b>{p.nuevas == null ? "?" : nfmt(p.nuevas, 0)}</b>
            </span>
          </div>
          <div className="admin-chips" style={{ marginTop: 8 }}>
            {p.granos.map((g) => <span key={g} className="admin-chip">{g}</span>)}
            {p.campanas.map((c) => <span key={c} className="admin-chip">{c}</span>)}
          </div>
          <div className="table-scroll" style={{ marginTop: 10 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th className="l" scope="col">Fecha</th>
                  <th className="l" scope="col">Grano</th>
                  <th className="l" scope="col">Sector</th>
                  <th className="l" scope="col">Campaña</th>
                  <th scope="col">Semanal t</th>
                  <th scope="col">Acumulado t</th>
                </tr>
              </thead>
              <tbody>
                {p.muestra.map((m, i) => (
                  <tr key={i}>
                    <td className="l">{ddmmaaaa(m.fecha)}</td>
                    <td className="l">{m.grano}</td>
                    <td className="l">{m.sector}</td>
                    <td className="l">{m.campana}</td>
                    <td>{m.semanal == null ? "—" : nfmt(m.semanal, 0)}</td>
                    <td>{m.total == null ? "—" : nfmt(m.total, 0)}</td>
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
        <div>
          <p className="admin-msg admin-msg-ok">
            Listo: {nfmt(st.ok.filas, 0)} filas cargadas/actualizadas en la serie. Las páginas de Comercio se refrescan solas.
          </p>
          {st.ok.advertencias.length > 0 && (
            <ul className="admin-preview-warns">
              {st.ok.advertencias.map((a, i) => <li key={i}>⚠ {a}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
