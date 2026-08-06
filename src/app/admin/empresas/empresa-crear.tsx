"use client";

import { useActionState } from "react";
import { crearEmpresa, type AdminState } from "../actions";
import { PermisosTree } from "../permisos-tree";
import type { GrupoPermiso } from "@/lib/biblioteca";

/**
 * Form para crear una empresa nueva. Las 9 secciones vienen marcadas por defecto, sin
 * restricción de ítems (el admin destilda/acota lo que no corresponda).
 */
export function EmpresaCrear({ grupos }: { grupos: GrupoPermiso[] }) {
  const [st, action, pend] = useActionState<AdminState, FormData>(crearEmpresa, undefined);

  return (
    <details className="admin-crear">
      <summary>+ Nueva empresa</summary>
      <form action={action} className="admin-crear-form">
        <label className="admin-field">
          <span>Nombre</span>
          <input className="admin-input" type="text" name="nombre" placeholder="Ej. Acopio San Martín" autoComplete="off" required />
        </label>
        <PermisosTree
          grupos={grupos}
          seccionesActivas={new Set(grupos.map((g) => g.key))}
          itemsRestringidos={{}}
        />
        <button type="submit" className="admin-btn admin-btn-ok" disabled={pend}>
          {pend ? "Creando…" : "Crear empresa"}
        </button>
        {st?.error && <p className="admin-msg admin-msg-err" role="alert">{st.error}</p>}
        {st?.ok && <p className="admin-msg admin-msg-ok">{st.ok}</p>}
      </form>
    </details>
  );
}
