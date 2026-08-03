// Edge Function: lineup-ingest
// -----------------------------------------------------------------------------
// Descarga el Line Up de ISA Agents y lo upsertea en la tabla `lineup` de
// Supabase. Corre en la región sa-east-1 (São Paulo): esa IP NO está bloqueada
// por ISA, a diferencia de los runners de GitHub Actions (que devuelven la tabla
// vacía → el "falso verde" que congeló el scraper). Es lo ÚNICO que toca ISA.
//
// El cron (GitHub Actions, `ingest-lineup.yml`) simplemente la invoca 2×/día, una fecha por
// request (`?date=`); el guard anti "falso verde" vive en `ingest-lineup.mjs` (el caller sabe
// si la corrida es diaria o backfill — acá cada invocación es "una fecha" sin ese contexto,
// así que esta función se limita a reportar `ok`/`error` por fecha) y la frescura en el
// healthcheck. (L6, Anexo A camino 20: esta función tenía su PROPIO guard "daily" que nunca se
// activaba — `ingest-lineup.mjs` siempre llama con `?date=`, nunca sin parámetros — se retiró
// por capa redundante muerta; el guard real es 100% del caller.)
//
// Puerto fiel de `scraper.py` del proyecto LineUps_Code de Lautaro:
//   warm-up de cookie (PHPSESSID) · validación de headers · parseo de Quantity y
//   de fechas cortas "14-jul" con rollover de año · flag es_agro · dedup por fila.
//
// Rutas:
//   GET ?dry=1                       → solo fetch+parse, devuelve conteos (no escribe)
//   GET ?date=YYYY-MM-DD             → una fecha
//   GET ?from=YYYY-MM-DD&to=...      → backfill de un rango (máx 90 días/llamada)
//   GET (sin params)                 → hoy + 2 días previos (ART) — modo cron diario
// Auth: verify_jwt (el cron pasa una key válida de Supabase).
// -----------------------------------------------------------------------------

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const BASE = "https://www.isa-agents.com.ar/info/line_up_mndrn.php";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
  "Referer": BASE,
};

const EXPECTED_HEADERS = [
  "Port", "Berth", "Vessel", "Ops.", "Cat", "Cargo", "Quantity",
  "Dest/Orig.", "Area", "Shipper", "ETA", "ETB", "ETS", "Remarks",
];
const AGRO = new Set(["GRAINS", "BY PRODUCTS", "VEGOIL"]);
const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

// Destino: la tabla usa la clave lógica (no la PK `id`) para deduplicar. Debe
// coincidir con la UNIQUE CONSTRAINT `lineup_unique_row` (NULLS NOT DISTINCT).
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CONFLICT =
  "fecha_consulta,port,berth,vessel,cargo,quantity,eta,dest_orig,shipper,ops";

// El proyecto tiene en paralelo las keys legacy (JWT) y las nuevas (sb_secret_…);
// el valor reservado SUPABASE_SERVICE_ROLE_KEY puede no ser string-idéntico al
// service_role JWT que manda el caller aunque ambos sean válidos. El gateway
// (verify_jwt=true) ya validó la firma → es seguro decodificar el payload y
// exigir el claim role=service_role, sin depender de esa comparación exacta.
//
// Fix 03/08/2026: la migración a las keys nuevas de Supabase (`sb_publishable_`/
// `sb_secret_`, ver docs/PRELAUNCH_CHECKLIST.md) rompió esto en producción — esas
// keys NO son un JWT de 3 partes (no tienen claim `role`), así que `jwtRole` daba
// `null` y esta función devolvía 403 aunque el caller mandara la key secreta real.
// El secret key nuevo ES el equivalente de service_role (bypassea RLS igual que
// el JWT legacy) → se acepta directo por prefijo, sin necesitar decodificar nada.
function esServiceRole(token: string): boolean {
  if (token.startsWith("sb_secret_")) return true;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const payload = JSON.parse(atob(b64 + pad));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

// --- helpers de parseo (puerto de utils.py) --------------------------------

function cleanText(raw: string | null): string | null {
  if (raw == null) return null;
  const s = raw.replace(/\u00a0/g, " ").trim();
  return s === "" || s === "-" ? null : s;
}
function parseQty(raw: string | null): number | null {
  const t = cleanText(raw);
  if (t == null) return null;
  const d = t.replace(/[,.\s]/g, "");
  return /^\d+$/.test(d) ? parseInt(d, 10) : null;
}
function parseShort(raw: string | null, consultaYear: number): Date | null {
  const t = cleanText(raw);
  if (t == null) return null;
  const m = t.toLowerCase().match(/^(\d{1,2})[-/](\w{3})$/);
  if (!m) return null;
  const mes = MESES[m[2]];
  if (!mes) return null;
  const dia = parseInt(m[1], 10);
  const d = new Date(Date.UTC(consultaYear, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1) return null;
  return d;
}
function rollover(parsed: Date | null, consulta: Date): Date | null {
  if (!parsed) return null;
  const diff = (parsed.getUTCFullYear() - consulta.getUTCFullYear()) * 12 +
    (parsed.getUTCMonth() - consulta.getUTCMonth());
  if (diff > 6) parsed.setUTCFullYear(parsed.getUTCFullYear() - 1);
  else if (diff < -6) parsed.setUTCFullYear(parsed.getUTCFullYear() + 1);
  return parsed;
}
function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}
function esAgro(cat: string | null): boolean {
  return cat != null && AGRO.has(cat.trim().toUpperCase());
}
function todayART(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// --- fetch + parse ---------------------------------------------------------

async function fetchHtml(day: string, month: string, year: string): Promise<string> {
  // Warm-up: sin la cookie PHPSESSID ISA devuelve la tabla vacía (verificado).
  const warm = await fetch(BASE, { headers: BROWSER_HEADERS });
  const cm = (warm.headers.get("set-cookie") ?? "").match(/PHPSESSID=[^;]+/);
  const cookie = cm ? cm[0] : "";
  const url =
    `${BASE}?lang=es&select_day=${day}&select_month=${month}&select_year=${year}&mode=Search`;
  const headers: Record<string, string> = { ...BROWSER_HEADERS };
  if (cookie) headers["Cookie"] = cookie;
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`ISA HTTP ${resp.status}`);
  const buf = await resp.arrayBuffer();
  return new TextDecoder("iso-8859-1").decode(buf); // la página es iso-8859-1
}

type Fila = Record<string, unknown>;

function parseTable(html: string, fechaConsulta: string): {
  ok: boolean; error?: string; got?: string[]; title: string | null; rows: Fila[];
} {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const titleEl = doc?.querySelector("h2.title");
  const title = titleEl ? titleEl.textContent.trim() : null;

  const table = doc?.querySelector("table#line-up-data");
  if (!table) return { ok: false, error: "table_not_found", title, rows: [] };
  const thead = table.querySelector("thead");
  if (!thead) return { ok: false, error: "thead_not_found", title, rows: [] };
  const got = Array.from(thead.querySelectorAll("th")).map((th) => th.textContent.trim());
  if (got.length !== EXPECTED_HEADERS.length || got.some((h, i) => h !== EXPECTED_HEADERS[i])) {
    return { ok: false, error: "headers_changed", got, title, rows: [] };
  }
  const tbody = table.querySelector("tbody");
  if (!tbody) return { ok: true, title, rows: [] }; // sin filas (fin de semana/feriado)

  const consultaDate = new Date(`${fechaConsulta}T00:00:00Z`);
  const year = consultaDate.getUTCFullYear();

  const filas: Fila[] = [];
  for (const tr of Array.from(tbody.querySelectorAll("tr"))) {
    const tds = Array.from(tr.querySelectorAll("td"));
    if (tds.length !== EXPECTED_HEADERS.length) continue;
    const t = tds.map((td) => td.textContent);
    const port = cleanText(t[0]);
    const vessel = cleanText(t[2]);
    if (port == null || vessel == null) continue; // NOT NULL en la DB
    const cat = cleanText(t[4]);
    filas.push({
      fecha_consulta: fechaConsulta, port, berth: cleanText(t[1]), vessel,
      ops: cleanText(t[3]), cat, cargo: cleanText(t[5]), quantity: parseQty(t[6]),
      dest_orig: cleanText(t[7]), area: cleanText(t[8]), shipper: cleanText(t[9]),
      eta: isoDate(rollover(parseShort(t[10], year), consultaDate)),
      etb: isoDate(rollover(parseShort(t[11], year), consultaDate)),
      ets: isoDate(rollover(parseShort(t[12], year), consultaDate)),
      remarks: cleanText(t[13]), es_agro: esAgro(cat),
    });
  }
  // Dedup de filas idénticas (evita "ON CONFLICT cannot affect row a second time").
  const keys = ["fecha_consulta", "port", "berth", "vessel", "ops", "cat", "cargo",
    "quantity", "dest_orig", "area", "shipper", "eta", "etb", "ets", "remarks"];
  const vistas = new Set<string>();
  const dedup: Fila[] = [];
  for (const f of filas) {
    const clave = keys.map((k) => JSON.stringify(f[k] ?? null)).join("|");
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    dedup.push(f);
  }
  return { ok: true, title, rows: dedup };
}

async function upsert(rows: Fila[]): Promise<void> {
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const res = await fetch(`${SB_URL}/rest/v1/lineup?on_conflict=${CONFLICT}`, {
      method: "POST",
      headers: {
        apikey: SVC, authorization: `Bearer ${SVC}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows.slice(i, i + BATCH)),
    });
    if (!res.ok) throw new Error(`upsert HTTP ${res.status} ${await res.text()}`);
  }
}

// --- handler ---------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Solo el service_role puede disparar la ingesta (escribe en la base). El gateway
  // (verify_jwt=true) ya validó la firma del JWT; acá exigimos el claim role=service_role
  // (antes se comparaba contra SUPABASE_SERVICE_ROLE_KEY string-a-string, frágil con las
  // dos generaciones de keys del proyecto conviviendo — E5 #12e / fix 22/07).
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!esServiceRole(bearer)) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const u = new URL(req.url);
  const dry = u.searchParams.has("dry");
  const dateParam = u.searchParams.get("date");
  const from = u.searchParams.get("from");
  const to = u.searchParams.get("to");

  // Lista de fechas a scrapear.
  let fechas: string[];
  if (dateParam) {
    fechas = [dateParam];
  } else if (from && to) {
    fechas = [];
    for (let d = from; d <= to; d = addDays(d, 1)) fechas.push(d);
    if (fechas.length > 90) {
      return Response.json({ ok: false, error: "range_too_big", dias: fechas.length }, { status: 400 });
    }
  } else {
    const t = todayART();
    fechas = [t, addDays(t, -1), addDays(t, -2)];
  }
  if (fechas.some((f) => !/^\d{4}-\d{2}-\d{2}$/.test(f))) {
    return Response.json({ ok: false, error: "bad_date", fechas }, { status: 400 });
  }

  const results: unknown[] = [];
  let total = 0;
  for (const f of fechas) {
    const [y, m, d] = f.split("-");
    try {
      const html = await fetchHtml(d, m, y);
      const parsed = parseTable(html, f);
      if (!parsed.ok) {
        results.push({ fecha: f, ok: false, error: parsed.error, got: parsed.got });
        continue;
      }
      if (!dry && parsed.rows.length > 0) await upsert(parsed.rows);
      total += parsed.rows.length;
      results.push({ fecha: f, ok: true, count: parsed.rows.length, empty: parsed.rows.length === 0, title: parsed.title });
    } catch (e) {
      results.push({ fecha: f, ok: false, error: "fetch_failed", detail: String(e) });
    }
    await new Promise((r) => setTimeout(r, 1200)); // cortesía con ISA
  }

  // Sin guard de "0 filas" acá: esta función procesa UNA lista de fechas por invocación sin
  // saber si el caller está en modo diario o backfill (ese guard vive en `ingest-lineup.mjs`,
  // que sí tiene ese contexto — ver comment de arriba). Acá solo reportamos error real de
  // fetch/parseo por fecha.
  const anyErr = results.some((r) => !(r as { ok: boolean }).ok);
  const ok = !anyErr;
  return Response.json({ ok, dry, total, results }, { status: ok ? 200 : 500 });
});
