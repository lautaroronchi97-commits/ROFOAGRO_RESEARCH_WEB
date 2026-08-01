import { sbSelect } from "@/lib/supabase";

/**
 * GET /api/health — probe público y liviano para monitoreo externo (UptimeRobot free
 * y similares). `/admin/conexiones` es el tablero interno (requiere sesión); esto es
 * lo que un servicio de afuera puede pinguear sin credenciales.
 *
 * Chequea: la app responde (trivial, si esta función corre ya es cierto) + Supabase
 * responde a un SELECT liviano sobre una tabla chica y pública (`vencimientos`, sin
 * dato sensible). Sin caché — cada ping mide el estado real de ese instante.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const inicio = Date.now();
  const db = await sbSelect("vencimientos?select=symbol&limit=1", 0);
  const supabaseOk = db.ok;

  const body = {
    status: supabaseOk ? "ok" : "degraded",
    checks: { app: true, supabase: supabaseOk },
    latencyMs: Date.now() - inicio,
    timestamp: new Date().toISOString(),
  };

  return Response.json(body, { status: supabaseOk ? 200 : 503 });
}
