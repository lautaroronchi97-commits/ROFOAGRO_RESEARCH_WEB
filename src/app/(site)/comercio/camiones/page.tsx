import type { Metadata } from "next";
import { requireSeccion } from "@/lib/auth/dal";
import { authConfigured } from "@/lib/auth/env";
import { getPerfil } from "@/lib/auth/dal";
import { CamionesPanel } from "@/components/camiones/camiones-panel";
import { CamionesPlantasPanel } from "@/components/camiones/plantas-panel";
import { SenalCamionesPanel } from "@/components/camiones/senal-camiones";
import { PageHead } from "@/components/page-head";

/**
 * Comercio exterior · Camiones en puerto (C5 + C24 del backlog maestro). Dos fuentes que NO se
 * mezclan (universos distintos, ver docs/negocio/10): **Agroentregas** (C24, arriba) = pulso diario
 * automático de Up River + Paraná bonaerense, por planta y empresa; **Williams Entregas** (C5,
 * abajo) = las 4 zonas de todo el país con historia 2018→hoy, carga manual. Los datos crudos de
 * ambas son PÚBLICOS — decisión de Lautoro 22/07, mismo criterio que la DJVE. La apertura por
 * EMPRESA de Agroentregas y el bloque "barcos vs camiones" (señal direccional) son SOLO ADMIN,
 * mismo patrón que /comercio/page.tsx: `requireSeccion` gatea la sección completa (NO-OP con
 * AUTH_ENFORCED apagado), y el bloque de mesa se filtra aparte por `esAdmin` — así la página sigue
 * sirviendo el bloque público a un cliente logueado sin acceso de mesa, y sigue 100% pública hoy.
 */
export const metadata: Metadata = {
  title: "Camiones en puerto · Comercio exterior · ROFO AGRO",
  description:
    "Entrada diaria de camiones a puertos, fábricas y molinos: pulso diario de Up River por planta y empresa (Agroentregas) y serie nacional por zona y producto (Williams Entregas).",
};

export default async function CamionesPage() {
  await requireSeccion("comercio");
  const perfil = authConfigured() ? await getPerfil() : null;
  const esAdmin = perfil?.rol === "admin";

  return (
    <>
      <main className="wrap">
        <div className="col">
          <PageHead kicker="Agroentregas · Williams Entregas" title="Camiones en puerto" />
          {/* Agroentregas primero: es el único de los dos que llega solo, todos los días (C24). */}
          <CamionesPlantasPanel mostrarEmpresas={esAdmin} />
          <CamionesPanel />
          {esAdmin && <SenalCamionesPanel />}
        </div>
      </main>
    </>
  );
}
