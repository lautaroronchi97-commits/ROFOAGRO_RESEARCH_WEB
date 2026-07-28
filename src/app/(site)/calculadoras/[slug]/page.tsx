import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurvaGranos } from "@/lib/curva";
import { getPizarra } from "@/lib/pizarra";
import { CALCULADORAS, getCalc } from "@/lib/calculadoras";
import { CalcDiferido } from "@/components/calc-diferido";
import { CalcNegociosPago } from "@/components/calc-negocios-pago";
import { CalcPlanta, type PizarraProducto } from "@/components/calc-planta";
import { CalcArbitraje } from "@/components/calc-arbitraje";
import { CalcEstrategias } from "@/components/calc-estrategias";
import { CalcFijar } from "@/components/calc-fijar";
import { CalcCostos } from "@/components/calc-costos";
import { CalcPorcentaje } from "@/components/calc-porcentaje";
import { CalcPases } from "@/components/calc-pases";
import { QueEsEsto } from "@/components/que-es-esto";
import { PageHead } from "@/components/page-head";
import { requireSeccion } from "@/lib/auth/dal";

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

  // Se traen las dos fuentes de curva/pizarra (cache-deduped); cada calc usa lo suyo.
  const curva = await getCurvaGranos();
  const pizarra = await getPizarra();

  const NOMBRES_PIZARRA: Record<string, string> = {
    SOJ: "Soja",
    MAI: "Maíz",
    TRI: "Trigo",
    GIR: "Girasol",
    SOR: "Sorgo",
  };
  // Girasol y sorgo solo alimentan esta calc (no tienen futuro A3 → no van a "a fijar"/"por
  // porcentaje"/etc., que usan curva.granos).
  const pizarraProd: PizarraProducto[] = ["SOJ", "MAI", "TRI", "GIR", "SOR"]
    .map((u) => pizarra.granos[u])
    .filter((g): g is NonNullable<typeof g> => !!g)
    .map((g) => ({ underlying: g.underlying, nombre: NOMBRES_PIZARRA[g.underlying] ?? g.underlying, usd: g.usd }));

  function renderCalc() {
    switch (slug) {
      case "a-fijar":
        return <CalcFijar granos={curva.granos} />;
      case "por-porcentaje":
        return <CalcPorcentaje granos={curva.granos} />;
      case "negocios-con-pagos":
        return <CalcNegociosPago granos={curva.granos} />;
      case "pago-diferido":
        return <CalcDiferido />;
      case "pases":
        return <CalcPases granos={curva.granos} />;
      case "carry":
        return <CalcArbitraje granos={curva.granos} />;
      case "costos":
        return <CalcCostos />;
      case "estrategias":
        return <CalcEstrategias />;
      case "negocios-de-planta":
        return <CalcPlanta pizarra={pizarraProd} />;
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
