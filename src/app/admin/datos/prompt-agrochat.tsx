"use client";

import { useState } from "react";

/**
 * Prompt para pedirle a Agrochat el dataset de comercialización CRUDO (de origen, sin su propia
 * transformación) — 27/07/2026. Se descartó pedir el formato ya transformado ("Última Semana",
 * cabecera propia): ese resultado sale de la celda de un dataframe, no de un archivo descargable,
 * y al copiarlo se pierden los saltos de línea. El dataset crudo (Date/Country/Sector/Crop/
 * Harvest/Semanal/Total Comprado/…, en miles de toneladas, con filas "Total") SÍ se descarga como
 * CSV real — el uploader (parseAgrochat) lo reconoce solo y aplica la conversión (filtra "Total",
 * grano a minúscula, ×1000 a toneladas enteras). Lautaro lo copia cada vez cambiando el rango.
 */

// El rango va en su propia línea, marcado, para cambiarlo sin tocar el resto.
const PROMPT = `Necesito el dataset de comercialización de granos de SIO Granos en su formato de ORIGEN, sin resumir ni transformar, para cargar en un sistema. Seguí EXACTAMENTE estas reglas:

RANGO: DESDE 01/07/2026 HASTA 15/07/2026   (cambiar SOLO este rango, formato DD/MM/AAAA — podés pedir varias semanas juntas)

FORMATO DE SALIDA
- Devolvé el resultado como un ARCHIVO CSV DESCARGABLE (no como texto pegado en el chat ni como tabla para copiar): necesito poder bajarlo tal cual y subirlo a un sistema.
- NO apliques ningún resumen, filtro ni transformación: quiero las filas tal cual están en el dataset de origen, INCLUIDAS las filas de sector "Total".
- Primera línea = esta cabecera EXACTA (con estos nombres y en este orden):
Date,Country,Sector,Crop,Harvest,Semanal,Total Comprado,Total Precio Hecho,Total a Fijar,Total Fijado,Saldo a Fijar
- Una fila por cada fecha × sector (industria/exportador/total) × cultivo × campaña con actividad en el rango pedido.

UNIDADES
- Los valores numéricos en las unidades ORIGINALES del dataset (miles de toneladas) — NO los conviertas vos a toneladas enteras ni los redondees, eso lo hace el sistema al cargarlos.`;

export function PromptAgrochat() {
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
        📋 Prompt para pedirle el dataset a Agrochat (copiá y cambiá el rango)
      </summary>
      <p className="admin-sub" style={{ margin: "10px 0" }}>
        Copiá este prompt, cambiá <b>solo el rango</b> de la línea <code>RANGO:</code>, pegalo en
        Agrochat y subí el CSV descargable que te devuelva (el dataset de origen, sin transformar) —
        el uploader de abajo lo detecta solo y hace la conversión (filtra las filas &quot;Total&quot;,
        pasa el grano a minúscula, ×1000 a toneladas enteras).
      </p>
      <div className="admin-card-acciones" style={{ marginBottom: 8 }}>
        <button type="button" className="admin-btn admin-btn-ok" onClick={copiar}>
          {copiado ? "✓ Copiado" : "Copiar prompt"}
        </button>
      </div>
      <textarea
        className="admin-input"
        readOnly
        rows={14}
        value={PROMPT}
        style={{ width: "100%", fontFamily: "var(--font-mono, monospace)", fontSize: "0.82rem", whiteSpace: "pre" }}
        onFocus={(e) => e.currentTarget.select()}
      />
    </details>
  );
}
