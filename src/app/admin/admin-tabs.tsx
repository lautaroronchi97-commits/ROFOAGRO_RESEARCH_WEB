"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { href: string; label: string; badge?: "usuarios" | "interpretaciones" }[] = [
  { href: "/admin", label: "Pendientes", badge: "usuarios" },
  { href: "/admin/checklist", label: "Checklist" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/empresas", label: "Empresas" },
  { href: "/admin/actividad", label: "Actividad" },
  { href: "/admin/datos", label: "Datos" },
  { href: "/admin/interpretaciones", label: "Interpretaciones", badge: "interpretaciones" },
  { href: "/admin/conexiones", label: "Conexiones" },
];

/**
 * Nav por pestañas del panel. Client component (el layout no re-renderiza al
 * navegar): el ítem activo se resuelve con usePathname. Los badges muestran el
 * conteo de usuarios pendientes de aprobar y de borradores de interpretación
 * (MP4) esperando revisión.
 */
export function AdminTabs({ pendientes, borradoresInterp }: { pendientes: number; borradoresInterp: number }) {
  const pathname = usePathname();
  const conteos = { usuarios: pendientes, interpretaciones: borradoresInterp };

  return (
    <nav className="admin-tabs" aria-label="Secciones del panel">
      {TABS.map((t) => {
        const activo = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
        const conteo = t.badge ? conteos[t.badge] : 0;
        return (
          <Link key={t.href} href={t.href} aria-current={activo ? "page" : undefined}>
            {t.label}
            {t.badge && conteo > 0 && <span className="admin-badge">{conteo}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
