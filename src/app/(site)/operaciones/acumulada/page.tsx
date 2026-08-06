import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSeccion, getAcceso } from "@/lib/auth/dal";
import { getOperaciones, getEmpresasParaSelector } from "@/lib/operaciones/datos";
import {
  construirMatrizPricing,
  campaniasFisicasPresentes,
  construirMatrizFisicoDeCampania,
  filtrarHasta,
  type FiltroPrecioFisico,
  type Matriz,
} from "@/lib/operaciones/posicion";
import { acumularFuturos, claveAjuste, type AjusteLookup } from "@/lib/operaciones/futuros-valorizados";
import { getCierresGranos } from "@/lib/futuros";
import { hoyCordobaISO } from "@/lib/dates";
import { PageHead } from "@/components/page-head";
import { PosicionAcumuladaClient } from "./posicion-acumulada-client";

/**
 * "Posición acumulada" (C31, docs/PLAN_OPERACIONES_CLIENTES.md §5.6 —
 * reestructurada en vuelta 4, 06/08/2026, en página propia: "quiero que crees
 * mi posición acumulada así como existe posición diaria, para llevarlo por
 * separado"): el historial completo desde la primera operación cargada —
 * pricing acumulado, físico acumulado por campaña (con el filtro de negocios
 * con precio/todos/a fijar) y la posición de futuros acumulada, con el
 * selector "Posición al [fecha]". `requireSeccion("operaciones")` + RLS por
 * `empresa_id` (§4.4), mismo criterio que `/operaciones`.
 */
export const metadata: Metadata = {
  title: "Posición acumulada · Mis operaciones · ROFO AGRO",
  description: "Posición neta comprado/vendido por producto y período de entrega, desde la primera operación.",
  robots: { index: false, follow: false },
};

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const FILTROS_PRECIO: FiltroPrecioFisico[] = ["todos", "con_precio", "a_fijar"];

/** `Map<"GRANO|POSICION", settlement>` desde `getCierresGranos()` — el ajuste de hoy para valorizar futuros (§5.5). */
function armarAjusteLookup(cierres: Awaited<ReturnType<typeof getCierresGranos>>): AjusteLookup {
  const mapa: AjusteLookup = new Map();
  for (const grano of cierres.granos) {
    for (const p of grano.posiciones) mapa.set(claveAjuste(grano.underlying, p.posicion), p.settlement);
  }
  return mapa;
}

export default async function OperacionesAcumuladaPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; fecha?: string }>;
}) {
  await requireSeccion("operaciones", "/operaciones/acumulada");
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
          <PageHead kicker="Desde la primera operación" title="Posición acumulada" />
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

  const [operaciones, cierres] = await Promise.all([getOperaciones(empresaId), getCierresGranos()]);
  const ajustes = armarAjusteLookup(cierres);

  // Pricing con el mismo criterio que Posición diaria, respetando "Posición al
  // [fecha]"; la posición de futuros acumulada (neteo + precio promedio +
  // valorización) queda siempre relativa a HOY, como el ajuste — no hay
  // mark-to-market pasado sin historial de ajustes.
  const operacionesParaMatriz = fechaCorte ? filtrarHasta(operaciones, fechaCorte) : operaciones;
  const pricingAcum = construirMatrizPricing(operacionesParaMatriz, hoy);
  const futurosAcum = acumularFuturos(operaciones, ajustes);

  // FÍSICO SEGMENTADO POR CAMPAÑA (pedido de Lautaro 06/08/2026): "no hace
  // falta que todo se calce en la misma campaña — solo para la física sí, el
  // pricing no". Una tabla por campaña presente en los datos (nunca se netea
  // 25/26 contra 26/27: no es la misma mercadería), con las 3 variantes del
  // filtro de negocios (todos/con precio/a fijar) calculadas de una — el
  // cliente elige cuál mostrar sin volver a pedirle nada al servidor.
  const campaniasAcum = campaniasFisicasPresentes(operacionesParaMatriz);
  const fisicoAcumPorCampania = campaniasAcum.map((campania) => ({
    campania,
    matrices: Object.fromEntries(
      FILTROS_PRECIO.map((filtro) => [filtro, construirMatrizFisicoDeCampania(campania, filtro)(operacionesParaMatriz, hoy)]),
    ) as Record<FiltroPrecioFisico, Matriz>,
  }));

  return (
    <main className="wrap">
      <div className="col">
        <PageHead
          kicker="Desde la primera operación"
          title="Posición acumulada"
          lede="Producto por período de entrega, con todo el historial cargado."
        />
        <PosicionAcumuladaClient
          empresaId={empresaId}
          empresas={acceso.esAdmin ? empresas : null}
          hoy={hoy}
          fechaCorte={fechaCorte}
          pricingAcum={pricingAcum}
          fisicoAcumPorCampania={fisicoAcumPorCampania}
          futurosAcum={futurosAcum}
          sinOperaciones={operaciones.length === 0}
          esAdmin={acceso.esAdmin}
        />
      </div>
    </main>
  );
}
