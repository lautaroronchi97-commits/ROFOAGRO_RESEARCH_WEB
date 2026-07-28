import type { Metadata } from "next";
import { getEventos, type Organismo } from "@/lib/calendario";
import { hoyCordobaISO } from "@/lib/dates";
import { CalendarioCliente } from "@/components/calendario-cliente";
import { EstimacionesPanel } from "@/components/estimaciones-panel";
import { QueEsEsto } from "@/components/que-es-esto";
import { Panel } from "@/components/panel";
import { ProduccionTabs } from "@/components/produccion-tabs";
import { requireSeccion } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Producción · Calendario de informes — ROFO AGRO",
  description:
    "Calendario cronológico de los informes de estimación de producción de granos (USDA, CONAB, BCR, BCBA, SAGyP) y sus últimas estimaciones por país y grano.",
  robots: { index: false, follow: false },
};

// El calendario se genera en código; se revalida seguido igual por si cambia el día.
export const revalidate = 3600;

const ORDEN_ORG: Organismo[] = ["USDA", "CONAB", "BCR", "BCBA", "DEA", "CFTC", "EIA", "NOPA"];

export default async function ProduccionPage() {
  await requireSeccion("produccion");
  const hoy = hoyCordobaISO();
  // Horizonte: resto de 2026 (el seed de fechas oficiales cubre 2026).
  const hasta = hoy > "2026-12-31" ? hoy : "2026-12-31";
  const eventos = getEventos(hoy, hasta);
  const presentes = ORDEN_ORG.filter((o) => eventos.some((e) => e.organismo === o));

  return (
    <>
      <main className="wrap">
        <div className="col">
          {/* Mismas clases que PageHead (page-head.tsx), compuestas a mano: el lede
              acá lleva marcado (<b>) y el componente solo acepta string plano. */}
          <header className="page-hd">
            <div className="page-hd-kicker">USDA · CONAB · BCR · SAGyP · BCBA</div>
            <h1 className="page-hd-title">Producción</h1>
            <p className="page-hd-lede">
              Cuándo publica cada organismo y qué proyecta para la producción de cada país y grano.
              Horarios en hora Argentina. Las fechas <b>oficiales</b> las publica el organismo; las marcadas{" "}
              <b>est.</b> son estimadas para los que no tienen agenda pública.
            </p>
          </header>

          <ProduccionTabs
            calendario={
              <>
                <h2 className="sec-title">Calendario cronológico</h2>
                <Panel id="calendario">
                  <div className="cal-full-wrap">
                    <CalendarioCliente eventos={eventos} organismos={presentes} />
                  </div>
                </Panel>
              </>
            }
            estimaciones={
              <>
                <h2 className="sec-title">Última estimación por organismo</h2>
                <QueEsEsto
                  paraQue="Muestra cuánto proyecta cada organismo que se va a producir de cada grano en cada país, y cómo cambió respecto de su informe anterior."
                  comoSeCalcula="Toma la última estimación publicada por cada organismo y la compara con la anterior de la misma campaña; el gráfico sigue la evolución de cada campaña a lo largo del tiempo."
                />
                <EstimacionesPanel />
              </>
            }
          />
        </div>
      </main>
    </>
  );
}
