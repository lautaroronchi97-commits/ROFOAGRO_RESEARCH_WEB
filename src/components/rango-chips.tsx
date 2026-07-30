"use client";

/**
 * Selector de plazo/ventana para gráficos de `/dolar` (relevamiento web R6,
 * punto 32: "el máximo actual está bien, poder achicar"). Mismo patrón visual
 * `.fg-bar`/`.fg-chip` que ya usa el toggle semanal/diaria de la volatilidad —
 * acá es genérico (recibe las opciones), no un componente nuevo de cero.
 */
export function RangoChips<T extends string>({
  opciones,
  valor,
  onChange,
  label = "Plazo",
}: {
  opciones: { label: string; value: T }[];
  valor: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="fg-bar" role="toolbar" aria-label={label}>
      {opciones.map((o) => (
        <button
          key={o.value}
          type="button"
          className="fg-chip"
          aria-pressed={valor === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
