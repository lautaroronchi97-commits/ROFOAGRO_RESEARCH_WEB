"use client";

import { useRouter, usePathname } from "next/navigation";

/**
 * "Posición al [fecha]" (§5.6 item 6, Fase 2): reconstruye la matriz a un
 * cierre pasado. Sin fecha en la URL = posición completa de hoy (comportamiento
 * de la Fase 1, sin cambios). Conserva `?empresa=` si un admin la eligió.
 */
export function PosicionFecha({ fecha, hoy, empresaId }: { fecha: string | null; hoy: string; empresaId?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function ir(nuevaFecha: string | null) {
    const qs = new URLSearchParams();
    if (nuevaFecha) qs.set("fecha", nuevaFecha);
    if (empresaId) qs.set("empresa", empresaId);
    const query = qs.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="op-empresa-sel">
      <span>Posición al</span>
      <input
        type="date"
        value={fecha ?? hoy}
        max={hoy}
        onChange={(e) => ir(e.target.value === hoy ? null : e.target.value)}
        className="admin-input admin-input-sm"
        aria-label="Reconstruir la posición a una fecha pasada"
      />
      {fecha && (
        <button type="button" className="admin-btn admin-btn-ghost" onClick={() => ir(null)}>
          Volver a hoy
        </button>
      )}
    </label>
  );
}
