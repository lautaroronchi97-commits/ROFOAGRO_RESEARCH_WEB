import "server-only";
import { getArbitrajes } from "./arbitrajes-cierres";
import { getPases } from "./pases-cierres";
import { getDolarFuturo } from "./market";
import { getDolarLinked } from "./market/dolar-linked";
import { getDolarOficialHistorico } from "./dolar-historico";
import { getMonitorMercados, getVariacionSemanalMacro } from "./monitor-mercados";
import { getNoticias, getNoticiasSemana } from "./noticias";
import { getEventos } from "./calendario";
import { getNegociado } from "./compras/negociado";
import { getMesaEmbarque } from "./lineup/embarque";
import { getEmpresas } from "./lineup/empresas";
import { getDjveResumen } from "./djve";
import { getCamionesSemana } from "./camiones/semanal";
import { getComprasBcra, acumuladoSemanalBcra } from "./bcra-mulc";
import { getPasZonasInforme } from "./pas-zonas";
import { getPasCondicionInforme } from "./pas-condicion";
import { getPizarra } from "./pizarra";
import { sbSelect, sbSelectAll } from "./supabase";
import { parseRows, construirCambios, organismosPresentes } from "./estimaciones";
import {
  getVariacionSemanalGranos,
  getVariacionSemanalChicago,
  getVariacionSemanalPizarra,
  getVariacionSemanalDolarOficial,
  getViewMercadoVigentePorGrano,
  getScorecardResumen,
  getVolumenA3Semanal,
} from "./informe-semanal";

/**
 * informe-semanal-datos.ts — ÚNICA función que arma los insumos del informe semanal (E4 de
 * docs/PLAN_INFORMES_V3.md §6/§10), consumida por `/api/informes/datos?tipo=semanal` (Routine
 * externa, vía token) Y por la plantilla `/informes/plantilla/semanal` — mismo patrón que
 * `informe-diario-datos.ts` (E3): cero query duplicada entre las 2 superficies. Antes esta
 * función vivía adentro del route handler; se extrajo para que la plantilla dejara de tener que
 * re-derivar sus propios datos (y para poder sumarle 2 campos que el route no necesitaba pero la
 * plantilla sí: `comprasBcra` completo con `serie` para el gráfico de barras, y `pases` del
 * producto para la sección "Tasas implícitas").
 */

export type ProsaProductoSemanal = { texto?: string };

/** Fecha del último semanal ENVIADO antes de `antesDe` — el ancla de la ventana semanal (N: E1
 *  §6.1 "vs la fecha del último informes_generados tipo=semanal estado=enviado", en vez de un
 *  fijo −7d; si un viernes no salió, la ventana se ensancha sola y cubre el hueco). `null` si
 *  nunca se envió uno (primera corrida). */
export async function fechaUltimoSemanalEnviado(antesDe: string): Promise<string | null> {
  const res = await sbSelect(
    `informes_generados?tipo=eq.semanal&estado=eq.enviado&fecha=lt.${antesDe}&select=fecha&order=fecha.desc&limit=1`,
    0,
  );
  if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) return null;
  return (res.data[0] as { fecha: string }).fecha;
}

export async function datosSemanal(fecha: string) {
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
    pases,
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
    // V3 (PLAN_INFORMES_V2.md §6.3): hit-rate/racha a 14 días por grano, se menciona 1 vez
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
    // E4: pases del producto (sección "Tasas implícitas" de §6.1) — sin filtro de liquidez (esa
    // regla es de la placa en vivo de A3, no de una foto semanal de ajustes de cierre).
    getPases(),
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
    pases,
    volatilidadDolar: {
      volatilidadSemanal: dolarHistorico.volatilidadSemanal.slice(-8),
      volatilidadDiaria: dolarHistorico.volatilidadDiaria.slice(-30),
    },
    comprasBcraSemana: acumuladoSemanalBcra(comprasBcra.serie, fecha),
    // Objeto completo (con `serie`) para el gráfico de barras de la web — el JSON del route ya
    // traía solo el agregado semanal, que le alcanza a la skill para la prosa.
    comprasBcra,
    pasZonas,
    pasCondicion,
    volumenA3Semanal,
    variacionMacro,
  };
}
