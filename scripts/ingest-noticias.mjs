#!/usr/bin/env node
/**
 * Ingesta del portal de noticias: medios del agro → Supabase (tabla public.noticias).
 *
 * Corre cada hora por GitHub Actions (.github/workflows/ingest-noticias.yml).
 * Recorre TODAS las fuentes (RSS + scrapes), clasifica cada titular con las
 * reglas propias de `src/lib/noticias-reglas.json` (categorización ROFO AGRO,
 * no la de BCR) y upserta por link. Guarda SOLO titular+fuente+link (link-out,
 * nunca el cuerpo de la nota).
 *
 * Uso:
 *   node scripts/ingest-noticias.mjs             (ingesta + upsert)
 *   node scripts/ingest-noticias.mjs --dry-run   (muestra el resultado, no escribe;
 *                                                 no necesita env de Supabase)
 *
 * Requiere en el entorno (NO en el repo), salvo --dry-run:
 *   SUPABASE_URL           = https://<proyecto>.supabase.co
 *   SUPABASE_SERVICE_KEY   = service_role key (escritura; solo en el cron)
 *
 * Fuentes descartadas del directorio docs/FUENTES.md (verificado 09/07/2026):
 *   Reuters (bloquea bots, HTTP 401) · Barchart (titulares por JS/XHR) ·
 *   AgWeb (403) · DTN (sin feed) · Canal Rural (sitio caído) ·
 *   Notícias Agrícolas (sin RSS; Brasil queda cubierto por G1) ·
 *   Bloomberg / Márgenes Agropecuarios (paywall) ·
 *   Valor Soja (su feed redirige a Bichos de Campo: se fusionaron).
 */

import { clasificar, esRuido, esExcluido, esRelevante, claveTitulo } from "../src/lib/noticias-clasificar.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const UA = "Mozilla/5.0 (compatible; ROFOAGROresearch/1.0; noticias)";
const MAX_POR_FUENTE = 25;
const MAX_EDAD_DIAS = 14; // ignora ítems viejos que algunos feeds arrastran
const BCR_URL =
  "https://www.bcr.com.ar/es/mercados/investigacion-y-desarrollo/resumen-de-noticias/resumen-de-diarios";

// Google News RSS: devuelve titular + <source> (el medio real) + link a la nota. Se usa para fuentes
// sin feed propio usable (bolsas AR tras Cloudflare / sin RSS, Reuters/Bloomberg que bloquean bots,
// informes USDA/CONAB, instituciones CIARA/CREA/Aapresid/Coninagro). Es link-out: sólo titular + link.
const GN_ES = "https://news.google.com/rss/search?hl=es-419&gl=AR&ceid=AR:es-419&q=";
const GN_EN = "https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q=";
const gnES = (q) => GN_ES + encodeURIComponent(q);
const gnEN = (q) => GN_EN + encodeURIComponent(q);

/**
 * `def` = categoría si ninguna palabra matchea (solo para fuentes ESPECIALIZADAS confiables).
 * `estricto: true` = fuente generalista/institucional: si NINGUNA palabra matchea (o está excluida por
 * ganadería/regional o es ruido) → se DESCARTA, no cae en el default. Filtro de relevancia (Lautaro).
 */
const FUENTES = [
  { id: "bcr", nombre: "BCR · Diarios", tipo: "bcr", url: BCR_URL, def: "mercados" },
  { id: "infocampo", nombre: "InfoCampo", tipo: "rss", url: "https://www.infocampo.com.ar/feed/", def: "mercados" },
  { id: "bichos", nombre: "Bichos de Campo", tipo: "rss", url: "https://bichosdecampo.com/feed/", def: "mercados" },
  { id: "ambito", nombre: "Ámbito", tipo: "rss", url: "https://www.ambito.com/rss/economia.xml", def: "economia", estricto: true },
  { id: "lanacion", nombre: "La Nación Campo", tipo: "rss", url: "https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/economia/campo/?outputType=xml", def: "mercados", estricto: true },
  { id: "clarin", nombre: "Clarín Rural", tipo: "rss", url: "https://www.clarin.com/rss/rural/", def: "mercados", estricto: true },
  { id: "agrositio-granos", nombre: "Agrositio", tipo: "rss", url: "https://www.agrositio.com.ar/rss/rss.php?area=granos", def: "mercados" },
  { id: "agrositio-economia", nombre: "Agrositio", tipo: "rss", url: "https://www.agrositio.com.ar/rss/rss.php?area=economia", def: "economia" },
  { id: "agrositio-clima", nombre: "Agrositio", tipo: "rss", url: "https://www.agrositio.com.ar/rss/rss.php?area=clima", def: "clima" },
  { id: "dataportuaria", nombre: "dataPORTUARIA", tipo: "rss", url: "https://dataportuaria.com.ar/rss", def: "logistica" },
  { id: "todoagro", nombre: "TodoAgro", tipo: "rss", url: "https://www.todoagro.com.ar/feed/", def: "mercados" },
  { id: "cebada", nombre: "Cebada Cervecera", tipo: "rss", url: "https://www.cebadacervecera.com.ar/feed/", def: "mercados" },
  { id: "g1", nombre: "G1 Agronegócios", tipo: "rss", url: "https://g1.globo.com/rss/g1/economia/agronegocios/", def: "internacional", estricto: true },
  { id: "worldgrain", nombre: "World-Grain", tipo: "rss", url: "https://www.world-grain.com/rss/articles", def: "internacional", estricto: true },
  { id: "agrofy", nombre: "Agrofy News", tipo: "agrofy", url: "https://news.agrofy.com.ar/", def: "mercados" },
  // --- Google News (link-out) ---
  // Bolsas argentinas (sus informes: GEA, PAS, estimaciones, pizarra) — no tienen feed propio usable.
  // Estrictas: solo pasan sus notas de mercado/informe (no la vida institucional).
  { id: "gn-rosario", nombre: "Bolsa de Rosario", tipo: "gnews", def: "mercados", estricto: true,
    url: gnES('"Bolsa de Comercio de Rosario" (soja OR maíz OR trigo OR granos OR cosecha OR GEA OR estimación OR pizarra OR mercado OR exportación)') },
  { id: "gn-bcba", nombre: "Bolsa de Cereales (BsAs)", tipo: "gnews", def: "mercados", estricto: true,
    url: gnES('"Bolsa de Cereales de Buenos Aires" OR "Panorama Agrícola Semanal"') },
  { id: "gn-cordoba", nombre: "Bolsa de Cereales de Córdoba", tipo: "gnews", def: "mercados", estricto: true,
    url: gnES('"Bolsa de Cereales de Córdoba"') },
  // Internacional (surtido de Reuters/Bloomberg/AgWeb/Pro Farmer/CME) + informes oficiales.
  { id: "gn-intl", nombre: "Internacional", tipo: "gnews", def: "internacional",
    url: gnEN('(soybean OR corn OR wheat OR grains) (market OR export OR harvest OR prices OR crop)') },
  { id: "gn-informes", nombre: "Informes USDA/CONAB", tipo: "gnews", def: "informes",
    url: gnEN('WASDE OR "USDA crop" OR "CONAB safra" OR "CFTC commitments" OR "export sales" grain') },
  // Mercado local (hueco de mesa: A3/Matba tenía 0 titulares).
  { id: "gn-matba", nombre: "Matba/A3", tipo: "gnews", def: "mercados",
    url: gnES('"Matba Rofex" OR "A3 Mercados" OR "mercado a término" (soja OR maíz OR trigo OR posiciones)') },
  // Instituciones de la cadena (sin feed propio) — estrictas: solo lo que toca mercado/informe.
  { id: "gn-ciara", nombre: "CIARA-CEC", tipo: "gnews", def: "economia", estricto: true,
    url: gnES('CIARA OR "liquidación de divisas" agroexportación') },
  { id: "gn-crea", nombre: "Grupo CREA", tipo: "gnews", def: "mercados", estricto: true,
    url: gnES('"grupo CREA" OR "movimiento CREA" OR AACREA') },
  { id: "gn-aapresid", nombre: "Aapresid", tipo: "gnews", def: "mercados", estricto: true, url: gnES('Aapresid') },
  { id: "gn-coninagro", nombre: "Coninagro", tipo: "gnews", def: "economia", estricto: true, url: gnES('Coninagro') },
];

/* ---------------- parsers (espejo de la lectura en vivo de src/lib/noticias.ts) ---------------- */

function decode(s) {
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

function pick(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decode(m[1] ?? "") : "";
}

function fechaISO(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseRss(xml, fuente) {
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  const items = [];
  for (const b of blocks) {
    if (items.length >= MAX_POR_FUENTE) break;
    const titulo = pick(b, "title");
    const link = pick(b, "link");
    if (titulo && link) items.push({ titulo, fuente, link, fecha_pub: fechaISO(pick(b, "pubDate")) });
  }
  return items;
}

/** BCR "Resumen de diarios": titulares con link al medio original. Se toman TODOS
 *  los titulares planos (las categorías de la página se IGNORAN: clasificamos nosotros).
 *  La fuente mostrada es el medio original (segundo anchor al mismo href), no BCR. */
const BCR_EXCLUIR = /(bcr\.com\.ar|facebook|twitter|x\.com|linkedin|instagram|youtube|whatsapp|google|vercel)/i;

function dominio(url) {
  const m = url.match(/^https?:\/\/(?:www\.)?([^/]+)/i);
  return m ? m[1] : url;
}

function parseBcr(html) {
  const anchors = [...html.matchAll(/<a href="(https?:\/\/[^"]+)"[^>]*>\s*<strong>([\s\S]*?)<\/strong>\s*<\/a>/gi)]
    .map((m) => ({ href: m[1] ?? "", text: decode(m[2] ?? "") }))
    .filter((a) => a.href && !BCR_EXCLUIR.test(a.href) && a.text);
  const items = [];
  const seen = new Set();
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
      // Solo el nombre del medio: el puente (BCR) nunca se muestra (relevamiento 29/07, punto 15).
      items.push({ titulo: t.text, fuente, link: t.href, fecha_pub: null });
    }
  }
  return items;
}

/** Agrofy News no publica RSS: se toman los anchors /noticia/ de la portada
 *  (título en el <hN class="title"> interno). Verificado contra el HTML real. */
function parseAgrofy(html, base) {
  const items = [];
  const seen = new Set();
  for (const m of html.matchAll(/<a[^>]*href="(\/noticia\/\d+\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (items.length >= MAX_POR_FUENTE) break;
    const link = new URL(m[1], base).toString();
    if (seen.has(link)) continue;
    seen.add(link);
    const th = (m[2] ?? "").match(/<h\d[^>]*class="title"[^>]*>([\s\S]*?)<\/h\d>/);
    const titulo = decode(th ? (th[1] ?? "") : "");
    if (titulo.length > 25) items.push({ titulo, fuente: "Agrofy News", link, fecha_pub: null });
  }
  return items;
}

/** Google News RSS: título "Titular - Medio", <source> con el medio real, link = redirect de Google. */
function parseGnews(xml) {
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  const items = [];
  for (const b of blocks) {
    if (items.length >= MAX_POR_FUENTE) break;
    const link = pick(b, "link");
    let titulo = pick(b, "title");
    const src = pick(b, "source"); // el medio real (ej. "Reuters", "bcr.com.ar")
    if (src && titulo.endsWith(` - ${src}`)) titulo = titulo.slice(0, -(src.length + 3)).trim();
    if (titulo.length > 25 && link) items.push({ titulo, fuente: src || "Google News", link, fecha_pub: fechaISO(pick(b, "pubDate")) });
  }
  return items;
}

/* ---------------- fetch + upsert ---------------- */

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "*/*" },
    signal: AbortSignal.timeout(20000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function leerFuente(f) {
  const text = await fetchText(f.url);
  let items;
  if (f.tipo === "rss") items = parseRss(text, f.nombre);
  else if (f.tipo === "bcr") items = parseBcr(text);
  else if (f.tipo === "gnews") items = parseGnews(text);
  else items = parseAgrofy(text, f.url);

  const limite = Date.now() - MAX_EDAD_DIAS * 86400000;
  return items
    .filter((it) => !esRuido(it.titulo)) // descarta páginas de servicio/widget/interés-humano
    .filter((it) => !esExcluido(it.titulo)) // ganadería/regionales fuera (salvo que hable de granos)
    .filter((it) => !f.estricto || esRelevante(it.titulo)) // fuentes generalistas: exigen señal temática
    .filter((it) => !it.fecha_pub || new Date(it.fecha_pub).getTime() >= limite)
    .map((it) => ({
      link: it.link.slice(0, 600),
      titulo: it.titulo.slice(0, 300),
      fuente: it.fuente,
      categoria: clasificar(it.titulo, f.def),
      fecha_pub: it.fecha_pub,
      visto_en: new Date().toISOString(),
    }));
}

async function upsert(rows) {
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/noticias`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        authorization: `Bearer ${SERVICE_KEY}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal", // upsert por PK (link)
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`upsert lote ${i}: HTTP ${res.status} ${await res.text()}`);
  }
}

async function main() {
  if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_KEY)) {
    console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en el entorno (o usar --dry-run).");
    process.exit(1);
  }

  const resultados = await Promise.allSettled(FUENTES.map((f) => leerFuente(f)));
  const all = [];
  let ok = 0;
  resultados.forEach((r, i) => {
    const f = FUENTES[i];
    if (r.status === "fulfilled") {
      ok++;
      console.log(`  ✓ ${f.id}: ${r.value.length} titulares`);
      all.push(...r.value);
    } else {
      console.log(`  ✗ ${f.id}: ${r.reason?.message ?? r.reason}`);
    }
  });

  // dedup por link entre fuentes (BCR suele linkear notas que también vienen por RSS). Ante colisión
  // gana el registro MÁS RICO: el que trae fecha_pub (y así el nombre de medio canónico del RSS),
  // para que la fecha/orden sea estable corrida a corrida, sin depender de qué fuente respondió esa hora.
  const byLink = new Map();
  for (const r of all) {
    const prev = byLink.get(r.link);
    if (!prev || (!prev.fecha_pub && r.fecha_pub)) byLink.set(r.link, r);
  }
  // dedup por TÍTULO: la misma nota llega directo (link del medio) y vía Google News (link redirect).
  // Gana el registro directo (no Google) y con fecha. score: directo=2 · fecha=+1 → directo+fecha=3 gana.
  const esGoogle = (l) => /news\.google\./i.test(l);
  const score = (r) => (esGoogle(r.link) ? 0 : 2) + (r.fecha_pub ? 1 : 0);
  const byTitulo = new Map();
  for (const r of byLink.values()) {
    const k = claveTitulo(r.titulo);
    const prev = byTitulo.get(k);
    if (!prev || score(r) > score(prev)) byTitulo.set(k, r);
  }
  const rows = [...byTitulo.values()];

  const porCat = {};
  for (const r of rows) porCat[r.categoria] = (porCat[r.categoria] ?? 0) + 1;
  console.log(`Fuentes OK: ${ok}/${FUENTES.length} · titulares únicos: ${rows.length}`);
  console.log(`Por categoría: ${JSON.stringify(porCat)}`);

  if (ok === 0) {
    console.error("Todas las fuentes fallaron.");
    process.exit(1);
  }
  // E5 #6 (camino 11): antes con 1 fuente viva de 26 el run seguía verde — erosión invisible.
  // Menos del 60% de fuentes OK = falla masiva (red, bloqueo, cambio estructural), no flakiness.
  if (ok < FUENTES.length * 0.6) {
    console.error(`ERROR: solo ${ok}/${FUENTES.length} fuentes OK (<60%). No se da por bueno.`);
    process.exit(1);
  }

  if (DRY_RUN) {
    for (const r of rows.slice(0, 40)) console.log(`  [${r.categoria}] ${r.titulo} — ${r.fuente}`);
    console.log("(dry-run: no se escribió nada)");
    return;
  }

  // Guard anti "falso verde": fuentes OK pero 0 titulares únicos = parsers rotos o filtro demasiado
  // agresivo. No pasar en verde sin insertar nada.
  if (rows.length === 0) {
    console.error("ERROR: 0 titulares únicos pese a fuentes OK (parsers rotos o filtro demasiado agresivo).");
    process.exit(1);
  }

  await upsert(rows);
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
