import type { Metadata } from "next";
import { ArbitrajesTable } from "@/components/arbitrajes-table";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

// 30s para que la 1ª columna (último operado en vivo) y las puntas se actualicen
// seguido durante la rueda; el poll del cliente refresca en ese ritmo.
export const revalidate = 30;

export const metadata: Metadata = {
  title: "Arbitrajes · Granos · ROFO AGRO",
  description: "Futuro vs. pizarra: spread, tasa directa y TNA, con la 1ª columna en vivo durante la rueda.",
};

export default async function ArbitrajesPage() {
  await requireSeccion("granos", "/granos/arbitrajes");
  return (
    <main className="wrap">
      <div className="col">
        <PageHead kicker="Pizarra · Matba Rofex" title="Arbitrajes" lede="Futuro contra pizarra en pesos: spread, tasa directa y TNA en dólares." />
        <ArbitrajesTable />
      </div>
    </main>
  );
}
