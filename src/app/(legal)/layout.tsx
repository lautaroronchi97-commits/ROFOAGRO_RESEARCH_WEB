import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteFooter } from "@/components/site-footer";

/**
 * Layout compartido de las páginas legales (`/privacidad`, `/terminos`): rutas
 * públicas SIEMPRE (ver `RUTAS_PUBLICAS` en `src/lib/auth/config.ts`), sin el nav
 * completo del sitio ni el de la landing — solo la marca, un link de vuelta y el
 * footer con el disclaimer que ya usa el resto de la web.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lp-shell">
      <header className="lp-nav">
        <div className="lp-nav-in">
          <Link href="/" className="brand" aria-label="ROFO AGRO — Inicio">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rofoagro-isotipo.svg" alt="" className="brand-iso" width={58} height={32} />
            <span className="wordmark">
              <span className="rf">ROFO</span>
              <span className="agro">AGRO</span>
            </span>
          </Link>
          <div className="lp-nav-tools">
            <Link href="/" className="lp-nav-ingresar">
              ← Volver a ROFO AGRO
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="lp-main">
        <div className="lp-wrap lp-narrow lp-section legal-doc">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
