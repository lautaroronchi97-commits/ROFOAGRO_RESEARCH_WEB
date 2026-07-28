import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/dal";
import { TemperaturaPanel } from "@/components/lineup/temperatura-panel";
import { PageHead } from "@/components/page-head";

/**
 * Comercio exterior · Calor de mercadería (índice MESA). Protegido SIEMPRE con
 * requireAdmin (patrón /admin, decisión 1 del plan de puertos). Semáforo por
 * producto: qué grano está caliente (diferir) y cuál pesado (vender ya).
 */
export const metadata: Metadata = {
  title: "Calor de mercadería · Comercio exterior · ROFO AGRO",
  description: "Índice MESA de temperatura por producto: presión física (gap de cobertura + line-up) a percentil estacional.",
  robots: { index: false, follow: false },
};

export default async function TemperaturaPage() {
  await requireAdmin();
  return (
    <>
      <main className="wrap">
        <div className="col">
          <PageHead kicker="Índice MESA · percentiles estacionales" title="Calor de mercadería" />
          <TemperaturaPanel />
        </div>
      </main>
    </>
  );
}
