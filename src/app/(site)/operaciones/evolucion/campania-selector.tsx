"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * Selector de campaña para "Evolución de la posición" (06/08/2026): mismo
 * chip-bar visual que `FiltroGrano` (`.fg-bar`/`.fg-chip`), pero navega por
 * `?campania=` — el físico no puede mostrar dos campañas mezcladas en una
 * misma línea (no son la misma mercadería), así que acá SÍ hace falta elegir
 * una, a diferencia del filtro de grano (que solo oculta/muestra client-side).
 * Las opciones salen de `campaniasFisicasPresentes()` (server), nunca de una
 * lista fija: si solo hay una campaña con datos, se muestra sola sin chips.
 */
export function CampaniaSelector({ campanias, campania }: { campanias: string[]; campania: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function ir(nueva: string) {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("campania", nueva);
    router.push(`${pathname}?${qs.toString()}`);
  }

  if (campanias.length === 0) return null;
  if (campanias.length === 1) {
    return (
      <span className="op-empresa-sel">
        <span>Campaña</span> {campanias[0]}
      </span>
    );
  }
  return (
    <div className="fg-bar" role="toolbar" aria-label="Elegir campaña">
      {campanias.map((c) => (
        <button key={c} type="button" className="fg-chip" aria-pressed={c === campania} onClick={() => ir(c)}>
          {c}
        </button>
      ))}
    </div>
  );
}
