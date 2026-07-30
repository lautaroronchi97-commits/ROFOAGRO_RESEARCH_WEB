import { vencKeyDePosicion } from "./dates";
import type { PosCurva } from "./curva-types";

/**
 * Posiciones canónicas por grano para el default de "A fijar" (R4, punto 38,
 * respuestas §5.4 del plan: trigo = DIC/ENE/MAR/JUL/SEP). Reemplaza el
 * `CURVA_INI` hardcodeado (fechas/precios inventados) — se resuelven contra la
 * curva REAL de A3 en `posicionesCanonicasVivas`.
 */
export const POSICIONES_CANONICAS: Record<string, string[]> = {
  SOJ: ["JUL", "SEP", "NOV", "ENE", "MAY"],
  MAI: ["ABR", "JUL", "SEP", "DIC", "ENE", "MAR"],
  TRI: ["DIC", "ENE", "MAR", "JUL", "SEP"],
};

/**
 * Filtra `posiciones` (ya vivas, ver `getCurvaGranos`) a las canónicas de ese
 * grano — nunca vencidas, máx. 1 año hacia adelante (`hoyVK + 100` en la
 * codificación aaaamm), una por etiqueta de mes (la más próxima si hay más de
 * una campaña vigente). Orden final: por vencimiento.
 */
export function posicionesCanonicasVivas(underlying: string, posiciones: PosCurva[], hoyVK: number): PosCurva[] {
  const meses = POSICIONES_CANONICAS[underlying];
  if (!meses) return [];
  const limite = hoyVK + 100;
  const elegidas: PosCurva[] = [];
  for (const mon of meses) {
    const candidatas = posiciones
      .filter((p) => p.posicion.toUpperCase().startsWith(mon))
      .filter((p) => {
        const vk = vencKeyDePosicion(p.posicion);
        return vk >= hoyVK && vk <= limite;
      })
      .sort((a, b) => vencKeyDePosicion(a.posicion) - vencKeyDePosicion(b.posicion));
    if (candidatas[0]) elegidas.push(candidatas[0]);
  }
  return elegidas.sort((a, b) => vencKeyDePosicion(a.posicion) - vencKeyDePosicion(b.posicion));
}

export type PuntasVivo = { bid: number | null; ask: number | null; last: number | null };
export type PrecioFuturoEstado = { precio: number; estimado: boolean };

/**
 * Precio a mostrar para una posición de "A fijar": último operado del
 * WebSocket (real, sin badge) → promedio bid/ask del WS si no operó todavía
 * (badge "estimado") → último cierre (`futuros_cierres_ultimo`, ninguna de las
 * dos anteriores disponible — no lleva badge, es un dato de cierre normal).
 */
export function precioFuturoConVivo(cierre: number, puntas: PuntasVivo | undefined): PrecioFuturoEstado {
  if (puntas?.last != null) return { precio: puntas.last, estimado: false };
  if (puntas?.bid != null && puntas?.ask != null) return { precio: (puntas.bid + puntas.ask) / 2, estimado: true };
  return { precio: cierre, estimado: false };
}
