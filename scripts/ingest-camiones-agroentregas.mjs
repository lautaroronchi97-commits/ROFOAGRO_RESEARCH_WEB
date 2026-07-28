#!/usr/bin/env node
/**
 * Ingesta diaria de camiones en puerto de **Agroentregas** a Supabase (C24 del backlog maestro;
 * research y verificación en docs/negocio/10_fuente_camiones_agroentregas.md).
 *
 * Fuente: https://agroentregas.com.ar/RestServiceImpl.svc/camiones — endpoint JSON público (sin
 * auth ni key), el mismo que consume la página total-de-camiones.html desde el navegador. Trae la
 * placa que Agroentregas postea a diario, con MÁS detalle: por planta, por empresa y por grano.
 *
 * Por qué corre a diario y no admite backfill: el endpoint IGNORA cualquier parámetro de fecha
 * (probado: `?fecha=...` devuelve igual el día en curso) — es una foto de hoy y nada más. Lo único
 * que da historia son los dos bloques comparativos que el mismo payload incluye (mismo día de la
 * semana de hace 1 y 2 años), que esta ingesta TAMBIÉN guarda: corriendo el cron todos los días,
 * al cabo de un año quedan tres años de estacionalidad de Up River sin haber backfilleado nada.
 *
 * El parseo (con su control de consistencia contra los totales que publica la propia fuente) vive
 * en src/lib/camiones/agroentregas.ts — el MISMO módulo que lee la web. Una sola fuente de verdad
 * (patrón cargar-camiones-williams.mjs / williams.ts).
 *
 * Uso:
 *   node scripts/ingest-camiones-agroentregas.mjs           # cron diario
 *   node scripts/ingest-camiones-agroentregas.mjs --dry-run # imprime y no escribe nada
 *
 * Requiere en el entorno (NO en el repo): SUPABASE_URL, SUPABASE_SERVICE_KEY (service_role).
 */

import { parseAgroentregas, totalDelBloque } from "../src/lib/camiones/agroentregas.ts";

const API = "https://agroentregas.com.ar/RestServiceImpl.svc/camiones";
const REFERER = "https://agroentregas.com.ar/total-de-camiones.html";
const UA = "Mozilla/5.0 (ROFOAGRO research)";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DRY = process.argv.includes("--dry-run");

async function fetchCrudo() {
  const res = await fetch(API, {
    headers: { "user-agent": UA, accept: "application/json, text/xml, */*", referer: REFERER },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Agroentregas: HTTP ${res.status} — ${API}`);
  return res.text();
}

async function upsert(rows) {
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/camiones_plantas`, {
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
  if (!DRY && (!SUPABASE_URL || !SERVICE_KEY)) {
    console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en el entorno.");
    process.exit(1);
  }

  const crudo = await fetchCrudo();
  const r = parseAgroentregas(crudo);

  // Guard anti falso-verde (E5 Anexo A): cualquier problema de parseo o de consistencia interna
  // corta la corrida con error en vez de guardar un día a medias — que después es indistinguible
  // de un día flojo de verdad. El aviso por mail del workflow se dispara solo.
  if (!r.ok) {
    console.error(`ERROR: no se pudo ingerir la respuesta de Agroentregas — ${r.error}`);
    process.exit(1);
  }

  const filas = r.bloques.flatMap((b) => b.filas);
  for (const b of r.bloques) {
    const etiqueta = b.comparativo ? "comparativo" : "día en curso";
    console.log(`${b.fecha} (${etiqueta}): ${b.plantas} plantas, ${totalDelBloque(b)} camiones, ${b.filas.length} filas`);
  }

  // Un día SIN un solo camión en las 28 plantas de Up River no existe ni un domingo: sería la
  // fuente devolviendo una plantilla vacía, no un dato real.
  const hoy = r.bloques.find((b) => !b.comparativo);
  if (!hoy || totalDelBloque(hoy) === 0) {
    console.error("ERROR: el día en curso vino en 0 camiones — no se da por bueno (probable respuesta vacía de la fuente).");
    process.exit(1);
  }

  if (DRY) {
    console.log(`\n[dry-run] ${filas.length} filas listas, no se escribió nada.`);
    return;
  }

  console.log(`Upsert de ${filas.length} filas...`);
  await upsert(
    filas.map((f) => ({
      fecha: f.fecha,
      planta_id: f.plantaId,
      planta: f.planta,
      empresa: f.empresa,
      producto: f.producto,
      cantidad: f.cantidad,
    })),
  );
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
