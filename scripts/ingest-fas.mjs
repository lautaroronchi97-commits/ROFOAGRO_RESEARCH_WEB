#!/usr/bin/env node
/**
 * Ingesta diaria de `fas_historico` (C32/F1, docs/PLAN_CALOR_MERCADERIA.md §3.3 y §5 prompt F1
 * punto 3) — guarda UNA fila por (fecha, producto, fuente) para 3 de las 4 fuentes del plan:
 *
 *   'sagyp'         — columna "SAGyP" de la planilla de BCR (bloque "Commodity", grano sin
 *                     procesar) — misma base que `CapGrano.fasSagyp` de `capacidad.ts`, ver el
 *                     docstring de ese campo (C32/F1 punto 1: verificado contra el HTML real que
 *                     es la MISMA columna que hoy expone `fasBcr` para los 4 granos que NO son
 *                     girasol; solo difiere para girasol, cuyo `fasBcr` toma la sección Industria).
 *   'bcr_upriver'   — lo que hoy ya se muestra como "BCR" en `/granos/capacidad` (CapGrano.fasBcr).
 *   'bcr_industria' — FAS Teórico Industria de BCR, SOLO producto='SBS' (soja — decisión 6 del
 *                     plan, "SOJA = VARA INDUSTRIA"). No hay industria de girasol en `fas_historico`
 *                     todavía: el CSV de Agrochat no trae una fila "Girasol industria" separada.
 *
 * 'nuestro' (FAS teórico ROFO AGRO) se guarda para los 5 granos de grano sin procesar
 * (`capacidad-modelo.ts`, no necesita pizarra). **'nuestro' de la industria de soja queda SIN
 * cargar en este cron a propósito**: `calcularFasIndustria` necesita la pizarra de soja
 * (`pizarra.ts`) como base de gastos comerciales, y `pizarra.ts` — a diferencia de
 * `capacidad-bcr-parse.ts`/`fob-oficial-parse.ts` — no está partido en un módulo puro separable
 * del fetch (`import "server-only"` en el mismo archivo que el parseo); duplicar su parseo acá
 * violaría el patrón "nada re-implementado" del resto de las ingestas (auditoría E4). Pendiente
 * para cuando haga falta de verdad: extraer `pizarra-parse.ts` (mismo molde que
 * `capacidad-bcr-parse.ts`) — recién ahí sumar esta fila sin duplicar lógica.
 *
 * Las 3 fuentes en vivo son un COMPLEMENTO de la carga histórica del CSV de Agrochat
 * (`scripts/cargar-fas.mjs`, 2007→hoy) — mantienen la serie fresca día a día sin depender de que
 * Lautaro re-suba el CSV seguido. El propio plan (§3.3) pide cotejar el 'sagyp' diario de BCR
 * contra la serie de Agrochat al arrancar: eso se hace a mano en la sesión de backfill, no acá.
 *
 * ⚠️ Verificado en vivo el 08/08/2026 (dry-run real contra BCR): 'sagyp' (columna SAGyP de BCR)
 * NO es un proxy perfecto del FAS Teórico Oficial que realmente publica SAGyP — para SOJA en
 * particular ya se sabe que difiere (§4.2 del plan: 322,94 en BCR vs 339,98 en el CSV real de
 * Agrochat el 05/08, ~17 USD, la misma brecha que motivó la decisión 6 "SOJA = VARA INDUSTRIA").
 * Para MAI/TRI/SOR/GIR la brecha medida en el plan es chica (−2/−5,5/no medido/producto flojo de
 * papeles). Este cron mantiene 'sagyp' fresco entre re-cargas del CSV real — NO lo reemplaza.
 *
 * Uso:
 *   node scripts/ingest-fas.mjs             # cron diario (post-cierre)
 *   node scripts/ingest-fas.mjs --dry-run   # imprime y no escribe nada
 *
 * Requiere en el entorno (NO en el repo): SUPABASE_URL, SUPABASE_SERVICE_KEY (service_role).
 */

import { parseBcr, parseBcrIndustria } from "../src/lib/capacidad-bcr-parse.ts";
import { cfgSembrada, calcularFasTeorico } from "../src/lib/capacidad-modelo.ts";
import { filaSpot, POSICIONES_FOB } from "../src/lib/fob-oficial-parse.ts";
import { UNDERLYING_A_PRODUCTO_FAS } from "../src/lib/fas-catalogo.ts";

const URL_BCR = "https://www.bcr.com.ar/es/mercados/mercado-de-granos/cotizaciones/cotizaciones-locales-1";
const URL_FOB = "https://www.magyp.gob.ar/sitio/areas/ss_mercados_agropecuarios/ws/ssma/precios_fob.php";
const UA = "Mozilla/5.0 (ROFOAGRO research)";
const GRANOS_ORDEN = ["SOJ", "MAI", "TRI", "SOR", "GIR"];

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DRY = process.argv.includes("--dry-run");

function toDDMMYYYY(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function addDaysISO(iso, delta) {
  const d = new Date(`${iso}T12:00:00-03:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}
function hoyCordobaISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Cordoba" });
}

async function fetchBcrHtml() {
  const res = await fetch(URL_BCR, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`BCR: HTTP ${res.status}`);
  return res.text();
}

/** Mismo camino T-1 que `fob-oficial.ts`: reintenta hacia atrás hasta 7 días si hoy no publicó. */
async function fetchFobOficial() {
  let iso = hoyCordobaISO();
  for (let i = 0; i < 7; i++) {
    const url = `${URL_FOB}?Fecha=${encodeURIComponent(toDDMMYYYY(iso))}`;
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const json = await res.json();
      const posts = Array.isArray(json?.posts) ? json.posts : null;
      if (posts && posts.length > 0) return { posts, fecha: iso };
    }
    iso = addDaysISO(iso, -1);
  }
  return { posts: [], fecha: null };
}

async function upsert(rows) {
  if (rows.length === 0) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/fas_historico?on_conflict=fecha,producto,fuente`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`upsert fas_historico: HTTP ${res.status} ${await res.text()}`);
}

async function main() {
  if (!DRY && (!SUPABASE_URL || !SERVICE_KEY)) {
    console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en el entorno.");
    process.exit(1);
  }

  const [html, fob] = await Promise.all([fetchBcrHtml(), fetchFobOficial()]);
  const { porGrano: bcr, fecha: fechaBcr } = parseBcr(html, GRANOS_ORDEN);
  const { porGrano: bcrIndustria } = parseBcrIndustria(html, GRANOS_ORDEN);

  const fecha = fechaBcr ?? fob.fecha ?? hoyCordobaISO();
  const rows = [];

  for (const u of GRANOS_ORDEN) {
    const producto = UNDERLYING_A_PRODUCTO_FAS[u];
    const filaBcr = bcr[u];

    // 'sagyp' y 'bcr_upriver': hoy leen la MISMA columna SAGyP salvo girasol (ver docstring del
    // módulo) — se guardan igual, dos filas con el mismo número para 4 de los 5 granos. No es un
    // bug: es lo que hay hasta que exista una fuente que distinga de verdad "spot SAGyP" de un
    // "spot Up River" (la sección Up River del bloque solo trae forwards, no un spot propio).
    if (filaBcr?.fas != null) {
      rows.push({ fecha, producto, fuente: "sagyp", fas_usd: filaBcr.fas });
    }
    const fasUpRiver = u === "GIR" ? (bcrIndustria.GIR?.fas ?? null) : (filaBcr?.fas ?? null);
    if (fasUpRiver != null) {
      rows.push({ fecha, producto, fuente: "bcr_upriver", fas_usd: fasUpRiver });
    }

    const fobPost = filaSpot(fob.posts, POSICIONES_FOB[u]);
    const fobOficial = fobPost ? fobPost.precio : null;
    const cfg = cfgSembrada(u, filaBcr);
    const fasNuestro = calcularFasTeorico(fobOficial, cfg);
    if (fasNuestro != null) {
      rows.push({ fecha, producto, fuente: "nuestro", fas_usd: fasNuestro });
    }
  }

  // bcr_industria: solo soja (decisión 6 del plan) — sin pizarra de por medio, `fas` ya viene
  // calculado por BCR en la misma planilla.
  const fasIndustriaSoja = bcrIndustria.SOJ?.fas ?? null;
  if (fasIndustriaSoja != null) {
    rows.push({ fecha, producto: "SBS", fuente: "bcr_industria", fas_usd: fasIndustriaSoja });
  }

  // Guard anti falso-verde (E5 Anexo A): si ninguna fuente respondió nada hoy, no se guarda un
  // día vacío que después es indistinguible de "mercado sin datos" — se corta con error.
  if (rows.length === 0) {
    console.error("ERROR: 0 filas armadas (BCR y/o FOB oficial no respondieron). No se da por bueno.");
    process.exit(1);
  }

  console.log(`fecha=${fecha} filas=${rows.length}`);
  if (DRY) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  await upsert(rows);
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
