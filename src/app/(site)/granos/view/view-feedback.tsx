"use client";

import { useActionState } from "react";
import { guardarFeedback, type FeedbackState } from "./actions";

/**
 * Form de feedback por view: Lautaro califica el research semanal (texto + nota 1-5,
 * decisión §10.2 de PLAN_INFORMES_V2.md) y la sesión siguiente lo lee antes de
 * escribir (loop de calibración de la skill view-mercado, §7 del plan). La nota mide
 * calidad/utilidad del view — el acierto contra precio lo mide el scorecard aparte.
 */
export function ViewFeedback({
  id,
  actual,
  actualNota,
}: {
  id: string;
  actual: string | null;
  actualNota: number | null;
}) {
  const [st, action, pend] = useActionState<FeedbackState, FormData>(guardarFeedback, undefined);
  return (
    <form action={action} className="vw-fb">
      <input type="hidden" name="id" value={id} />
      <label className="vw-fb-label" htmlFor={`fb-${id}`}>
        Tu feedback (lo lee la próxima sesión de research)
      </label>
      <textarea
        id={`fb-${id}`}
        name="feedback"
        defaultValue={actual ?? ""}
        rows={3}
        placeholder="¿La dirección se sostiene? ¿Qué argumento sobra o falta? ¿Suena a vos?"
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
        <button type="submit" disabled={pend} className="admin-btn admin-btn-ok">
          {pend ? "Guardando…" : "Guardar feedback"}
        </button>
        {st?.ok && <span className="vw-fb-ok">{st.ok}</span>}
        {st?.error && <span className="vw-fb-err">{st.error}</span>}
      </div>
    </form>
  );
}
