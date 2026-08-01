/** Datos mínimos de una `ViewCard` para dibujar la placa exportable (sin depender del DOM). */
export type ViewExportData = {
  granoLabel: string;
  granoEmoji: string;
  direccionLabel: string;
  colorVar: string; // nombre de la custom property (--pos/--neg/--neu), se resuelve a hex acá
  confianza: number;
  horizonte: string;
  fechaLabel: string;
  tesis: string;
  aFavor: { titulo: string; dato: string }[];
  enContra: { titulo: string; dato: string }[];
  accion: string;
  invalidacion: string;
};

function envolverTexto(ctx: CanvasRenderingContext2D, texto: string, maxWidth: number): string[] {
  const palabras = texto.split(/\s+/);
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width > maxWidth && actual) {
      lineas.push(actual);
      actual = p;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/**
 * Export PNG de una `ViewCard` (relevamiento 29/07, punto 30) dibujada A MANO con
 * `ctx.fillText`/`ctx.fillRect` — NO la técnica `<svg><foreignObject>` de
 * `exportarSvgComoPng` (esa sirve para el `<svg>` de un chart, que no tiene HTML/CSS
 * de terceros adentro). Se probó foreignObject con el HTML+CSS real de la card y
 * falló de las DOS formas conocidas del método (verificado en vivo, R3h): el CSS de
 * Tailwind v4 (`@property { syntax: "<color>" }`) rompe el XML del `<style>` si no
 * va en CDATA, y — ya arreglado eso — Chrome sigue marcando el canvas como
 * "tainted" al rasterizar CUALQUIER `foreignObject` con contenido HTML, sin
 * relación con fuentes/imágenes externas. Dibujar a mano evita el problema de raíz:
 * el canvas nunca recibe nada que no sea texto/formas propias, así que nunca se
 * tilda de "tainted".
 */
export function exportarViewComoPng(d: ViewExportData, filename: string): void {
  const raiz = getComputedStyle(document.documentElement);
  const col = (v: string) => raiz.getPropertyValue(v).trim() || "#888";
  const bg = col("--panel");
  const ink = col("--ink");
  const dim = col("--ink-3");
  const line = col("--line");
  const dirColor = col(d.colorVar);
  const gold = col("--gold-text") || col("--gold");

  const scale = 2;
  const ancho = 900;
  const padX = 32;
  const maxTextW = ancho - padX * 2;

  // Canvas de medida (mismas fuentes que el final) para calcular el alto total antes de dibujar.
  const medir = document.createElement("canvas").getContext("2d");
  if (!medir) return;
  medir.font = "400 15px 'Source Sans 3', sans-serif";
  const lineasTesis = envolverTexto(medir, d.tesis.replace(/\*\*/g, ""), maxTextW);
  medir.font = "600 13px 'Source Sans 3', sans-serif";
  const medirArg = (arr: { titulo: string; dato: string }[]) =>
    arr.flatMap((a) => envolverTexto(medir, `${a.titulo}. ${a.dato}`, maxTextW - 18));
  const lineasFavor = medirArg(d.aFavor);
  const lineasContra = medirArg(d.enContra);
  medir.font = "400 13px 'Source Sans 3', sans-serif";
  const lineasAccion = d.accion ? envolverTexto(medir, `Acción sugerida: ${d.accion}`, maxTextW) : [];
  const lineasInvalida = envolverTexto(medir, `Qué me haría cambiar de opinión: ${d.invalidacion}`, maxTextW);

  let y = 28; // cabecera
  y += 34; // grano + dirección
  y += 22; // meta (confianza/horizonte/fecha)
  y += 14;
  y += lineasTesis.length * 21 + 16;
  if (lineasFavor.length) y += 20 + lineasFavor.length * 19 + 10;
  if (lineasContra.length) y += 20 + lineasContra.length * 19 + 10;
  if (lineasAccion.length) y += lineasAccion.length * 18 + 10;
  y += lineasInvalida.length * 18 + 10;
  const alto = y + 36; // pie de marca

  const canvas = document.createElement("canvas");
  canvas.width = ancho * scale;
  canvas.height = alto * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, ancho, alto);
  ctx.fillStyle = dirColor;
  ctx.fillRect(0, 0, ancho, 4);

  let cy = 28;
  ctx.textAlign = "left";
  ctx.fillStyle = ink;
  ctx.font = "700 20px 'Source Serif 4', serif";
  ctx.fillText(`${d.granoEmoji} ${d.granoLabel}`, padX, cy);
  ctx.fillStyle = dirColor;
  ctx.font = "700 16px 'Source Sans 3', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(d.direccionLabel, ancho - padX, cy - 2);
  cy += 26;

  ctx.textAlign = "left";
  ctx.fillStyle = dim;
  ctx.font = "400 13px 'Source Code Pro', monospace";
  ctx.fillText(`Confianza ${d.confianza}/5 · ${d.horizonte} · view del ${d.fechaLabel}`, padX, cy);
  cy += 22;

  ctx.strokeStyle = line;
  ctx.beginPath();
  ctx.moveTo(padX, cy);
  ctx.lineTo(ancho - padX, cy);
  ctx.stroke();
  cy += 24;

  ctx.fillStyle = ink;
  ctx.font = "400 15px 'Source Sans 3', sans-serif";
  for (const l of lineasTesis) {
    ctx.fillText(l, padX, cy);
    cy += 21;
  }
  cy += 8;

  const bloqueArgs = (titulo: string, lineas: string[]) => {
    if (!lineas.length) return;
    ctx.font = "700 13px 'Source Sans 3', sans-serif";
    ctx.fillStyle = ink;
    ctx.fillText(titulo, padX, cy);
    cy += 20;
    ctx.font = "400 13px 'Source Sans 3', sans-serif";
    ctx.fillStyle = dim;
    for (const l of lineas) {
      ctx.fillText(`· ${l}`, padX + 6, cy);
      cy += 19;
    }
    cy += 10;
  };
  bloqueArgs("A favor de la tesis", lineasFavor);
  bloqueArgs("Juega en contra", lineasContra);

  if (lineasAccion.length) {
    ctx.font = "700 13px 'Source Sans 3', sans-serif";
    ctx.fillStyle = ink;
    for (const l of lineasAccion) {
      ctx.fillText(l, padX, cy);
      cy += 18;
    }
    cy += 10;
  }

  ctx.font = "400 13px 'Source Sans 3', sans-serif";
  ctx.fillStyle = dim;
  for (const l of lineasInvalida) {
    ctx.fillText(l, padX, cy);
    cy += 18;
  }

  ctx.font = "600 11px 'Source Code Pro', monospace";
  ctx.fillStyle = gold;
  ctx.textAlign = "right";
  ctx.fillText("ROFO AGRO", ancho - padX, alto - 12);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
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
