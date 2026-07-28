import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/dal";
import { NegociadoPanel } from "@/components/compras/negociado-panel";
import { PageHead } from "@/components/page-head";

/**
 * Comercio exterior · Negociado por producto (volumen de comercialización SIO Granos).
 * Protegido SIEMPRE con requireAdmin (patrón /admin, decisión 1 del plan de puertos):
 * análisis de mesa. Cierra los ítems 8 y 9 del backlog (total negociado por producto +
 * histograma + % sobre cosecha + SIO Granos semanal/mensual).
 */
export const metadata: Metadata = {
  title: "Negociado por producto · Comercio exterior · ROFO AGRO",
  description: "Volumen negociado por producto (SIO Granos): compras semanales, % sobre cosecha, % priceado e histograma.",
  robots: { index: false, follow: false },
};

export default async function NegociadoPage() {
  await requireAdmin();
  return (
    <>
      <main className="wrap">
        <div className="col">
          <PageHead kicker="SIO Granos · corte semanal" title="Negociado por producto" />
          <NegociadoPanel />
        </div>
      </main>
    </>
  );
}
