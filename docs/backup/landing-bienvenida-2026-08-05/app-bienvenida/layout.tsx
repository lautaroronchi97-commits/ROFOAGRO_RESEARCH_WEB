import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { LandingTopbar } from "@/components/landing/landing-topbar";

export const metadata: Metadata = {
  title: "ROFO AGRO · Consultora de agronegocios",
  description:
    "Dejá de tomar decisiones a ciegas. Accedé a las herramientas y al criterio de una mesa de trading de granos de Rosario, con el acompañamiento de un equipo con más de 10 años de experiencia.",
};

/**
 * Layout propio de la landing institucional (ítem 3). Vive fuera del route group
 * (auth): la landing es una página de venta con scroll largo, no una tarjeta de login.
 * La URL sigue siendo `/bienvenida` (ruta pública en RUTAS_PUBLICAS).
 */
export default function BienvenidaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lp-shell">
      <LandingTopbar />
      <main id="top" className="lp-main">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
