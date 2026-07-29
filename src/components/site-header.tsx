import Link from "next/link";
import { RuedaClock } from "./rueda-clock";
import { RuedaStatus } from "./rueda-status";
import { ThemeToggle } from "./theme-toggle";
import { SidebarToggle } from "./sidebar-toggle";
import { AuthMenuLazy } from "./auth-menu-lazy";
import { AUTH_ENFORCED } from "@/lib/auth/config";

/**
 * Masthead mínimo del sitio (C25 — la nav se mudó a la sidebar): logo, hamburguesa
 * (solo mobile, abre el drawer de la sidebar), estado de rueda, tema y menú de sesión.
 */
export function SiteHeader() {
  return (
    <header className="masthead">
      <div className="masthead-in">
        <SidebarToggle />
        <Link href="/" className="brand" aria-label="ROFO AGRO — Inicio">
          {/* Isotipo real (3 símbolos: trigo, trigo y gota de soja). El wordmark va como
              texto para que siga el color del tema (claro/oscuro). eslint-disable: es un
              SVG estático cacheado desde /public, no una imagen de contenido para <Image>. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rofoagro-isotipo.svg" alt="" className="brand-iso" width={58} height={32} />
          <span className="wordmark">
            <span className="rf">ROFO</span>
            <span className="agro">AGRO</span>
          </span>
        </Link>

        <div className="head-tools">
          <span className="rueda">
            <span className="dot-live" aria-hidden="true" />
            Rueda&nbsp;·&nbsp;<RuedaClock />&nbsp;ART
          </span>
          <RuedaStatus />
          <ThemeToggle />
          {/* Menú de sesión solo cuando el login está activo; con el flag apagado el
              header queda idéntico a hoy. Carga diferida client-only (ver auth-menu-lazy.tsx)
              para no mandar el SDK de Supabase al bundle de páginas públicas sin login. */}
          {AUTH_ENFORCED && <AuthMenuLazy />}
        </div>
      </div>
    </header>
  );
}
