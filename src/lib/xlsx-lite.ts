import { inflateRawSync } from "node:zlib";

/**
 * xlsx-lite.ts — utilidades mínimas para leer un .xlsx SIN dependencias nuevas (un .xlsx es un
 * ZIP con central directory + deflate raw). Extraído de `src/lib/compras/parse-agrochat.ts`
 * (C23, docs/PLAN_PAS_ZONAS.md §4.a) — MOVE byte-a-byte, cero cambios de comportamiento: además
 * de `parse-agrochat.ts`, ahora lo comparten `parse-pas-zonas.ts` y (Fase 2) `parse-pas-condicion.ts`,
 * evitando la 3ª copia del mismo parser (el proyecto ya pagó un bug de producción por espejos
 * duplicados — auditoría E4).
 *
 * Módulo puro (sin "server-only"): permite testear con Node pelado.
 */

export function unzip(buf: Buffer): Record<string, Buffer> {
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
export function xmlDecode(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

/** Concatena los runs <t>…</t> de un bloque (shared string o inlineStr). */
export function textoDeRuns(xml: string): string {
  let out = "";
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out += xmlDecode(m[1] ?? "");
  return out;
}

/** "BC" → 54 (índice de columna 0-based). */
export function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Serial de fecha de Excel (epoch 1899-12-30) → ISO "AAAA-MM-DD". */
export function serialExcelAISO(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 60 || serial > 80000) return null;
  // floor, no round: un serial con hora (45838.958) no debe correr al día siguiente
  // (la fecha es parte de la clave de upsert — round crearía semanas fantasma).
  const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function parseTablaXLSX(buf: Buffer): { error?: string; celdas?: string[][]; numericas?: Set<string> } {
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
