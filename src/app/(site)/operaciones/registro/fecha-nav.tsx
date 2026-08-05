"use client";

import { useRouter, usePathname } from "next/navigation";
import { sumarDiasISO } from "@/lib/operaciones/registro";

/** Navegación de día (anterior/siguiente/fecha exacta) — conserva `?empresa=` si un admin la eligió. */
export function FechaNav({ fecha, empresaId }: { fecha: string; empresaId?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function ir(nuevaFecha: string) {
    const qs = new URLSearchParams();
    qs.set("fecha", nuevaFecha);
    if (empresaId) qs.set("empresa", empresaId);
    router.push(`${pathname}?${qs.toString()}`);
  }

  return (
    <div className="op-fecha-nav">
      <button type="button" className="admin-btn admin-btn-ghost" onClick={() => ir(sumarDiasISO(fecha, -1))}>
        ← Día anterior
      </button>
      <input
        type="date"
        value={fecha}
        onChange={(e) => e.target.value && ir(e.target.value)}
        className="admin-input admin-input-sm"
        aria-label="Fecha del registro"
      />
      <button type="button" className="admin-btn admin-btn-ghost" onClick={() => ir(sumarDiasISO(fecha, 1))}>
        Día siguiente →
      </button>
    </div>
  );
}
