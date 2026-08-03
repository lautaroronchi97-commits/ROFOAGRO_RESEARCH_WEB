"use client";

import { useActionState, useState } from "react";
import {
  alternarBloqueo,
  alternarRol,
  aprobarUsuario,
  cambiarEmpresa,
  cerrarSesionesUsuario,
  guardarOverride,
  type AdminState,
} from "../actions";

type Usuario = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  estado: "pendiente" | "aprobado" | "rechazado" | "bloqueado";
  rol: "cliente" | "admin";
  empresa_id: string | null;
  empresa_nombre: string | null;
  empresa_secciones: string[] | null;
  secciones_override: string[] | null;
  creado: string;
  ultimo_login: string;
};

const ESTADO_LABEL: Record<Usuario["estado"], string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  bloqueado: "Bloqueado",
};

function Mensaje({ st }: { st: AdminState }) {
  if (st?.error) return <p className="admin-msg admin-msg-err" role="alert">{st.error}</p>;
  if (st?.ok) return <p className="admin-msg admin-msg-ok">{st.ok}</p>;
  return null;
}

/**
 * Fila de un usuario en el panel. Cada control es su propia mini-form con feedback
 * inline (useActionState). El editor de override deja elegir entre "hereda de la
 * empresa" o secciones individuales.
 */
export function UsuarioRow({
  u,
  empresas,
  secciones,
  esYo,
}: {
  u: Usuario;
  empresas: { id: string; nombre: string }[];
  secciones: { key: string; label: string }[];
  esYo: boolean;
}) {
  const [stBloq, accBloq, pBloq] = useActionState<AdminState, FormData>(alternarBloqueo, undefined);
  const [stApr, accApr, pApr] = useActionState<AdminState, FormData>(aprobarUsuario, undefined);
  const [stRol, accRol, pRol] = useActionState<AdminState, FormData>(alternarRol, undefined);
  const [stEmp, accEmp, pEmp] = useActionState<AdminState, FormData>(cambiarEmpresa, undefined);
  const [stSes, accSes, pSes] = useActionState<AdminState, FormData>(cerrarSesionesUsuario, undefined);
  const [stOv, accOv, pOv] = useActionState<AdminState, FormData>(guardarOverride, undefined);

  const usaOverride = u.secciones_override != null;
  const [override, setOverride] = useState(usaOverride);
  const seleccionadas = new Set(u.secciones_override ?? u.empresa_secciones ?? []);

  return (
    <article className="admin-card">
      <div className="admin-card-hd">
        <div>
          <h3 className="admin-card-name">
            {u.nombre || "(sin nombre)"}
            {esYo && <span className="admin-yo"> · vos</span>}
          </h3>
          <p className="admin-card-meta">
            {u.email}
            {u.telefono ? ` · ${u.telefono}` : ""}
          </p>
        </div>
        <div className="admin-chips">
          <span className={`admin-chip estado-${u.estado}`}>{ESTADO_LABEL[u.estado]}</span>
          {u.rol === "admin" && <span className="admin-chip rol-admin">Admin</span>}
        </div>
      </div>

      <div className="admin-card-facts">
        <span>Empresa: <b>{u.empresa_nombre ?? "—"}</b></span>
        <span>Alta: {u.creado}</span>
        <span>Último ingreso: {u.ultimo_login}</span>
        <span>
          Permisos:{" "}
          <b>{usaOverride ? "individuales" : "heredados de la empresa"}</b>
        </span>
      </div>

      <div className="admin-controls">
        {/* Estado: bloquear / desbloquear */}
        <form action={accBloq}>
          <input type="hidden" name="userId" value={u.id} />
          <input type="hidden" name="accion" value={u.estado === "bloqueado" ? "desbloquear" : "bloquear"} />
          <button
            type="submit"
            className={`admin-btn ${u.estado === "bloqueado" ? "admin-btn-ok" : "admin-btn-warn"}`}
            disabled={pBloq}
          >
            {u.estado === "bloqueado" ? "Desbloquear" : "Bloquear"}
          </button>
        </form>

        {/* Rol: promover / degradar */}
        <form action={accRol}>
          <input type="hidden" name="userId" value={u.id} />
          <input type="hidden" name="accion" value={u.rol === "admin" ? "degradar" : "promover"} />
          <button type="submit" className="admin-btn admin-btn-ghost" disabled={pRol || (esYo && u.rol === "admin")}>
            {u.rol === "admin" ? "Quitar admin" : "Hacer admin"}
          </button>
        </form>

        {/* Empresa */}
        <form action={accEmp} className="admin-inline-form">
          <input type="hidden" name="userId" value={u.id} />
          <select name="empresa_id" className="admin-input admin-input-sm" defaultValue={u.empresa_id ?? ""}>
            <option value="">— Sin empresa —</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
          <button type="submit" className="admin-btn admin-btn-ghost" disabled={pEmp}>
            Cambiar
          </button>
        </form>

        {/* Sesión única: forzar re-login en todos sus dispositivos */}
        <form action={accSes}>
          <input type="hidden" name="userId" value={u.id} />
          <button type="submit" className="admin-btn admin-btn-warn" disabled={pSes}>
            Cerrar sesión
          </button>
        </form>
      </div>

      {/* Reactivar: un rechazado no tiene otra forma de volver a 'aprobado' (el toggle
          de arriba solo mueve bloqueado<->aprobado) — mismo flujo que aprobar un
          pendiente, porque nunca llegó a tener empresa asignada. */}
      {u.estado === "rechazado" && (
        <form action={accApr} className="admin-aprobar">
          <input type="hidden" name="userId" value={u.id} />
          <label className="admin-field">
            <span>Reactivar: asignar a empresa existente</span>
            <select name="empresa_id" className="admin-input" defaultValue="">
              <option value="">— Elegir empresa —</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>…o crear una nueva</span>
            <input className="admin-input" type="text" name="empresa_nueva" placeholder="Nombre de la empresa" autoComplete="off" />
          </label>
          <div className="admin-card-acciones">
            <button type="submit" className="admin-btn admin-btn-ok" disabled={pApr}>
              {pApr ? "Reactivando…" : "Reactivar (aprobar)"}
            </button>
          </div>
          <Mensaje st={stApr} />
        </form>
      )}

      {/* Override de secciones */}
      <details className="admin-override">
        <summary>Permisos por sección</summary>
        <form action={accOv} className="admin-override-form">
          <input type="hidden" name="userId" value={u.id} />
          <label className="admin-check admin-check-strong">
            <input
              type="checkbox"
              name="usar_override"
              checked={override}
              onChange={(e) => setOverride(e.target.checked)}
            />
            <span>Usar permisos individuales (si no, hereda los de la empresa)</span>
          </label>
          <div className={`admin-secciones ${override ? "" : "is-disabled"}`}>
            {secciones.map((s) => (
              <label key={s.key} className="admin-check">
                <input
                  type="checkbox"
                  name="secciones"
                  value={s.key}
                  defaultChecked={seleccionadas.has(s.key)}
                  disabled={!override}
                />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
          <button type="submit" className="admin-btn admin-btn-ok" disabled={pOv}>
            {pOv ? "Guardando…" : "Guardar permisos"}
          </button>
        </form>
      </details>

      <Mensaje st={stBloq} />
      <Mensaje st={stRol} />
      <Mensaje st={stEmp} />
      <Mensaje st={stSes} />
      <Mensaje st={stOv} />
    </article>
  );
}
