"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { labelDeHref } from "@/lib/biblioteca";

/**
 * Migas de pan (Inicio › Sección › Subpágina). Client component: usa
 * `usePathname()` (el layout no re-renderiza al navegar). No aparece en el
 * Inicio. El último tramo no es link (es la página actual). Las etiquetas salen
 * del registro único de la biblioteca (`src/lib/biblioteca.ts`) — nada duplicado
 * a mano acá (C25).
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    return { label: labelDeHref(href) ?? seg, href, last: i === segments.length - 1 };
  });

  return (
    <nav className="crumbs" aria-label="Migas de pan">
      <Link href="/">Inicio</Link>
      {crumbs.map((c) => (
        <span key={c.href} className="crumb">
          <span className="sep" aria-hidden="true">
            ›
          </span>
          {c.last ? <span aria-current="page">{c.label}</span> : <Link href={c.href}>{c.label}</Link>}
        </span>
      ))}
    </nav>
  );
}
