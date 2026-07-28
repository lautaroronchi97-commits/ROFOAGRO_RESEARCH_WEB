import { getCierresGranos, volumenTotalGrano } from "@/lib/futuros";
import { getArbitrajes } from "@/lib/arbitrajes-cierres";
import { getPizarra } from "@/lib/pizarra";
import { getDolarFuturo } from "@/lib/market";
import { getMonitorMercados } from "@/lib/monitor-mercados";
import { getNoticias } from "@/lib/noticias";
import { getEventos } from "@/lib/calendario";
import { getNegociado } from "@/lib/compras/negociado";
import { getMesaEmbarque } from "@/lib/lineup/embarque";
import { getEmpresas } from "@/lib/lineup/empresas";
import { hoyCordobaISO } from "@/lib/dates";
import { sbSelect, sbSelectAll } from "@/lib/supabase";
import { tokenValido, esFechaValida } from "@/lib/informe-auth";
import { parseRows, construirCambios, organismosPresentes } from "@/lib/estimaciones";
import {
  getVariacionSemanalGranos,
  getVariacionSemanalChicago,
  getVariacionSemanalPizarra,
  getVariacionSemanalDolarOficial,
  getViewMercadoVigentePorGrano,
} from "@/lib/informe-semanal";

/**
 * GET /api/informes/datos?fecha=YYYY-MM-DD[&tipo=diario|semanal] — auth: header
 * `Authorization: Bearer <INFORME_TOKEN>` (mismo token y patrón timing-safe que
 * /api/views/insumos de MP3). Nunca se cachea.
 *
 * `tipo=diario` (default, MP1): granos (ajustes A3 con Δ vs rueda anterior + pizarra CAC
 * $/USD), dólar mayorista + curva DDF, Chicago + macro, noticias del día, agenda de
 * hoy/mañana y el "color de la rueda"/BCRA que Lautaro carga en /admin/datos.
 *
 * `tipo=semanal` (MP2): variación SEMANAL (último dato real vs el de ~7 días antes, sin
 * asumir "viernes calendario") de granos/Chicago/pizarra/dólar oficial, negociado SIO de
 * la semana, comercio exterior (embarques + empresas), view de mercado por grano (MP3, si
 * ya hay alguno) y agenda de la semana próxima. Todo reusando las libs existentes.
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

async function datosDiario(fecha: string) {
  const manana = new Date(new Date(`${fecha}T12:00:00Z`).getTime() + 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [cierres, arbitrajes, pizarra, dolarFuturo, chicago, noticias, colorRes, bcraRes, estimRes, interpRes] =
    await Promise.all([
      getCierresGranos(),
      getArbitrajes(),
      getPizarra(),
      getDolarFuturo(),
      getMonitorMercados(),
      getNoticias(),
      sbSelect(`mesa_color?fecha=eq.${fecha}&select=fecha,texto,actualizado`, 0),
      // Compras BCRA: hoy solo carga MANUAL (P3 de PLAN_BACKLOG.md sumará la ingesta
      // automática a esta misma tabla, con fuente='api').
      sbSelect(`compras_bcra?fecha=eq.${fecha}&select=fecha,monto_musd,fuente`, 0),
      sbSelectAll(
        "estimaciones_produccion?select=organismo,pais,grano,campania,variable,valor,unidad,fecha_publicacion,informe,url,actualizado_en&order=fecha_publicacion.asc",
        3600,
      ),
      // MP4 (interpretación de informes de organismos, aún sin construir): consulta
      // "adelantada" — mientras la tabla no exista, sbSelect degrada a [] sin romper.
      sbSelect(
        `interpretaciones?estado=eq.publicado&fecha_publicacion=eq.${fecha}&select=organismo,informe,publicado_md`,
        0,
      ),
    ]);

  // Color de la rueda: null si no cargó nada ese día (el informe sale igual, degrada).
  const color = colorRes.ok && Array.isArray(colorRes.data) && colorRes.data.length > 0
    ? (colorRes.data[0] as { fecha: string; texto: string; actualizado: string })
    : null;

  const bcra = bcraRes.ok && Array.isArray(bcraRes.data) && bcraRes.data.length > 0
    ? (bcraRes.data[0] as { fecha: string; monto_musd: number; fuente: string })
    : null;

  // Noticias: solo lo citable del día, acotado (top 4 destacadas).
  const noticiasCompactas = {
    destacados: noticias.destacados.slice(0, 4),
    meta: noticias.meta,
  };

  // Volumen operado del día en A3 por grano (suma de todas las posiciones vivas).
  const volumenPorGrano = Object.fromEntries(
    cierres.granos.map((g) => [g.underlying, volumenTotalGrano(g)]),
  );

  // Informe de organismo publicado JUSTO hoy (ej. USDA/CONAB/GEA/DEA) O cargado a la base
  // hoy con una fecha_publicacion vieja (BCBA-PAS: Lautaro lo sube con la fecha real del
  // informe, que puede ser de días atrás) — fix de auditoría V2: antes solo miraba `fecha`,
  // el disparo de PAS nunca matcheaba. Reusa estimaciones.ts, cero lógica nueva. Si además
  // MP4 ya publicó su interpretación de ese mismo informe, se adjunta vía `interpretaciones`.
  const estimRows = estimRes.ok ? parseRows(estimRes.data) : [];
  const informesHoy = organismosPresentes(estimRows)
    .map((o) => construirCambios(estimRows, o))
    .filter((c) => c.cambios.length > 0 && (c.fecha === fecha || c.actualizadoEn?.slice(0, 10) === fecha));
  const interpretaciones = interpRes.ok && Array.isArray(interpRes.data) ? interpRes.data : [];

  return {
    generado: new Date().toISOString(),
    tipo: "diario" as const,
    fecha,
    cierres,
    arbitrajes,
    pizarra,
    dolarFuturo,
    chicago,
    noticias: noticiasCompactas,
    agenda: getEventos(fecha, manana),
    color,
    bcra,
    volumenPorGrano,
    informesHoy,
    interpretaciones,
  };
}

async function datosSemanal(fecha: string) {
  const semanaProxima = new Date(new Date(`${fecha}T12:00:00Z`).getTime() + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const desdeSemana = new Date(new Date(`${fecha}T12:00:00Z`).getTime() - 6 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [
    variacionGranos,
    variacionChicago,
    variacionPizarra,
    variacionDolarOficial,
    viewsMercado,
    negociado,
    embarques,
    empresas,
    pizarra,
    dolarFuturo,
    chicago,
    noticias,
    estimRes,
  ] = await Promise.all([
    getVariacionSemanalGranos(fecha),
    getVariacionSemanalChicago(fecha),
    getVariacionSemanalPizarra(fecha),
    getVariacionSemanalDolarOficial(fecha),
    getViewMercadoVigentePorGrano(),
    getNegociado(),
    getMesaEmbarque(),
    getEmpresas(),
    getPizarra(),
    getDolarFuturo(),
    getMonitorMercados(),
    getNoticias(),
    sbSelectAll(
      "estimaciones_produccion?select=organismo,pais,grano,campania,variable,valor,unidad,fecha_publicacion,informe,url&order=fecha_publicacion.asc",
      3600,
    ),
  ]);

  const noticiasCompactas = {
    destacados: noticias.destacados.slice(0, 8),
    meta: noticias.meta,
  };

  // Informes de organismos publicados EN LA SEMANA (no solo hoy) — mismo cálculo que el
  // diario, ventana más amplia.
  const estimRows = estimRes.ok ? parseRows(estimRes.data) : [];
  const informesSemana = organismosPresentes(estimRows)
    .map((o) => construirCambios(estimRows, o))
    .filter((c) => c.fecha && c.fecha >= desdeSemana && c.fecha <= fecha && c.cambios.length > 0);

  return {
    generado: new Date().toISOString(),
    tipo: "semanal" as const,
    fecha,
    desdeSemana,
    variacionGranos,
    variacionChicago,
    variacionPizarra,
    variacionDolarOficial,
    viewsMercado,
    negociado,
    embarques,
    empresas,
    pizarra,
    dolarFuturo,
    chicago,
    noticias: noticiasCompactas,
    informesSemana,
    agenda: getEventos(fecha, semanaProxima),
  };
}
