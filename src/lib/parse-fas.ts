/**
 * parse-fas.ts — Parser + checklist de verificación del export histórico "FAS Teórico Oficial
 * SAGyP por Producto" de Agrochat (C32/F1, docs/PLAN_CALOR_MERCADERIA.md §4). Fuente = la
 * publicación oficial de SAGyP, redistribuida por Agrochat en un CSV descargable (no hay API
 * pública de SAGyP para esta serie — investigado en C16, docs/sesiones/2026-07-24-c16-capacidad-pago.md).
 *
 * Formato verificado en la sesión de plan (08/08/2026, §4.1/§4.2 del plan — el archivo real vivía
 * en un contenedor efímero de esa sesión y se re-sube en F1): CSV coma, cabecera
 * `Date,Product,FAS_ARS,FAS_USD,TC_Mayorista`, decimales con punto, fechas ISO (`YYYY-MM-DD`),
 * CRLF. 32.076 filas · 4.748 fechas hábiles · 0 duplicados (fecha+producto) · 0 valores ≤ 0 ·
 * cobertura Soja/Maíz/Trigo Pan/Girasol desde 2007-01-16, Aceite de Soja/Aceite de Girasol desde
 * 2007-05-09, Sorgo/Cebada C/Cebada F desde 2021-06.
 *
 * Módulo puro (sin "server-only"): el checklist de re-verificación (§4.3 del plan) tiene que
 * poder correr en un script de Node antes de cargar nada, igual que `parse-pas.ts`/`parse-dea.ts`.
 *
 * OJO: este parser NUNCA se corrió contra el CSV real (backfill diferido — Lautaro lo re-sube en
 * F1, ver §5 punto 4 del plan). Los tests usan una fixture SINTÉTICA que solo imita el formato de
 * cabecera/tipos; los NÚMEROS de esa fixture no son datos reales de mercado.
 */

// Extensión ".ts" explícita: `scripts/cargar-fas.mjs` importa este módulo con Node plano (ver el
// comentario del mismo cambio en capacidad-bcr-parse.ts).
import { esHabil } from "./habiles.ts";
import { MAPEO_PRODUCTO_FAS, normalizarProductoCsv } from "./fas-catalogo.ts";

export type FilaFasCsv = {
  fecha: string; // ISO YYYY-MM-DD
  productoCsv: string; // nombre tal cual el CSV ("Soja", "Trigo Pan", …)
  producto: string; // mapeado (fas-catalogo.ts) — lo que va a fas_historico.producto
  fasArs: number;
  fasUsd: number;
  tcMayorista: number;
};

export type DescarteFasCsv = { fila: number; motivo: string };

export type ParseFasCsvResult = {
  filas: FilaFasCsv[];
  descartes: DescarteFasCsv[];
};

function splitComma(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * CSV completo (texto ya decodificado) → filas normalizadas + descartes (nunca en silencio).
 * Descarta: fecha no-ISO, producto no reconocido (`fas-catalogo.ts`), FAS_ARS/FAS_USD/TC no
 * numéricos o ≤ 0.
 */
export function parseFasCsv(csv: string): ParseFasCsvResult {
  const lines = csv.split(/\r?\n/);
  const filas: FilaFasCsv[] = [];
  const descartes: DescarteFasCsv[] = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw || !raw.trim()) continue;
    const c = splitComma(raw);
    if (c.length < 5) {
      descartes.push({ fila: i + 1, motivo: `columnas insuficientes (${c.length})` });
      continue;
    }
    const [fechaRaw, productoRaw, fasArsRaw, fasUsdRaw, tcRaw] = c;
    const fecha = (fechaRaw ?? "").trim();
    if (!ISO_RE.test(fecha)) {
      descartes.push({ fila: i + 1, motivo: `fecha no-ISO: "${fecha}"` });
      continue;
    }
    const productoCsv = normalizarProductoCsv(productoRaw ?? "");
    if (!productoCsv) {
      descartes.push({ fila: i + 1, motivo: `producto no reconocido: "${productoRaw}"` });
      continue;
    }
    const fasArs = Number(fasArsRaw);
    const fasUsd = Number(fasUsdRaw);
    const tcMayorista = Number(tcRaw);
    if (!Number.isFinite(fasArs) || fasArs <= 0) {
      descartes.push({ fila: i + 1, motivo: `FAS_ARS inválido: "${fasArsRaw}"` });
      continue;
    }
    if (!Number.isFinite(fasUsd) || fasUsd <= 0) {
      descartes.push({ fila: i + 1, motivo: `FAS_USD inválido: "${fasUsdRaw}"` });
      continue;
    }
    if (!Number.isFinite(tcMayorista) || tcMayorista <= 0) {
      descartes.push({ fila: i + 1, motivo: `TC_Mayorista inválido: "${tcRaw}"` });
      continue;
    }
    filas.push({ fecha, productoCsv, producto: MAPEO_PRODUCTO_FAS[productoCsv], fasArs, fasUsd, tcMayorista });
  }

  return { filas, descartes };
}

export type ChecklistFasCsv = {
  totalFilas: number;
  fechasUnicas: number;
  productos: string[];
  duplicadosFechaProducto: number; // debe ser 0 (§4.3 punto 2)
  finesDeSemanaOFeriados: number; // debe ser 0 — "solo días hábiles" (§4.3 punto 2)
  /** Filas donde |FAS_USD − FAS_ARS/TC| supera la tolerancia de redondeo (§4.3 punto 3). */
  inconsistenciasUsdArsTc: number;
  /** Rango de fechas por producto — para cotejar contra §4.2 (cobertura esperada). */
  rangoPorProducto: Record<string, { desde: string; hasta: string; filas: number }>;
};

/**
 * Checklist de re-verificación §4.3 (puntos 1-3, mecánicos). Los puntos 4-6 (TC de 3 fechas
 * conocidas, cotejo vivo contra BCR/Nuestro del día, spot-check contra la publicación oficial)
 * requieren red/fecha de hoy — no son mecánicos, se corren aparte en `scripts/cargar-fas.mjs`
 * antes de subir, y su resultado se documenta a mano en la sesión (no en este módulo puro).
 */
export function checklistFasCsv(filas: FilaFasCsv[], toleranciaUsd = 0.5): ChecklistFasCsv {
  const claves = new Set<string>();
  let duplicados = 0;
  let finesDeSemanaOFeriados = 0;
  let inconsistencias = 0;
  const rango: Record<string, { desde: string; hasta: string; filas: number }> = {};
  const productos = new Set<string>();

  for (const f of filas) {
    const clave = `${f.fecha}|${f.producto}`;
    if (claves.has(clave)) duplicados++;
    else claves.add(clave);

    productos.add(f.producto);

    const d = new Date(`${f.fecha}T12:00:00Z`);
    if (!esHabil(d)) finesDeSemanaOFeriados++;

    const esperado = f.fasArs / f.tcMayorista;
    if (Math.abs(esperado - f.fasUsd) > toleranciaUsd) inconsistencias++;

    const r = rango[f.producto];
    if (!r) rango[f.producto] = { desde: f.fecha, hasta: f.fecha, filas: 1 };
    else {
      if (f.fecha < r.desde) r.desde = f.fecha;
      if (f.fecha > r.hasta) r.hasta = f.fecha;
      r.filas++;
    }
  }

  const fechasUnicas = new Set(filas.map((f) => f.fecha)).size;

  return {
    totalFilas: filas.length,
    fechasUnicas,
    productos: [...productos].sort(),
    duplicadosFechaProducto: duplicados,
    finesDeSemanaOFeriados,
    inconsistenciasUsdArsTc: inconsistencias,
    rangoPorProducto: rango,
  };
}
