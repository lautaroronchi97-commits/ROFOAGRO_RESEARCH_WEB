import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/dal";
import { SemaforoPanel } from "@/components/lineup/semaforo-panel";
import { PageHead } from "@/components/page-head";

/**
 * Comercio exterior · Semáforo físico → precio (análisis de mesa). Protegido SIEMPRE
 * con requireAdmin. Cruza la demanda física de exportación (cobertura) con la
 * capacidad de pago (FAS teórico) y la pizarra.
 */
export const metadata: Metadata = {
  title: "Señal física → precio · Comercio exterior · ROFO AGRO",
  description: "Semáforo que cruza la demanda física de exportación con la capacidad de pago (FAS) y la pizarra.",
  robots: { index: false, follow: false },
};

export default async function SenalPage() {
  await requireAdmin();
  return (
    <>
      <main className="wrap">
        <div className="col">
          <PageHead kicker="Cobertura × capacidad de pago" title="Señal física → precio" />
          <SemaforoPanel />
        </div>
      </main>
    </>
  );
}
