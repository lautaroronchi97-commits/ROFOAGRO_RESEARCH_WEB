"use client";

import { useActionState } from "react";
import { guardarFeedbackInforme, type FeedbackInformeState } from "./actions";

/**
 * Mini-form de feedback por informe, visible solo admin (E1, §9 de PLAN_INFORMES_V3.md) — las
 * skills lo leen en su Paso 0 antes de redactar el próximo. Colapsado por defecto (un `<details>`
 * por informe) para no ensuciar la lista pública que también renderiza este componente.
 */
export function InformeFeedback({
  id,
  actual,
  actualNota,
}: {
  id: string;
  actual: string | null;
  actualNota: number | null;
}) {
  const [st, action, pend] = useActionState<FeedbackInformeState, FormData>(guardarFeedbackInforme, undefined);
  return (
    <details className="inf-fb-details">
      <summary>Feedback (mesa)</summary>
      <form action={action} className="vw-fb">
        <input type="hidden" name="id" value={id} />
        <textarea
          name="feedback"
          defaultValue={actual ?? ""}
          rows={2}
          placeholder="¿Cómo salió este informe? ¿Algo para corregir la próxima vez?"
        />
        <div className="vw-fb-nota">
          <span>Nota</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="vw-fb-nota-op">
              <input type="radio" name="nota" value={n} defaultChecked={actualNota === n} />
              {n}
            </label>
          ))}
          <label className="vw-fb-nota-op">
            <input type="radio" name="nota" value="" defaultChecked={actualNota == null} />
            sin nota
          </label>
        </div>
        <div className="vw-fb-foot">
          <button type="submit" disabled={pend} className="admin-btn admin-btn-ok admin-btn-sm">
            {pend ? "Guardando…" : "Guardar"}
          </button>
          {st?.ok && <span className="vw-fb-ok">{st.ok}</span>}
          {st?.error && <span className="vw-fb-err">{st.error}</span>}
        </div>
      </form>
    </details>
  );
}
