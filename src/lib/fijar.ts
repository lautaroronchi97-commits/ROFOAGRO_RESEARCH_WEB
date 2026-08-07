/**
 * Cotizador de negocios "a fijar": se parte de un DISPONIBLE (spot) y se compara
 * contra la CURVA de futuros A3. Solo se analizan los DELTAS (sin costo de
 * oportunidad) y se agrega un comparador contra una TASA editable.
 *
 *   delta        = disponible − futuro                       (delta puro)
 *   TNA impl.    = (futuro / disponible − 1) × 365/días      (tasa del carry)
 *   resultado    = compro a fijar → disponible − futuro
 *                  vendo a fijar  → futuro − disponible       (verde = a favor)
 *   precio_tasa  = disponible × (1 + tasa/100 × días/365)     (futuro teórico a tu tasa)
 *
 * Signo (fix 07/08/2026, feedback de Lautaro): "compro a fijar" es un compromiso de
 * COMPRA a un precio que se fija más adelante contra la curva de futuros — si el
 * futuro sube (queda más caro), el comprador paga más → PIERDE. "vendo a fijar" es lo
 * inverso: si el futuro sube, el vendedor cobra más → GANA. Antes el ternario tenía el
 * signo cambiado (compro daba positivo cuando el futuro subía).
 */

export type PosCurva = { vto: string; precio: number };
export type Lado = "compro" | "vendo";

export type FilaFijar = {
  vto: string;
  precio: number;
  dias: number;
  delta: number; // disponible − futuro
  tna: number; // TNA implícita del carry
  resultado: number; // según lado (verde si > 0)
  precioTasa: number; // futuro teórico a la tasa de comparación
  favorable: boolean;
};

/** `hoyMs` = epoch de hoy; `vtoMs(vto)` convierte la fecha de la posición a epoch. */
export function evaluarFijar(
  disponible: number,
  lado: Lado,
  tasaComp: number,
  curva: PosCurva[],
  hoyMs: number,
  vtoMs: (vto: string) => number | null,
): FilaFijar[] {
  return curva
    .filter((p) => p.vto && Number.isFinite(p.precio) && p.precio > 0)
    .map((p) => {
      const t = vtoMs(p.vto);
      const dias = t ? Math.max(0, Math.round((t - hoyMs) / 86400000)) : 0;
      const delta = disponible - p.precio;
      const tna =
        disponible > 0 && dias > 0 ? (p.precio / disponible - 1) * (365 / dias) * 100 : NaN;
      const resultado = lado === "compro" ? disponible - p.precio : p.precio - disponible;
      const precioTasa =
        disponible > 0 && dias > 0 ? disponible * (1 + (tasaComp / 100) * (dias / 365)) : NaN;
      return { vto: p.vto, precio: p.precio, dias, delta, tna, resultado, precioTasa, favorable: resultado > 0 };
    });
}
