import { parseTablaXLSX } from "@/lib/xlsx-lite";
import { normalizarCampania, CULTIVO, RANGO_MT } from "@/lib/parse-pas";

/**
 * parse-pas-zonas.ts — Parser del export de producción por zona agroecológica de BCBA-PAS
 * (C23, docs/PLAN_PAS_ZONAS.md §4.b) para el uploader admin (/admin/datos). Formato .xlsx único
 * ("Reporte base de datos"): `Campaña · Zona · Cultivo · Sembrado (Ha) · Perdído(Ha) ·
 * Cosechado(Ha) · Rinde(qq/Ha) · Producción(MTn)`, verificado 1:1 contra el archivo real
 * `data/pas/reporte_zonas_2026-07-29.xlsx` (1.900 filas, 6 cultivos × 28 campañas × 15 zonas +
 * TOTAL). "Producción(MTn)" son toneladas CRUDAS pese al rótulo, no millones (soja 2024/25 TOTAL
 * = 50.300.000). El "Perdído" con typo de tilde del origen se tolera solo: el matcheo de headers
 * normaliza acentos antes de comparar.
 *
 * Sin vintages (decisión 6 del plan): cada carga es un upsert simple por (grano, campania, zona).
 * El "Rinde" del origen NUNCA se usa — se recalcula siempre como producción/cosechado, mismo
 * criterio que `parse-pas.ts` (que ya encontró un rinde corrupto en el origen una vez).
 *
 * Módulo puro (sin "server-only"): permite testear con Node pelado. `parsePasZonasCeldas` opera
 * sobre la grilla ya parseada (celdas[0]=header) — separado de `parsePasZonas` (que hace el
 * unzip/XML) para poder testear los caminos defensivos que NO aparecen en el archivo real (zona
 * desconocida, cultivo desconocido, grupo idéntico, escala fuera de rango) con grillas literales
 * chicas, sin fabricar un .xlsx binario sintético — el fixture real sigue siendo la única fuente
 * para los tests de conteos/valores (regla dura del proyecto, nunca datos sintéticos).
 */

export type FilaZona = {
  grano: string;
  campania: string; // canónico "2000/01"
  zona: string; // nombre literal BCBA o "TOTAL"
  sembrado_ha: number | null;
  perdido_ha: number | null;
  cosechado_ha: number | null;
  produccion_tn: number | null;
  rinde_tn_ha: number | null;
};

export type DescarteZona = { grano: string; campania: string; zona?: string; motivo: string };

/** Resultado del chequeo de identidad suma-zonas=TOTAL para un grupo grano×campaña evaluado. */
export type ControlIdentidadItem = {
  grano: string;
  campania: string;
  totalTn: number;
  sumaZonasTn: number;
  diffPct: number;
  ok: boolean;
};

export type ResumenZonas = { granos: string[]; campanias: string[]; filas: number };

export type ParseResultado =
  | { ok: true; filas: FilaZona[]; descartes: DescarteZona[]; controlIdentidad: ControlIdentidadItem[]; resumen: ResumenZonas }
  | { ok: false; error: string };

/** Tolerancia de la identidad suma-zonas = TOTAL (§2.a: cierra ≤0,5% desde 2008/09). */
const TOLERANCIA_IDENTIDAD_PCT = 0.5;

/**
 * Primera campaña donde el desglose zonal cubre de verdad el total nacional — antes las zonas
 * suman ~50% del total (BCBA no zonificaba todo al principio, verificado en §2.a). Vive en ESTE
 * módulo (puro, sin "server-only") porque el parser necesita el corte para el guard de identidad;
 * `src/lib/pas-zonas.ts` la reexporta para el panel (§3.a del plan) en vez de duplicar el string.
 */
export const CAMPANIA_ZONAL_CONFIABLE = "2008/09";

/** Las 15 zonas agroecológicas de BCBA, en el orden literal de §2.a (sin "TOTAL"). */
export const ZONAS_PRODUCTIVAS = [
  "NOA", "NEA", "Núcleo Norte", "Núcleo Sur", "Centro N Cba", "Centro N Sta Fe", "S Cba", "SL",
  "Ctro E ER", "Ctro BA", "N LP-O BA", "Cuenca Sal", "SE BA", "SO BA-S LP", "Otras",
] as const;

const ZONAS_VALIDAS = new Set<string>([...ZONAS_PRODUCTIVAS, "TOTAL"]);

/** "Perdído(Ha)" → "perdidoha" (tolera el typo de tilde: NFD le saca el acento antes de comparar). */
function normHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const COLUMNAS = [
  "campana", "zona", "cultivo", "sembradoha", "perdidoha", "cosechadoha", "rindeqqha", "produccionmtn",
] as const;

function mapearCabecera(celdas: string[]): Map<string, number> | null {
  const idx = new Map<string, number>();
  celdas.forEach((h, i) => {
    const n = normHeader(h);
    if ((COLUMNAS as readonly string[]).includes(n) && !idx.has(n)) idx.set(n, i);
  });
  return (COLUMNAS as readonly string[]).every((c) => idx.has(c)) ? idx : null;
}

/** "50300000" o "16,7" (coma decimal, ya normalizada por xlsx-lite) → número; vacío → null. */
function num(s: string | undefined): number | null {
  const t = String(s ?? "").trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const ERROR_FORMATO =
  "No reconozco el formato del archivo. Esperaba las columnas del export de producción por zona " +
  "de bolsadecereales.com/estimaciones-agricolas: Campaña, Zona, Cultivo, Sembrado (Ha), " +
  "Perdido(Ha), Cosechado(Ha), Rinde(qq/Ha), Producción(MTn).";

type Cruda = { sembrado: number; perdido: number; cosechado: number; produccion: number };

/** Snapshot ordenado y serializado de un grupo grano×campaña, para detectar duplicados exactos. */
function snapshotGrupo(porZona: Map<string, Cruda>): string {
  return [...porZona.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([z, c]) => `${z}:${c.sembrado}:${c.perdido}:${c.cosechado}:${c.produccion}`)
    .join(";");
}

/** Grilla ya parseada (celdas[0]=header) → resultado. Ver nota del módulo. */
export function parsePasZonasCeldas(celdas: string[][]): ParseResultado {
  const cabecera = celdas[0];
  if (!cabecera) return { ok: false, error: "El archivo está vacío." };
  const idx = mapearCabecera(cabecera);
  if (!idx) return { ok: false, error: ERROR_FORMATO };
  if (celdas.length <= 1) return { ok: false, error: "El archivo no trae filas de datos." };

  const iCampania = idx.get("campana")!;
  const iZona = idx.get("zona")!;
  const iCultivo = idx.get("cultivo")!;
  const iSembrado = idx.get("sembradoha")!;
  const iPerdido = idx.get("perdidoha")!;
  const iCosechado = idx.get("cosechadoha")!;
  const iProduccion = idx.get("produccionmtn")!;

  const descartes: DescarteZona[] = [];
  // "grano|campania" → zona → Cruda (solo filas con zona/cultivo/campaña válidos).
  const grupos = new Map<string, Map<string, Cruda>>();

  for (let f = 1; f < celdas.length; f++) {
    const row = celdas[f] ?? [];
    const campaniaRaw = (row[iCampania] ?? "").trim();
    const zonaRaw = (row[iZona] ?? "").trim();
    const cultivoRaw = (row[iCultivo] ?? "").trim();
    if (!campaniaRaw && !zonaRaw && !cultivoRaw) continue; // fila totalmente vacía (huecos del xlsx)

    const campania = normalizarCampania(campaniaRaw);
    const grano = CULTIVO[cultivoRaw];
    if (!campania) {
      descartes.push({ grano: grano ?? cultivoRaw, campania: campaniaRaw, motivo: "campaña no reconocida" });
      continue;
    }
    if (!grano) {
      descartes.push({ grano: cultivoRaw, campania, motivo: `cultivo desconocido: "${cultivoRaw}"` });
      continue;
    }
    if (!ZONAS_VALIDAS.has(zonaRaw)) {
      descartes.push({ grano, campania, zona: zonaRaw, motivo: `zona fuera del set conocido de BCBA: "${zonaRaw}"` });
      continue;
    }

    const cruda: Cruda = {
      sembrado: num(row[iSembrado]) ?? 0,
      perdido: num(row[iPerdido]) ?? 0,
      cosechado: num(row[iCosechado]) ?? 0,
      produccion: num(row[iProduccion]) ?? 0,
    };
    const k = `${grano}|${campania}`;
    let porZona = grupos.get(k);
    if (!porZona) {
      porZona = new Map();
      grupos.set(k, porZona);
    }
    porZona.set(zonaRaw, cruda); // última gana si la clave se repite dentro del archivo
  }

  // Campañas por grano, en orden ascendente (para detectar duplicados consecutivos).
  const campaniasPorGrano = new Map<string, string[]>();
  for (const k of grupos.keys()) {
    const [grano, campania] = k.split("|") as [string, string];
    const lista = campaniasPorGrano.get(grano) ?? [];
    lista.push(campania);
    campaniasPorGrano.set(grano, lista);
  }

  const filas: FilaZona[] = [];
  const controlIdentidad: ControlIdentidadItem[] = [];

  for (const [grano, campanias] of campaniasPorGrano) {
    campanias.sort();
    let prevSnap: string | null = null;
    let prevCampania: string | null = null;

    for (const campania of campanias) {
      const porZona = grupos.get(`${grano}|${campania}`)!;
      const snap = snapshotGrupo(porZona);
      const esDuplicado = prevSnap !== null && snap === prevSnap;
      if (esDuplicado) {
        descartes.push({
          grano,
          campania,
          motivo: `grupo idéntico byte-a-byte a la campaña anterior (${prevCampania}) — probable dato sin actualizar en el origen`,
        });
        prevSnap = snap;
        prevCampania = campania;
        continue;
      }
      prevSnap = snap;
      prevCampania = campania;

      // Guard de escala: la fila TOTAL debe caer en el rango plausible nacional (mismo criterio
      // que parse-pas.ts) — si cambió la escala del origen, el grupo entero se descarta.
      const total = porZona.get("TOTAL");
      if (total) {
        const rango = RANGO_MT[grano];
        const prodMt = total.produccion / 1e6;
        if (rango && total.produccion > 0 && (prodMt < rango[0] || prodMt > rango[1])) {
          descartes.push({
            grano,
            campania,
            motivo: `producción TOTAL ${prodMt.toFixed(1)} Mt fuera del rango plausible (${rango[0]}-${rango[1]} Mt) — ¿cambió la escala del export? Grupo completo descartado.`,
          });
          continue;
        }
      }

      let sumaZonas = 0;
      let hayZona = false;
      for (const [zona, c] of porZona) {
        const todoCero = c.sembrado === 0 && c.perdido === 0 && c.cosechado === 0 && c.produccion === 0;
        if (todoCero) continue; // fila vacía: se omite sin descarte

        const produccion_tn = c.produccion > 0 ? c.produccion : null; // sin cosecha todavía → null, nunca 0 fantasma
        const cosechado_ha = c.cosechado > 0 ? c.cosechado : null;
        const rinde_tn_ha = produccion_tn != null && cosechado_ha != null ? produccion_tn / cosechado_ha : null;
        filas.push({
          grano,
          campania,
          zona,
          sembrado_ha: c.sembrado,
          perdido_ha: c.perdido,
          cosechado_ha: c.cosechado,
          produccion_tn,
          rinde_tn_ha,
        });

        if (zona !== "TOTAL") {
          hayZona = true;
          if (produccion_tn != null) sumaZonas += produccion_tn;
        }
      }

      // Identidad suma-zonas=TOTAL: solo desde CAMPANIA_ZONAL_CONFIABLE, y solo si el grupo trae
      // TOTAL con producción real Y al menos una zona (sin desglose zonal no hay nada que comparar).
      if (campania >= CAMPANIA_ZONAL_CONFIABLE && total && total.produccion > 0 && hayZona) {
        const diffPct = (Math.abs(sumaZonas - total.produccion) / total.produccion) * 100;
        controlIdentidad.push({
          grano,
          campania,
          totalTn: total.produccion,
          sumaZonasTn: sumaZonas,
          diffPct,
          ok: diffPct <= TOLERANCIA_IDENTIDAD_PCT,
        });
      }
    }
  }

  if (filas.length === 0) return { ok: false, error: "El archivo no trajo ninguna fila cargable — revisá los descartes." };

  const granos = [...new Set(filas.map((f) => f.grano))].sort();
  const campaniasSet = [...new Set(filas.map((f) => f.campania))].sort();
  return {
    ok: true,
    filas,
    descartes,
    controlIdentidad,
    resumen: { granos, campanias: campaniasSet, filas: filas.length },
  };
}

export function parsePasZonas(datos: Uint8Array): ParseResultado {
  if (datos.byteLength === 0) return { ok: false, error: "El archivo está vacío." };
  const buf = Buffer.from(datos.buffer, datos.byteOffset, datos.byteLength);
  const t = parseTablaXLSX(buf);
  if (t.error || !t.celdas) return { ok: false, error: `${t.error ?? "No pude leer el .xlsx."} ${ERROR_FORMATO}` };
  return parsePasZonasCeldas(t.celdas);
}

/** Grupos que no cierran la identidad (para el guard "forzar" del uploader, §5 del plan). */
export function fallasIdentidad(control: ControlIdentidadItem[]): ControlIdentidadItem[] {
  return control.filter((c) => !c.ok);
}
