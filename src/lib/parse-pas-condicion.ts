import { parseTablaXLSX } from "@/lib/xlsx-lite";
import { normalizarCampania } from "@/lib/parse-pas";

/**
 * parse-pas-condicion.ts — Parser del export semanal de condición de cultivos de BCBA-PAS
 * (C27, docs/PLAN_PAS_ZONAS.md §4.c) para el uploader admin (/admin/datos). Un archivo por
 * cultivo ("Reporte base de datos"), verificado 1:1 contra los 4 exports reales de `data/pas/`:
 * girasol (250 filas), soja (566, ciclos Soja/Soja1/Soja2), maíz (729, ciclos Maiz/Maiz1/Maiz2)
 * y trigo (335, sin ciclos, único con la campaña EN CURSO 2026/27).
 *
 * Columnas 1-15 fijas (Cultivo·Zona·Campaña·Semana·Siembra·5×CC_*·5×CH_*); columnas 16+ =
 * fenología, CON NOMBRES QUE CAMBIAN POR CULTIVO (verificado: girasol/soja/maíz/trigo traen
 * 4 vocabularios agronómicos distintos) — se leen SIEMPRE dinámicamente del header, en el orden
 * en que aparecen, jamás hardcodeadas. `Semana` es un entero de campaña (0-53 real, no arranca
 * siempre en 1) SIN fecha — nunca se inventa una fecha calendario a partir de ella.
 *
 * Módulo puro (sin "server-only"): permite testear con Node pelado. `parsePasCondicionCeldas`
 * opera sobre la grilla ya parseada — separado de `parsePasCondicion` (que hace el unzip/XML)
 * para poder testear los caminos defensivos que NO aparecen en los 4 archivos reales (cultivo
 * desconocido, semana fuera de rango, bloque CC/CH que no cierra, PK duplicada, zona≠TOTAL) con
 * grillas literales chicas — el fixture real sigue siendo la única fuente para los tests de
 * conteos/etapas/valores (regla dura del proyecto, nunca datos sintéticos).
 */

export type FilaCondicion = {
  grano: string; // 'girasol'|'soja'|'maiz'|'trigo'
  ciclo: string; // 'total'|'1ra'|'2da'
  zona: string; // 'TOTAL' en los 4 exports reales; la tabla soporta otras (§4.c)
  campania: string; // canónico "2020/21"
  semana: number; // 0-53, semana DE CAMPAÑA
  siembra_pct: number | null;
  cc_mala: number | null;
  cc_regular: number | null;
  cc_normal: number | null;
  cc_buena: number | null;
  cc_excelente: number | null;
  ch_sequia: number | null;
  ch_regular: number | null;
  ch_adecuada: number | null;
  ch_optima: number | null;
  ch_exceso: number | null;
  fenologia: { etapa: string; pct: number | null }[]; // ARRAY ordenado, orden del header
};

export type DescarteCondicion = { grano: string; ciclo?: string; campania?: string; semana?: number; motivo: string };

export type ResumenCondicion = { grano: string; ciclos: string[]; campanias: string[]; filas: number };

export type ParseResultadoCondicion =
  | {
      ok: true;
      filas: FilaCondicion[];
      descartes: DescarteCondicion[];
      etapasPorCultivo: Record<string, string[]>;
      zonasNuevas: string[];
      resumen: ResumenCondicion;
    }
  | { ok: false; error: string };

/** "Cultivo" del origen (con sus 8 variantes de ciclo) → (grano, ciclo). Solo estos 4 cultivos
 * tienen este reporte en BCBA (confirmado por Lautaro, sin cebada/sorgo) — no dejar un hueco
 * fantasma para ellos en el mapa. */
const CULTIVO_CICLO: Record<string, readonly [string, string]> = {
  Girasol: ["girasol", "total"],
  Trigo: ["trigo", "total"],
  Soja: ["soja", "total"],
  Soja1: ["soja", "1ra"],
  Soja2: ["soja", "2da"],
  Maiz: ["maiz", "total"],
  Maiz1: ["maiz", "1ra"],
  Maiz2: ["maiz", "2da"],
  "Maíz": ["maiz", "total"], // tolerancia defensiva, no observada en los 4 archivos reales
  "Maíz1": ["maiz", "1ra"],
  "Maíz2": ["maiz", "2da"],
};

const SEMANA_MIN = 0;
const SEMANA_MAX = 53;

/** "CH_Sequía(%)" → "chsequia" (tolera tildes/paréntesis/mayúsculas). Duplicado a propósito
 * (mismo criterio que `splitSemicolon` de parse-pas.ts): este parser no depende de otro parser
 * de un origen distinto para su propia normalización de headers. */
function normHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** "Expansión Foliar(%)" → "Expansión Foliar" (para el nombre de etapa visible/guardado). */
function labelEtapa(h: string): string {
  return h.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

const COLUMNAS_FIJAS = [
  "cultivo", "zona", "campana", "semana", "siembra",
  "ccmala", "ccregular", "ccnormal", "ccbuena", "ccexcelente",
  "chsequia", "chregular", "chadecuada", "choptima", "chexceso",
] as const;

type IdxFijos = Record<(typeof COLUMNAS_FIJAS)[number], number>;

/** Mapea la cabecera: las 15 columnas fijas por nombre normalizado + las columnas de fenología
 * (todo lo demás), preservando el orden de aparición en el archivo. `null` si falta una fija. */
function mapearCabecera(celdas: string[]): { fijos: IdxFijos; fenologia: { idx: number; etapa: string }[] } | null {
  const idx = new Map<string, number>();
  celdas.forEach((h, i) => {
    const n = normHeader(h);
    if (!idx.has(n)) idx.set(n, i);
  });
  if (!COLUMNAS_FIJAS.every((c) => idx.has(c))) return null;

  const fijos = Object.fromEntries(COLUMNAS_FIJAS.map((c) => [c, idx.get(c)!])) as IdxFijos;
  const usados = new Set(Object.values(fijos));
  const fenologia = celdas
    .map((h, i) => ({ idx: i, etapa: labelEtapa(h) }))
    .filter((c) => !usados.has(c.idx) && c.etapa !== "");
  return { fijos, fenologia };
}

/** "50,3" (coma decimal, ya normalizada por xlsx-lite) o "" → número | null. */
function num(s: string | undefined): number | null {
  const t = String(s ?? "").trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Tolerancia de la suma de cada bloque de 5 categorías (CC o CH), calibrada EMPÍRICAMENTE contra
// los 4 archivos reales (no el [98,102] "de manual" del plan — verificado en esta sesión que ese
// umbral descartaba ~20% de las filas de soja/maíz por puro redondeo de origen, no por datos
// malos): BCBA redondea cada categoría a un entero independiente, y con valores típicos la suma de
// 5 enteros redondeados cae rutinariamente en 96-99% (soja/maíz: 122/499 y 124/600 filas en 97%
// exacto) — eso NO es una anomalía. Los outliers reales (fuera de [90,110]) son un puñado aislado y
// bien separado del resto (girasol semana 19 de 2024/25 con 77%/76,9% CC/CH y semana 33/34 de
// 2022/23 con 83,5%/76,4% CH; maíz con 2 filas en 54%): hay un salto limpio de la masa 96-102% a
// esos valores, sin nada en el medio, así que el corte en 90/110 no parte ningún caso ambiguo.
const BLOQUE_SUMA_MIN = 90;
const BLOQUE_SUMA_MAX = 110;

/** Un bloque de 5 categorías (CC o CH): si todo es 0/vacío → null (pre-emergencia, normal, sin
 * descarte); si suma fuera de [90,110] → null + descarte visible; si cierra → se guarda tal cual. */
function bloqueBalanceado(valores: (number | null)[]): { valores: (number | null)[]; motivo: string | null } {
  const nums = valores.map((v) => v ?? 0);
  if (nums.every((v) => v === 0)) return { valores: [null, null, null, null, null], motivo: null };
  const suma = nums.reduce((a, b) => a + b, 0);
  if (suma < BLOQUE_SUMA_MIN || suma > BLOQUE_SUMA_MAX) {
    return { valores: [null, null, null, null, null], motivo: `suma ${suma.toFixed(1)}% fuera de [${BLOQUE_SUMA_MIN},${BLOQUE_SUMA_MAX}]` };
  }
  return { valores: nums, motivo: null };
}

const ERROR_FORMATO =
  "No reconozco el formato del archivo. Esperaba las columnas del export de condición de cultivos " +
  "de bolsadecereales.com/estimaciones-agricolas: Cultivo, Zona, Campaña, Semana, Siembra, " +
  "CC_Mala…CC_Excelente, CH_Sequía…CH_Exceso, y las columnas de fenología del cultivo.";

/** Grilla ya parseada (celdas[0]=header) → resultado. Ver nota del módulo. */
export function parsePasCondicionCeldas(celdas: string[][]): ParseResultadoCondicion {
  const cabecera = celdas[0];
  if (!cabecera) return { ok: false, error: "El archivo está vacío." };
  const mapa = mapearCabecera(cabecera);
  if (!mapa) return { ok: false, error: ERROR_FORMATO };
  if (celdas.length <= 1) return { ok: false, error: "El archivo no trae filas de datos." };
  const { fijos, fenologia } = mapa;
  if (fenologia.length === 0) return { ok: false, error: ERROR_FORMATO };

  const descartes: DescarteCondicion[] = [];
  const zonasNuevas = new Set<string>();
  const porPK = new Map<string, FilaCondicion>(); // última gana si la PK se repite
  const ordenPK: string[] = [];

  for (let f = 1; f < celdas.length; f++) {
    const row = celdas[f] ?? [];
    const cultivoRaw = (row[fijos.cultivo] ?? "").trim();
    const zonaRaw = (row[fijos.zona] ?? "").trim() || "TOTAL";
    const campaniaRaw = (row[fijos.campana] ?? "").trim();
    const semanaRaw = (row[fijos.semana] ?? "").trim();
    if (!cultivoRaw && !campaniaRaw && !semanaRaw) continue; // fila totalmente vacía (huecos del xlsx)

    const par = CULTIVO_CICLO[cultivoRaw];
    if (!par) {
      descartes.push({ grano: cultivoRaw, campania: campaniaRaw || undefined, motivo: `cultivo desconocido: "${cultivoRaw}"` });
      continue;
    }
    const [grano, ciclo] = par;

    const campania = normalizarCampania(campaniaRaw);
    if (!campania) {
      descartes.push({ grano, ciclo, motivo: `campaña no reconocida: "${campaniaRaw}"` });
      continue;
    }

    const semanaNum = num(semanaRaw);
    if (semanaNum == null || !Number.isInteger(semanaNum) || semanaNum < SEMANA_MIN || semanaNum > SEMANA_MAX) {
      descartes.push({ grano, ciclo, campania, motivo: `semana fuera de rango [${SEMANA_MIN}-${SEMANA_MAX}]: "${semanaRaw}"` });
      continue;
    }

    if (zonaRaw !== "TOTAL") zonasNuevas.add(zonaRaw);

    const cc = bloqueBalanceado([
      num(row[fijos.ccmala]), num(row[fijos.ccregular]), num(row[fijos.ccnormal]), num(row[fijos.ccbuena]), num(row[fijos.ccexcelente]),
    ]);
    if (cc.motivo) descartes.push({ grano, ciclo, campania, semana: semanaNum, motivo: `bloque CC (condición de cultivo): ${cc.motivo}` });

    const ch = bloqueBalanceado([
      num(row[fijos.chsequia]), num(row[fijos.chregular]), num(row[fijos.chadecuada]), num(row[fijos.choptima]), num(row[fijos.chexceso]),
    ]);
    if (ch.motivo) descartes.push({ grano, ciclo, campania, semana: semanaNum, motivo: `bloque CH (condición hídrica): ${ch.motivo}` });

    const fenologiaFila = fenologia.map((c) => ({ etapa: c.etapa, pct: num(row[c.idx]) }));

    const fila: FilaCondicion = {
      grano,
      ciclo,
      zona: zonaRaw,
      campania,
      semana: semanaNum,
      siembra_pct: num(row[fijos.siembra]),
      cc_mala: cc.valores[0] ?? null,
      cc_regular: cc.valores[1] ?? null,
      cc_normal: cc.valores[2] ?? null,
      cc_buena: cc.valores[3] ?? null,
      cc_excelente: cc.valores[4] ?? null,
      ch_sequia: ch.valores[0] ?? null,
      ch_regular: ch.valores[1] ?? null,
      ch_adecuada: ch.valores[2] ?? null,
      ch_optima: ch.valores[3] ?? null,
      ch_exceso: ch.valores[4] ?? null,
      fenologia: fenologiaFila,
    };

    const pk = `${grano}|${ciclo}|${zonaRaw}|${campania}|${semanaNum}`;
    if (!porPK.has(pk)) ordenPK.push(pk);
    else descartes.push({ grano, ciclo, campania, semana: semanaNum, motivo: "PK duplicada dentro del archivo — gana la última" });
    porPK.set(pk, fila); // última gana
  }

  const filas = ordenPK.map((pk) => porPK.get(pk)!);
  if (filas.length === 0) return { ok: false, error: "El archivo no trajo ninguna fila cargable — revisá los descartes." };

  const granos = [...new Set(filas.map((f) => f.grano))].sort();
  const ciclos = [...new Set(filas.map((f) => f.ciclo))].sort();
  const campanias = [...new Set(filas.map((f) => f.campania))].sort();
  const etapasPorCultivo: Record<string, string[]> = {};
  for (const g of granos) etapasPorCultivo[g] = fenologia.map((c) => c.etapa);

  return {
    ok: true,
    filas,
    descartes,
    etapasPorCultivo,
    zonasNuevas: [...zonasNuevas].sort(),
    resumen: { grano: granos.join(", "), ciclos, campanias, filas: filas.length },
  };
}

export function parsePasCondicion(datos: Uint8Array): ParseResultadoCondicion {
  if (datos.byteLength === 0) return { ok: false, error: "El archivo está vacío." };
  const buf = Buffer.from(datos.buffer, datos.byteOffset, datos.byteLength);
  const t = parseTablaXLSX(buf);
  if (t.error || !t.celdas) return { ok: false, error: `${t.error ?? "No pude leer el .xlsx."} ${ERROR_FORMATO}` };
  return parsePasCondicionCeldas(t.celdas);
}
