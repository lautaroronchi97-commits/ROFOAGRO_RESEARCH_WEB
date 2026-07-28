import type { Metadata } from "next";
import { requireSeccion } from "@/lib/auth/dal";
import { authConfigured } from "@/lib/auth/env";
import { getPerfil } from "@/lib/auth/dal";
import { CamionesPanel } from "@/components/camiones/camiones-panel";
import { SenalCamionesPanel } from "@/components/camiones/senal-camiones";
import { PageHead } from "@/components/page-head";

/**
 * Comercio exterior · Camiones en puerto (C5 del backlog maestro). Los datos crudos (entrada
 * diaria por zona y producto, Williams Entregas) son PÚBLICOS — decisión de Lautoro 22/07, mismo
 * criterio que la DJVE. El bloque "barcos vs camiones" (señal direccional de mesa) es SOLO ADMIN,
 * mismo patrón que /comercio/page.tsx: `requireSeccion` gatea la sección completa (NO-OP con
 * AUTH_ENFORCED apagado), y el bloque de mesa se filtra aparte por `esAdmin` — así la página sigue
 * sirviendo el bloque público a un cliente logueado sin acceso de mesa, y sigue 100% pública hoy.
 */
export const metadata: Metadata = {
  title: "Camiones en puerto · Comercio exterior · ROFO AGRO",
  description: "Entrada diaria de camiones a puertos, fábricas y molinos por zona y producto (Williams Entregas).",
};

export default async function CamionesPage() {
  await requireSeccion("comercio");
  const perfil = authConfigured() ? await getPerfil() : null;
  const esAdmin = perfil?.rol === "admin";

  return (
    <>
      <main className="wrap">
        <div className="col">
          <PageHead kicker="Williams Entregas · zona y producto" title="Camiones en puerto" />
          <CamionesPanel />
          {esAdmin && <SenalCamionesPanel />}
        </div>
      </main>
    </>
  );
}
