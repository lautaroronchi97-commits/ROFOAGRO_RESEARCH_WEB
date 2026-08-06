"use client";

import { useState } from "react";
import { FiltroGrano, type GranoFiltroValue } from "@/components/filtro-grano";
import { GRANO_PRODUCTO } from "@/lib/operaciones/tipos";
import type { SerieEvolucionProducto } from "@/lib/operaciones/posicion";
import { EvolucionChart } from "./evolucion-chart";

/** Filtro de grano client-side (mismo patrón que `PosicionClient`/`RegistroClient`) sobre las series ya calculadas en el server. */
export function EvolucionClient({ series }: { series: SerieEvolucionProducto[] }) {
  const [filtro, setFiltro] = useState<GranoFiltroValue>("todos");
  const visibles = filtro === "todos" ? series : series.filter((s) => s.producto === GRANO_PRODUCTO[filtro]);

  return (
    <>
      <FiltroGrano value={filtro} onChange={setFiltro} />
      <EvolucionChart series={visibles} />
    </>
  );
}
