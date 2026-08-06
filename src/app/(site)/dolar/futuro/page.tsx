import type { Metadata } from "next";
import { DolarFuturoPanel } from "@/components/dolar-futuro-panel";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Dólar futuro · Dólar y tasas · ROFO AGRO",
  description: "Curva de futuros de dólar MAE con TNA, TEA y TEM contra el oficial mayorista.",
};

export default async function DolarFuturoPage() {
  await requireSeccion("dolar", "/dolar/futuro");
  return (
    <main className="wrap">
      <div className="col">
        <PageHead kicker="MAE" title="Dólar futuro" lede="Curva de futuros contra el oficial mayorista, con TNA, TEA y TEM." />
        <DolarFuturoPanel />
      </div>
    </main>
  );
}
