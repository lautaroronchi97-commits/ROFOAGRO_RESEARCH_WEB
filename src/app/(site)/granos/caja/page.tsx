import type { Metadata } from "next";
import { MejorCajaPanel } from "@/components/mejor-caja-panel";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Mejor para hacer caja · Granos · ROFO AGRO",
  description: "Ranking de soja, maíz y trigo por la menor tasa implícita disponible.",
};

export default async function CajaPage() {
  await requireSeccion("granos");
  return (
    <main className="wrap">
      <div className="col">
        <PageHead kicker="Matba Rofex" title="Mejor para hacer caja" lede="Qué grano conviene vender hoy, según la menor tasa implícita entre posiciones." />
        <MejorCajaPanel />
      </div>
    </main>
  );
}
