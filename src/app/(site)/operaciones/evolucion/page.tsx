import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSeccion, getAcceso } from "@/lib/auth/dal";
import { getOperaciones, getEmpresasParaSelector } from "@/lib/operaciones/datos";
import { evolucionFisico, campaniasFisicasPresentes } from "@/lib/operaciones/posicion";
import { campaniaActualIniYear, campaniaLabel } from "@/lib/operaciones/registro";
import { hoyCordobaISO } from "@/lib/dates";
import { PageHead } from "@/components/page-head";
import { Panel, PanelHead } from "@/components/panel";
import { EmpresaSelector } from "../empresa-selector";
import { CampaniaSelector } from "./campania-selector";
import { EvolucionClient } from "./evolucion-client";

/**
 * "Evolución de la posición" (mejora post-C31, 06/08/2026, pedida por Lautaro
 * en solapa propia — "no quiero landings interminables de scroll hacia
 * abajo"): la curva de cómo se fue construyendo el FÍSICO acumulado en el
 * tiempo, por producto, de UNA campaña a la vez (mismo criterio que el físico
 * segmentado de "Mi posición": campañas distintas no son la misma mercadería,
 * nunca se mezclan en la misma línea).
 */
export const metadata: Metadata = {
  title: "Evolución · Mis operaciones · ROFO AGRO",
  description: "Curva de la posición física acumulada en el tiempo, por producto.",
  robots: { index: false, follow: false },
};

export default async function EvolucionPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; campania?: string }>;
}) {
  await requireSeccion("operaciones", "/operaciones/evolucion");
  const sp = await searchParams;
  const acceso = await getAcceso();
  if (!acceso) redirect("/ingresar");

  let empresaId: string | null;
  let empresas: { id: string; nombre: string }[] = [];
  if (acceso.esAdmin) {
    empresas = await getEmpresasParaSelector();
    empresaId = sp.empresa && empresas.some((e) => e.id === sp.empresa) ? sp.empresa : (empresas[0]?.id ?? null);
  } else {
    empresaId = acceso.perfil.empresa_id;
  }

  if (!empresaId) {
    return (
      <main className="wrap">
        <div className="col">
          <PageHead kicker="Físico acumulado en el tiempo" title="Evolución de la posición" />
          <p className="dim">
            {acceso.esAdmin
              ? "Todavía no hay empresas cargadas."
              : "Tu cuenta todavía no tiene una empresa asignada — pedile a la mesa que te la habilite."}
          </p>
        </div>
      </main>
    );
  }

  const hoy = hoyCordobaISO();
  const operaciones = await getOperaciones(empresaId);
  const campaniasPresentes = campaniasFisicasPresentes(operaciones);
  const campaniaActual = campaniaLabel(campaniaActualIniYear(hoy));
  // Default: la campaña actual si tiene datos; si no, la más antigua presente
  // (nunca se inventa una campaña sin operaciones solo para mostrar algo).
  const campania =
    sp.campania && campaniasPresentes.includes(sp.campania)
      ? sp.campania
      : campaniasPresentes.includes(campaniaActual)
        ? campaniaActual
        : (campaniasPresentes[0] ?? campaniaActual);

  const series = evolucionFisico(operaciones, campania);

  return (
    <main className="wrap">
      <div className="col">
        <PageHead
          kicker="Físico acumulado en el tiempo"
          title="Evolución de la posición"
          lede="Cómo se fue construyendo tu posición física, por producto y campaña."
        />
        <Panel id="op-evolucion">
          <PanelHead title="Evolución" sub="posición física acumulada, una campaña por vez" />
          <div className="op-controles">
            {empresas.length > 0 && <EmpresaSelector empresas={empresas} empresaId={empresaId} />}
            <CampaniaSelector campanias={campaniasPresentes} campania={campania} />
          </div>
          <EvolucionClient series={series} />
        </Panel>
      </div>
    </main>
  );
}
