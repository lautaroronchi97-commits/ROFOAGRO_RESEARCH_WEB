import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSeccion, getAcceso } from "@/lib/auth/dal";
import { getOperaciones, getEmpresasParaSelector } from "@/lib/operaciones/datos";
import { construirMatrizFisico, construirMatrizFuturos, combinarMatrices } from "@/lib/operaciones/posicion";
import { hoyCordobaISO } from "@/lib/dates";
import { PageHead } from "@/components/page-head";
import { Panel, PanelHead } from "@/components/panel";
import { PosicionClient } from "./posicion-client";

/**
 * "Mi posición" (C31, docs/PLAN_OPERACIONES_CLIENTES.md §5.6 y §8 item 6 — Fase 1
 * mínima): posición neta comprado/vendido por producto × período de entrega, para
 * la empresa del usuario logueado. `requireSeccion("operaciones")` + RLS por
 * `empresa_id` (§4.4): la posición nunca mezcla filas de otra empresa, ni para un
 * cliente ni por accidente de código — Postgres se lo niega igual.
 */
export const metadata: Metadata = {
  title: "Mi posición · Mis operaciones · ROFO AGRO",
  description: "Posición neta comprado/vendido por producto y período de entrega.",
  robots: { index: false, follow: false },
};

export default async function OperacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  await requireSeccion("operaciones");
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
          <PageHead kicker="Posición neta · comprado/vendido" title="Mis operaciones" />
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
  const fisico = construirMatrizFisico(operaciones, hoy);
  const futuros = construirMatrizFuturos(operaciones, hoy);
  const total = combinarMatrices(fisico, futuros);

  return (
    <main className="wrap">
      <div className="col">
        <PageHead
          kicker="Posición neta · comprado/vendido"
          title="Mis operaciones"
          lede="Producto por período de entrega, siempre relativo a hoy."
        />
        <Panel id="op-posicion">
          <PanelHead title="Posición" sub="acumulada, desde la primera operación cargada" />
          <PosicionClient
            empresaId={empresaId}
            empresas={acceso.esAdmin ? empresas : null}
            fisico={fisico}
            futuros={futuros}
            total={total}
          />
        </Panel>
      </div>
    </main>
  );
}
