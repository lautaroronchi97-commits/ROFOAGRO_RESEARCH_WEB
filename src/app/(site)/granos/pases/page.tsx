import type { Metadata } from "next";
import { PasesPanel } from "@/components/pases-panel";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Pases · Granos · ROFO AGRO",
  description: "Spread entre posiciones del mismo grano, tasa directa y TNA, con puntas en vivo durante la rueda.",
};

export default async function PasesPage() {
  await requireSeccion("granos", "/granos/pases");
  return (
    <main className="wrap">
      <div className="col">
        <PageHead kicker="Matba Rofex" title="Pases" lede="Diferencia de ajuste entre posiciones consecutivas del mismo grano, con su tasa." />
        <PasesPanel />
      </div>
    </main>
  );
}
