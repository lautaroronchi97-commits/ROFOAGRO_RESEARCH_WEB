import type { Metadata } from "next";
import Link from "next/link";
import { BIBLIOTECA } from "@/lib/biblioteca";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Granos · ROFO AGRO",
  description:
    "Arbitrajes, pases, capacidad de pago, monitor de mercados y la mejor salida para hacer caja en el mercado de granos.",
};

const ITEMS = BIBLIOTECA.find((g) => g.key === "granos")!.items;

export default async function GranosPage() {
  await requireSeccion("granos");
  return (
    <main className="wrap">
      <div className="col">
        <PageHead kicker="Pizarra · Matba Rofex · Chicago" title="Granos" lede="Arbitrajes contra pizarra, pases, capacidad de pago y la mejor salida para hacer caja." />
        <nav className="hub-grid" aria-label="Reportes de granos">
          {ITEMS.map((it) => (
            <Link key={it.href} href={it.href} className="hub-card">
              <span className="hub-card-name">
                {it.label}
                {it.soloMesa && (
                  <span className="hub-card-lock" title="Solo mesa">
                    🔒
                  </span>
                )}
              </span>
              <span className="hub-card-desc">{it.desc}</span>
              <span className="hub-card-go" aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
