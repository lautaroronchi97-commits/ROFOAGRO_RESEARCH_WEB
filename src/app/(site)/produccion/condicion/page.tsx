import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";
import { QueEsEsto } from "@/components/que-es-esto";
import { getPasCondicion } from "@/lib/pas-condicion";
import { CondicionPanel } from "./condicion-panel";

/**
 * Condición de cultivos (C27, docs/PLAN_PAS_ZONAS.md): serie semanal de condición de cultivo,
 * condición hídrica y avance fenológico de BCBA-PAS, por cultivo/ciclo/campaña. SOLO MESA
 * (requireAdmin + RLS interna en `pas_condicion`, la misma doble cerradura que `/produccion/zonas`
 * y `/granos/view`) — Lautaro carga un export por cultivo desde `/admin/datos`.
 */
export const metadata: Metadata = {
  title: "Condición de cultivos · BCBA-PAS · ROFO AGRO",
  description: "Condición de cultivo, condición hídrica y fenología semanal de BCBA-PAS, por campaña.",
  robots: { index: false, follow: false },
};

export default async function PasCondicionPage() {
  await requireAdmin();
  const { filas, error } = await getPasCondicion();

  return (
    <main className="wrap">
      <div className="col">
        <PageHead
          kicker="BCBA-PAS · solo mesa"
          title="Condición de cultivos"
          lede="Condición de cultivo, condición hídrica y avance fenológico, semana a semana de cada campaña."
        />
        <QueEsEsto
          paraQue="Sigue cómo viene el cultivo EN el ciclo, no solo cuánto va a rendir al final: condición de cultivo (Buena+Excelente) y condición hídrica (Adecuada+Óptima) semana a semana, comparadas contra las campañas anteriores en la misma altura del ciclo, más el avance fenológico (qué etapa está atravesando el cultivo)."
          comoSeCalcula="Carga manual del export de BCBA-PAS (bolsadecereales.com/estimaciones-agricolas) por /admin/datos, un archivo por cultivo. El eje es 'semana de campaña' (el origen no publica fechas calendario) — la campaña elegida se destaca, las anteriores quedan de fondo en gris."
        />
        <CondicionPanel filas={filas} error={error} />
      </div>
    </main>
  );
}
