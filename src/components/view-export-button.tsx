"use client";

import { exportarViewComoPng, nombreArchivo, type ViewExportData } from "@/lib/chart-export";

/**
 * Botón "↓ PNG" de una `ViewCard` (relevamiento 29/07, punto 30). Dibuja la placa a
 * mano en un `<canvas>` (ver `exportarViewComoPng`) en vez de rasterizar el DOM real
 * — la técnica de rasterizar HTML+CSS falló en la verificación (Chrome marca el
 * canvas como "tainted" al usar `foreignObject`, sin relación con el contenido).
 */
export function ViewExportButton({ grano, fecha, datos }: { grano: string; fecha: string; datos: ViewExportData }) {
  return (
    <button
      type="button"
      className="vw-export-btn"
      onClick={() => exportarViewComoPng(datos, `${nombreArchivo("view", grano, fecha)}.png`)}
    >
      ↓ PNG
    </button>
  );
}
