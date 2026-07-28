#!/usr/bin/env node
/**
 * alerta-mail — aviso por mail (Resend) cuando un workflow crítico queda en ROJO (E5 #7).
 *
 * El mail default de GitHub ya falló 3 veces como único canal (PAS 9 días, DEA 5 días, lineup 3
 * días sin que nadie lo vea — auditorías E5/E6). Este script corre en un step `if: failure()`
 * de los workflows críticos y manda un mail explícito.
 *
 * Uso (desde el workflow):
 *   node scripts/alerta-mail.mjs --workflow "Nombre" --run "https://github.com/.../runs/123"
 *   node scripts/alerta-mail.mjs --workflow "Nombre" --run "..." --detalle-archivo /tmp/x.txt
 *
 * Entorno:
 *   RESEND_API_KEY  (secret de Actions — la carga Lautaro; sin la key el step avisa y sale 0
 *                    para no encimar un rojo propio al rojo real)
 *   RESEND_FROM     (opcional; default onboarding@resend.dev, el sender de prueba de Resend)
 *   ALERTA_EMAIL    (opcional; default lautaroronchi97@gmail.com — decisión Duda #3, 22/07/2026)
 */

import { readFileSync } from "node:fs";

const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || "onboarding@resend.dev";
const TO = process.env.ALERTA_EMAIL || "lautaroronchi97@gmail.com";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

async function main() {
  const workflow = arg("workflow", "workflow");
  const run = arg("run", "");
  // Opcional: texto plano (ej. el resumen de scripts/chequeo-anomalias.mjs --salida) para no
  // obligar a Lautaro a abrir el log de Actions a leer qué anomalía disparó el rojo.
  const detalleArchivo = arg("detalle-archivo");
  let detalle = "";
  if (detalleArchivo) {
    try {
      detalle = `\n${readFileSync(detalleArchivo, "utf8").slice(0, 4000)}\n`;
    } catch {
      // el archivo puede no existir si el script falló antes de escribirlo — no es fatal
    }
  }
  if (!KEY) {
    console.log("::warning::alerta-mail: falta el secret RESEND_API_KEY — no se mandó el aviso (cargalo en Settings → Secrets → Actions).");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: `ROFO AGRO crons <${FROM}>`,
      to: [TO],
      subject: `🔴 ${workflow} en ROJO`,
      text:
        `El workflow "${workflow}" acaba de fallar.\n${detalle}\n` +
        `Log del run: ${run}\n\n` +
        `Guía rápida: docs/auditoria/E5-infra.md (Anexo B) tiene el mapa de fallas conocidas por workflow.`,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    console.log(`::warning::alerta-mail: Resend devolvió HTTP ${res.status} — ${await res.text().catch(() => "")}`);
    return; // no encimar un rojo propio
  }
  console.log(`Aviso enviado a ${TO}.`);
}

main().catch((e) => {
  console.log(`::warning::alerta-mail: ${e.message}`);
});
