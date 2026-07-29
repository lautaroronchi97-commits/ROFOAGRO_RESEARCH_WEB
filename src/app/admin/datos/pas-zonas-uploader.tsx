"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import { nfmt } from "@/lib/format";
import { procesarPasZonas, type PasZonasState } from "./pas-zonas-actions";

/**
 * Uploader de producción BCBA-PAS por zona agroecológica (C23, docs/PLAN_PAS_ZONAS.md §5).
 * Mismo patrón 2 pasos que el resto de `/admin/datos`: Lautaro baja `reporte_1.xlsx` (zonas) de
 * bolsadecereales.com/estimaciones-agricolas y lo sube acá. Sin fecha de snapshot (sin vintages —
 * el export trae siempre el histórico completo, decisión 6 del plan).
 */
export function PasZonasUploader() {
  const [st, dispatch, pend] = useActionState<PasZonasState, FormData>(procesarPasZonas, undefined);
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

  const previewVigente = st?.preview && archivo && st.preview.archivo === archivo.name;
  const p = st?.preview;

  return (
    <div className="admin-card">
      <h3 className="admin-preview-h">Estimaciones BCBA-PAS por zona (carga manual)</h3>
      <p className="admin-sub" style={{ margin: "0 0 10px" }}>
        Producción por zona agroecológica (mismo origen que el CSV nacional de arriba, pero es un
        export distinto — <code>reporte_1.xlsx</code> en{" "}
        <a href="https://www.bolsadecereales.com/estimaciones-agricolas" target="_blank" rel="noopener noreferrer">
          bolsadecereales.com/estimaciones-agricolas
        </a>
        ). Alimenta <code>/produccion/zonas</code> (solo mesa). Sin vintages: cada carga reemplaza
        el valor vigente de cada zona×campaña, nunca crea un snapshot nuevo.
      </p>
      <label className="admin-field">
        <span>Export de producción por zona (.xlsx)</span>
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

      <label className="admin-sub" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={forzar} onChange={(e) => setForzar(e.target.checked)} />
        Forzar carga (ignorar el chequeo de identidad suma-zonas=TOTAL — solo si estás seguro de que el dato es correcto)
      </label>

      {st?.error && <p className="admin-msg admin-msg-err" role="alert">{st.error}</p>}

      {p && (
        <div className="admin-preview">
          <h3 className="admin-preview-h">Previsualización — {p.archivo} (no se cargó nada todavía)</h3>
          <div className="admin-card-facts">
            <span><b>{nfmt(p.filas, 0)}</b> filas (grano × campaña × zona)</span>
            <span>{p.granos.length} granos</span>
            <span>{p.campanias.length} campañas</span>
          </div>
          <div className="admin-chips" style={{ marginTop: 8 }}>
            {p.granos.map((g) => <span key={g} className="admin-chip">{g}</span>)}
          </div>

          {p.fallasIdentidad.length > 0 && (
            <ul className="admin-preview-warns" style={{ marginTop: 10 }}>
              {p.fallasIdentidad.map((f, i) => (
                <li key={i}>
                  🚫 {f.grano} {f.campania}: la suma de zonas ({nfmt(f.sumaZonasTn, 0)} t) no cierra contra el TOTAL
                  ({nfmt(f.totalTn, 0)} t) — {f.diffPct.toFixed(1)}% de diferencia. La carga quedará BLOQUEADA salvo
                  que marques &quot;forzar&quot;.
                </li>
              ))}
            </ul>
          )}

          {p.cruce.some((c) => c.diffPct != null && c.diffPct > 2) && (
            <ul className="admin-preview-warns" style={{ marginTop: 10 }}>
              {p.cruce
                .filter((c) => c.diffPct != null && c.diffPct > 2)
                .map((c, i) => (
                  <li key={i}>
                    ⚠ {c.grano} {c.campania}: el TOTAL de este archivo ({nfmt(c.zonalMt, 1)} Mt) difiere{" "}
                    {c.diffPct!.toFixed(1)}% del último dato del comparador nacional ({nfmt(c.nacionalMt!, 1)} Mt) —
                    revisar si son cargas de fechas distintas antes de confirmar.
                  </li>
                ))}
            </ul>
          )}

          {p.descartes.length > 0 && (
            <ul className="admin-preview-warns" style={{ marginTop: 10 }}>
              {p.descartes.slice(0, 20).map((d, i) => (
                <li key={i}>⚠ {d.grano} {d.campania}{d.zona ? ` · ${d.zona}` : ""}: {d.motivo}</li>
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
          <code>/produccion/zonas</code> se refresca solo.
        </p>
      )}
    </div>
  );
}
