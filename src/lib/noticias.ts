import "server-only";
import { cache } from "react";
import type { Meta } from "./market";
import { sbSelect } from "./supabase";
import {
  CATEGORIA_FALLBACK,
  ORDEN_PANEL,
  claveTitulo,
  clasificar,
  clasificarStrict,
  esRelevante,
  fuenteTier,
  nombreCategoria,
} from "./noticias-clasificar";
import { hoyCordobaISO } from "./dates";

/**
 * Portal de noticias del agro. Fuente primaria: tabla `noticias` de Supabase,
 * que llena el cron HORARIO de GitHub Actions (scripts/ingest-noticias.mjs)
 * recorriendo ~15 fuentes de docs/FUENTES.md (RSS + scrapes) y clasificando
 * cada titular con las reglas PROPIAS de noticias-reglas.json (no las de BCR).
 *
 * Si la tabla no responde o está vacía (p. ej. antes de la primera corrida del
 * cron), degrada a una lectura EN VIVO reducida (resumen BCR + 3 RSS) con el
 * mismo clasificador, marcada como PARCIAL. Siempre link-out: titular + fuente
 * + link, nunca el cuerpo de la nota.
 */

const REVALIDATE = 600; // 10 min (el cron corre cada hora)
const DIAS_HABILES = 3; // ventana visible: últimos N días hábiles (no se muestra nada más viejo)
const MAX_POR_CATEGORIA = 10;
const N_DESTACADOS = 8; // "Lo importante hoy" (briefing)
const MAX_DESTACADOS_POR_CAT = 3; // diversidad en el briefing

/**
 * Epoch ms del inicio (00:00 Córdoba) del día hábil más viejo de la ventana de los
 * últimos `dias` hábiles (hoy cuenta si es hábil). Ej.: un lunes, la ventana arranca
 * el jueves anterior, así el panel no muestra sólo las noticias del lunes. Fin de
 * semana en el medio incluido (hay poca noticia, pero si la hay entra). Sin feriados.
 */
function corteHabilesMs(dias: number): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // Ancla al mediodía de hoy en Córdoba (UTC-3 fijo, sin DST) → restar 1 día = mismo mediodía del día previo.
  let ancla = Date.parse(`${hoyCordobaISO()}T12:00:00-03:00`);
  let habiles = 0;
  let corteISO = hoyCordobaISO();
  while (habiles < dias) {
    const dow = new Date(ancla).getUTCDay(); // mediodía Córdoba = 15:00 UTC → mismo día calendario
    if (dow !== 0 && dow !== 6) {
      habiles++;
      corteISO = fmt.format(new Date(ancla));
    }
    if (habiles < dias) ancla -= 86_400_000;
  }
  return Date.parse(`${corteISO}T00:00:00-03:00`);
}

export type NoticiaItem = {
  titulo: string;
  fuente: string;
  link: string;
  fechaMs: number | null;
  nMedios: number; // cuántos medios cubrieron el mismo evento (1 = único)
  sinFecha: boolean; // el feed no trajo fecha → rankea debajo de los fechados del día
};
export type NoticiaCategoria = { id: string; nombre: string; items: NoticiaItem[] };
export type NoticiasData = {
  destacados: NoticiaItem[]; // "Lo importante hoy" (briefing transversal, priorizado)
  categorias: NoticiaCategoria[];
  total: number;
  generadoMs: number; // "ahora" para las horas relativas del panel (Date.now() vive acá, no en el render)
  meta: Meta;
};

/* ---------------- armado: dedup por evento + ranking por relevancia ---------------- */

type ItemCat = { titulo: string; fuente: string; link: string; fechaMs: number | null; categoria: string };
type Rep = ItemCat & { nMedios: number; tier: number };

const STOP = new Set([
  "para", "por", "con", "los", "las", "del", "una", "unos", "unas", "que", "como", "más", "mas", "este",
  "esta", "estos", "estas", "tras", "hoy", "sobre", "entre", "desde", "hasta", "según", "segun", "the",
  "and", "for", "with", "from", "que", "año", "años", "millones", "mil",
]);

function tokensDe(titulo: string): Set<string> {
  return new Set(claveTitulo(titulo).split(" ").filter((w) => w.length > 3 && !STOP.has(w)));
}

/** Cifras distintivas (≥2 dígitos, sin separadores): 50,1 · 300.000 · 17.500. Descartan % y años sueltos. */
function cifrasDe(titulo: string): Set<string> {
  return new Set((titulo.match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/[.,]/g, "")).filter((n) => n.length >= 3));
}

/**
 * Agrupa notas del MISMO evento (dedup semántica). Greedy contra la SEMILLA de cada cluster (no
 * acumula, para no derivar): se unen si comparten ≥4 tokens de contenido con jaccard ≥0.5, o una
 * cifra distintiva + ≥4 tokens. Conservador: ante la duda, no colapsa (mejor mostrar de más).
 */
function clusterizar(items: ItemCat[]): ItemCat[][] {
  const clusters: { items: ItemCat[]; toks: Set<string>; cifras: Set<string> }[] = [];
  for (const it of items) {
    const tk = tokensDe(it.titulo);
    const cf = cifrasDe(it.titulo);
    let dest: (typeof clusters)[number] | null = null;
    for (const c of clusters) {
      const common = [...tk].filter((x) => c.toks.has(x)).length;
      const jac = common / (tk.size + c.toks.size - common || 1);
      const sharedNum = [...cf].some((x) => c.cifras.has(x));
      if ((common >= 4 && jac >= 0.5) || (sharedNum && common >= 3)) {
        dest = c;
        break;
      }
    }
    if (dest) dest.items.push(it);
    else clusters.push({ items: [it], toks: tk, cifras: cf });
  }
  return clusters.map((c) => c.items);
}

/** Relevancia = recencia + cobertura (nº de medios) + tier de fuente + peso de categoría. */
function scoreRep(r: Rep, ahoraMs: number, corteMs: number): number {
  const span = Math.max(1, ahoraMs - corteMs);
  const rec = r.fechaMs ? Math.min(1, Math.max(0, (r.fechaMs - corteMs) / span)) : 0.15; // s/f rankea abajo
  const cob = Math.min(r.nMedios, 8) / 8;
  const tierW = r.tier === 0 ? 1 : r.tier === 1 ? 0.6 : 0.3;
  const catW: Record<string, number> =
    { informes: 1, mercados: 1, economia: 0.95, internacional: 0.9, clima: 0.7, logistica: 0.6, empresas: 0.5 };
  return 0.32 * rec + 0.3 * cob + 0.2 * tierW + 0.18 * (catW[r.categoria] ?? 0.7);
}

function toItem(r: Rep): NoticiaItem {
  return { titulo: r.titulo, fuente: r.fuente, link: r.link, fechaMs: r.fechaMs, nMedios: r.nMedios, sinFecha: r.fechaMs == null };
}

function armar(items: ItemCat[], corteMs: number): { destacados: NoticiaItem[]; categorias: NoticiaCategoria[] } {
  const ahoraMs = Date.now();
  // Filtro de display (defensa por si quedan filas viejas sin gate) + dedup exacta por link.
  const vistos = new Set<string>();
  const limpios: ItemCat[] = [];
  for (const it of items) {
    // Gate estricto de display (Lautaro): solo notas con señal temática, sin ruido ni excluidas
    // (ganadería/regionales). Vale para todas las fuentes, incluso la data vieja sin gate de ingesta.
    if (!esRelevante(it.titulo)) continue;
    if (vistos.has(it.link)) continue;
    vistos.add(it.link);
    // Re-clasifica con las reglas ACTUALES (taxonomía nueva aplica al instante, sin backfill).
    limpios.push({ ...it, categoria: clasificarStrict(it.titulo) ?? it.categoria });
  }
  // Cluster por evento → 1 representante (mejor tier, más fresco) + nMedios; fecha = la más nueva del grupo.
  const reps: Rep[] = clusterizar(limpios).map((grupo) => {
    grupo.sort((a, b) => fuenteTier(a.fuente) - fuenteTier(b.fuente) || (b.fechaMs ?? 0) - (a.fechaMs ?? 0));
    const rep = grupo[0]!;
    const fechaMs = grupo.reduce((mx, x) => Math.max(mx, x.fechaMs ?? 0), 0) || null;
    return { ...rep, fechaMs, nMedios: grupo.length, tier: fuenteTier(rep.fuente) };
  });
  reps.sort((a, b) => scoreRep(b, ahoraMs, corteMs) - scoreRep(a, ahoraMs, corteMs));

  // Briefing "Lo importante hoy": top N por score, con tope por categoría para diversidad.
  const destacados: NoticiaItem[] = [];
  const briefPorCat = new Map<string, number>();
  for (const r of reps) {
    if (destacados.length >= N_DESTACADOS) break;
    // Solo notas relevantes de verdad: matchean un keyword temático o las cubrieron ≥2 medios.
    if (clasificarStrict(r.titulo) === null && r.nMedios < 2) continue;
    const n = briefPorCat.get(r.categoria) ?? 0;
    if (n >= MAX_DESTACADOS_POR_CAT) continue;
    briefPorCat.set(r.categoria, n + 1);
    destacados.push(toItem(r));
  }

  // Chips por categoría, ya en orden de score (reps viene ordenado), tope por categoría.
  const porCat = new Map<string, Rep[]>();
  for (const r of reps) {
    const id = ORDEN_PANEL.includes(r.categoria) ? r.categoria : CATEGORIA_FALLBACK;
    if (!porCat.has(id)) porCat.set(id, []);
    porCat.get(id)!.push(r);
  }
  const categorias = ORDEN_PANEL.filter((id) => porCat.has(id)).map((id) => ({
    id,
    nombre: nombreCategoria(id),
    items: (porCat.get(id) ?? []).slice(0, MAX_POR_CATEGORIA).map(toItem),
  }));
  return { destacados, categorias };
}

/* ---------------- fuente primaria: Supabase (cron horario) ---------------- */

type RawRow = {
  titulo?: string;
  fuente?: string;
  link?: string;
  categoria?: string;
  fecha_pub?: string | null;
  visto_en?: string | null;
  creado_en?: string | null;
};

function ms(s?: string | null): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function desdeSupabase(rows: RawRow[], horasVentana?: number): NoticiasData | null {
  const items: ItemCat[] = [];
  let ultimoVisto = 0;
  for (const r of rows) {
    if (!r.titulo || !r.fuente || !r.link || !r.categoria) continue;
    ultimoVisto = Math.max(ultimoVisto, ms(r.visto_en) ?? 0);
    items.push({
      titulo: r.titulo,
      fuente: r.fuente,
      link: r.link,
      categoria: r.categoria,
      fechaMs: ms(r.fecha_pub) ?? ms(r.creado_en),
    });
  }
  if (items.length === 0) return null;

  // Sólo los últimos N días hábiles (fecha del medio, o creado_en si el feed no la trae) — o, si
  // el caller pidió una ventana en horas (informe diario v3, "últimas 24 hs"), esa en su lugar.
  const corte = horasVentana != null ? Date.now() - horasVentana * 3_600_000 : corteHabilesMs(DIAS_HABILES);
  const usar = items.filter((i) => (i.fechaMs ?? 0) >= corte);

  const { destacados, categorias } = armar(usar, corte);
  return {
    destacados,
    categorias,
    total: categorias.reduce((n, c) => n + c.items.length, 0),
    generadoMs: Date.now(),
    meta: {
      source: "Portal ROFO AGRO",
      updatedAt: ultimoVisto || Date.now(),
      status: "real",
      problemas: [],
    },
  };
}

/* ---------------- fallback: lectura en vivo reducida (BCR + RSS) ---------------- */

const BCR_URL =
  "https://www.bcr.com.ar/es/mercados/investigacion-y-desarrollo/resumen-de-noticias/resumen-de-diarios";
const FEEDS_VIVO = [
  { url: "https://www.infocampo.com.ar/feed/", fuente: "InfoCampo", def: "mercados" },
  { url: "https://bichosdecampo.com/feed/", fuente: "Bichos de Campo", def: "mercados" },
  { url: "https://www.ambito.com/rss/economia.xml", fuente: "Ámbito", def: "economia" },
];
const EXCLUIR = /(bcr\.com\.ar|facebook|twitter|x\.com|linkedin|instagram|youtube|whatsapp|google|vercel)/i;

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dominio(url: string): string {
  const m = url.match(/^https?:\/\/(?:www\.)?([^/]+)/i);
  return m ? (m[1] ?? url) : url; // grupo obligatorio del regex; `?? url` solo satisface el tipo
}

/** Titulares planos del "Resumen de diarios" de BCR (fuente = medio original). */
function parseBcr(html: string): ItemCat[] {
  const anchors = [...html.matchAll(/<a href="(https?:\/\/[^"]+)"[^>]*>\s*<strong>([\s\S]*?)<\/strong>\s*<\/a>/gi)]
    .map((m) => ({ href: m[1] ?? "", text: decode(m[2] ?? "") }))
    .filter((a) => a.href && !EXCLUIR.test(a.href) && a.text);
  const items: ItemCat[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < anchors.length; ) {
    const t = anchors[i];
    if (!t) break;
    let fuente = dominio(t.href);
    const sig = anchors[i + 1];
    if (sig && sig.href === t.href) {
      fuente = sig.text;
      i += 2;
    } else {
      i += 1;
    }
    if (t.text.length > 25 && !seen.has(t.href)) {
      seen.add(t.href);
      items.push({
        titulo: t.text,
        // Solo el nombre del medio: el puente (BCR) nunca se muestra (relevamiento 29/07, punto 15).
        fuente,
        link: t.href,
        fechaMs: null,
        categoria: clasificar(t.text, "mercados"),
      });
    }
  }
  return items;
}

function pick(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decode(m[1] ?? "") : "";
}

function parseRss(xml: string, fuente: string, def: string, max = 10): ItemCat[] {
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  const items: ItemCat[] = [];
  for (const b of blocks) {
    if (items.length >= max) break;
    const titulo = pick(b, "title");
    const link = pick(b, "link");
    if (!titulo || !link) continue;
    const t = Date.parse(pick(b, "pubDate"));
    items.push({ titulo, fuente, link, fechaMs: Number.isNaN(t) ? null : t, categoria: clasificar(titulo, def) });
  }
  return items;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(9000),
      headers: { "user-agent": "Mozilla/5.0 (ROFOAGRO research)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function enVivo(problema: string, horasVentana?: number): Promise<NoticiasData> {
  const [bcr, ...feeds] = await Promise.all([fetchText(BCR_URL), ...FEEDS_VIVO.map((f) => fetchText(f.url))]);
  // RSS primero, BCR al final: si una nota llega por RSS y por BCR, la dedup de `agrupar` (primero gana)
  // conserva el registro RSS, que trae fecha real y nombre de medio canónico.
  const items: ItemCat[] = [];
  FEEDS_VIVO.forEach((f, i) => {
    const xml = feeds[i];
    if (xml) items.push(...parseRss(xml, f.fuente, f.def));
  });
  if (bcr) items.push(...parseBcr(bcr));

  const problemas = [problema];
  if (!bcr) problemas.push("Resumen BCR no disponible");
  // Misma ventana de días hábiles (o de horas, si el caller la pidió); se conservan los
  // titulares sin fecha (BCR curado del día).
  const corte = horasVentana != null ? Date.now() - horasVentana * 3_600_000 : corteHabilesMs(DIAS_HABILES);
  const { destacados, categorias } = armar(
    items.filter((it) => it.fechaMs == null || it.fechaMs >= corte),
    corte,
  );
  return {
    destacados,
    categorias,
    total: categorias.reduce((n, c) => n + c.items.length, 0),
    generadoMs: Date.now(),
    meta: {
      source: "Portal ROFO AGRO",
      updatedAt: items.length ? Date.now() : null,
      status: "parcial",
      problemas,
    },
  };
}

/* ---------------- API del panel ---------------- */

/**
 * `horasVentana` opcional: por default la ventana es de `DIAS_HABILES` (3) días hábiles — la
 * usan el panel público de Noticias, la home y `/api/views/insumos`. El informe diario v3 (E1,
 * §5.1 bloque G — "Noticias últimas 24 hs, puede ser cero") pasa `24` para acotar a ese día.
 */
export const getNoticias = cache(async (horasVentana?: number): Promise<NoticiasData> => {
  const res = await sbSelect(
    `noticias?select=titulo,fuente,link,categoria,fecha_pub,visto_en,creado_en&order=creado_en.desc&limit=400`,
    REVALIDATE,
  );
  if (res.ok && Array.isArray(res.data)) {
    const data = desdeSupabase(res.data as RawRow[], horasVentana);
    if (data) return data;
    return enVivo("Tabla noticias vacía (¿primera corrida del cron pendiente?) — lectura en vivo", horasVentana);
  }
  return enVivo("Supabase no disponible — lectura en vivo", horasVentana);
});

export type NoticiaCruda = { titulo: string; fuente: string; link: string; categoria: string; fechaMs: number | null };

/**
 * TODAS las noticias de los últimos `dias` días (≤ hastaISO), SIN cap de categoría ni curaduría
 * de "destacados" — el informe semanal y el view v3 (E1 de docs/PLAN_INFORMES_V3.md §6.1/§7.2)
 * las leen completas ("lectura de todas las noticias de la última semana"), no un resumen del
 * resumen que ya recorta `getNoticias()` para el panel público.
 */
export const getNoticiasSemana = cache(async (hastaISO: string, dias = 7): Promise<NoticiaCruda[]> => {
  const desde = new Date(new Date(`${hastaISO}T12:00:00Z`).getTime() - (dias - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const res = await sbSelect(
    `noticias?select=titulo,fuente,link,categoria,fecha_pub,creado_en&creado_en=gte.${desde}&order=creado_en.desc&limit=500`,
    0,
  );
  if (!res.ok || !Array.isArray(res.data)) return [];
  return (res.data as RawRow[])
    .filter((r): r is Required<Pick<RawRow, "titulo" | "fuente" | "link" | "categoria">> & RawRow =>
      Boolean(r.titulo && r.fuente && r.link && r.categoria),
    )
    .map((r) => ({
      titulo: r.titulo,
      fuente: r.fuente,
      link: r.link,
      categoria: r.categoria,
      fechaMs: ms(r.fecha_pub) ?? ms(r.creado_en),
    }));
});
