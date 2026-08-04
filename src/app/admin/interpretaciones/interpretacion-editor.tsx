"use client";

import { useActionState, useState } from "react";
import { MdLite } from "@/components/md-lite";
import { ImpactoBadges } from "@/components/impacto-badges";
import { guardarInterpretacion, publicarInterpretacion, descartarInterpretacion, type InterpState } from "./actions";
import type { Interpretacion } from "@/lib/interpretaciones";

function ddmmaaaa(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/**
 * Editor de un borrador de interpretación (MP4): textarea + preview con MdLite,
 * Guardar (solo borrador_md) / Publicar (guarda + publicado_md=borrador_md,
 * estado=publicado) / Descartar. La firma de Lautaro nunca sale sin su OK: nada
 * se publica solo, esto es lo que él revisa a mano en /admin/interpretaciones.
 */
export function InterpretacionEditor({ item }: { item: Interpretacion }) {
  const [texto, setTexto] = useState(item.borrador_md);
  const [preview, setPreview] = useState(false);
  const [stGuardar, actGuardar, pendGuardar] = useActionState<InterpState, FormData>(guardarInterpretacion, undefined);
  const [stPublicar, actPublicar, pendPublicar] = useActionState<InterpState, FormData>(publicarInterpretacion, undefined);
  const [stDescartar, actDescartar, pendDescartar] = useActionState<InterpState, FormData>(descartarInterpretacion, undefined);

  const pend = pendGuardar || pendPublicar || pendDescartar;
  const st = stPublicar ?? stGuardar ?? stDescartar;

  return (
    <article className="admin-card interp-card">
      <div className="admin-card-hd">
        <h3 className="admin-card-name">
          <span className={`cal-org org-${item.organismo}`}>{item.organismo}</span> {item.informe}
        </h3>
        <span className="admin-card-when">
          publicado por el organismo el {ddmmaaaa(item.fecha_publicacion)}
          {item.granos.length > 0 ? ` · ${item.granos.join(", ")}` : ""}
        </span>
      </div>

      <ImpactoBadges impacto={item.impacto} />

      <div className="interp-toggle">
        <button type="button" className={`admin-btn-sm ${!preview ? "is-on" : ""}`} onClick={() => setPreview(false)}>
          Editar
        </button>
        <button type="button" className={`admin-btn-sm ${preview ? "is-on" : ""}`} onClick={() => setPreview(true)}>
          Vista previa
        </button>
      </div>

      {preview ? (
        <MdLite md={texto || "_(vacío)_"} className="interp-preview" />
      ) : (
        <textarea
          className="admin-input interp-textarea"
          rows={12}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      )}

      {item.evidencia_externa.length > 0 && (
        <div className="interp-evidencia">
          <h4>Evidencia externa citada (verificada, V2)</h4>
          <ul>
            {item.evidencia_externa.map((e, i) => (
              <li key={i}>
                <strong>{e.dato}.</strong>{" "}
                <a href={e.url} target="_blank" rel="noopener noreferrer nofollow">
                  fuente
                </a>{" "}
                <span className="dim">({ddmmaaaa(e.fecha_pub)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="admin-card-acciones">
        <form action={actGuardar} style={{ display: "inline" }}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="borrador_md" value={texto} />
          <button type="submit" className="admin-btn" disabled={pend}>
            {pendGuardar ? "Guardando…" : "Guardar borrador"}
          </button>
        </form>
        <form action={actPublicar} style={{ display: "inline" }}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="borrador_md" value={texto} />
          <button type="submit" className="admin-btn admin-btn-ok" disabled={pend}>
            {pendPublicar ? "Publicando…" : "Publicar"}
          </button>
        </form>
        <form action={actDescartar} style={{ display: "inline" }}>
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            className="admin-btn admin-btn-warn"
            disabled={pend}
            onClick={(e) => {
              if (!confirm("¿Descartar esta interpretación? No se va a publicar.")) e.preventDefault();
            }}
          >
            {pendDescartar ? "Descartando…" : "Descartar"}
          </button>
        </form>
      </div>

      {st?.error && <p className="admin-msg admin-msg-err" role="alert">{st.error}</p>}
      {st?.ok && <p className="admin-msg admin-msg-ok">{st.ok}</p>}
    </article>
  );
}
