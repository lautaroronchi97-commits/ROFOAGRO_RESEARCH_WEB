import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSeccion, getAcceso } from "@/lib/auth/dal";
import { getOperaciones, getEmpresasParaSelector } from "@/lib/operaciones/datos";
import {
  construirMatrizFisico,
  construirMatrizFuturos,
  construirMatrizPricing,
  construirMatrizDia,
  campaniasFisicasPresentes,
  construirMatrizFisicoDeCampania,
  combinarMatrices,
  construirHeatmap,
  filtrarHasta,
} from "@/lib/operaciones/posicion";
import { valorizarFuturos, acumularFuturos, claveAjuste, type AjusteLookup } from "@/lib/operaciones/futuros-valorizados";
import { resumenPosicion } from "@/lib/operaciones/resumen";
import { getCierresGranos } from "@/lib/futuros";
import { hoyCordobaISO } from "@/lib/dates";
import { PageHead } from "@/components/page-head";
import { PosicionClient } from "./posicion-client";

/**
 * "Mi posición" (C31, docs/PLAN_OPERACIONES_CLIENTES.md §5.6 — Fase 2
 * completa): posición neta comprado/vendido por producto × período de entrega,
 * heatmap comprado/vendido y panel de futuros valorizado, para la empresa del
 * usuario logueado. `requireSeccion("operaciones")` + RLS por `empresa_id`
 * (§4.4): la posición nunca mezcla filas de otra empresa, ni para un cliente
 * ni por accidente de código — Postgres se lo niega igual.
 */
export const metadata: Metadata = {
  title: "Mi posición · Mis operaciones · ROFO AGRO",
  description: "Posición neta comprado/vendido por producto y período de entrega.",
  robots: { index: false, follow: false },
};

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEATMAP_VENTANA_MAX = 60;

/** `Map<"GRANO|POSICION", settlement>` desde `getCierresGranos()` — el ajuste de hoy para valorizar futuros (§5.5). */
function armarAjusteLookup(cierres: Awaited<ReturnType<typeof getCierresGranos>>): AjusteLookup {
  const mapa: AjusteLookup = new Map();
  for (const grano of cierres.granos) {
    for (const p of grano.posiciones) mapa.set(claveAjuste(grano.underlying, p.posicion), p.settlement);
  }
  return mapa;
}

export default async function OperacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; fecha?: string; dia?: string }>;
}) {
  await requireSeccion("operaciones", "/operaciones");
  const sp = await searchParams;
  const acceso = await getAcceso();
  if (!acceso) redirect("/ingresar");

  let empresaId: string | null;
  let empresas: { id: string; nombre: string }[] = [];
  if (acceso.esAdmin) {
    empresas = await getEmpresasParaSelector();
    empresaId = sp.empresa && empresas.some((e) => e.id === sp.empresa) ? sp.empresa : (empresas[0]?.id ?? null);
  } else {
    empresaId = acceso.perfil.empresa_id;
  }

  if (!empresaId) {
    return (
      <main className="wrap">
        <div className="col">
          <PageHead kicker="Posición neta · comprado/vendido" title="Mis operaciones" />
          <p className="dim">
            {acceso.esAdmin
              ? "Todavía no hay empresas cargadas."
              : "Tu cuenta todavía no tiene una empresa asignada — pedile a la mesa que te la habilite."}
          </p>
        </div>
      </main>
    );
  }

  const hoy = hoyCordobaISO();
  const fechaCorte = sp.fecha && FECHA_RE.test(sp.fecha) && sp.fecha !== hoy ? sp.fecha : null;
  const dia = sp.dia && FECHA_RE.test(sp.dia) && sp.dia <= hoy ? sp.dia : hoy;

  const [operaciones, cierres] = await Promise.all([getOperaciones(empresaId), getCierresGranos()]);
  const ajustes = armarAjusteLookup(cierres);

  // POSICIÓN DEL DÍA (pedido de Lautaro 06/08/2026): pricing del día elegido
  // (posición inicial = lo acumulado A PRECIO hasta el día anterior — pricing
  // sigue sumando TODAS las campañas juntas, es exposición en $, no identidad
  // de grano) + futuros del día valorizados con el ajuste de HOY (no hay
  // mark-to-market pasado sin historial de ajustes). Integridad por
  // construcción: inicial + neto del día = acumulado al cierre de ese día,
  // testeado también contra el camino independiente en posicion.test.ts.
  const pricingDia = construirMatrizDia(operaciones, dia, hoy, construirMatrizPricing);
  const futurosDia = valorizarFuturos(operaciones.filter((o) => o.fecha === dia), ajustes);

  // POSICIÓN ACUMULADA: pricing con el mismo criterio, respetando "Posición al
  // [fecha]"; la posición de futuros acumulada (neteo + precio promedio +
  // valorización) queda siempre relativa a HOY, como el ajuste.
  const operacionesParaMatriz = fechaCorte ? filtrarHasta(operaciones, fechaCorte) : operaciones;
  const pricingAcum = construirMatrizPricing(operacionesParaMatriz, hoy);
  const futurosAcum = acumularFuturos(operaciones, ajustes);

  // FÍSICO SEGMENTADO POR CAMPAÑA (pedido de Lautaro 06/08/2026): "no hace
  // falta que todo se calce en la misma campaña — solo para la física sí, el
  // pricing no". Una tabla por campaña presente en los datos (nunca se
  // netea 25/26 contra 26/27: no es la misma mercadería), tanto para el día
  // como para lo acumulado.
  const campaniasDia = campaniasFisicasPresentes(operaciones);
  const fisicoDiaPorCampania = campaniasDia.map((campania) => ({
    campania,
    matriz: construirMatrizDia(operaciones, dia, hoy, construirMatrizFisicoDeCampania(campania)),
  }));
  const campaniasAcum = campaniasFisicasPresentes(operacionesParaMatriz);
  const fisicoAcumPorCampania = campaniasAcum.map((campania) => ({
    campania,
    matriz: construirMatrizFisicoDeCampania(campania)(operacionesParaMatriz, hoy),
  }));

  const heatmap = construirHeatmap(operaciones, hoy, HEATMAP_VENTANA_MAX);

  // El resumen ejecutivo (KPIs) es un encabezado, no un libro mayor: suma el
  // físico de TODAS las campañas a propósito (misma razón que el pricing) —
  // el detalle campaña por campaña vive en las tablas de abajo.
  const fisicoAcumGlobal = construirMatrizFisico(operacionesParaMatriz, hoy);
  const futurosValorizados = valorizarFuturos(operaciones, ajustes);
  const futurosMatriz = construirMatrizFuturos(operacionesParaMatriz, hoy);
  const resumen = resumenPosicion(fisicoAcumGlobal, combinarMatrices(fisicoAcumGlobal, futurosMatriz), futurosValorizados);

  return (
    <main className="wrap">
      <div className="col">
        <PageHead
          kicker="Posición neta · comprado/vendido"
          title="Mis operaciones"
          lede="Producto por período de entrega, siempre relativo a hoy."
        />
        <PosicionClient
          empresaId={empresaId}
          empresas={acceso.esAdmin ? empresas : null}
          hoy={hoy}
          dia={dia}
          fechaCorte={fechaCorte}
          pricingDia={pricingDia}
          fisicoDiaPorCampania={fisicoDiaPorCampania}
          futurosDia={futurosDia}
          pricingAcum={pricingAcum}
          fisicoAcumPorCampania={fisicoAcumPorCampania}
          futurosAcum={futurosAcum}
          heatmap={heatmap}
          resumen={resumen}
          sinOperaciones={operaciones.length === 0}
          esAdmin={acceso.esAdmin}
        />
      </div>
    </main>
  );
}
