import type { Metadata } from "next";
import { CapacidadPanel } from "@/components/capacidad-panel";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Capacidad de pago · Granos · ROFO AGRO",
  description: "FAS teórico de BCR, el modelo propio y la pizarra, lado a lado, con supuestos editables.",
};

export default async function CapacidadPage() {
  await requireSeccion("granos");
  return (
    <main className="wrap">
      <div className="col">
        <PageHead kicker="BCR · SAGyP" title="Capacidad de pago" lede="FAS teórico de BCR, el modelo propio (FOB oficial) y la pizarra, con supuestos editables." />
        <CapacidadPanel />
      </div>
    </main>
  );
}
