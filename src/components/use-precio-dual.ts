"use client";

import * as React from "react";
import { tcImplicito, arsDesdeUsd, usdDesdeArs } from "@/lib/precio-dual";

/** Pizarra de un grano para el patrón dual $/USD (R4, puntos 38-44). */
export type GranoPizarraDual = { underlying: string; nombre: string; usd: number | null; ars: number | null };

/**
 * Estado + handlers del patrón dual $/USD (grano → pizarra sugerida, edición
 * cruzada $/USD, azul-manual) — SIN opinión de layout. Cada calc renderiza sus
 * propios `.calc-field` (mismo idioma visual que el resto de sus campos, en vez
 * de un widget compacto aparte) y les cablea lo que este hook devuelve. El TC es
 * el implícito de la pizarra del grano elegido, con `tcBna` como respaldo.
 */
export function usePrecioDual(tcBna: number | null, usdInicial = "", arsInicial: string | null = null) {
  const [grano, setGrano] = React.useState<GranoPizarraDual | null>(null);
  const [usd, setUsdRaw] = React.useState(usdInicial);
  const [arsManual, setArsManual] = React.useState<string | null>(arsInicial);

  const tc = tcImplicito(grano?.ars ?? null, grano?.usd ?? null) ?? tcBna;
  const nUsd = Number(usd);
  const arsCalc = tc != null && usd !== "" && Number.isFinite(nUsd) ? String(arsDesdeUsd(nUsd, tc)) : "";
  const ars = arsManual ?? arsCalc;

  const elegir = (g: GranoPizarraDual) => {
    setGrano(g);
    setArsManual(null);
    setUsdRaw(g.usd != null ? String(g.usd) : "");
  };
  const setUsd = (v: string) => {
    setArsManual(null);
    setUsdRaw(v);
  };
  const setArs = (v: string) => {
    setArsManual(v);
    const n = Number(v);
    if (v !== "" && Number.isFinite(n) && tc != null) setUsdRaw(String(usdDesdeArs(n, tc)));
  };
  const reset = () => {
    if (!grano) return;
    setArsManual(null);
    setUsdRaw(grano.usd != null ? String(grano.usd) : "");
  };

  const editado =
    grano != null &&
    ((grano.usd != null && usd !== "" && Number(usd) !== grano.usd) ||
      (grano.ars != null && arsManual != null && Number(arsManual) !== grano.ars));

  return { grano, usd, ars, tc, editado, elegir, setUsd, setArs, reset };
}
