import { getEmpresas } from "@/lib/auth/admin";
import { BIBLIOTECA_PERMISOS } from "@/lib/biblioteca";
import { EmpresaEditor } from "./empresa-editor";
import { EmpresaCrear } from "./empresa-crear";

/**
 * Pantalla EMPRESAS: crear/renombrar y editar los permisos por sección — entera o por
 * ítem suelto dentro de ella (06/08/2026, ej. solo algunas calculadoras). Los usuarios
 * de una empresa heredan estos permisos (salvo override individual). Muestra cuántos
 * usuarios tiene cada una.
 */
export default async function EmpresasPage() {
  const empresas = await getEmpresas();

  return (
    <section>
      <div className="admin-hd">
        <h1 className="admin-h1">Empresas</h1>
        <p className="admin-sub">
          Las secciones marcadas son las que ven los usuarios de cada empresa — desplegá una sección
          para elegir qué reportes/calculadoras puntuales ve, en vez de la sección entera.
        </p>
      </div>

      <EmpresaCrear grupos={BIBLIOTECA_PERMISOS} />

      {empresas.length === 0 ? (
        <p className="admin-empty">Todavía no hay empresas. Creá la primera arriba.</p>
      ) : (
        <div className="admin-cards">
          {empresas.map((e) => (
            <EmpresaEditor
              key={e.id}
              empresa={{
                id: e.id,
                nombre: e.nombre,
                secciones: e.secciones,
                items: e.items,
                n_usuarios: Number(e.n_usuarios),
              }}
              grupos={BIBLIOTECA_PERMISOS}
            />
          ))}
        </div>
      )}
    </section>
  );
}
