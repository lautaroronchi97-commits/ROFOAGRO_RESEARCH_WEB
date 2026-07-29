"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import { nfmt } from "@/lib/format";
import { procesarPasCondicion, type PasCondicionState } from "./pas-condicion-actions";

/**
 * Uploader de condición de cultivos BCBA-PAS (C27, docs/PLAN_PAS_ZONAS.md §9). Un archivo por
 * cultivo (girasol/soja/maíz/trigo — el parser detecta cuál es del propio contenido, así que el
 * mismo formulario sirve para los 4). Mismo patrón 2 pasos que el resto de `/admin/datos`. Sin
 * fecha de snapshot ni guard de identidad (a diferencia de pas-zonas: acá no hay un TOTAL
 * nacional contra el que cruzar, cada semana de cada campaña es un dato independiente).
 */
export function PasCondicionUploader() {
  const [st, dispatch, pend] = useActionState<PasCondicionState, FormData>(procesarPasCondicion, undefined);
  const [archivo, setArchivo] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const enviar = (paso: "preview" | "confirm") => {
    if (!archivo || pend) return;
    const fd = new FormData();
    fd.append("archivo", archivo);
    fd.append("paso", paso);
    startTransition(() => dispatch(fd));
  };

  const previewVigente = st?.preview && archivo && st.preview.archivo === archivo.name;
  const p = st?.preview;

  return (
    <div className="admin-card">
      <h3 className="admin-preview-h">Condición de cultivos BCBA-PAS (carga manual)</h3>
      <p className="admin-sub" style={{ margin: "0 0 10px" }}>
        Un archivo por cultivo (girasol, soja, maíz o trigo — subilos uno por uno) desde{" "}
        <a href="https://www.bolsadecereales.com/estimaciones-agricolas" target="_blank" rel="noopener noreferrer">
          bolsadecereales.com/estimaciones-agricolas
        </a>
        . Alimenta <code>/produccion/condicion</code> (solo mesa): condición de cultivo, condición
        hídrica y fenología, semana a semana de cada campaña. Sin fecha: cada carga reemplaza el
        valor vigente de cada semana, nunca crea un snapshot nuevo.
      </p>
      <label className="admin-field">
        <span>Export de condición de cultivos (.xlsx)</span>
        <input
          ref={inputRef}
          className="admin-input"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
        />
      </label>

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
          <h3 className="admin-preview-h">Previsualización — {p.archivo} (no se cargó nada todavía)</h3>
          <div className="admin-card-facts">
            <span><b>{nfmt(p.filas, 0)}</b> filas (semana × campaña{p.ciclos.length > 1 ? " × ciclo" : ""})</span>
            <span>cultivo <b>{p.grano}</b></span>
            <span>{p.campanias.length} campañas ({p.campanias[0]}…{p.campanias.at(-1)})</span>
          </div>
          <div className="admin-chips" style={{ marginTop: 8 }}>
            {p.ciclos.map((c) => <span key={c} className="admin-chip">ciclo: {c}</span>)}
            {p.etapas.map((e) => <span key={e} className="admin-chip">{e}</span>)}
          </div>

          {p.zonasNuevas.length > 0 && (
            <ul className="admin-preview-warns" style={{ marginTop: 10 }}>
              <li>ℹ El archivo trae zonas además de TOTAL: {p.zonasNuevas.join(", ")} — se cargan igual (la tabla las soporta).</li>
            </ul>
          )}

          {p.descartes.length > 0 && (
            <ul className="admin-preview-warns" style={{ marginTop: 10 }}>
              {p.descartes.slice(0, 20).map((d, i) => (
                <li key={i}>
                  ⚠ {d.grano}{d.ciclo ? ` (${d.ciclo})` : ""}{d.campania ? ` ${d.campania}` : ""}
                  {d.semana != null ? ` sem. ${d.semana}` : ""}: {d.motivo}
                </li>
              ))}
              {p.descartes.length > 20 && <li>… y {p.descartes.length - 20} más.</li>}
            </ul>
          )}
        </div>
      )}

      {st?.ok && (
        <p className="admin-msg admin-msg-ok">
          Listo: {nfmt(st.ok.filas, 0)} filas cargadas/actualizadas
          {st.ok.descartadas > 0 ? ` (${st.ok.descartadas} filas descartadas, ver arriba)` : ""}. El panel de{" "}
          <code>/produccion/condicion</code> se refresca solo.
        </p>
      )}
    </div>
  );
}
