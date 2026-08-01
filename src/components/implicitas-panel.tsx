import { getDolarFuturo, getDolarLinked } from "@/lib/market";
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
  const [fut, link, sint, arb] = await Promise.all([
    getDolarFuturo(),
    getDolarLinked(),
    getSinteticos(),
    getArbitrajes(),
  ]);

  const problemas = [...fut.meta.problemas, ...link.meta.problemas, ...sint.meta.problemas, ...arb.meta.problemas];
  const meta = {
    source: "MAE · Mercado de deuda local · Matba Rofex",
    updatedAt: Math.max(fut.meta.updatedAt ?? 0, link.meta.updatedAt ?? 0) || null,
    status: problemas.length === 0 ? ("real" as const) : ("parcial" as const),
    problemas,
  };

  const futPts = fut.posiciones
    .filter((p) => p.tnaPct != null && p.dias != null)
    .map((p) => ({ x: p.dias as number, y: p.tnaPct as number }));

  const linkPts = link.bonos
    .filter((b) => b.tnaPct != null && b.dias != null)
    .map((b) => ({ x: b.dias as number, y: b.tnaPct as number }));

  const sintPts = sint.rows
    .filter((r) => r.tnaPct != null && r.dias != null)
    .map((r) => ({ x: r.dias as number, y: r.tnaPct as number }));

  const granosPts = arb.granos.flatMap((g) =>
    g.rows
      .filter((r) => r.tna != null && r.dias != null)
      .map((r) => ({ x: r.dias as number, y: r.tna as number })),
  );

  // Todas las tasas disponibles en dólares (relevamiento web, punto 35) — se SUMAN
  // sintéticos y granos, no se reemplaza ninguna de las dos que ya estaban.
  const series = [
    { name: "Dólar futuro", points: futPts },
    { name: "Dólar linked", points: linkPts },
    { name: "Sintéticos", points: sintPts },
    { name: "Granos", points: granosPts },
  ];

  // Tabla de datos del gráfico: una fila por plazo (días), una columna por serie.
  // Mismos puntos y mismo formato que el tooltip del chart; "—" donde la serie
  // no tiene punto en ese plazo.
  const plazos = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);
  const tablaFilas: ChartTablaFila[] = plazos.map((x) => {
    const fila: ChartTablaFila = { plazo: `${x}d` };
    for (const s of series) {
      const vals = s.points.filter((p) => p.x === x).map((p) => `${nfmt(p.y, 1)}%`);
      fila[s.name] = vals.length > 0 ? vals.join(" · ") : null;
    }
    return fila;
  });
  const tablaColumnas = [
    { key: "plazo", label: "Plazo", align: "left" as const },
    ...series.map((s) => ({ key: s.name, label: s.name })),
  ];

  return (
    <Panel id="implicitas">
      <PanelHead
        glyph={<IconLayers />}
        title="Implícitas combinadas"
        sub="TNA USD por plazo — dólar futuro · linked · sintéticos · granos"
        stamp={<SourceStamp meta={meta} />}
      />
      <ImplicitasChart series={series} />
      {plazos.length <= MAX_FILAS_TABLA && (
        <ChartTabla
          titulo="Datos del gráfico"
          columnas={tablaColumnas}
          filas={tablaFilas}
          nota="TNA en % según días al vencimiento."
        />
      )}
      <QueEsEsto
        paraQue="Junta en un solo gráfico las tasas en dólares que se pueden sacar por distintos caminos (dólar futuro y dólar linked), para comparar cuál rinde más a cada plazo."
        comoSeCalcula="Para cada instrumento calcula la tasa anual en dólares y la ubica según los días que faltan hasta el vencimiento: el eje horizontal son los días al vencimiento y el vertical, la tasa anual."
      />
    </Panel>
  );
}
