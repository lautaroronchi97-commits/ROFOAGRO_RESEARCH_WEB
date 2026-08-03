#!/usr/bin/env node
/**
 * Ingesta de estimaciones de producción de la DEA — SAGyP (Argentina, oficial) a Supabase
 * (tabla estimaciones_produccion). Módulo "Calendario + estimaciones" — docs/PLAN_CALENDARIO_PRODUCCION.md (sesión C).
 *
 * ⚠️ Historial de bloqueo por IP (lote L5): `datosestimaciones.magyp.gob.ar` reseteaba la conexión
 * a nivel TLS desde GitHub Actions, la Edge Function `dea-fetch` (São Paulo) y un sandbox de Claude
 * Code — 3 proveedores cloud distintos, mismo bloqueo, del 22/07 al 03/08/2026. El 03/08 volvió a
 * responder (probado vía `dea-fetch` tras arreglar un bug de auth no relacionado) → **de vuelta en
 * el schedule semanal** (`.github/workflows/ingest-estimaciones-ar.yml`, junto con GEA). Si se
 * bloquea de nuevo, la CARGA SEMI-MANUAL sigue como respaldo (Lautaro baja el CSV de su navegador,
 * no bloqueado, y lo sube por `/admin/datos/dea` → RPC `admin_upsert_estimaciones`, reusando el
 * parser de `src/lib/parse-dea.ts`). Este script también sirve para reprocesar un CSV ya descargado
 * (`--csv archivo.csv`) o forzar una corrida fuera del schedule (`dea_probe` del dispatch).
 *
 * Fuente: exportación CSV completa por POST, sin auth (Datos de Estimaciones Agrícolas):
 *   POST https://datosestimaciones.magyp.gob.ar/reportes.php?reporte=Estimaciones   body: Dataset=Dataset
 *   CSV Latin-1, separador ';', ~11,5 MB (serie 1969/70 → hoy). Columnas:
 *     "ID Provincia";Provincia;"ID Departamento";Departamento;"Id Cultivo";Cultivo;"ID Campaña";
 *     Campana;"Sup. Sembrada (Ha)";"Sup. Cosechada (Ha)";"Producción (Tn)";"Rendimiento (Kg/Ha)"
 *
 * Agregamos provincia/departamento → NACIONAL por (cultivo, campaña). La DEA guarda SOLO el valor
 * vigente (no hay vintages en origen) → cada corrida SNAPSHOTEA el valor de hoy como un vintage propio
 * (fecha_publicacion = fecha de corrida). Así, semana a semana, se arma la evolución de la estimación.
 *   - produccion = Σ Producción(Tn) → Mt
 *   - area       = Σ Sup. Sembrada(Ha) → Mha   (misma base "sembrada" que GEA/CONAB)
 *   - rinde      = Σ Producción(Tn) / Σ Sup. Cosechada(Ha) → tn/ha  (rinde nacional realizado)
 * La campaña ya viene "YYYY/YY" en origen → no hay que normalizar.
 *
 * Cultivos "total" para no doblar (Soja total, Trigo total, Cebada total; Maíz/Girasol/Sorgo son únicos).
 *
 * Uso:
 *   node scripts/ingest-dea.mjs                     # snapshot de las últimas 3 campañas (fetch a la fuente, HOY bloqueada)
 *   node scripts/ingest-dea.mjs --csv archivo.csv   # reprocesar un CSV ya descargado (Lautaro/navegador), sin red
 *   node scripts/ingest-dea.mjs --since 2019        # snapshot de campañas desde 2019/20 (base histórica)
 *   node scripts/ingest-dea.mjs --full              # todas las campañas del CSV (1969/70 → hoy)
 *   node scripts/ingest-dea.mjs --out filas.json    # dry-run: escribe JSON, no sube nada
 *   node scripts/ingest-dea.mjs --date 2026-07-12   # forzar la fecha del snapshot (para backfill puntual)
 *
 * Requiere en el entorno (NO en el repo), salvo en modo --out:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY (service_role; solo en el cron, nunca en la web)
 */

import { writeFileSync, readFileSync } from "node:fs";
import { parseDea } from "../src/lib/parse-dea.ts";

const URL_DEA = "https://datosestimaciones.magyp.gob.ar/reportes.php?reporte=Estimaciones";
const UA = "Mozilla/5.0 (ROFOAGRO research)";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

async function fetchCsv(csvPath) {
  if (csvPath) {
    // Reprocesar un CSV ya descargado (ej. por Lautaro desde su navegador) sin pasar por la red.
    return new TextDecoder("latin1").decode(readFileSync(csvPath));
  }
  // MAGyP filtra las IPs de datacenter en `datosestimaciones.magyp.gob.ar` (E5 #8; confirmado en
  // el lote L5 del 22/07 desde 3 proveedores cloud distintos — GitHub Actions, la Edge Function
  // `dea-fetch` en São Paulo, y un sandbox de Claude Code — los 3 bloqueados a nivel TLS/conexión).
  // Este dispatch queda SOLO para re-probar si el bloqueo algún día se levanta; la vía real pasó a
  // ser la carga semi-manual del CSV por /admin/datos (Lautaro no está bloqueado).
  const viaEdge = SUPABASE_URL && SERVICE_KEY;
  const res = viaEdge
    ? await fetch(`${SUPABASE_URL}/functions/v1/dea-fetch`, {
        headers: { authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
        signal: AbortSignal.timeout(260000),
      })
    : await fetch(URL_DEA, {
        method: "POST",
        headers: { "user-agent": UA, "content-type": "application/x-www-form-urlencoded" },
        body: "Dataset=Dataset",
        signal: AbortSignal.timeout(260000),
      });
  if (!res.ok) throw new Error(`DEA CSV${viaEdge ? " (via dea-fetch)" : ""}: HTTP ${res.status} ${await res.text().catch(() => "")}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return new TextDecoder("latin1").decode(buf);
}

async function upsert(rows) {
  const BATCH = 1000;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/estimaciones_produccion`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        authorization: `Bearer ${SERVICE_KEY}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`upsert lote ${i}: HTTP ${res.status} ${await res.text()}`);
  }
}

async function main() {
  const outFile = arg("out", null);
  const csvPath = arg("csv", null);
  if (!outFile && (!SUPABASE_URL || !SERVICE_KEY)) {
    console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY (o usá --out para dry-run).");
    process.exit(1);
  }
  const fecha = arg("date", new Date().toISOString().slice(0, 10));
  // En el cron alcanza con snapshotear las campañas que aún se revisan (las viejas ya están cerradas).
  let sinceYear;
  if (hasFlag("full")) sinceYear = null;
  else if (arg("since", null)) sinceYear = Number(arg("since", null));
  else sinceYear = new Date().getUTCFullYear() - 2;

  console.log(`Ingesta DEA snapshot ${fecha}${sinceYear ? ` (campañas desde ${sinceYear}/…)` : " (todas)"}${csvPath ? ` — desde ${csvPath}` : ""}`);
  const csv = await fetchCsv(csvPath);
  const rows = parseDea(csv, fecha, sinceYear);
  console.log(`${rows.length} filas nacionales (grano × campaña × variable).`);

  if (outFile) {
    writeFileSync(outFile, JSON.stringify(rows, null, 0));
    console.log(`Escrito ${outFile} (dry-run, no se subió nada).`);
    return;
  }
  // Guard anti "falso verde": el CSV oficial siempre trae las campañas vigentes; 0 filas = cambió
  // el export de SAGyP o cayó la fuente. No pasar en verde sin insertar.
  if (rows.length === 0) {
    console.error("ERROR: DEA devolvió 0 filas (cambió el CSV oficial de SAGyP o cayó la fuente). No se da por bueno.");
    process.exit(1);
  }
  console.log("Upsert a estimaciones_produccion...");
  await upsert(rows);
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
