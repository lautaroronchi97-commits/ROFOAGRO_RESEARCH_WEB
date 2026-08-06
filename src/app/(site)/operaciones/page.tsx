import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSeccion, getAcceso } from "@/lib/auth/dal";
import { getOperaciones, getEmpresasParaSelector } from "@/lib/operaciones/datos";
import {
  construirMatrizFisico,
  construirMatrizFuturos,
  combinarMatrices,
  construirHeatmap,
  filtrarHasta,
} from "@/lib/operaciones/posicion";
import { valorizarFuturos, claveAjuste, type AjusteLookup } from "@/lib/operaciones/futuros-valorizados";
import { getCierresGranos } from "@/lib/futuros";
import { hoyCordobaISO } from "@/lib/dates";
import { PageHead } from "@/components/page-head";
import { Panel, PanelHead } from "@/components/panel";
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
  searchParams: Promise<{ empresa?: string; fecha?: string }>;
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

  const [operaciones, cierres] = await Promise.all([getOperaciones(empresaId), getCierresGranos()]);

  // Las 3 matrices SÍ respetan "Posición al [fecha]" (§5.1: filtrar fecha <= corte);
  // el heatmap y el panel de futuros valorizado quedan siempre relativos a HOY
  // (el heatmap es "el patrón de los últimos N días" y el ajuste de mercado de
  // los futuros solo existe para hoy — no hay un "mark-to-market pasado" sin
  // guardar historial de ajustes, fuera de v1).
  const operacionesParaMatriz = fechaCorte ? filtrarHasta(operaciones, fechaCorte) : operaciones;
  const fisico = construirMatrizFisico(operacionesParaMatriz, hoy);
  const futuros = construirMatrizFuturos(operacionesParaMatriz, hoy);
  const total = combinarMatrices(fisico, futuros);

  const heatmap = construirHeatmap(operaciones, hoy, HEATMAP_VENTANA_MAX);
  const futurosValorizados = valorizarFuturos(operaciones, armarAjusteLookup(cierres));

  return (
    <main className="wrap">
      <div className="col">
        <PageHead
          kicker="Posición neta · comprado/vendido"
          title="Mis operaciones"
          lede="Producto por período de entrega, siempre relativo a hoy."
        />
        <Panel id="op-posicion">
          <PanelHead title="Posición" sub="acumulada, desde la primera operación cargada" />
          <PosicionClient
            empresaId={empresaId}
            empresas={acceso.esAdmin ? empresas : null}
            hoy={hoy}
            fechaCorte={fechaCorte}
            fisico={fisico}
            futuros={futuros}
            total={total}
            heatmap={heatmap}
            futurosValorizados={futurosValorizados}
            esAdmin={acceso.esAdmin}
          />
        </Panel>
      </div>
    </main>
  );
}
