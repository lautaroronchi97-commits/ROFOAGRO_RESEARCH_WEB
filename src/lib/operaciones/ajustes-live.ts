import "server-only";
import { getCierresGranos } from "@/lib/futuros";
import { getFuturosLive } from "@/lib/a3-live";
import { ruedaAgroCorrioHoy } from "@/lib/rueda";
import { esModoOperado, referenciaDeFila } from "@/lib/referencia-futuro";
import { hoyCordobaISO } from "@/lib/dates";
import { claveAjuste, type AjusteLookup } from "./futuros-valorizados";

/**
 * `AjusteLookup` para valorizar los futuros de "Mis operaciones" (pedido de
 * Lautaro 06/08/2026: "siempre refrescando y valorizando contra el último
 * operado, es el dato que vamos trayendo del websocket") — MISMA regla que ya
 * usa Arbitrajes/Pases (`arbitrajes-table.tsx`, `referencia-futuro.ts`), acá
 * reusada tal cual en vez de duplicarla: fuera de rueda (o si el ajuste del
 * día ya salió, o sin feed A3) → el último AJUSTE (settlement del cierre);
 * durante la rueda con feed vivo → el último OPERADO en tiempo real (A3
 * websocket). Se abre por regeneración ISR de cada página, como el resto del
 * sitio — no hay cron nuevo.
 */
export async function construirAjusteLookupLive(): Promise<AjusteLookup> {
  const [{ granos }, live] = await Promise.all([getCierresGranos(), getFuturosLive()]);
  const ruedaCorrio = ruedaAgroCorrioHoy();
  const hoy = hoyCordobaISO();
  const liveOk = live.respondidos > 0;

  const mapa: AjusteLookup = new Map();
  for (const g of granos) {
    const ajusteEsDeHoy = g.fecha === hoy;
    const modoOperado = esModoOperado({ ruedaCorrio, ajusteEsDeHoy, liveOk });
    for (const p of g.posiciones) {
      const punta = live.puntas.get(p.symbol);
      const rf = referenciaDeFila({
        modoOperado,
        last: punta?.last ?? null,
        ajuste: p.settlement,
        variacionCierre: null,
        volLive: punta?.vol ?? null,
      });
      mapa.set(claveAjuste(g.underlying, p.posicion), rf.ref);
    }
  }
  return mapa;
}
