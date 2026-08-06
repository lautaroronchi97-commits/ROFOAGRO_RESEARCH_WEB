import type { Metadata } from "next";
import { requireSeccion } from "@/lib/auth/dal";
import { authConfigured } from "@/lib/auth/env";
import { getPerfil } from "@/lib/auth/dal";
import { getCamionesPlantas } from "@/lib/camiones/plantas";
import { getCamiones } from "@/lib/camiones/camiones";
import { CamionesClient } from "@/components/camiones/camiones-client";
import { SenalCamionesPanel } from "@/components/camiones/senal-camiones";
import { PageHead } from "@/components/page-head";

/**
 * Comercio exterior · Camiones en puerto (C5 + C24 del backlog maestro; rediseño relevamiento web
 * R9, punto 53). Dos fuentes que NO se mezclan (universos distintos, ver docs/negocio/10):
 * Agroentregas (arriba) = pulso diario automático de Up River + Paraná bonaerense, por planta y
 * empresa; Williams Entregas (abajo) = las 4 zonas de todo el país con historia 2018→hoy, carga
 * manual. Los datos crudos de ambas son PÚBLICOS — decisión de Lautoro 22/07, mismo criterio que
 * la DJVE. La apertura por EMPRESA de Agroentregas y el bloque "barcos vs camiones" (señal
 * direccional) son SOLO ADMIN, mismo patrón que /comercio/page.tsx: `requireSeccion` gatea la
 * sección completa (NO-OP con AUTH_ENFORCED apagado), y el bloque de mesa se filtra aparte por
 * `esAdmin` — así la página sigue sirviendo el bloque público a un cliente logueado sin acceso de
 * mesa, y sigue 100% pública hoy.
 *
 * El fetch de las 2 fuentes vive acá (Server Component) porque `CamionesClient` necesita compartir
 * estado de cliente (filtro de grano transversal + qué tabla está abierta) entre los 2 bloques —
 * algo que 2 Server Components async independientes no pueden hacer entre sí.
 */
export const metadata: Metadata = {
  title: "Camiones en puerto · Comercio exterior · ROFO AGRO",
  description:
    "Entrada diaria de camiones a puertos, fábricas y molinos: pulso diario de Up River por planta y empresa (Agroentregas) y serie nacional por zona y producto (Williams Entregas).",
};

export default async function CamionesPage() {
  await requireSeccion("comercio", "/comercio/camiones");
  const perfil = authConfigured() ? await getPerfil() : null;
  const esAdmin = perfil?.rol === "admin";
  const [plantas, camiones] = await Promise.all([getCamionesPlantas(), getCamiones()]);

  return (
    <>
      <main className="wrap">
        <div className="col">
          <PageHead kicker="Agroentregas · Williams Entregas" title="Camiones en puerto" />
          <CamionesClient plantas={plantas} camiones={camiones} esAdmin={esAdmin} />
          {esAdmin && <SenalCamionesPanel />}
        </div>
      </main>
    </>
  );
}
