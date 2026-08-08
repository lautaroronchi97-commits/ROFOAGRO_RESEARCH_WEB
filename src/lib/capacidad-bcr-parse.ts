// Extensión ".ts" explícita (C32/F1, 08/08/2026, tsconfig.json suma "allowImportingTsExtensions"):
// `scripts/ingest-fas.mjs` importa este módulo con Node plano, sin bundler — la resolución nativa
// de Node exige extensión explícita en imports relativos (verificado: sin ella, `node` tira
// ERR_MODULE_NOT_FOUND al resolver "./env-utils"). Next/webpack siguen resolviendo ".ts" igual.
import { arNum } from "./env-utils.ts";

/**
 * Parser puro (testeable) de la planilla de FAS Teórico de BCR — separado de `capacidad.ts`
 * (que trae "server-only" por el fetch) para poder testear la lógica de extracción con
 * fixtures de HTML real, sin red.
 *
 * Cada bloque "Commodity" de la planilla agrupa DOS granos en las mismas filas de costos/FAS
 * (ej. "Trigo / Wheat" + "Sorg/Srg"; "Soja / Soybeans" + "Gsl/Sunfl.") — el 1er valor numérico
 * de cada fila es SIEMPRE el grano listado primero (columna SAGyP, sin los colspans de las
 * posiciones forward "Up River") y el ÚLTIMO valor es SIEMPRE el grano listado segundo (también
 * SAGyP, también sin forwards — sorgo y girasol solo cotizan spot en esta planilla). Verificado
 * por consistencia aritmética real: impuestos ÷ FOB = alícuota de derechos de exportación
 * vigente, exacto, para los 5 granos (docs/sesiones/2026-07-24-c16-capacidad-pago.md).
 */

// Fragmento inicial de la etiqueta del "Commodity"/"Complejo" (split por "/" del texto real) → underlying.
// "Girasol" (con nombre completo) solo aparece en el bloque de Industria; "Gsl" es el bloque de grano.
const GRANOS_COMMODITY: Record<string, string> = {
  Trigo: "TRI",
  Maíz: "MAI",
  Maiz: "MAI",
  Soja: "SOJ",
  Sorg: "SOR",
  Gsl: "GIR",
  Girasol: "GIR",
};

export type FilaBcr = {
  fob: number | null;
  impuestos: number | null;
  gastosPuertos: number | null;
  gastosComerc: number | null;
  fas: number | null;
};
export type ParseBcrResult = { porGrano: Record<string, FilaBcr>; fecha: string | null };

function filaVacia(): FilaBcr {
  return { fob: null, impuestos: null, gastosPuertos: null, gastosComerc: null, fas: null };
}

/** Todos los números de una fila (celdas de datos, sin la etiqueta de la 1ª columna). */
export function numerosDeFila(cells: string[]): number[] {
  const nums: number[] = [];
  for (const c of cells.slice(1)) {
    const v = arNum(c);
    if (v != null && Number.isFinite(v)) nums.push(v);
  }
  return nums;
}

/**
 * Asigna el 1er valor de la fila al grano listado primero (siempre confiable: nunca depende de
 * si otras celdas parsearon bien), y el ÚLTIMO al listado segundo — genérico: lo usan tanto la
 * tabla de grano (`FilaBcr`) como la de industria (`FilaBcrIndustria`), mismo layout de columnas
 * SAGyP-primero/último en ambas.
 *
 * `totalColsEsperadas` (del header "Puerto/Port(s)" del bloque, ver `contarColumnas`): si se
 * pasa y `nums.length` no coincide, NO se asigna el último valor — una celda de en medio rota
 * (ej. el typo real "v165,0" de girasol en la sección Industria) puede correr el índice y
 * pisarle al segundo grano un valor que en realidad es del primero. Sin este chequeo, ese bug
 * pasaba silencioso: el "último valor" dejaba de ser el último grano.
 */
export function asignarFilaGrano<F extends Record<string, unknown>>(
  porGrano: Record<string, F>,
  granosBloque: string[],
  campo: keyof F,
  nums: number[],
  totalColsEsperadas?: number,
) {
  if (granosBloque.length === 0 || nums.length === 0) return;
  const primero = granosBloque[0]!; // length===0 ya salió arriba
  const filaPrimero = porGrano[primero];
  if (filaPrimero && filaPrimero[campo] == null) filaPrimero[campo] = nums[0] as F[keyof F];
  if (granosBloque.length > 1 && nums.length > 1) {
    if (totalColsEsperadas != null && nums.length !== totalColsEsperadas) return;
    const segundo = granosBloque[granosBloque.length - 1]!;
    const filaSegundo = porGrano[segundo];
    if (filaSegundo && filaSegundo[campo] == null) filaSegundo[campo] = nums[nums.length - 1] as F[keyof F];
  }
}

/** Cuenta las celdas de datos no vacías de la fila "Puerto/Port(s)" — total de columnas del bloque. */
export function contarColumnas(cells: string[]): number {
  return cells.slice(1).filter(Boolean).length;
}

/**
 * Parsea el segmento HTML `#sheet` (ya recortado antes de "Industria Aceitera" por el caller)
 * en un mapa grano → {fob, impuestos, gastosPuertos, gastosComerc, fas} + la fecha del informe.
 */
export function parseBcr(html: string, granosOrden: readonly string[]): ParseBcrResult {
  const i = html.indexOf("sheet-wrapper");
  if (i < 0) return { porGrano: {}, fecha: null };
  let seg = html.slice(i, i + 60_000).replace(/<style>[\s\S]*?<\/style>/g, " ");
  const cut = seg.indexOf("Industria Aceitera"); // corta antes del complejo aceitero (FAS Industria, fuera de alcance)
  if (cut > 0) seg = seg.slice(0, cut);

  const fm = seg.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const fecha = fm ? `${fm[3]}-${fm[2]}-${fm[1]}` : null;

  const porGrano: Record<string, FilaBcr> = {};
  for (const u of granosOrden) porGrano[u] = filaVacia();

  let granosBloque: string[] = [];
  for (const rowHtml of seg.split(/<\/tr>/)) {
    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
      .map((m) => (m[1] ?? "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim()) // grupo obligatorio del regex
      .filter(Boolean);
    if (cells.length === 0) continue;
    const head = cells[0]!; // cells.length===0 ya salió arriba

    if (head.startsWith("Commodity")) {
      granosBloque = [];
      for (const c of cells.slice(1)) {
        const key = c.split("/")[0]!.trim(); // split() nunca da array vacío
        const g = GRANOS_COMMODITY[key];
        if (g && !granosBloque.includes(g)) granosBloque.push(g);
      }
    } else if (head.startsWith("FOB comprador")) {
      asignarFilaGrano(porGrano, granosBloque, "fob", numerosDeFila(cells));
    } else if (head.startsWith("a) Impuestos")) {
      asignarFilaGrano(porGrano, granosBloque, "impuestos", numerosDeFila(cells));
    } else if (head.startsWith("b) Gastos en puertos")) {
      asignarFilaGrano(porGrano, granosBloque, "gastosPuertos", numerosDeFila(cells));
    } else if (head.startsWith("c) Gtos. Comerc")) {
      asignarFilaGrano(porGrano, granosBloque, "gastosComerc", numerosDeFila(cells));
    } else if (head.startsWith("FAS Teórico")) {
      asignarFilaGrano(porGrano, granosBloque, "fas", numerosDeFila(cells));
    }
  }
  return { porGrano, fecha };
}

export type FilaBcrIndustria = { fobAceite: number | null; fobPellets: number | null; fas: number | null };
export type ParseBcrIndustriaResult = { porGrano: Record<string, FilaBcrIndustria>; fecha: string | null };

function filaIndustriaVacia(): FilaBcrIndustria {
  return { fobAceite: null, fobPellets: null, fas: null };
}

/**
 * Parsea la sección "Cálculo del FAS Teórico para la Industria Aceitera Exportadora" (soja +
 * girasol, complejo aceite/harina/pellets) — la misma planilla de BCR, la parte que `parseBcr`
 * descarta a propósito (es un cálculo distinto: capacidad de pago de la INDUSTRIA que crushea,
 * no del exportador de grano sin procesar). Mismo criterio 1er/último valor que `parseBcr`
 * (bloque "Complejo / Complex" en vez de "Commodity"): soja listada primero (columnas Ago-26/
 * Sep-26 forward), girasol al final (columna Spot). La fila "FAS Teórico en u$s y $ (BNA)" trae
 * el equivalente en pesos entre paréntesis intercalado (ej. "($503,720)") — `numerosDeFila` ya
 * lo descarta solo porque `arNum` no puede parsear paréntesis, así que los valores en USD quedan
 * limpios sin tratamiento especial.
 */
export function parseBcrIndustria(html: string, granosOrden: readonly string[]): ParseBcrIndustriaResult {
  const i = html.indexOf("Industria Aceitera");
  if (i < 0) return { porGrano: {}, fecha: null };
  const seg = html.slice(i, i + 20_000);

  const fm = seg.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const fecha = fm ? `${fm[3]}-${fm[2]}-${fm[1]}` : null;

  const porGrano: Record<string, FilaBcrIndustria> = {};
  for (const u of granosOrden) porGrano[u] = filaIndustriaVacia();

  let granosBloque: string[] = [];
  let totalColsEsperadas: number | undefined;
  for (const rowHtml of seg.split(/<\/tr>/)) {
    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
      .map((m) => (m[1] ?? "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim()) // grupo obligatorio del regex
      .filter(Boolean);
    if (cells.length === 0) continue;
    const head = cells[0]!; // cells.length===0 ya salió arriba

    if (head.startsWith("Complejo")) {
      granosBloque = [];
      for (const c of cells.slice(1)) {
        const key = c.split("/")[0]!.trim(); // split() nunca da array vacío
        const g = GRANOS_COMMODITY[key];
        if (g && !granosBloque.includes(g)) granosBloque.push(g);
      }
    } else if (head.startsWith("Puerto")) {
      // "Puertos / Ports": Ago-26/Sep-26 (soja) + Spot (girasol) — a diferencia de la tabla de
      // grano, ACÁ esta fila SÍ coincide 1:1 con la cantidad real de valores de las filas de
      // datos (verificado con el fixture real) → sirve de chequeo contra celdas rotas.
      totalColsEsperadas = contarColumnas(cells);
    } else if (head.startsWith("FOB ACEITE")) {
      asignarFilaGrano(porGrano, granosBloque, "fobAceite", numerosDeFila(cells), totalColsEsperadas);
    } else if (head.startsWith("FOB PELLETS")) {
      asignarFilaGrano(porGrano, granosBloque, "fobPellets", numerosDeFila(cells), totalColsEsperadas);
    } else if (head.startsWith("FAS Teórico")) {
      asignarFilaGrano(porGrano, granosBloque, "fas", numerosDeFila(cells), totalColsEsperadas);
    }
  }
  return { porGrano, fecha };
}
