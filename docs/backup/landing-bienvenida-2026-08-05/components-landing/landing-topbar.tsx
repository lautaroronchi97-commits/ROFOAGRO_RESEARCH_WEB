import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Barra superior fija de la landing institucional. Marca + anclas a las secciones +
 * botón Ingresar (clientes con cuenta) + CTA a #contacto. En mobile se ocultan las
 * anclas (queda logo + CTA + tema). Server component: las anclas son `<a href="#">`
 * y no necesitan JS.
 */
export function LandingTopbar() {
  return (
    <header className="lp-nav">
      <div className="lp-nav-in">
        <a href="#top" className="brand" aria-label="ROFO AGRO — Inicio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rofoagro-isotipo.svg" alt="" className="brand-iso" width={58} height={32} />
          <span className="wordmark">
            <span className="rf">ROFO</span>
            <span className="agro">AGRO</span>
          </span>
        </a>

        <nav className="lp-nav-links" aria-label="Secciones">
          <a href="#servicios">Servicios</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#por-que">Por qué ROFO AGRO</a>
          <a href="#preguntas">Preguntas</a>
        </nav>

        <div className="lp-nav-tools">
          <Link href="/ingresar" className="lp-nav-ingresar">
            Ingresar
          </Link>
          <a href="#contacto" className="auth-btn auth-btn-primary lp-nav-cta">
            Quiero asesoramiento
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
