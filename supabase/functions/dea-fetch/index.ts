// Edge Function: dea-fetch
// -----------------------------------------------------------------------------
// Proxy del CSV oficial de la DEA (SAGyP). `datosestimaciones.magyp.gob.ar`
// filtra las IPs de GitHub Actions (ConnectTimeout 4/4 desde el 16/07 —
// auditoría E5, hallazgo #8); desde sa-east-1 (São Paulo) responde. Es el mismo
// remedio que ya salvó a lineup/ISA. La función SOLO baja y devuelve el CSV: el
// parse y el upsert siguen en scripts/ingest-dea.mjs (que ahora la invoca).
//
// Auth: verify_jwt del gateway (valida la firma) + el bearer decodificado debe
// traer el claim role=service_role (la anon key pública no puede gatillar el
// fetch). No compara contra Deno.env SUPABASE_SERVICE_ROLE_KEY string-a-string:
// el proyecto tiene en paralelo las keys legacy (JWT) y las nuevas (sb_secret_…)
// y ese valor reservado puede no ser idéntico al JWT que manda el caller aunque
// ambos sean válidos — fix 22/07, mismo criterio que lineup-ingest.
//
// Fix 03/08/2026: la migración a las keys nuevas (`sb_publishable_`/`sb_secret_`,
// ver docs/PRELAUNCH_CHECKLIST.md) rompió el decode — esas keys no son un JWT de
// 3 partes, así que el check de `role` fallaba y esto devolvía 403 con la key
// secreta real (mismo bug encontrado en `lineup-ingest`, mismo fix: aceptar el
// secret key nuevo por prefijo, es el equivalente de service_role).
// -----------------------------------------------------------------------------

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const URL_DEA = "https://datosestimaciones.magyp.gob.ar/reportes.php?reporte=Estimaciones";

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

Deno.serve(async (req: Request) => {
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!esServiceRole(bearer)) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  try {
    const res = await fetch(URL_DEA, {
      method: "POST",
      headers: {
        "user-agent": "Mozilla/5.0 (ROFOAGRO research)",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "Dataset=Dataset",
      // El reporte pesa ~11,5 MB y MAGyP lo arma dinámicamente: 120s no alcanzaba
      // (2 timeouts reales verificados, ~121s cada uno) — el wall clock limit de
      // Supabase Edge Functions es 400s, dejamos margen.
      signal: AbortSignal.timeout(240000),
    });
    if (!res.ok) {
      return Response.json({ ok: false, error: `dea_http_${res.status}` }, { status: 502 });
    }
    // Pass-through en streaming (el CSV pesa ~11,5 MB; latin-1 lo decodifica el script).
    return new Response(res.body, {
      status: 200,
      headers: { "content-type": "text/csv" },
    });
  } catch (e) {
    return Response.json({ ok: false, error: "fetch_failed", detail: String(e) }, { status: 502 });
  }
});
