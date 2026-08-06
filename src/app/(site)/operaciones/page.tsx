import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSeccion, getAcceso } from "@/lib/auth/dal";
import { getOperaciones, getEmpresasParaSelector } from "@/lib/operaciones/datos";
import { construirMatrizFisico, construirMatrizFuturos, construirMatrizPricing, construirMatrizDia, combinarMatrices } from "@/lib/operaciones/posicion";
import { valorizarFuturos, claveAjuste, type AjusteLookup } from "@/lib/operaciones/futuros-valorizados";
import { resumenPosicion } from "@/lib/operaciones/resumen";
import { getCierresGranos } from "@/lib/futuros";
import { hoyCordobaISO } from "@/lib/dates";
import { PageHead } from "@/components/page-head";
import { PosicionDiaClient } from "./posicion-client";

/**
 * "Posición diaria" (C31, docs/PLAN_OPERACIONES_CLIENTES.md §5.6 — reestructurada
 * en vuelta 4, 06/08/2026, en dos páginas separadas: acá quedan SOLO los
 * movimientos del día — pricing del día + futuros A3 del día — con su resumen
 * ejecutivo (KPIs); el historial completo/acumulado vive en
 * `/operaciones/acumulada`. Físico del día y el heatmap se sacaron de la vista
 * (pedido explícito de Lautaro), el código queda intacto en el repo.
 * `requireSeccion("operaciones")` + RLS por `empresa_id` (§4.4): la posición
 * nunca mezcla filas de otra empresa, ni para un cliente ni por accidente de
 * código — Postgres se lo niega igual.
 */
export const metadata: Metadata = {
  title: "Posición diaria · Mis operaciones · ROFO AGRO",
  description: "Movimientos del día sobre la posición inicial acumulada.",
  robots: { index: false, follow: false },
};

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  searchParams: Promise<{ empresa?: string; dia?: string }>;
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
          <PageHead kicker="Movimientos del día" title="Posición diaria" />
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
  const dia = sp.dia && FECHA_RE.test(sp.dia) && sp.dia <= hoy ? sp.dia : hoy;

  const [operaciones, cierres] = await Promise.all([getOperaciones(empresaId), getCierresGranos()]);
  const ajustes = armarAjusteLookup(cierres);

  // PRICING DEL DÍA (pedido de Lautaro 06/08/2026): posición inicial = lo
  // acumulado A PRECIO hasta el día anterior (sumando TODAS las campañas — es
  // exposición en $, no identidad de grano) + futuros del día valorizados con
  // el ajuste de HOY (no hay mark-to-market pasado sin historial de ajustes).
  // Integridad por construcción: inicial + neto del día = acumulado al cierre
  // de ese día, testeado también contra el camino independiente en
  // posicion.test.ts.
  const pricingDia = construirMatrizDia(operaciones, dia, hoy, construirMatrizPricing);
  const futurosDia = valorizarFuturos(operaciones.filter((o) => o.fecha === dia), ajustes);

  // Resumen ejecutivo (KPIs): el TOTAL acumulado a HOY (no el neto del día),
  // sumando el físico de TODAS las campañas a propósito (misma razón que el
  // pricing) — el detalle campaña por campaña vive en Posición acumulada.
  const fisicoAcumGlobal = construirMatrizFisico(operaciones, hoy);
  const futurosValorizados = valorizarFuturos(operaciones, ajustes);
  const futurosMatriz = construirMatrizFuturos(operaciones, hoy);
  const resumen = resumenPosicion(fisicoAcumGlobal, combinarMatrices(fisicoAcumGlobal, futurosMatriz), futurosValorizados);

  return (
    <main className="wrap">
      <div className="col">
        <PageHead kicker="Movimientos del día" title="Posición diaria" lede="Sobre la posición inicial acumulada, siempre relativo a hoy." />
        <PosicionDiaClient
          empresaId={empresaId}
          empresas={acceso.esAdmin ? empresas : null}
          hoy={hoy}
          dia={dia}
          pricingDia={pricingDia}
          futurosDia={futurosDia}
          resumen={resumen}
          sinOperaciones={operaciones.length === 0}
          esAdmin={acceso.esAdmin}
        />
      </div>
    </main>
  );
}
