import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSeccion, getAcceso } from "@/lib/auth/dal";
import {
  getOperacionesDelDia,
  getEmpresasParaSelector,
  getHistorialDe,
  getPizarrasCandidatas,
} from "@/lib/operaciones/datos";
import { getCurvaGranos } from "@/lib/curva";
import { campaniasVigentes, elegirPizarraSiguiente, resolverPrecio, sumarDiasISO, type PrecioResuelto } from "@/lib/operaciones/registro";
import { hoyCordobaISO } from "@/lib/dates";
import type { OperacionLogEntry, OperacionProducto } from "@/lib/operaciones/tipos";
import { PageHead } from "@/components/page-head";
import { Panel, PanelHead } from "@/components/panel";
import { RegistroClient } from "./registro-client";

/**
 * Carga de negocios (C31, docs/PLAN_OPERACIONES_CLIENTES.md §5.6/§8 — renombrada
 * de "Registro diario" a pedido de Lautaro 06/08/2026, vuelta 4; la ruta
 * `/operaciones/registro` no se tocó): carga de compras/ventas del día + neto
 * del día. Mismo `empresaId` explícito que `/operaciones` (nunca del form para
 * un cliente — sale de `getAcceso()`).
 */
export const metadata: Metadata = {
  title: "Carga de negocios · Mis operaciones · ROFO AGRO",
  description: "Cargá tus compras y ventas del día y consultá el neto por producto y período.",
  robots: { index: false, follow: false },
};

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; empresa?: string }>;
}) {
  await requireSeccion("operaciones", "/operaciones/registro");
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

  const hoy = hoyCordobaISO();
  const fecha = sp.fecha && FECHA_RE.test(sp.fecha) ? sp.fecha : hoy;

  if (!empresaId) {
    return (
      <main className="wrap">
        <div className="col">
          <PageHead kicker="Carga diaria · solo tu empresa" title="Registro de operaciones" />
          <p className="dim">
            {acceso.esAdmin
              ? "Todavía no hay empresas cargadas."
              : "Tu cuenta todavía no tiene una empresa asignada — pedile a la mesa que te la habilite."}
          </p>
        </div>
      </main>
    );
  }

  const [operacionesDelDia, curva] = await Promise.all([
    getOperacionesDelDia(empresaId, fecha),
    getCurvaGranos(),
  ]);

  // Resolución de precio "pizarra" (§5.4): todas las operaciones del día comparten
  // la misma `fecha`, así que alcanza con UNA consulta por producto involucrado.
  const productosPizarra = [
    ...new Set(operacionesDelDia.filter((o) => o.precio_modo === "pizarra").map((o) => o.producto)),
  ] as OperacionProducto[];
  const candidatasPorProducto = new Map<OperacionProducto, Awaited<ReturnType<typeof getPizarrasCandidatas>>>();
  if (productosPizarra.length > 0) {
    const hasta = sumarDiasISO(fecha, 7);
    await Promise.all(
      productosPizarra.map(async (p) => {
        candidatasPorProducto.set(p, await getPizarrasCandidatas(p, fecha, hasta));
      }),
    );
  }

  const precios: Record<string, PrecioResuelto> = {};
  for (const op of operacionesDelDia) {
    const candidatas = op.precio_modo === "pizarra" ? (candidatasPorProducto.get(op.producto) ?? []) : [];
    const siguiente = op.precio_modo === "pizarra" ? elegirPizarraSiguiente(op.fecha, candidatas) : null;
    precios[op.id] = resolverPrecio(op, siguiente);
  }

  const ids = operacionesDelDia.map((o) => o.id);
  const historialMapa = await getHistorialDe(ids);
  const historial: Record<string, OperacionLogEntry[]> = Object.fromEntries(historialMapa);

  return (
    <main className="wrap">
      <div className="col">
        <PageHead kicker="Carga diaria · solo tu empresa" title="Carga de negocios" />
        <Panel id="op-registro">
          <PanelHead title="Carga de negocios" sub="compras, ventas y neto del día" />
          <RegistroClient
            empresaId={empresaId}
            empresas={acceso.esAdmin ? empresas : null}
            fecha={fecha}
            operaciones={operacionesDelDia}
            historial={historial}
            precios={precios}
            curva={curva.granos}
            campanias={campaniasVigentes(hoy)}
          />
        </Panel>
      </div>
    </main>
  );
}
