import type { Metadata } from "next";
import { getEventos, type Organismo } from "@/lib/calendario";
import { hoyCordobaISO } from "@/lib/dates";
import { parseYmd, sumarCorridos, ymd } from "@/lib/habiles";
import { CalendarioCliente } from "@/components/calendario-cliente";
import { Panel } from "@/components/panel";
import { requireSeccion } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Calendario de informes · Producción · ROFO AGRO",
  description:
    "Calendario cronológico de los informes de estimación de producción de granos (USDA, CONAB, BCR, BCBA, SAGyP).",
  robots: { index: false, follow: false },
};

// El calendario se genera en código; se revalida seguido igual por si cambia el día.
export const revalidate = 3600;

const ORDEN_ORG: Organismo[] = ["USDA", "CONAB", "BCR", "BCBA", "DEA", "CFTC", "EIA", "NOPA"];

export default async function CalendarioProduccionPage() {
  await requireSeccion("produccion");
  const hoy = hoyCordobaISO();
  // Horizonte: 60 días desde hoy (relevamiento web R7, punto 49 — antes iba hasta fin de 2026).
  const hasta = ymd(sumarCorridos(parseYmd(hoy), 60));
  const eventos = getEventos(hoy, hasta);
  const presentes = ORDEN_ORG.filter((o) => eventos.some((e) => e.organismo === o));

  return (
    <main className="wrap">
      <div className="col">
        {/* Mismas clases que PageHead (page-head.tsx), compuestas a mano: el lede
            acá lleva marcado (<b>) y el componente solo acepta string plano. */}
        <header className="page-hd">
          <div className="page-hd-kicker">USDA · CONAB · BCR · SAGyP · BCBA</div>
          <h1 className="page-hd-title">Calendario de informes</h1>
          <p className="page-hd-lede">
            Cuándo publica cada organismo. Horarios en hora Argentina. Las fechas <b>oficiales</b> las
            publica el organismo; las marcadas <b>est.</b> son estimadas para los que no tienen agenda pública.
          </p>
        </header>

        <Panel id="calendario">
          <div className="cal-full-wrap">
            <CalendarioCliente eventos={eventos} organismos={presentes} />
          </div>
        </Panel>
      </div>
    </main>
  );
}
