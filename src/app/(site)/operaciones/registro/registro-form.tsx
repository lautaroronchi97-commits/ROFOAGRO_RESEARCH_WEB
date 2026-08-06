"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
  type OperacionCondicion,
  type OperacionProducto,
  type OperacionTipo,
  type PrecioModo,
} from "@/lib/operaciones/tipos";

/**
 * Formulario de carga de UNA operación (§1.24, §5.6): sirve para crear, para
 * editar y para DUPLICAR (mejora 06/08/2026: `plantilla` prellena una creación
 * con los datos de una operación existente — carga en serie de negocios
 * parecidos sin retipear todo). La key en el padre (`editando?.id ?? ...`)
 * remonta el componente al cambiar de modo, así `useActionState` arranca
 * limpio cada vez.
 */
export function RegistroForm({
  empresaId,
  fecha,
  campanias,
  curva,
  operacion,
  plantilla,
  onDone,
}: {
  empresaId: string;
  fecha: string;
  campanias: string[];
  curva: GranoCurva[];
  operacion?: Operacion | null;
  /** Solo para crear: operación existente cuyos datos se copian como valores iniciales. */
  plantilla?: Operacion | null;
  onDone?: () => void;
}) {
  const esEdicion = Boolean(operacion);
  // Base de los valores iniciales: la operación en edición, o la plantilla al duplicar.
  const base = operacion ?? plantilla ?? null;
  const [st, action, pend] = useActionState<OperacionFormState, FormData>(
    esEdicion ? editarOperacion : crearOperacion,
    undefined,
  );

  const [producto, setProducto] = useState<OperacionProducto>(base?.producto ?? "soja");
  const [tipo, setTipo] = useState<OperacionTipo>(base?.tipo ?? "disponible");
  const [condicion, setCondicion] = useState<OperacionCondicion | "">(base?.condicion ?? "");
  const [precioModo, setPrecioModo] = useState<PrecioModo>(base?.precio_modo ?? "manual");
  const [volumenUnidad, setVolumenUnidad] = useState<"tn" | "kg">("tn");
  const [futuro, setFuturo] = useState<{ posicion: string; precio: number } | null>(
    base?.tipo === "futuro_a3" && base.posicion_a3 ? { posicion: base.posicion_a3, precio: base.precio ?? 0 } : null,
  );

  // Carga en serie (mejora 06/08/2026): tras guardar una creación, limpiar SOLO
  // los campos propios de esa operación puntual (volumen y libres) y volver el
  // foco al volumen — producto/tipo/condición/campaña/precio quedan como están
  // para cargar el siguiente negocio parecido sin retipear. Además, con el
  // volumen vacío (required) un doble click en "Cargar" ya no puede duplicar
  // la operación recién guardada.
  const formRef = useRef<HTMLFormElement>(null);
  // `st` es un objeto nuevo por cada guardado exitoso; el ref evita re-disparar
  // la limpieza si el efecto vuelve a correr por otra dependencia (ej. un
  // re-render del padre le cambia la identidad a `onDone`) con el MISMO `st`.
  const ultimoOk = useRef<OperacionFormState>(undefined);
  useEffect(() => {
    if (!st?.ok || st === ultimoOk.current) return;
    ultimoOk.current = st;
    if (esEdicion) {
      onDone?.(); // edición guardada: volver al modo carga (la fila de abajo ya muestra el cambio)
      return;
    }
    const form = formRef.current;
    if (!form) return;
    for (const name of ["volumen", "contraparte", "nro_contrato", "observaciones"]) {
      const el = form.elements.namedItem(name);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = "";
    }
    const vol = form.elements.namedItem("volumen");
    if (vol instanceof HTMLInputElement) vol.focus();
  }, [st, esEdicion, onDone]);

  const tieneFuturo = PRODUCTOS_CON_FUTURO.includes(producto);
  const soloManual = tipo === "fijacion" || tipo === "futuro_a3";
  // Condición "a fijar" en un físico ⇒ SIEMPRE "sin precio" (pedido de Lautaro
  // 06/08/2026: el precio llega después, con la fijación) — espejo de la regla
  // de `validarOperacion`.
  const soloSinPrecio = !soloManual && condicion === "a_fijar";
  // Fijación y futuro A3 siempre tienen precio manual (constraint del DDL): se
  // deriva en el render en vez de sincronizar con un efecto — evita el cascading
  // render y además preserva la elección previa del usuario si vuelve a un tipo
  // que sí admite pizarra/sin precio.
  const precioModoEfectivo: PrecioModo = soloManual ? "manual" : soloSinPrecio ? "sin_precio" : precioModo;

  return (
    <form ref={formRef} action={action} className="op-form">
      {(esEdicion || plantilla) && (
        <p className="op-form-modo">
          {esEdicion
            ? "Editando una operación ya cargada — guardá los cambios o cancelá."
            : "Duplicando una operación — revisá los datos, ajustá lo que cambie y cargala."}
        </p>
      )}
      {esEdicion && operacion ? (
        <input type="hidden" name="id" value={operacion.id} />
      ) : (
        <input type="hidden" name="empresa_id" value={empresaId} />
      )}

      <div className="op-form-grid">
        <label className="admin-field">
          <span>Fecha de la operación</span>
          <input type="date" name="fecha" defaultValue={base?.fecha ?? fecha} required className="admin-input" />
        </label>

        <fieldset className="op-lado">
          <label>
            <input type="radio" name="lado" value="compra" defaultChecked={(base?.lado ?? "compra") === "compra"} /> Compra
          </label>
          <label>
            <input type="radio" name="lado" value="venta" defaultChecked={base?.lado === "venta"} /> Venta
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
          <select
            name="condicion"
            value={condicion}
            onChange={(e) => setCondicion(e.target.value as OperacionCondicion | "")}
            className="admin-input"
          >
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
            defaultValue={base?.campania ?? campanias[1] ?? ""}
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
              inputMode="decimal"
              name="volumen"
              step="0.01"
              min="0.01"
              defaultValue={base?.volumen_tn ?? ""}
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
              .filter(([k]) => (soloManual ? k === "manual" : soloSinPrecio ? k === "sin_precio" : true))
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
              inputMode="decimal"
              name="precio"
              key={`precio-${futuro?.precio ?? "x"}`}
              step="0.01"
              min="0.01"
              defaultValue={base?.precio ?? futuro?.precio ?? ""}
              required
              className="admin-input"
            />
          </label>
        )}
        {precioModoEfectivo !== "sin_precio" && (
          <label className="admin-field">
            <span>Moneda</span>
            <select name="moneda" defaultValue={base?.moneda ?? "usd"} className="admin-input">
              <option value="usd">USD</option>
              <option value="ars">$</option>
            </select>
          </label>
        )}

        <label className="admin-field">
          <span>Descuento %</span>
          <input
            type="number"
            inputMode="decimal"
            name="descuento_pct"
            step="0.01"
            min="0"
            max="100"
            defaultValue={base?.descuento_pct ?? ""}
            className="admin-input"
            placeholder="ej. 10"
          />
        </label>
        <label className="admin-field">
          <span>Descuento monto</span>
          <input
            type="number"
            inputMode="decimal"
            name="descuento_monto"
            step="0.01"
            min="0"
            defaultValue={base?.descuento_monto ?? ""}
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
                defaultValue={base?.entrega_desde ?? ""}
                required
                className="admin-input"
              />
            </label>
            <label className="admin-field">
              <span>Entrega hasta (opcional)</span>
              <input type="date" name="entrega_hasta" defaultValue={base?.entrega_hasta ?? ""} className="admin-input" />
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
                defaultValue={base?.posicion_a3 ?? futuro?.posicion ?? ""}
                placeholder="NOV26"
                required
                className="admin-input"
              />
            </label>
          </div>
        )}

        <label className="admin-field">
          <span>Contraparte (opcional)</span>
          <input type="text" name="contraparte" defaultValue={base?.contraparte ?? ""} className="admin-input" />
        </label>
        <label className="admin-field">
          <span>N° de contrato (opcional)</span>
          <input type="text" name="nro_contrato" defaultValue={base?.nro_contrato ?? ""} className="admin-input" />
        </label>
        <label className="admin-field op-obs">
          <span>Observaciones (opcional)</span>
          <textarea name="observaciones" defaultValue={base?.observaciones ?? ""} rows={2} className="admin-input" />
        </label>
      </div>

      <div className="op-form-foot">
        <button type="submit" className="admin-btn admin-btn-ok" disabled={pend}>
          {pend ? "Guardando…" : esEdicion ? "Guardar cambios" : "Cargar operación"}
        </button>
        {(esEdicion || plantilla) && onDone && (
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onDone}>
            {esEdicion ? "Cancelar" : "Limpiar formulario"}
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
