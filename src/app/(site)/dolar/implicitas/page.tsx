import type { Metadata } from "next";
import { ImplicitasPanel } from "@/components/implicitas-panel";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Tasas implícitas · Dólar y tasas · ROFO AGRO",
  description: "Dólar futuro y dólar linked combinados, comparando la tasa implícita por plazo.",
};

export default async function ImplicitasPage() {
  await requireSeccion("dolar");
  return (
    <main className="wrap">
      <div className="col">
        <PageHead kicker="MAE · Mercado de deuda local" title="Tasas implícitas" lede="Futuro, linked, sintéticos y granos combinados: qué tasa te rinde más en cada plazo." />
        <ImplicitasPanel />
      </div>
    </main>
  );
}
