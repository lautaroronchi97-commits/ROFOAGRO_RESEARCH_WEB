import "server-only";
import { cache } from "react";
import { arNum, leerOverrideEnv } from "./env-utils";
import { esHabil, hoyCordoba, parseYmd } from "./habiles";
import type { Meta } from "./market";

/**
 * Pizarra (disponible) de granos en USD, desde CAC-BCR (Cámara Arbitral de
 * Cereales de la BCR). Es el precio de referencia del disponible que se usa
 * como "spot" en los arbitrajes vs los futuros de A3.
 *
 * Fuente: https://www.cac.bcr.com.ar/es/precios-de-pizarra — HTML estático,
 * un bloque `<div class="board board-{grano}">` por grano con `.price` (ARS) y
 * el valor en `US$`. Parser verificado contra el HTML real.
 *
 * Override manual (metodología del proyecto): si `PIZARRA_OVERRIDE` está seteado
 * (JSON `{"SOJ":325.5,"MAI":182,"TRI":197}`), ese valor USD pisa al de CAC. Sirve
 * para cuando Lautaro quiere fijar la referencia o si CAC se cae.
 */

const URL_CAC = "https://www.cac.bcr.com.ar/es/precios-de-pizarra";
const SOURCE = "Bolsa de Comercio de Rosario";
const CLASES: Record<string, string> = {
  SOJ: "soja",
  MAI: "maiz",
  TRI: "trigo",
  GIR: "girasol",
  SOR: "sorgo",
};
// Los 3 que consumen arbitrajes/capacidad/cinta (tienen futuro A3) — girasol y sorgo son
// solo para la calculadora "Negocios de planta" (B3, auditoría E7) y no deben degradar el
// resto de la web si faltan (son menos líquidos, CAC los muestra "S/C" seguido).
export const GRANOS_REQUERIDOS = ["SOJ", "MAI", "TRI"] as const;

export type PizarraGrano = { underlying: string; usd: number; ars: number | null; estimativo: boolean };
export type PizarraData = {
  granos: Record<string, PizarraGrano>;
  fecha: string | null;
  tcBna: number | null;
  meta: Meta;
};

/**
 * Recorta el HTML al bloque de UN board (`<div class="board board-{cls} ...">` hasta el
 * próximo board o el pie de la tabla) — así el parser de cada grano nunca puede "leer" el
 * precio del board siguiente si el suyo no matchea (bug latente antes de sumar girasol/sorgo,
 * que sí pueden no tener precio numérico algunos días).
 */
function extraerBloque(html: string, cls: string): { claseExtra: string; bloque: string } | null {
  const re = new RegExp(`<div class="board board-${cls}\\b([^"]*)"`);
  const m = re.exec(html);
  if (!m) return null;
  const start = m.index + m[0].length;
  const restante = html.slice(start);
  const finRel = restante.search(/<div class="board board-|<div class="price-board-footer">/);
  return { claseExtra: m[1] ?? "", bloque: finRel === -1 ? restante : restante.slice(0, finRel) };
}

function parseGrano(html: string, cls: string): { usd: number; ars: number; estimativo: boolean } | null {
  const ext = extraerBloque(html, cls);
  if (!ext) return null;
  const { claseExtra, bloque } = ext;
  // CAC marca la pizarra estimativa (días sin fijación, Dto. 1058/99) con la
  // clase `estimative` en el div del board: `<div class="board board-soja estimative">`.
  const claseEstimativa = /\bestimative\b/.test(claseExtra);

  // Formato normal (soja/maíz/trigo/sorgo la mayoría de los días): $ARS directo + US$ directo.
  let m = bloque.match(/<div class="price">\s*\$([\d.]+,\d{2})[\s\S]*?<strong>US\$<\/strong>\s*([\d.]+,\d{2})/);
  if (m) {
    const ars = arNum(m[1]!); // grupos obligatorios del regex
    const usd = arNum(m[2]!);
    if (ars == null || usd == null) return null;
    return { estimativo: claseEstimativa, ars, usd };
  }

  // Formato "sin cotización" (frecuente en girasol, producto menos líquido): CAC muestra
  // "S/C" y un valor de referencia marcado "(E)" tanto en $ como en US$.
  m = bloque.match(/S\/C[\s\S]*?\(E\)[\s\S]*?\$([\d.]+,\d{2})[\s\S]*?<strong>US\$<\/strong>[\s\S]*?\(E\)[\s\S]*?([\d.]+,\d{2})/);
  if (m) {
    const ars = arNum(m[1]!); // grupos obligatorios del regex
    const usd = arNum(m[2]!);
    if (ars == null || usd == null) return null;
    return { estimativo: true, ars, usd };
  }
  return null;
}

export const getPizarra = cache(async (): Promise<PizarraData> => {
  const ov = leerOverrideEnv("PIZARRA_OVERRIDE");
  let html = "";
  let caida = false;
  try {
    const res = await fetch(URL_CAC, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": "Mozilla/5.0 (ROFOAGRO research)" },
    });
    if (res.ok) html = await res.text();
    else caida = true;
  } catch {
    caida = true;
  }

  const granos: Record<string, PizarraGrano> = {};
  for (const [u, cls] of Object.entries(CLASES)) {
    const p = html ? parseGrano(html, cls) : null;
    const usdOverride = ov[u];
    if (usdOverride != null && Number.isFinite(usdOverride)) {
      // El override manual fija la referencia → deja de ser estimativa.
      granos[u] = { underlying: u, usd: usdOverride, ars: p?.ars ?? null, estimativo: false };
    } else if (p) {
      granos[u] = { underlying: u, usd: p.usd, ars: p.ars, estimativo: p.estimativo };
    }
  }

  const fechaM = html.match(/Comprador\s+(\d{2})\/(\d{2})\/(\d{4})/);
  const fecha = fechaM ? `${fechaM[3]}-${fechaM[2]}-${fechaM[1]}` : null;
  const tcM = html.match(/Comprador\s+\d{2}\/\d{2}\/\d{4}:\s*<strong>\$\s*([\d.]+,\d{2})/);
  const tcBna = tcM ? arNum(tcM[1]!) : null; // grupo obligatorio del regex

  const n = Object.keys(granos).length;
  const requeridosOk = GRANOS_REQUERIDOS.every((u) => granos[u] != null);
  const updatedAtRaw = fecha ? Date.parse(`${fecha}T00:00:00-03:00`) : null;
  const updatedAt = updatedAtRaw !== null && !Number.isNaN(updatedAtRaw) ? updatedAtRaw : null;

  const problemas: string[] = [];
  if (caida) problemas.push("CAC no respondió");
  else if (!requeridosOk) problemas.push("CAC: faltan granos en la pizarra");
  // CAC suele tardar en publicar la pizarra del día (a veces recién a la tarde) — sin esto
  // el panel de Arbitrajes mostraba "Actualizado" con la hora de AHORA (heredada del feed en
  // vivo de A3) mientras el disponible seguía siendo el de ayer, sin ninguna señal visible.
  const hoy = hoyCordoba();
  if (!caida && fecha != null && fecha !== hoy && esHabil(parseYmd(hoy))) {
    problemas.push(`Pizarra CAC del ${fecha.slice(8, 10)}/${fecha.slice(5, 7)} — todavía no publicó la de hoy`);
  }

  return {
    granos,
    fecha,
    tcBna,
    meta: {
      source: SOURCE,
      updatedAt,
      status: requeridosOk && !caida ? "real" : n > 0 ? "parcial" : "parcial",
      problemas,
    },
  };
});
