import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSeccion, getAcceso } from "@/lib/auth/dal";
import { getOperaciones, getEmpresasParaSelector } from "@/lib/operaciones/datos";
import { construirMatrizPricing, construirMatrizDia } from "@/lib/operaciones/posicion";
import { valorizarFuturos } from "@/lib/operaciones/futuros-valorizados";
import { construirAjusteLookupLive } from "@/lib/operaciones/ajustes-live";
import { resumenPosicion } from "@/lib/operaciones/resumen";
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

  const [operaciones, ajustes] = await Promise.all([getOperaciones(empresaId), construirAjusteLookupLive()]);

  // PRICING DEL DÍA (pedido de Lautaro 06/08/2026): posición inicial = lo
  // acumulado A PRECIO hasta el día anterior (sumando TODAS las campañas — es
  // exposición en $, no identidad de grano) + futuros del día valorizados
  // contra la referencia viva (§5.5, "siempre refrescando y valorizando
  // contra el último operado" — en rueda es el último operado del websocket
  // de A3, fuera de rueda el último ajuste; `construirAjusteLookupLive`).
  // Integridad por construcción: inicial + neto del día = acumulado al cierre
  // de ese día, testeado también contra el camino independiente en
  // posicion.test.ts.
  const pricingDia = construirMatrizDia(operaciones, dia, hoy, construirMatrizPricing);
  const futurosDia = valorizarFuturos(operaciones.filter((o) => o.fecha === dia), ajustes);

  // Resumen ejecutivo (KPIs, pedido de Lautaro 06/08/2026 — vuelta 4): el
  // TOTAL de pricing acumulado a HOY (mercadería con precio + fijaciones +
  // futuros, NO el físico crudo — "no me importa el % de calzado ni el
  // físico"), sumando TODAS las campañas a propósito (misma razón que la
  // tabla de Pricing acumulado) — el detalle campaña por campaña vive en
  // Posición acumulada.
  const resumen = resumenPosicion(construirMatrizPricing(operaciones, hoy));

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
