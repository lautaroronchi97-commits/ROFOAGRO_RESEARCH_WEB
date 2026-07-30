/**
 * Marca de agua ROFO AGRO para gráficos: el logo completo (isotipo + wordmark),
 * centrado y muy tenue, DENTRO del contenedor de cada chart.
 *
 * Uso (integradores):
 *   - Insertarlo como hijo del contenedor del gráfico. El contenedor padre DEBE
 *     ser `position:relative` (`.chart-wrap` ya lo es; si el chart vive en otro
 *     wrapper, agregarle `position:relative`).
 *   - Tamaño por defecto (~55% del ancho) y opacidad salen de `.cm-marca` en
 *     globals.css, para que la mayoría de los charts queden iguales.
 *     `tamaño="chico"` (`.cm-marca.chico`, tope 220px) es para charts de POCAS
 *     columnas muy espaciadas (ej. el combinado delta+TNA de "A fijar", R4): con
 *     4-6 barras el logo al 55% tapaba 2-3 de ellas — la propia intención del
 *     componente es "sutil, nunca compite con las líneas de datos" (ver abajo),
 *     así que ahí es un tamaño que no cumple esa intención, no un cambio de
 *     política. La opacidad NO cambia (se mantiene igual en los dos tamaños).
 *   - Asset: `public/rofoagro-logo-marca.svg` — derivado del logo real sin los halos
 *     pálidos del auto-trace (se veían como bordes raros sobre el tema oscuro).
 *   - Queda debajo de tooltips/crosshairs (z-index:0 vs. `.cv-tip` z-index:5) y no
 *     intercepta el mouse (`pointer-events:none`).
 *
 * Server-safe: sin estado ni handlers, no agrega JS al cliente.
 * OJO: no confundir con `watermark.tsx` (marca de agua del email del login).
 */
export function ChartMarca({ tamano = "normal" }: { tamano?: "normal" | "chico" }) {
  return (
    <div className={`cm-marca${tamano === "chico" ? " chico" : ""}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG de marca estático, no imagen de contenido */}
      <img src="/rofoagro-logo-marca.svg" alt="" loading="lazy" decoding="async" />
    </div>
  );
}
