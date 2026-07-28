/**
 * Export PNG del panel de gráficos (P6 del backlog maestro, "export PNG/CSV").
 * Serializa el <svg> del chart (Recharts) tal cual se ve, resolviendo las
 * variables CSS del tema (`var(--line)`, etc.) a su valor concreto — el
 * `<img>` que rasteriza el SVG no tiene acceso al `:root` de la página, así que
 * sin este paso los colores por variable salen en negro/transparente.
 * Cliente únicamente (usa document/Blob/canvas).
 */

/** Reemplaza `var(--nombre)` (con o sin fallback) por el valor computado del `:root` actual. */
function resolverVariablesCss(svgXml: string): string {
  const raiz = getComputedStyle(document.documentElement);
  return svgXml.replace(/var\((--[a-zA-Z0-9-]+)(?:,[^)]*)?\)/g, (match, nombre: string) => {
    const v = raiz.getPropertyValue(nombre).trim();
    return v || match;
  });
}

/**
 * Busca el primer <svg> dentro de `container` y lo exporta como PNG (escala 2x).
 * Agrega un pie de marca chico (texto, no depende de cargar el logo como imagen).
 */
export function exportarSvgComoPng(container: HTMLElement | null, filename: string): void {
  if (!container) return;
  const original = container.querySelector("svg");
  if (!original) return;

  const rect = original.getBoundingClientRect();
  const ancho = Math.max(1, Math.round(rect.width));
  const alto = Math.max(1, Math.round(rect.height));

  const clone = original.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(ancho));
  clone.setAttribute("height", String(alto));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const xml = resolverVariablesCss(new XMLSerializer().serializeToString(clone));
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--panel").trim() || "#ffffff";
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = ancho * scale;
    canvas.height = alto * scale;
    const ctx = canvas.getContext("2d");
    URL.revokeObjectURL(svgUrl);
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(img, 0, 0, ancho, alto);
    ctx.font = "600 11px 'Source Code Pro', monospace";
    ctx.fillStyle = "rgba(128,128,128,.6)";
    ctx.textAlign = "right";
    ctx.fillText("ROFO AGRO", ancho - 8, alto - 8);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  img.onerror = () => URL.revokeObjectURL(svgUrl);
  img.src = svgUrl;
}

/** Sanitiza un nombre de archivo (sin espacios/acentos/caracteres especiales). */
export function nombreArchivo(...partes: (string | number | null | undefined)[]): string {
  return partes
    .filter((p) => p !== null && p !== undefined && p !== "")
    .join("-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}
