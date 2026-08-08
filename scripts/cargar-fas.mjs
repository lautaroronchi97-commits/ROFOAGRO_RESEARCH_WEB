#!/usr/bin/env node
/**
 * Carga MANUAL (una vez, o cada vez que Lautaro re-suba la serie) del histórico "FAS Teórico
 * Oficial SAGyP por Producto" de Agrochat a `fas_historico` (C32/F1,
 * docs/PLAN_CALOR_MERCADERIA.md §3.3/§4/§5 prompt F1 punto 4). Mismo patrón que
 * `cargar-compras.mjs`/`cargar-camiones-williams.mjs`: el parseo vive en `src/lib/parse-fas.ts`
 * (importado, no reimplementado), este script solo lo invoca + valida + sube.
 *
 * ⚠️ El checklist §4.3 de re-verificación es OBLIGATORIO antes de cargar (puntos 1-3 los corre
 * `--check`, mecánicos; los puntos 4-6 —TC de 3 fechas conocidas, cotejo vivo contra BCR/Nuestro
 * del día, spot-check contra la publicación oficial— son manuales, se documentan en la sesión).
 *
 * Uso:
 *   node scripts/cargar-fas.mjs --in serie.csv --check         # SOLO el checklist, no sube nada
 *   node scripts/cargar-fas.mjs --in serie.csv --out filas.json # dry-run: no sube, escribe el JSON
 *   node scripts/cargar-fas.mjs --in serie.csv                  # upsert a Supabase (fuente='sagyp')
 *
 * Requiere (salvo --check/--out): SUPABASE_URL, SUPABASE_SERVICE_KEY (service_role; nunca en la web).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { parseFasCsv, checklistFasCsv } from "../src/lib/parse-fas.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : def;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

async function upsert(rows) {
  const BATCH = 1000;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/fas_historico?on_conflict=fecha,producto,fuente`, {
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
    console.log(`  upsert ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
}

function imprimirChecklist(c) {
  console.log("\n=== Checklist §4.3 (docs/PLAN_CALOR_MERCADERIA.md) ===");
  console.log(`Filas válidas: ${c.totalFilas} · fechas únicas: ${c.fechasUnicas}`);
  console.log(`Productos: ${c.productos.join(", ")}`);
  console.log(`Duplicados fecha+producto (debe ser 0): ${c.duplicadosFechaProducto}`);
  console.log(`Fines de semana / feriados (debe ser 0 — "solo días hábiles"): ${c.finesDeSemanaOFeriados}`);
  console.log(`Inconsistencias FAS_USD≈FAS_ARS/TC (debe ser 0): ${c.inconsistenciasUsdArsTc}`);
  console.log("Rango por producto:");
  for (const [p, r] of Object.entries(c.rangoPorProducto)) {
    console.log(`  ${p}: ${r.desde} → ${r.hasta} (${r.filas} filas)`);
  }
  console.log(
    "\nPendiente MANUAL (puntos 4-6 del checklist, no automatizables acá): TC de 3 fechas conocidas · " +
      "cotejo vivo contra la columna SAGyP de BCR y el 'Nuestro' reconstruido con fob-oficial.ts (mismo " +
      "día) · spot-check de 2-3 fechas históricas contra la publicación oficial de SAGyP si es alcanzable.",
  );
}

async function main() {
  const inFile = arg("in");
  const outFile = arg("out");
  const checkOnly = hasFlag("check");
  if (!inFile) {
    console.error("Falta --in <csv>.");
    process.exit(1);
  }
  if (!checkOnly && !outFile && (!SUPABASE_URL || !SERVICE_KEY)) {
    console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY (o usá --check / --out para dry-run).");
    process.exit(1);
  }

  const csv = readFileSync(inFile, "utf8");
  const { filas, descartes } = parseFasCsv(csv);

  console.log(`Archivo: ${filas.length} filas válidas, ${descartes.length} descartadas.`);
  for (const d of descartes.slice(0, 30)) console.log(`  ⚠ fila ${d.fila}: ${d.motivo}`);
  if (descartes.length > 30) console.log(`  … y ${descartes.length - 30} descartes más.`);

  if (filas.length === 0) {
    console.error("ERROR: 0 filas válidas — no se da por bueno (¿cabecera/formato distinto al esperado?).");
    process.exit(1);
  }

  const checklist = checklistFasCsv(filas);
  imprimirChecklist(checklist);

  if (checkOnly) return;

  if (checklist.duplicadosFechaProducto > 0 || checklist.inconsistenciasUsdArsTc > 0) {
    console.error(
      "ERROR: el checklist encontró duplicados o inconsistencias FAS_USD/FAS_ARS/TC — revisar antes de cargar " +
        "(no se sube automáticamente con hallazgos sin explicar).",
    );
    process.exit(1);
  }

  const rows = filas.map((f) => ({
    fecha: f.fecha,
    producto: f.producto,
    fuente: "sagyp",
    fas_usd: f.fasUsd,
    fas_ars: f.fasArs,
    tc: f.tcMayorista,
  }));

  if (outFile) {
    writeFileSync(outFile, JSON.stringify(rows, null, 0));
    console.log(`Escrito ${outFile} (dry-run, no se subió nada).`);
    return;
  }

  console.log(`Upsert de ${rows.length} filas (fuente=sagyp) a fas_historico...`);
  await upsert(rows);
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
