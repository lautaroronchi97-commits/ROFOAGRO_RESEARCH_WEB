import type { Metadata } from "next";
import { PanelCambiario } from "@/components/panel-cambiario";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Panel cambiario · Dólar y tasas · ROFO AGRO",
  description: "Volumen negociado en MAE y compras netas del BCRA en el MULC.",
};

export default async function CambiarioPage() {
  await requireSeccion("dolar");
  return (
    <main className="wrap">
      <div className="col">
        <PageHead kicker="MAE · BCRA" title="Panel cambiario" lede="Volumen de la rueda en MAE y compras netas del BCRA en el mercado de cambios." />
        <PanelCambiario />
      </div>
    </main>
  );
}
