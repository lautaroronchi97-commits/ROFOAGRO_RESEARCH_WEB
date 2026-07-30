"use client";

import * as React from "react";
import { tcImplicito, arsDesdeUsd, usdDesdeArs } from "@/lib/precio-dual";

/** Pizarra de un grano para el patrón dual $/USD (R4, puntos 38-44). */
export type GranoPizarraDual = { underlying: string; nombre: string; usd: number | null; ars: number | null };

/**
 * Selector de grano → pizarra sugerida, con edición cruzada $/USD (mismo patrón
 * que Arbitrajes, R3 punto 25): el TC es el implícito de la pizarra del grano
 * elegido, con `tcBna` (BNA online) como respaldo. Los cálculos del padre SIEMPRE
 * corren sobre USD — el padre es dueño del valor USD (`valorUsd`/`onValorUsd`),
 * este componente solo administra el ARS espejado y el estado de "manual" (azul).
 */
export function PrecioDual({
  granos,
  tcBna,
  valorUsd,
  onValorUsd,
  onGranoChange,
  onArs,
  label = "Grano",
}: {
  granos: GranoPizarraDual[];
  tcBna: number | null;
  valorUsd: string;
  onValorUsd: (v: string) => void;
  /** Se dispara SOLO al elegir un grano (no en cada tecleo) — para que el padre
   *  pueda sincronizar datos dependientes (ej. la curva canónica en "A fijar"). */
  onGranoChange?: (underlying: string) => void;
  /** El valor ARS espejado, en cada cambio — para calcs 100% en pesos (ej.
   *  pago diferido) que necesitan el sugerido en su propia moneda, no en USD. */
  onArs?: (ars: string) => void;
  label?: string;
}) {
  const [gi, setGi] = React.useState<number | null>(null);
  const [arsManual, setArsManual] = React.useState<string | null>(null);
  const grano = gi != null ? (granos[gi] ?? null) : null;
  const tc = tcImplicito(grano?.ars ?? null, grano?.usd ?? null) ?? tcBna;

  const nUsd = Number(valorUsd);
  const arsCalc = tc != null && valorUsd !== "" && Number.isFinite(nUsd) ? String(arsDesdeUsd(nUsd, tc)) : "";
  const ars = arsManual ?? arsCalc;

  React.useEffect(() => {
    onArs?.(ars);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ars]);

  if (!granos || granos.length === 0) return null;

  const elegir = (i: number) => {
    const g = granos[i];
    if (!g) return;
    setGi(i);
    setArsManual(null);
    onValorUsd(g.usd != null ? String(g.usd) : "");
    onGranoChange?.(g.underlying);
  };
  const editarUsd = (v: string) => {
    setArsManual(null);
    onValorUsd(v);
  };
  const editarArs = (v: string) => {
    setArsManual(v);
    const n = Number(v);
    if (v !== "" && Number.isFinite(n) && tc != null) onValorUsd(String(usdDesdeArs(n, tc)));
  };
  const resetear = () => {
    if (!grano) return;
    setArsManual(null);
    onValorUsd(grano.usd != null ? String(grano.usd) : "");
  };

  const editado =
    grano != null &&
    ((grano.usd != null && valorUsd !== "" && Number(valorUsd) !== grano.usd) ||
      (grano.ars != null && arsManual != null && Number(arsManual) !== grano.ars));

  return (
    <div className="curva-pick">
      <span className="curva-pick-lbl">{label}</span>
      <select aria-label="Grano" value={gi ?? ""} onChange={(e) => elegir(Number(e.target.value))}>
        <option value="" disabled>Grano…</option>
        {granos.map((g, i) => (
          <option key={g.underlying} value={i}>{g.nombre}</option>
        ))}
      </select>
      {gi != null && (
        <span className="pz-dual">
          USD{" "}
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            className={`pz-input${editado ? " manual" : ""}`}
            value={valorUsd}
            onChange={(e) => editarUsd(e.target.value)}
            aria-label="Precio USD"
          />
          {" · ARS "}
          <input
            type="number"
            inputMode="decimal"
            step="1"
            className={`pz-input${editado ? " manual" : ""}`}
            value={ars}
            onChange={(e) => editarArs(e.target.value)}
            disabled={tc == null}
            title={tc == null ? "Sin tipo de cambio del día para convertir" : undefined}
            aria-label="Precio ARS"
          />
          {editado && (
            <button type="button" className="pz-reset" title="Volver a la pizarra" onClick={resetear}>
              ↺
            </button>
          )}
        </span>
      )}
    </div>
  );
}
