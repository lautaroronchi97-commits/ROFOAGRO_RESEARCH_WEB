import { timingSafeEqual } from "node:crypto";
import { getTemperatura } from "@/lib/lineup/temperatura";
import { getSemaforo } from "@/lib/lineup/semaforo";
import { getEmpresas } from "@/lib/lineup/empresas";
import { getMesaEmbarque } from "@/lib/lineup/embarque";
import { getNegociado } from "@/lib/compras/negociado";
import { getSenalCamiones, getCamiones } from "@/lib/camiones/camiones";
import { getCamionesPlantas } from "@/lib/camiones/plantas";
import { getCurvaGranos } from "@/lib/curva";
import { getPases } from "@/lib/pases-cierres";
import { getArbitrajes } from "@/lib/arbitrajes-cierres";
import { getCapacidad } from "@/lib/capacidad";
import { getPizarra } from "@/lib/pizarra";
import { getMonitorMercados } from "@/lib/monitor-mercados";
import { getNoticias, getNoticiasSemana } from "@/lib/noticias";
import { getDolarFuturo } from "@/lib/market";
import { getEventos } from "@/lib/calendario";
import { getDjveResumen } from "@/lib/djve";
import { getPasZonasInforme } from "@/lib/pas-zonas";
import { getPasCondicionInforme } from "@/lib/pas-condicion";
import {
  getViewMercadoVigentePorGrano,
  getVariacionSemanalGranos,
  getVariacionSemanalChicago,
  getVariacionSemanalPizarra,
  getVolumenA3Semanal,
  getDesacopleLocal,
  getZonaPrecio,
} from "@/lib/informe-semanal";
import { hoyCordobaISO } from "@/lib/dates";
import { sbSelect, sbSelectAll } from "@/lib/supabase";
import { parseRows, construirPizarra, construirCambios, organismosPresentes } from "@/lib/estimaciones";

/**
 * GET /api/views/insumos — auth: header `Authorization: Bearer <INFORME_TOKEN>`.
 *
 * JSON con TODOS los insumos del view de mercado semanal (MP3 de docs/PLAN_INFORMES.md):
 * lo que la web ya computa, en un solo lugar, para que la sesión de research
 * (skill `view-mercado`) cite números exactos sin duplicar lógica ni scrapear
 * páginas gateadas. Misma idea que el /api/informes/datos de MP1.
 *
 * Gate por token de env (INFORME_TOKEN): sin token válido → 401. Si la env no está
 * configurada, la ruta queda cerrada (401 siempre). Nunca se cachea.
 * E5 #12a: el token viaja por HEADER (antes ?token= quedaba en los request logs de
 * Vercel y de cualquier proxy) y el compare es timing-safe.
 */

function tokenValido(recibido: string, esperado: string): boolean {
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<Response> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const esperado = process.env.INFORME_TOKEN ?? "";
  const noCache = { "cache-control": "private, no-store" };
  if (!tokenValido(token, esperado)) {
    return Response.json({ error: "No autorizado." }, { status: 401, headers: noCache });
  }

  const hoy = hoyCordobaISO();
  const en14 = new Date(new Date(`${hoy}T12:00:00Z`).getTime() + 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const desde7d = new Date(new Date(`${hoy}T12:00:00Z`).getTime() - 6 * 86_400_000).toISOString().slice(0, 10);

  const [
    temperatura,
    semaforo,
    empresas,
    embarques,
    negociado,
    senalCamiones,
    curva,
    pases,
    arbitrajes,
    capacidad,
    pizarra,
    chicago,
    dolarFuturo,
    noticias,
    estimRes,
    // E1 de PLAN_INFORMES_V3.md §7.2 — insumos ampliados del view v3.
    camiones,
    camionesPlantas,
    djveResumen,
    pasZonas,
    pasCondicion,
    noticiasSemana,
    diariosRes,
    interpSemanaRes,
    viewsVigentes,
    variacionGranos,
    variacionChicago,
    variacionPizarraSemanal,
    volumenA3Semanal,
    desacopleLocal,
    zonaPrecio,
  ] = await Promise.all([
    getTemperatura(),
    getSemaforo(),
    getEmpresas(),
    getMesaEmbarque(),
    getNegociado(),
    getSenalCamiones(),
    getCurvaGranos(),
    getPases(),
    getArbitrajes(),
    getCapacidad(),
    getPizarra(),
    getMonitorMercados(),
    getDolarFuturo(),
    getNoticias(),
    sbSelectAll(
      "estimaciones_produccion?select=organismo,pais,grano,campania,variable,valor,unidad,fecha_publicacion,informe,url,actualizado_en&order=fecha_publicacion.asc",
      3600,
    ),
    getCamiones(),
    getCamionesPlantas(),
    getDjveResumen(),
    getPasZonasInforme(),
    getPasCondicionInforme(),
    getNoticiasSemana(hoy, 7),
    sbSelect(
      `informes_generados?tipo=eq.diario&estado=eq.enviado&fecha=gte.${desde7d}&fecha=lte.${hoy}&select=fecha,titulo,prosa&order=fecha.asc`,
      0,
    ),
    sbSelect(
      `interpretaciones?estado=eq.publicado&editado_en=gte.${desde7d}T00:00:00&select=organismo,informe,fecha_publicacion,granos,publicado_md,editado_en,impacto&order=editado_en.desc`,
      0,
    ),
    getViewMercadoVigentePorGrano(),
    getVariacionSemanalGranos(hoy),
    getVariacionSemanalChicago(hoy),
    getVariacionSemanalPizarra(hoy),
    getVolumenA3Semanal(hoy),
    getDesacopleLocal(hoy),
    getZonaPrecio(hoy),
  ]);

  // Estimaciones: pizarra compacta (última por organismo/país/grano + Δ) + cambios del
  // último informe de cada organismo — no los miles de vintages crudos.
  const estimRows = estimRes.ok ? parseRows(estimRes.data) : [];
  const estimaciones = {
    pizarra: construirPizarra(estimRows),
    cambios: organismosPresentes(estimRows).map((o) => construirCambios(estimRows, o)),
  };

  // Noticias: solo lo citable (titular + fuente + categoría), acotado.
  const noticiasCompactas = {
    destacados: noticias.destacados.slice(0, 10),
    categorias: noticias.categorias.map((c) => ({ ...c, items: c.items.slice(0, 6) })),
    meta: noticias.meta,
  };

  const diariosSemana = diariosRes.ok && Array.isArray(diariosRes.data) ? diariosRes.data : [];
  const interpretacionesSemana =
    interpSemanaRes.ok && Array.isArray(interpSemanaRes.data) ? interpSemanaRes.data : [];

  return Response.json(
    {
      generado: new Date().toISOString(),
      fecha: hoy,
      temperatura,
      semaforo,
      empresas,
      embarques,
      negociado,
      senalCamiones,
      estimaciones,
      curva,
      pases,
      arbitrajes,
      capacidad,
      pizarra,
      chicago,
      dolarFuturo,
      noticias: noticiasCompactas,
      agenda: getEventos(hoy, en14),
      // §7.2 — camiones completos (no solo la señal destilada), DJVE por familia, condición de
      // cultivos, análisis propios de la semana (diarios+interpretaciones+views de otros
      // granos), Δ semanal de precios, volumen A3 semanal, desacople local-internacional y
      // zona del precio (percentil histórico 5 años).
      camiones,
      camionesPlantas,
      djveResumen,
      pasZonas,
      pasCondicion,
      noticiasSemana,
      diariosSemana,
      interpretacionesSemana,
      viewsVigentes,
      variacionGranos,
      variacionChicago,
      variacionPizarraSemanal,
      volumenA3Semanal,
      desacopleLocal,
      zonaPrecio,
    },
    { headers: noCache },
  );
}
