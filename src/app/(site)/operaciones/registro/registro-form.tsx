"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { crearOperacion, editarOperacion, type OperacionFormState } from "../actions";
import { CurvaPicker } from "@/components/curva-picker";
import { precioModoDeCondicion, precioMonedaSospechoso } from "@/lib/operaciones/registro";
import type { GranoCurva } from "@/lib/curva-types";
import {
  PRODUCTOS,
  PRODUCTO_LABEL,
  PRODUCTO_GRANO,
  PRODUCTOS_CON_FUTURO,
  TIPO_LABEL,
  CONDICION_LABEL,
  CONDICIONES_POR_TIPO,
  type Moneda,
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
  const [volumenUnidad, setVolumenUnidad] = useState<"tn" | "kg">("tn");
  const [entregaDesde, setEntregaDesde] = useState(base?.entrega_desde ?? "");
  const [esCanje, setEsCanje] = useState(base?.es_canje ?? false);
  const [futuro, setFuturo] = useState<{ posicion: string; precio: number } | null>(
    base?.tipo === "futuro_a3" && base.posicion_a3 ? { posicion: base.posicion_a3, precio: base.precio ?? 0 } : null,
  );

  // Guard de magnitud precio↔moneda (pedido de Lautoro 07/08/2026): "si el precio
  // es 505.000 son pesos, si es 190 son USD" — mismo criterio que `validarOperacion`
  // (`precioMonedaSospechoso`), reflejado acá para avisar ANTES de mandar el form.
  const [precioTexto, setPrecioTexto] = useState(String(base?.precio ?? futuro?.precio ?? ""));
  const [monedaSel, setMonedaSel] = useState<Moneda>(base?.moneda ?? "ars");
  const precioNum = Number(precioTexto.replace(",", "."));
  const monedaSospechosa =
    Number.isFinite(precioNum) && precioNum > 0 ? precioMonedaSospechoso(precioNum, monedaSel) : false;

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

  // Condición: qué admite el tipo elegido (pedido de Lautoro 06/08/2026,
  // CONDICIONES_POR_TIPO) — futuro A3 no usa condición (array vacío, campo
  // oculto); fijación solo pizarra/a precio; disponible/forward las 4. Se
  // deriva en el render (no un efecto): si el usuario cambia de tipo y la
  // condición ya elegida deja de ser válida, el <select> vuelve solo a "—"
  // sin romper el resto del formulario.
  const condicionesPermitidas = CONDICIONES_POR_TIPO[tipo];
  const requiereCondicion = condicionesPermitidas.length > 0;
  const condicionEfectiva: OperacionCondicion | "" =
    requiereCondicion && condicionesPermitidas.includes(condicion as OperacionCondicion) ? condicion : "";

  // El Precio ya no se elige a mano: sale de la condición (o siempre manual en
  // futuro A3, que no usa condición) — mismo criterio que `validarOperacion`.
  const precioModoEfectivo: PrecioModo | null =
    tipo === "futuro_a3" ? "manual" : condicionEfectiva ? precioModoDeCondicion(condicionEfectiva) : null;

  // Fijación: período (desde/hasta) — el "desde" sugiere el inicio de entrega
  // (forward) o la fecha de la operación (disponible, entrega inmediata); el
  // usuario lo puede editar libre. El "hasta" queda libre/abierto.
  const fijacionDesdeSugerida = tipo === "forward" ? entregaDesde : (base?.fecha ?? fecha);

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

        {requiereCondicion && (
          <label className="admin-field">
            <span>Condición</span>
            <select
              name="condicion"
              value={condicionEfectiva}
              onChange={(e) => setCondicion(e.target.value as OperacionCondicion | "")}
              required
              className="admin-input"
            >
              <option value="">—</option>
              {condicionesPermitidas.map((k) => (
                <option key={k} value={k}>
                  {CONDICION_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
        )}

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

        <div className="admin-field">
          <span>Es canje</span>
          <button
            type="button"
            className={`admin-btn ${esCanje ? "admin-btn-ok" : "admin-btn-ghost"}`}
            aria-pressed={esCanje}
            onClick={() => setEsCanje((v) => !v)}
          >
            {esCanje ? "Sí" : "No"}
          </button>
          <input type="hidden" name="es_canje" value={esCanje ? "1" : "0"} />
        </div>

        {precioModoEfectivo === "manual" && (
          <label className="admin-field">
            <span>{tipo === "futuro_a3" ? "Precio de ejecución" : "Precio base"}</span>
            <input
              type="number"
              inputMode="decimal"
              name="precio"
              key={`precio-${futuro?.precio ?? "x"}`}
              step="0.01"
              min="0.01"
              defaultValue={base?.precio ?? futuro?.precio ?? ""}
              onChange={(e) => setPrecioTexto(e.target.value)}
              required
              className="admin-input"
            />
          </label>
        )}
        {precioModoEfectivo && precioModoEfectivo !== "sin_precio" && (
          <label className="admin-field">
            <span>Moneda</span>
            <select
              name="moneda"
              defaultValue={base?.moneda ?? "ars"}
              onChange={(e) => setMonedaSel(e.target.value as Moneda)}
              className="admin-input"
            >
              <option value="ars">$</option>
              <option value="usd">USD</option>
            </select>
          </label>
        )}
        {precioModoEfectivo === "manual" && monedaSospechosa && (
          <div className="op-form-hint op-precio-alerta">
            <p>
              {monedaSel === "usd"
                ? `USD ${precioTexto} parece un precio en pesos, no en dólares.`
                : `$ ${precioTexto} parece un precio en dólares, no en pesos.`}{" "}
              Revisá la moneda o, si es correcto, confirmalo:
            </p>
            <label className="op-check">
              <input type="checkbox" name="forzar_moneda" value="1" /> Confirmo el precio y la moneda
            </label>
          </div>
        )}
        {precioModoEfectivo && precioModoEfectivo !== "sin_precio" && (
          <label className="admin-field">
            <span>Comisión %</span>
            <input
              type="number"
              inputMode="decimal"
              name="comision_pct"
              step="0.01"
              min="0"
              max="100"
              defaultValue={base?.comision_pct ?? ""}
              className="admin-input"
              placeholder="ej. comisión 1,5%"
            />
          </label>
        )}
        {precioModoEfectivo === "pizarra" && (
          <p className="op-form-hint">La pizarra se completa sola en cuanto CAC la publique (normalmente recién al día siguiente) — no hay precio para cargar hoy.</p>
        )}
        {precioModoEfectivo === "sin_precio" && (
          <p className="op-form-hint">Sin precio — se completa después, con la fijación.</p>
        )}
        {requiereCondicion && !condicionEfectiva && (
          <p className="op-form-hint">Elegí la condición para saber cómo se completa el precio.</p>
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
            placeholder="ej. pizarra -10%"
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
                value={entregaDesde}
                onChange={(e) => setEntregaDesde(e.target.value)}
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

        {condicionEfectiva === "a_fijar" && (
          <>
            <label className="admin-field">
              <span>Fijación desde</span>
              <input
                type="date"
                name="fijacion_desde"
                key={`fijdesde-${fijacionDesdeSugerida}`}
                defaultValue={base?.fijacion_desde ?? fijacionDesdeSugerida}
                required
                className="admin-input"
              />
            </label>
            <label className="admin-field">
              <span>Fijación hasta (opcional — libre si queda vacío)</span>
              <input type="date" name="fijacion_hasta" defaultValue={base?.fijacion_hasta ?? ""} className="admin-input" />
            </label>
          </>
        )}

        {tipo === "futuro_a3" && tieneFuturo && (
          <div className="op-futuro">
            <CurvaPicker
              granos={curva.filter((g) => g.underlying === PRODUCTO_GRANO[producto])}
              onPick={(p) => {
                setFuturo({ posicion: p.posicion, precio: p.precio });
                setPrecioTexto(String(p.precio));
              }}
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
