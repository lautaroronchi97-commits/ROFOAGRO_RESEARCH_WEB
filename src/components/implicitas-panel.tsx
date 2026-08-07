import { getDolarLinked } from "@/lib/market";
import { getSinteticos } from "@/lib/market/sinteticos";
import { getArbitrajes } from "@/lib/arbitrajes-cierres";
import { nfmt } from "@/lib/format";
import { Panel, PanelHead } from "./panel";
import { ImplicitasChart } from "./implicitas-chart";
import { ChartTabla, type ChartTablaFila } from "./chart-tabla";
import { SourceStamp } from "./source-stamp";
import { QueEsEsto } from "./que-es-esto";

/** Tabla de datos: si excede ~30 filas (un plazo por día, con 4 series superpuestas
 *  se llena rápido) se omite — el punto es que el gráfico ya lee bien las cuatro
 *  curvas juntas, y una tabla de 30+ filas × 4 columnas ya no es una "relectura",
 *  es otro documento (relevamiento web, punto 35). */
const MAX_FILAS_TABLA = 30;

function IconLayers() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2 14 5 8 8 2 5z" />
      <path d="M2 8l6 3 6-3" />
      <path d="M2 11l6 3 6-3" />
    </svg>
  );
}

export async function ImplicitasPanel() {
  const [link, sint, arb] = await Promise.all([getDolarLinked(), getSinteticos(), getArbitrajes()]);

  const problemas = [...link.meta.problemas, ...sint.meta.problemas, ...arb.meta.problemas];
  const meta = {
    source: "Mercado de deuda local · Matba Rofex",
    updatedAt: Math.max(link.meta.updatedAt ?? 0, arb.meta.updatedAt ?? 0) || null,
    status: problemas.length === 0 ? ("real" as const) : ("parcial" as const),
    problemas,
  };

  type Pt = { x: number; y: number; pos?: string };

  const linkPts: Pt[] = link.bonos
    .filter((b) => b.tnaPct != null && b.dias != null)
    .map((b) => ({ x: b.dias as number, y: b.tnaPct as number }));

  const sintPts: Pt[] = sint.rows
    .filter((r) => r.tnaPct != null && r.dias != null)
    .map((r) => ({ x: r.dias as number, y: r.tnaPct as number }));

  // Una serie POR GRANO (no una nube "Granos" con todo mezclado, feedback 07/08/2026: "el
  // maíz, soja y trigo tienen tasas diferentes, deben estar todas" e "indicar a qué posición
  // corresponde cada tasa") — cada punto lleva `pos` con la posición (ej. "NOV26") para el
  // tooltip y la tabla.
  const granosSeries = arb.granos
    .map((g) => ({
      name: g.nombre,
      points: g.rows
        .filter((r) => r.tna != null && r.dias != null)
        .map((r): Pt => ({ x: r.dias as number, y: r.tna as number, pos: r.pos })),
    }))
    .filter((s) => s.points.length > 0);

  // Se saca "Dólar futuro" (feedback 07/08/2026): es tasa en PESOS (carry oficial→futuro),
  // no una tasa en dólares — no es comparable con las demás series de esta página.
  const series = [
    { name: "Dólar linked", points: linkPts },
    { name: "Sintéticos", points: sintPts },
    ...granosSeries,
  ];

  // Tabla de datos del gráfico: una fila por plazo (días), una columna por serie. Para
  // granos, la celda incluye la posición ("NOV26 · 27,4%") — antes, con la nube única
  // "Granos", dos granos en el mismo plazo se concatenaban sin poder distinguirse.
  const plazos = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);
  const tablaFilas: ChartTablaFila[] = plazos.map((x) => {
    const fila: ChartTablaFila = { plazo: `${x}d` };
    for (const s of series) {
      const vals = s.points
        .filter((p) => p.x === x)
        .map((p) => (p.pos ? `${p.pos} · ${nfmt(p.y, 1)}%` : `${nfmt(p.y, 1)}%`));
      fila[s.name] = vals.length > 0 ? vals.join(" · ") : null;
    }
    return fila;
  });
  const tablaColumnas = [
    { key: "plazo", label: "Plazo", align: "left" as const },
    ...series.map((s) => ({ key: s.name, label: s.name, align: "left" as const })),
  ];

  return (
    <Panel id="implicitas">
      <PanelHead
        glyph={<IconLayers />}
        title="Implícitas combinadas"
        sub="TNA USD por plazo — dólar linked · sintéticos · granos (soja/maíz/trigo)"
        stamp={<SourceStamp meta={meta} revalidateSeg={60} />}
      />
      <ImplicitasChart series={series} />
      {plazos.length <= MAX_FILAS_TABLA && (
        <ChartTabla
          titulo="Datos del gráfico"
          columnas={tablaColumnas}
          filas={tablaFilas}
          nota="TNA en % según días al vencimiento. Los granos indican la posición (ej. NOV26)."
          colapsable
        />
      )}
      <QueEsEsto
        paraQue="Junta en un solo gráfico las tasas en dólares que se pueden sacar por distintos caminos (dólar linked, sintéticos LECAP/BONCAP y el arbitraje futuro-vs-pizarra de cada grano), para comparar cuál rinde más a cada plazo. El dólar futuro no entra: es una tasa en pesos, no en dólares."
        comoSeCalcula="Para cada instrumento calcula la tasa anual en dólares y la ubica según los días que faltan hasta el vencimiento: el eje horizontal son los días al vencimiento y el vertical, la tasa anual. Los granos muestran una serie por producto (soja/maíz/trigo), con la posición de cada punto."
      />
    </Panel>
  );
}
