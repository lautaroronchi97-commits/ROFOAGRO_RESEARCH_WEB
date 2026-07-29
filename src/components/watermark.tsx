/**
 * Marca de agua sutil (Etapa 3 del login — ver docs/PLAN_LOGIN.md §3.6): la marca +
 * el email del usuario logueado, repetidos en diagonal y muy tenues, sobre las páginas
 * de datos (disuade de compartir capturas; el email identifica la cuenta que filtró).
 * Los admins NO la ven (decisión de Lautaro, relevamiento 29/07 punto 14 — el gate
 * está en el layout, no acá). Es un Server Component (el email viene de la sesión) y
 * no agrega JS al cliente.
 *
 * Técnica: un overlay fijo `pointer-events:none` pintado con `mask-image` (el texto
 * como máscara SVG) sobre `background-color: var(--ink)`. Así el COLOR del texto sale
 * del token del tema → se ve bien en claro y en oscuro sin duplicar capas. La opacidad
 * baja (.wm en globals.css) lo mantiene sutil; `prefers-reduced-motion` no aplica
 * (es estático, sin animación).
 */
export function Watermark({ email }: { email: string }) {
  const txt = (email ? `ROFO AGRO · ${email}` : "ROFO AGRO")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  // Tile más ancho que el original (400px): "ROFO AGRO · email" es más largo que el
  // email solo y no debe cortarse en los bordes de la máscara repetida.
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='520' height='250'>` +
    `<text x='260' y='130' fill='#fff' font-family='ui-sans-serif, system-ui, sans-serif' ` +
    `font-size='14' font-weight='600' letter-spacing='1' text-anchor='middle' ` +
    `transform='rotate(-27 260 125)'>${txt}</text></svg>`;

  const src = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;

  return (
    <div
      className="wm"
      aria-hidden="true"
      style={{ ["--wm-src" as string]: src } as React.CSSProperties}
    />
  );
}
