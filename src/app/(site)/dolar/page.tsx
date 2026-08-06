import type { Metadata } from "next";
import Link from "next/link";
import { BIBLIOTECA } from "@/lib/biblioteca";
import { requireSeccion, getAcceso, itemVisible } from "@/lib/auth/dal";
import { AUTH_ENFORCED } from "@/lib/auth/config";
import { PageHead } from "@/components/page-head";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Dólar y tasas · ROFO AGRO",
  description:
    "Dólar futuro, dólar linked, tasas implícitas, sintéticos y el panel cambiario del día.",
};

const TODOS = BIBLIOTECA.find((g) => g.key === "dolar")!.items;

export default async function DolarPage() {
  await requireSeccion("dolar");
  // Permisos por ítem (06/08/2026): NO-OP con el flag apagado (sigue estática/ISR).
  const acceso = AUTH_ENFORCED ? await getAcceso() : null;
  const ITEMS = TODOS.filter((it) => itemVisible(acceso, "dolar", it.href.split(/[?#]/)[0]!));
  return (
    <main className="wrap">
      <div className="col">
        <PageHead kicker="MAE · MEP · futuros · LECAPs" title="Dólar y tasas" lede="Dólar futuro y linked, tasas implícitas, sintéticos y el panel cambiario." />
        <nav className="hub-grid" aria-label="Reportes de dólar y tasas">
          {ITEMS.map((it) => (
            <Link key={it.href} href={it.href} className="hub-card">
              <span className="hub-card-name">{it.label}</span>
              <span className="hub-card-desc">{it.desc}</span>
              <span className="hub-card-go" aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
