import type { Metadata } from "next";
import { SinteticosPanel } from "@/components/sinteticos-panel";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Sintéticos · Dólar y tasas · ROFO AGRO",
  description: "LECAPs sintéticas vs. futuro directo, con TIR (TNA act/365).",
};

export default async function SinteticosPage() {
  await requireSeccion("dolar", "/dolar/sinteticos");
  return (
    <main className="wrap">
      <div className="col">
        <PageHead kicker="BYMA · MAE" title="Sintéticos" lede="Dólar sintético desde el pago final de cada LECAP, comparado contra el futuro directo." />
        <SinteticosPanel />
      </div>
    </main>
  );
}
