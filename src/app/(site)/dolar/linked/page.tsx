import type { Metadata } from "next";
import { DolarLinkedPanel } from "@/components/dolar-linked-panel";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Dólar linked · Dólar y tasas · ROFO AGRO",
  description: "Tipo de cambio implícito de los dólar linked y su spread contra el oficial.",
};

export default async function DolarLinkedPage() {
  await requireSeccion("dolar");
  return (
    <main className="wrap">
      <div className="col">
        <PageHead kicker="Mercado de deuda local" title="Dólar linked" lede="TC implícito de cada bono/letra linked y su spread contra el oficial mayorista." />
        <DolarLinkedPanel />
      </div>
    </main>
  );
}
