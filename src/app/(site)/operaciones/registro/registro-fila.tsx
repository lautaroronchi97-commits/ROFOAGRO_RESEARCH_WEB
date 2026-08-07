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

function fmtMonto(simbolo: string, valor: number): string {
  return `${simbolo} ${valor.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Precio de una operación, con el desglose completo cuando hay algo que
 * desglosar (pedido de Lautaro 07/08/2026): precio base, cada ajuste cargado
 * (descuento %, descuento monto, comisión %) y el precio final ya con todo
 * aplicado. Sin ajustes cargados, muestra solo el valor (igual que antes —
 * base y final son el mismo número, repetirlo sería ruido).
 */
function fmtPrecio(operacion: Operacion, precio: PrecioResuelto): string {
  if (precio.estado === "sin_precio") return "Sin precio (a fijar)";
  if (precio.estado === "pizarra_pendiente") return "Pizarra (pendiente)";
  const simbolo = operacion.moneda === "usd" ? "USD" : "$";
  const sufijoPizarra = precio.estado === "pizarra_resuelta" ? ` (pizarra ${fechaAR(precio.fechaPizarra)})` : "";

  const ajustes: string[] = [];
  if (operacion.descuento_pct) ajustes.push(`desc. ${fmtPct(operacion.descuento_pct)}%`);
  if (operacion.descuento_monto) ajustes.push(`−${fmtMonto(simbolo, operacion.descuento_monto)}`);
  if (operacion.comision_pct) ajustes.push(`com. ${fmtPct(operacion.comision_pct)}%`);

  if (ajustes.length === 0) return `${fmtMonto(simbolo, precio.valor)}${sufijoPizarra}`;
  return `Base ${fmtMonto(simbolo, precio.base)}${sufijoPizarra} · ${ajustes.join(" · ")} · Final ${fmtMonto(simbolo, precio.valor)}`;
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
        {operacion.condicion === "a_fijar" && operacion.fijacion_desde && (
          <span className="dim">
            Fijación {fechaAR(operacion.fijacion_desde)}
            {operacion.fijacion_hasta ? ` – ${fechaAR(operacion.fijacion_hasta)}` : " (libre)"}
          </span>
        )}
        <span>{fmtPrecio(operacion, precio)}</span>
        <span className="dim">Campaña {operacion.campania}</span>
        {operacion.es_canje && <span className="dim">Canje</span>}
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
