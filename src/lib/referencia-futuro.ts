/**
 * Regla de la REFERENCIA de un futuro A3 (pedido de Lautaro, 07/2026, extraída de
 * `arbitrajes-table.tsx` en R1 para reusarla en la home sin duplicarla):
 *   - Fuera de rueda (o ajuste del día ya publicado, o sin feed A3) → último AJUSTE.
 *   - En rueda con feed vivo → último OPERADO (queda "—" hasta la 1ª operación).
 * La variación acompaña a la referencia: en modo operado se recalcula EN VIVO
 * (last − ajuste anterior); en modo ajuste vale la del cierre oficial (CEM).
 * Lib pura y sin `server-only`: testeable con Vitest.
 */

export type RefFutura = {
  ref: number | null;
  refMode: "operado" | "ajuste";
  /** Operó HOY de verdad (volumen en vivo > 0) y hay último operado. */
  vivo: boolean;
  variacion: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** ¿La 1ª columna está en modo "último operado"? (rueda corrió hoy, el ajuste del
 *  día todavía no salió y el feed A3 está respondiendo). */
export function esModoOperado(args: { ruedaCorrio: boolean; ajusteEsDeHoy: boolean; liveOk: boolean }): boolean {
  return args.ruedaCorrio && !args.ajusteEsDeHoy && args.liveOk;
}

export function referenciaDeFila(args: {
  modoOperado: boolean;
  last: number | null;
  ajuste: number | null;
  variacionCierre: number | null;
  volLive: number | null;
}): RefFutura {
  const { modoOperado, last, ajuste, variacionCierre, volLive } = args;
  const operoHoy = volLive != null && volLive > 0;
  if (!modoOperado) {
    return { ref: ajuste, refMode: "ajuste", vivo: false, variacion: variacionCierre };
  }
  return {
    ref: last,
    refMode: "operado",
    vivo: operoHoy && last != null,
    variacion: last != null && ajuste != null ? round2(last - ajuste) : null,
  };
}
