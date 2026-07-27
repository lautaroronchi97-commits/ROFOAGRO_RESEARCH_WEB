import { inflateRawSync } from "node:zlib";

/**
 * parse-agrochat.ts — Parser del export de comercialización de granos de Agrochat (base SIO
 * Granos) para el uploader admin (/admin/datos). Acepta CSV (formato canónico, el mismo de
 * `data/compras/serie_agrochat_comercializacion_2019_2026.csv`) o Excel .xlsx.
 *
 * `scripts/cargar-compras.mjs` (el cargador manual por Actions) importa `parseAgrochat` de ESTE
 * archivo directamente (Node 22 puede importar `.ts` sin flags) — es la única fuente de verdad del
 * formato del export; antes estaba duplicado a mano en los dos lados (auditoría E4, hallazgo #2).
 *
 * El .xlsx se lee SIN dependencias nuevas: un .xlsx es un ZIP (central directory + deflate raw,
 * mismo truco que `scripts/ingest-usda.mjs` con el bulk del PSD) del que se extraen
 * `xl/sharedStrings.xml` y la primera hoja (`xl/worksheets/sheet1.xml`). Las fechas pueden venir
 * como serial numérico de Excel (epoch 1899-12-30) o como texto DD/MM/AAAA — se manejan ambas.
 *
 * Módulo puro (sin secretos ni estado): no importa "server-only" a propósito, así el unit-check
 * puede correrlo con Node pelado contra el CSV real. Solo lo importan las server actions.
 */

export const MAX_BYTES = 15 * 1024 * 1024; // 15 MB (el CSV real pesa ~720 KB)

export const CABECERA_ESPERADA =
  "fecha,grano,sector,campaña,compras_semanales,total_comprado_acumulado,precio_hecho,a_fijar,fijado,saldo_a_fijar";

/** Una fila lista para `admin_upsert_compras` (mismo shape que aFilaDB del cargador mjs). */
export type FilaCompra = {
  fecha: string; // ISO AAAA-MM-DD
  grano_raw: string;
  codigo_interno: string;
  campana: string; // formato largo "2019/20"
  sector: "EXPORTACION" | "INDUSTRIA";
  toneladas: number | null;
  toneladas_a_fijar: number | null;
  semanal_tn: number | null;
  precio_hecho_tn: number | null;
  fijado_tn: number | null;
  saldo_a_fijar_tn: number | null;
  djve_tn: null; // el export de Agrochat no trae DJVE (la RPC no pisa lo de MAGyP)
  fuente: "AGROCHAT";
};

export type ParseOk = {
  ok: true;
  filas: FilaCompra[];
  totalCrudas: number; // filas de datos leídas del archivo
  descartadas: number; // sin grano/sector/fecha/campaña mapeables o sin dato útil
  duplicadas: number; // repetidas por clave (queda la primera)
  advertencias: string[];
};
export type ParseResultado = ParseOk | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Mapeos y helpers (puerto 1:1 de scripts/cargar-compras.mjs)
// ---------------------------------------------------------------------------

/** grano (es, minúsculas) → codigo_interno del resto de la web. */
const GRANO_A_CODIGO: Record<string, string> = {
  trigo: "WHEAT",
  "maíz": "MAIZE",
  maiz: "MAIZE",
  sorgo: "SORGHUM",
  "cebada cervecera": "MALT",
  "cebada forrajera": "BARLEY",
  soja: "SBS",
  girasol: "SFSEED",
};

const SECTOR_A_NORM: Record<string, "EXPORTACION" | "INDUSTRIA"> = {
  exportador: "EXPORTACION",
  industria: "INDUSTRIA",
};

/**
 * "12.345" (miles) o "12345" o "539400,5" (decimal coma) → número; vacío/"-" → null.
 * OJO: el export real trae artefactos de float con PUNTO decimal ("64099.99999999999");
 * un punto solo se trata como separador de miles si los grupos son de 3 dígitos exactos
 * (el num() original del cargador mjs los rompía — corregido en los dos lados, 20/07).
 */
function num(s: string | undefined): number | null {
  const t = String(s ?? "").trim();
  if (t === "" || t === "-") return null;
  let limpio: string;
  if (t.includes(",")) {
    limpio = t.replace(/\./g, "").replace(",", "."); // "1.234,5" → "1234.5"
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    limpio = t.replace(/\./g, ""); // "12.345" → "12345" (miles)
  } else {
    limpio = t; // "64099.99999999999" → punto decimal (artefacto de float del origen)
  }
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** "DD/MM/AAAA" (o ya ISO "AAAA-MM-DD") → ISO. */
function fechaISO(s: string | undefined): string | null {
  const t = String(s ?? "").trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`; // grupos obligatorios del regex
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}

/** "19/20" → "2019/20". */
function campaniaLarga(cos: string | undefined): string | null {
  const m = String(cos ?? "").trim().match(/^(\d{2})\/(\d{2})$/);
  return m ? `20${m[1]}/${m[2]}` : null;
}

type Cruda = Record<string, string>;

function aFilaDB(r: Cruda): FilaCompra | null {
  const codigo = GRANO_A_CODIGO[(r["grano"] || "").toLowerCase().trim()];
  const sector = SECTOR_A_NORM[(r["sector"] || "").toLowerCase().trim()];
  const fecha = fechaISO(r["fecha"]);
  const campana = campaniaLarga(r["campana"]);
  if (!codigo || !sector || !fecha || !campana) return null;
  const total = num(r["total_comprado_acumulado"]);
  const semanal = num(r["compras_semanales"]);
  if (total == null && semanal == null) return null; // fila sin dato útil
  return {
    fecha,
    grano_raw: (r["grano"] || "").toLowerCase().trim(),
    codigo_interno: codigo,
    campana,
    sector,
    toneladas: total, // Total Comprado acumulado (fuente de verdad)
    toneladas_a_fijar: num(r["a_fijar"]),
    semanal_tn: semanal,
    precio_hecho_tn: num(r["precio_hecho"]),
    fijado_tn: num(r["fijado"]),
    saldo_a_fijar_tn: num(r["saldo_a_fijar"]),
    djve_tn: null,
    fuente: "AGROCHAT",
  };
}

export function claveFila(f: Pick<FilaCompra, "campana" | "codigo_interno" | "sector" | "fecha">): string {
  return `${f.campana}|${f.codigo_interno}|${f.sector}|${f.fecha}`;
}

// ---------------------------------------------------------------------------
// Cabecera: match por nombre normalizado (sin acentos, case-insensitive)
// ---------------------------------------------------------------------------

/** "Campaña" → "campana"; "Compras Semanales" → "compras_semanales". */
function normHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
}

const COLUMNAS = [
  "fecha", "grano", "sector", "campana", "compras_semanales",
  "total_comprado_acumulado", "precio_hecho", "a_fijar", "fijado", "saldo_a_fijar",
] as const;

/** Valida que la cabecera tenga las columnas mínimas; devuelve índice por columna canónica. */
function mapearCabecera(celdas: string[]): Map<string, number> | null {
  const idx = new Map<string, number>();
  celdas.forEach((h, i) => {
    const n = normHeader(h);
    if ((COLUMNAS as readonly string[]).includes(n) && !idx.has(n)) idx.set(n, i);
  });
  const obligatorias = ["fecha", "grano", "sector", "campana"];
  if (!obligatorias.every((c) => idx.has(c))) return null;
  if (!idx.has("compras_semanales") && !idx.has("total_comprado_acumulado")) return null;
  return idx;
}

// ---------------------------------------------------------------------------
// Export CRUDO de Agrochat (antes de su propia transformación) — 27/07/2026.
//
// El "csv_content" que arma el script fijo de Agrochat sale de la celda de un dataframe, no de
// un archivo descargable (al copiarlo se pierden los saltos de línea). El dataset de ORIGEN que
// Agrochat sí exporta como archivo real (columnas Date/Country/Sector/Crop/Harvest/Semanal/Total
// Comprado/... , en MILES de toneladas, con filas "Total" además de industria/exportador) es un
// CSV de verdad. Reproduce acá — en TypeScript, no atado al script de Agrochat — la MISMA
// transformación que ese script fijo (verificado 1:1 contra su código): filtrar sector
// industria/exportador (soltar "Total"), grano a minúscula, ×1000 a toneladas enteras.
// ---------------------------------------------------------------------------

const COLUMNAS_CRUDAS = [
  "date", "sector", "crop", "harvest", "semanal",
  "total_comprado", "total_precio_hecho", "total_a_fijar", "total_fijado", "saldo_a_fijar",
] as const;

const SECTOR_CRUDO_A_NOMBRE: Record<string, string> = {
  "compras de la industria": "Industria",
  "compras sector exportador": "Exportador",
};

/** Valida la cabecera del export crudo; devuelve índice por columna, o null si no matchea. */
function mapearCabeceraCruda(celdas: string[]): Map<string, number> | null {
  const idx = new Map<string, number>();
  celdas.forEach((h, i) => {
    const n = normHeader(h);
    if ((COLUMNAS_CRUDAS as readonly string[]).includes(n) && !idx.has(n)) idx.set(n, i);
  });
  const obligatorias = ["date", "sector", "crop", "harvest"];
  if (!obligatorias.every((c) => idx.has(c))) return null;
  if (!idx.has("semanal") && !idx.has("total_comprado")) return null;
  return idx;
}

/** Fila cruda (miles de tn, con "Total") → `Cruda` canónica (tn enteras) o null si es fila "Total". */
function crudaDesdeAgrochatRaw(row: string[], idx: Map<string, number>): Cruda | null {
  const get = (col: string): string => (row[idx.get(col) ?? -1] ?? "").trim();
  const nombreSector = SECTOR_CRUDO_A_NOMBRE[get("sector").toLowerCase()];
  if (!nombreSector) return null; // fila "Total" (o cualquier otro valor no mapeable): se descarta
  // Trunca como `.astype(int)` de numpy (NO redondea): reproduce bit a bit los mismos artefactos
  // de punto flotante que el script de Agrochat (ej. 516.8*1000 = 516799,9999999994 en ambos
  // lenguajes, IEEE754 — Python trunca a 516799; redondear acá daría 516800 y desalinearía este
  // camino del de "csv_content" ya transformado por Agrochat, que es la referencia de verdad).
  const milesATn = (s: string): string => {
    const n = num(s);
    return n == null ? "" : String(Math.trunc(n * 1000));
  };
  return {
    fecha: get("date"),
    grano: get("crop").toLowerCase(),
    sector: nombreSector,
    campana: get("harvest"),
    compras_semanales: milesATn(get("semanal")),
    total_comprado_acumulado: milesATn(get("total_comprado")),
    precio_hecho: milesATn(get("total_precio_hecho")),
    a_fijar: milesATn(get("total_a_fijar")),
    fijado: milesATn(get("total_fijado")),
    saldo_a_fijar: milesATn(get("saldo_a_fijar")),
  };
}

// ---------------------------------------------------------------------------
// CSV (tolera BOM, CRLF y campos entre comillas)
// ---------------------------------------------------------------------------

/** Split de una línea CSV con soporte de comillas ("" = comilla literal). */
function splitCsvLinea(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let enComillas = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (enComillas) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else enComillas = false;
      } else cur += ch;
    } else if (ch === '"') enComillas = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseTablaCSV(texto: string): { error?: string; celdas?: string[][] } {
  const limpio = texto.replace(/^\uFEFF/, ""); // BOM
  const lineas = limpio.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lineas.length === 0) return { error: "El archivo está vacío." };
  return { celdas: lineas.map(splitCsvLinea) };
}

// ---------------------------------------------------------------------------
// XLSX (ZIP mínimo sin dependencias — puerto de scripts/ingest-usda.mjs)
// ---------------------------------------------------------------------------

function unzip(buf: Buffer): Record<string, Buffer> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("ZIP: no encuentro End Of Central Directory");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const files: Record<string, Buffer> = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error("ZIP: firma de central directory mala");
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString("utf8");
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    // Tope anti zip-bomb: el límite de 15 MB es sobre el comprimido (deflate infla ~1000:1).
    files[name] = method === 0 ? comp : inflateRawSync(comp, { maxOutputLength: 64 * 1024 * 1024 });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/** Decodifica las entidades XML básicas + numéricas. */
function xmlDecode(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

/** Concatena los runs <t>…</t> de un bloque (shared string o inlineStr). */
function textoDeRuns(xml: string): string {
  let out = "";
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out += xmlDecode(m[1] ?? "");
  return out;
}

/** "BC" → 54 (índice de columna 0-based). */
function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Serial de fecha de Excel (epoch 1899-12-30) → ISO "AAAA-MM-DD". */
function serialExcelAISO(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 60 || serial > 80000) return null;
  // floor, no round: un serial con hora (45838.958) no debe correr al día siguiente
  // (la fecha es parte de la clave de upsert — round crearía semanas fantasma).
  const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function parseTablaXLSX(buf: Buffer): { error?: string; celdas?: string[][]; numericas?: Set<string> } {
  let files: Record<string, Buffer>;
  try {
    files = unzip(buf);
  } catch {
    return { error: "No pude leer el .xlsx (ZIP inválido)." };
  }

  // Shared strings (pueden no existir si la hoja es toda numérica).
  const shared: string[] = [];
  const ssXml = files["xl/sharedStrings.xml"]?.toString("utf8");
  if (ssXml) {
    const re = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(ssXml)) !== null) shared.push(textoDeRuns(m[1]!)); // grupo obligatorio del regex
  }

  // Primera hoja: sheet1.xml, o la primera xl/worksheets/sheet*.xml que exista.
  const hojaNombre =
    "xl/worksheets/sheet1.xml" in files
      ? "xl/worksheets/sheet1.xml"
      : Object.keys(files).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  const hoja = hojaNombre ? files[hojaNombre]?.toString("utf8") : undefined;
  if (!hoja) return { error: "El .xlsx no tiene hojas legibles." };

  const celdas: string[][] = [];
  const numericas = new Set<string>(); // "fila,col" de celdas con valor numérico crudo
  const rowRe = /<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g;
  const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let rm: RegExpExecArray | null;
  let fila = 0;
  while ((rm = rowRe.exec(hoja)) !== null) {
    const valores: string[] = [];
    let cm: RegExpExecArray | null;
    let colAuto = 0;
    while ((cm = cellRe.exec(rm[1]!)) !== null) {
      const attrs = cm[1] ?? ""; // grupo obligatorio del regex de <c ...> (nunca undefined en la práctica)
      const inner = cm[2] ?? "";
      const refM = attrs.match(/\br="([A-Z]+)\d+"/);
      const col = refM ? colIndex(refM[1]!) : colAuto; // grupo obligatorio del regex
      colAuto = col + 1;
      const tipoM = attrs.match(/\bt="(\w+)"/);
      const tipo = tipoM ? (tipoM[1] ?? "n") : "n";
      let valor = "";
      if (tipo === "inlineStr") valor = textoDeRuns(inner);
      else {
        const vM = inner.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/);
        const vRaw = vM ? xmlDecode(vM[1]!).trim() : ""; // grupo obligatorio del regex
        if (tipo === "s") valor = shared[Number(vRaw)] ?? "";
        else if (tipo === "n" && vRaw !== "") {
          // Numérico crudo: puede ser una cantidad o un serial de fecha. Se normaliza a
          // decimal-coma (num() trata "." como separador de miles) y se marca la celda.
          valor = vRaw.replace(".", ",");
          numericas.add(`${fila},${col}`);
        } else valor = vRaw; // t="str" (fórmula), t="b", etc.
      }
      valores[col] = valor;
    }
    if (valores.some((v) => (v ?? "").trim() !== "")) {
      // Rellenar huecos con "" para que el índice de columnas sea estable.
      celdas.push(Array.from({ length: valores.length }, (_, i) => valores[i] ?? ""));
      fila++;
    }
  }
  if (celdas.length === 0) return { error: "La hoja del .xlsx está vacía." };
  return { celdas, numericas };
}

// ---------------------------------------------------------------------------
// Entrada principal
// ---------------------------------------------------------------------------

const ERROR_FORMATO =
  `No reconozco el formato del archivo. Exportá de Agrochat como CSV con esta cabecera: ${CABECERA_ESPERADA}` +
  ` — o subí directamente el dataset crudo (Date,Country,Sector,Crop,Harvest,Semanal,Total Comprado,…).`;

export function parseAgrochat(datos: Uint8Array, nombre: string): ParseResultado {
  if (datos.byteLength === 0) return { ok: false, error: "El archivo está vacío." };
  if (datos.byteLength > MAX_BYTES) {
    return { ok: false, error: `El archivo pesa más de 15 MB (${Math.round(datos.byteLength / 1048576)} MB). Exportá un período más corto.` };
  }

  const buf = Buffer.from(datos.buffer, datos.byteOffset, datos.byteLength);
  const esZip = buf.length > 3 && buf.readUInt32LE(0) === 0x04034b50; // "PK\x03\x04"
  const advertencias: string[] = [];

  let celdas: string[][];
  let numericas = new Set<string>();
  if (esZip || /\.xlsx$/i.test(nombre)) {
    if (!esZip) return { ok: false, error: "El .xlsx no parece un Excel válido. " + ERROR_FORMATO };
    const t = parseTablaXLSX(buf);
    if (t.error || !t.celdas) return { ok: false, error: `${t.error ?? "No pude leer el .xlsx."} ${ERROR_FORMATO}` };
    celdas = t.celdas;
    numericas = t.numericas ?? new Set();
  } else {
    const t = parseTablaCSV(buf.toString("utf8"));
    if (t.error || !t.celdas) return { ok: false, error: t.error ?? ERROR_FORMATO };
    celdas = t.celdas;
  }

  // L3 (noUncheckedIndexedAccess): reveló un caso sin cubrir — un archivo de 0 filas (celdas=[])
  // llegaba con `celdas[0]` undefined a mapearCabecera(), que hace `.forEach` sin guard → TypeError
  // sin capturar (mitigado hoy solo por el try/catch genérico de `actions.ts`, hallazgo #8 de E4,
  // que lo convierte en un error "no pude leer el archivo" en vez del ERROR_FORMATO específico).
  // Con el guard explícito, un archivo vacío da el mismo mensaje que cualquier otro formato inválido.
  const cabecera = celdas[0];
  if (!cabecera) return { ok: false, error: ERROR_FORMATO };
  const idx = mapearCabecera(cabecera);
  const idxCrudo = idx ? null : mapearCabeceraCruda(cabecera);
  if (!idx && !idxCrudo) return { ok: false, error: ERROR_FORMATO };

  const crudas: Cruda[] = [];
  let fechasSerial = 0;

  if (idxCrudo) {
    // Export CRUDO de Agrochat (Date/Country/Sector/Crop/Harvest/..., miles de tn, con "Total").
    for (let f = 1; f < celdas.length; f++) {
      const row = celdas[f] ?? [];
      const cr = crudaDesdeAgrochatRaw(row, idxCrudo);
      if (cr) crudas.push(cr); // fila "Total": se descarta silenciosamente (no es un dato propio)
    }
    advertencias.push(
      "Detecté el export crudo de Agrochat (antes de su transformación interna): se filtraron las filas \"Total\" y se convirtieron los valores de miles de toneladas a toneladas enteras automáticamente.",
    );
  } else {
    const idxCanon = idx!;
    const iFecha = idxCanon.get("fecha")!;
    const iCampana = idxCanon.get("campana")!;
    for (let f = 1; f < celdas.length; f++) {
      const row = celdas[f] ?? []; // f<celdas.length por el for → siempre existe; `[]` solo para el tipo
      const r: Cruda = {};
      for (const [col, i] of idxCanon) r[col] = (row[i] ?? "").trim();

      // Fechas de Excel como serial numérico (epoch 1899-12-30) → ISO.
      if (numericas.has(`${f},${iFecha}`)) {
        // "fecha" siempre quedó seteada en el loop de arriba (es obligatoria en mapearCabecera).
        const iso = serialExcelAISO(Number((r["fecha"] ?? "").replace(",", ".")));
        if (iso) { r["fecha"] = iso; fechasSerial++; }
      }
      // Campaña que Excel convirtió a número/fecha (p. ej. "19/20" → serial): no es recuperable.
      if (numericas.has(`${f},${iCampana}`) && !campaniaLarga(r["campana"])) r["campana"] = "";
      crudas.push(r);
    }
    if (fechasSerial > 0) advertencias.push(`${fechasSerial} fechas venían como serial de Excel y se convirtieron.`);
  }

  // Transformar + dedup por clave (queda la primera aparición, como el cargador mjs).
  const filas: FilaCompra[] = [];
  const vistas = new Set<string>();
  let descartadas = 0;
  let duplicadas = 0;
  for (const r of crudas) {
    const fila = aFilaDB(r);
    if (!fila) { descartadas++; continue; }
    const k = claveFila(fila);
    if (vistas.has(k)) { duplicadas++; continue; }
    vistas.add(k);
    filas.push(fila);
  }

  // Guard anti falso-verde: archivo con contenido pero nada parseó → formato cambiado.
  if (crudas.length > 10 && filas.length === 0) {
    return { ok: false, error: "El archivo tiene filas pero ninguna parseó — ¿cambió el formato del export? " + ERROR_FORMATO };
  }
  if (filas.length === 0) return { ok: false, error: "No hay ninguna fila válida para cargar." };

  if (descartadas > 0) advertencias.push(`${descartadas} filas descartadas (grano/sector/fecha/campaña no mapeables o sin dato).`);
  if (duplicadas > 0) advertencias.push(`${duplicadas} filas duplicadas por clave (se toma la primera).`);

  return { ok: true, filas, totalCrudas: crudas.length, descartadas, duplicadas, advertencias };
}
