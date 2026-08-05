"use client";

import { useActionState, useState } from "react";
import { crearOperacion, editarOperacion, type OperacionFormState } from "../actions";
import { CurvaPicker } from "@/components/curva-picker";
import type { GranoCurva } from "@/lib/curva-types";
import {
  PRODUCTOS,
  PRODUCTO_LABEL,
  PRODUCTO_GRANO,
  PRODUCTOS_CON_FUTURO,
  TIPO_LABEL,
  CONDICION_LABEL,
  PRECIO_MODO_LABEL,
  type Operacion,
  type OperacionProducto,
  type OperacionTipo,
  type PrecioModo,
} from "@/lib/operaciones/tipos";

/**
 * Formulario de carga de UNA operación (§1.24, §5.6): sirve para crear y para
 * editar — la key en el padre (`editando?.id ?? "nueva"`) remonta el componente
 * al cambiar de modo, así `useActionState` arranca limpio cada vez.
 */
export function RegistroForm({
  empresaId,
  fecha,
  campanias,
  curva,
  operacion,
  onDone,
}: {
  empresaId: string;
  fecha: string;
  campanias: string[];
  curva: GranoCurva[];
  operacion?: Operacion | null;
  onDone?: () => void;
}) {
  const esEdicion = Boolean(operacion);
  const [st, action, pend] = useActionState<OperacionFormState, FormData>(
    esEdicion ? editarOperacion : crearOperacion,
    undefined,
  );

  const [producto, setProducto] = useState<OperacionProducto>(operacion?.producto ?? "soja");
  const [tipo, setTipo] = useState<OperacionTipo>(operacion?.tipo ?? "disponible");
  const [precioModo, setPrecioModo] = useState<PrecioModo>(operacion?.precio_modo ?? "manual");
  const [volumenUnidad, setVolumenUnidad] = useState<"tn" | "kg">("tn");
  const [futuro, setFuturo] = useState<{ posicion: string; precio: number } | null>(
    operacion?.tipo === "futuro_a3" && operacion.posicion_a3
      ? { posicion: operacion.posicion_a3, precio: operacion.precio ?? 0 }
      : null,
  );

  const tieneFuturo = PRODUCTOS_CON_FUTURO.includes(producto);
  const soloManual = tipo === "fijacion" || tipo === "futuro_a3";
  // Fijación y futuro A3 siempre tienen precio manual (constraint del DDL): se
  // deriva en el render en vez de sincronizar con un efecto — evita el cascading
  // render y además preserva la elección previa del usuario si vuelve a un tipo
  // que sí admite pizarra/sin precio.
  const precioModoEfectivo: PrecioModo = soloManual ? "manual" : precioModo;

  return (
    <form action={action} className="op-form">
      {esEdicion && operacion ? (
        <input type="hidden" name="id" value={operacion.id} />
      ) : (
        <input type="hidden" name="empresa_id" value={empresaId} />
      )}

      <div className="op-form-grid">
        <label className="admin-field">
          <span>Fecha de la operación</span>
          <input type="date" name="fecha" defaultValue={operacion?.fecha ?? fecha} required className="admin-input" />
        </label>

        <fieldset className="op-lado">
          <label>
            <input type="radio" name="lado" value="compra" defaultChecked={(operacion?.lado ?? "compra") === "compra"} /> Compra
          </label>
          <label>
            <input type="radio" name="lado" value="venta" defaultChecked={operacion?.lado === "venta"} /> Venta
          </label>
        </fieldset>

        <label className="admin-field">
          <span>Producto</span>
          <select
            name="producto"
            value={producto}
            onChange={(e) => setProducto(e.target.value as OperacionProducto)}
            className="admin-input"
          >
            {PRODUCTOS.map((p) => (
              <option key={p} value={p}>
                {PRODUCTO_LABEL[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Tipo de negocio</span>
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as OperacionTipo)}
            className="admin-input"
          >
            {Object.entries(TIPO_LABEL)
              .filter(([k]) => k !== "futuro_a3" || tieneFuturo)
              .map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Condición</span>
          <select name="condicion" defaultValue={operacion?.condicion ?? ""} className="admin-input">
            <option value="">—</option>
            {Object.entries(CONDICION_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Campaña</span>
          <input
            list="op-campanias"
            name="campania"
            defaultValue={operacion?.campania ?? campanias[1] ?? ""}
            placeholder="25/26"
            required
            className="admin-input"
          />
          <datalist id="op-campanias">
            {campanias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <div className="op-vol">
          <label className="admin-field">
            <span>Volumen</span>
            <input
              type="number"
              name="volumen"
              step="0.01"
              min="0.01"
              defaultValue={operacion?.volumen_tn ?? ""}
              required
              className="admin-input"
            />
          </label>
          <label className="admin-field">
            <span>Unidad</span>
            <select
              name="volumen_unidad"
              value={volumenUnidad}
              onChange={(e) => setVolumenUnidad(e.target.value as "tn" | "kg")}
              className="admin-input"
            >
              <option value="tn">Toneladas</option>
              <option value="kg">Kilos</option>
            </select>
          </label>
        </div>

        <label className="admin-field">
          <span>Precio</span>
          <select
            name="precio_modo"
            value={precioModoEfectivo}
            onChange={(e) => setPrecioModo(e.target.value as PrecioModo)}
            className="admin-input"
          >
            {Object.entries(PRECIO_MODO_LABEL)
              .filter(([k]) => !soloManual || k === "manual")
              .map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
          </select>
        </label>

        {precioModoEfectivo === "manual" && (
          <label className="admin-field">
            <span>{tipo === "futuro_a3" ? "Precio de ejecución" : "Precio"}</span>
            <input
              type="number"
              name="precio"
              key={`precio-${futuro?.precio ?? "x"}`}
              step="0.01"
              min="0.01"
              defaultValue={operacion?.precio ?? futuro?.precio ?? ""}
              required
              className="admin-input"
            />
          </label>
        )}
        {precioModoEfectivo !== "sin_precio" && (
          <label className="admin-field">
            <span>Moneda</span>
            <select name="moneda" defaultValue={operacion?.moneda ?? "usd"} className="admin-input">
              <option value="usd">USD</option>
              <option value="ars">$</option>
            </select>
          </label>
        )}

        <label className="admin-field">
          <span>Descuento %</span>
          <input
            type="number"
            name="descuento_pct"
            step="0.01"
            min="0"
            max="100"
            defaultValue={operacion?.descuento_pct ?? ""}
            className="admin-input"
            placeholder="ej. 10"
          />
        </label>
        <label className="admin-field">
          <span>Descuento monto</span>
          <input
            type="number"
            name="descuento_monto"
            step="0.01"
            min="0"
            defaultValue={operacion?.descuento_monto ?? ""}
            className="admin-input"
            placeholder="ej. 38000 (flete)"
          />
        </label>

        {tipo === "forward" && (
          <>
            <label className="admin-field">
              <span>Entrega desde</span>
              <input
                type="date"
                name="entrega_desde"
                defaultValue={operacion?.entrega_desde ?? ""}
                required
                className="admin-input"
              />
            </label>
            <label className="admin-field">
              <span>Entrega hasta (opcional)</span>
              <input type="date" name="entrega_hasta" defaultValue={operacion?.entrega_hasta ?? ""} className="admin-input" />
            </label>
          </>
        )}

        {tipo === "futuro_a3" && tieneFuturo && (
          <div className="op-futuro">
            <CurvaPicker
              granos={curva.filter((g) => g.underlying === PRODUCTO_GRANO[producto])}
              onPick={(p) => setFuturo({ posicion: p.posicion, precio: p.precio })}
              label="Traer ajuste de A3"
            />
            <label className="admin-field">
              <span>Posición A3</span>
              <input
                type="text"
                name="posicion_a3"
                key={`pos-${futuro?.posicion ?? "x"}`}
                defaultValue={operacion?.posicion_a3 ?? futuro?.posicion ?? ""}
                placeholder="NOV26"
                required
                className="admin-input"
              />
            </label>
          </div>
        )}

        <label className="admin-field">
          <span>Contraparte (opcional)</span>
          <input type="text" name="contraparte" defaultValue={operacion?.contraparte ?? ""} className="admin-input" />
        </label>
        <label className="admin-field">
          <span>N° de contrato (opcional)</span>
          <input type="text" name="nro_contrato" defaultValue={operacion?.nro_contrato ?? ""} className="admin-input" />
        </label>
        <label className="admin-field op-obs">
          <span>Observaciones (opcional)</span>
          <textarea name="observaciones" defaultValue={operacion?.observaciones ?? ""} rows={2} className="admin-input" />
        </label>
      </div>

      <div className="op-form-foot">
        <button type="submit" className="admin-btn admin-btn-ok" disabled={pend}>
          {pend ? "Guardando…" : esEdicion ? "Guardar cambios" : "Cargar operación"}
        </button>
        {esEdicion && onDone && (
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onDone}>
            Cancelar
          </button>
        )}
        {st?.ok && <span className="op-form-ok">{st.ok}</span>}
        {st?.error && (
          <span className="op-form-err" role="alert">
            {st.error}
          </span>
        )}
      </div>
    </form>
  );
}
