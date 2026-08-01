#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Backup versionado de las tablas 100% (o mayormente) de carga manual — la ÚNICA red real de
// backups mientras el proyecto Supabase siga en plan Free (sin backup automático, decisión de
// Lautaro del 01/08/2026, ver docs/PRELAUNCH_CHECKLIST.md Fase 4). Las tablas alimentadas por
// cron se re-ingieren solas desde la fuente si hace falta; estas NO — lo que Lautaro cargó a
// mano (o lo que llegó por un scraper sin backfill posible) es irreproducible.
//
// Vuelca cada tabla completa a `data/backups/<tabla>.json` (ruta fija, sobreescrita cada corrida
// — el HISTORIAL de versiones lo da git, no nombres de archivo con fecha; evita que el repo
// crezca sin límite). Solo LECTURA sobre Supabase.
//
// Guard (mismo espíritu que el detector de anomalías D7): si una tabla trae 0 filas, o muchas
// menos que el backup anterior, es señal de un fetch roto — NO se sobreescribe el archivo bueno
// que ya está commiteado. El resto de las tablas se procesan igual (fallo parcial, no atómico).
//
// Uso: node scripts/backup-tablas-manuales.mjs
// Entorno (NO en el repo): SUPABASE_URL + SUPABASE_SERVICE_KEY.

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en el entorno.");
  process.exit(1);
}

const PAGE = 1000;
const DEST_DIR = path.join(import.meta.dirname, "..", "data", "backups");

// Cada tabla con el orden TOTAL de su primary key real (ver las migraciones en
// supabase/migrations/) — sin esto, la paginación por offset de PostgREST puede repetir o
// saltear filas cuando hay muchas por el mismo valor de la primera columna.
const TABLAS = [
  { tabla: "compras", orden: "id.asc" },
  { tabla: "camiones", orden: "fecha.asc,zona.asc,producto.asc,fuente.asc" },
  {
    tabla: "estimaciones_produccion",
    orden: "organismo.asc,pais.asc,grano.asc,campania.asc,variable.asc,fecha_publicacion.asc",
  },
  { tabla: "lecap_pago_final", orden: "ticker.asc" },
  { tabla: "pas_zonas", orden: "grano.asc,campania.asc,zona.asc" },
  { tabla: "pas_condicion", orden: "grano.asc,ciclo.asc,zona.asc,campania.asc,semana.asc" },
];

/** SELECT paginado completo de una tabla (PostgREST corta en 1000 filas por request). */
async function traerTodo(tabla, orden) {
  const filas = [];
  for (let off = 0; ; off += PAGE) {
    const url = `${SUPABASE_URL}/rest/v1/${tabla}?select=*&order=${orden}&limit=${PAGE}&offset=${off}`;
    const res = await fetch(url, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
    if (!res.ok) throw new Error(`${tabla}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const pagina = await res.json();
    filas.push(...pagina);
    if (pagina.length < PAGE) break;
    if (off > 500_000) throw new Error(`${tabla}: más de 500k filas, revisá el orden/filtro`);
  }
  return filas;
}

async function contarFilasExistentes(archivo) {
  try {
    const raw = await readFile(archivo, "utf8");
    const json = JSON.parse(raw);
    return Array.isArray(json) ? json.length : 0;
  } catch {
    return 0; // no existe todavía (primera corrida) o está corrupto — no bloquea, arranca en 0
  }
}

async function main() {
  await mkdir(DEST_DIR, { recursive: true });

  let huboProblema = false;
  const resumen = [];

  for (const { tabla, orden } of TABLAS) {
    const archivo = path.join(DEST_DIR, `${tabla}.json`);
    let filas;
    try {
      filas = await traerTodo(tabla, orden);
    } catch (err) {
      console.error(`✗ ${tabla}: fetch falló — ${err.message} (backup anterior intacto)`);
      huboProblema = true;
      continue;
    }

    const previas = await contarFilasExistentes(archivo);
    const cayoMucho = previas > 0 && filas.length < previas * 0.5;
    const quedoVacia = filas.length === 0 && previas > 0;

    if (quedoVacia || cayoMucho) {
      console.error(
        `✗ ${tabla}: ${filas.length} filas nuevas vs. ${previas} en el backup anterior — ` +
          `caída sospechosa, NO se sobreescribe (backup anterior intacto).`
      );
      huboProblema = true;
      continue;
    }

    await writeFile(archivo, JSON.stringify(filas, null, 2) + "\n", "utf8");
    resumen.push(`${tabla}: ${filas.length} filas (antes: ${previas})`);
    console.log(`✓ ${tabla}: ${filas.length} filas`);
  }

  console.log("\nResumen:\n" + resumen.map((l) => `  - ${l}`).join("\n"));

  if (huboProblema) {
    console.error("\nAl menos una tabla no se pudo respaldar — revisar el log de arriba.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
