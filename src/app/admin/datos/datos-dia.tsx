"use client";

import { useActionState, useState } from "react";
import { guardarDatosDelDia } from "./datos-dia-actions";

function ddmmaaaa(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export type DiaColor = { fecha: string; texto: string; chicagoBcr: string; tomado: boolean };

/**
 * "Datos del día" del informe diario (MP1 de PLAN_INFORMES.md): el color de la
 * rueda (texto libre, negocios/sensaciones/precios que Lautaro vio en la rueda).
 * Pensado para cargar desde el celular, con la fecha de hoy siempre arriba y
 * editable. Debajo, el historial de los últimos días con color cargado: cada
 * fila es editable HASTA que el informe diario de esa fecha ya se generó
 * (`informes_generados`, guard también server-side en la action) — a partir de
 * ahí queda fija, como registro fiel de lo que efectivamente se usó ese día.
 * Si un día no se carga nada, el informe sale igual, solo con los datos
 * automáticos. Las compras BCRA (MULC) tienen su propia carga manual — ver
 * `BcraManual` — porque a diferencia del color de la rueda (siempre "hoy" por
 * defecto), a veces hace falta tapar un hueco de un día anterior.
 */
export function DatosDia({ fechaHoy, dias }: { fechaHoy: string; dias: DiaColor[] }) {
  const hoy = dias.find((d) => d.fecha === fechaHoy) ?? { fecha: fechaHoy, texto: "", chicagoBcr: "", tomado: false };
  const historial = dias.filter((d) => d.fecha !== fechaHoy);

  return (
    <div className="admin-card">
      <h3 className="admin-preview-h">Datos del día — {ddmmaaaa(fechaHoy)}</h3>
      <p className="admin-sub" style={{ margin: "0 0 10px" }}>
        Lo que viste hoy en la rueda (negocios, sensaciones, precios que te pasaron). Alimenta el
        informe diario. Si no cargás nada, sale igual solo con los datos automáticos. Editable
        hasta que el informe diario ya lo haya tomado — después queda fijo.
      </p>

      <FilaColor dia={hoy} abiertaPorDefecto={!hoy.tomado} />

      {historial.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <p className="admin-sub" style={{ margin: "0 0 8px" }}>Historial</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {historial.map((d) => (
              <FilaColor key={d.fecha} dia={d} abiertaPorDefecto={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FilaColor({ dia, abiertaPorDefecto }: { dia: DiaColor; abiertaPorDefecto: boolean }) {
  const [editando, setEditando] = useState(abiertaPorDefecto);
  const [st, dispatch, pend] = useActionState(guardarDatosDelDia, undefined);

  if (dia.tomado) {
    return (
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
        <p className="admin-sub" style={{ margin: 0 }}>
          <b style={{ color: "var(--ink)" }}>{ddmmaaaa(dia.fecha)}</b> · 🔒 ya lo tomó el informe diario
        </p>
        {dia.texto && <p style={{ margin: "4px 0 0" }}>{dia.texto}</p>}
        {dia.chicagoBcr && (
          <p style={{ margin: "4px 0 0" }} className="admin-sub">
            Chicago (BCR): {dia.chicagoBcr}
          </p>
        )}
      </div>
    );
  }

  if (!editando) {
    return (
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <b style={{ color: "var(--ink)" }}>{ddmmaaaa(dia.fecha)}</b>
          <button
            type="button"
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => setEditando(true)}
          >
            {dia.texto ? "Editar" : "Cargar"}
          </button>
        </div>
        {dia.texto && <p style={{ margin: "4px 0 0" }}>{dia.texto}</p>}
        {dia.chicagoBcr && (
          <p style={{ margin: "4px 0 0" }} className="admin-sub">
            Chicago (BCR): {dia.chicagoBcr}
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={dispatch} style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
      <input type="hidden" name="fecha" value={dia.fecha} />
      <label className="admin-field">
        <span>{ddmmaaaa(dia.fecha)} — Color de la rueda</span>
        <textarea
          name="texto"
          className="admin-input"
          rows={5}
          defaultValue={dia.texto}
          placeholder="Ej: rueda floja de agro, poco negocio en soja disponible, exportación apretando en trigo julio, volumen X mil t…"
        />
      </label>
      <label className="admin-field">
        <span>Contexto Chicago (BCR) — opcional</span>
        <textarea
          name="chicago_bcr"
          className="admin-input"
          rows={3}
          defaultValue={dia.chicagoBcr}
          placeholder="Pegá el comentario de la rueda de Chicago que publica BCR — se cita en el informe como «según BCR»."
        />
      </label>
      <div className="admin-card-acciones">
        <button type="submit" className="admin-btn admin-btn-ok" disabled={pend}>
          {pend ? "Guardando…" : "Guardar"}
        </button>
        {!abiertaPorDefecto && (
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            disabled={pend}
            onClick={() => setEditando(false)}
          >
            Cancelar
          </button>
        )}
      </div>
      {st?.error && <p className="admin-msg admin-msg-err" role="alert">{st.error}</p>}
      {st?.ok && <p className="admin-msg admin-msg-ok">{st.ok}</p>}
    </form>
  );
}
