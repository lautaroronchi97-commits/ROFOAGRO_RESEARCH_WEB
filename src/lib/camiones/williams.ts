/**
 * Parser puro del backfill de Williams Entregas (data/camiones/williams_camiones_*.csv,
 * 2018-01-02 → 2026-07-22 — coordinado 23/07/2026: es la fuente real que usa Lautaro, "la fuente
 * de camiones por excelencia"). Sin dependencias, mismo espíritu que los parsers xlsx-sin-deps del
 * uploader de compras. Módulo PURO (sin red/DB) para poder testearlo.
 *
 * Dos CSV, mismas 2.664 filas diarias:
 *  - zonas: 4 columnas (Darsenas y Bs As · Puertos de Necochea · Puertos-B.Blanca · Rosario y
 *    Zona) — mapean 1:1 a las 4 zonas EXACTAS del reporte diario de SAGyP (negocio/09 §mapeo).
 *  - localidades: 33 columnas de localidad individual — SIN mapeo de negocio para casi todas
 *    (solo 8 tienen match claro contra src/lib/lineup/zonas.ts); se usa acá SOLO como cross-check
 *    de cobertura de "Rosario y Zona"/"Puertos-B.Blanca" contra las localidades que zonas.ts ya
 *    clasifica como Up River Norte/Sur/Bahía Blanca — no se persiste a la tabla `camiones`.
 *
 * ⚠️ Este módulo NO importa de `./config` (aunque `ZonaCamiones` conceptualmente "vive" ahí) — a
 * propósito: `scripts/cargar-camiones-williams.mjs` lo importa y ejecuta con Node PLANO (sin
 * bundler), y Node exige extensión explícita `.ts` en imports internos TS→TS, algo que el
 * `moduleResolution:"bundler"` del tsconfig del proyecto no permite en el código de la app. Se
 * mantiene 100% self-contained para poder correr en los dos mundos; `config.ts` re-exporta el tipo
 * desde acá (fuente de verdad única, dependencia en el sentido inverso al resto de la carpeta).
 */

export type ZonaCamiones = "ROSARIO_ALEDANOS" | "DARSENA_BSAS_ER" | "NECOCHEA" | "BAHIA_BLANCA";
const ZONA_CLAVES: ZonaCamiones[] = ["ROSARIO_ALEDANOS", "DARSENA_BSAS_ER", "NECOCHEA", "BAHIA_BLANCA"];

const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

/** "ene 2, 2018" → "2018-01-02". null si el texto no matchea el formato esperado. */
export function fechaWilliams(raw: string): string | null {
  const m = raw.trim().match(/^([a-zé]{3})\s+(\d{1,2}),\s*(\d{4})$/i);
  if (!m) return null;
  const mes = MESES[(m[1] ?? "").toLowerCase()];
  if (!mes) return null;
  const dia = Number(m[2] ?? "");
  const anio = Number(m[3] ?? "");
  if (!Number.isFinite(dia) || !Number.isFinite(anio) || dia < 1 || dia > 31) return null;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Una línea CSV respetando comillas (los campos de fecha traen una coma adentro: `"ene 2, 2018"`). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

export function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { header: [], rows: [] };
  const header = parseCsvLine(lines[0]!).map((h) => h.trim()); // lines.length===0 ya salió arriba
  const rows = lines.slice(1).map(parseCsvLine);
  return { header, rows };
}

/**
 * Celda numérica del CSV Williams → número. Vacío = 0 (decisión documentada 23/07: el research
 * dice "algunas celdas vacías (no 0) para localidades sin actividad ese día — tratalas como 0 o
 * null, pero NO como dato faltante del día completo"; se elige 0 — la fila del día SÍ existe, es
 * la zona/localidad la que no tuvo entradas, que es información real, no un hueco de la fuente).
 */
export function numCamion(s: string | undefined): number {
  const t = (s ?? "").trim();
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

/** Columna del CSV de zonas Williams → clave canónica del reporte SAGyP (negocio/09 §mapeo, 23/07). */
export const ZONA_COLUMNA_WILLIAMS: Record<string, ZonaCamiones> = {
  "Darsenas y Bs As": "DARSENA_BSAS_ER",
  "Puertos de Necochea": "NECOCHEA",
  "Puertos-B.Blanca": "BAHIA_BLANCA",
  "Rosario y Zona": "ROSARIO_ALEDANOS",
};

export type FilaZonaWilliams = { fecha: string; clave: ZonaCamiones; cantidad: number };
export type FilaTotalWilliams = { fecha: string; cantidad: number };

/**
 * "Cultivo" del export tidy de Williams → misma "serie" que ya usa el resto del módulo (no se
 * importa `ProductoSerie` de `./config` a propósito — mismo criterio que `ZonaCamiones`: este
 * archivo es self-contained para poder correr con Node plano; el union es estructuralmente
 * idéntico, TS lo acepta sin import en el caller).
 */
export type SerieCultivo = "TOTAL" | "SBS" | "MAIZE" | "WHEAT" | "BARLEY" | "SORGHUM" | "SFSEED";

const CULTIVO_A_SERIE: Record<string, SerieCultivo> = {
  total: "TOTAL",
  soja: "SBS",
  "maiz": "MAIZE",
  "maíz": "MAIZE",
  trigo: "WHEAT",
  cebada: "BARLEY",
  sorgo: "SORGHUM",
  girasol: "SFSEED",
};

/** "2026-07-01" (ISO, como trae el export tidy) o "ene 2, 2018" (formato del export de zonas). */
function fechaFlexWilliams(raw: string): string | null {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return fechaWilliams(t);
}

export type ParseCrudoResultado = {
  filas: FilaZonaWilliams[];
  cultivos: string[]; // valores distintos de "Cultivo" hallados en el archivo, tal cual vienen
  serieDetectada: SerieCultivo | null; // solo si hay UN cultivo y es mapeable
  filasInvalidas: number;
};

/**
 * Parsea el export TIDY/crudo de Williams — una fila por TERMINAL/día (columnas Date, Cultivo,
 * Localidad, Puerto, Zona, Cantidad de Camiones) — verificado en vivo 27/07/2026. Es el más
 * confiable de los 3 formatos: la ZONA SAGyP ya viene explícita en el propio dato (no hay que
 * mapear localidad → zona a mano, a diferencia del formato de 33 columnas). Agrupa sumando
 * camiones por (fecha, zona).
 *
 * Si el archivo mezcla más de un "Cultivo" (ej. filas "Total" conviviendo con filas "Maíz"), NO
 * se puede sumar a ciegas — "Total" ya incluye el grano puntual, sumarlos duplicaría camiones.
 * En ese caso `filas` queda vacío y `cultivos` lista lo encontrado, para que el caller decida (el
 * uploader lo bloquea con un error explícito en vez de cargar un número inflado en silencio).
 */
export function parseCrudoWilliams(text: string): ParseCrudoResultado {
  const { header, rows } = parseCsv(text);
  const iFecha = header.indexOf("Date");
  const iCultivo = header.indexOf("Cultivo");
  const iZona = header.indexOf("Zona");
  const iCantidad = header.indexOf("Cantidad de Camiones");

  const cultivos = new Set<string>();
  let filasInvalidas = 0;
  const acumulado = new Map<string, number>(); // "fecha|clave" -> suma de camiones

  for (const row of rows) {
    const fecha = fechaFlexWilliams(row[iFecha] ?? "");
    const clave = ZONA_COLUMNA_WILLIAMS[(row[iZona] ?? "").trim()];
    if (!fecha || !clave) { filasInvalidas++; continue; }
    if (iCultivo >= 0) {
      const c = (row[iCultivo] ?? "").trim();
      if (c) cultivos.add(c);
    }
    const k = `${fecha}|${clave}`;
    acumulado.set(k, (acumulado.get(k) ?? 0) + numCamion(row[iCantidad]));
  }

  const cultivosOrdenados = [...cultivos].sort();
  const serieDetectada =
    cultivosOrdenados.length === 1 ? (CULTIVO_A_SERIE[cultivosOrdenados[0]!.toLowerCase()] ?? null) : null;

  if (cultivosOrdenados.length > 1) {
    return { filas: [], cultivos: cultivosOrdenados, serieDetectada: null, filasInvalidas };
  }

  const filas: FilaZonaWilliams[] = [...acumulado.entries()].map(([k, cantidad]) => {
    const [fecha, clave] = k.split("|") as [string, ZonaCamiones];
    return { fecha, clave, cantidad };
  });
  return { filas, cultivos: cultivosOrdenados, serieDetectada, filasInvalidas };
}

/** Parsea el CSV de zonas Williams → filas por (fecha, zona) + el total del día (suma de las 4). */
export function parseZonasWilliams(text: string): {
  filas: FilaZonaWilliams[];
  totales: FilaTotalWilliams[];
  filasInvalidas: number;
} {
  const { header, rows } = parseCsv(text);
  const cols = header.slice(1).map((h) => ZONA_COLUMNA_WILLIAMS[h] ?? null);
  const filas: FilaZonaWilliams[] = [];
  const totales: FilaTotalWilliams[] = [];
  let filasInvalidas = 0;
  for (const row of rows) {
    const fecha = fechaWilliams(row[0] ?? "");
    if (!fecha) {
      filasInvalidas++;
      continue;
    }
    let total = 0;
    for (let i = 0; i < cols.length; i++) {
      const clave = cols[i];
      if (!clave) continue;
      const cantidad = numCamion(row[i + 1]);
      filas.push({ fecha, clave, cantidad });
      total += cantidad;
    }
    totales.push({ fecha, cantidad: total });
  }
  return { filas, totales, filasInvalidas };
}

/**
 * Localidades del CSV de 33 columnas que YA tienen match claro contra `src/lib/lineup/zonas.ts`
 * (BERTH_SUR/BERTH_NORTE + el fallback por `port`) — coordinado 23/07/2026, sin inventar
 * clasificación para las 25 localidades restantes (San Nicolás, San Pedro, Baradero, Ricardone,
 * Gral. San Martín, etc. quedan fuera: no tienen mapeo hoy en zonas.ts).
 */
export const LOCALIDADES_GRAN_ROSARIO = [
  "Alvear", "Arroyo Seco", "General Lagos", "Ramallo", "Rosario", "Timbues", "San Lorenzo",
] as const;
export const LOCALIDADES_BAHIA_BLANCA = ["Bahia Blanca"] as const;

/**
 * Cross-check de cobertura: para cada día, suma de las localidades mapeadas a Gran Rosario / Bahía
 * Blanca (CSV de localidades) vs la columna de zona equivalente del CSV de zonas (Rosario y Zona /
 * Puertos-B.Blanca). Devuelve el % de cobertura promedio — cuánto de la zona SAGyP explican las
 * localidades con match claro (el resto son San Nicolás/San Pedro/Baradero/etc., sin mapeo hoy).
 * Diagnóstico, no se persiste — reportado en el log del loader para que Lautaro lo vea.
 */
export function crossCheckLocalidades(
  textoZonas: string,
  textoLocalidades: string,
): { coberturaGranRosarioPct: number | null; coberturaBahiaPct: number | null; dias: number } {
  const zonas = parseCsv(textoZonas);
  const loc = parseCsv(textoLocalidades);

  const idxZonaRosario = zonas.header.indexOf("Rosario y Zona");
  const idxZonaBahia = zonas.header.indexOf("Puertos-B.Blanca");
  const rosarioPorFecha = new Map<string, number>();
  const bahiaPorFecha = new Map<string, number>();
  for (const row of zonas.rows) {
    const fecha = fechaWilliams(row[0] ?? "");
    if (!fecha) continue;
    if (idxZonaRosario >= 0) rosarioPorFecha.set(fecha, numCamion(row[idxZonaRosario]));
    if (idxZonaBahia >= 0) bahiaPorFecha.set(fecha, numCamion(row[idxZonaBahia]));
  }

  const idxsRosario = LOCALIDADES_GRAN_ROSARIO.map((n) => loc.header.indexOf(n)).filter((i) => i >= 0);
  const idxsBahia = LOCALIDADES_BAHIA_BLANCA.map((n) => loc.header.indexOf(n)).filter((i) => i >= 0);

  let sumRosarioLoc = 0;
  let sumRosarioZona = 0;
  let sumBahiaLoc = 0;
  let sumBahiaZona = 0;
  let dias = 0;
  for (const row of loc.rows) {
    const fecha = fechaWilliams(row[0] ?? "");
    if (!fecha) continue;
    const zR = rosarioPorFecha.get(fecha);
    const zB = bahiaPorFecha.get(fecha);
    if (zR == null && zB == null) continue;
    dias++;
    if (zR != null) {
      sumRosarioLoc += idxsRosario.reduce((acc, i) => acc + numCamion(row[i]), 0);
      sumRosarioZona += zR;
    }
    if (zB != null) {
      sumBahiaLoc += idxsBahia.reduce((acc, i) => acc + numCamion(row[i]), 0);
      sumBahiaZona += zB;
    }
  }

  return {
    coberturaGranRosarioPct: sumRosarioZona > 0 ? (100 * sumRosarioLoc) / sumRosarioZona : null,
    coberturaBahiaPct: sumBahiaZona > 0 ? (100 * sumBahiaLoc) / sumBahiaZona : null,
    dias,
  };
}

export type ParseUploadOk = {
  ok: true;
  filas: FilaZonaWilliams[];
  formato: "zonas" | "localidades" | "crudo";
  zonasCubiertas: ZonaCamiones[];
  filasInvalidas: number;
  advertencias: string[];
  /** Solo para formato "crudo": la serie que el propio archivo dice representar (columna
   * "Cultivo"), para cruzarla contra la serie elegida en el selector del uploader. */
  serieDetectada?: SerieCultivo | null;
};
export type ParseUploadErr = { ok: false; error: string };

/**
 * Parser ÚNICO del uploader manual de /admin/datos (pestaña Camiones) Y del loader de backfill
 * `scripts/cargar-camiones-williams.mjs` — reusan esta misma función (decisión 23/07: "no
 * dupliques el parser"). Detecta el formato por el header (Lautoro puede exportar de Agrochat
 * cualquiera de los tres formatos de Williams Entregas):
 *  - **zonas** (4 columnas: Darsenas y Bs As / Puertos de Necochea / Puertos-B.Blanca / Rosario y
 *    Zona) → las 4 zonas completas, vía `parseZonasWilliams`.
 *  - **localidades** (33 columnas por localidad) → SOLO se puede derivar Gran Rosario (7
 *    localidades con match claro en zonas.ts) y Bahía Blanca (columna directa); Dársena y Necochea
 *    NO tienen mapeo de localidad hoy, así que esas 2 zonas quedan sin dato ese día (se avisa en
 *    `advertencias`, no se inventa un valor).
 *  - **crudo/tidy** (Date, Cultivo, Localidad, Puerto, Zona, Cantidad de Camiones — una fila por
 *    terminal/día) → el más confiable de los tres, la Zona SAGyP ya viene explícita en el propio
 *    dato (27/07/2026). Vía `parseCrudoWilliams`.
 */
export function parseCamionesUpload(text: string): ParseUploadOk | ParseUploadErr {
  const { header, rows } = parseCsv(text);
  if (header.length < 2) return { ok: false, error: "El archivo está vacío o no tiene columnas reconocibles." };

  const esZonas = header.includes("Rosario y Zona") && header.includes("Puertos-B.Blanca");
  if (esZonas) {
    const { filas, filasInvalidas } = parseZonasWilliams(text);
    if (filas.length === 0) {
      return { ok: false, error: "No se pudo parsear ninguna fila del formato de zonas (¿cambió el CSV?)." };
    }
    return { ok: true, filas, formato: "zonas", zonasCubiertas: [...ZONA_CLAVES], filasInvalidas, advertencias: [] };
  }

  const esLocalidades =
    header.includes("San Lorenzo") && header.includes("Rosario") && header.includes("Bahia Blanca");
  if (esLocalidades) {
    const idxRosario = LOCALIDADES_GRAN_ROSARIO.map((n) => header.indexOf(n)).filter((i) => i >= 0);
    const idxBahia = LOCALIDADES_BAHIA_BLANCA.map((n) => header.indexOf(n)).filter((i) => i >= 0);
    const filas: FilaZonaWilliams[] = [];
    let filasInvalidas = 0;
    for (const row of rows) {
      const fecha = fechaWilliams(row[0] ?? "");
      if (!fecha) {
        filasInvalidas++;
        continue;
      }
      filas.push({ fecha, clave: "ROSARIO_ALEDANOS", cantidad: idxRosario.reduce((acc, i) => acc + numCamion(row[i]), 0) });
      filas.push({ fecha, clave: "BAHIA_BLANCA", cantidad: idxBahia.reduce((acc, i) => acc + numCamion(row[i]), 0) });
    }
    if (filas.length === 0) {
      return { ok: false, error: "No se pudo parsear ninguna fila del formato de localidades (¿cambió el CSV?)." };
    }
    return {
      ok: true,
      filas,
      formato: "localidades",
      zonasCubiertas: ["ROSARIO_ALEDANOS", "BAHIA_BLANCA"],
      filasInvalidas,
      advertencias: [
        "Formato de localidades: solo se pudo cargar Rosario y aledaños + Bahía Blanca " +
          "(Dársena Bs As-E. Ríos y Puerto Necochea no tienen mapeo de localidad hoy — " +
          "para esas 2 zonas subí el export de ZONAS de Williams).",
      ],
    };
  }

  const esCrudo =
    header.includes("Zona") && header.includes("Cantidad de Camiones") && header.includes("Date");
  if (esCrudo) {
    const { filas, cultivos, serieDetectada, filasInvalidas } = parseCrudoWilliams(text);
    if (cultivos.length > 1) {
      return {
        ok: false,
        error:
          `El archivo mezcla más de un cultivo (${cultivos.join(", ")}) — sumarlos todos duplicaría ` +
          `camiones si "Total" convive con un grano puntual. Pedile a Agrochat el export filtrado a UN ` +
          `solo cultivo por archivo (o el rango de fechas donde solo haya uno).`,
      };
    }
    if (filas.length === 0) {
      return { ok: false, error: "No se pudo parsear ninguna fila del formato crudo (¿cambió el CSV?)." };
    }
    return {
      ok: true,
      filas,
      formato: "crudo",
      zonasCubiertas: [...new Set(filas.map((f) => f.clave))],
      filasInvalidas,
      advertencias: [],
      serieDetectada,
    };
  }

  return {
    ok: false,
    error:
      "No reconozco el formato del CSV (esperaba las columnas de ZONAS de Williams Entregas — " +
      "Darsenas y Bs As / Puertos de Necochea / Puertos-B.Blanca / Rosario y Zona — o las de " +
      "LOCALIDADES — San Lorenzo / Rosario / Bahia Blanca / … — o el formato crudo/tidy — Date, " +
      "Cultivo, Localidad, Puerto, Zona, Cantidad de Camiones).",
  };
}
