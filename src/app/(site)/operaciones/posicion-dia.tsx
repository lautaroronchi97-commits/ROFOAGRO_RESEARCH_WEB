"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * Selector del día de "Posición del día" (pedido de Lautaro 06/08/2026): sin
 * `?dia=` en la URL se muestra HOY. Conserva el resto de los parámetros
 * (`empresa` de admin, `fecha` del corte acumulado) copiando la query actual.
 */
export function PosicionDia({ dia, hoy }: { dia: string; hoy: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function ir(nuevoDia: string | null) {
    const qs = new URLSearchParams(searchParams.toString());
    if (nuevoDia && nuevoDia !== hoy) qs.set("dia", nuevoDia);
    else qs.delete("dia");
    const query = qs.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="op-empresa-sel">
      <span>Día</span>
      <input
        type="date"
        value={dia}
        max={hoy}
        onChange={(e) => ir(e.target.value || null)}
        className="admin-input admin-input-sm"
        aria-label="Elegir el día de la posición del día"
      />
      {dia !== hoy && (
        <button type="button" className="admin-btn admin-btn-ghost" onClick={() => ir(null)}>
          Volver a hoy
        </button>
      )}
    </label>
  );
}
