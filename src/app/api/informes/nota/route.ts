import { firmaInformeValida, payloadNota } from "@/lib/informe-auth";

/**
 * GET /api/informes/nota?id=&n=&t= — nota 1-tap desde el mail del informe (N15, E1 de
 * docs/PLAN_INFORMES_V3.md §10 item 7): un click en 👍/😐/👎 (mapeados a n=5/3/1, la escala
 * 1-5 de `informes_generados.nota`) graba la nota SIN login — el link viene firmado con HMAC
 * (`INFORME_SHARE_SECRET`, comparación timing-safe) en vez de una sesión, porque quien lo abre
 * es un mail, no un navegador logueado. Nunca reescribe `feedback` (texto): eso sigue siendo el
 * mini-form de /informes.
 *
 * Escribe con la SERVICE KEY directo por REST (mismo patrón que `signedUrl()` de
 * /informes/page.tsx) — no por la RPC `admin_feedback_informe`, que exige `is_admin()` y acá no
 * hay sesión. El PATCH filtra `estado=eq.enviado` además del `id`: un id válido pero de un
 * informe que nunca se envió (no debería poder pasar — el link solo se genera para enviados) no
 * escribe nada, en vez de tocar un borrador.
 */

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pagina(titulo: string, cuerpo: string, status: number): Response {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo} · ROFO AGRO</title><style>body{font-family:system-ui,sans-serif;background:#0c130d;color:#edf2e3;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}main{max-width:420px}h1{font-size:1.15rem;margin:0 0 8px}p{color:#9fb09a;font-size:.95rem;line-height:1.5}</style></head><body><main><h1>${titulo}</h1><p>${cuerpo}</p></main></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  const nRaw = searchParams.get("n") ?? "";
  const t = searchParams.get("t") ?? "";
  const n = /^[1-5]$/.test(nRaw) ? Number(nRaw) : null;

  if (!ID_RE.test(id) || n === null || !firmaInformeValida(payloadNota(id, n), t)) {
    return pagina("Link inválido", "Este link de nota no es válido o ya venció. No se registró nada.", 400);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return pagina("No disponible", "El servicio no está configurado en este momento. Probá de nuevo más tarde.", 503);
  }

  try {
    const res = await fetch(`${url}/rest/v1/informes_generados?id=eq.${id}&estado=eq.enviado`, {
      method: "PATCH",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify({ nota: n }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return pagina("No se pudo guardar", "Hubo un problema guardando la nota. Probá de nuevo más tarde.", 502);
    }
  } catch {
    return pagina("No se pudo guardar", "Hubo un problema guardando la nota. Probá de nuevo más tarde.", 502);
  }

  const etiqueta = n >= 4 ? "👍 Buenísimo" : n <= 2 ? "👎 A mejorar" : "😐 Correcto";
  return pagina("¡Gracias!", `Quedó registrado: ${etiqueta}. La próxima corrida lo tiene en cuenta.`, 200);
}
