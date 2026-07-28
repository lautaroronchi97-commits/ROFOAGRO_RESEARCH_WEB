"use client";

import { useSidebarShell } from "./sidebar-provider";

/** Botón hamburguesa del masthead — solo visible en mobile (CSS, ver .sidebar-toggle). */
export function SidebarToggle() {
  const { open, toggle } = useSidebarShell();
  return (
    <button
      type="button"
      className="sidebar-toggle"
      aria-expanded={open}
      aria-controls="sidebar-nav"
      aria-label={open ? "Cerrar el menú" : "Abrir el menú"}
      onClick={toggle}
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
        <path d="M3 5.5h14M3 10h14M3 14.5h14" />
      </svg>
    </button>
  );
}
