/**
 * parse-pas.ts — Parser del export histórico de estimaciones agrícolas de BCBA (Panorama
 * Agrícola Semanal) para el uploader admin (/admin/datos). Fuente automática DESCARTADA (A3 del
 * backlog maestro: `bolsadecereales.com` detrás de Cloudflare, confirmado 2/2 desde IPs de
 * datacenter — ver `scripts/ingest-pas.mjs`); Lautaro está suscripto y baja el export desde su
 * navegador, mismo patrón semi-manual que DEA-SAGyP (`parse-dea.ts`, lote L5).
 *
 * Formato del CSV oficial (Latin-1, separador `;`): "Cultivo;Campaña;Zona;Sembrado (Ha);
 * Perdido(Ha);Cosechado(Ha);Rinde(qq/Ha);Producción(Tn)". Verificado 1:1 contra un export real
 * (23/07/2026, 26 campañas 2000/01→2025/26, los 6 granos): producción en Tn CRUDAS (soja 2024/25
 * = 50.300.000 Tn = 50,3 Mt, coincide con lo publicado) — NO son "millones" pese a que otro
 * export más chico de la misma web ("reporte_1.xlsx", solo campaña en curso) rotula la columna
 * "Producción(MTn)"; ese archivo nunca trajo un valor >0 para verificar su escala, así que
 * este parser NO lo soporta — si algún día se sube, `RANGO_MT` lo va a rechazar por completo
 * (valores 1000x fuera de rango) en vez de cargar un número mal escalado.
 *
 * Igual que la DEA, guardamos SOLO el valor vigente por campaña (no hay vintages de fecha real
 * en el origen) → cada carga snapshotea "hoy" (o la fecha indicada) como vintage propio. El
 * "Rinde" del origen NO se usa tal cual (se vio corrompido en un caso real: girasol 2024/25 traía
 * "2.343.650.213") — se recalcula siempre como producción/cosechado, igual que `parse-dea.ts`.
 *
 * Módulo puro (sin "server-only"): permite testear con Node pelado, mismo criterio que los demás
 * parsers de export manual del proyecto.
 */

export type FilaEstimacion = {
  organismo: "BCBA";
  pais: "argentina";
  grano: string;
  campania: string;
  fecha_publicacion: string;
  informe: string;
  url: string;
  variable: "produccion" | "area" | "rinde";
  valor: number;
  unidad: string;
};

export type Descarte = { grano: string; campania: string; motivo: string };

// Exportados (C23, docs/PLAN_PAS_ZONAS.md §4.b): `parse-pas-zonas.ts` reusa el mismo mapa de
// cultivos y los mismos rangos de plausibilidad — cero comportamiento nuevo, solo visibilidad.
export const CULTIVO: Record<string, string> = {
  Soja: "soja",
  "Maíz": "maiz",
  Maiz: "maiz",
  Trigo: "trigo",
  Girasol: "girasol",
  Sorgo: "sorgo",
  Cebada: "cebada",
};

// Rangos de plausibilidad de la producción nacional AR (Mt) — mismos que scripts/ingest-pas.mjs,
// cota anti-basura para cuando el origen cambie de escala sin avisar.
export const RANGO_MT: Record<string, [number, number]> = {
  soja: [15, 70],
  maiz: [10, 95],
  trigo: [5, 40],
  girasol: [1, 9],
  sorgo: [0.5, 7],
  cebada: [1, 9],
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** split de una línea CSV `;` con comillas (mismo parser que parse-dea.ts — duplicado a
 * propósito para que este módulo no dependa de otro parser de origen distinto). */
function splitSemicolon(line: string): string[] {
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
    else if (c === ";") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * "2000/2001" → "2000/01"; ya-corto "2000/01" pasa igual. Cualquier otra cosa → null.
 * Exportada (C23, docs/PLAN_PAS_ZONAS.md §4.a): `parse-pas-zonas.ts` la reusa — su export
 * (`reporte_zonas_*.xlsx`) trae la campaña en formato largo "2000/2001" siempre.
 */
export function normalizarCampania(raw: string): string | null {
  const c = raw.trim();
  const largo = c.match(/^(\d{4})\/(\d{4})$/);
  if (largo) return `${largo[1]}/${largo[2]!.slice(2)}`; // grupos obligatorios del regex
  if (/^\d{4}\/\d{2}$/.test(c)) return c;
  return null;
}

type FilaCruda = { campania: string; semb: number; perd: number; cos: number; prod: number };

/**
 * CSV completo (texto ya decodificado Latin-1) → filas nacionales por (grano, campaña, variable),
 * snapshoteadas con `fecha`. Devuelve también los `descartes`: campañas que NO se cargaron y por
 * qué (fila idéntica a la campaña anterior — dato sin actualizar en el origen — o producción fuera
 * del rango plausible) — nunca se descarta en silencio.
 */
export function parsePas(csv: string, fecha: string): { filas: FilaEstimacion[]; descartes: Descarte[] } {
  const lines = csv.split(/\r?\n/);
  const porGrano = new Map<string, FilaCruda[]>();

  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l || !l.trim()) continue;
    const c = splitSemicolon(l);
    if (c.length < 8) continue;
    const grano = CULTIVO[c[0]?.trim() ?? ""];
    if (!grano) continue;
    if ((c[2] ?? "").trim().toUpperCase() !== "TOTAL") continue; // solo el agregado nacional
    const campania = normalizarCampania(c[1] ?? "");
    if (!campania) continue;
    const semb = Number(c[3]) || 0;
    const perd = Number(c[4]) || 0;
    const cos = Number(c[5]) || 0;
    const prod = Number(c[7]) || 0;
    const lista = porGrano.get(grano) ?? [];
    lista.push({ campania, semb, perd, cos, prod });
    porGrano.set(grano, lista);
  }

  const filas: FilaEstimacion[] = [];
  const descartes: Descarte[] = [];

  for (const [grano, lista] of porGrano.entries()) {
    lista.sort((a, b) => (a.campania < b.campania ? -1 : a.campania > b.campania ? 1 : 0));
    let prev: FilaCruda | null = null;
    for (const r of lista) {
      const identica =
        prev && prev.semb === r.semb && prev.perd === r.perd && prev.cos === r.cos && prev.prod === r.prod;
      prev = r;
      if (identica) {
        descartes.push({
          grano,
          campania: r.campania,
          motivo: "idéntica a la campaña anterior — probable dato sin actualizar en el origen",
        });
        continue;
      }
      if (r.prod <= 0) continue; // todavía sin cosecha (mismo criterio que parse-dea.ts): no es un descarte, es normal

      const rango = RANGO_MT[grano];
      const prodMt = round2(r.prod / 1e6);
      if (rango && (prodMt < rango[0] || prodMt > rango[1])) {
        descartes.push({
          grano,
          campania: r.campania,
          motivo: `producción ${prodMt} Mt fuera del rango plausible (${rango[0]}-${rango[1]} Mt) — ¿cambió la escala del export?`,
        });
        continue;
      }

      const base = {
        organismo: "BCBA" as const,
        pais: "argentina" as const,
        grano,
        campania: r.campania,
        fecha_publicacion: fecha,
        informe: "PAS (BCBA)",
        url: "https://www.bolsadecereales.com/estimaciones-agricolas",
      };
      filas.push({ ...base, variable: "produccion", valor: prodMt, unidad: "Mt" });
      if (r.semb > 0) filas.push({ ...base, variable: "area", valor: round2(r.semb / 1e6), unidad: "Mha" });
      if (r.cos > 0) filas.push({ ...base, variable: "rinde", valor: round4(r.prod / r.cos), unidad: "tn/ha" });
    }
  }
  return { filas, descartes };
}

/** Campañas y granos presentes en un lote de filas (para el resumen de previsualización). */
export function resumenFilas(filas: FilaEstimacion[]): { granos: string[]; campanias: string[] } {
  return {
    granos: [...new Set(filas.map((f) => f.grano))].sort(),
    campanias: [...new Set(filas.map((f) => f.campania))].sort(),
  };
}
