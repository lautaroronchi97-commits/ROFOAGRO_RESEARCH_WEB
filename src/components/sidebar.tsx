"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { seccionDeRuta } from "@/lib/auth/config";
import type { BibGrupo, BibItem } from "@/lib/biblioteca";
import { useSidebarShell } from "./sidebar-provider";

const LS_KEY = "rofoagro-sidebar-abiertos";

function leerAbiertosGuardados(): string[] {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function guardarAbiertos(keys: Set<string>) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify([...keys]));
  } catch {
    /* localStorage no disponible (privado/bloqueado) — el estado sigue en memoria. */
  }
}

function Chevron() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4.5 6 7.5 9 4.5" />
    </svg>
  );
}

/**
 * Marca como "activo" solo el PRIMER ítem cuyo pathname (sin query) coincide con la
 * ruta actual — cubre el único caso de dos ítems al mismo pathname (Gráficos: Campañas
 * `/graficos` y Período `/graficos?mc=periodo`) sin necesitar `useSearchParams()` (que
 * forzaría un boundary de Suspense en el layout compartido de TODAS las páginas).
 */
function marcarActivos(items: BibItem[], pathname: string): boolean[] {
  const usados = new Set<string>();
  return items.map((it) => {
    const path = it.href.split("?")[0]!;
    if (path !== pathname || usados.has(path)) return false;
    usados.add(path);
    return true;
  });
}

export function Sidebar({
  grupos,
  esAdmin,
  adminItems,
}: {
  grupos: BibGrupo[];
  esAdmin: boolean;
  adminItems: BibItem[];
}) {
  const pathname = usePathname();
  const { open, close } = useSidebarShell();
  const navRef = useRef<HTMLElement>(null);
  const grupoActivo = seccionDeRuta(pathname);
  const enAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  // Grupos que el usuario abrió/cerró a mano. El grupo (o Admin) de la ruta activa se
  // suma en el render — abajo, `expandido`/`expandidoAdmin` — en vez de sincronizarlo acá
  // con un efecto: es puro derivado de `pathname`, no un dato externo que haya que traer.
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set());

  // Tras montar, reemplazar por lo que quedó abierto en una visita anterior
  // (localStorage — un dato externo real, no algo derivable en el render).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAbiertos(new Set(leerAbiertosGuardados()));
  }, []);

  function toggleGrupo(key: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      guardarAbiertos(next);
      return next;
    });
  }

  // Foco atrapado + Escape mientras el drawer mobile está abierto.
  useEffect(() => {
    if (!open) return;
    const nav = navRef.current;
    if (!nav) return;
    const focusables = Array.from(nav.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
    focusables[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab" || focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return (
    <>
      <aside className="sidebar" data-open={open}>
        <nav className="sidebar-nav" id="sidebar-nav" aria-label="Secciones" ref={navRef}>
          {/* Solo visible en el drawer mobile (CSS) — en desktop el hamburguesa queda
              tapado por la propia sidebar mientras está abierta, así que el cierre
              necesita un botón adentro (además de Escape y el click en el fondo). */}
          <button type="button" className="sb-close" onClick={close} aria-label="Cerrar el menú">
            ×
          </button>
          <Link href="/" className="sb-inicio" aria-current={pathname === "/" ? "page" : undefined}>
            Inicio
          </Link>

          {grupos.map((g) => {
            // El grupo de la ruta activa siempre queda expandido (no se auto-colapsa
            // al navegar) — derivado en el render, sin sincronizar estado con un efecto.
            const expandido = abiertos.has(g.key) || grupoActivo === g.key;
            const activos = marcarActivos(g.items, pathname);
            const items = g.items.filter((it) => !it.soloMesa || esAdmin);
            return (
              <div className="sb-grupo" key={g.key}>
                <div className="sb-grupo-hd">
                  <Link href={g.href} className="sb-grupo-link" aria-current={pathname === g.href ? "page" : undefined}>
                    {g.label}
                  </Link>
                  {items.length > 0 && (
                    <button
                      type="button"
                      className="sb-grupo-toggle"
                      aria-expanded={expandido}
                      aria-controls={`sb-items-${g.key}`}
                      aria-label={`${expandido ? "Colapsar" : "Expandir"} ${g.label}`}
                      onClick={() => toggleGrupo(g.key)}
                    >
                      <Chevron />
                    </button>
                  )}
                </div>
                {items.length > 0 && expandido && (
                  <ul className="sb-items" id={`sb-items-${g.key}`}>
                    {items.map((it) => {
                      const idx = g.items.indexOf(it);
                      return (
                        <li key={it.href}>
                          <Link href={it.href} aria-current={activos[idx] ? "page" : undefined}>
                            {it.label}
                            {it.soloMesa && (
                              <span className="sb-lock" title="Solo mesa" aria-hidden="true">🔒</span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}

          {esAdmin && adminItems.length > 0 && (() => {
            const expandidoAdmin = abiertos.has("admin") || enAdmin;
            return (
              <div className="sb-grupo sb-grupo-admin">
                <div className="sb-grupo-hd">
                  <Link href="/admin" className="sb-grupo-link" aria-current={pathname === "/admin" ? "page" : undefined}>
                    Admin <span className="sb-lock" aria-hidden="true">🔒</span>
                  </Link>
                  <button
                    type="button"
                    className="sb-grupo-toggle"
                    aria-expanded={expandidoAdmin}
                    aria-controls="sb-items-admin"
                    aria-label={`${expandidoAdmin ? "Colapsar" : "Expandir"} Admin`}
                    onClick={() => toggleGrupo("admin")}
                  >
                    <Chevron />
                  </button>
                </div>
                {expandidoAdmin && (
                  <ul className="sb-items" id="sb-items-admin">
                    {adminItems.map((it) => (
                      <li key={it.href}>
                        <Link href={it.href} aria-current={pathname === it.href ? "page" : undefined}>
                          {it.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}
        </nav>
      </aside>
      {open && <div className="sidebar-backdrop" onClick={close} aria-hidden="true" />}
    </>
  );
}
