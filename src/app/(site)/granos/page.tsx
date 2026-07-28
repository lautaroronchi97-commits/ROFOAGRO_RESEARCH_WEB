import type { Metadata } from "next";
import Link from "next/link";
import { ArbitrajesTable } from "@/components/arbitrajes-table";
import { MonitorMercados } from "@/components/monitor-mercados";
import { MejorCajaPanel } from "@/components/mejor-caja-panel";
import { PasesPanel } from "@/components/pases-panel";
import { CapacidadPanel } from "@/components/capacidad-panel";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

// 30s para que la 1ª columna de Arbitrajes (último operado en vivo) y las puntas
// se actualicen seguido durante la rueda; el poll del cliente refresca en ese ritmo.
export const revalidate = 30;

export const metadata: Metadata = {
  title: "Granos · ROFO AGRO",
  description:
    "Arbitrajes, pases, capacidad de pago y la mejor salida para hacer caja en el mercado de granos.",
};

export default async function GranosPage() {
  await requireSeccion("granos");
  return (
    <>
      <main className="wrap">
        <div className="col">
          <PageHead kicker="Pizarra · Matba Rofex · Chicago" title="Granos" lede="Arbitrajes contra pizarra, pases, capacidad de pago y la mejor salida para hacer caja." />
          <ArbitrajesTable />
          <MonitorMercados />
          <MejorCajaPanel />
          <PasesPanel />
          <CapacidadPanel />
          <p className="ng-admin-link">
            <Link href="/granos/view">View de mesa por grano (research direccional · solo mesa) →</Link>
          </p>
        </div>
      </main>
    </>
  );
}
