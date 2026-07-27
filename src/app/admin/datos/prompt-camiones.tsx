"use client";

import { useState } from "react";

/**
 * Prompt canónico para pedirle a Agrochat el dataset de camiones en puerto de Williams Entregas
 * en su formato CRUDO/tidy (verificado en vivo 27/07/2026 — mismo criterio que
 * `prompt-agrochat.tsx`: el formato ya agregado por zona sale como texto de una celda de
 * dataframe, sin salto de línea real, no descargable; el dataset de origen, una fila por
 * terminal/día, SÍ se descarga como CSV real). El uploader (parseCamionesUpload) lo reconoce
 * solo y agrupa por zona.
 */

const PROMPT = `Necesito el dataset de entrada de camiones a puerto de Williams Entregas, en su formato de ORIGEN, sin resumir ni transformar, para cargar en un sistema. Seguí EXACTAMENTE estas reglas:

SERIE: Total (todos los productos)   (cambiar por el grano puntual si corresponde: Maíz / Trigo / Soja / Girasol / Sorgo / Cebada)
RANGO: DESDE 01/07/2026 HASTA 22/07/2026   (cambiar el rango, formato DD/MM/AAAA)

FORMATO DE SALIDA
- Devolvé el resultado como un ARCHIVO CSV DESCARGABLE (no como texto pegado en el chat ni como tabla para copiar): necesito poder bajarlo tal cual y subirlo a un sistema.
- NO agregues por zona ni apliques ningún resumen: quiero UNA FILA POR TERMINAL/localidad y día, tal cual está en el dataset de origen.
- Primera línea = esta cabecera EXACTA (con estos nombres, en este orden):
Date,Cultivo,Localidad,Puerto,Zona,Cantidad de Camiones
- Una fila por fecha × terminal con actividad en el rango pedido, SOLO del cultivo pedido en SERIE (no mezcles "Total" con un grano puntual en el mismo archivo).

UNIDADES
- "Cantidad de Camiones" es CANTIDAD DE VEHÍCULOS, no toneladas. Números enteros.`;

export function PromptCamiones() {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(PROMPT);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el textarea de abajo queda para seleccionar a mano.
    }
  };

  return (
    <details className="admin-card" style={{ marginBottom: 16 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        📋 Prompt para pedirle el dataset de camiones a Agrochat (copiá y cambiá SERIE/rango)
      </summary>
      <p className="admin-sub" style={{ margin: "10px 0" }}>
        Williams Entregas (vía Agrochat) NO exporta los granos juntos por tamaño — un archivo por
        vez: el total sin filtrar, o un grano puntual. Copiá este prompt, cambiá{" "}
        <b>SERIE</b> (Total o el grano) y el <b>RANGO</b>, pegalo en Agrochat y subí el CSV
        descargable que te devuelva eligiendo la misma serie en el selector de abajo.
      </p>
      <div className="admin-card-acciones" style={{ marginBottom: 8 }}>
        <button type="button" className="admin-btn admin-btn-ok" onClick={copiar}>
          {copiado ? "✓ Copiado" : "Copiar prompt"}
        </button>
      </div>
      <textarea
        className="admin-input"
        readOnly
        rows={13}
        value={PROMPT}
        style={{ width: "100%", fontFamily: "var(--font-mono, monospace)", fontSize: "0.82rem", whiteSpace: "pre" }}
        onFocus={(e) => e.currentTarget.select()}
      />
    </details>
  );
}
