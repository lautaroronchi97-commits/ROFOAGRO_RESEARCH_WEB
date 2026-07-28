import type { Metadata } from "next";
import { DolarOficialPanel } from "@/components/dolar-oficial-panel";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Dólar oficial · Dólar y tasas · ROFO AGRO",
  description: "Dólar mayorista A3500 y su variación semanal, con volatilidad histórica.",
};

export default async function DolarOficialPage() {
  await requireSeccion("dolar");
  return (
    <main className="wrap">
      <div className="col">
        <PageHead kicker="BCRA · A3500" title="Dólar oficial" lede="Mayorista del día, variación semanal y volatilidad histórica." />
        <DolarOficialPanel />
      </div>
    </main>
  );
}
