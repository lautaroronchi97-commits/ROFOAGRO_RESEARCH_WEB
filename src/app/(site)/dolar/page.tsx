import type { Metadata } from "next";
import { DolarFuturoPanel } from "@/components/dolar-futuro-panel";
import { DolarLinkedPanel } from "@/components/dolar-linked-panel";
import { ImplicitasPanel } from "@/components/implicitas-panel";
import { SinteticosPanel } from "@/components/sinteticos-panel";
import { PanelCambiario } from "@/components/panel-cambiario";
import { DolarOficialPanel } from "@/components/dolar-oficial-panel";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Dólar y tasas · ROFO AGRO",
  description:
    "Dólar futuro, dólar linked, tasas implícitas, sintéticos y el panel cambiario del día.",
};

export default async function DolarPage() {
  await requireSeccion("dolar");
  return (
    <>
      <main className="wrap">
        <div className="col">
          <PageHead kicker="MAE · MEP · futuros · LECAPs" title="Dólar y tasas" lede="Dólar futuro y linked, tasas implícitas, sintéticos y el panel cambiario." />
          <DolarFuturoPanel />
          <DolarOficialPanel />
          <DolarLinkedPanel />
          <ImplicitasPanel />
          <SinteticosPanel />
          <PanelCambiario />
        </div>
      </main>
    </>
  );
}
