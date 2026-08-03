"use client";

import { useEffect, useState } from "react";

export type NivelFrescura = "fresco" | "envejeciendo" | "viejo";

/** Umbrales relativos al revalidate de la página: 2x = empieza a envejecer, 6x = viejo. */
export function nivelFrescura(edadMs: number, revalidateSeg: number): NivelFrescura {
  const edadSeg = edadMs / 1000;
  if (edadSeg <= revalidateSeg * 2) return "fresco";
  if (edadSeg <= revalidateSeg * 6) return "envejeciendo";
  return "viejo";
}

/**
 * Semáforo visual de antigüedad (C29/Fase 2, PRELAUNCH_CHECKLIST.md): punto verde/ámbar/rojo
 * que recalcula la edad del dato con el RELOJ DEL NAVEGADOR, no con el del server al momento
 * del fetch — hoy el ⚠ de `SourceStamp` es estático (lo fija el server una sola vez). Umbral
 * relativo al `revalidateSeg` de cada página (2x/6x), así una página con ISR de 30s y otra de
 * 3600s no comparten el mismo corte fijo de minutos. Puramente cosmético: no reemplaza el
 * timestamp exacto que `SourceStamp` ya muestra, lo complementa.
 */
export function FrescuraDot({ updatedAt, revalidateSeg }: { updatedAt: number; revalidateSeg: number }) {
  const [nivel, setNivel] = useState<NivelFrescura>("fresco");

  useEffect(() => {
    const actualizar = () => setNivel(nivelFrescura(Date.now() - updatedAt, revalidateSeg));
    actualizar();
    const id = setInterval(actualizar, 15_000);
    return () => clearInterval(id);
  }, [updatedAt, revalidateSeg]);

  const etiqueta =
    nivel === "fresco" ? "dato fresco" : nivel === "envejeciendo" ? "dato envejeciendo" : "dato viejo — puede estar demorado";

  return <span className={`fresc-dot fresc-${nivel}`} title={etiqueta} suppressHydrationWarning />;
}
