import type { Metadata } from "next";
import Link from "next/link";
import { CALCULADORAS } from "@/lib/calculadoras";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

export const metadata: Metadata = {
  title: "Calculadoras · ROFO AGRO",
  description:
    "Calculadoras y cotizadores para operar granos: a fijar, por porcentaje, pases, carry, pago diferido, costos y estrategias. Cada una con su link propio.",
};

export default async function CalculadorasPage() {
  await requireSeccion("calculadoras");
  return (
    <>
      <main className="wrap">
        <div className="col">
          <PageHead kicker="Cotizadores de mesa" title="Calculadoras" lede="Corré tus números con la lógica de una mesa: a fijar, pases, carry, costos y más." />
          <nav className="hub-grid" aria-label="Calculadoras">
            {CALCULADORAS.map((c) => (
              <Link key={c.slug} href={`/calculadoras/${c.slug}`} className="hub-card">
                <span className="hub-card-name">{c.nombre}</span>
                <span className="hub-card-desc">{c.desc}</span>
                <span className="hub-card-go" aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </nav>
        </div>
      </main>
    </>
  );
}
