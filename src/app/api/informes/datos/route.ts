import { datosDiario } from "@/lib/informe-diario-datos";
import { datosSemanal } from "@/lib/informe-semanal-datos";
import { hoyCordobaISO } from "@/lib/dates";
import { tokenValido, esFechaValida } from "@/lib/informe-auth";

/**
 * GET /api/informes/datos?fecha=YYYY-MM-DD[&tipo=diario|semanal] — auth: header
 * `Authorization: Bearer <INFORME_TOKEN>` (mismo token y patrón timing-safe que
 * /api/views/insumos de MP3). Nunca se cachea.
 *
 * `tipo=diario` (default, MP1): granos (ajustes A3 con Δ vs rueda anterior + pizarra CAC
 * $/USD), dólar mayorista + curva DDF, Chicago + macro, noticias del día, agenda de
 * hoy/mañana, el "color de la rueda"/BCRA que Lautaro carga en /admin/datos, y el view de
 * mercado vigente por grano (V1, con su `evidencia_externa` ya verificada — V4 de
 * PLAN_INFORMES_V2.md §6.4: el diario la puede citar como contexto, cero fetch nuevo). Todo
 * lo arma `datosDiario()` (`informe-diario-datos.ts`) — la MISMA función que consume la
 * plantilla y la página web (E3).
 *
 * `tipo=semanal` (MP2/V3/E4): variación SEMANAL (último dato real vs el de ~7 días antes, sin
 * asumir "viernes calendario") de granos/Chicago/pizarra/dólar oficial, negociado SIO de
 * la semana, comercio exterior (embarques + empresas), view de mercado por grano (con
 * `relacion_previa` — V3 la usa para el bullet automático de SWITCH) y su scorecard
 * (hit-rate/racha a 4 semanas, mencionado 1 vez por mes), y agenda de la semana próxima.
 * Todo lo arma `datosSemanal()` (`informe-semanal-datos.ts`) — la MISMA función que consume
 * la plantilla `/informes/plantilla/semanal` (E4).
 */

export async function GET(request: Request): Promise<Response> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const esperado = process.env.INFORME_TOKEN ?? "";
  const noCache = { "cache-control": "private, no-store" };
  if (!tokenValido(token, esperado)) {
    return Response.json({ error: "No autorizado." }, { status: 401, headers: noCache });
  }

  const hoy = hoyCordobaISO();
  const { searchParams } = new URL(request.url);
  const fechaParam = searchParams.get("fecha") ?? "";
  const fecha = esFechaValida(fechaParam) ? fechaParam : hoy;
  const tipo = searchParams.get("tipo") === "semanal" ? "semanal" : "diario";

  const body = tipo === "semanal" ? await datosSemanal(fecha) : await datosDiario(fecha);
  return Response.json(body, { headers: noCache });
}
