import { getNoticias } from "@/lib/noticias";
import { Panel, PanelHead } from "./panel";
import { SourceStamp } from "./source-stamp";
import { QueEsEsto } from "./que-es-esto";
import { NoticiasClient } from "./noticias-client";

function IconNews() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3h8v10H3z" />
      <path d="M11 6h2v6a1 1 0 0 1-1 1H3" />
      <path d="M5 5.5h4M5 8h4M5 10.5h2.5" />
    </svg>
  );
}

export async function NoticiasPanel() {
  const data = await getNoticias();

  return (
    <Panel id="noticias">
      <PanelHead
        glyph={<IconNews />}
        title="Noticias"
        sub="Portal del agro"
        stamp={<SourceStamp meta={data.meta} />}
      />
      {data.total > 0 ? (
        <NoticiasClient destacados={data.destacados} categorias={data.categorias} ahora={data.generadoMs} />
      ) : (
        <p className="news-empty">Sin noticias disponibles ahora.</p>
      )}
      <QueEsEsto
        paraQue="Reúne las noticias del agro de muchos medios en un solo lugar, ordenadas por tema, para no tener que ir diario por diario."
        comoSeCalcula="Toma los titulares de los medios del agro y los agrupa por tema con reglas propias; cada titular lleva a la nota original en su medio (no se republica el contenido)."
      />
    </Panel>
  );
}
