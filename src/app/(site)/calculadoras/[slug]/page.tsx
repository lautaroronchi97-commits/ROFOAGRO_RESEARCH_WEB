import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurvaGranos } from "@/lib/curva";
import { getPizarra } from "@/lib/pizarra";
import { getMaeOficial } from "@/lib/market/fuentes";
import { getFuturosLive } from "@/lib/a3-live";
import { getBnaOnline } from "@/lib/bna-online";
import { CALCULADORAS, getCalc } from "@/lib/calculadoras";
import { CalcDiferido } from "@/components/calc-diferido";
import { CalcNegociosPago } from "@/components/calc-negocios-pago";
import { CalcPlanta } from "@/components/calc-planta";
import { CalcArbitraje } from "@/components/calc-arbitraje";
import { CalcEstrategias } from "@/components/calc-estrategias";
import { CalcFijar } from "@/components/calc-fijar";
import { CalcCostos } from "@/components/calc-costos";
import { CalcPorcentaje } from "@/components/calc-porcentaje";
import { CalcPases } from "@/components/calc-pases";
import { QueEsEsto } from "@/components/que-es-esto";
import { PageHead } from "@/components/page-head";
import { requireSeccion, getAcceso } from "@/lib/auth/dal";
import { AUTH_ENFORCED } from "@/lib/auth/config";
import type { GranoPizarraDual } from "@/components/precio-dual";
import type { PuntasVivo } from "@/lib/fijar-canon";

export const revalidate = 60;
export const dynamicParams = false;

export function generateStaticParams() {
  return CALCULADORAS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const calc = getCalc(slug);
  if (!calc) return { title: "Calculadora · ROFO AGRO" };
  return { title: `${calc.nombre} · ROFO AGRO`, description: calc.desc };
}

export default async function CalculadoraPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireSeccion("calculadoras");
  const calc = getCalc(slug);
  if (!calc) notFound();
  // Costos queda oculta hasta cerrar el tarifario con la empresa (relevamiento web
  // 29/07, punto 44) — la URL directa da "sin acceso" a no-admins, mismo criterio
  // que biblioteca.ts/el índice.
  if (slug === "costos" && AUTH_ENFORCED) {
    const acceso = await getAcceso();
    if (!acceso?.esAdmin) redirect("/sin-acceso");
  }

  // Se traen las fuentes de curva/pizarra/vivo (cache-deduped); cada calc usa lo suyo.
  const [curva, pizarra, oficial, live] = await Promise.all([
    getCurvaGranos(),
    getPizarra(),
    getMaeOficial(),
    getFuturosLive(),
  ]);
  const bnaOnline = oficial.valor != null ? getBnaOnline(oficial.valor) : null;
  const liveObj: Record<string, PuntasVivo> = Object.fromEntries(live.puntas);

  const NOMBRES_PIZARRA: Record<string, string> = {
    SOJ: "Soja",
    MAI: "Maíz",
    TRI: "Trigo",
    GIR: "Girasol",
    SOR: "Sorgo",
  };
  // Girasol y sorgo solo alimentan esta calc (no tienen futuro A3 → no van a "a fijar"/"por
  // porcentaje"/etc., que usan curva.granos). Con `ars` (patrón precio-dual, R5 punto 47).
  const pizarraProd: GranoPizarraDual[] = ["SOJ", "MAI", "TRI", "GIR", "SOR"]
    .map((u) => pizarra.granos[u])
    .filter((g): g is NonNullable<typeof g> => !!g)
    .map((g) => ({ underlying: g.underlying, nombre: NOMBRES_PIZARRA[g.underlying] ?? g.underlying, usd: g.usd, ars: g.ars }));

  // Pizarra dual $/USD (patrón R4, punto 38-44) — solo SOJ/MAI/TRI, que son los que
  // tienen curva A3 (girasol/sorgo solo alimentan "negocios de planta", arriba).
  const pizarraDual: GranoPizarraDual[] = curva.granos.map((g) => {
    const p = pizarra.granos[g.underlying];
    return { underlying: g.underlying, nombre: g.nombre, usd: p?.usd ?? null, ars: p?.ars ?? null };
  });

  function renderCalc() {
    switch (slug) {
      case "a-fijar":
        return <CalcFijar granos={curva.granos} pizarraDual={pizarraDual} tcBna={pizarra.tcBna} live={liveObj} />;
      case "por-porcentaje":
        return <CalcPorcentaje granos={curva.granos} pizarraDual={pizarraDual} tcBna={pizarra.tcBna} />;
      case "negocios-con-pagos":
        return <CalcNegociosPago granos={curva.granos} bnaOnline={bnaOnline} tcBna={pizarra.tcBna} />;
      case "pago-diferido":
        return <CalcDiferido pizarraDual={pizarraDual} tcBna={pizarra.tcBna} />;
      case "pases":
        return <CalcPases granos={curva.granos} />;
      case "carry":
        return <CalcArbitraje granos={curva.granos} pizarraDual={pizarraDual} tcBna={pizarra.tcBna} />;
      case "costos":
        return <CalcCostos />;
      case "estrategias":
        return <CalcEstrategias granos={curva.granos} />;
      case "negocios-de-planta":
        return <CalcPlanta pizarra={pizarraProd} tcBna={pizarra.tcBna} />;
      default:
        return null;
    }
  }

  return (
    <>
      <main className="wrap">
        <div className="col">
          {/* Sin back-link acá: el breadcrumb del layout (Inicio › Calculadoras › …) ya cumple (E3 H11). */}
          <PageHead kicker="Calculadora de mesa" title={calc.nombre} lede={calc.desc} />
          <QueEsEsto paraQue={calc.paraQue} comoSeCalcula={calc.comoSeCalcula} />
          {renderCalc()}
        </div>
      </main>
    </>
  );
}
