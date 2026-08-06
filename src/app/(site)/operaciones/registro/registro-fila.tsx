"use client";

import { useActionState, useState } from "react";
import { anularOperacion, restaurarOperacion, type OperacionFormState } from "../actions";
import { PRODUCTO_LABEL, CONDICION_LABEL, TIPO_LABEL, type Operacion, type OperacionLogEntry } from "@/lib/operaciones/tipos";
import type { PrecioResuelto } from "@/lib/operaciones/registro";

const ACCION_LABEL: Record<string, string> = {
  crear: "Creada",
  editar: "Editada",
  anular: "Anulada",
  restaurar: "Restaurada",
};

function fechaAR(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function fmtPrecio(moneda: string | null, precio: PrecioResuelto): string {
  if (precio.estado === "sin_precio") return "Sin precio (a fijar)";
  if (precio.estado === "pizarra_pendiente") return "Pizarra (pendiente)";
  const simbolo = moneda === "usd" ? "USD" : "$";
  const valor = precio.valor.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sufijo = precio.estado === "pizarra_resuelta" ? ` (pizarra ${fechaAR(precio.fechaPizarra)})` : "";
  return `${simbolo} ${valor}${sufijo}`;
}

/** Una fila de compra/venta del día: datos + editar/duplicar/anular/restaurar + historial desplegable. */
export function RegistroFila({
  operacion,
  precio,
  historial,
  onEditar,
  onDuplicar,
}: {
  operacion: Operacion;
  precio: PrecioResuelto;
  historial: OperacionLogEntry[];
  onEditar: () => void;
  onDuplicar: () => void;
}) {
  const [stAnular, actAnular, pendAnular] = useActionState<OperacionFormState, FormData>(anularOperacion, undefined);
  const [stRestaurar, actRestaurar, pendRestaurar] = useActionState<OperacionFormState, FormData>(restaurarOperacion, undefined);
  const [verHistorial, setVerHistorial] = useState(false);

  return (
    <li className={`op-fila${operacion.anulada ? " op-anulada" : ""}`}>
      <div className="op-fila-datos">
        <span className="op-fila-vol">
          {operacion.volumen_tn.toLocaleString("es-AR", { minimumFractionDigits: 2 })} tn
        </span>
        <span>{PRODUCTO_LABEL[operacion.producto]}</span>
        <span className="dim">{TIPO_LABEL[operacion.tipo]}</span>
        {operacion.condicion && <span className="dim">{CONDICION_LABEL[operacion.condicion]}</span>}
        <span>{fmtPrecio(operacion.moneda, precio)}</span>
        <span className="dim">Campaña {operacion.campania}</span>
        {operacion.contraparte && <span className="dim">{operacion.contraparte}</span>}
      </div>
      <div className="op-fila-acciones">
        {!operacion.anulada ? (
          <>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={onEditar}>
              Editar
            </button>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={onDuplicar}>
              Duplicar
            </button>
            <form action={actAnular}>
              <input type="hidden" name="id" value={operacion.id} />
              <button type="submit" className="admin-btn admin-btn-warn" disabled={pendAnular}>
                {pendAnular ? "…" : "Anular"}
              </button>
            </form>
          </>
        ) : (
          <form action={actRestaurar}>
            <input type="hidden" name="id" value={operacion.id} />
            <button type="submit" className="admin-btn admin-btn-ghost" disabled={pendRestaurar}>
              {pendRestaurar ? "…" : "Restaurar"}
            </button>
          </form>
        )}
        {historial.length > 0 && (
          <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setVerHistorial((v) => !v)}>
            {verHistorial ? "Ocultar historial" : `Historial (${historial.length})`}
          </button>
        )}
      </div>
      {stAnular?.error && (
        <p className="op-form-err" role="alert">
          {stAnular.error}
        </p>
      )}
      {stRestaurar?.error && (
        <p className="op-form-err" role="alert">
          {stRestaurar.error}
        </p>
      )}
      {verHistorial && (
        <ul className="op-historial">
          {historial.map((h) => (
            <li key={h.id}>
              <span className="dim">{new Date(h.en).toLocaleString("es-AR")}</span> — {ACCION_LABEL[h.accion] ?? h.accion}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
