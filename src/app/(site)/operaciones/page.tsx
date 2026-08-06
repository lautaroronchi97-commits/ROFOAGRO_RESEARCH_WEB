import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSeccion, getAcceso } from "@/lib/auth/dal";
import { getOperaciones, getEmpresasParaSelector } from "@/lib/operaciones/datos";
import {
  construirMatrizFisico,
  construirMatrizFuturos,
  construirMatrizPricing,
  construirMatrizDia,
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

  // POSICIÓN DEL DÍA (pedido de Lautaro 06/08/2026): pricing y físico del día
  // elegido, cada uno con su posición inicial (lo acumulado hasta el día
  // anterior, mismo criterio de tabla) — integridad por construcción: inicial +
  // neto del día = acumulado al cierre de ese día, testeado también contra el
  // camino independiente en posicion.test.ts. Los futuros del día se valorizan
  // con el ajuste de HOY (no hay mark-to-market pasado sin historial de ajustes).
  const pricingDia = construirMatrizDia(operaciones, dia, hoy, construirMatrizPricing);
  const fisicoDia = construirMatrizDia(operaciones, dia, hoy, construirMatrizFisico);
  const futurosDia = valorizarFuturos(operaciones.filter((o) => o.fecha === dia), ajustes);

  // POSICIÓN ACUMULADA: pricing y físico con el mismo criterio, respetando
  // "Posición al [fecha]"; la posición de futuros acumulada (neteo + precio
  // promedio + valorización) queda siempre relativa a HOY, como el ajuste.
  const operacionesParaMatriz = fechaCorte ? filtrarHasta(operaciones, fechaCorte) : operaciones;
  const pricingAcum = construirMatrizPricing(operacionesParaMatriz, hoy);
  const fisicoAcum = construirMatrizFisico(operacionesParaMatriz, hoy);
  const futurosAcum = acumularFuturos(operaciones, ajustes);

  const heatmap = construirHeatmap(operaciones, hoy, HEATMAP_VENTANA_MAX);

  // El resumen ejecutivo condensa la posición acumulada completa (físico +
  // futuros por producto) y el resultado de futuros a hoy.
  const futurosValorizados = valorizarFuturos(operaciones, ajustes);
  const futurosMatriz = construirMatrizFuturos(operacionesParaMatriz, hoy);
  const resumen = resumenPosicion(fisicoAcum, combinarMatrices(fisicoAcum, futurosMatriz), futurosValorizados);

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
          fisicoDia={fisicoDia}
          futurosDia={futurosDia}
          pricingAcum={pricingAcum}
          fisicoAcum={fisicoAcum}
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
