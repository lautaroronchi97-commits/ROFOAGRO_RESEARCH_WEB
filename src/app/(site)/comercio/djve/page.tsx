import type { Metadata } from "next";
import { DjvePanel } from "@/components/djve-panel";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "DJVE · Comercio exterior · ROFO AGRO",
  description: "Declaraciones juradas de venta al exterior (DJVE) de granos y subproductos.",
};

export default async function DjvePage() {
  await requireSeccion("comercio", "/comercio/djve");
  return (
    <main className="wrap">
      <div className="col">
        <PageHead kicker="SAGyP" title="DJVE" lede="Toneladas declaradas de venta al exterior, por producto." />
        <DjvePanel />
      </div>
    </main>
  );
}
