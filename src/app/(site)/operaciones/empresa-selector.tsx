"use client";

import { useRouter, usePathname } from "next/navigation";

/**
 * Selector de empresa, SOLO para admins (§5.6.8, §1.18): "Mi posición"/"Registro
 * diario" es la MISMA página que usa un cliente — para un admin, elegir acá
 * cambia de qué empresa está viendo/editando, sin duplicar nada en `/admin`. Los
 * clientes nunca ven este control (el caller no lo renderiza para ellos), y aunque
 * alguien forjara `?empresa=` en la URL, la RLS de `operaciones` lo rebota igual.
 */
export function EmpresaSelector({
  empresas,
  empresaId,
  fecha,
}: {
  empresas: { id: string; nombre: string }[];
  empresaId: string;
  fecha?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <label className="op-empresa-sel">
      <span>Viendo</span>
      <select
        className="admin-input admin-input-sm"
        value={empresaId}
        onChange={(e) => {
          const qs = new URLSearchParams();
          qs.set("empresa", e.target.value);
          if (fecha) qs.set("fecha", fecha);
          router.push(`${pathname}?${qs.toString()}`);
        }}
      >
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
