"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * "Posición al [fecha]" (§5.6 item 6, Fase 2): reconstruye la matriz acumulada
 * a un cierre pasado. Sin fecha en la URL = posición completa de hoy. Conserva
 * el resto de los parámetros (`empresa` de admin, `dia` del bloque diario)
 * copiando la query actual.
 */
export function PosicionFecha({ fecha, hoy }: { fecha: string | null; hoy: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function ir(nuevaFecha: string | null) {
    const qs = new URLSearchParams(searchParams.toString());
    if (nuevaFecha) qs.set("fecha", nuevaFecha);
    else qs.delete("fecha");
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
