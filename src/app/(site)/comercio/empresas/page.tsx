import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/dal";
import { EmpresasPanel } from "@/components/lineup/empresas-panel";
import { PageHead } from "@/components/page-head";

/**
 * Comercio exterior · Empresas exportadoras (análisis de mesa). Protegido SIEMPRE
 * con requireAdmin (patrón /admin, decisión 1 del plan de puertos): solo Lautaro y
 * Mauro. Cruza DJVE (declarado) con line-up (originado) por exportador.
 */
export const metadata: Metadata = {
  title: "Empresas exportadoras · Comercio exterior · ROFO AGRO",
  description: "Cobertura de las empresas exportadoras: DJVE declarada vs line-up originado, avance de campaña y ritmo.",
  robots: { index: false, follow: false },
};

export default async function EmpresasPage() {
  await requireAdmin();
  return (
    <>
      <main className="wrap">
        <div className="col">
          <PageHead kicker="DJVE × line-up · por exportador" title="Empresas exportadoras" />
          <EmpresasPanel />
        </div>
      </main>
    </>
  );
}
