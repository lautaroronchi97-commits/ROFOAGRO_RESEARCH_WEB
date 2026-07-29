import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";
import { QueEsEsto } from "@/components/que-es-esto";
import { getPasZonas } from "@/lib/pas-zonas";
import { ZonasPanel } from "./zonas-panel";

/**
 * Producción por zona agroecológica (C23, docs/PLAN_PAS_ZONAS.md): desglose de BCBA-PAS por las
 * 15 zonas agroecológicas, con la foto de campaña (descomposición Δárea/Δrinde) y la evolución
 * histórica de participación desde 2008/09. SOLO MESA (requireAdmin + RLS interna en `pas_zonas`,
 * la misma doble cerradura que `/granos/view`) — Lautaro carga el export desde `/admin/datos`.
 */
export const metadata: Metadata = {
  title: "Producción por zona · BCBA-PAS · ROFO AGRO",
  description: "Producción agrícola por zona agroecológica de BCBA-PAS, con la caída/suba de cada campaña descompuesta en efecto área y efecto rinde.",
  robots: { index: false, follow: false },
};

export default async function PasZonasPage() {
  await requireAdmin();
  const { filas, error } = await getPasZonas();

  return (
    <main className="wrap">
      <div className="col">
        <PageHead
          kicker="BCBA-PAS · solo mesa"
          title="Producción por zona"
          lede="Foto de campaña por zona agroecológica, con el Δ descompuesto en efecto área y efecto rinde, más la evolución de participación."
        />
        <QueEsEsto
          paraQue="Responde de dónde viene un cambio de producción: ¿cayó el rinde en el Núcleo o se sembraron menos hectáreas en el NOA? La foto de campaña descompone el Δ de cada zona en efecto área y efecto rinde; la evolución sigue cómo se mueve el peso relativo de cada zona en el tiempo."
          comoSeCalcula="Carga manual del export de BCBA-PAS (bolsadecereales.com/estimaciones-agricolas) por /admin/datos, con la identidad suma-zonas=TOTAL verificada en cada carga. El % de participación y la contribución al Δ nacional solo se calculan desde 2008/09 (antes las zonas no cubrían todo el país)."
        />
        <ZonasPanel filas={filas} error={error} />
      </div>
    </main>
  );
}
