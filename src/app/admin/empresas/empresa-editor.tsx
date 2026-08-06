"use client";

import { useActionState } from "react";
import { guardarEmpresa, type AdminState } from "../actions";
import { PermisosTree } from "../permisos-tree";
import type { GrupoPermiso } from "@/lib/biblioteca";

type Empresa = {
  id: string;
  nombre: string;
  secciones: string[];
  items: Record<string, string[]>;
  n_usuarios: number;
};

/**
 * Editor de una empresa: renombrar + tildar las secciones habilitadas y, dentro de
 * cada una, qué ítems concretos ve (permisos por ítem, 06/08/2026). Guardar impacta
 * de inmediato en los usuarios que heredan de esta empresa.
 */
export function EmpresaEditor({
  empresa,
  grupos,
}: {
  empresa: Empresa;
  grupos: GrupoPermiso[];
}) {
  const [st, action, pend] = useActionState<AdminState, FormData>(guardarEmpresa, undefined);

  return (
    <article className="admin-card">
      <div className="admin-card-hd">
        <h3 className="admin-card-name">{empresa.nombre}</h3>
        <span className="admin-card-when">{empresa.n_usuarios} usuario{empresa.n_usuarios === 1 ? "" : "s"}</span>
      </div>

      <form action={action} className="admin-crear-form">
        <input type="hidden" name="empresa_id" value={empresa.id} />
        <label className="admin-field">
          <span>Nombre</span>
          <input className="admin-input" type="text" name="nombre" defaultValue={empresa.nombre} autoComplete="off" required />
        </label>
        <PermisosTree
          grupos={grupos}
          seccionesActivas={new Set(empresa.secciones)}
          itemsRestringidos={empresa.items}
        />
        <button type="submit" className="admin-btn admin-btn-ok" disabled={pend}>
          {pend ? "Guardando…" : "Guardar"}
        </button>
        {st?.error && <p className="admin-msg admin-msg-err" role="alert">{st.error}</p>}
        {st?.ok && <p className="admin-msg admin-msg-ok">{st.ok}</p>}
      </form>
    </article>
  );
}
