import type { Metadata } from "next";
import { EstimacionesPanel } from "@/components/estimaciones-panel";
import { QueEsEsto } from "@/components/que-es-esto";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

export const metadata: Metadata = {
  title: "Estimaciones · Producción · ROFO AGRO",
  description:
    "Última estimación de producción por organismo, país y grano, con la evolución de cada campaña y la lectura de la mesa.",
  robots: { index: false, follow: false },
};

export const revalidate = 3600;

export default async function EstimacionesProduccionPage() {
  await requireSeccion("produccion", "/produccion/estimaciones");
  return (
    <main className="wrap">
      <div className="col">
        <PageHead
          kicker="USDA · CONAB · BCR · SAGyP · BCBA"
          title="Estimaciones"
          lede="Producción, área y rinde por país y grano, con el cambio vs. la publicación anterior."
        />
        <QueEsEsto
          paraQue="Muestra cuánto proyecta cada organismo que se va a producir de cada grano en cada país, y cómo cambió respecto de su informe anterior."
          comoSeCalcula="Toma la última estimación publicada por cada organismo y la compara con la anterior de la misma campaña; el gráfico sigue la evolución de cada campaña a lo largo del tiempo."
        />
        <EstimacionesPanel />
      </div>
    </main>
  );
}
