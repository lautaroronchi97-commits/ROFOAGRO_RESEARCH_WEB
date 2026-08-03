import Link from "next/link";
import { SECCIONES_DATOS } from "./secciones";

/**
 * Índice de /admin/datos: una tarjeta por carga manual, cada una con su propia página
 * (ver `secciones.ts` + `DatosNav`). Reemplaza el page.tsx único de antes, que mezclaba
 * las 9 cargas en una sola vista larga con anclas.
 */
export default function DatosIndexPage() {
  return (
    <section>
      <div className="admin-hd">
        <h1 className="admin-h1">Datos</h1>
        <p className="admin-sub">
          Series que se actualizan a mano (sin cron), subiendo exports de Agrochat/Williams o
          cargando un dato puntual. Elegí una carga.
        </p>
      </div>

      <div className="admin-cards">
        {SECCIONES_DATOS.map((s) => (
          <Link key={s.slug} href={`/admin/datos/${s.slug}`} className="admin-card" style={{ display: "block" }}>
            <div className="admin-card-hd">
              <h3 className="admin-card-name">{s.nombre}</h3>
              <span className="admin-card-when">{s.cadencia}</span>
            </div>
            <p className="admin-card-meta">{s.descripcion}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
