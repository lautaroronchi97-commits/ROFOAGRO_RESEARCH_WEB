"use client";

import { useState } from "react";

/**
 * Prompt canónico para pedirle a Agrochat el export semanal de comercialización en el
 * formato EXACTO que espera el uploader (tabla `compras`). El punto crítico son las
 * UNIDADES: el reporte "Última Semana" de Agrochat sale en MILES de toneladas
 * (ej. trigo 16238,9) y la base guarda toneladas enteras (16238900) → si se sube tal
 * cual, la semana entra ÷1000 y corrompe el acumulado. Este prompt fuerza toneladas
 * enteras. Lautaro lo copia cada semana cambiando solo la fecha.
 */

// La fecha va en su propia línea, marcada, para cambiarla sin tocar el resto.
const PROMPT = `Necesito la serie de comercialización de granos de SIO Granos para una semana puntual, en formato CSV, para cargar en un sistema. Seguí EXACTAMENTE estas reglas:

SEMANA: 08/07/2026   (cambiar SOLO esta fecha, formato DD/MM/AAAA)

FORMATO DE SALIDA
- Devolvé únicamente el CSV, sin ningún texto antes ni después y sin comillas ni bloques de código.
- Primera línea = esta cabecera EXACTA (con estos nombres y en este orden):
fecha,grano,sector,campaña,compras_semanales,total_comprado_acumulado,precio_hecho,a_fijar,fijado,saldo_a_fijar
- Una fila por cada combinación de grano × sector × campaña con actividad esa semana.

COLUMNAS
- fecha: la semana pedida, en DD/MM/AAAA, igual en todas las filas.
- grano: uno de estos, en minúscula → trigo, maíz, sorgo, cebada cervecera, cebada forrajera, soja, girasol.
- sector: Exportador o Industria.
- campaña: formato AA/AA (por ejemplo 25/26). Incluí todas las campañas vigentes (la que se está liquidando y la nueva).
- compras_semanales = comprado en la semana. total_comprado_acumulado = acumulado de la campaña. Más precio_hecho, a_fijar, fijado, saldo_a_fijar.

UNIDADES (MUY IMPORTANTE)
- TODOS los volúmenes en TONELADAS ENTERAS. Ejemplo correcto: 16238900. Ejemplo INCORRECTO: 16238,9 o 16.238,9.
- NADA en miles de toneladas. Sin separador de miles, sin símbolos, sin texto. Decimal con punto (o entero), nunca coma.`;

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
        📋 Prompt para pedirle el export a Agrochat (copiá y cambiá la fecha)
      </summary>
      <p className="admin-sub" style={{ margin: "10px 0" }}>
        Agrochat exporta la <b>Última Semana</b> en <b>miles</b> de toneladas; la base usa toneladas
        enteras. Este prompt le pide el dato en el formato correcto (toneladas enteras). Copialo,
        cambiá <b>solo la fecha</b> de la línea <code>SEMANA:</code>, pegalo en Agrochat y subí el CSV
        que devuelva.
      </p>
      <p className="admin-sub" style={{ margin: "10px 0" }}>
        Si Agrochat te devuelve el resultado como texto pegado en el chat (sin poder descargarlo
        como archivo), no hace falta reconstruirlo a mano: pedile en cambio el <b>dataset crudo</b>{" "}
        (columnas <code>Date, Country, Sector, Crop, Harvest, Semanal, Total Comprado, …</code>, en
        miles de toneladas, con filas &quot;Total&quot;) como CSV descargable y subí ESE archivo tal
        cual — el uploader de abajo lo detecta solo y hace la conversión (filtra &quot;Total&quot;,
        ×1000 a toneladas enteras).
      </p>
      <div className="admin-card-acciones" style={{ marginBottom: 8 }}>
        <button type="button" className="admin-btn admin-btn-ok" onClick={copiar}>
          {copiado ? "✓ Copiado" : "Copiar prompt"}
        </button>
      </div>
      <textarea
        className="admin-input"
        readOnly
        rows={22}
        value={PROMPT}
        style={{ width: "100%", fontFamily: "var(--font-mono, monospace)", fontSize: "0.82rem", whiteSpace: "pre" }}
        onFocus={(e) => e.currentTarget.select()}
      />
    </details>
  );
}
