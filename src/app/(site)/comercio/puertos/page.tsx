import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/dal";
import { FotoOperativaPanel } from "@/components/lineup/foto-operativa";
import { PageHead } from "@/components/page-head";

/**
 * Puertos · Line-up de buques (análisis de mesa). Protegido SIEMPRE con requireAdmin
 * (patrón /admin): aunque el login general esté apagado y la web sea pública, estos
 * análisis son solo para Lautaro y Mauro (decisión 1 del plan). Cuando se prenda el
 * login y se quiera abrir a clientes, se cambia el guard a permisos por sección.
 */
export const metadata: Metadata = {
  title: "Puertos · Line-up · ROFO AGRO",
  description: "Line-up de buques en puertos argentinos: exportaciones por producto, zona y empresa.",
  robots: { index: false, follow: false },
};

export default async function PuertosPage() {
  await requireAdmin();
  return (
    <>
      <main className="wrap">
        <div className="col">
          <PageHead kicker="Line-up físico · rueda por rueda" title="Puertos · Line-up de buques" />
          <FotoOperativaPanel />
        </div>
      </main>
    </>
  );
}
