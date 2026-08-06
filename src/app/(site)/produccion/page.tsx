import type { Metadata } from "next";
import Link from "next/link";
import { BIBLIOTECA } from "@/lib/biblioteca";
import { requireSeccion, getAcceso, itemVisible } from "@/lib/auth/dal";
import { AUTH_ENFORCED } from "@/lib/auth/config";
import { PageHead } from "@/components/page-head";

export const metadata: Metadata = {
  title: "Producción · ROFO AGRO",
  description:
    "Calendario de informes de estimación de producción de granos y las últimas estimaciones por país y grano.",
  robots: { index: false, follow: false },
};

export const revalidate = 3600;

const TODOS = BIBLIOTECA.find((g) => g.key === "produccion")!.items;

export default async function ProduccionPage() {
  await requireSeccion("produccion");
  // Permisos por ítem (06/08/2026): NO-OP con el flag apagado (sigue estática/ISR). Los
  // soloMesa (zonas/condición) siguen su criterio de siempre — no se tocan acá.
  const acceso = AUTH_ENFORCED ? await getAcceso() : null;
  const ITEMS = TODOS.filter((it) => it.soloMesa || itemVisible(acceso, "produccion", it.href.split(/[?#]/)[0]!));
  return (
    <main className="wrap">
      <div className="col">
        <PageHead
          kicker="USDA · CONAB · BCR · SAGyP · BCBA"
          title="Producción"
          lede="Cuándo publica cada organismo y qué proyecta para la producción de cada país y grano."
        />
        <nav className="hub-grid" aria-label="Reportes de producción">
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
