import { getPases } from "@/lib/pases-cierres";
import { getPasesLive, getFuturosLive, mergeLiveMeta } from "@/lib/a3-live";
import { esPosicionLiquida } from "@/lib/liquidez-posicion";
import { Panel, PanelHead } from "./panel";
import { SourceStamp } from "./source-stamp";
import { QueEsEsto } from "./que-es-esto";
import { PasesTabla, type PuntaPase } from "./pases-tabla";

function IconPases() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h8l-2-2" />
      <path d="M13 10H5l2 2" />
    </svg>
  );
}

export async function PasesPanel() {
  // Mismo filtro de liquidez que Arbitrajes (relevamiento 29/07, punto 26): una
  // posición que allá se oculta (OI<100 sin operar hoy) tampoco debe aparecer
  // como pata de un pase acá. `futLive` es por POSICIÓN (símbolo del futuro,
  // ej. "SOJ.ROS/JUL26"), distinto de `live` (pases ya armados, para bid/ask).
  const [futLive, live] = await Promise.all([getFuturosLive(), getPasesLive()]);
  const liquidaSymbol = (symbol: string, openInterest: number | null) => {
    const volLive = futLive.puntas.get(symbol)?.vol ?? null;
    return esPosicionLiquida({ openInterest, operoHoy: volLive != null && volLive > 0 });
  };
  const data = await getPases(liquidaSymbol);
  const meta = mergeLiveMeta(data.meta, live);

  const puntas: Record<string, PuntaPase> = {};
  for (const [sym, p] of live.puntas) {
    puntas[sym] = { bid: p.bid, ask: p.ask, last: p.last, vol: p.vol };
  }

  return (
    <Panel id="pases">
      <PanelHead
        glyph={<IconPases />}
        title="Pases"
        sub="Spreads entre posiciones (calendario)"
        stamp={<SourceStamp meta={meta} revalidateSeg={30} />}
      />
      <PasesTabla granos={data.granos} puntas={puntas} />
      <QueEsEsto
        paraQue="Compara dos fechas de entrega del mismo grano y te dice cuánto cuesta (o cuánto te pagan) por correr la venta de la más cercana a la más lejana. Sirve para decidir si te conviene estirar o adelantar un compromiso ya tomado."
        comoSeCalcula="Es la diferencia de precio entre la posición cercana y la lejana; esa diferencia, anualizada por los días que hay entre una y otra fecha, te da la tasa del pase. Comprador, Vendedor, Último y Volumen son del pase en la rueda, cuando está abierta."
      />
    </Panel>
  );
}
