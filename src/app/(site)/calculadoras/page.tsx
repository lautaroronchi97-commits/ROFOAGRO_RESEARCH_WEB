import type { Metadata } from "next";
import Link from "next/link";
import { CALCULADORAS } from "@/lib/calculadoras";
import { requireSeccion, getAcceso, itemVisible } from "@/lib/auth/dal";
import { AUTH_ENFORCED } from "@/lib/auth/config";
import { PageHead } from "@/components/page-head";

export const metadata: Metadata = {
  title: "Calculadoras · ROFO AGRO",
  description:
    "Calculadoras y cotizadores para operar granos: a fijar, por porcentaje, pases, carry, pago diferido, costos y estrategias. Cada una con su link propio.",
};

export default async function CalculadorasPage() {
  await requireSeccion("calculadoras");
  // Costos queda oculta del índice hasta cerrar el tarifario con la empresa
  // (relevamiento web 29/07, punto 44) — mismo criterio soloMesa de biblioteca.ts.
  const acceso = AUTH_ENFORCED ? await getAcceso() : null;
  const esAdmin = AUTH_ENFORCED ? (acceso?.esAdmin ?? false) : true;
  // Permisos por ítem (06/08/2026): además de costos (soloMesa), el admin puede haber
  // restringido cuáles de las demás calculadoras ve esta empresa.
  const visibles = CALCULADORAS.filter(
    (c) => c.slug !== "costos" || esAdmin
  ).filter((c) => c.slug === "costos" || itemVisible(acceso, "calculadoras", `/calculadoras/${c.slug}`));
  return (
    <>
      <main className="wrap">
        <div className="col">
          <PageHead kicker="Cotizadores de mesa" title="Calculadoras" lede="Corré tus números con la lógica de una mesa: a fijar, pases, carry, costos y más." />
          <nav className="hub-grid" aria-label="Calculadoras">
            {visibles.map((c) => (
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
