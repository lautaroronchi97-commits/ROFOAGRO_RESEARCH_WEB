import { getFotoOperativa } from "@/lib/lineup/foto";
import { Panel, PanelHead } from "../panel";
import { SourceStamp } from "../source-stamp";
import { QueEsEsto } from "../que-es-esto";
import { FotoOperativaClient } from "./foto-operativa-client";

function IconShip() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 10.5 3 7h10l1 3.5" />
      <path d="M8 7V3.5M6 5h4" />
      <path d="M1.5 10.5c1 0 1 1 2 1s1-1 2-1 1 1 2 1 1-1 2-1 1 1 2 1 1-1 2-1" />
    </svg>
  );
}

/** "2026-07-16" → "16/07". */
function ddmm(iso: string | null): string {
  if (!iso) return "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export async function FotoOperativaPanel() {
  const data = await getFotoOperativa();

  if (data.fecha === null) {
    return (
      <Panel id="lineup-foto">
        <PanelHead glyph={<IconShip />} title="Line-up de buques" sub="Exportaciones por puerto" stamp={<SourceStamp meta={data.meta} />} />
        <p className="dim" style={{ padding: "8px 2px" }}>Sin datos de line-up disponibles.</p>
      </Panel>
    );
  }

  return (
    <Panel id="lineup-foto">
      <PanelHead
        glyph={<IconShip />}
        title="Line-up de buques"
        sub={`Foto del ${ddmm(data.fecha)} · exportaciones (carga)`}
        stamp={<SourceStamp meta={data.meta} />}
      />

      <FotoOperativaClient data={data} />

      <QueEsEsto
        paraQue="Es la foto del último line-up de buques en puertos argentinos: qué barcos vienen a cargar granos y subproductos para exportar, cuánto, de qué empresa y a qué destino. Sirve para leer la demanda física de exportación antes de la rueda y quién está detrás de cada movimiento."
        comoSeCalcula="Toma la última rueda del line-up de buques (exportaciones = carga), agrupa por producto y por zona portuaria (Up River Norte/Sur y Bahía Blanca, clasificadas por el muelle), normaliza los nombres de los exportadores y compara contra la rueda anterior para marcar los buques nuevos y los que salieron (embarcaron o se cayeron del programa). El Δ semana compara contra la rueda más cercana a 7 días atrás. Click en un producto o una zona abre el detalle por empresa."
      />
    </Panel>
  );
}
