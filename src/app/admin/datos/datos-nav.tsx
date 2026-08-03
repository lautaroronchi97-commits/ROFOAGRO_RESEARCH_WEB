"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECCIONES_DATOS } from "./secciones";

/**
 * Sub-nav de /admin/datos: una pestaña por página de carga (ver `secciones.ts`), más
 * "Resumen" para volver al índice. Client component (como `AdminTabs`) para resolver el
 * ítem activo con usePathname sin que el layout entero se vuelva client.
 */
export function DatosNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-subtabs" aria-label="Cargas manuales de datos">
      <Link href="/admin/datos" aria-current={pathname === "/admin/datos" ? "page" : undefined}>
        Resumen
      </Link>
      {SECCIONES_DATOS.map((s) => {
        const href = `/admin/datos/${s.slug}`;
        return (
          <Link key={s.slug} href={href} aria-current={pathname === href ? "page" : undefined}>
            {s.nombre}
          </Link>
        );
      })}
    </nav>
  );
}
