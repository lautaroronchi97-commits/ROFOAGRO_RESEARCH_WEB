#!/usr/bin/env node
import { canonShipper } from "../src/lib/lineup/shippers.ts";
import {
  CHECKS,
  FUTURO,
  MATVIEWS,
  ULTIMO_SEED_CALENDARIO,
  MIN_DIAS_SEED_CALENDARIO,
  ROSTER_UMBRAL_OTROS_PCT,
} from "../src/lib/monitoreo/catalogo.ts";

// Healthcheck de frescura de las bases que alimenta ESTE repo (crons de GitHub Actions).
//
// Revisa el último dato de cada tabla propia y lo compara contra su cadencia esperada. Si algo se
// atrasó más de su umbral, sale con exit 1 → el workflow queda en ROJO y GitHub avisa por mail
// (notificación default de un scheduled workflow que falla). Es la red que faltaba: hasta ahora la
// única señal de vida era el exit code de cada ingesta, que MIENTE (un parser roto termina en verde
// sin insertar; ver los guards de 0-filas en los scripts de ingesta).
//
// Solo LECTURA. Uso:
//   node scripts/healthcheck-frescura.mjs           # revisa y sale 1 si hay atrasos
//   node scripts/healthcheck-frescura.mjs --json     # además imprime el detalle en JSON
// Entorno (NO en el repo): SUPABASE_URL + SUPABASE_SERVICE_KEY (o SUPABASE_ANON_KEY; con leer alcanza).

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const JSON_OUT = process.argv.includes("--json");

if (!SUPABASE_URL || !KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY (o SUPABASE_ANON_KEY) en el entorno.");
  process.exit(1);
}

const HOY = new Date();

function diasDesde(fecha) {
  // fecha puede ser "YYYY-MM-DD" (date) o un timestamp ISO; normalizamos al día UTC.
  const iso = String(fecha).slice(0, 10);
  const d = new Date(`${iso}T00:00:00Z`);
  return Math.floor((HOY - d) / 86400000);
}

async function ultimaFecha(tabla, col, filtro) {
  const url =
    `${SUPABASE_URL}/rest/v1/${tabla}` +
    `?select=${col}&${col}=not.is.null&order=${col}.desc&limit=1${filtro ?? ""}`;
  const res = await fetch(url, {
    headers: { apikey: KEY, authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  const j = await res.json();
  return j[0]?.[col] ?? null;
}

// CHECKS/FUTURO/MATVIEWS/ULTIMO_SEED_CALENDARIO/ROSTER_UMBRAL_OTROS_PCT viven en
// src/lib/monitoreo/catalogo.ts (importado arriba) — es el catálogo único que también
// consume el panel /admin/conexiones. Mantenerlos en un solo lugar evita que el
// healthcheck (lo que corre solo) y el panel (lo que Lautaro mira) diverjan con el tiempo.

/** Share de "OTROS" (shippers no reconocidos por shippers.ts) en la última rueda del line-up. */
async function erosionRoster() {
  const fechaUrl = `${SUPABASE_URL}/rest/v1/lineup?select=fecha_consulta&es_agro=eq.true&order=fecha_consulta.desc&limit=1`;
  const fechaRes = await fetch(fechaUrl, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
  if (!fechaRes.ok) throw new Error(`HTTP ${fechaRes.status} ${(await fechaRes.text()).slice(0, 120)}`);
  const fecha = (await fechaRes.json())[0]?.fecha_consulta ?? null;
  if (!fecha) return { fecha: null, pctOtros: null, tnOtros: 0, tnTotal: 0 };

  const rowsUrl =
    `${SUPABASE_URL}/rest/v1/lineup?select=shipper,quantity` +
    `&fecha_consulta=eq.${fecha}&es_agro=eq.true&ops=eq.LOAD`;
  const rowsRes = await fetch(rowsUrl, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
  if (!rowsRes.ok) throw new Error(`HTTP ${rowsRes.status} ${(await rowsRes.text()).slice(0, 120)}`);
  const rows = await rowsRes.json();

  let tnTotal = 0;
  let tnOtros = 0;
  for (const r of rows) {
    const q = Number(r.quantity ?? 0);
    if (!Number.isFinite(q) || q <= 0) continue;
    tnTotal += q;
    if (canonShipper(r.shipper).canon === "OTROS") tnOtros += q;
  }
  const pctOtros = tnTotal > 0 ? (100 * tnOtros) / tnTotal : null;
  return { fecha, pctOtros, tnOtros, tnTotal };
}

async function main() {
  const detalle = [];
  let fallas = 0;

  for (const c of CHECKS) {
    let fecha = null;
    let error = null;
    try {
      fecha = await ultimaFecha(c.tabla, c.col, c.filtro);
    } catch (e) {
      error = e.message;
    }
    const dias = fecha ? diasDesde(fecha) : null;
    const atrasado = error != null || fecha == null || dias > c.maxDias;
    if (atrasado) fallas++;
    const marca = error ? "✗ ERROR" : fecha == null ? "✗ SIN DATOS" : atrasado ? "✗ ATRASADO" : "✓";
    console.log(
      `${marca}  ${c.nombre}: ` +
        (error
          ? error
          : fecha == null
            ? "sin filas"
            : `último ${String(fecha).slice(0, 10)} (${dias}d · ${c.cadencia} · umbral ${c.maxDias}d)`),
    );
    detalle.push({ ...c, fecha, dias, atrasado, error });
  }

  // Matviews de mesa: su última fila debe coincidir con la de su tabla base.
  for (const m of MATVIEWS) {
    let mvF = null;
    let baseF = null;
    let error = null;
    try {
      mvF = await ultimaFecha(m.mv, m.mvCol);
      baseF = await ultimaFecha(m.base, m.baseCol);
    } catch (e) {
      error = e.message;
    }
    // Rezagada si la base tiene fecha más nueva que la matview (más de 1 día de diferencia tolerado).
    const rezago = error == null && mvF && baseF ? diasDesde(mvF) - diasDesde(baseF) : null;
    const atrasado = error != null || mvF == null || (rezago != null && rezago > 1);
    if (atrasado) fallas++;
    const marca = error ? "✗ ERROR" : mvF == null ? "✗ SIN DATOS" : atrasado ? "✗ SIN REFRESCAR" : "✓";
    console.log(
      `${marca}  matview ${m.nombre}: ` +
        (error
          ? error
          : mvF == null
            ? "sin filas"
            : `matview ${String(mvF).slice(0, 10)} vs base ${String(baseF).slice(0, 10)} (rezago ${rezago}d)`),
    );
    detalle.push({ nombre: `matview ${m.nombre}`, mvF, baseF, rezago, atrasado, error });
  }

  // Seeds de futuro (E5 #9): días RESTANTES en vez de días de atraso.
  for (const f of FUTURO) {
    let fecha = null;
    let error = null;
    try {
      fecha = await ultimaFecha(f.tabla, f.col);
    } catch (e) {
      error = e.message;
    }
    const restantes = fecha ? -diasDesde(fecha) : null;
    const agotado = error != null || fecha == null || restantes < f.minDiasFuturo;
    if (agotado) fallas++;
    const marca = error ? "✗ ERROR" : agotado ? "✗ POR AGOTARSE" : "✓";
    console.log(
      `${marca}  ${f.nombre}: ` +
        (error ? error : fecha == null ? "sin filas" : `hasta ${String(fecha).slice(0, 10)} (${restantes}d de futuro · mínimo ${f.minDiasFuturo}d · ${f.nota})`),
    );
    detalle.push({ nombre: f.nombre, fecha, restantes, atrasado: agotado, error });
  }

  {
    const restantes = -diasDesde(ULTIMO_SEED_CALENDARIO);
    const agotado = restantes < MIN_DIAS_SEED_CALENDARIO;
    if (agotado) fallas++;
    console.log(
      `${agotado ? "✗ POR AGOTARSE" : "✓"}  seed calendario oficial: hasta ${ULTIMO_SEED_CALENDARIO} ` +
        `(${restantes}d de futuro · mínimo ${MIN_DIAS_SEED_CALENDARIO}d · sembrar el año próximo en src/lib/calendario.ts y subir ULTIMO_SEED_CALENDARIO en catalogo.ts)`,
    );
    detalle.push({ nombre: "seed calendario oficial", fecha: ULTIMO_SEED_CALENDARIO, restantes, atrasado: agotado });
  }

  // Erosión del roster: NO suma a `fallas` (no es una fuente caída) — solo avisa.
  {
    let r = { fecha: null, pctOtros: null, tnOtros: 0, tnTotal: 0 };
    let error = null;
    try {
      r = await erosionRoster();
    } catch (e) {
      error = e.message;
    }
    const erosionado = error == null && r.pctOtros != null && r.pctOtros > ROSTER_UMBRAL_OTROS_PCT;
    const marca = error ? "✗ ERROR" : r.pctOtros == null ? "· SIN DATOS" : erosionado ? "⚠ EROSIONADO" : "✓";
    const msg = error
      ? error
      : r.pctOtros == null
        ? "sin rueda reciente"
        : `OTROS ${r.pctOtros.toFixed(1)}% de la rueda ${r.fecha} (${Math.round(r.tnOtros).toLocaleString("es-AR")} de ${Math.round(r.tnTotal).toLocaleString("es-AR")} t · umbral ${ROSTER_UMBRAL_OTROS_PCT}%)`;
    console.log(`${marca}  roster de exportadores (shippers.ts): ${msg}`);
    if (erosionado) console.log(`::warning::Roster de shippers erosionado — OTROS ${r.pctOtros.toFixed(1)}% (umbral ${ROSTER_UMBRAL_OTROS_PCT}%). Revisar src/lib/lineup/shippers.ts.`);
    detalle.push({ nombre: "roster de exportadores", ...r, atrasado: erosionado, error });
  }

  if (JSON_OUT) console.log("\n" + JSON.stringify(detalle, null, 2));

  if (fallas > 0) {
    console.error(`\n${fallas} tabla(s) con problemas de frescura. Revisar el cron / la fuente.`);
    process.exit(1);
  }
  console.log("\nTodas las tablas al día. ✔");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
