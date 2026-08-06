import { getUsuarios, getEmpresas, fmtFechaHora } from "@/lib/auth/admin";
import { requireAdmin } from "@/lib/auth/dal";
import { BIBLIOTECA_PERMISOS } from "@/lib/biblioteca";
import { UsuarioRow } from "./usuario-row";

/**
 * Pantalla USUARIOS: todos los registrados con estado, empresa, rol y último login.
 * Acciones por fila: bloquear/desbloquear, cambiar de empresa, promover/degradar
 * admin y editar el override individual de secciones.
 */
export default async function UsuariosPage() {
  const admin = await requireAdmin();
  const [usuarios, empresas] = await Promise.all([getUsuarios(), getEmpresas()]);
  const opcionesEmpresa = empresas.map((e) => ({ id: e.id, nombre: e.nombre }));

  return (
    <section>
      <div className="admin-hd">
        <h1 className="admin-h1">Usuarios</h1>
        <p className="admin-sub">{usuarios.length} registrados. Permisos por sección: se heredan de la empresa salvo override individual.</p>
      </div>

      {usuarios.length === 0 ? (
        <p className="admin-empty">Todavía no hay usuarios.</p>
      ) : (
        <div className="admin-cards">
          {usuarios.map((u) => (
            <UsuarioRow
              key={u.id}
              u={{
                id: u.id,
                nombre: u.nombre,
                email: u.email,
                telefono: u.telefono,
                estado: u.estado,
                rol: u.rol,
                empresa_id: u.empresa_id,
                empresa_nombre: u.empresa_nombre,
                empresa_secciones: u.empresa_secciones,
                secciones_override: u.secciones_override,
                empresa_items: u.empresa_items,
                items_override: u.items_override,
                creado: fmtFechaHora(u.created_at),
                ultimo_login: fmtFechaHora(u.ultimo_login),
              }}
              empresas={opcionesEmpresa}
              grupos={BIBLIOTECA_PERMISOS}
              esYo={u.id === admin.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
