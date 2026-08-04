import { getCierresGranos, volumenTotalGrano } from "@/lib/futuros";
import { getArbitrajes } from "@/lib/arbitrajes-cierres";
import { getPizarra } from "@/lib/pizarra";
import { getDolarFuturo, getVolumenCambiario } from "@/lib/market";
import { getDolarLinked } from "@/lib/market/dolar-linked";
import { getDolarOficialHistorico } from "@/lib/dolar-historico";
import { getMonitorMercados, getVariacionSemanalMacro } from "@/lib/monitor-mercados";
import { getNoticias, getNoticiasSemana } from "@/lib/noticias";
import { getEventos } from "@/lib/calendario";
import { getNegociado } from "@/lib/compras/negociado";
import { getMesaEmbarque } from "@/lib/lineup/embarque";
import { getEmpresas } from "@/lib/lineup/empresas";
import { getDjveResumen } from "@/lib/djve";
import { getCamionesPlantas } from "@/lib/camiones/plantas";
import { getCamionesSemana } from "@/lib/camiones/semanal";
import { getComprasBcra, acumuladoSemanalBcra } from "@/lib/bcra-mulc";
import { getPasZonasInforme } from "@/lib/pas-zonas";
import { getPasCondicionInforme } from "@/lib/pas-condicion";
import { variacionDiariaPizarra } from "@/lib/informe-diario-datos";
import { top3PorVolumenDelDia } from "@/lib/a3-live";
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
  getScorecardResumen,
  getVolumenA3Semanal,
} from "@/lib/informe-semanal";

/**
 * GET /api/informes/datos?fecha=YYYY-MM-DD[&tipo=diario|semanal] — auth: header
 * `Authorization: Bearer <INFORME_TOKEN>` (mismo token y patrón timing-safe que
 * /api/views/insumos de MP3). Nunca se cachea.
 *
 * `tipo=diario` (default, MP1): granos (ajustes A3 con Δ vs rueda anterior + pizarra CAC
 * $/USD), dólar mayorista + curva DDF, Chicago + macro, noticias del día, agenda de
 * hoy/mañana, el "color de la rueda"/BCRA que Lautaro carga en /admin/datos, y el view de
 * mercado vigente por grano (V1, con su `evidencia_externa` ya verificada — V4 de
 * PLAN_INFORMES_V2.md §6.4: el diario la puede citar como contexto, cero fetch nuevo).
 *
 * `tipo=semanal` (MP2/V3): variación SEMANAL (último dato real vs el de ~7 días antes, sin
 * asumir "viernes calendario") de granos/Chicago/pizarra/dólar oficial, negociado SIO de
 * la semana, comercio exterior (embarques + empresas), view de mercado por grano (con
 * `relacion_previa` — V3 la usa para el bullet automático de SWITCH) y su scorecard
 * (hit-rate/racha a 4 semanas, mencionado 1 vez por mes), y agenda de la semana próxima.
 * Todo reusando las libs existentes.
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
  // Agenda a 7 días (§5.1 bloque H, V3 — antes solo mostraba lo de hoy/mañana).
  const en7 = new Date(new Date(`${fecha}T12:00:00Z`).getTime() + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [
    cierres,
    arbitrajes,
    pizarra,
    dolarFuturo,
    chicago,
    noticias,
    colorRes,
    bcraRes,
    estimRes,
    interpRes,
    viewsMercado,
    volumenCambiario,
    djveResumen,
    camionesPlantas,
    variacionPizarra,
    top3PorGrano,
  ] = await Promise.all([
    getCierresGranos(),
    getArbitrajes(),
    getPizarra(),
    getDolarFuturo(),
    getMonitorMercados(),
    // Noticias últimas 24 hs (§5.1 bloque G, V3) — "puede ser cero", no la ventana de 3 días
    // hábiles del panel público.
    getNoticias(24),
    sbSelect(`mesa_color?fecha=eq.${fecha}&select=fecha,texto,chicago_bcr,actualizado`, 0),
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
      `interpretaciones?estado=eq.publicado&fecha_publicacion=eq.${fecha}&select=organismo,informe,publicado_md,impacto`,
      0,
    ),
    // V4 (PLAN_INFORMES_V2.md §6.4): view vigente por grano con su evidencia_externa ya
    // verificada — el diario la puede citar de contexto, sin research propio.
    getViewMercadoVigentePorGrano(),
    // E1 de PLAN_INFORMES_V3.md §5.1 bloque D: Δ% del oficial + volumen MAE de especies USD —
    // la lib ya trae `oficial`/`oficialVarPct`, una sola vía (no tocar DolarFuturoData).
    getVolumenCambiario(),
    getDjveResumen(),
    getCamionesPlantas(),
    variacionDiariaPizarra(fecha),
    top3PorVolumenDelDia(),
  ]);

  // Color de la rueda: null si no cargó nada ese día (el informe sale igual, degrada).
  const color = colorRes.ok && Array.isArray(colorRes.data) && colorRes.data.length > 0
    ? (colorRes.data[0] as { fecha: string; texto: string; chicago_bcr: string | null; actualizado: string })
    : null;

  const bcra = bcraRes.ok && Array.isArray(bcraRes.data) && bcraRes.data.length > 0
    ? (bcraRes.data[0] as { fecha: string; monto_musd: number; fuente: string })
    : null;

  // Noticias: solo lo citable del día, acotado (top 4 destacadas, ya sobre la ventana de 24 hs).
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
    agenda: getEventos(fecha, en7),
    color,
    bcra,
    volumenPorGrano,
    informesHoy,
    interpretaciones,
    viewsMercado,
    volumenCambiario,
    djveResumen,
    camionesPlantas,
    variacionPizarra,
    top3PorGrano,
  };
}

/** Fecha del último semanal ENVIADO antes de `antesDe` — el ancla de la ventana semanal (E1 de
 *  PLAN_INFORMES_V3.md §6.1: "vs la fecha del último informes_generados tipo=semanal
 *  estado=enviado", en vez de un fijo −7d; si un viernes no salió, la ventana se ensancha sola
 *  y cubre el hueco). `null` si nunca se envió uno (primera corrida). */
async function fechaUltimoSemanalEnviado(antesDe: string): Promise<string | null> {
  const res = await sbSelect(
    `informes_generados?tipo=eq.semanal&estado=eq.enviado&fecha=lt.${antesDe}&select=fecha&order=fecha.desc&limit=1`,
    0,
  );
  if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) return null;
  return (res.data[0] as { fecha: string }).fecha;
}

async function datosSemanal(fecha: string) {
  const semanaProxima = new Date(new Date(`${fecha}T12:00:00Z`).getTime() + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const desdeSemanaFallback = new Date(new Date(`${fecha}T12:00:00Z`).getTime() - 6 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const ultimoSemanalFecha = await fechaUltimoSemanalEnviado(fecha);
  const desdeSemana = ultimoSemanalFecha
    ? new Date(new Date(`${ultimoSemanalFecha}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10)
    : desdeSemanaFallback;

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
    scorecard,
    diariosRes,
    interpSemanaRes,
    noticiasSemana,
    djveResumen,
    camionesSemana,
    dolarLinked,
    arbitrajes,
    dolarHistorico,
    comprasBcra,
    pasZonas,
    pasCondicion,
    volumenA3Semanal,
    variacionMacro,
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
    // V3 (PLAN_INFORMES_V2.md §6.3): hit-rate/racha a 4 semanas por grano, se menciona 1 vez
    // por mes en el cierre — cero fórmula nueva, reusa la lib pura de /granos/view.
    getScorecardResumen(),
    // E1 de PLAN_INFORMES_V3.md §6.1: los DIARIOS de la semana ("lectura de los informes
    // diarios desde la última publicación") — la skill los usa para el hilo narrativo, no
    // para números (esos salen de las libs).
    sbSelect(
      `informes_generados?tipo=eq.diario&estado=eq.enviado&fecha=gte.${desdeSemana}&fecha=lte.${fecha}&select=fecha,titulo,prosa&order=fecha.asc`,
      0,
    ),
    // Interpretaciones PUBLICADAS esta semana (por cuándo se publicaron, no por la fecha del
    // informe original — mismo criterio "day-scoped" que la home usa para Novedades del día).
    sbSelect(
      `interpretaciones?estado=eq.publicado&editado_en=gte.${desdeSemana}T00:00:00&select=organismo,informe,fecha_publicacion,granos,publicado_md,editado_en,impacto&order=editado_en.desc`,
      0,
    ),
    getNoticiasSemana(fecha, 7),
    getDjveResumen(),
    getCamionesSemana(fecha),
    getDolarLinked(),
    getArbitrajes(),
    getDolarOficialHistorico(),
    getComprasBcra(),
    getPasZonasInforme(),
    getPasCondicionInforme(),
    getVolumenA3Semanal(fecha),
    getVariacionSemanalMacro(fecha),
  ]);

  const noticiasCompactas = {
    destacados: noticias.destacados.slice(0, 8),
    meta: noticias.meta,
  };

  // Informes de organismos publicados EN LA SEMANA (desde el último semanal enviado) — mismo
  // cálculo que el diario, ventana ahora anclada en vez de fija.
  const estimRows = estimRes.ok ? parseRows(estimRes.data) : [];
  const informesSemana = organismosPresentes(estimRows)
    .map((o) => construirCambios(estimRows, o))
    .filter((c) => c.fecha && c.fecha >= desdeSemana && c.fecha <= fecha && c.cambios.length > 0);

  const diariosSemana = diariosRes.ok && Array.isArray(diariosRes.data) ? diariosRes.data : [];
  const interpretacionesSemana =
    interpSemanaRes.ok && Array.isArray(interpSemanaRes.data) ? interpSemanaRes.data : [];

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
    scorecard,
    diariosSemana,
    interpretacionesSemana,
    noticiasSemana,
    djveResumen,
    camionesSemana,
    dolarLinked,
    arbitrajes,
    volatilidadDolar: {
      volatilidadSemanal: dolarHistorico.volatilidadSemanal.slice(-8),
      volatilidadDiaria: dolarHistorico.volatilidadDiaria.slice(-30),
    },
    comprasBcraSemana: acumuladoSemanalBcra(comprasBcra.serie, fecha),
    pasZonas,
    pasCondicion,
    volumenA3Semanal,
    variacionMacro,
  };
}
